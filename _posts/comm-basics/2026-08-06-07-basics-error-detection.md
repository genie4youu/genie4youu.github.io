---
title: 07. 오류 검출 — 패리티, 체크섬, CRC
date: 2026-08-06 07:07:00 +0900
description: 목표는 오류를 없애는 것이 아니라 미검출 확률을 낮추는 것이다. CRC-4를 손으로 돌려보고, CRC-16을 C++로 구현하고, 이론을 전수 테스트로 증명한다.
categories: [로봇 통신, 기초]
tags: [통신, crc, 체크섬, 패리티, modbus, can, 기능안전]
math: true
---

> **기준 출처:** Modbus over Serial Line V1.02 §6.2.1, §6.2.2, Bosch CAN Spec 2.0 §3.1.1, §6, RFC 1071, IEEE 802.3 §3.2.9, Koopman "CRC Polynomial Selection for Embedded Networks"(DSN 2004) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [06. 프레이밍](/posts/06-basics-framing/) | 다음 → [08. 흐름제어와 재전송](/posts/08-basics-flow-control/)

---

## 1. 틀린 값이 조용히 지나가는 것이 최악이다

통신 오류에는 두 종류가 있다.

| | 무슨 일 | 심각도 |
| --- | --- | --- |
| 검출된 오류 | 이 프레임이 깨졌다고 판단해 버리거나 재요청한다 | 다룰 수 있다 |
| 미검출 오류 | 깨진 값이 정상인 척 통과한다 | 최악 |

모터 토크 명령이 `100` 에서 `10000` 으로 바뀌었는데 아무도 모르는 상황을 생각하면 된다. 오류 검출의 목적은 오류를 없애는 것이 아니라 미검출 확률을 충분히 낮추는 것이다. 그래서 이 글의 질문은 하나다. 각 방법은 어떤 오류를 잡고 어떤 오류를 놓치는가.

## 2. 오류는 버스트로 온다

노이즈는 보통 한 비트만 건드리지 않는다. 스위칭 노이즈 한 번, ESD 한 번은 연속된 여러 비트를 뭉갠다. 이걸 버스트 오류라 한다.

```text
원본:  1 0 1 1 0 0 1 0 1 1 0 1
오류:  1 0 1 [1 1 1 0] 0 1 1 0 1     ← 4비트 버스트
```

이 성질이 CRC 를 선택하는 이유다. CRC 는 버스트 오류에 특별히 강하도록 설계됐다. 패리티와 체크섬은 그렇지 않다.

## 3. 패리티는 절반을 놓친다

데이터의 1의 개수를 세어 짝수나 홀수로 맞추는 비트를 하나 붙인다.

| 오류 개수 | 검출 |
| --- | --- |
| 1비트 | 잡는다 |
| 2비트 | 놓친다 |
| 3비트 | 잡는다 |
| 4비트 | 놓친다 |

홀수 개 오류만 잡는다. 무작위 오류라면 대략 절반을 놓치는 셈이고, 버스트 오류는 짝수 길이면 통째로 놓친다.

그래서 UART 의 패리티는 안 하는 것보다 낫다는 수준이다. 실제로 8N1(패리티 없음)이 8E1 보다 훨씬 많이 쓰인다. 어차피 상위 계층에서 CRC 를 하니 패리티 자리를 데이터에 쓰는 게 낫다는 판단이다.

다만 패리티에는 다른 쓸모가 있다. 패리티 에러 플래그가 뜬다는 건 물리계층이 나쁘다는 신호다. 진단용으로는 값이 있다.

## 4. 체크섬은 순서를 못 본다

바이트를 다 더해서 붙인다. 구현이 쉬워서 널리 쓰였다.

