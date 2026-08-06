---
title: 05. SPI — 클럭을 주는 쪽이 주인이다
date: 2026-08-06 08:05:00 +0900
description: SPI는 프로토콜이 아니라 링으로 이은 시프트 레지스터 두 개다. 그래서 언제나 교환이고, CS 하나가 프레임 경계와 상태 초기화를 동시에 맡는다.
categories: [로봇 통신, SPI와 I2C]
tags: [통신, spi, cs, 전이중, 엔코더, cpp]
mermaid: true
---

> **기준 출처:** TI SLVA020, MCU 레퍼런스 매뉴얼의 SPI 절(ST RM0090 §28 등), Linux 커널 SPI 서브시스템 문서. SPI 는 공식 규격서가 없어 데이터시트가 곧 규격이다 / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [04. I²C 실패 모드와 복구](/posts/04-i2c-failure-modes-recovery/) | 다음 → [06. SPI 모드와 타이밍 여유](/posts/06-spi-modes-cpol-cpha/)

---

## 1. 링으로 이은 시프트 레지스터 두 개

SPI 를 프로토콜로 생각하면 헷갈린다. 하드웨어 구조 하나로 보면 전부 설명된다. 마스터와 슬레이브에 8비트 시프트 레지스터가 하나씩 있고, MOSI 와 MISO 가 그 둘을 링으로 잇는다. 클럭 한 번에 양쪽 레지스터가 한 칸씩 민다. 8번 밀면 두 레지스터의 내용이 통째로 교환된다.

```mermaid
flowchart LR
  M[마스터 시프트 레지스터] -->|MOSI| S[슬레이브 시프트 레지스터]
  S -->|MISO| M
  C[SCLK 마스터가 만든다] --> M
  C --> S
```

그래서 SPI 는 보내기나 받기가 아니라 언제나 교환이다. 읽기만 하고 싶어도 뭔가를 보내야 하므로 더미 바이트(`0x00` 이나 `0xFF`)를 보낸다. 쓰기만 해도 뭔가가 돌아오는데 대개 버리지만 버리지 말아야 할 때가 있다.

이 사실 하나가 SPI API 의 모양을 결정한다. 좋은 SPI 드라이버는 `read()` 와 `write()` 가 아니라 `transfer(tx, rx)` 를 제공한다.

## 2. 네 개의 선

| 신호 | 방향 | 다른 이름 |
| --- | --- | --- |
| SCLK | 마스터에서 슬레이브로 | SCK, CLK |
| MOSI | 마스터에서 슬레이브로 | 마스터 기준 SDO, COPI, 슬레이브 기준 DIN |
| MISO | 슬레이브에서 마스터로 | 마스터 기준 SDI, CIPO, 슬레이브 기준 DOUT |
| CS | 마스터에서 슬레이브로 | SS, NSS, CE. 활성 LOW 가 보통이라 `CS#` 나 `nCS` 로 쓴다 |

이름 때문에 배선을 틀리는 일이 흔하다. 어떤 데이터시트는 슬레이브 관점에서 `SDI`(슬레이브의 입력이니 마스터의 MOSI)와 `SDO`(슬레이브의 출력이니 MISO)라고 쓴다. MOSI 를 MOSI 에 잇는 게 아니라 마스터의 출력을 슬레이브의 입력에 잇는 것이다. 신호 이름이 아니라 방향 화살표를 보고 배선한다. 최근에는 오해를 줄이려고 COPI 와 CIPO 표기를 쓰는 곳이 늘었다.

## 3. CS 는 세 가지를 한다

### 슬레이브를 고른다

여러 슬레이브가 SCLK 와 MOSI 와 MISO 를 공유하고 CS 가 LOW 인 슬레이브만 반응한다.

여기서 중요한 조건이 하나 붙는다. CS 가 HIGH 인 슬레이브는 MISO 를 반드시 고임피던스로 놓아야 한다. 안 그러면 두 슬레이브가 MISO 를 동시에 밀어 충돌한다. 데이터시트에 이 동작이 명시돼 있는지 확인한다. 안 되는 칩은 MISO 앞에 버퍼를 달아야 한다.

