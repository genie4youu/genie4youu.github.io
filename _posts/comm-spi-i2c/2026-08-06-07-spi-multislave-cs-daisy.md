---
title: 07. 멀티 슬레이브 — CS 관리와 데이지 체인
date: 2026-08-06 08:07:00 +0900
description: 데이지 체인의 진짜 가치는 속도가 아니라 동시성이다. 개별 CS로 6축을 읽으면 축 사이에 최대 33 µs 시각차가 생겨 순기구학이 왜곡된다.
categories: [로봇 통신, SPI와 I2C]
tags: [통신, spi, 데이지체인, 동시성, 엔코더, cpp]
mermaid: true
math: true
---

> **기준 출처:** TI SLVA020, 데이지 체인 지원 칩의 데이터시트(Analog Devices LTC 계열 ADC, TI 모터 드라이버의 SPI 캐스케이드 절), MCU 레퍼런스 매뉴얼의 SPI NSS 관리 절(ST RM0090 §28.3.1 등) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [06. SPI 모드와 타이밍 여유](/posts/06-spi-modes-cpol-cpha/) | 다음 → [08. DMA와 인터럽트](/posts/08-spi-dma-interrupt-cost/)

---

## 1. 두 가지 방식

슬레이브가 여럿일 때 SPI 는 두 가지로 확장한다.

개별 CS 는 병렬 연결이다. SCLK 와 MOSI 와 MISO 를 공유하고 슬레이브 하나당 CS 핀 하나를 준다. 한 번에 하나씩만 통신하고 각각 다른 모드와 클럭을 써도 된다.

데이지 체인은 직렬 연결이다.

```mermaid
flowchart LR
  M[마스터 MOSI] --> S1[슬레이브 1] --> S2[슬레이브 2] --> S3[슬레이브 3] --> R[마스터 MISO]
```

모든 슬레이브의 시프트 레지스터가 한 줄로 이어진다. 3개의 8비트 슬레이브면 24비트짜리 시프트 레지스터 하나가 된다. CS 핀은 하나이고 모든 슬레이브를 한 번에 읽고 쓴다. 다만 슬레이브가 이 방식을 지원해야만 된다. 데이터시트에 daisy chain 이나 cascade 가 명시돼 있어야 한다.

## 2. 무엇이 갈리나

| | 개별 CS | 데이지 체인 |
| --- | --- | --- |
| CS 핀 | N 개 | 1 개 |
| N개 읽기 총 전송 시간 | N 곱하기 (프레임과 CS 오버헤드) | 1 회 곱하기 (N 곱하기 프레임) |
| 동시성 | 슬레이브마다 읽는 시각이 다르다 | 전부 같은 순간에 래치한다 |
| 슬레이브 하나 고장 | 나머지는 정상이다 | 체인 전체가 멎는다 |
| 서로 다른 칩 혼용 | 자유롭다 | 모드와 비트 수가 같아야 한다 |
| 확장 | 핀이 모자라면 끝이다 | 이론상 무제한이고 시간만 늘어난다 |
| 지원 여부 | 모든 SPI 칩 | 지원하는 칩만 |

### 동시성이 제어에서 결정적이다

6축 로봇의 엔코더를 개별 CS 로 읽으면 축 1은 t 가 0 µs 근처의 값이고 축 6은 t 가 75 µs 근처의 값이다. 축 1과 축 6의 위치가 75 µs 다른 순간의 값이다. 관절이 100 rad/s 로 움직이면 그 사이에 0.0075 rad, 곧 약 0.43° 를 돈다. 순기구학으로 말단 위치를 계산하면 왜곡된 자세가 나온다.

데이지 체인은 CS 하강 순간 모든 슬레이브가 동시에 자기 값을 래치하고 그다음에 순서대로 밀려 나온다. 읽는 시각이 하나다.

EtherCAT 의 분산 클록이 푸는 문제와 같은 종류다. 규모가 다를 뿐이다. DC 는 네트워크 전체를, 데이지 체인은 SPI 버스 하나를 동기시킨다.

개별 CS 를 써야 하는데 동시성이 필요하면 별도의 래치 신호를 모든 슬레이브에 동시에 주고 그다음에 순서대로 읽는 방법이 있다. 많은 ADC 가 `CONVST` 핀으로 이걸 제공한다.

## 3. 데이지 체인 다루기

