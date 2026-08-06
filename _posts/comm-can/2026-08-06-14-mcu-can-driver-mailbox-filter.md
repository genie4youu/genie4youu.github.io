---
title: 14. MCU CAN 드라이버 — 메일박스, 필터, 마스크
date: 2026-08-06 10:14:00 +0900
description: 송신 메일박스가 우선순위 역전을 만든다. 그리고 수신 필터는 성능 최적화가 아니라 안전 설계의 일부다.
categories: [로봇 통신, CAN]
tags: [통신, can, socketcan, 필터, 드라이버, cpp]
mermaid: true
math: true
---

> **기준 출처:** MCU 레퍼런스 매뉴얼의 CAN 절(ST RM0090 §32 bxCAN 은 송신 메일박스 3개, 수신 FIFO 2개, 필터 뱅크 28개다), Linux SocketCAN 커널 문서, can-utils 소스 / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [13. CiA 402 드라이브 FSM](/posts/13-cia402-drive-state-machine/) | 다음 → [15. CAN 디버깅](/posts/15-can-debugging-busload/)

---

## 1. 컨트롤러가 하는 일과 소프트웨어가 하는 일

| 하드웨어인 CAN 컨트롤러 | 소프트웨어 |
| --- | --- |
| 비트 타이밍과 동기 | 비트 타이밍 설정 |
| 중재 | ID 배정 설계 |
| 5중 오류 검출 | 오류 카운터 감시 |
| 오류 FSM | Bus Off 복구 정책 |
| 자동 재전송 | one-shot 여부 결정 |
| ID 필터링 | 필터 설계 |
| 프레임 조립과 CRC | 데이터 직렬화 |

소프트웨어가 실제로 하는 일은 설정과 정책이다. 프로토콜 자체는 하드웨어가 다 한다. 그래서 설정을 틀리면 조용히 이상하게 동작한다.

## 2. 송신 메일박스가 우선순위 역전을 만든다

대부분의 CAN 컨트롤러는 송신 메일박스가 3개 정도다. 소프트웨어 송신 큐에 수십 개가 있어도 하드웨어 메일박스는 3개뿐이고 거기서 버스 중재로 나간다.

낮은 우선순위 메시지 3개가 메일박스를 다 채운 상태에서 최우선 메시지인 E-stop 을 보내고 싶어지면 메일박스가 없어 앞의 것들이 나갈 때까지 기다려야 한다.

[10편](/posts/10-can-bandwidth-worst-case/)에서 계산한 최악 응답 시간이 이것 때문에 무너진다. 계산은 보내고 싶으면 즉시 중재에 참여한다를 가정하는데 실제로는 메일박스가 비어야 참여한다.

| 방법 | 설명 |
| --- | --- |
| 우선순위 기반 소프트웨어 큐 | 메일박스에 넣기 전에 소프트웨어에서 정렬한다. 가장 급한 것이 먼저 메일박스로 간다 |
| 메일박스 하나를 예약한다 | 안전 메시지 전용으로 하나를 비워둔다 |
| 송신 중단 기능을 쓴다 | 급한 게 왔을 때 메일박스의 낮은 우선순위 프레임을 취소한다. 컨트롤러가 지원해야 한다 |

```cpp
// comm_can/tx_queue.hpp
// 우선순위 큐에 안전 메시지 전용 메일박스 예약을 더한다
class CanTxQueue {
public:
    bool push(const CanFrame& f) {
        if (queue_.size() >= kMaxDepth) { ++dropped_; return false; }
        queue_.push(f);                       // id 가 작을수록 앞에 온다
        return true;
    }

    // 주기적으로 또는 송신 완료 인터럽트에서 호출한다
    void pump() {
        while (!queue_.empty()) {
            const auto& f = queue_.top();
            // 메일박스 0 은 긴급 메시지 전용으로 남긴다
            const bool is_urgent = (f.id <= kUrgentIdMax);
            const int mb = driver_.free_mailbox(is_urgent ? 0 : 1);
            if (mb < 0) break;                                        // 자리가 없다
            driver_.transmit(mb, f);
            queue_.pop();
        }
        // 큐 깊이 최대치를 남긴다. 설계 여유를 확인하는 지표다
        peak_depth_ = std::max(peak_depth_, queue_.size());
    }

private:
    static constexpr std::uint32_t kUrgentIdMax = 0x00F;   // 안전 대역이다
    static constexpr std::size_t   kMaxDepth    = 32;
    std::priority_queue<CanFrame, std::vector<CanFrame>, LowerIdFirst> queue_;
    ICanDriver&   driver_;
    std::size_t   peak_depth_{};
    std::uint32_t dropped_{};
};
```

