---
title: 09. Modbus RTU — 프레임과 CRC-16
date: 2026-08-06 09:09:00 +0900
description: 한 프레임 안에서 엔디안이 두 겹이다. 데이터는 big-endian 인데 CRC 는 little-endian 이라 놓치면 CRC 가 항상 틀린다.
categories: [로봇 통신, 시리얼]
tags: [통신, modbus, crc, rs485, 프로토콜, cpp]
mermaid: true
math: true
---

> **기준 출처:** Modbus over Serial Line Specification V1.02 §2.5.1, §6.2.2, Modbus Application Protocol Specification V1.1b3 §4.1, §5, §7 / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [08. 시리얼 오류](/posts/08-serial-errors-framing-overrun/) | 다음 → [10. 침묵 시간과 타임아웃](/posts/10-modbus-silence-timeout/)

---

## 1. Modbus 가 살아남은 이유

1979년 Modicon 이 PLC 용으로 만든 프로토콜이 40년 넘게 쓰인다. 이유는 단순함이다. 규격이 무료로 공개돼 있고 로열티가 없다. 함수 코드 몇 개에 CRC 뿐이라 며칠이면 구현한다. RS-232 든 RS-485 든 TCP 든 물리계층에 상관없이 얹힌다. 데이터 모델도 코일과 레지스터 네 종류뿐이라 명확하다.

대가는 보안이 없고 실시간성이 없고 데이터 타입이 없다는 것이다. 전부 16비트 워드이고 진단도 빈약하다. 제어 루프용이 아니라 설정과 모니터링과 저속 장비 통신용이다.

| | 전송 매체 | 프레이밍 | 인코딩 |
| --- | --- | --- | --- |
| Modbus RTU | 시리얼 | 침묵 시간 3.5문자 | 바이너리 |
| Modbus ASCII | 시리얼 | `:` 로 시작하고 CR/LF 로 끝난다 | ASCII 헥사라 2배 크기다 |
| Modbus TCP | 이더넷 | TCP 스트림에 MBAP 헤더 | 바이너리이고 CRC 가 없다. TCP 가 대신한다 |

이 글은 RTU 를 다룬다.

## 2. 프레임 구조

ADU 는 주소 1바이트에 PDU 최대 253바이트, CRC 2바이트로 최대 256바이트다. PDU 는 함수 코드 1바이트와 데이터로 이뤄진다.

| 필드 | 크기 | 내용 |
| --- | --- | --- |
| 주소 | 1 | `0` 은 브로드캐스트, `1`~`247` 은 슬레이브, `248`~`255` 는 예약이다 |
| 함수 코드 | 1 | 무슨 동작인가. 최상위 비트가 서면 예외 응답이다 |
| 데이터 | 0~252 | 함수마다 다르다 |
| CRC | 2 | CRC-16/MODBUS 이고 하위 바이트를 먼저 보낸다 |

256 바이트라는 상한은 원래 Modbus 가 만들어진 시리얼 환경의 제약이 굳은 것이다. PDU 253 은 256 에서 주소 1과 CRC 2 를 뺀 값이다. Modbus TCP 도 호환을 위해 같은 PDU 상한을 쓴다.

브로드캐스트인 주소 0 에는 응답이 없다. 쓰기 명령에만 쓰고 성공했는지 확인할 방법이 없다. 그래서 안전이 걸린 명령에는 쓰지 않는다.

## 3. 데이터 모델은 네 개의 테이블이다

| 이름 | 크기 | 접근 | 함수 코드 |
| --- | --- | --- | --- |
| Coil | 1비트 | 읽기와 쓰기 | 01 로 읽고 05 나 15 로 쓴다 |
| Discrete Input | 1비트 | 읽기만 | 02 |
| Holding Register | 16비트 | 읽기와 쓰기 | 03 으로 읽고 06 이나 16 으로 쓴다 |
| Input Register | 16비트 | 읽기만 | 04 |

