---
title: 17. 예제, 마스터 골격 만들기
date: 2026-08-06 12:17:00 +0900
description: ESC 칩이 없어도 검증할 수 있는 범위가 생각보다 넓다. 초기 위치를 0이 아니게 두면 목표값 초기화 누락이 테스트로 잡힌다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, 예제, gtest, C++, 안전]
---

> **기준 출처:** 이 폴더 01편부터 16편까지를 코드로 옮긴 것 · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) (GPLv2 + 링킹 예외, 상용 사용 시 라이선스 확인) · `sched_setscheduler(2)`, `mlockall(2)`, `clock_nanosleep(2)` / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [16. 진단](/posts/16-diagnostics-wkc-crc-counters/)

## 1. 무엇을 만드나

EtherCAT는 앞의 프로토콜들과 사정이 다르다. 슬레이브에 ESC 칩이 필요해서 실물 없이 만들 수 있는 범위가 제한된다. 그래서 예제를 두 층으로 나눈다.

| 층 | 하드웨어 | 검증 방법 |
| --- | --- | --- |
| ① 로직 층 | 불필요 | 유닛 테스트. ESM FSM, 브링업 시퀀서, 진단 해석, 예산 계산 |
| ② I/O 층 | 필요 | 실물 슬레이브와 오실로스코프 |

①이 생각보다 넓다. 이 폴더에서 가장 어려웠던 것들(ESM 전이 순서, CiA 402 겹침, WKC 판정, 안전 정책)이 전부 로직이라 하드웨어 없이 검증된다.

## 2. 패키지 구조

```
comm-examples/
└── comm_ethercat/
    ├── include/comm_ethercat/
    │   ├── esm.hpp               ESM 상태와 AL Status Code 해석   (08편)
    │   ├── esm_sequencer.hpp     INIT 에서 OP 까지 시퀀서         (08·12편)
    │   ├── pdo_map.hpp           매핑 정의, 오프셋 계산, 검증     (10편)
    │   ├── axis_io.hpp           IOmap 타입 안전 접근             (06편)
    │   ├── wkc_monitor.hpp       WKC 판정 + 연속 실패 정책        (04편)
    │   ├── diagnostics.hpp       포트 카운터 해석, 구간 특정      (16편)
    │   ├── budget.hpp            프레임과 사이클 예산 계산        (02·04편)
    │   ├── rt_setup.hpp          실시간 설정                      (15편)
    │   └── cycle_stats.hpp       지터 히스토그램                  (15편)
    ├── src/
    │   ├── soem_master.cpp       SOEM 래핑                        (14편)
    │   └── control_loop.cpp      3스레드 구조                     (14편)
    └── test/
        ├── fake_slave_model.hpp  ESM + CiA 402 겹침 시뮬레이터
        ├── esm_sequencer_test.cpp
        ├── pdo_map_test.cpp
        ├── wkc_monitor_test.cpp
        ├── diagnostics_test.cpp
        └── budget_test.cpp
```

## 3. 가짜 슬레이브, 두 FSM이 겹친 모델

08편과 12편의 "FSM 세 개가 겹친다" 를 시뮬레이터로 만든다. 이 예제가 하는 일이 그것이다.

