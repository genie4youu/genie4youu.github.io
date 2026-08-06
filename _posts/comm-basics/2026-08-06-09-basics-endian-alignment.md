---
title: 09. 바이트 순서, 정렬, 패킹 — 소프트웨어가 조용히 깨지는 곳
date: 2026-08-06 07:09:00 +0900
description: 물리계층 문제는 시끄럽게 실패하지만 바이트 순서 문제는 조용히 실패한다. CRC는 통과하고 값만 틀리다. 명시적 직렬화가 답인 이유.
categories: [로봇 통신, 기초]
tags: [통신, 엔디안, 직렬화, modbus, canopen, cpp]
---

> **기준 출처:** RFC 1700, RFC 791 §3.1, Modbus Application Protocol V1.1b3 §4.2, CiA 301 / ETG.1000 공개 요약, IEEE 754, ISO/IEC 14882(C++), ARM 아키텍처 문서 / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [08. 흐름제어와 재전송](/posts/08-basics-flow-control/) | 다음 → [10. 실시간성](/posts/10-basics-realtime-jitter/)

---

## 1. 왜 이 글이 필요한가

01편부터 08편까지는 전기와 비트의 문제였다. 이 글은 코드의 문제이고 성격이 다르다.

물리계층 문제는 시끄럽게 실패한다. CRC 에러가 뜨고 카운터가 는다. 바이트 순서 문제는 조용히 실패한다. CRC 는 통과하고 값만 틀리다.

관절 위치 `1000` 을 보냈는데 상대가 `-402653184` 로 읽는다. 통신은 정상이고 오류 카운터는 0 이다. 이런 문제가 가장 오래 남는다.

## 2. 엔디안

32비트 값 `0x12345678` 을 메모리나 전선에 놓는 방법이 두 가지다.

| | 순서 | 기억법 |
| --- | --- | --- |
| little-endian | `78 56 34 12` | 작은 자리가 먼저 |
| big-endian | `12 34 56 78` | 큰 자리가 먼저. 사람이 읽는 순서 |

| 대상 | 엔디안 |
| --- | --- |
| x86, x86-64 | little |
| ARM (Cortex-M/A 기본 설정) | little |
| IP, TCP, UDP (네트워크 바이트 순서) | big |
| Modbus (레지스터 값) | big |
| CANopen (CiA 301) | little |
| EtherCAT (ETG.1000) | little |
| TI C2000 (C28x) | little. 단 바이트가 아니라 16비트 워드가 최소 단위 |

필드버스는 대체로 little-endian 이고 인터넷은 big-endian 이다. 둘을 한 시스템에서 다루면 반드시 헷갈린다. 그래서 CPU 엔디안에 의존하는 코드를 아예 쓰지 않는 것이 유일하게 안전한 방침이다.

TI C2000 은 특히 조심해야 한다. `char` 가 16비트라 `sizeof(int32_t)` 가 2 다. 바이트 단위 프로토콜 코드를 그대로 옮기면 전부 깨진다.

### Modbus 의 워드 순서 함정

Modbus 는 16비트 레지스터의 나열이다. 규격은 레지스터 하나를 big-endian 으로 보내라고만 정한다. 그런데 32비트 값을 레지스터 두 개에 담을 때 어느 쪽이 먼저인지는 규격에 없다.

`float 1.0f` 은 `0x3F800000` 이다. 이걸 보낼 때 네 가지 조합이 전부 실제로 존재한다.

| 벤더 관례 | 바이트 나열 |
| --- | --- |
| big-endian, 상위 워드 먼저 (ABCD) | `3F 80 00 00` |
| big-endian, 하위 워드 먼저 (CDAB) | `00 00 3F 80` |
| byte-swap, 상위 워드 먼저 (BADC) | `80 3F 00 00` |
| byte-swap, 하위 워드 먼저 (DCBA) | `00 00 80 3F` |

그래서 상용 Modbus 장비 설정 화면에 Word Order 옵션이 있다. 값이 이상하면 네 가지를 다 해보는 게 실무의 현실이다. 새로 설계한다면 문서에 바이트 나열을 예시와 함께 못박는다. big-endian 이라는 다섯 글자로는 부족하다.