이름이 PLC 시대의 유물이다. Coil 은 릴레이 코일인 출력이고 Discrete Input 은 스위치 입력이다. 지금은 그냥 쓸 수 있는 비트, 읽기 전용 비트, 쓸 수 있는 워드, 읽기 전용 워드로 이해하면 된다.

### 40001 문제

옛 문서는 홀딩 레지스터를 `40001` 부터 시작하는 번호로 쓴다. 이건 1-기반 참조 번호이고 실제 프로토콜에는 0-기반 주소가 들어간다.

| 문서 표기 | 프로토콜에 넣는 값 |
| --- | --- |
| 40001 | `0x0000` |
| 40002 | `0x0001` |
| 30001 (입력 레지스터) | `0x0000` (함수 코드 04) |
| 00001 (코일) | `0x0000` (함수 코드 01) |

값이 하나씩 밀린다는 증상의 원인 1순위다. 장비 매뉴얼이 어느 표기를 쓰는지 반드시 확인한다.

## 4. 주요 함수 코드

| 코드 | 이름 | 무엇을 하나 |
| --- | --- | --- |
| `0x01` | Read Coils | 비트 여러 개를 읽는다 |
| `0x02` | Read Discrete Inputs | 읽기 전용 비트를 읽는다 |
| `0x03` | Read Holding Registers | 가장 많이 쓴다 |
| `0x04` | Read Input Registers | 읽기 전용 워드를 읽는다 |
| `0x05` | Write Single Coil | 비트 하나를 쓴다. `0xFF00` 이 ON 이고 `0x0000` 이 OFF 다 |
| `0x06` | Write Single Register | 워드 하나를 쓴다 |
| `0x0F` (15) | Write Multiple Coils | |
| `0x10` (16) | Write Multiple Registers | 워드 여러 개를 쓴다 |
| `0x17` (23) | Read/Write Multiple Registers | 한 트랜잭션에 읽고 쓴다 |

## 5. 실제 프레임을 만들어 본다

슬레이브 1의 홀딩 레지스터 0번부터 2개를 읽는 요청이다.

| 필드 | 값 | 설명 |
| --- | --- | --- |
| 주소 | `01` | 슬레이브 1 |
| 함수 | `03` | Read Holding Registers |
| 시작 주소 | `00 00` | 0번이고 big-endian 이다 |
| 개수 | `00 02` | 2개 |
| CRC | `C4 0B` | 하위 바이트가 먼저다 |

전체는 `01 03 00 00 00 02 C4 0B` 다. `{01, 03, 00, 00, 00, 02}` 에 CRC-16/MODBUS 를 적용하면 `0x0BC4` 가 나오고 전송은 하위인 `C4` 다음 상위인 `0B` 순서다.

검산용으로 잘 알려진 값이 하나 있다. `{01, 03, 00, 00, 00, 01}` 의 CRC 는 `0x0A84` 이고 전송은 `84 0A` 다. 구현이 맞는지 이걸로 확인하면 된다.

값이 `0x1234` 와 `0x5678` 인 응답은 이렇게 된다.

| 필드 | 값 |
| --- | --- |
| 주소 | `01` |
| 함수 | `03` |
| 바이트 수 | `04` (2 레지스터 곱하기 2바이트) |
| 데이터 | `12 34 56 78` |
| CRC | `81 07` |

전체는 `01 03 04 12 34 56 78 81 07` 이다.

### 엔디안이 두 겹이다

| 대상 | 엔디안 |
| --- | --- |
| 레지스터 값과 주소와 개수 | big-endian. 상위 바이트가 먼저다 |
| CRC | little-endian. 하위 바이트가 먼저다 |

한 프레임 안에서 엔디안이 다르다. 규격이 그렇게 정했고 이유는 역사적이다. 구현할 때 이걸 놓치면 CRC 가 항상 틀린다.