24비트 체인, 곧 8비트 슬레이브 3개를 생각하면 규칙이 명확해진다. 처음 밀어 넣은 바이트가 체인의 가장 끝 슬레이브에 도착한다. 그래서 보낼 때 순서가 뒤집힌다.

```cpp
// comm_core/spi_daisy_chain.hpp
// N개의 동일 슬레이브가 데이지 체인으로 연결된 버스.
// 프레임 크기가 같아야 하고 명령 순서가 뒤집힌다는 점이 핵심이다.
template <std::size_t kSlaves, std::size_t kFrameBytes>
class SpiDaisyChain {
public:
    static constexpr std::size_t kTotal = kSlaves * kFrameBytes;

    explicit SpiDaisyChain(ISpiBus& bus) : bus_{bus} {}

    // cmds[0] 은 슬레이브 0, 곧 마스터에 가장 가까운 쪽 것이다.
    // 내부에서 순서를 뒤집어 전송하므로 호출자는 물리 순서를 몰라도 된다
    bool exchange(std::span<const std::uint8_t, kTotal> cmds,
                  std::span<std::uint8_t, kTotal> replies) {
        std::array<std::uint8_t, kTotal> tx{};
        for (std::size_t i = 0; i < kSlaves; ++i) {
            const std::size_t src = i * kFrameBytes;
            const std::size_t dst = (kSlaves - 1 - i) * kFrameBytes;
            std::copy_n(cmds.begin() + src, kFrameBytes, tx.begin() + dst);
        }

        std::array<std::uint8_t, kTotal> rx{};
        if (!bus_.transfer(tx, rx)) return false;

        for (std::size_t i = 0; i < kSlaves; ++i) {
            const std::size_t src = (kSlaves - 1 - i) * kFrameBytes;
            const std::size_t dst = i * kFrameBytes;
            std::copy_n(rx.begin() + src, kFrameBytes, replies.begin() + dst);
        }
        return true;
    }

private:
    ISpiBus& bus_;
};
```

응답의 순서 뒤집기는 칩마다 다를 수 있다. 데이터시트의 캐스케이드 타이밍 다이어그램을 보고 확인한 뒤 알려진 서로 다른 값을 각 슬레이브에서 읽어 실측으로 검증한다. 여기서 순서를 잘못 잡으면 축 1의 값을 축 6에 쓰는 사고가 난다.

검증 요령이 있다. 슬레이브마다 고유한 값인 디바이스 ID 나 시리얼을 읽어 배열 순서를 확인한다. 위치 값처럼 비슷한 숫자로는 뒤바뀜을 알아보지 못한다.

### 데이지 체인의 치명적 약점

중간 슬레이브 하나가 고장 나면 체인이 끊기고 그 뒤 슬레이브도 전부 보이지 않는다. 그리고 어느 것이 원인인지 알기 어렵다.

| 대응 | 방법 |
| --- | --- |
| 각 슬레이브의 디바이스 ID 를 주기적으로 확인한다 | 어디서 끊겼는지 위치를 안다 |
| 안전이 중요하면 체인을 2~3개로 나눈다 | 하나가 멎어도 나머지 축은 산다 |
| 프레임에 CRC 가 있는 칩을 고른다 | [01편](/posts/01-spi-i2c-why-onboard/)의 오류 검출 문제를 던다 |

## 4. 하드웨어 NSS 대 GPIO 소프트웨어 CS

MCU 는 CS 를 자동으로 만들어주는 기능인 하드웨어 NSS 를 갖고 있다. 그런데 실무에서는 GPIO 로 직접 제어하는 경우가 많다.

| | 하드웨어 NSS | GPIO 소프트웨어 CS |
| --- | --- | --- |
| 편의 | 자동이다 | 코드로 올리고 내려야 한다 |
| 다중 바이트 트랜잭션 | MCU 에 따라 바이트마다 CS 를 올린다 | 완전히 제어된다 |
| 슬레이브 여러 개 | 핀 하나뿐이라 별도 GPIO 가 필요하다 | 원하는 만큼 쓸 수 있다 |
| $t_{CSS}$ 와 $t_{CSH}$ 조정 | 제한적이다 | 지연을 넣을 수 있다 |
| DMA 와 조합 | 트랜잭션 경계 처리에 주의해야 한다 | DMA 완료 콜백에서 올린다 |

