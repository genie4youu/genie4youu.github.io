---
title: 11. MCU UART 드라이버 — 링 버퍼와 DMA
date: 2026-08-06 09:11:00 +0900
description: DMA 순환 모드와 IDLE 인터럽트가 핵심이다. 쓰기 위치는 N 빼기 NDTR 로 구하고, 바이트당 CPU 소모가 0이 되며 오버런이 구조적으로 사라진다.
categories: [로봇 통신, 시리얼]
tags: [통신, uart, dma, 링버퍼, 실시간제어, cpp]
mermaid: true
math: true
---

> **기준 출처:** MCU 레퍼런스 매뉴얼의 USART 와 DMA 절(ST RM0090 §30.3.13 Continuous communication using DMA, §10.3.3 DMA 순환 모드, §30.6.1 IDLE 플래그), ISO/IEC 14882 §31(`std::atomic`, acquire/release) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [10. 침묵 시간과 타임아웃](/posts/10-modbus-silence-timeout/) | 다음 → [12. 호스트 쪽 구현](/posts/12-host-termios-comport/)

---

## 1. 오버런을 구조적으로 없앤다

[08편](/posts/08-serial-errors-framing-overrun/)에서 봤듯 ORE 는 소프트웨어 문제다. 그리고 고속에서는 인터럽트만으로는 버티지 못한다.

| 보율 | 바이트 시간 | FIFO 없이 필요한 반응 속도 |
| --- | --- | --- |
| 115200 | 86.8 µs | 감당할 수 있다 |
| 460800 | 21.7 µs | 빠듯하다 |
| 1 Mbps | 10 µs | 불가능하다 |

해답은 두 층이다. UART 하드웨어에서 DMA 순환 모드로 원형 버퍼에 넣고, 소프트웨어가 여유롭게 꺼내 파서에 넘긴다. 첫 구간에 CPU 개입이 0 이다.

## 2. SPSC 링 버퍼는 락이 필요 없다

생산자 하나와 소비자 하나라는 조건이면 락이 필요 없다.

```cpp
// comm_core/ring_buffer.hpp
// 단일 생산자와 단일 소비자를 위한 락프리 링 버퍼.
// 크기를 2의 거듭제곱으로 두고 나머지 연산 대신 마스크를 쓴다. ISR 에서 나눗셈은 비싸다.
#pragma once
#include <atomic>
#include <array>
#include <cstddef>
#include <cstdint>

template <typename T, std::size_t N>
class SpscRingBuffer {
    static_assert((N & (N - 1)) == 0, "N 은 2의 거듭제곱이어야 한다");
public:
    // 생산자 전용이다. ISR 에서 호출한다
    bool push(const T& v) noexcept {
        const auto head = head_.load(std::memory_order_relaxed);
        const auto next = (head + 1) & kMask;
        if (next == tail_.load(std::memory_order_acquire)) {
            dropped_.fetch_add(1, std::memory_order_relaxed);   // 가득 찼다
            return false;
        }
        buf_[head] = v;
        head_.store(next, std::memory_order_release);           // 데이터 쓰기 뒤에 인덱스를 공개한다
        return true;
    }

    // 소비자 전용이다. 태스크에서 호출한다
    bool pop(T& out) noexcept {
        const auto tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire)) return false;
        out = buf_[tail];
        tail_.store((tail + 1) & kMask, std::memory_order_release);
        return true;
    }

    std::size_t size() const noexcept {
        return (head_.load(std::memory_order_acquire)
              - tail_.load(std::memory_order_acquire)) & kMask;
    }
    std::uint32_t dropped() const noexcept {
        return dropped_.load(std::memory_order_relaxed);
    }

private:
    static constexpr std::size_t kMask = N - 1;
    std::array<T, N> buf_{};
    std::atomic<std::size_t>   head_{0}, tail_{0};
    std::atomic<std::uint32_t> dropped_{0};
};
```

`head_.store(next, release)` 의 release 는 이 store 이전의 모든 쓰기가 먼저 보이게 하라는 뜻이다. 없으면 컴파일러나 CPU 가 순서를 바꿔서 인덱스는 갱신됐는데 데이터는 아직 안 쓰인 상태를 소비자가 볼 수 있다.

Cortex-M0 나 M3 같은 순차 실행 코어에서는 실제 재배치가 잘 일어나지 않아 `relaxed` 로도 우연히 동작한다. 그래서 버그가 오래 숨는다. 컴파일러 최적화 수준을 바꾸거나 코어를 바꾸면 그때 드러난다. 처음부터 제대로 쓴다.