| 오류 유형 | 단순 합 | 왜 |
| --- | --- | --- |
| 1비트 오류 | 잡는다 | 합이 바뀐다 |
| 순서 바뀜 (`0x12 0x34` → `0x34 0x12`) | 놓친다 | 덧셈은 교환법칙이 성립한다 |
| 상쇄 오류 (한 바이트 +1, 다른 바이트 −1) | 놓친다 | 합이 같다 |
| 버스트 오류 | 확률적 | 8비트 합이면 1/256 로 통과 |

순서가 바뀌어도 모른다는 게 치명적이다. 그리고 상쇄 오류는 생각보다 흔하다. 같은 노이즈원이 인접 바이트의 같은 비트 위치를 건드리면 바로 상쇄된다.

| 방식 | 어떻게 개선했나 | 쓰는 곳 |
| --- | --- | --- |
| LRC (XOR 누적) | 단순 합과 비슷한 수준 | Modbus ASCII 모드 |
| 1의 보수 합 | 자리올림을 되돌려 더한다 | IP, TCP, UDP (RFC 1071) |
| Fletcher, Adler | 합과 가중 합 두 개로 순서를 구분한다 | zlib(Adler-32) |
| CRC | 나눗셈 기반이라 구조적으로 강하다 | 거의 전부 |

Fletcher 가 순서 문제를 푸는 방식이 볼 만하다. 단순 합 `A` 와, 지금까지의 `A` 를 다시 누적한 `B` 를 같이 둔다. `B` 는 각 바이트에 위치에 따라 다른 가중치를 주므로 순서가 바뀌면 값이 바뀐다.

## 5. CRC — 나눗셈으로 만드는 지문

메시지를 다항식으로 본다. 비트열 `1101` 을 $x^3+x^2+1$ 로 읽는 식이다. 그리고 미리 정한 생성 다항식 $G(x)$ 로 나눈 나머지를 붙인다.

계산은 GF(2) 산술로 한다. 덧셈도 뺄셈도 전부 XOR 이고 자리올림이 없다. 그래서 하드웨어로 시프트 레지스터와 XOR 몇 개면 구현된다.

### 손으로 해보기 — CRC-4

생성 다항식 $G(x) = x^4 + x + 1$ 을 비트로 쓰면 `10011` 이다. 5비트이고 차수는 4다. 메시지는 `1101` 로 잡는다.

먼저 메시지 뒤에 0 을 차수만큼 넷 붙여 `11010000` 을 만든다. 그리고 `10011` 로 XOR 나눗셈을 한다.

| 단계 | 레지스터 | 동작 |
| --- | --- | --- |
| 시작 | `11010000` | |
| i=0 | `11010000` ^ `10011000` = `01001000` | 최상위 1 이므로 XOR |
| i=1 | `01001000` ^ `01001100` = `00000100` | 다음 1 이므로 XOR |
| i=2 | `00000100` | 0 이므로 건너뜀 |
| i=3 | `00000100` | 0 이므로 건너뜀 |

나머지는 하위 4비트인 `0100` 이다. 전송할 것은 `1101` + `0100` = `11010100` 이다.

받은 쪽에서 같은 방식으로 나누면 나머지가 0 이어야 한다.

```text
11010100
^10011000 = 01001100
 ^01001100 = 00000000     → 나머지 0000, 정상
```

오류를 하나 넣어 보자. 4번째 비트를 뒤집어 `11000100` 이 됐다면 이렇게 된다.

```text
11000100
^10011000 = 01011100
 ^01001100 = 00010000
    ^00010011 = 00000011   → 나머지 0011, 검출
```

나머지가 0 이라는 성질이 구현을 편하게 한다. 수신 측은 CRC 를 따로 떼어내 비교할 필요 없이 전체(데이터와 CRC)를 그냥 돌려서 0 인지만 보면 된다. 초기값과 반전이 있는 변형에서는 0 대신 고정된 잔여값이 나온다.

### 무엇을 보장하나

차수 $r$ 인 생성 다항식은 이렇게 보장한다.

