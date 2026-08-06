---
title: 04. 프레임 구조, Datagram과 WKC
date: 2026-08-06 12:04:00 +0900
description: 자기 몫을 처리한 슬레이브가 카운터를 하나씩 올린다. WKC는 몇 개인지는 알려주지만 어느 것인지는 안 알려준다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, WKC, datagram, LRW, 진단]
math: true
---

> **기준 출처:** [ETG EtherCAT Technology](https://www.ethercat.org/en/technology.html) · IEC 61158 Type 12 · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) `ethercatbase.c`, `ethercattype.h` / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [03. 토폴로지와 물리계층](/posts/03-topology-mii-ebus/) | 다음 → [05. 주소 지정](/posts/05-addressing-auto-fixed-logical/)

## 1. 프레임 안에 무엇이 들어 있나

이더넷 헤더 14바이트(목적지, 출발지, EtherType `0x88A4`) 뒤에 EtherCAT 헤더 2바이트가 오고, 그 뒤에 Datagram들이 이어지고, 마지막에 FCS 4바이트가 붙는다.

### EtherCAT 헤더 (2바이트)

| 필드 | 비트 | 내용 |
| --- | --- | --- |
| Length | 11 | 뒤따르는 Datagram들의 총 길이 |
| Reserved | 1 | |
| Type | 4 | 1 = EtherCAT 명령 |

### Datagram 구조

헤더 10바이트와 데이터, 그리고 WKC 2바이트로 구성된다.

| 필드 | 크기 | 뜻 |
| --- | --- | --- |
| Cmd | 1 B | 명령 종류 |
| Idx | 1 B | 마스터가 붙이는 식별 번호. 응답을 짝짓는 데 쓴다 |
| Address | 4 B | 명령 종류에 따라 해석이 다르다 (05편) |
| Len | 11비트 | 데이터 길이, 최대 2047 |
| C (Circulating) | 1비트 | 프레임이 링을 한 바퀴 돌았다는 표시 |
| M (More) | 1비트 | 뒤에 Datagram이 더 있다 |
| IRQ | 2 B | 슬레이브가 인터럽트 요청을 실을 수 있다 |
| Data | n B | |
| WKC | 2 B | Working Counter, 이 편의 주인공 |

오버헤드가 Datagram당 12바이트다. 이더넷 오버헤드 38바이트(프리앰블과 IFG 포함) + EtherCAT 헤더 2 + Datagram 12 = 52바이트가 고정 비용이고 나머지가 전부 데이터다.

`M` 비트 덕에 한 프레임에 Datagram을 여러 개 넣을 수 있다. 그래서 프로세스 데이터 읽기와 쓰기와 상태 확인을 한 번에 보낸다.

## 2. 명령 종류

명령 코드가 어떻게 주소를 해석하고 무엇을 할지를 정한다.

| 그룹 | 명령 | 뜻 |
| --- | --- | --- |
| 자동 증가 | `APRD` `APWR` `APRW` | Auto-increment Read / Write / ReadWrite |
| 설정 주소 | `FPRD` `FPWR` `FPRW` | Configured address (Fixed) |
| 브로드캐스트 | `BRD` `BWR` `BRW` | 전체에게 |
| 논리 주소 | `LRD` `LWR` `LRW` | Logical, 프로세스 데이터가 이걸 쓴다 |
| 특수 | `ARMW` `FRMW` | Read Multiple Write, DC 동기에 쓴다 |
| | `NOP` | 아무것도 안 함 |

`LRW`(Logical ReadWrite)가 실제 제어 루프의 주력이다. 한 Datagram으로 모든 슬레이브의 입력을 읽고 출력을 쓴다. 06편의 FMMU가 이걸 가능하게 한다.

## 3. WKC 로 검증한다

프레임이 링을 돌면서 자기 몫을 제대로 처리한 슬레이브가 WKC를 하나씩 올린다. 마스터가 보낼 때 0이었던 값이 슬레이브 1, 2, 3을 지나며 3이 되어 돌아온다.

마스터는 기대 WKC를 미리 계산해두고 돌아온 값과 비교한다. 일치하면 전부 정상이고, 부족하면 누군가 처리를 못 한 것이다.

### 증가 규칙

| 명령 종류 | 성공 시 증가 |
| --- | --- |
| 읽기 (RD) | +1 |
| 쓰기 (WR) | +1 |
| 읽기+쓰기 (RW) | +3 (읽기 +1, 쓰기 +2) |

`LRW`를 쓰면 슬레이브당 +3이다. 6축 드라이브가 모두 입출력을 가지면 기대 WKC는 6 × 3 = 18이다.

### 기대값 계산이 생각보다 까다롭다

슬레이브마다 입력만 있는지 출력만 있는지 둘 다인지가 다르다. 그리고 FMMU 매핑에 따라서도 달라진다.

그래서 마스터 라이브러리가 계산해준다. SOEM은 `ec_config_map()` 후에 `ec_group[0].outputsWKC` 와 `inputsWKC` 를 채워주고 기대값은 이렇게 나온다.

```cpp
const int expected_wkc = ec_group[0].outputsWKC * 2 + ec_group[0].inputsWKC;
```

`outputsWKC * 2` 인 이유가 쓰기는 +2라는 규칙 때문이다.

### WKC 검사

```cpp
// comm_ethercat/cyclic_task.cpp — 제어 루프의 뼈대
void cyclic_task() {
    ec_send_processdata();
    const int wkc = ec_receive_processdata(EC_TIMEOUTRET);

    if (wkc < expected_wkc_) {
        ++stats_.wkc_low;
        // 일부 슬레이브가 응답하지 않았다. 안전 판단이 필요하다
        if (++consecutive_wkc_low_ > kMaxConsecutive) {
            fault_sink_.raise(Fault::EtherCatSlaveLost);
        }
        // 이번 주기의 입력 데이터를 믿으면 안 된다
        return;   // 직전 값 유지
    }
    consecutive_wkc_low_ = 0;

    process_inputs();
    compute_control();
    write_outputs();
}
```

WKC 부족은 "이번 프레임의 데이터를 믿을 수 없다" 는 뜻이다. [기초 08편](/posts/08-basics-flow-control/)의 원칙대로 재전송하지 않고 직전 값을 유지한다. 그리고 연속으로 부족하면 안전 상태로 간다.

한 번의 WKC 부족으로 즉시 정지하면 안 된다. 일시적 노이즈에 과민하게 반응하게 된다. 연속 횟수로 판단한다. [CAN 08편](/posts/08-can-error-states-busoff/)의 오류 카운터와 같은 비대칭 필터 발상이다.

### WKC로 알 수 있는 것과 없는 것

| 알 수 있다 | 알 수 없다 |
| --- | --- |
| 몇 개가 처리했나 | 어느 슬레이브가 실패했나 |
| 정상인가 아닌가 | 왜 실패했나 |

WKC는 개수만 알려준다. 어느 슬레이브가 문제인지는 별도로 찾아야 한다. `ec_readstate()` 로 각 슬레이브의 ESM 상태를 읽거나, 슬레이브별로 `FPRD` 를 보내 개별 확인하거나, 포트별 CRC 카운터를 읽거나, 몇 번째까지 보이는지로 케이블 끊김 위치를 찾는다.

## 4. 한 프레임에 여러 Datagram

실제 제어 루프의 프레임은 이런 모양이다.

| Datagram | 명령 | 목적 |
| --- | --- | --- |
| 1 | LRW | 프로세스 데이터 (입력 읽기 + 출력 쓰기), 주력 |
| 2 | FPRD | 특정 슬레이브의 AL Status 확인 |
| 3 | BRD | 전체 상태 브로드캐스트 읽기 |
| 4 | ARMW | DC 시각 동기 (09편) |

`M`(More) 비트로 이어 붙인다. 프레임 하나에 여러 목적을 담으니 왕복이 한 번이다. SOEM은 이걸 자동으로 한다. `ec_send_processdata()` 가 프로세스 데이터 Datagram을 만들고 DC를 켰으면 시각 동기 Datagram도 같이 넣는다.

이더넷 최대 프레임(1500 B 페이로드)을 넘으면 프레임을 나눈다. 프로세스 데이터가 아주 크면(슬레이브 수백 개) 사이클당 프레임이 2개 이상 필요할 수 있다. 그래도 노드당 하나는 아니다.

## 5. 프레임 크기 계산

```cpp
// comm_ethercat/frame_budget.hpp
struct EtherCatBudget {
    std::size_t process_data_bytes;   // 전체 프로세스 이미지 크기
    std::size_t datagram_count;       // 보통 1~4
    std::size_t slave_count;
    double      slave_delay_us;       // MII 약 1.0, EBUS 약 0.1
    double      cable_total_m;

    double frame_bytes() const {
        return 38                      // 프리앰블 + 이더넷 헤더 + FCS + IFG
             + 2                       // EtherCAT 헤더
             + 12.0 * datagram_count   // Datagram 헤더 10 + WKC 2
             + process_data_bytes;
    }
    double network_roundtrip_us() const {
        const double tx     = frame_bytes() * 8.0 / 100.0;      // 100 Mbps
        const double slaves = slave_count * slave_delay_us * 2; // 왕복
        const double cable  = cable_total_m * 0.005 * 2;        // 5 ns/m
        return tx + slaves + cable;
    }
};

// 6축 로봇 예시
inline constexpr EtherCatBudget kSixAxis{
    .process_data_bytes = 96,      // 축당 입력 8 + 출력 8
    .datagram_count     = 2,       // LRW + 상태 확인
    .slave_count        = 6,
    .slave_delay_us     = 1.0,     // MII
    .cable_total_m      = 20,
};
// 프레임 164 B → 13.1 µs + 슬레이브 12 µs + 케이블 0.2 µs = 약 25 µs
```

네트워크 왕복 25 µs다. 1 kHz 주기의 2.5%이고 10 kHz(100 µs)도 여유다. 실제 한계는 마스터 소프트웨어이고 네트워크는 대개 문제가 아니다.

## 6. 알아둘 것들

### FCS는 슬레이브가 다시 계산한다

슬레이브가 프레임 내용을 고쳐 쓰므로 CRC-32가 안 맞게 된다. 그래서 각 슬레이브가 나가는 프레임의 FCS를 다시 계산한다.

이게 진단과 연결된다. 슬레이브는 들어온 프레임의 FCS를 검사하고 틀리면 포트별 CRC 오류 카운터를 올린다. 그리고 프레임을 계속 흘려보내되 오류 표시를 한다.

그래서 어느 구간에서 오류가 생겼는지를 포트 단위로 알 수 있다. [기초 07편](/posts/07-basics-error-detection/)에서 CRC가 "깨졌다" 만 알려준다고 했는데, EtherCAT는 위치까지 알려준다.

### 슬레이브는 프레임을 버리지 않는다

CRC 오류가 있어도 프레임을 통과시킨다. 중간 슬레이브가 프레임을 버리면 뒤쪽 슬레이브가 전부 데이터를 못 받기 때문이다. 오류 하나가 전체를 마비시킨다.

대신 오류 표시를 하고 카운터를 올린다. 마스터가 WKC와 카운터로 판단한다. 판단을 중앙에 모으는 설계다.

CAN과 대조된다. CAN은 각 노드가 독립적으로 판단하고 Error Frame을 쏘는 분산 방식이었다. EtherCAT는 중앙집중이고, 마스터가 하나뿐이라 가능한 선택이다.

## 정리

- 프레임은 이더넷 헤더 + EtherCAT 헤더(2 B) + Datagram들 + FCS다
- Datagram은 헤더 10 B + 데이터 + WKC 2 B이고 `M` 비트로 여러 개를 이어 붙인다
- 고정 오버헤드가 52바이트다 (이더넷 38 + EtherCAT 2 + Datagram 12)
- 명령 그룹 넷: 자동증가(AP), 설정주소(FP), 브로드캐스트(B), 논리주소(L). `LRW` 가 제어 루프의 주력이다
- WKC는 자기 몫을 처리한 슬레이브가 하나씩 올리는 카운터다. 읽기 +1, 쓰기 +1, 읽기+쓰기 +3
- SOEM 기대값은 `outputsWKC * 2 + inputsWKC` 다
- WKC 부족은 이번 데이터를 믿을 수 없다는 뜻이다. 직전 값을 유지하고 연속 부족 시 안전 상태로 간다
- WKC는 몇 개인지만 알려주고 어느 것인지는 못 알려준다. ESM 상태와 포트 CRC 카운터로 찾는다
- 슬레이브가 FCS를 다시 계산하므로 어느 포트에서 오류가 생겼는지 위치가 나온다
- 슬레이브는 오류 프레임을 버리지 않는다. 버리면 뒤쪽이 전부 죽는다. 판단은 마스터가 하는 중앙집중 방식이다

## 참고

- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