## 3. 정렬과 패딩

C/C++ 컴파일러는 각 멤버를 자기 크기의 배수 주소에 놓는다. 그러려고 사이에 패딩을 넣는다.

```cpp
struct JointPacket {   // 의도한 크기: 1 + 4 + 2 = 7 바이트
    std::uint8_t  id;
    std::uint32_t position;
    std::uint16_t velocity;
};
```

32비트 ARM 에서 실제 배치는 이렇다.

| 오프셋 | 내용 |
| --- | --- |
| 0 | `id` |
| 1~3 | 패딩. `position` 을 4의 배수에 놓으려고 |
| 4~7 | `position` |
| 8~9 | `velocity` |
| 10~11 | 패딩. 구조체 전체 크기를 4의 배수로 맞추려고 |

`sizeof(JointPacket)` 은 7 이 아니라 12 다. 5바이트가 쓰레기 값이다. 이걸 그대로 `send(&pkt, sizeof(pkt))` 하면 대역폭을 71% 낭비하고, 초기화 안 된 스택 메모리가 전선으로 나가고(보안 문제이기도 하다), 상대가 다른 컴파일러나 아키텍처면 배치가 달라 파싱이 어긋난다.

### `#pragma pack(1)` 은 새 문제를 만든다

```cpp
#pragma pack(push, 1)
struct JointPacket { std::uint8_t id; std::uint32_t position; std::uint16_t velocity; };
#pragma pack(pop)
// sizeof == 7  ... 겉보기에는
```

| 새 문제 | 무슨 일 |
| --- | --- |
| 비정렬 접근 | `position` 이 오프셋 1 에 있다. Cortex-M0 와 M0+ 는 비정렬 32비트 접근에서 HardFault 를 낸다. Cortex-M4 는 되지만 느리다 |
| 비표준 | `#pragma pack` 은 표준이 아니다. 컴파일러마다 다르게 동작하고 구조체 멤버의 포인터를 넘기면 UB 가 된다 |
| 엔디안은 여전 | 패킹해도 `position` 은 CPU 엔디안 그대로다 |

근본적으로는 이렇다. `memcpy` 로 구조체를 그대로 보내는 순간 프로토콜 형식이 컴파일러 설정에 종속된다. 컴파일러를 바꾸거나 최적화 옵션을 바꿨는데 통신이 깨지는 사태가 여기서 나온다.

### 비트필드는 전선 형식에 쓰지 않는다

```cpp
struct Status {          // 전선 형식으로는 쓰지 않는다
    std::uint8_t ready : 1;
    std::uint8_t fault : 1;
    std::uint8_t mode  : 3;
};
```

C++ 표준은 비트필드가 바이트 안 어느 쪽부터 채워지는지 정하지 않는다. GCC 는 little-endian 타깃에서 LSB 부터 채우지만 다른 컴파일러나 타깃은 다를 수 있다. 게다가 필드가 바이트 경계를 넘으면 배치가 더 복잡해진다.

전선 형식의 비트는 시프트와 마스크로 직접 다룬다.

```cpp
constexpr std::uint8_t kReady     = 1u << 0;
constexpr std::uint8_t kFault     = 1u << 1;
constexpr std::uint8_t kModeMask  = 0b0001'1100;
constexpr int          kModeShift = 2;

std::uint8_t pack_status(bool ready, bool fault, std::uint8_t mode) {
    return static_cast<std::uint8_t>((ready ? kReady : 0)
                                   | (fault ? kFault : 0)
                                   | ((mode << kModeShift) & kModeMask));
}
```

길고 지루하지만 어디서 컴파일해도 같은 비트가 나온다.

## 4. 명시적 직렬화

원칙은 하나다. 구조체를 그대로 보내지 않고 바이트를 하나씩 명시적으로 놓는다.