```cpp
// test/fake_slave_model.hpp
// ESM(통신) 위에 CiA 402(모터)가 얹힌 구조를 그대로 모델링한다.
// 12편의 브링업 절차가 정말 순서대로만 성공하는지 검증할 수 있다.
class FakeSlaveModel {
public:
    // ── ESM (08편) ──
    struct EsmResult { EsmState state; std::uint16_t al_status_code; };

    EsmResult request_state(EsmState want) {
        // 순서를 건너뛰면 거부한다
        if (!is_valid_transition(esm_, want)) return {esm_, 0x0011};

        if (want == EsmState::SafeOp) {
            if (!pdo_mapping_valid_) return {esm_, 0x0024};   // PDO 매핑 오류
            if (!sm_config_valid_)   return {esm_, 0x0017};   // SM 설정 오류
        }
        if (want == EsmState::Op) {
            // 08편: 프로세스 데이터를 이미 받고 있어야 OP 로 간다
            if (pd_cycles_ < kMinCyclesBeforeOp) return {esm_, 0x001A};
            if (dc_enabled_ && !dc_converged_)   return {esm_, 0x0030};
        }
        esm_ = want;
        return {esm_, 0x0000};
    }

    // ── 주기 프로세스 데이터 ──
    void on_process_data(std::uint16_t controlword, std::int32_t target_pos) {
        ++pd_cycles_;
        watchdog_us_ = 0;

        if (esm_ == EsmState::Op) {
            drive_.apply_controlword(controlword);            // CiA 402
            if (drive_.state() == DriveState::OperationEnabled) {
                // 12편 D4 검증: 목표와 실제의 차이가 크면 급이동으로 기록
                if (std::abs(target_pos - position_) > kJumpThreshold)
                    ++jump_events_;
                position_ = target_pos;
            }
        }
        // SAFEOP 에서는 출력을 무시한다. 입력만 갱신
    }

    void advance_us(std::uint32_t dt) {
        watchdog_us_ += dt;
        if (esm_ == EsmState::Op && watchdog_us_ > watchdog_timeout_us_) {
            esm_ = EsmState::SafeOp;                          // 07편의 SM 워치독
            last_al_code_ = 0x001A;
        }
        if (dc_enabled_ && ++dc_ticks_ > kDcSettleCycles) dc_converged_ = true;
    }

    // ── 검증용 ──
    std::uint16_t statusword()  const { return drive_.statusword(); }
    std::int32_t  position()    const { return position_; }
    std::uint32_t jump_events() const { return jump_events_; }
    EsmState      esm()         const { return esm_; }

    // 오류 주입
    void set_pdo_mapping_valid(bool v) { pdo_mapping_valid_ = v; }
    void set_sm_config_valid(bool v)   { sm_config_valid_ = v; }
    void cut_cable()                   { cable_ok_ = false; }

private:
    EsmState  esm_{EsmState::Init};
    FakeCia402Slave drive_;                 // CAN 예제의 것을 재사용한다
    std::int32_t position_{123456};         // 0 이 아닌 초기 위치. D4 검증에 쓴다
    std::uint32_t pd_cycles_{0}, jump_events_{0}, dc_ticks_{0}, watchdog_us_{0};
    std::uint32_t watchdog_timeout_us_{100'000};
    bool pdo_mapping_valid_{true}, sm_config_valid_{true};
    bool dc_enabled_{true}, dc_converged_{false}, cable_ok_{true};
};
```

`position_{123456}` 이 결정적이다. 실제 축은 전원을 켰을 때 위치가 0이 아니다. 이 초기값 덕에 12편의 D4(목표값 초기화)를 빼먹으면 `jump_events_` 가 올라가는 것을 테스트로 잡을 수 있다.

## 4. 무엇을 검증하나

### ① 가장 위험한 실수, 목표값 초기화 누락

```cpp
// 이 테스트 하나가 "축이 최대 속도로 급이동한다" 사고를 막는다
TEST(Bringup, WithoutTargetInitCausesJump) {
    FakeSlaveModel slave;
    BringupSequencer seq{/*init_target_from_actual=*/false};   // D4 를 뺐다
    run_bringup(seq, slave);
    EXPECT_EQ(slave.esm(), EsmState::Op);
    EXPECT_GT(slave.jump_events(), 0u);        // 급이동이 발생했다
}

TEST(Bringup, WithTargetInitDoesNotJump) {
    FakeSlaveModel slave;
    BringupSequencer seq{/*init_target_from_actual=*/true};    // D4 포함
    run_bringup(seq, slave);
    EXPECT_EQ(slave.esm(), EsmState::Op);
    EXPECT_EQ(slave.jump_events(), 0u);        // 급이동 없음
}
```

첫 번째 테스트가 "이 실수를 하면 이런 일이 생긴다" 를 실행 가능한 형태로 남긴다. 나중에 누가 D4를 지우면 CI가 막는다.