`peak_depth_` 와 `dropped_` 를 감시한다. 큐가 자주 깊어지면 버스 부하가 설계보다 높다는 뜻이고 10편의 계산을 다시 해야 한다.

## 3. 수신 필터가 CPU 를 아낀다

CAN 은 방송이다. 필터가 없으면 버스의 모든 프레임에 인터럽트가 걸린다. 500 kbps 에서 부하율 50% 면 초당 약 1850 프레임이다. 인터럽트당 3 µs 면 CPU 의 0.55% 에 지터 1850회다. 관심 없는 프레임이 대부분이라면 순수한 낭비다.

컨트롤러가 하드웨어로 걸러준다. 수신한 ID 와 마스크를 AND 한 값이 필터 ID 와 마스크를 AND 한 값과 같으면 통과한다. 마스크의 비트가 1 이면 반드시 일치해야 하고 0 이면 무시한다.

| 필터 ID | 마스크 | 통과하는 것 |
| --- | --- | --- |
| `0x180` | `0x7FF` | `0x180` 하나만 |
| `0x180` | `0x780` | `0x180` 부터 `0x19F` 까지다. 하위 7비트를 무시하니 노드 1~31 의 TPDO1 이다 |
| `0x000` | `0x000` | 전부다. 필터가 없는 것과 같다 |
| `0x080` | `0x780` | `0x080` 부터 `0x09F` 까지로 SYNC 와 모든 노드의 EMCY 다 |

[11편](/posts/11-canopen-od-nmt/)의 COB-ID 구조인 기능 코드 4비트와 Node ID 7비트가 마스크 필터와 궁합이 완벽하다. 마스크 `0x780` 은 기능 코드만 보고 노드는 무시한다는 뜻이라 모든 노드의 TPDO1 을 필터 하나로 잡을 수 있다. CANopen 이 이 ID 구조를 택한 이유 중 하나가 하드웨어 필터 효율이다.

```cpp
// comm_can/can_filter.hpp
struct CanFilter {
    std::uint32_t id;
    std::uint32_t mask;
    bool          extended{false};
    std::uint8_t  fifo{0};      // 컨트롤러가 FIFO 를 여러 개 주면 나눈다

    constexpr bool accepts(std::uint32_t rx_id) const {
        return (rx_id & mask) == (id & mask);
    }
};

// 6축 로봇 마스터의 필터 설계 예다
inline constexpr CanFilter kFilters[] = {
    // 긴급과 안전은 전용 FIFO 로 분리해 우선 처리한다
    { .id = 0x000, .mask = 0x7F0, .fifo = 0 },   // NMT 와 안전
    { .id = 0x080, .mask = 0x780, .fifo = 0 },   // SYNC 와 모든 EMCY

    // 주기 데이터는 별도 FIFO 로 받는다
    { .id = 0x180, .mask = 0x780, .fifo = 1 },   // 모든 노드의 TPDO1
    { .id = 0x280, .mask = 0x780, .fifo = 1 },   // 모든 노드의 TPDO2

    // 비주기
    { .id = 0x580, .mask = 0x780, .fifo = 1 },   // SDO 응답
    { .id = 0x700, .mask = 0x780, .fifo = 1 },   // 하트비트
};

static_assert(kFilters[2].accepts(0x181));
static_assert(kFilters[2].accepts(0x186));
static_assert(!kFilters[2].accepts(0x201));
```

FIFO 를 나누는 게 중요하다. 긴급 메시지를 별도 FIFO 에 받고 그 FIFO 의 인터럽트 우선순위를 높게 주면 주기 데이터가 몰려도 안전 메시지가 밀리지 않는다. 필터를 안 걸면 안전 메시지가 데이터 홍수에 묻힌다. 하드웨어 필터는 성능 최적화가 아니라 안전 설계의 일부다.

필터 뱅크는 유한하다. STM32 bxCAN 은 28개이고 듀얼 CAN 이면 나눠 쓴다. 다른 MCU 도 십수 개 수준이다. 모든 ID 를 개별 필터로 잡으려 하면 모자라니 마스크로 묶는 설계가 필수다.