```cpp
// comm_core/byte_order.hpp
#pragma once
#include <cstdint>
#include <cstring>
#include <span>
#include <bit>

// 쓰기
inline void put_u16_le(std::uint8_t* p, std::uint16_t v) noexcept {
    p[0] = static_cast<std::uint8_t>(v);
    p[1] = static_cast<std::uint8_t>(v >> 8);
}
inline void put_u16_be(std::uint8_t* p, std::uint16_t v) noexcept {
    p[0] = static_cast<std::uint8_t>(v >> 8);
    p[1] = static_cast<std::uint8_t>(v);
}
inline void put_u32_le(std::uint8_t* p, std::uint32_t v) noexcept {
    p[0] = static_cast<std::uint8_t>(v);
    p[1] = static_cast<std::uint8_t>(v >> 8);
    p[2] = static_cast<std::uint8_t>(v >> 16);
    p[3] = static_cast<std::uint8_t>(v >> 24);
}

// 읽기
inline std::uint16_t get_u16_le(const std::uint8_t* p) noexcept {
    return static_cast<std::uint16_t>(p[0] | (p[1] << 8));
}
inline std::uint32_t get_u32_le(const std::uint8_t* p) noexcept {
    return  static_cast<std::uint32_t>(p[0])
         | (static_cast<std::uint32_t>(p[1]) << 8)
         | (static_cast<std::uint32_t>(p[2]) << 16)
         | (static_cast<std::uint32_t>(p[3]) << 24);
}

// 부호 있는 정수. C++20 부터 2의 보수로 확정되어 이 캐스트가 안전하다
inline std::int32_t get_i32_le(const std::uint8_t* p) noexcept {
    return static_cast<std::int32_t>(get_u32_le(p));
}

// float. reinterpret_cast 는 strict aliasing 위반이므로 bit_cast 나 memcpy 를 쓴다
inline void put_f32_le(std::uint8_t* p, float v) noexcept {
    put_u32_le(p, std::bit_cast<std::uint32_t>(v));
}
inline float get_f32_le(const std::uint8_t* p) noexcept {
    return std::bit_cast<float>(get_u32_le(p));
}
```

| 걱정 | 이 코드가 푸는 방식 |
| --- | --- |
| CPU 엔디안 | 시프트만 쓴다. CPU 가 어느 쪽이든 결과가 같다 |
| 정렬 | 바이트 단위 접근만 한다. 비정렬 fault 가 원천적으로 없다 |
| 패딩 | 구조체를 안 쓰므로 패딩이 없다 |
| strict aliasing | `bit_cast` 나 `memcpy` 를 쓰고 `reinterpret_cast` 를 쓰지 않는다 |
| 컴파일러 차이 | 표준 연산만 쓴다 |

성능 걱정은 대개 기우다. 최신 컴파일러는 이 시프트 패턴을 인식해서 엔디안이 맞으면 단일 로드나 스토어로 최적화한다. `-O2` 로 어셈블리를 확인해 보면 깔끔하다.

### 쓰는 쪽

```cpp
// comm_serial/joint_packet.hpp — 형식이 코드에 명시적으로 보인다
struct JointState {
    std::uint8_t  id;
    std::int32_t  position_counts;
    std::int16_t  velocity_rpm;
};

inline constexpr std::size_t kJointPacketSize = 7;   // 1 + 4 + 2, 패딩 없음

inline void serialize(const JointState& s, std::span<std::uint8_t, kJointPacketSize> out) {
    out[0] = s.id;
    put_u32_le(&out[1], static_cast<std::uint32_t>(s.position_counts));
    put_u16_le(&out[5], static_cast<std::uint16_t>(s.velocity_rpm));
}

inline JointState deserialize(std::span<const std::uint8_t, kJointPacketSize> in) {
    return JointState{
        in[0],
        get_i32_le(&in[1]),
        static_cast<std::int16_t>(get_u16_le(&in[5]))
    };
}
```

오프셋이 코드에 그대로 적혀 있다. 이게 곧 프로토콜 문서다. 구조체 정의만 보고는 알 수 없던 정보다.

### 테스트

