---
title: 15. 사이클 지터와 실시간 OS
date: 2026-08-06 12:15:00 +0900
description: 병목은 네트워크 25 µs가 아니라 마스터 소프트웨어다. "가끔 OP에서 SAFEOP로 떨어진다" 의 1순위 원인이 여기 있다.
categories: [로봇 통신, EtherCAT]
tags: [통신, ethercat, 지터, PREEMPT_RT, cyclictest, 실시간]
math: true
---

> **기준 출처:** [Linux Foundation PREEMPT_RT wiki](https://wiki.linuxfoundation.org/realtime/start) · `cyclictest` 문서 · Linux 커널 `Documentation/scheduler/` · `sched_setscheduler(2)`, `mlockall(2)`, `clock_nanosleep(2)` · [SOEM](https://github.com/OpenEtherCATsociety/SOEM) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [14. 마스터 구현](/posts/14-soem-master-implementation/) | 다음 → [16. 진단](/posts/16-diagnostics-wkc-crc-counters/)

## 1. 병목은 네트워크가 아니다

02편과 04편에서 계산했다.

| 항목 | 시간 |
| --- | --- |
| EtherCAT 네트워크 왕복 (6축) | 25 µs |
| 마스터 소프트웨어 | 수십 µs에서 수 ms |

네트워크는 이미 충분히 빠르고 결정적이다. EtherCAT가 ⑥ 시간 칸을 채웠고 남은 불확정성은 마스터 소프트웨어뿐이다.

[이더넷 04편](/posts/04-why-ethernet-not-realtime/)에서 본 다섯 원천 중 스위치와 NIC 큐와 TCP/IP가 EtherCAT에서는 사라졌다. 남은 건 커널 스택과 OS 스케줄링이고 후자가 지배적이다.

## 2. 얼마나 나쁜가

`cyclictest` 로 잰 1 ms 주기의 최악 지연이다. 전형적인 값이고 하드웨어에 따라 크게 다르다.

| 커널 설정 | 최악 지연 |
| --- | --- |
| 일반 Linux (`CONFIG_PREEMPT_NONE`) | 수 ms에서 수십 ms |
| `CONFIG_PREEMPT` (저지연) | 수백 µs |
| `PREEMPT_RT` (기본 설정) | 수십에서 수백 µs |
| `PREEMPT_RT` + CPU 격리 + 튜닝 | 수십 µs 이하 |
| Windows (일반) | 수 ms에서 수십 ms |

### 왜 지터가 사이클보다 중요한가

09편의 shift time을 떠올린다. 마스터가 t=0에 프레임을 보내야 하는데 실제로는 t=0±J에 보낸다. 마지막 슬레이브 도착이 t=40 µs이고 SYNC0이 t=500 µs다.

지터 J가 shift 여유를 소비한다. J가 shift를 넘으면 프레임이 SYNC0 이후에 도착하고 슬레이브는 옛 값으로 동작한다.

더 나쁜 건 워치독이다. 사이클을 통째로 놓치면 SM 워치독이 만료되어 슬레이브가 SAFEOP로 떨어진다. AL Status Code `0x001A` 다.

"가끔 OP에서 SAFEOP로 떨어진다" 의 원인 1순위가 마스터 지터다.

## 3. 튜닝, 효과가 큰 순서

### ① PREEMPT_RT 커널

가장 효과가 크다. 다른 튜닝을 다 해도 일반 커널이면 한계가 있다.

```bash
# 배포판에 따라 패키지가 있다
sudo apt install linux-image-rt-amd64        # Debian/Ubuntu 계열 예
uname -a | grep PREEMPT_RT                   # 확인
```

최근 커널(6.12 이후)에서는 PREEMPT_RT가 메인라인에 통합되어 별도 패치 없이 설정만으로 쓸 수 있다. 배포판 커널이 어떤 설정인지 확인한다.

### ② CPU 격리

```bash
# 부팅 파라미터 (GRUB)
isolcpus=2,3 nohz_full=2,3 rcu_nocbs=2,3 irqaffinity=0,1
```

| 파라미터 | 효과 |
| --- | --- |
| `isolcpus` | 스케줄러가 그 CPU에 일반 태스크를 안 올린다 |
| `nohz_full` | 그 CPU의 타이머 인터럽트를 최소화 |
| `rcu_nocbs` | RCU 콜백을 다른 CPU로 |
| `irqaffinity` | 일반 인터럽트를 다른 CPU로 |

격리된 CPU에 제어 스레드를 고정하면 다른 프로세스의 방해가 사라진다.

```bash
# EtherCAT NIC 의 인터럽트만 제어 CPU 로
grep eth1 /proc/interrupts                        # IRQ 번호 확인
echo 4 | sudo tee /proc/irq/<IRQ>/smp_affinity    # CPU 2 (비트마스크)
```

### ③ 프로세스 설정

```cpp
// comm_ethercat/rt_setup.hpp
#include <sched.h>
#include <sys/mman.h>
#include <pthread.h>

bool setup_realtime(int priority, int cpu) {
    // ① 메모리 잠금. 페이지 폴트가 수 ms 를 만든다
    if (::mlockall(MCL_CURRENT | MCL_FUTURE) != 0) {
        log_warn("mlockall 실패 — RLIMIT_MEMLOCK 확인");
        return false;
    }

    // ② 실시간 우선순위 (99 는 쓰지 않는다)
    sched_param sp{};
    sp.sched_priority = priority;          // 제어 80, 감시 20
    if (::pthread_setschedparam(::pthread_self(), SCHED_FIFO, &sp) != 0) {
        log_warn("우선순위 설정 실패 — 권한 또는 RLIMIT_RTPRIO");
        return false;
    }

    // ③ CPU 고정
    cpu_set_t set; CPU_ZERO(&set); CPU_SET(cpu, &set);
    if (::pthread_setaffinity_np(::pthread_self(), sizeof(set), &set) != 0)
        return false;

    // ④ 스택 미리 확보. 나중에 grow 하면서 폴트가 나는 것을 막는다
    volatile std::array<std::uint8_t, 64 * 1024> stack_touch{};
    for (std::size_t i = 0; i < stack_touch.size(); i += 4096)
        stack_touch[i] = 0;

    return true;
}
```

`mlockall` 이 의외로 중요하다. 페이지 폴트 하나가 수 ms를 만들 수 있다. 그리고 동적 할당을 실시간 경로에서 하지 않는 것과 짝을 이룬다.

### ④ 사이클 루프의 구조

```cpp
// 절대 시각 기반으로 잔다. 상대 sleep 은 오차가 누적된다
void cyclic_loop() {
    timespec next{};
    ::clock_gettime(CLOCK_MONOTONIC, &next);

    while (running) {
        // TIMER_ABSTIME: "이만큼 자라" 가 아니라 "이 시각까지 자라"
        ::clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &next, nullptr);

        const auto t_wake = now_ns();
        ec_send_processdata();
        const int wkc = ec_receive_processdata(EC_TIMEOUTRET);
        const auto t_done = now_ns();

        // 두 가지를 다 잰다
        stats_.record_jitter(t_wake - expected_wake_ns(next));   // 기상 지터
        stats_.record_roundtrip(t_done - t_wake);                // 네트워크 왕복

        if (wkc >= expected_wkc) run_control_step();

        // DC 보정을 반영해 다음 시각 계산 (09편)
        add_ns(next, kCycleNs + dc_adjust_ns());
    }
}
```

`usleep(1000)` 같은 상대 sleep을 쓰면 안 된다. 매번 "지금부터 1 ms" 라서 처리 시간이 누적되어 주기가 점점 밀린다. `clock_nanosleep` 과 `TIMER_ABSTIME` 이 정답이다. 이 절대 시각에 깨우라는 뜻이므로 처리 시간과 무관하게 주기가 유지된다.

## 4. 측정, 반드시 한다

[기초 10편](/posts/10-basics-realtime-jitter/)의 원칙이다. 계산은 틀리고 측정해야 한다.

### ① 시스템 지연 (cyclictest)

```bash
# 1 ms 주기, 우선순위 99(측정용), 1시간, 히스토그램
sudo cyclictest -m -S -p 99 -i 1000 -l 3600000 -h 400 -q > latency.txt

# 결과의 Max 를 본다
# T: 0 (12345) P:99 I:1000 C:3600000 Min: 2 Act: 3 Avg: 3 Max: 28
#                                                            이게 사양이다
```

| Max 값 | 판단 |
| --- | --- |
| 50 µs 미만 | 1 kHz에 여유 |
| 50~200 µs | 1 kHz는 되지만 shift 여유를 확인 |
| 500 µs 초과 | 1 kHz 부적합. 튜닝 필요 |

부하가 있는 상태에서 재야 한다. 시스템이 놀고 있을 때는 좋게 나온다. `stress-ng` 같은 도구로 부하를 주면서 측정한다.

### ② 애플리케이션 지터

```cpp
// comm_ethercat/cycle_stats.hpp
class CycleStats {
public:
    void record_jitter(std::int64_t ns) {
        jitter_min_ = std::min(jitter_min_, ns);
        jitter_max_ = std::max(jitter_max_, ns);       // 이게 사양이다
        // 히스토그램 (10 µs 단위, 0~1 ms)
        const auto bin = std::clamp<std::size_t>(
            std::abs(ns) / 10'000, 0, kBins - 1);
        ++hist_[bin];
        ++count_;
    }
    void dump() const {
        log_info("사이클 지터: min=%lld ns max=%lld ns (%zu 사이클)",
                 jitter_min_, jitter_max_, count_);
        for (std::size_t i = 0; i < kBins; ++i)
            if (hist_[i])
                log_info("  %3zu~%3zu µs : %u", i*10, (i+1)*10, hist_[i]);
    }
private:
    static constexpr std::size_t kBins = 100;
    std::int64_t jitter_min_{INT64_MAX}, jitter_max_{INT64_MIN};
    std::array<std::uint32_t, kBins> hist_{};
    std::size_t count_{};
};
```

평균이 아니라 최댓값과 히스토그램의 꼬리를 본다.

### ③ DC 오차

각 슬레이브의 시스템 시각 차이 레지스터(`0x092C`)를 읽으면 실제 동기 품질이 나온다. 이 값이 수백 ns 이하로 작고 안정적이어야 한다.

### ④ GPIO 토글, 가장 확실하다

```cpp
void cyclic_loop() {
    while (running) {
        gpio_set(kDebugPin);              // 사이클 시작
        ec_send_processdata();
        ec_receive_processdata(EC_TIMEOUTRET);
        run_control_step();
        gpio_clear(kDebugPin);            // 사이클 끝
        sleep_until_next();
    }
}
```

오실로스코프로 이 핀을 보면 주기와 실행 시간이 눈에 보인다. 소프트웨어 측정이 놓치는 것(측정 코드 자체의 오버헤드, 인터럽트 중첩)까지 잡힌다. persistence 모드로 몇 분 걸어두면 지터가 그림으로 나타난다. 히스토그램의 시각적 버전이다.

## 5. 지터가 큰 원인 찾기

| 원인 | 확인 | 대응 |
| --- | --- | --- |
| 일반 커널 | `uname -a` | PREEMPT_RT |
| CPU 격리 안 됨 | `cat /proc/cmdline` | `isolcpus` |
| 우선순위 낮음 | `chrt -p <pid>` | `SCHED_FIFO` |
| 페이지 폴트 | `/proc/<pid>/stat` 의 폴트 수 | `mlockall` |
| 실시간 경로에서 동적 할당 | 코드 리뷰 | 사전 할당 |
| 실시간 경로에서 로깅 | 코드 리뷰 | 링 버퍼에 넣고 다른 스레드가 출력 |
| 인터럽트 병합 | `ethtool -c eth1` | `ethtool -C eth1 rx-usecs 0` |
| 전원 관리 (C-state) | `cpupower idle-info` | `intel_idle.max_cstate=1` |
| 주파수 스케일링 | `cpupower frequency-info` | performance governor |
| SMI | `hwlatdetect` | BIOS 설정. 끄기 어려울 수 있다 |
| 하이퍼스레딩 | `lscpu` | 형제 코어를 격리하거나 끈다 |

실시간 경로에서 로깅하는 것이 초보자의 최다 실수다. `printf` 하나가 수백 µs를 먹고 파일 I/O면 훨씬 더하다. 로그는 링 버퍼에 넣고 다른 스레드가 꺼내 쓴다. [시리얼 11편](/posts/11-mcu-uart-driver-ringbuffer-dma/)의 SPSC 링 버퍼를 그대로 쓸 수 있다.

`hwlatdetect` 로 SMI를 잡아본다. BIOS나 펌웨어가 몰래 CPU를 훔치는 경우가 있는데 소프트웨어로는 못 막는다. 산업용 PC를 고를 때 확인할 항목이다.

## 6. 사이클 시간을 정하는 법

빠를수록 좋은 게 아니다. 기초 10편의 지연 예산에서 나온다.

1. 제어 대역폭 $\omega_c$ 를 정한다 (제어 설계)
2. 총 지연 예산 $\tau \lesssim 0.3/\omega_c$ 를 계산한다
3. 그중 통신과 샘플링 몫을 배분한다. ZOH 지연 $T_s/2$ 가 대개 가장 크고, EtherCAT 왕복과 드라이브 내부 처리가 따른다
4. $T_s$ 를 정한다
5. 마스터가 그 $T_s$ 를 지킬 수 있는지 확인한다 (cyclictest 최댓값 + 실행 시간)
6. 못 지키면 $T_s$ 를 늘리거나 시스템을 튜닝한다

### 예제

목표가 제어 대역폭 200 rad/s(약 32 Hz)라고 하자.

| 항목 | |
| --- | --- |
| 지연 예산 | $0.3 / 200 = 1.5\ \text{ms}$ |
| ZOH ($T_s/2$), $T_s = 1$ ms | 500 µs |
| EtherCAT 왕복 | 25 µs |
| 드라이브 내부 | 200 µs |
| 마스터 지터 (최악) | 50 µs |
| 제어 연산 | 300 µs |
| 합계 | 1075 µs, 예산 안 |

1 kHz면 충분하다. 사이클을 100 µs로 줄여도 ZOH가 50 µs로 줄 뿐 나머지는 그대로라 이득이 작다. 그런데 대역폭을 500 rad/s로 올리려면 예산이 600 µs가 되어 $T_s$ 를 줄여야 한다. 제어 목표가 사이클 시간을 정한다.

| 사이클 | 마스터 요구 | 쓰이는 곳 |
| --- | --- | --- |
| 10 ms | 일반 커널로도 가능 | 저속 I/O, 모니터링 |
| 1 ms | PREEMPT_RT 권장 | 일반적인 로봇 제어 |
| 500 µs | PREEMPT_RT + 튜닝 | 고성능 서보 |
| 250 µs | 잘 튜닝된 RT 시스템 | 고속 다축 |
| 100 µs 이하 | 전용 하드웨어 마스터나 커널 모듈 | 특수 용도 |

## 7. 체크리스트

- PREEMPT_RT 커널인가 (`uname -a`)
- `isolcpus` 와 `nohz_full` 이 설정됐나 (`/proc/cmdline`)
- 제어 스레드가 `SCHED_FIFO` 이고 격리 CPU에 고정됐나
- `mlockall` 이 성공하나
- 실시간 경로에 동적 할당, 로깅, 락이 없나
- NIC 인터럽트 병합을 껐나 (`ethtool -c`)
- NIC이 EtherCAT 전용인가 (IP 주소 없음)
- CPU 주파수 governor가 performance인가
- C-state를 제한했나
- cyclictest 최댓값이 목표 사이클의 10% 이내인가
- 애플리케이션 지터 히스토그램의 꼬리를 확인했나
- DC 오차(`0x092C`)가 수백 ns 이하로 안정한가
- GPIO와 오실로스코프로 실측했나
- 부하를 준 상태에서 측정했나
- 장시간(수 시간) 돌려서 이상값이 없나

마지막 두 항목이 자주 생략된다. 시스템이 놀 때 5분 운용해본 결과는 아무 보장이 안 된다.

## 정리

- 병목은 네트워크 25 µs가 아니라 마스터 소프트웨어다. EtherCAT가 다른 불확정성을 다 제거했기 때문이다
- 지터가 shift 여유를 소비하면 옛 값으로 동작하고 사이클을 놓치면 SM 워치독이 SAFEOP로 떨군다
- "가끔 OP에서 SAFEOP로 떨어진다" 의 1순위가 마스터 지터다 (`0x001A`)
- 튜닝 효과 순: PREEMPT_RT, CPU 격리, `SCHED_FIFO` + `mlockall` + CPU 고정, 루프 구조
- `clock_nanosleep` 과 `TIMER_ABSTIME` 을 쓴다. 상대 sleep은 오차가 누적된다
- `SCHED_FIFO` 우선순위 99는 쓰지 않는다. 커널 워커보다 높아지면 시스템이 멎는다
- 측정 네 가지: cyclictest, 애플리케이션 지터 히스토그램, DC 오차, GPIO와 오실로스코프. 평균이 아니라 최댓값과 꼬리를 본다
- 지터의 흔한 원인은 실시간 경로의 로깅과 동적 할당, 인터럽트 병합, C-state, SMI다
- 로그는 링 버퍼에 넣고 다른 스레드가 출력한다
- 사이클 시간은 제어 대역폭이 정한다. ZOH($T_s/2$)가 대개 가장 큰 항목이다
- 200 rad/s 대역폭이면 1 kHz로 충분하다. 사이클을 더 줄여도 ZOH만 줄 뿐 이득이 작다
- 부하를 준 상태에서 장시간 측정한다

## 참고

- [Linux Foundation — PREEMPT_RT](https://wiki.linuxfoundation.org/realtime/start)
- [SOEM — Simple Open EtherCAT Master](https://github.com/OpenEtherCATsociety/SOEM)