| 오류 유형 | 검출 |
| --- | --- |
| 1비트 오류 | 전부 (항이 2개 이상이면) |
| 길이 $\le r$ 인 버스트 오류 | 전부 |
| 길이 $r+1$ 인 버스트 | 확률 $1 - 2^{-(r-1)}$ |
| 길이 $> r+1$ 인 버스트 | 확률 $1 - 2^{-r}$ |
| 홀수 개 비트 오류 | 전부 ($G(x)$ 가 $(x+1)$ 을 인수로 가지면) |

길이 $r$ 이하 버스트를 전부 잡는다는 게 핵심이다. CRC-16 이면 연속 16비트가 통째로 뭉개져도 100% 검출된다. 패리티나 체크섬은 이런 보장을 주지 못한다. 그리고 무작위 오류의 미검출 확률은 대략 $2^{-r}$ 로, CRC-16 이면 1/65536, CRC-32 면 $1/4.3\times10^9$ 이다.

### 다항식 선택은 아무거나가 아니다

같은 CRC-16 이라도 다항식에 따라 해밍 거리가 다르다. 해밍 거리가 4 면 3비트까지의 오류는 전부 검출된다는 뜻이다. 그리고 해밍 거리는 메시지 길이에 따라 달라진다. 길어질수록 나빠진다.

Koopman(2004)이 이걸 체계적으로 조사했다. 결론은 널리 쓰인다고 좋은 다항식이 아니라는 것이다. CRC-16/CCITT 는 짧은 메시지에서 다른 후보보다 검출력이 떨어진다. 새 프로토콜을 설계할 일이 있다면 논문의 표를 보고 고른다. 기존 프로토콜을 구현할 때는 물론 규격이 정한 것을 쓴다.

| 이름 | 차수 | 다항식 | 초기값 | 반사 | 쓰는 곳 |
| --- | --- | --- | --- | --- | --- |
| CRC-8 | 8 | `0x07` | `0x00` | 없음 | SMBus 등 |
| CRC-16/MODBUS | 16 | `0x8005` (반사 시 `0xA001`) | `0xFFFF` | 있음 | Modbus RTU |
| CRC-16/CCITT-FALSE | 16 | `0x1021` | `0xFFFF` | 없음 | 여러 임베디드 |
| CRC-15/CAN | 15 | `0x4599` | `0x0000` | 없음 | CAN 프레임 |
| CRC-32 | 32 | `0x04C11DB7` | `0xFFFFFFFF` | 있음 | 이더넷 FCS, EtherCAT |

CRC-16 을 쓴다는 말만으로는 구현이 되지 않는다. 다항식, 초기값, 입력 반사, 출력 반사, 최종 XOR 다섯 개가 다 맞아야 같은 값이 나온다. 상대와 값이 안 맞으면 십중팔구 이 다섯 중 하나가 다르다.

## 6. 구현 — Modbus CRC-16

### 비트 단위

```cpp
// comm_core/crc.hpp
#pragma once
#include <cstdint>
#include <span>

// CRC-16/MODBUS : poly 0x8005 (반사 0xA001), init 0xFFFF, refin/refout=true, xorout=0
// 검증값(check): ASCII "123456789" → 0x4B37
constexpr std::uint16_t crc16_modbus(std::span<const std::uint8_t> data) noexcept {
    std::uint16_t crc = 0xFFFF;
    for (std::uint8_t b : data) {
        crc ^= b;                                  // 반사형이라 하위 바이트로 들어간다
        for (int i = 0; i < 8; ++i) {
            if (crc & 1) crc = (crc >> 1) ^ 0xA001;
            else         crc >>= 1;
        }
    }
    return crc;   // Modbus 는 하위 바이트를 먼저 전송한다
}
```

바이트당 8회 반복이라 바이트당 약 8~16 사이클이다. 1 kHz 루프에서 64바이트를 처리하면 약 1000 사이클이고 168 MHz MCU 에서 6 µs 다. 대개 무시할 만하다.