```cpp
TEST(Serialization, RoundTripAndExactBytes) {
    const JointState in{7, -1000, 250};
    std::array<std::uint8_t, kJointPacketSize> buf{};
    serialize(in, buf);

    // 바이트 나열을 못박는다. 이 테스트가 곧 규격이다
    EXPECT_EQ(buf[0], 0x07);
    EXPECT_EQ(buf[1], 0x18); EXPECT_EQ(buf[2], 0xFC);   // -1000 = 0xFFFFFC18, LE
    EXPECT_EQ(buf[3], 0xFF); EXPECT_EQ(buf[4], 0xFF);
    EXPECT_EQ(buf[5], 0xFA); EXPECT_EQ(buf[6], 0x00);   // 250 = 0x00FA, LE

    const auto out = deserialize(buf);
    EXPECT_EQ(out.id, in.id);
    EXPECT_EQ(out.position_counts, in.position_counts);
    EXPECT_EQ(out.velocity_rpm, in.velocity_rpm);
}
```

바이트 나열을 명시적으로 검사하는 테스트가 핵심이다. 왕복 테스트만 하면 양쪽이 똑같이 틀려도 통과한다. 상대 장비와 맞춰야 하는 건 왕복이 아니라 정확한 바이트 나열이다.

## 5. 실무 함정 모음

| 증상 | 원인 | 확인법 |
| --- | --- | --- |
| 값이 완전히 엉뚱하다 (`1000` 이 `-402653184` 로) | 엔디안 반대 (`0x000003E8` 와 `0xE8030000`) | 16진수로 찍어 보면 바로 보인다 |
| 32비트 값만 이상하고 16비트는 정상 | 워드 순서 (Modbus) | 상위와 하위 워드를 바꿔 본다 |
| 상대가 우리 데이터를 못 읽는데 우리끼리는 잘 된다 | 구조체 패딩 | `sizeof` 를 찍어 본다. 예상과 다르면 범인이다 |
| 특정 MCU 에서만 HardFault | 비정렬 접근 (packed 구조체) | 폴트 주소가 4의 배수가 아니다 |
| 최적화 옵션을 켜니까 깨진다 | strict aliasing 위반 | `reinterpret_cast` 를 찾아본다 |
| 값이 가끔 튄다 (찢어진 값) | 여러 바이트 값을 원자적이지 않게 읽었다 | [08편](/posts/08-basics-flow-control/)의 3버퍼로 해결한다 |
| TI C2000 에서만 전부 깨진다 | `char` 가 16비트 | `sizeof(int32_t)` 를 찍으면 2 다 |

디버깅 첫 수순은 언제나 16진수로 원본 바이트를 찍어 보는 것이다. 해석된 값이 아니라 전선에 실제로 나간 바이트를 봐야 한다. [06편](/posts/06-basics-framing/) 파서에 hexdump 를 붙여두면 이 시간이 크게 준다.

## 정리

- 물리계층 문제는 시끄럽게 실패하지만 바이트 순서 문제는 조용히 실패한다. CRC 는 통과하고 값만 틀리다.
- 엔디안은 인터넷이 big, 필드버스(CANopen, EtherCAT)가 little, Modbus 가 big 이다.
- Modbus 32비트 값의 워드 순서는 규격에 없다. 벤더마다 네 가지 조합이 있으니 문서에 바이트 나열을 예시로 못박는다.
- 구조체 패딩 때문에 1+4+2 가 7 이 아니라 12 다. 그대로 보내면 쓰레기가 나가고 상대와 맞지 않는다.
- `#pragma pack(1)` 은 해결이 아니다. 비정렬 접근 폴트에 비표준이고 엔디안은 그대로다.
- 비트필드를 전선 형식에 쓰지 않는다. 배치가 구현 정의다. 시프트와 마스크로 직접 다룬다.
- 정답은 명시적 직렬화다. 엔디안, 정렬, 패딩, aliasing 이 한 번에 해결되고 성능 손해도 사실상 없다.
- float 은 `reinterpret_cast` 말고 `std::bit_cast` 나 `memcpy` 를 쓴다.
- 테스트는 왕복이 아니라 정확한 바이트 나열을 검사한다. 왕복만 하면 양쪽이 똑같이 틀려도 통과한다.

## 참고

- [RFC 1700 — Assigned Numbers](https://www.rfc-editor.org/rfc/rfc1700)
- [Modbus Application Protocol V1.1b3](https://www.modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf)
- [CiA — CAN Knowledge](https://www.can-cia.org/can-knowledge)
- [cppreference — std::bit_cast](https://en.cppreference.com/w/cpp/numeric/bit_cast)
