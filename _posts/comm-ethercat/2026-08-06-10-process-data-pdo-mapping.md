---
title: 10. 프로세스 데이터와 PDO 매핑
date: 2026-08-06 12:10:00 +0900
description: CoE는 CANopen의 PDO 매핑을 그대로 쓰고 SM 할당 층이 하나 더 있다. 크기만 검증하면 "크기는 같은데 순서가 다른" 경우를 놓친다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, PDO매핑, CoE, SDO, 검증]
---

> **기준 출처:** [ETG EtherCAT Technology](https://www.ethercat.org/en/technology.html) · CiA 301 / ETG.1000 매핑 객체(0x1600, 0x1A00)와 SM 할당 객체(0x1C12, 0x1C13) · [CiA CANopen 개요](https://www.can-cia.org/can-knowledge/canopen) · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [09. 분산 클록(DC)](/posts/09-distributed-clocks/) | 다음 → [11. 메일박스 프로토콜](/posts/11-mailbox-coe-foe-eoe/)

## 1. CAN 폴더의 지식이 그대로 온다

CoE(CANopen over EtherCAT)는 CANopen의 객체 사전과 PDO 매핑을 그대로 쓴다. [CAN 12편](/posts/12-canopen-sdo-pdo/)에서 배운 것이 여기서 재사용된다.

| | CANopen (CAN 위) | CoE (EtherCAT 위) |
| --- | --- | --- |
| 매핑 객체 | `0x1600+n`(RPDO), `0x1A00+n`(TPDO) | 같다 |
| 매핑 항목 형식 | `[인덱스16][서브8][비트8]` | 같다 |
| 설정 방법 | SDO | SDO (메일박스로) |
| 언제 | Pre-operational | PREOP |
| 어디에 배치되나 | COB-ID별 프레임 | SM 영역에서 논리 주소로 |
| 추가로 필요한 것 | | SM 할당 객체 `0x1C12`, `0x1C13` |

다른 건 두 가지뿐이다. 데이터가 개별 프레임이 아니라 SM 영역에 연속으로 배치된다는 것, 그리고 어느 PDO를 어느 SM에 할당할지 정하는 객체가 하나 더 있다는 것이다.

## 2. 두 층의 매핑

| 층 | 무엇을 정하나 | 객체 |
| --- | --- | --- |
| ① PDO 매핑 | 어떤 값들이 한 PDO에 들어가나 | `0x1600+n` / `0x1A00+n` |
| ② SM 할당 | 어떤 PDO들이 이 SM에 들어가나 | `0x1C12`(출력) / `0x1C13`(입력) |
| ③ FMMU | SM이 논리 주소의 어디인가 | 레지스터, 마스터가 자동 |

객체 사전의 `0x6041` Statusword(16비트), `0x6064` Position actual(32비트), `0x606C` Velocity actual(32비트)가 ① PDO 매핑으로 TxPDO `0x1A00` 안에 총 10바이트로 묶이고, ② SM 할당으로 SyncManager 3(입력) 영역에 들어가고, ③ FMMU로 논리 주소 공간의 어느 자리에 배치된다.

②가 CANopen에 없던 층이다. CAN에서는 PDO 하나가 곧 프레임 하나였는데 EtherCAT에서는 PDO 여러 개를 하나의 SM 영역에 이어 붙일 수 있다. `0x1C13` 의 sub0에 2를 쓰고 sub1에 `0x1A00`, sub2에 `0x1A01` 을 쓰면 SM3 영역이 두 PDO의 내용을 이어 붙인 것이 된다.

## 3. 고정 PDO와 가변 PDO

| | 고정 (fixed) | 가변 (variable) |
| --- | --- | --- |
| 매핑 변경 | 불가 | 가능 |
| 설정 | ESI 파일대로 | SDO로 런타임 설정 |
| 장점 | 단순하고 실패가 없다 | 필요한 것만 골라 담는다 |
| 단점 | 안 쓰는 데이터도 실린다 | 설정이 복잡하고 실패 가능 |

슬레이브가 어느 쪽을 지원하는지 확인한다. 매핑 객체(`0x1A00`)의 서브인덱스 0이 읽기 전용이면 고정, 쓰기 가능하면 가변이다.

가변 PDO를 쓸 이유는 대역폭 절약과 필요한 진단 값 추가다. 축당 20바이트를 12바이트로 줄이면 6축에서 프로세스 이미지가 120에서 72바이트가 되고 프레임이 48바이트 짧아져 3.8 µs를 절약한다. 사이클이 100 µs급이면 의미가 있다.

## 4. 매핑 변경 절차

CAN 12편의 CANopen 절차에 SM 할당 단계가 추가된다. 전부 PREOP 상태에서 한다.

| 순서 | 하는 일 | 값 |
| --- | --- | --- |
| ① | SM 할당을 비운다 | `0x1C13` sub0 ← 0 |
| ② | PDO 매핑을 비운다 | `0x1A00` sub0 ← 0 |
| ③ | 매핑 항목을 쓴다 | `0x1A00` sub1 ← `0x60410010` (Statusword, 16비트) 등 |
| ④ | 매핑 개수를 쓴다 | `0x1A00` sub0 ← 3 |
| ⑤ | SM 할당을 쓴다 | `0x1C13` sub1 ← `0x1A00` |
| ⑥ | SM 할당 개수를 쓴다 | `0x1C13` sub0 ← 1 |
| ⑦ | `ec_config_map()` | SM 크기와 FMMU 설정 |
| ⑧ | SAFEOP 전이 | 여기서 설정 오류가 드러난다 |

출력도 같은 방식으로 `0x1600` 과 `0x1C12` 에 한다.

①②를 빼먹으면 SDO abort가 난다. 활성 상태에서는 매핑을 못 바꾸게 막혀 있다. ⑤⑥의 순서도 중요하다. 개수(sub0)를 먼저 쓰면 아직 안 채운 항목을 참조하게 된다. 그리고 전부 PREOP에서 해야 한다. SAFEOP 이후에는 안 되고 AL Status Code `0x0024` 가 뜬다.

### 코드

```cpp
// comm_ethercat/pdo_config.hpp
struct PdoMapEntry { std::uint16_t index; std::uint8_t sub; std::uint8_t bits; };

constexpr std::uint32_t encode_map(const PdoMapEntry& e) {
    return (std::uint32_t{e.index} << 16) | (std::uint32_t{e.sub} << 8) | e.bits;
}

// 순서를 함수로 강제한다. 실수를 원천 차단
bool configure_pdo(int slave, std::uint16_t sm_assign_obj,
                   std::uint16_t pdo_obj,
                   std::span<const PdoMapEntry> entries) {
    std::uint8_t zero = 0;
    // ① SM 할당 비우기
    if (ec_SDOwrite(slave, sm_assign_obj, 0x00, FALSE,
                    sizeof(zero), &zero, EC_TIMEOUTRXM) <= 0) return false;
    // ② PDO 매핑 비우기
    if (ec_SDOwrite(slave, pdo_obj, 0x00, FALSE,
                    sizeof(zero), &zero, EC_TIMEOUTRXM) <= 0) return false;
    // ③ 항목
    for (std::size_t i = 0; i < entries.size(); ++i) {
        std::uint32_t v = encode_map(entries[i]);
        if (ec_SDOwrite(slave, pdo_obj, static_cast<std::uint8_t>(i + 1),
                        FALSE, sizeof(v), &v, EC_TIMEOUTRXM) <= 0) return false;
    }
    // ④ 항목 개수
    auto n = static_cast<std::uint8_t>(entries.size());
    if (ec_SDOwrite(slave, pdo_obj, 0x00, FALSE,
                    sizeof(n), &n, EC_TIMEOUTRXM) <= 0) return false;
    // ⑤ SM 할당
    std::uint16_t p = pdo_obj;
    if (ec_SDOwrite(slave, sm_assign_obj, 0x01, FALSE,
                    sizeof(p), &p, EC_TIMEOUTRXM) <= 0) return false;
    // ⑥ SM 할당 개수
    std::uint8_t one = 1;
    return ec_SDOwrite(slave, sm_assign_obj, 0x00, FALSE,
                       sizeof(one), &one, EC_TIMEOUTRXM) > 0;
}

// 축 하나의 설정. 이 배열이 곧 AxisIo 의 오프셋 정의다
inline constexpr PdoMapEntry kAxisTxPdo[] = {   // 슬레이브 → 마스터 (입력)
    {0x6041, 0x00, 16},   // Statusword          offset 0
    {0x6064, 0x00, 32},   // Position actual     offset 2
    {0x606C, 0x00, 32},   // Velocity actual     offset 6
};                                              // 합계 10 바이트
inline constexpr PdoMapEntry kAxisRxPdo[] = {   // 마스터 → 슬레이브 (출력)
    {0x6040, 0x00, 16},   // Controlword         offset 0
    {0x607A, 0x00, 32},   // Target position     offset 2
};                                              // 합계 6 바이트
```

`kAxisTxPdo` 배열의 순서가 곧 `AxisIo` 클래스의 오프셋이다. 두 곳을 따로 관리하면 반드시 어긋난다. 한 곳에서 오프셋을 계산하게 만든다.

```cpp
constexpr std::size_t pdo_offset(std::span<const PdoMapEntry> m,
                                 std::size_t idx) {
    std::size_t bits = 0;
    for (std::size_t i = 0; i < idx; ++i) bits += m[i].bits;
    return bits / 8;
}
static_assert(pdo_offset(kAxisTxPdo, 1) == 2);   // Position actual
static_assert(pdo_offset(kAxisTxPdo, 2) == 6);   // Velocity actual
```

## 5. 검증, 이게 가장 중요하다

06편에서 말한 것이다. 매핑이 예상과 다르면 오프셋이 전부 틀려서 Statusword 자리에서 엉뚱한 값을 읽는다. 세 겹으로 검증한다.

```cpp
// ① 설정한 매핑을 다시 읽어 비교
bool verify_pdo_mapping(int slave, std::uint16_t pdo_obj,
                        std::span<const PdoMapEntry> expected) {
    std::uint8_t count{}; int size = sizeof(count);
    if (ec_SDOread(slave, pdo_obj, 0x00, FALSE,
                   &size, &count, EC_TIMEOUTRXM) <= 0) return false;
    if (count != expected.size()) {
        log_error("PDO %04X: 항목 수 %u (기대 %zu)",
                  pdo_obj, count, expected.size());
        return false;
    }
    for (std::size_t i = 0; i < expected.size(); ++i) {
        std::uint32_t v{}; size = sizeof(v);
        if (ec_SDOread(slave, pdo_obj, static_cast<std::uint8_t>(i+1),
                       FALSE, &size, &v, EC_TIMEOUTRXM) <= 0) return false;
        if (v != encode_map(expected[i])) {
            log_error("PDO %04X sub%zu: 0x%08X (기대 0x%08X)",
                      pdo_obj, i+1, v, encode_map(expected[i]));
            return false;
        }
    }
    return true;
}

// ② ec_config_map() 후 크기 확인
bool verify_io_size(int slave) {
    if (ec_slave[slave].Ibytes != 10 || ec_slave[slave].Obytes != 6) {
        log_error("슬레이브 %d: I/O 크기 %d/%d (기대 10/6)",
                  slave, ec_slave[slave].Ibytes, ec_slave[slave].Obytes);
        return false;
    }
    return true;
}

// ③ 런타임 타당성 검사. 값이 물리적으로 말이 되나
bool sanity_check(const AxisIo& io) {
    return io.position_actual() > kMinPositionCounts
        && io.position_actual() < kMaxPositionCounts;
}
```

셋을 다 넣는다. 각각이 다른 실패를 잡는다. ①은 설정이 안 먹은 경우, ②는 마스터의 배치가 예상과 다른 경우, ③은 실행 중에 뭔가 어긋난 경우다.

②만 하면 "크기는 맞는데 순서가 다른" 경우를 놓친다. Statusword(2B) + Position(4B) + Velocity(4B)와 Position(4B) + Velocity(4B) + Statusword(2B)는 둘 다 10바이트다.

## 6. 대역폭 설계

프로세스 이미지 크기가 사이클 시간을 정한다.

| 항목 | 크기 | 필수인가 |
| --- | --- | --- |
| Controlword / Statusword | 각 2 B | 필수 |
| Target position / Position actual | 각 4 B | CSP에 필수 |
| Velocity actual | 4 B | 있으면 미분 안 해도 된다 |
| Torque actual | 2 B | 힘 제어와 충돌 감지 |
| Mode of operation display | 1 B | 진단 |
| Digital inputs (센서와 리밋) | 4 B | 상황에 따라 |
| Error code | 2 B | 진단 |

6축, 축당 입력 12 B와 출력 6 B면 108 B다.

| 항목 | |
| --- | --- |
| 프레임 (38 + 2 + 12 + 108 = 160 B) | 12.8 µs |
| 슬레이브 통과 (6 × 1 µs × 2) | 12 µs |
| 케이블 (20 m 왕복) | 0.2 µs |
| 네트워크 왕복 | 약 25 µs |

축을 12개로 늘리면 프로세스 데이터가 216 B, 프레임이 268 B(21.4 µs), 통과 24 µs로 약 46 µs다. 여전히 1 kHz는 물론 10 kHz(100 µs)도 여유다. CAN 10편에서 CAN이 6축 1 kHz에 162% 부하였던 것과 대조된다.

그렇다고 아무거나 다 넣지는 않는다. 진단용 값은 별도 PDO로 만들어 낮은 주기로 보내거나 필요할 때만 SDO로 읽는 게 깔끔하다.

## 7. 진단

| 증상 | 원인 |
| --- | --- |
| SAFEOP 전이 실패 `0x0024` 또는 `0x0026` | PDO 매핑 오류. §4의 순서 확인 |
| SDO abort로 매핑을 못 쓴다 | SM 할당이나 매핑을 안 비웠다, PREOP이 아니다, 고정 PDO 슬레이브다 |
| `ec_config_map()` 후 크기가 다르다 | 매핑이 실제로 안 바뀌었다 |
| 값이 엉뚱하다 | 오프셋 불일치. 세 겹 검증 |
| 값이 조금씩 이상하다 | 엔디안. EtherCAT는 little-endian이다 |
| 특정 값만 항상 0 | 그 항목이 매핑에 없거나 슬레이브가 지원 안 함 |

EtherCAT와 CoE는 little-endian이다. Modbus의 big-endian과 반대다. 두 프로토콜을 한 시스템에서 다루면 반드시 헷갈린다.

## 정리

- CoE는 CANopen의 PDO 매핑을 그대로 쓴다. CAN 12편의 지식이 재사용된다
- 다른 점 둘: 데이터가 SM 영역에 연속 배치되고, SM 할당 객체(`0x1C12`, `0x1C13`)가 한 층 더 있다
- 세 층은 PDO 매핑, SM 할당, FMMU다
- 고정 PDO와 가변 PDO는 매핑 객체의 sub0이 쓰기 가능한지로 판별한다
- 변경 순서는 SM 할당 비우기, 매핑 비우기, 항목, 개수, SM 할당, SM 개수다. 전부 PREOP에서 한다
- 매핑 배열이 곧 `AxisIo` 의 오프셋 정의다. 한 곳에서 계산하게 만들어 어긋남을 막는다
- 검증을 세 겹으로 한다. 매핑 재확인, 크기 확인, 런타임 타당성 검사
- 크기만 보면 "크기는 같은데 순서가 다른" 경우를 놓친다
- 6축 12/6 바이트면 네트워크 왕복 25 µs, 12축이어도 46 µs다. 1 kHz는 물론 10 kHz도 여유다
- 진단용 값은 별도 PDO로 낮은 주기로 보내거나 SDO로 읽는다
- EtherCAT와 CoE는 little-endian이다. Modbus와 반대다

## 참고

- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
- [CiA — CANopen 개요](https://www.can-cia.org/can-knowledge/canopen)
- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