### 테이블 방식

```cpp
// 컴파일 타임에 테이블을 굽는다. 런타임 초기화 코드가 없어진다
constexpr auto make_crc16_table() {
    std::array<std::uint16_t, 256> t{};
    for (int n = 0; n < 256; ++n) {
        std::uint16_t c = static_cast<std::uint16_t>(n);
        for (int k = 0; k < 8; ++k)
            c = (c & 1) ? static_cast<std::uint16_t>((c >> 1) ^ 0xA001)
                        : static_cast<std::uint16_t>(c >> 1);
        t[n] = c;
    }
    return t;
}
inline constexpr auto kCrc16Table = make_crc16_table();

constexpr std::uint16_t crc16_modbus_fast(std::span<const std::uint8_t> data) noexcept {
    std::uint16_t crc = 0xFFFF;
    for (std::uint8_t b : data)
        crc = static_cast<std::uint16_t>((crc >> 8) ^ kCrc16Table[(crc ^ b) & 0xFF]);
    return crc;
}
```

바이트당 1회 반복이라 8배 빠르다. 대신 ROM 512바이트를 쓴다. MCU 에서는 이 맞교환을 매번 따진다.

### 테스트가 본체다

```cpp
// test/crc_test.cpp  (gtest)
TEST(Crc16Modbus, CheckValue) {
    constexpr std::uint8_t msg[] = {'1','2','3','4','5','6','7','8','9'};
    EXPECT_EQ(crc16_modbus(msg), 0x4B37);          // 규격 검증값
    EXPECT_EQ(crc16_modbus_fast(msg), 0x4B37);     // 두 구현이 일치
}

TEST(Crc16Modbus, DetectsSingleBitFlips) {
    std::array<std::uint8_t, 8> msg{0x01,0x03,0x00,0x00,0x00,0x02,0xC4,0x0B};
    const auto good = crc16_modbus(msg);
    for (std::size_t byte = 0; byte < msg.size(); ++byte)
        for (int bit = 0; bit < 8; ++bit) {
            auto bad = msg;
            bad[byte] ^= static_cast<std::uint8_t>(1u << bit);
            EXPECT_NE(crc16_modbus(bad), good) << "byte " << byte << " bit " << bit;
        }
}

TEST(Crc16Modbus, DetectsAllBurstsUpTo16Bits) {
    // 차수 16 이므로 길이 16 이하 버스트는 100% 검출되어야 한다
    std::array<std::uint8_t, 16> msg{};
    for (std::size_t i = 0; i < msg.size(); ++i)
        msg[i] = static_cast<std::uint8_t>(i * 37 + 11);
    const auto good = crc16_modbus(msg);
    for (std::size_t start = 0; start + 2 <= msg.size(); ++start)
        for (std::uint16_t pattern = 1; pattern != 0; ++pattern) {   // 1..0xFFFF
            auto bad = msg;
            bad[start]     ^= static_cast<std::uint8_t>(pattern & 0xFF);
            bad[start + 1] ^= static_cast<std::uint8_t>(pattern >> 8);
            ASSERT_NE(crc16_modbus(bad), good);
        }
}
```

세 번째 테스트가 이 글의 이론을 코드로 증명한다. 길이 16 이하 버스트는 전부 잡는다는 주장을 전수로 확인한다.

## 7. CAN 이 다섯 겹으로 쌓는 이유

CAN 은 CRC-15 하나만 쓰지 않는다. 검사를 다섯 겹으로 겹친다.

| 검사 | 무엇을 잡나 |
| --- | --- |
| Bit Error | 내가 쓴 값과 버스에서 읽은 값이 다르다 (송신자만) |
| Stuff Error | 6비트 연속이라 스터핑 규칙 위반이다 |
| CRC Error | CRC-15 불일치 |
| Form Error | 고정 필드(EOF, delimiter)에 이상한 값 |
| ACK Error | 아무도 ACK 를 내지 않았다 |

