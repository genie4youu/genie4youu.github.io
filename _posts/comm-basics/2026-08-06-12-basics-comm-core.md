---
title: 12. 예제 — 공통 모듈 만들기
date: 2026-08-06 07:12:00 +0900
description: 하드웨어 없이 만들고 CI로 전부 검증되는 것만 모아 comm_core 를 만든다. 테스트가 본체이고, 앞 열한 편의 이론을 코드로 증명한다.
categories: [로봇 통신, 기초]
tags: [통신, cpp, gtest, ros2, crc, 링버퍼, ci]
mermaid: true
---

> **기준 출처:** 이 시리즈 01편부터 11편까지의 내용을 코드로 옮긴 것이라 새 출처가 없다. CRC 검증값은 Modbus over Serial Line V1.02 §6.2.2, 메모리 모델과 `std::bit_cast` 는 ISO/IEC 14882 / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [11. 노이즈, 접지, 절연](/posts/11-basics-noise-ground-isolation/)

---

## 1. 무엇을 만드나

하드웨어가 하나도 없어도 만들 수 있고 유닛 테스트로 전부 검증되는 것만 모은다. 그리고 이것들이 뒤 폴더의 모든 예제가 쓰는 토대가 된다.

| 모듈 | 무엇 | 근거 |
| --- | --- | --- |
| `crc.hpp` | CRC-8, 16, 32. 비트 방식과 테이블 방식 | [07편](/posts/07-basics-error-detection/) |
| `byte_order.hpp` | 엔디안 안전 직렬화 | [09편](/posts/09-basics-endian-alignment/) |
| `framing.hpp` | 재동기되는 스트리밍 프레임 파서 | [06편](/posts/06-basics-framing/) |
| `ring_buffer.hpp` | 락 없는 SPSC 링 버퍼 | 시리얼 편에서 다룬다 |
| `latest_value.hpp` | 3버퍼. 막지 않고 덮어쓴다 | [08편](/posts/08-basics-flow-control/) |
| `timing.hpp` | 지터와 지연 히스토그램 | [10편](/posts/10-basics-realtime-jitter/) |

여섯 개 전부 순수 함수이거나 하드웨어에 닿지 않는다. 그래서 CI 에서 100% 검증된다. 프로토콜 로직과 I/O 를 분리한다는 방침의 출발점이다.

## 2. 패키지 구조

```text
comm-examples/                      ← ROS 2 워크스페이스 src/
└── comm_core/
    ├── CMakeLists.txt              ament_cmake
    ├── package.xml
    ├── include/comm_core/
    │   ├── crc.hpp
    │   ├── byte_order.hpp
    │   ├── framing.hpp
    │   ├── ring_buffer.hpp
    │   ├── latest_value.hpp
    │   └── timing.hpp
    └── test/
        ├── crc_test.cpp
        ├── byte_order_test.cpp
        ├── framing_test.cpp
        └── ring_buffer_test.cpp
```

```cmake
cmake_minimum_required(VERSION 3.16)
project(comm_core)
find_package(ament_cmake REQUIRED)

add_library(comm_core INTERFACE)          # 헤더 온리
target_include_directories(comm_core INTERFACE
  $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
  $<INSTALL_INTERFACE:include>)
target_compile_features(comm_core INTERFACE cxx_std_17)

if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(crc_test test/crc_test.cpp)
  target_link_libraries(crc_test comm_core)
  # 나머지 테스트도 같은 방식
endif()

ament_export_targets(comm_core HAS_LIBRARY_TARGET)
ament_package()
```

INTERFACE 라이브러리, 곧 헤더 온리로 시작한다. MCU 로 옮길 때도 헤더만 복사하면 되고 ROS 2 의존이 없다.

## 3. 테스트가 본체다

### CRC — 이론을 코드로 증명한다

