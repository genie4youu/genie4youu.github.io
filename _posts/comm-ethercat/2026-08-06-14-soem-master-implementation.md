---
title: 14. 마스터 구현, SOEM 코드로 읽기
date: 2026-08-06 12:14:00 +0900
description: ec_config_map() 한 줄 안에 05편부터 07편까지가 다 들어 있다. 그리고 EcatError 를 안 읽으면 실패 이유가 아예 안 나온다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, SOEM, C++, 스레드, 복구]
---

> **기준 출처:** [SOEM (Simple Open EtherCAT Master)](https://github.com/OpenEtherCATsociety/SOEM) GPLv2, `simple_test.c`, `slaveinfo.c`, `red_test.c` · [IgH EtherCAT Master](https://gitlab.com/etherlab.org/ethercat) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [13. ESI와 ENI 설정 파일](/posts/13-esi-eni-config-files/) | 다음 → [15. 사이클 지터와 실시간 OS](/posts/15-cycle-jitter-realtime-os/)

## 1. 왜 SOEM을 읽나

01편에서 마스터는 표준 NIC 하나면 된다고 했다. SOEM이 그 증거다. C 파일 몇 개로 EtherCAT 마스터가 된다.

규격서보다 이 코드가 더 잘 가르친다. `ec_config_init()` 하나만 따라가도 05편의 주소 지정, 06편의 FMMU, 07편의 SM이 전부 나온다.

| 마스터 | 특징 |
| --- | --- |
| SOEM | 사용자 공간 C 라이브러리. 가볍고 읽기 쉽다. 학습과 포트폴리오에 최적 |
| IgH (EtherLab) | 리눅스 커널 모듈. 지터가 더 작지만 커널 개발이 필요 |
| 상용 (TwinCAT 등) | ENI 기반, 도구 통합, 인증 |

SOEM은 GPLv2에 링킹 예외 조항이 있다. 상용 제품에 쓸 때는 라이선스 조건을 반드시 확인한다. 학습과 개인 프로젝트에는 문제없다.

## 2. API를 절차 순서대로

12편의 A부터 G까지를 SOEM API로 매핑하면 이렇다.

| 절차 | SOEM API |
| --- | --- |
| A1 소켓 | `ec_init(ifname)` |
| A2 스캔과 주소 | `ec_config_init(FALSE)` |
| A3 검증 | `ec_slave[i].eep_man`, `eep_id` |
| B PREOP 설정 | `ec_SDOwrite()`, `ec_SDOread()` |
| C1 매핑 확정 | `ec_config_map(&io_map)` |
| C3 DC | `ec_configdc()`, `ec_dcsync0()` |
| D·E 상태 전이 | `ec_writestate()`, `ec_statecheck()`, `ec_readstate()` |
| G 주기 통신 | `ec_send_processdata()`, `ec_receive_processdata()` |

## 3. 최소 마스터

```cpp
// comm_ethercat/soem_master.cpp
extern "C" {
#include "ethercat.h"
}

static std::array<char, 4096> io_map;
static std::atomic<bool> running{true};
static int expected_wkc = 0;

bool start_master(const char* ifname) {
    // ── ① NIC 열기 (이더넷 05편의 raw 소켓을 SOEM 이 감싼다) ──
    if (ec_init(ifname) <= 0) {
        // 실패 원인: NIC 이름 오타, CAP_NET_RAW 권한 없음, 이미 사용 중
        log_error("ec_init(%s) 실패 — 권한: "
                  "sudo setcap cap_net_raw,cap_net_admin+eip", ifname);
        return false;
    }

    // ── ② 스캔 + 설정 주소 배정 (05편) ──
    if (ec_config_init(FALSE) <= 0) {
        log_error("슬레이브를 못 찾음 — 케이블과 전원 확인");
        ec_close();
        return false;
    }
    log_info("슬레이브 %d개 발견", ec_slavecount);
    for (int i = 1; i <= ec_slavecount; ++i)
        log_info("  [%d] %s  vendor=0x%08X product=0x%08X rev=0x%08X",
                 i, ec_slave[i].name, ec_slave[i].eep_man,
                 ec_slave[i].eep_id, ec_slave[i].eep_rev);   // 13편: 로그에 남긴다

    // ── ③ PREOP 에서 CoE 설정 (10·11·12편) ──
    for (int i = 1; i <= ec_slavecount; ++i) {
        if (!is_drive(i)) continue;
        configure_drive_pdo(i);
        verify_drive_pdo(i);
    }

    // ── ④ 매핑 확정: SM + FMMU + 논리 주소 배치 (06·07편) ──
    const int used = ec_config_map(io_map.data());
    log_info("프로세스 이미지 %d 바이트 (출력 %d + 입력 %d)",
             used, ec_slave[0].Obytes, ec_slave[0].Ibytes);

    // ── ⑤ DC (09편) ──
    ec_configdc();
    for (int i = 1; i <= ec_slavecount; ++i)
        if (ec_slave[i].hasdc) ec_dcsync0(i, TRUE, kCycleNs, kShiftNs);

    // ── ⑥ 기대 WKC 계산 (04편) ──
    expected_wkc = ec_group[0].outputsWKC * 2 + ec_group[0].inputsWKC;
    log_info("기대 WKC = %d", expected_wkc);

    // ── ⑦ SAFEOP → (설정) → OP (08·12편) ──
    return bring_up_to_operational();
}
```

### `ec_config_map()` 이 하는 일

이 한 줄 안에 05편부터 07편까지가 다 들어 있다.

1. 각 슬레이브의 SM을 설정한다. SII나 CoE에서 PDO 크기를 읽고 SM2와 SM3의 길이를 정한다
2. 논리 주소를 순서대로 할당한다. 출력부터 배치하고 그다음 입력이다
3. FMMU를 설정한다. 각 슬레이브에 "논리 X부터 Y는 내 물리 Z" 를 써 넣는다
4. `ec_slave[i].inputs` 와 `.outputs` 포인터를 io_map 안으로 설정한다
5. PREOP에서 SAFEOP으로 전이한다

SOEM 소스의 `ec_config_map_group()` 을 읽어보면 위 다섯 단계가 그대로 코드로 있다. 06편과 07편을 이해했는지 확인하는 가장 좋은 방법이다.

## 4. 스레드 구조, 세 개로 나눈다

| 스레드 | 주기와 우선순위 | 하는 일 |
| --- | --- | --- |
| 제어 | 1 kHz, SCHED_FIFO 80, CPU 고정 | 송수신, WKC 검사, 제어 연산, 출력, DC 정렬 대기 |
| 감시 | 10~100 Hz, 낮은 RT 우선순위 | `ec_readstate()`, SDO 요청 처리, EMCY 수신, 진단 카운터, 복구 시도 |
| 애플리케이션 | 일반 우선순위 | ROS 2 노드, 로깅, UI. 제어 스레드와는 3버퍼로 연결 |

`ec_readstate()` 를 제어 스레드에서 부르면 안 된다. 모든 슬레이브에 Datagram을 보내는 무거운 작업이고 시간이 일정하지 않다. 11편의 원칙대로 메일박스와 진단을 제어 루프에서 분리한다.

### 제어 스레드

```cpp
void control_thread() {
    set_realtime_priority(80);
    pin_to_cpu(3);
    lock_memory();

    std::int64_t next_ns = now_ns() + kCycleNs;
    while (running.load(std::memory_order_relaxed)) {
        sleep_until_ns(next_ns);

        const auto t0 = now_ns();
        ec_send_processdata();
        const int wkc = ec_receive_processdata(EC_TIMEOUTRET);
        const auto t1 = now_ns();

        // 왕복 시간 히스토그램. 02편의 계산을 실측으로
        stats_.record_roundtrip(t1 - t0);

        if (wkc >= expected_wkc) {
            wkc_low_streak_ = 0;
            run_control_step();
        } else {
            ++stats_.wkc_low;
            if (++wkc_low_streak_ > kMaxWkcLowStreak) enter_safe_state("WKC");
        }

        // DC 에 맞춰 다음 주기 계산 (09편)
        next_ns += kCycleNs + dc_adjust_ns();
        stats_.record_jitter(now_ns() - t0);
    }
}
```

### 감시 스레드

```cpp
void monitor_thread() {
    set_realtime_priority(20);           // 제어보다 낮게
    while (running.load(std::memory_order_relaxed)) {
        sleep_ms(100);

        // ① ESM 상태 (08편)
        ec_readstate();
        for (int i = 1; i <= ec_slavecount; ++i) {
            if (ec_slave[i].state != EC_STATE_OPERATIONAL) {
                log_error("슬레이브 %d: state=0x%02X ALstatus=0x%04X (%s)",
                          i, ec_slave[i].state, ec_slave[i].ALstatuscode,
                          ec_ALstatuscode2string(ec_slave[i].ALstatuscode));
                esm_ok_.store(false);
            }
        }

        // ② SOEM 의 에러 리스트 (SDO abort, 메일박스 오류 등)
        while (EcatError) log_error("SOEM: %s", ec_elist2string());

        // ③ 진단 카운터 (16편)
        read_diagnostic_counters();
    }
}
```

`while (EcatError) ec_elist2string()` 을 반드시 넣는다. SOEM은 오류를 내부 리스트에 쌓아두는데 안 읽으면 아무 정보도 안 나온다. 이걸 모르면 "실패했는데 이유를 모르겠다" 가 된다.

## 5. `ec_slave[]` 구조체

```cpp
// 자주 쓰는 필드 (SOEM 의 ec_slavet)
ec_slave[i].name          // 이름 (SII 에서)
ec_slave[i].eep_man       // Vendor ID          05·13편 검증
ec_slave[i].eep_id        // Product Code
ec_slave[i].eep_rev       // Revision
ec_slave[i].state         // ESM 상태            08편
ec_slave[i].ALstatuscode  // 실패 이유           08편
ec_slave[i].configadr     // 설정 주소           05편 (FPRD 에 쓴다)
ec_slave[i].hasdc         // DC 지원 여부        09편
ec_slave[i].mbx_proto     // 메일박스 프로토콜   11편
ec_slave[i].Ibytes        // 입력 크기           06·10편 검증
ec_slave[i].Obytes        // 출력 크기
ec_slave[i].Ibits         // 비트 단위 (06편)
ec_slave[i].inputs        // io_map 안의 포인터
ec_slave[i].outputs
ec_slave[i].topology      // 포트 구성 (03편)
ec_slave[i].parent        // 트리 구조에서의 부모

// ec_slave[0] 은 특별하다. 전체 그룹을 뜻한다
ec_slave[0].state         // 전체 상태 (모두 같을 때만 의미)
ec_slave[0].Obytes        // 전체 출력 이미지 크기
```

`ec_slave[0]` 이 그룹 전체라는 것을 알아야 SOEM 코드가 읽힌다. `ec_writestate(0)` 은 브로드캐스트로 전체 상태를 바꾼다. 05편의 BWR이다.

## 6. 슬레이브 복구

운전 중 슬레이브 하나가 SAFEOP로 떨어지면 어떻게 하나. SOEM의 `simple_test.c` 예제에 `ecatcheck` 스레드가 있고 그게 복구 로직의 참고 구현이다.

```cpp
// 감시 스레드 안의 복구 로직 (SOEM 예제 방식을 정리)
void try_recover_slaves() {
    if (ec_group[0].docheckstate) return;    // 다른 데서 이미 처리 중

    ec_group[0].docheckstate = FALSE;
    ec_readstate();
    for (int i = 1; i <= ec_slavecount; ++i) {
        if (ec_slave[i].state == EC_STATE_OPERATIONAL) {
            ec_slave[i].islost = FALSE; continue;
        }

        ec_group[0].docheckstate = TRUE;

        if (ec_slave[i].state == EC_STATE_SAFE_OP + EC_STATE_ERROR) {
            log_error("슬레이브 %d: SAFE_OP + ERROR → ACK 후 OP 재시도", i);
            ec_slave[i].state = EC_STATE_SAFE_OP + EC_STATE_ACK;
            ec_writestate(i);
        } else if (ec_slave[i].state == EC_STATE_SAFE_OP) {
            log_warn("슬레이브 %d: SAFE_OP → OP 재시도", i);
            ec_slave[i].state = EC_STATE_OPERATIONAL;
            ec_writestate(i);
        } else if (ec_slave[i].state > EC_STATE_NONE) {
            if (ec_reconfig_slave(i, EC_TIMEOUTMON)) {
                ec_slave[i].islost = FALSE;
                log_info("슬레이브 %d 재설정 성공", i);
            }
        } else if (!ec_slave[i].islost) {
            ec_statecheck(i, EC_STATE_OPERATIONAL, EC_TIMEOUTRET);
            if (ec_slave[i].state == EC_STATE_NONE) {
                ec_slave[i].islost = TRUE;
                log_error("슬레이브 %d 소실 — 케이블 확인", i);
            }
        }
    }
}
```

자동 복구를 어디까지 할지는 안전 정책 문제다. CAN Bus Off 자동복구와 같은 딜레마다.

| | 자동 복구 | 수동이나 제한 복구 |
| --- | --- | --- |
| 일시적 문제 | 알아서 회복 | 개입 필요 |
| 지속적 고장 | 무한 반복하고 원인을 못 본다 | 카운트하고 포기 |
| 안전 시스템 | 부적합 | 권장 |

복구를 시도하되 횟수를 세고 N회를 넘으면 폴트로 승격한다. 그리고 모터가 구동 중이면 복구 전에 먼저 정지시킨다. 슬레이브가 OP로 돌아오는 순간 옛 명령을 실행할 수 있다.

## 7. 빌드와 실행

```bash
# SOEM 빌드
git clone https://github.com/OpenEtherCATsociety/SOEM.git
cd SOEM && mkdir build && cd build
cmake .. && make

# NIC 이름 확인
ip link show

# 권한: root 로 돌리지 말고 능력만 준다
sudo setcap cap_net_raw,cap_net_admin+eip ./my_master

# 슬레이브 정보 확인
./slaveinfo eth1
./slaveinfo eth1 -map     # 프로세스 이미지 배치까지

# 실행
./my_master eth1
```

NIC은 EtherCAT 전용이어야 한다. 일반 트래픽이 섞이면 타이밍이 깨진다.

```bash
# 그 NIC 에서 IP 스택을 떼어낸다
sudo ip addr flush dev eth1
sudo ip link set eth1 up
```

### 하드웨어 없이 개발하기

실물 슬레이브가 없어도 프레임 조립과 파싱 로직(04편)을 유닛 테스트하고, CiA 402 시퀀서를 상태 시뮬레이터로 검증하고, PDO 매핑 오프셋 계산을 `static_assert` 로 확인하고, WKC 검증 로직과 진단 카운터 처리를 테스트할 수 있다.

프로토콜 로직과 I/O를 분리한다는 이 연재의 예제 방침이 여기서 제 몫을 한다. `ISpiBus` 나 `ISerialPort` 처럼 `IEtherCatMaster` 인터페이스를 두고 가짜 구현으로 CI에서 테스트한다.

```cpp
// 슬레이브를 흉내내는 fake. CiA 402 시퀀서를 하드웨어 없이 검증
class FakeCia402Slave {
public:
    void apply_controlword(std::uint16_t cw);   // 전이 규칙대로
    std::uint16_t statusword() const;
    void inject_fault();                        // 폴트 시나리오 테스트
};
```

## 정리

- SOEM은 규격서보다 잘 가르친다. `ec_config_init()` 하나에 05편부터 07편까지가 다 들어 있다
- GPLv2에 링킹 예외가 있다. 상용 제품에는 라이선스를 확인하고 학습과 개인 프로젝트는 문제없다
- API가 12편의 절차와 1:1 대응한다
- `ec_config_map()` 안에 SM 설정, 논리 주소 할당, FMMU, 포인터 설정, SAFEOP 전이가 다 있다
- 스레드를 셋으로 나눈다. 제어(1 kHz, RT 80), 감시(100 Hz, RT 20), 애플리케이션
- `ec_readstate()` 를 제어 스레드에서 부르지 않는다
- `while (EcatError) ec_elist2string()` 을 반드시 넣는다. 안 읽으면 오류 이유가 안 나온다
- `ec_slave[0]` 은 그룹 전체를 뜻한다
- 자동 복구는 안전 정책 문제다. 횟수를 세고 N회 초과 시 폴트로 승격하고 복구 전에 모터를 먼저 정지시킨다
- `sudo setcap cap_net_raw,cap_net_admin+eip` 로 root 없이 실행하고 NIC은 전용으로 쓴다
- 하드웨어 없이도 프레임 로직, CiA 402 시퀀서, 매핑 계산을 CI에서 검증할 수 있다

## 참고

- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
- [IgH EtherCAT Master](https://gitlab.com/etherlab.org/ethercat)