왜 겹치는가. 각각이 놓치는 오류가 다르기 때문이다. CRC 는 프레임 전체를 보지만 자기 자신이 깨지면 무력하다. Form Error 는 CRC 필드 밖의 구조를 본다. Bit Error 는 송신 순간에 물리적 이상을 잡는다.

결과는 Bosch 규격이 밝히는 잔류 오류 확률 $< 4.7\times10^{-11}$ 이다. 1 Mbps 로 종일 운용해도 미검출 오류가 수백 년에 한 번 수준이다.

## 8. CRC 로 안 되는 것

| 오해 | 사실 |
| --- | --- |
| CRC 가 맞으니 데이터가 맞다 | 확률이 높을 뿐이다. $2^{-r}$ 로 통과한다 |
| CRC 로 변조를 막는다 | 막지 못한다. CRC 는 선형이라 공격자가 원하는 데이터에 맞는 CRC 를 쉽게 계산한다. 보안이 필요하면 MAC 이나 HMAC 을 쓴다 |
| CRC 가 있으니 안전 등급을 만족한다 | 기능안전(IEC 61508 등)은 별도의 안전 계층을 요구한다. FSoE 가 일반 CRC 위에 안전 CRC 와 시퀀스 번호와 워치독을 얹는 이유다 |
| 메모리에 저장할 때도 CRC 면 충분하다 | 저장 오류는 버스트가 아니라 단일 비트인 경우가 많아 ECC 가 더 맞다 |

세 번째가 의료기기나 안전critical 영역에서 중요하다. 통신 CRC 는 전송 중 우발적 손상을 잡는 장치이지 시스템이 안전하다는 증명이 아니다. 안전 계층은 누락된 프레임, 순서 뒤바뀜, 지연, 반복까지 봐야 하고 그건 CRC 가 다루는 문제가 아니다.

## 정리

- 목표는 오류를 없애는 게 아니라 미검출 확률을 충분히 낮추는 것이다.
- 실제 오류는 대개 버스트다. 이 사실이 CRC 를 고르게 만든다.
- 패리티는 1비트이고 홀수 개만 잡는다. 짝수 길이 버스트를 통째로 놓친다.
- 체크섬(합)은 순서 바뀜과 상쇄 오류를 못 잡는다. Fletcher 는 가중합으로 순서를 구분한다.
- CRC 는 GF(2) 나눗셈의 나머지다. 차수 $r$ 이하 버스트를 100% 검출하고 무작위 미검출은 약 $2^{-r}$ 이다.
- CRC-4 손계산은 `1101` 뒤에 0 넷을 붙이고 `10011` 로 XOR 나눗셈해 나머지 `0100` 을 얻는다.
- 수신 측은 전체를 나눠 나머지가 0 인지만 보면 된다.
- CRC 는 다항식, 초기값, 반사, 최종 XOR 다섯 개가 다 맞아야 같은 값이다.
- 비트 방식은 작고 테이블 방식은 8배 빠르며 ROM 512B 를 쓴다. 검증값 `0x4B37` 로 항상 테스트한다.
- CAN 은 다섯 겹으로 쌓아 잔류 오류 확률을 $4.7\times10^{-11}$ 아래로 만든다.
- CRC 는 변조를 못 막고 기능안전을 대신하지 못한다.

## 참고

- [Modbus over Serial Line V1.02](https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf)
- [Bosch CAN Specification 2.0](https://www.bosch-semiconductors.com/media/ip_modules/pdf_2/can2spec.pdf)
- [RFC 1071 — Computing the Internet Checksum](https://www.rfc-editor.org/rfc/rfc1071)
- [Koopman — CRC Polynomial Selection for Embedded Networks (PDF)](https://users.ece.cmu.edu/~koopman/roses/dsn04/koopman04_crc_poly_embedded.pdf)