```cpp
// test/crc_test.cpp
TEST(Crc16Modbus, SpecCheckValue) {
    constexpr std::uint8_t msg[] = {'1','2','3','4','5','6','7','8','9'};
    EXPECT_EQ(crc16_modbus(msg), 0x4B37);            // 규격 검증값
    EXPECT_EQ(crc16_modbus_fast(msg), 0x4B37);       // 두 구현 일치
}

TEST(Crc16Modbus, KnownModbusFrame) {
    constexpr std::uint8_t f[] = {0x01,0x03,0x00,0x00,0x00,0x01};
    EXPECT_EQ(crc16_modbus(f), 0x0A84);
}

// 07편의 "차수 r 이하 버스트는 100% 검출" 을 전수로 증명한다
TEST(Crc16Modbus, DetectsAllBurstsUpTo16Bits) {
    std::array<std::uint8_t, 16> msg{};
    for (std::size_t i = 0; i < msg.size(); ++i)
        msg[i] = static_cast<std::uint8_t>(i*37+11);
    const auto good = crc16_modbus(msg);
    for (std::size_t s = 0; s + 2 <= msg.size(); ++s)
        for (std::uint16_t p = 1; p != 0; ++p) {
            auto bad = msg;
            bad[s]   ^= static_cast<std::uint8_t>(p & 0xFF);
            bad[s+1] ^= static_cast<std::uint8_t>(p >> 8);
            ASSERT_NE(crc16_modbus(bad), good) << "start=" << s << " pat=" << p;
        }
}
```

세 번째 테스트가 이 폴더에서 가장 가치 있는 코드다. 07편에서 읽은 버스트 100% 검출이 주장이 아니라 확인된 사실이 된다. 약 100만 번을 전수로 검사한다.

### 직렬화 — 왕복이 아니라 바이트 나열

```cpp
TEST(ByteOrder, ExactWireBytes) {
    std::array<std::uint8_t, 4> b{};
    put_i32_le(b.data(), -1000);
    // 09편의 원칙. 왕복만 하면 양쪽이 똑같이 틀려도 통과한다
    EXPECT_EQ(b[0], 0x18); EXPECT_EQ(b[1], 0xFC);
    EXPECT_EQ(b[2], 0xFF); EXPECT_EQ(b[3], 0xFF);
    EXPECT_EQ(get_i32_le(b.data()), -1000);
}

TEST(ByteOrder, StructPaddingIsNotWireFormat) {
    // 09편의 함정을 테스트로 못박아 둔다. 누가 나중에 memcpy 로 바꾸면 걸린다
    struct Naive { std::uint8_t id; std::uint32_t pos; std::uint16_t vel; };
    static_assert(sizeof(Naive) != 7, "패딩이 있다. 구조체를 그대로 보내면 안 된다");
    EXPECT_EQ(kJointPacketSize, 7u);       // 우리 형식은 7바이트
}
```

### 프레이밍 — 재동기가 되는가

```cpp
// 06편의 핵심 주장. 어긋나도 다음 STX 에서 복구된다
TEST(FrameParser, ResyncsAfterGarbage) {
    FrameParser p;
    for (std::uint8_t g : {0x11,0x22,0x33,0xFF,0x00}) EXPECT_FALSE(p.feed(g));
    const auto frame = feed_valid_frame(p, {0xDE,0xAD,0xBE,0xEF});
    ASSERT_TRUE(frame);                                    // 다음 프레임은 받는다
    EXPECT_EQ(frame->size(), 4u);
    EXPECT_GT(p.stats().resync, 0u);                       // 재동기가 기록됐다
}

TEST(FrameParser, BadLengthDoesNotHang) {
    FrameParser p;
    p.feed(FrameParser::kStx);
    p.feed(200);                     // 상한 64 초과
    EXPECT_EQ(p.stats().bad_len, 1u);
    // 200바이트를 기다리며 멈추지 않는다. 즉시 다음 프레임을 받을 수 있어야 한다
    ASSERT_TRUE(feed_valid_frame(p, {0x01,0x02}));
}

TEST(FrameParser, CrcMismatchIsRejected) {
    FrameParser p;
    auto f = build_frame({0x01,0x02,0x03});
    f[f.size()-1] ^= 0xFF;                                  // CRC 훼손
    for (auto b : f) EXPECT_FALSE(p.feed(b));
    EXPECT_EQ(p.stats().bad_crc, 1u);
}
```

### 링 버퍼 — 멀티스레드로 실제로 검증한다