바이트마다 CS 가 올라간다는 게 가장 자주 물리는 함정이다. [05편](/posts/05-spi-clock-master/)에서 봤듯 대부분의 칩은 CS 하강에서 내부 카운터를 리셋한다. 3바이트 명령을 보냈는데 CS 가 매 바이트 올라가면 슬레이브는 1바이트 명령 3개로 해석한다. 첫 바이트만 먹고 나머지는 무시된다는 증상이 나오고, CS 파형을 오실로스코프로 확인하면 즉시 보인다.

특별한 이유가 없으면 GPIO 로 직접 제어한다. 05편의 `SpiSelectGuard` 가 이걸 안전하게 감싼다.

```cpp
// 데이터시트의 t_CSS, t_CSH, t_CSD 를 코드에 반영한다
class GpioChipSelect {
public:
    void select() {
        pin_.set_low();
        delay_ns(t_css_);          // CS 하강에서 첫 클럭까지
    }
    void deselect() {
        delay_ns(t_csh_);          // 마지막 클럭에서 CS 상승까지
        pin_.set_high();
        delay_ns(t_csd_);          // 다음 트랜잭션까지 CS HIGH 유지. 잊기 쉽다
    }
private:
    GpioPin& pin_;
    std::uint32_t t_css_{50}, t_csh_{50}, t_csd_{200};   // 데이터시트 값으로 채운다
};
```

MCU 에 따라 SPI 주변장치가 이 지연을 하드웨어로 삽입해주기도 한다. NSS pulse 나 inter-data delay 라는 이름이다. 있으면 그걸 쓰는 게 정확하고 CPU 도 쓰지 않는다.

## 5. 어느 쪽이 빠른가

6축 엔코더를 축당 32비트, 곧 4바이트씩 1 kHz 로 읽는다고 하자. SPI 는 10 MHz 다.

**개별 CS**

| 항목 | 시간 |
| --- | --- |
| 프레임 4바이트, 32비트 @ 10 MHz | 3.2 µs |
| CS setup, hold, deselect | 약 0.5 µs |
| 소프트웨어 오버헤드 (GPIO, 설정, 인터럽트) | 약 3 µs |
| 축당 | 약 6.7 µs |
| 6축 | 약 40 µs |

**데이지 체인**

| 항목 | 시간 |
| --- | --- |
| 프레임 24바이트, 192비트 @ 10 MHz | 19.2 µs |
| CS 오버헤드 1회 | 0.5 µs |
| 소프트웨어 오버헤드 1회 | 3 µs |
| 합계 | 약 23 µs |

데이지 체인이 약 1.7배 빠르다. 그런데 진짜 이득은 시간이 아니라 동시성이다. 개별 CS 의 40 µs 는 축 사이에 최대 33 µs 의 시각차를 만들고 데이지 체인은 0 이다.

소프트웨어 오버헤드가 축당 3 µs 로 은근히 크다는 데 주목한다. 트랜잭션 횟수를 줄이는 것 자체가 이득이고 이게 [08편](/posts/08-spi-dma-interrupt-cost/)의 DMA 이야기로 이어진다.

## 정리

- 멀티 슬레이브는 개별 CS 인 병렬과 데이지 체인인 직렬 두 가지다.
- 데이지 체인은 모든 슬레이브 시프트 레지스터가 하나의 긴 레지스터가 되는 것이다.
- 데이지 체인의 진짜 가치는 속도가 아니라 동시성이다. CS 하강에 전부 동시에 래치한다.
- 개별 CS 로 6축을 읽으면 축 사이에 최대 33 µs 시각차가 생겨 순기구학이 왜곡된다.
- 개별 CS 에서 동시성이 필요하면 `CONVST` 같은 별도 래치 신호를 동시에 주고 순서대로 읽는다.
- 데이지 체인의 약점은 중간 하나가 고장 나면 전체가 멎고 원인을 찾기 어렵다는 것이다. 디바이스 ID 를 주기적으로 확인하고 체인을 나눈다.
- 데이지 체인은 명령 순서가 뒤집힌다. 순서 검증은 고유한 값으로 한다. 비슷한 위치 값으로는 뒤바뀜을 보지 못한다.
- 하드웨어 NSS 는 바이트마다 CS 를 올릴 수 있어 다중 바이트 명령이 깨진다. GPIO 직접 제어가 안전하다.
- 트랜잭션 사이 CS HIGH 시간을 코드에 반영한다.

## 참고

- [TI SLVA020 — Introduction to the Serial Peripheral Interface](https://www.ti.com/lit/an/slva020a/slva020a.pdf)