그리고 [기초 09편](/posts/09-basics-endian-alignment/)에서 본 32비트 값의 워드 순서 문제가 여기 얹힌다. `float` 하나를 레지스터 두 개로 보낼 때 어느 워드가 먼저인지는 규격에 없어 벤더마다 다르다.

## 6. 예외 응답

슬레이브가 요청을 처리하지 못하면 함수 코드에 `0x80` 을 OR 해서 돌려준다. 정상 응답이 `01 03 04 ...` 라면 예외 응답은 `01 83 02` 에 CRC 가 붙은 형태다. `0x03` 에 `0x80` 을 OR 하면 `0x83` 이고 그다음 바이트가 예외 코드다.

| 예외 코드 | 이름 | 뜻 |
| --- | --- | --- |
| `01` | Illegal Function | 지원하지 않는 함수 코드다 |
| `02` | Illegal Data Address | 주소가 없다. 40001 문제가 1순위다 |
| `03` | Illegal Data Value | 값 범위를 넘었거나 개수가 상한을 넘었다 |
| `04` | Slave Device Failure | 슬레이브 내부 오류다 |
| `05` | Acknowledge | 받았지만 시간이 걸리니 나중에 다시 물어보라는 뜻이다 |
| `06` | Slave Device Busy | 지금 바쁘다 |
| `08` | Memory Parity Error | |
| `0A`, `0B` | Gateway 관련 | 게이트웨이를 거칠 때 나온다 |

예외 응답은 통신이 성공한 것이다. CRC 도 맞고 주소도 맞다. 슬레이브가 이해했는데 못 해준다는 뜻이라 무응답인 타임아웃과 완전히 다른 상황이다. 로그에서 구분해야 한다.

| | 뜻 | 대응 |
| --- | --- | --- |
| 예외 응답 | 통신은 정상이고 요청 내용이 문제다 | 주소와 값과 함수 코드를 고친다 |
| 타임아웃 | 통신 자체가 안 된다 | 배선과 보율과 슬레이브 주소와 전원을 본다 |
| CRC 불일치 | 노이즈이거나 프레이밍 문제다 | 물리계층을 본다 |

## 7. 구현

```cpp
// comm_serial/modbus_rtu.hpp
#pragma once
#include <cstdint>
#include <span>
#include <optional>
#include "comm_core/crc.hpp"        // 기초 07편의 crc16_modbus
#include "comm_core/byte_order.hpp" // 기초 09편의 put_u16_be 등

namespace modbus {

enum class Function : std::uint8_t {
    ReadCoils              = 0x01,
    ReadDiscreteInputs     = 0x02,
    ReadHoldingRegisters   = 0x03,
    ReadInputRegisters     = 0x04,
    WriteSingleCoil        = 0x05,
    WriteSingleRegister    = 0x06,
    WriteMultipleCoils     = 0x0F,
    WriteMultipleRegisters = 0x10,
};

enum class Exception : std::uint8_t {
    IllegalFunction = 0x01, IllegalDataAddress = 0x02, IllegalDataValue = 0x03,
    SlaveDeviceFailure = 0x04, Acknowledge = 0x05, SlaveDeviceBusy = 0x06,
};

inline constexpr std::size_t kMaxAdu = 256;

// 요청 조립. 반환값은 실제로 채운 바이트 수다
inline std::size_t build_read_holding(std::span<std::uint8_t> out,
                                      std::uint8_t  slave,
                                      std::uint16_t start_addr,   // 0-기반이다. 40001 이 아니다
                                      std::uint16_t count) {
    out[0] = slave;
    out[1] = static_cast<std::uint8_t>(Function::ReadHoldingRegisters);
    put_u16_be(&out[2], start_addr);      // 데이터는 big-endian
    put_u16_be(&out[4], count);
    const auto crc = crc16_modbus({out.data(), 6});
    put_u16_le(&out[6], crc);             // CRC 는 little-endian 으로 하위가 먼저다
    return 8;
}

struct Response {
    std::uint8_t slave;
    std::uint8_t function;
    std::span<const std::uint8_t> payload;   // 함수 코드 뒤, CRC 앞
    std::optional<Exception> exception;      // 있으면 예외 응답이다
};

enum class ParseError { TooShort, BadCrc };

inline std::variant<Response, ParseError>
parse_response(std::span<const std::uint8_t> adu) {
    if (adu.size() < 4) return ParseError::TooShort;   // 주소와 함수와 CRC 가 최소다

    const std::size_t   body = adu.size() - 2;
    const std::uint16_t rx   = get_u16_le(&adu[body]);
    if (crc16_modbus(adu.first(body)) != rx) return ParseError::BadCrc;

    Response r{ adu[0], adu[1], adu.subspan(2, body - 2), std::nullopt };
    if (adu[1] & 0x80) {                                // 예외 응답이다
        r.function  = static_cast<std::uint8_t>(adu[1] & 0x7F);
        r.exception = static_cast<Exception>(adu[2]);
        r.payload   = {};
    }
    return r;
}

} // namespace modbus
```