## 4. 수신 FIFO 와 오버런

FIFO 깊이가 3 이면 소프트웨어가 3 프레임 시간 안에 비워야 한다. 500 kbps 에 8바이트 프레임이 270 µs 이니 810 µs 안에 처리해야 한다.

넘치면 FIFO Overrun 이 나고 프레임이 조용히 버려진다. [시리얼 08편](/posts/08-serial-errors-framing-overrun/)의 UART Overrun 과 같은 성격이고 마찬가지로 소프트웨어 문제다. ISR 은 FIFO 에서 링 버퍼로 옮기기만 하고 파싱은 밖에서 한다.

```cpp
// ISR 은 짧게 두고 FIFO 를 비우기만 한다
void can_rx_fifo0_isr() {
    while (driver_.fifo_pending(0)) {
        CanFrame f;
        driver_.fifo_read(0, f);
        if (!rx_ring_.push(f)) ++stats_.rx_dropped;   // 링 버퍼가 찼다
    }
}
```

## 5. one-shot 모드로 자동 재전송을 끈다

[08편](/posts/08-can-error-states-busoff/)에서 본 문제다. 주기 데이터에는 자동 재전송이 오히려 방해다.

| | 자동 재전송 (기본) | one-shot |
| --- | --- | --- |
| 오류 시 | 성공할 때까지 재시도한다 | 한 번만 시도하고 버린다 |
| 지연 | 예측이 어려워진다 | 결정적이다 |
| 낡은 데이터 | 계속 재전송된다 | 다음 주기 값으로 대체된다 |
| 적합한 대상 | SDO 와 설정과 이벤트 | 주기 PDO |

[기초 08편](/posts/08-basics-flow-control/)의 원칙 그대로다. 제어 데이터는 상태이므로 낡은 값을 살리는 것보다 새 값을 보내는 게 낫다. STM32 bxCAN 은 NART 비트로 제어하고 다른 MCU 도 비슷한 이름이 있다.

one-shot 이 채널 전체 설정인 경우가 많다는 데 주의한다. PDO 만 one-shot 으로 하고 SDO 는 재전송하고 싶으면 컨트롤러가 메일박스별 설정을 지원하는지 확인한다. 안 되면 소프트웨어 재시도로 보완한다.

## 6. Linux SocketCAN

호스트에서는 CAN 을 소켓으로 다룬다. 이게 표준이다.

```bash
# 인터페이스 설정. 비트레이트와 샘플 포인트를 준다
sudo ip link set can0 type can bitrate 500000 sample-point 0.875
sudo ip link set can0 up

# CAN FD
sudo ip link set can0 type can bitrate 500000 dbitrate 2000000 fd on

# 오류 프레임도 받는다. 진단에 필수다
sudo ip link set can0 type can berr-reporting on

# 확인
ip -details -statistics link show can0
```

```cpp
// comm_can/socketcan_bus.cpp
#include <linux/can.h>
#include <linux/can/raw.h>
#include <sys/socket.h>
#include <net/if.h>
#include <sys/ioctl.h>

bool SocketCanBus::open(const std::string& iface, std::span<const CanFilter> filters) {
    fd_ = ::socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (fd_ < 0) return false;

    ifreq ifr{};
    std::strncpy(ifr.ifr_name, iface.c_str(), IFNAMSIZ - 1);
    if (::ioctl(fd_, SIOCGIFINDEX, &ifr) < 0) return false;

    sockaddr_can addr{};
    addr.can_family  = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    if (::bind(fd_, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) return false;

    // 커널 레벨 필터다. 하드웨어 필터와 같은 효과를 소프트웨어로 낸다
    std::vector<can_filter> kf;
    for (const auto& f : filters) kf.push_back({f.id, f.mask});
    ::setsockopt(fd_, SOL_CAN_RAW, CAN_RAW_FILTER, kf.data(),
                 static_cast<socklen_t>(kf.size() * sizeof(can_filter)));

    // 오류 프레임을 받는다. 07편과 08편의 진단이 여기로 온다
    const can_err_mask_t err_mask = CAN_ERR_MASK;
    ::setsockopt(fd_, SOL_CAN_RAW, CAN_RAW_ERR_FILTER, &err_mask, sizeof(err_mask));

    return true;
}

// 오류 프레임 해석이다. 07편과 08편의 정보가 여기 들어 있다
void SocketCanBus::handle_error_frame(const can_frame& f) {
    if (f.can_id & CAN_ERR_BUSOFF) { ++stats_.bus_off_count; }
    if (f.can_id & CAN_ERR_CRTL) {
        if (f.data[1] & CAN_ERR_CRTL_TX_PASSIVE) state_ = CanState::ErrorPassive;
    }
    if (f.can_id & CAN_ERR_PROT) {
        if (f.data[2] & CAN_ERR_PROT_BIT)   ++stats_.bit_error;
        if (f.data[2] & CAN_ERR_PROT_STUFF) ++stats_.stuff_error;
        if (f.data[2] & CAN_ERR_PROT_FORM)  ++stats_.form_error;
    }
    stats_.tx_error_counter = f.data[6];
    stats_.rx_error_counter = f.data[7];
}
```