## 3. DMA 순환 모드와 IDLE 인터럽트

수신에서 가장 좋은 구조다. CPU 개입 없이 계속 받고 데이터가 끊길 때만 알려준다.

| 항목 | 값 |
| --- | --- |
| DMA 모드 | Circular. 버퍼 끝에 도달하면 처음으로 되돌아간다 |
| DMA 인터럽트 | Half-Transfer 와 Transfer-Complete |
| UART 인터럽트 | IDLE. 선이 한 프레임 시간 이상 조용해지면 뜬다 |

DMA 컨트롤러의 남은 전송 개수 레지스터인 NDTR 을 읽으면 지금 어디까지 썼는지 계산된다.

$$\text{쓰기 위치} = N - \text{NDTR}$$

읽은 위치부터 쓰기 위치까지가 새로 온 데이터다.

```cpp
// comm_serial/uart_dma_rx.hpp
template <std::size_t N>
class UartDmaRx {
    static_assert((N & (N - 1)) == 0);
public:
    // IDLE 인터럽트와 DMA HT, TC 인터럽트에서 모두 호출한다.
    // 세 군데서 불러도 안전하도록 read_pos_ 기준으로만 계산한다.
    void on_event() {
        const std::size_t write_pos = N - dma_->NDTR;
        if (write_pos == read_pos_) return;                 // 새 데이터가 없다

        if (write_pos > read_pos_) {
            consume({&buf_[read_pos_], write_pos - read_pos_});
        } else {
            // 랩어라운드라 두 조각으로 나뉜다
            consume({&buf_[read_pos_], N - read_pos_});
            consume({&buf_[0], write_pos});
        }
        read_pos_ = write_pos;
    }

private:
    void consume(std::span<const std::uint8_t> chunk) {
        for (auto b : chunk) parser_.feed(b, now_us());     // 10편의 하이브리드 파서
        stats_.bytes_received += chunk.size();
    }

    alignas(32) std::array<std::uint8_t, N> buf_{};   // 캐시가 있으면 정렬이 필수다
    std::size_t     read_pos_{0};
    DmaStream*      dma_;
    ModbusRtuParser parser_;
    UartStats       stats_;
};
```

| | 인터럽트 방식 | DMA 순환에 IDLE |
| --- | --- | --- |
| 바이트당 CPU | 0.3 µs 곱하기 N | 0 |
| 인터럽트 횟수 | N 번 | 프레임당 1~2번 |
| 오버런 | 인터럽트가 밀리면 발생한다 | 버퍼가 안 넘치는 한 없다 |
| 지터 유발 | 크다 | 작다 |
| 프레임 경계 | 소프트웨어가 판단한다 | IDLE 이 알려준다 |

IDLE 인터럽트가 Modbus RTU 의 침묵 프레이밍과 정확히 맞아떨어진다. 하드웨어가 한 프레임 시간 이상 조용했다는 걸 알려주니 소프트웨어 타이머로 t3.5 를 재는 것보다 정확하고 싸다.

다만 IDLE 은 1 문자 시간을 기준으로 뜬다. Modbus 의 t3.5 인 3.5 문자와 다르므로 IDLE 을 덩어리가 끝났다는 신호로 쓰고 최종 판정은 [10편](/posts/10-modbus-silence-timeout/)의 길이와 CRC 로 한다.

## 4. 버퍼 크기 정하기

$$N \geq \text{바이트/초} \times t_{\text{최악 처리 지연}} \times \text{안전계수}$$

115200 8N1 에 최악 태스크 지연이 20 ms 라면 이렇게 된다.

$$\frac{115200}{10} \times 0.020 = 230\ \text{바이트}$$

안전계수 2 를 곱하면 460 이고 2의 거듭제곱으로 올려 512 바이트로 잡는다.

| 지연의 원천 | 크기 |
| --- | --- |
| 다른 태스크가 CPU 를 오래 잡는다 | 수 ms |
| 인터럽트 폭주 | µs 에서 ms |
| 플래시 쓰기(EEPROM 에뮬레이션) | 수십 ms |
| 디버거 브레이크포인트 | 무한이다 |

플래시 쓰기가 결정적인 경우가 많다. 파라미터를 저장하는 동안 인터럽트가 막히면 그 시간만큼 버퍼가 필요하다. 최악값으로 계산한다. `dropped()` 카운터가 0 이 아니면 버퍼가 작다는 확실한 증거다. 운영 중 감시한다.