### 프레임 경계를 정한다

[기초 06편](/posts/06-basics-framing/)의 고정 길이와 대역 밖 표식 조합이다. CS 하강이 프레임 시작이고 상승이 끝이다. 길이 필드도 구분자도 CRC 도 없이 프레임이 정의된다. 이게 SPI 가 규격서 없이도 굴러가는 이유다. 경계 문제를 핀 하나로 회피했다.

### 슬레이브를 초기 상태로 되돌린다

대부분의 SPI 칩은 CS 하강에서 내부 비트 카운터를 0 으로 리셋한다. 그래서 I²C 와 달리 버스 행이 거의 없다. 통신이 어긋나도 CS 를 한 번 토글하면 정리된다. [I²C 04편](/posts/04-i2c-failure-modes-recovery/)의 9클럭 복구 같은 절차가 SPI 에 없는 이유가 이것이다.

### CS 를 잘못 다루는 흔한 실수

| 실수 | 결과 |
| --- | --- |
| 여러 바이트를 보내며 바이트마다 CS 를 토글한다 | 슬레이브가 매번 리셋되어 다중 바이트 명령이 적용되지 않는다 |
| CS 를 계속 LOW 로 두고 여러 트랜잭션을 돌린다 | 슬레이브가 명령 경계를 찾지 못한다 |
| CS 를 하드웨어 NSS 로 두고 자동 제어한다 | MCU 가 바이트마다 올릴 수 있다. GPIO 로 직접 제어하는 편이 안전하다 |

## 4. 실제 대화 패턴

### 명령 다음 데이터

대부분의 칩이 이 패턴이다. MOSI 로 명령이나 레지스터 번호를 보내는 동안 MISO 로 돌아오는 첫 바이트는 대개 쓰레기다. 슬레이브가 아직 응답을 준비하지 못했기 때문이다.

그런데 쓰레기가 아닌 칩도 있다. 상태 바이트를 실어 보내는 경우가 흔하다. 많은 ADC 와 엔코더 칩이 직전 트랜잭션의 상태나 직전 변환 결과를 첫 바이트에 실어준다. 그러면 트랜잭션을 하나 아낄 수 있다. 데이터시트의 타이밍 다이어그램을 끝까지 읽어야 알 수 있는 정보다.

### 파이프라인

엔코더와 ADC 에서 흔하다. 트랜잭션 N 에서 변환 시작 명령을 보내면서 동시에 N-1 의 결과를 받고, 트랜잭션 N+1 에서 다시 명령을 보내면서 N 의 결과를 받는다.

전이중이라 가능한 최적화다. 한 주기 지연이 생기지만 트랜잭션 수가 절반이 된다. 1 kHz 루프에서 의미 있는 차이다. 다만 지연 한 주기가 [기초 10편](/posts/10-basics-realtime-jitter/)의 지연 예산에 들어간다는 걸 잊으면 안 된다.

### 인터페이스는 transfer 하나로

```cpp
// comm_core/spi_bus.hpp
class ISpiBus {
public:
    virtual ~ISpiBus() = default;

    // SPI 는 교환이다. tx 와 rx 는 같은 길이여야 한다.
    // rx 가 필요 없으면 빈 span 을 넘겨 구현이 버리게 한다.
    virtual bool transfer(std::span<const std::uint8_t> tx,
                          std::span<std::uint8_t> rx) = 0;

    // CS 를 유지한 채 여러 번 transfer 해야 하는 칩을 위해 둔다
    virtual void select() = 0;
    virtual void deselect() = 0;
};

// RAII 로 CS 를 다루면 중간 return 이나 예외에서 CS 가 뜨는 사고를 막는다
class SpiSelectGuard {
public:
    explicit SpiSelectGuard(ISpiBus& b) : bus_{b} { bus_.select(); }
    ~SpiSelectGuard() { bus_.deselect(); }
    SpiSelectGuard(const SpiSelectGuard&) = delete;
    SpiSelectGuard& operator=(const SpiSelectGuard&) = delete;
private:
    ISpiBus& bus_;
};
```