`berr-reporting on` 을 켜야 오류 종류별 정보가 온다. [07편](/posts/07-can-error-detection/)에서 오류 종류별 카운터가 진단의 절반이라고 했는데 기본 설정에서는 그게 오지 않는다. 진단이 필요한 시스템에서는 반드시 켠다. 다만 오류가 많은 환경에서는 오류 프레임 자체가 부하가 되니 운영 중에는 주기적으로 통계만 읽는 방식도 고려한다.

가상 CAN 으로 하드웨어 없이 테스트할 수 있다.

```bash
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

CI 에서 CANopen 마스터 로직을 통째로 테스트할 수 있다. 슬레이브를 흉내내는 프로그램을 하나 띄우고 vcan0 으로 대화시키면 실제 드라이브 없이 CiA 402 시퀀스를 검증할 수 있다.

## 7. 드라이버 체크리스트

| # | 항목 |
| --- | --- |
| 1 | 비트 타이밍이 오실로스코프 실측으로 확인됐나 |
| 2 | 샘플 포인트가 모든 노드에서 같나 |
| 3 | 필터가 설계돼 있나. 관심 없는 프레임을 CPU 가 안 보나 |
| 4 | 안전 메시지가 별도 FIFO 에 높은 우선순위로 들어가나 |
| 5 | 송신 큐가 우선순위로 정렬돼 있나 |
| 6 | 주기 PDO 가 one-shot 인가 |
| 7 | Bus Off 자동 복구가 꺼져 있고 정책이 있나 |
| 8 | 오류 종류별 카운터를 세고 있나 |
| 9 | FIFO 와 링 버퍼 오버런 카운터가 0 인가 |
| 10 | ISR 에서 파싱을 안 하나 |

## 정리

- 소프트웨어가 하는 일은 설정과 정책이다. 프로토콜은 하드웨어가 하므로 설정을 틀리면 조용히 이상해진다.
- 송신 메일박스가 우선순위 역전을 만든다. 낮은 우선순위가 메일박스를 채우면 급한 것이 못 나간다.
- 대응은 우선순위 소프트웨어 큐와 안전용 메일박스 예약과 abort 기능이다.
- 10편의 최악 지연 계산이 이것 때문에 무너질 수 있다.
- 수신 필터는 성능이 아니라 안전 설계의 일부다. 안전 메시지가 데이터 홍수에 묻히면 안 된다.
- 마스크는 1 이 일치 필수이고 0 이 무시다. CANopen 의 COB-ID 구조가 마스크 필터와 궁합이 완벽하다.
- FIFO 를 나누고 긴급용 FIFO 의 인터럽트 우선순위를 높인다.
- 필터 뱅크는 유한하므로 마스크로 묶는 설계가 필수다.
- FIFO 깊이가 3 이면 500 kbps 에서 810 µs 안에 비워야 한다. ISR 은 옮기기만 한다.
- 주기 PDO 는 one-shot 으로 둔다. 낡은 값보다 새 값이 낫다.
- SocketCAN 은 `berr-reporting on` 을 켜야 오류 종류별 정보가 온다.
- vcan 으로 하드웨어 없이 CI 에서 CiA 402 시퀀스까지 검증할 수 있다.

## 참고

- [Linux SocketCAN 커널 문서](https://www.kernel.org/doc/html/latest/networking/can.html)
- [can-utils](https://github.com/linux-can/can-utils)
- [ST RM0090 — STM32F4 레퍼런스 매뉴얼](https://www.st.com/resource/en/reference_manual/dm00031020.pdf)