## 5. 송신은 DMA 와 TC 인터럽트 두 단계다

[07편](/posts/07-rs485-half-duplex-direction/)에서 본 방향 전환 문제를 DMA 로 처리한다.

```cpp
void Rs485Port::send_dma(std::span<const std::uint8_t> data) {
    de_pin_.set_high();                     // 송신 모드
    dma_tx_->start(data.data(), data.size());
    // 이후는 인터럽트가 처리한다
}

// DMA 완료는 마지막 바이트를 DR 에 넣었다는 뜻이다. 아직 선로에 안 나갔다
void dma_tx_complete_isr() {
    dma_tx_->clear_flags();
    uart_->CR1 |= UART_CR1_TCIE;            // TC 인터럽트를 여기서 켠다
}

// TC 는 마지막 정지 비트까지 선로에 나갔다는 뜻이다. 이제 DE 를 내려도 된다
void uart_tc_isr() {
    uart_->CR1 &= ~UART_CR1_TCIE;
    de_pin_.set_low();                      // 수신 모드로 되돌린다
    tx_done_.store(true, std::memory_order_release);
}
```

두 단계 인터럽트가 필요한 이유가 07편의 TXE 와 TC 차이다. DMA 완료는 TXE 에 해당하고 실제 전송 완료는 TC 다. 한 단계로 줄이려다 마지막 바이트를 잘라먹는다. [SPI 08편](/posts/08-spi-dma-interrupt-cost/)의 SPI BSY 플래그 문제와 완전히 같은 구조다. 버퍼가 비었다는 것과 선로에 나갔다는 것은 다르다.

## 6. ISR 설계 원칙

| 원칙 | 이유 |
| --- | --- |
| ISR 에서 파싱하지 않는다 | 실행 시간이 데이터에 따라 달라져 지터가 된다 |
| ISR 에서 로그를 찍지 않는다 | printf 는 수백 µs 를 소비한다 |
| ISR 에서 동적 할당과 락을 쓰지 않는다 | 예측이 불가능하다 |
| 오류 플래그는 ISR 에서 즉시 클리어한다 | 안 하면 UART 가 멎는다 |
| 카운터는 `relaxed` atomic 으로 둔다 | 정확한 순서가 필요 없다 |
| 우선순위는 제어 루프보다 낮게 둔다 | 통신 때문에 제어가 밀리면 안 된다 |

마지막 줄이 중요하다. UART 인터럽트를 최고 우선순위로 두면 제어 루프에 지터가 생긴다. DMA 를 쓰면 인터럽트가 드물어지니 우선순위를 낮춰도 안전해진다. 이것도 DMA 의 이득이다.

## 정리

- 오버런을 없애는 구조는 DMA 순환과 링 버퍼와 소프트웨어 파서의 두 층이다.
- SPSC 링 버퍼는 락이 필요 없다. 크기를 2의 거듭제곱으로 해서 마스크 연산을 쓴다.
- 메모리 순서 acquire 와 release 를 제대로 쓴다. Cortex-M 에서는 `relaxed` 로도 우연히 동작해 버그가 오래 숨는다.
- DMA 순환 모드와 IDLE 인터럽트가 핵심 기법이다. 쓰기 위치는 N 에서 NDTR 을 뺀 값이고 랩어라운드는 두 조각으로 나눠 처리한다.
- 바이트당 CPU 소모가 0 이고 인터럽트는 프레임당 1~2회다.
- IDLE 인터럽트가 침묵 프레이밍과 궁합이 좋다. 단 기준이 1 문자라 Modbus t3.5 와 다르니 최종 판정은 길이와 CRC 로 한다.
- 버퍼 크기는 바이트/초에 최악 처리 지연과 안전계수를 곱한다. 115200 에 20 ms 면 512 바이트다.
- 플래시 쓰기가 최악 지연을 지배하는 경우가 많다.
- 송신은 DMA 완료에서 TC 인터럽트를 켜고 거기서 DE 를 내리는 두 단계다. 한 단계로 줄이면 마지막 바이트가 잘린다.
- ISR 은 파싱과 로그와 할당을 금지하고 오류 플래그는 즉시 클리어하며 우선순위는 제어 루프보다 낮게 둔다.
- `dropped()` 가 0 이 아니면 버퍼가 작다.

## 참고

- [ST RM0090 — STM32F4 레퍼런스 매뉴얼](https://www.st.com/resource/en/reference_manual/dm00031020.pdf)
- [cppreference — std::memory_order](https://en.cppreference.com/w/cpp/atomic/memory_order)