### ② ESM 전이 순서와 실패 코드

```cpp
TEST(Esm, CannotSkipStates) {
    FakeSlaveModel s;
    const auto r = s.request_state(EsmState::Op);      // INIT 에서 OP 직행
    EXPECT_NE(r.state, EsmState::Op);
    EXPECT_EQ(r.al_status_code, 0x0011);               // 잘못된 요청 상태 변경
}

TEST(Esm, SafeOpFailsOnBadPdoMapping) {
    FakeSlaveModel s;
    s.set_pdo_mapping_valid(false);                    // 10편의 실수
    s.request_state(EsmState::PreOp);
    const auto r = s.request_state(EsmState::SafeOp);
    EXPECT_EQ(r.al_status_code, 0x0024);               // PDO 매핑 오류
}

TEST(Esm, OpFailsIfProcessDataNotFlowing) {
    // 08편: 프로세스 데이터를 보내지 않고 OP 만 명령하면 실패한다
    FakeSlaveModel s;
    s.request_state(EsmState::PreOp);
    s.request_state(EsmState::SafeOp);
    const auto r = s.request_state(EsmState::Op);      // 데이터를 안 보냈다
    EXPECT_NE(r.state, EsmState::Op);
    EXPECT_EQ(r.al_status_code, 0x001A);               // 워치독
}

TEST(Esm, AlStatusCodeHasReadableMeaning) {
    EXPECT_EQ(al_status_string(0x0017), "유효하지 않은 SM 설정");
    EXPECT_EQ(al_status_string(0x0024), "PDO 매핑 오류");
    EXPECT_EQ(al_status_string(0x001A), "워치독 타임아웃");
    EXPECT_EQ(al_status_string(0x0030), "DC 동기 실패");
}
```

### ③ SM 워치독, 케이블 뽑기 테스트를 코드로

```cpp
// 07편·12편: 정상 운전에서는 증상이 없어서 테스트를 안 하면 발견되지 않는다
TEST(Watchdog, SlaveFallsToSafeOpWhenDataStops) {
    FakeSlaveModel s;
    run_bringup_to_op(s);
    ASSERT_EQ(s.esm(), EsmState::Op);

    // 프로세스 데이터를 멈춘다 (케이블을 뽑은 것과 같다)
    for (int i = 0; i < 200; ++i) s.advance_us(1000);   // 200 ms

    EXPECT_EQ(s.esm(), EsmState::SafeOp);              // 스스로 내려왔다
}

TEST(Watchdog, TimeoutIsWithinSafetyBudget) {
    // 07편: "그 시간 동안 로봇이 얼마나 움직이나" 를 계산으로 못박는다
    constexpr double kMaxSpeedMps   = 1.0;
    constexpr double kAllowedTravelM = 0.05;           // 안전 요구: 5 cm
    const auto timeout_s = kWatchdogTimeoutUs / 1e6;
    EXPECT_LE(kMaxSpeedMps * timeout_s, kAllowedTravelM);
}
```

두 번째 테스트가 특별하다. 워치독 시간을 바꾸면 안전 요구를 만족하는지 CI가 확인한다. 07편에서 계산해야 한다고 한 것을 자동화한 것이다.

### ④ WKC 판정 정책

```cpp
TEST(WkcMonitor, SingleDropDoesNotTriggerSafeState) {
    // 04편: 한 번의 부족으로 즉시 정지하면 일시적 노이즈에 과민하다
    WkcMonitor m{/*expected=*/18, /*max_streak=*/3};
    EXPECT_EQ(m.update(15), WkcVerdict::HoldPrevious);
    EXPECT_EQ(m.update(18), WkcVerdict::Ok);           // 회복
    EXPECT_EQ(m.streak(), 0u);
}

TEST(WkcMonitor, ConsecutiveDropsTriggerSafeState) {
    WkcMonitor m{18, 3};
    EXPECT_EQ(m.update(15), WkcVerdict::HoldPrevious);
    EXPECT_EQ(m.update(15), WkcVerdict::HoldPrevious);
    EXPECT_EQ(m.update(15), WkcVerdict::HoldPrevious);
    EXPECT_EQ(m.update(15), WkcVerdict::EnterSafeState);   // 4회 연속
}

TEST(WkcMonitor, ExpectedValueMatchesSpecFormula) {
    // 04편: outputsWKC * 2 + inputsWKC. 입출력 둘 다인 슬레이브는 +3
    EXPECT_EQ(compute_expected_wkc(/*out=*/6, /*in=*/6), 18);
}
```