테스트는 바이트 나열을 못박는다.

```cpp
TEST(ModbusRtu, BuildReadHoldingExactBytes) {
    std::array<std::uint8_t, 8> buf{};
    ASSERT_EQ(modbus::build_read_holding(buf, 1, 0x0000, 2), 8u);

    // 기초 09편의 원칙대로 왕복이 아니라 정확한 바이트 나열을 검사한다
    const std::array<std::uint8_t, 8> expect{0x01,0x03,0x00,0x00,0x00,0x02,0xC4,0x0B};
    EXPECT_EQ(buf, expect);
}

TEST(ModbusRtu, KnownCrcVector) {
    constexpr std::uint8_t body[]{0x01,0x03,0x00,0x00,0x00,0x01};
    EXPECT_EQ(crc16_modbus(body), 0x0A84);   // 전송은 84 0A 다
}

TEST(ModbusRtu, ParsesExceptionResponse) {
    std::array<std::uint8_t, 5> adu{0x01, 0x83, 0x02, 0, 0};
    put_u16_le(&adu[3], crc16_modbus({adu.data(), 3}));

    const auto r = std::get<modbus::Response>(modbus::parse_response(adu));
    EXPECT_EQ(r.function, 0x03);
    ASSERT_TRUE(r.exception.has_value());
    EXPECT_EQ(*r.exception, modbus::Exception::IllegalDataAddress);
}
```

## 정리

- Modbus 가 40년 산 이유는 개방성과 단순함과 물리계층 독립이다. 대가는 보안과 실시간성과 데이터 타입이 없다는 것이다.
- ADU 는 주소 1에 PDU 253 이하, CRC 2 로 최대 256 바이트다.
- 주소 `0` 은 브로드캐스트라 응답이 없고 `1`~`247` 이 슬레이브다.
- 데이터 모델은 Coil, Discrete Input, Holding Register, Input Register 넷이고 이름은 PLC 유물이다.
- 40001 문제는 문서의 1-기반 번호와 프로토콜의 0-기반 주소 차이다. 값이 하나씩 밀린다의 1순위다.
- 엔디안이 두 겹이다. 데이터는 big-endian 이고 CRC 는 little-endian 이다. 놓치면 CRC 가 항상 틀린다.
- 검증 프레임 `01 03 00 00 00 01` 의 CRC 는 `0x0A84` 이고 전송은 `84 0A` 다.
- 예외 응답은 함수 코드에 `0x80` 을 OR 한 것에 예외 코드가 붙는다. 통신은 성공한 것이라 타임아웃이나 CRC 오류와 구분해 로깅한다.
- 예외 `02` 인 Illegal Data Address 가 가장 흔하고 대개 40001 문제다.
- 테스트는 정확한 바이트 나열로 한다.

## 참고

- [Modbus over Serial Line V1.02](https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf)
- [Modbus Application Protocol V1.1b3](https://www.modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf)