```cpp
TEST(SpscRingBuffer, NoLossUnderConcurrency) {
    SpscRingBuffer<std::uint32_t, 256> rb;
    constexpr std::uint32_t N = 1'000'000;
    std::thread producer([&]{
        for (std::uint32_t i = 0; i < N; ) if (rb.push(i)) ++i;   // 가득 차면 재시도
    });
    std::uint32_t expect = 0, v;
    while (expect < N) if (rb.pop(v)) { ASSERT_EQ(v, expect); ++expect; }
    producer.join();
    EXPECT_EQ(rb.dropped(), 0u);
}
```

`ASSERT_EQ(v, expect)` 가 순서 보장까지 검증한다. acquire 와 release 를 빼먹으면 이 테스트가 가끔 깨진다. Cortex-M 에서는 안 깨지지만 x86 CI 에서는 잡힌다.

## 4. 만드는 순서

```mermaid
flowchart LR
  A[crc.hpp] --> B[byte_order.hpp]
  B --> C[framing.hpp]
  C --> R[여기서 repo 생성]
  R --> D[ring_buffer.hpp]
  D --> E[latest_value.hpp]
  E --> F[timing.hpp]
```

repo 를 세 번째 단계 뒤에 만드는 순서가 중요하다. 빈 repo 를 먼저 만들면 관리 대상만 늘고 커밋할 게 없다. crc 와 byte_order 와 framing 만 있어도 의미 있는 첫 커밋이 된다.

## 5. CI

```yaml
# .github/workflows/ci.yml
name: tests
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: install
        run: sudo apt-get update && sudo apt-get install -y cmake g++ libgtest-dev
      - name: build and test
        run: |
          cmake -B build -DCMAKE_BUILD_TYPE=Release -DBUILD_TESTING=ON
          cmake --build build -j
          ctest --test-dir build --output-on-failure
```

ROS 2 없이도 빌드되게 시작한다. `comm_core` 는 헤더 온리에 gtest 뿐이라 순수 CMake 로 충분하다. ROS 2 는 나중에 `comm_ros` 를 만들 때 붙인다. README 에 tests 배지를 달면 테스트가 실제로 돈다는 증거가 된다.

## 6. 왜 이 모듈들이 뒤에서 계속 쓰이나

| 뒤 폴더의 예제 | `comm_core` 에서 쓰는 것 |
| --- | --- |
| SPI / I²C 예제 | `latest_value`, 타당성 검사 |
| 시리얼 예제 | `crc`(CRC-16), `byte_order`, `framing`, `ring_buffer` |
| CAN 예제 | `byte_order`, `latest_value` |
| EtherCAT 예제 | `byte_order`, `latest_value`, `timing` |

공통 기초를 앞에 뺀다는 커리큘럼 설계가 코드에서도 그대로 나타나는 모습이다. 각 프로토콜 예제는 자기 고유 부분만 만들면 된다.

## 정리

- 하드웨어 없이 만들고 CI 로 전부 검증되는 것만 `comm_core` 에 모은다.
- 여섯 모듈은 crc, byte_order, framing, ring_buffer, latest_value, timing 이다.
- 헤더 온리 INTERFACE 라이브러리로 시작하면 MCU 로 옮기기 쉽고 ROS 2 의존이 없다.
- 테스트가 본체다. CRC 는 규격 검증값과 버스트 전수 검증으로 07편의 이론을 증명한다.
- 직렬화는 왕복이 아니라 정확한 바이트 나열을 검사한다.
- 프레이밍은 재동기와 길이 상한과 CRC 거부 세 가지를 본다.
- 링 버퍼는 멀티스레드로 순서까지 본다. 메모리 순서 실수를 CI 가 잡는다.
- crc, byte_order, framing 까지 되면 repo 를 만든다. 빈 repo 를 먼저 만들지 않는다.
- 이 여섯 모듈이 뒤 네 폴더의 예제가 전부 쓰는 토대가 된다.

## 참고

- [Modbus over Serial Line V1.02](https://www.modbus.org/docs/Modbus_over_serial_line_V1_02.pdf)
- [GoogleTest](https://google.github.io/googletest/)
- [ament_cmake 사용자 문서](https://docs.ros.org/en/rolling/How-To-Guides/Ament-CMake-Documentation.html)