### ⑤ 진단, 불량 구간 특정

```cpp
// 16편의 규칙: "RX Error 있고 Forwarded 없는" 슬레이브가 범인 구간의 끝
TEST(Diagnostics, LocatesBadCableSegment) {
    std::vector<SlaveDiagnostics> d(10);
    d[5].ports[0].rx_error  = 42;      // 슬레이브 5(0-based)에서 처음 깨졌다
    d[6].ports[0].forwarded = 42;      // 뒤쪽은 전달만 받았다 (피해자)
    d[7].ports[0].forwarded = 42;

    const auto bad = find_bad_segment(d, /*minutes=*/10.0);
    ASSERT_TRUE(bad);
    EXPECT_EQ(bad->slave, 6);          // 1-based
    EXPECT_EQ(bad->port, 0);
    EXPECT_EQ(bad->rate_per_min, 4u);
}

TEST(Diagnostics, ForwardedOnlySlavesAreNotBlamed) {
    std::vector<SlaveDiagnostics> d(5);
    d[3].ports[0].forwarded = 100;     // 피해자만 있고 원인이 없다
    EXPECT_FALSE(find_bad_segment(d, 10.0));
}

TEST(Diagnostics, RisingTrendIsDetectedBeforeFailure) {
    // 16편: "케이블은 갑자기 안 끊어진다". 추세를 잡는다
    ErrorTrend trend;
    for (int week = 0; week < 5; ++week) trend.sample(week * 20);
    EXPECT_TRUE(trend.is_rising());
    EXPECT_GT(trend.projected_days_to_threshold(500), 0);
}
```

### ⑥ 예산 계산

```cpp
TEST(Budget, SixAxisRoundTripIsAbout25us) {
    constexpr EtherCatBudget b{.process_data_bytes=96, .datagram_count=2,
                               .slave_count=6, .slave_delay_us=1.0,
                               .cable_total_m=20};
    EXPECT_NEAR(b.network_roundtrip_us(), 25.0, 3.0);
}

TEST(Budget, ScalesGracefullyWithSlaveCount) {
    // 02편: 슬레이브가 늘어도 프레임 개수는 그대로, 길이만 는다
    auto at = [](std::size_t n) {
        return EtherCatBudget{.process_data_bytes=16*n, .datagram_count=2,
                              .slave_count=n, .slave_delay_us=1.0,
                              .cable_total_m=20}.network_roundtrip_us();
    };
    EXPECT_LT(at(12) / at(6), 2.0);       // 슬레이브 2배인데 시간은 2배 미만
    EXPECT_LT(at(12), 100.0);             // 12축도 100 µs 안
}

TEST(Budget, MatchesControlBandwidthRequirement) {
    // 15편: 제어 대역폭이 사이클을 정한다
    constexpr double omega_c = 200.0;                 // rad/s
    const double budget_s = 0.3 / omega_c;            // 1.5 ms
    const double zoh_s    = kCycleUs / 2e6;
    const double net_s    = 25e-6;
    EXPECT_LT(zoh_s + net_s + kComputeS + kDriveS, budget_s);
}
```

## 5. 실물 층, SOEM 래핑

```cpp
// src/soem_master.cpp — 14편의 API 를 인터페이스 뒤로 숨긴다
class SoemMaster : public IEtherCatMaster {
public:
    bool init(const char* ifname) override {
        if (ec_init(ifname) <= 0) {
            log_error("ec_init(%s) 실패 — 권한: "
                      "setcap cap_net_raw,cap_net_admin+eip", ifname);
            return false;
        }
        if (ec_config_init(FALSE) <= 0) {
            log_error("슬레이브 없음"); return false;
        }
        return true;
    }
    // …ec_config_map / ec_configdc / ec_writestate 래핑

    void drain_errors() override {          // 14편: 안 읽으면 이유를 모른다
        while (EcatError) log_error("SOEM: %s", ec_elist2string());
    }
};
```