`SpiSelectGuard` 가 실무에서 버그를 많이 막는다. 중간에 오류로 빠져나가면서 CS 를 LOW 로 남겨두면 다음 트랜잭션이 전부 어긋난다. RAII 로 묶으면 그럴 일이 없다.

## 5. 변형들

| 변형 | 선 | 언제 |
| --- | --- | --- |
| 표준 4선 | SCLK, MOSI, MISO, CS | 기본이다 |
| 3선 반이중 | SCLK, SDIO, CS. 데이터선 하나를 양방향으로 쓴다 | 핀이 정말 모자랄 때. 방향 전환 타이밍에 주의한다 |
| Dual, Quad SPI | 데이터선을 2개나 4개 병렬로 쓴다 | 시리얼 플래시(QSPI). 4배 빠르다 |
| 데이지 체인 | CS 하나로 여러 슬레이브를 직렬로 잇는다 | [07편](/posts/07-spi-multislave-cs-daisy/)에서 다룬다 |
| TI 동기 시리얼, Microwire | 프레임 신호 방식이 조금 다르다 | 일부 칩 |

## 6. SPI 가 잘하는 것과 못하는 것

| 잘하는 것 | 못하는 것 |
| --- | --- |
| 빠르다. 수십 MHz 에 프로토콜 오버헤드가 0 이다 | 오류 검출이 없다 |
| 지터가 없다. 마스터가 클럭을 직접 준다 | 거리가 짧다. 보드 안이고 길어야 수십 cm 다 |
| 전이중이라 보내면서 받는다 | 슬레이브마다 CS 핀이 필요해 핀을 차지한다 |
| 구현이 단순하다. 시프트 레지스터면 끝난다 | 흐름 제어가 없다. 슬레이브가 못 따라가도 방법이 없다 |
| CS 가 상태를 되돌려 버스 행이 없다 | 표준이 없어 칩마다 모드와 타이밍이 다르다 |

지터가 없다는 점이 제어에서 가장 큰 가치다. [기초 10편](/posts/10-basics-realtime-jitter/)에서 봤듯 지터는 속도 추정 노이즈로 바뀐다. SPI 는 마스터가 클럭 엣지를 직접 만드니 언제 샘플링됐는지가 ns 단위로 확정된다. 관절 엔코더를 읽는 데 SPI 계열이 여전히 표준인 이유다.

## 정리

- SPI 는 프로토콜이 아니라 링으로 이은 시프트 레지스터 두 개다.
- 그래서 언제나 교환이다. 읽으려면 더미를 보내야 하고 쓰면 뭔가 돌아온다.
- API 는 `read` 와 `write` 가 아니라 `transfer(tx, rx)` 다.
- 신호 이름 SDI 와 SDO 는 관점에 따라 뒤집힌다. 이름 말고 방향으로 배선한다.
- CS 는 슬레이브 선택과 프레임 경계 정의와 슬레이브 상태 초기화 셋을 한다.
- CS 가 상태를 되돌려주므로 SPI 에는 I²C 같은 버스 행이 없다.
- CS 가 HIGH 인 슬레이브는 MISO 를 고임피던스로 놔야 한다. 데이터시트를 확인한다.
- CS 는 `SpiSelectGuard` 같은 RAII 로 다룬다. 중간 이탈 시 CS 가 뜨는 사고를 막는다.
- 전이중을 살린 파이프라인 패턴으로 트랜잭션을 절반으로 줄일 수 있다. 대신 한 주기 지연이 예산에 들어간다.
- 제어에서 SPI 의 최대 강점은 속도가 아니라 지터가 없다는 것이다.

## 참고

- [TI SLVA020 — Introduction to the Serial Peripheral Interface](https://www.ti.com/lit/an/slva020a/slva020a.pdf)
- [Linux 커널 — SPI 서브시스템](https://www.kernel.org/doc/html/latest/spi/index.html)