SOEM은 GPLv2에 링킹 예외다. 인터페이스 뒤로 숨겨두면 나중에 다른 마스터로 바꾸기도 쉽고 라이선스 경계도 명확해진다.

### 3스레드 구조

```cpp
// src/control_loop.cpp
void run() {
    std::thread control([&]{
        setup_realtime(/*prio=*/80, /*cpu=*/3);
        timespec next{}; clock_gettime(CLOCK_MONOTONIC, &next);
        while (running_) {
            clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, nullptr);
            const auto t0 = now_ns();
            master_.send_process_data();
            const int wkc = master_.receive_process_data();
            stats_.record_jitter(t0 - expected_ns(next));
            if (wkc_.update(wkc) == WkcVerdict::Ok) run_control_step();
            add_ns(next, kCycleNs + master_.dc_adjust_ns());
        }
    });
    std::thread monitor([&]{
        setup_realtime(20, 3);
        while (running_) {
            sleep_ms(100);
            master_.read_states();
            master_.drain_errors();
            diagnostics_.poll();
        }
    });
    // 애플리케이션 스레드는 3버퍼로 제어 스레드와 통신
}
```

## 6. 만드는 순서

1. budget과 테스트. 설계 검토에 바로 쓰인다
2. esm과 al_status_string과 테스트
3. `FakeSlaveModel`. ESM과 CiA 402 겹침, CAN 예제의 드라이브 재사용
4. esm_sequencer와 테스트. D4 검증까지
5. wkc_monitor와 테스트
6. diagnostics와 테스트. 불량 구간 특정
7. pdo_map과 axis_io와 테스트. 오프셋 `static_assert`
8. rt_setup과 cycle_stats
9. soem_master (실물)
10. 실물 슬레이브로 검증

1번부터 8번까지가 하드웨어 없이 된다. 그중 3번과 4번이 이 폴더에서 가장 어려웠던 FSM 세 개 겹침을 코드로 소화하는 부분이다. 10번은 12편의 시운전 체크리스트를 반드시 따른다. 부하 분리, 이동 범위 제한, 하드와이어 비상정지, 케이블 뽑기 테스트다.

## 정리

- EtherCAT는 슬레이브에 ESC 칩이 필요해서 예제를 로직 층(하드웨어 불필요)과 I/O 층으로 나눈다
- 로직 층이 생각보다 넓다. ESM 전이, CiA 402 겹침, WKC 정책, 진단, 예산이 전부 로직이다
- `FakeSlaveModel` 이 FSM 세 개 겹침을 시뮬레이션한다. `position_{123456}` 으로 D4 를 검증한다
- 목표값 초기화를 빼면 급이동이 발생한다는 것을 CI가 막는다
- ESM 순서 강제와 AL Status Code(`0x0011`, `0x0024`, `0x001A`, `0x0030`)를 검증한다
- SM 워치독은 데이터가 멈추면 스스로 SAFEOP로 내려간다. 타임아웃이 안전 요구를 만족하는지 계산까지 자동화한다
- WKC는 연속 실패로 판정한다. 한 번에 정지하지 않는다
- 불량 구간 특정은 RX Error가 있고 Forwarded가 없는 슬레이브를 찾는 것이다. 피해자를 범인으로 오해하지 않는다
- 예산이 슬레이브 수에 완만하게 는다
- SOEM은 인터페이스 뒤로 숨긴다. 라이선스 경계와 교체 가능성 때문이다
- 3스레드로 나눈다. 제어(RT 80), 감시(RT 20), 애플리케이션. 사이에는 3버퍼를 둔다
- 실물 검증은 12편의 시운전 체크리스트를 따른다

## 참고

- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
- [ETG — EtherCAT Technology](https://www.ethercat.org/en/technology.html)
