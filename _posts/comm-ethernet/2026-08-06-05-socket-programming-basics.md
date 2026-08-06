---
title: 05. 소켓 프로그래밍 기초 (C++)
date: 2026-08-06 11:05:00 +0900
description: UDP 소켓의 필수 옵션 셋, 제어 루프에서 sendto를 부르지 않는 구조, SO_TIMESTAMPING으로 지연을 층별로 분해하기.
categories: [로봇 통신, 이더넷]
tags: [통신, 이더넷, UDP, 소켓, C++, 실시간, raw소켓]
---

> **기준 출처:** POSIX `socket(2)`, `bind(2)`, `sendto(2)`, `recvfrom(2)`, `setsockopt(2)` · Linux `socket(7)`, `udp(7)`, `packet(7)` · [Linux SO_TIMESTAMPING 문서](https://www.kernel.org/doc/html/latest/networking/timestamping.html) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [04. 표준 이더넷이 실시간에 안 맞는 이유](/posts/04-why-ethernet-not-realtime/)

## 1. 무엇을 만드나

04편의 결론대로 제어 루프는 EtherCAT로 하고, 이더넷 소켓은 이런 데 쓴다.

| 용도 | 프로토콜 |
| --- | --- |
| 텔레메트리 송출 (제어 상태를 PC로) | UDP |
| 명령 수신 (조작 UI에서 로봇으로) | UDP + 시퀀스 |
| 설정과 펌웨어 | TCP |
| ROS 2 노드 간 | DDS (내부적으로 UDP) |

이 편은 UDP 텔레메트리를 예로 만든다. 그리고 EtherCAT 마스터가 쓰는 raw 소켓도 마지막에 본다.

## 2. UDP 소켓의 기본 골격

```cpp
// comm_ros/udp_socket.hpp
#pragma once
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <fcntl.h>
#include <span>
#include <cstdint>
#include <optional>

class UdpSocket {
public:
    ~UdpSocket() { close(); }
    UdpSocket() = default;
    UdpSocket(const UdpSocket&) = delete;
    UdpSocket& operator=(const UdpSocket&) = delete;

    bool open_tx(const char* dest_ip, std::uint16_t dest_port) {
        fd_ = ::socket(AF_INET, SOCK_DGRAM, 0);
        if (fd_ < 0) return false;
        dest_.sin_family = AF_INET;
        dest_.sin_port   = ::htons(dest_port);   // 네트워크 바이트 순서 = big-endian
        if (::inet_pton(AF_INET, dest_ip, &dest_.sin_addr) != 1) return false;
        return set_common_options();
    }

    bool open_rx(std::uint16_t port, std::size_t rx_buf_bytes = 1 << 20) {
        fd_ = ::socket(AF_INET, SOCK_DGRAM, 0);
        if (fd_ < 0) return false;

        // 재시작 시 "Address already in use" 를 피한다
        int one = 1;
        ::setsockopt(fd_, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

        // 수신 버퍼를 키워 버스트를 흡수한다
        int bufsz = static_cast<int>(rx_buf_bytes);
        ::setsockopt(fd_, SOL_SOCKET, SO_RCVBUF, &bufsz, sizeof(bufsz));

        sockaddr_in addr{};
        addr.sin_family      = AF_INET;
        addr.sin_addr.s_addr = ::htonl(INADDR_ANY);
        addr.sin_port        = ::htons(port);
        if (::bind(fd_, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0)
            return false;
        return set_common_options();
    }

    bool send(std::span<const std::uint8_t> data) {
        return ::sendto(fd_, data.data(), data.size(), 0,
                        reinterpret_cast<sockaddr*>(&dest_), sizeof(dest_))
               == static_cast<ssize_t>(data.size());
    }

    // 논블로킹 수신, 없으면 nullopt
    std::optional<std::size_t> recv(std::span<std::uint8_t> out) {
        const auto n = ::recvfrom(fd_, out.data(), out.size(), 0, nullptr, nullptr);
        if (n < 0) return std::nullopt;   // EAGAIN 포함
        return static_cast<std::size_t>(n);
    }

    void close() { if (fd_ >= 0) { ::close(fd_); fd_ = -1; } }

private:
    bool set_common_options() {
        // 논블로킹. 제어 루프가 소켓에서 막히면 안 된다
        const int flags = ::fcntl(fd_, F_GETFL, 0);
        if (::fcntl(fd_, F_SETFL, flags | O_NONBLOCK) < 0) return false;
        return true;
    }

    int fd_{-1};
    sockaddr_in dest_{};
};
```

### 세 가지 옵션

| 옵션 | 왜 |
| --- | --- |
| `O_NONBLOCK` | 제어 루프가 소켓에서 블로킹되면 주기가 깨진다 |
| `SO_RCVBUF` | 버스트를 흡수한다. 안 키우면 조용히 드롭된다 |
| `SO_REUSEADDR` | 재시작 편의 |

`SO_RCVBUF` 를 키워도 커널 상한이 있다. `sysctl net.core.rmem_max` 를 먼저 올려야 요청이 반영된다. 그리고 `getsockopt` 로 실제로 설정된 값을 확인한다. Linux는 요청값의 2배를 보고한다.

## 3. 텔레메트리 송신과 제어 루프의 결합

```cpp
// comm_ros/telemetry_publisher.hpp
// 제어 루프(1 kHz)에서 직접 send() 를 부르지 않는다.
// 소켓 호출이 언제 얼마나 걸릴지 모르기 때문이다.
class TelemetryPublisher {
public:
    // 제어 루프에서 호출. 절대 막히지 않는다
    void publish(const RobotState& s) { latest_.publish(s); }

    // 별도 저우선순위 스레드에서 호출 (예: 100 Hz)
    void pump(std::uint64_t now_ns) {
        const auto s = latest_.read();
        if (latest_.updates() == last_seen_updates_) return;   // 새 값 없음
        last_seen_updates_ = latest_.updates();

        std::array<std::uint8_t, 512> buf{};
        TelemetryHeader h{
            .magic = 0x54454C45, .version = 1,
            .payload_len = serialize(s, {buf.data() + kTelemetryHeaderBytes,
                                         buf.size()  - kTelemetryHeaderBytes}),
            .sequence = seq_++, .timestamp_ns = now_ns };
        write_header(buf.data(), h);
        if (!sock_.send({buf.data(), kTelemetryHeaderBytes + h.payload_len}))
            ++send_failures_;   // 세어둔다
    }

private:
    LatestValue<RobotState> latest_;   // 기초 08편의 3버퍼
    UdpSocket     sock_;
    std::uint32_t seq_{}, send_failures_{}, last_seen_updates_{};
};
```

구조를 이렇게 나눈다. 제어 루프는 `publish()` 만 부르고 락 없이 막히지 않고 ns 단위로 끝난다. 네트워크는 별도 저우선순위 스레드가 처리한다. 둘 사이는 [기초 08편](/posts/08-basics-flow-control/)의 3버퍼로 연결한다.

제어 루프에서 직접 `sendto()` 를 부르면 커널 진입, 큐잉, 버퍼 할당이 예측 불가한 시간을 소비한다. 평소엔 5 µs인데 가끔 500 µs가 나온다.

## 4. 지연을 실제로 재기

04편에서 반드시 측정한다고 했다. Linux는 커널과 하드웨어 타임스탬프를 제공한다.

```cpp
// 수신 시각을 커널(또는 NIC)이 찍어준다.
// 애플리케이션 스케줄링 지연을 분리할 수 있다.
bool enable_rx_timestamps(int fd) {
    int flags = SOF_TIMESTAMPING_RX_HARDWARE   // NIC이 찍는다 (지원하면)
              | SOF_TIMESTAMPING_RX_SOFTWARE   // 커널이 찍는다
              | SOF_TIMESTAMPING_SOFTWARE
              | SOF_TIMESTAMPING_RAW_HARDWARE;
    return ::setsockopt(fd, SOL_SOCKET, SO_TIMESTAMPING,
                        &flags, sizeof(flags)) == 0;
}

// recvmsg 의 control message 로 타임스탬프가 온다
std::optional<std::uint64_t> extract_rx_timestamp_ns(msghdr& msg) {
    for (cmsghdr* c = CMSG_FIRSTHDR(&msg); c; c = CMSG_NXTHDR(&msg, c)) {
        if (c->cmsg_level == SOL_SOCKET && c->cmsg_type == SO_TIMESTAMPING) {
            const auto* ts = reinterpret_cast<const timespec*>(CMSG_DATA(c));
            // ts[0]=소프트웨어, ts[2]=하드웨어(raw)
            const auto& t = (ts[2].tv_sec || ts[2].tv_nsec) ? ts[2] : ts[0];
            return static_cast<std::uint64_t>(t.tv_sec) * 1'000'000'000ull
                   + t.tv_nsec;
        }
    }
    return std::nullopt;
}
```

이게 있으면 지연을 층별로 분해할 수 있다.

| 구간 | 계산 |
| --- | --- |
| 네트워크 지연 | 송신 타임스탬프에서 수신 하드웨어 타임스탬프까지 |
| 커널 처리 | 수신 하드웨어에서 수신 소프트웨어 타임스탬프까지 |
| 애플리케이션 스케줄링 | 수신 소프트웨어에서 `recvmsg` 가 돌아온 시각까지 |

04편에서 "OS 스케줄링이 대개 가장 크다" 고 했는데 이 방법으로 그걸 증명할 수 있다. 추측이 아니라 숫자로.

## 5. 실시간 튜닝 체크리스트

04편 §6을 코드와 명령으로 옮긴 것이다.

```cpp
// ① 메모리 잠금, 페이지 폴트 제거
#include <sys/mman.h>
if (::mlockall(MCL_CURRENT | MCL_FUTURE) != 0) log_warn("mlockall 실패");

// ② 실시간 우선순위
#include <pthread.h>
sched_param sp{}; sp.sched_priority = 80;
::pthread_setschedparam(::pthread_self(), SCHED_FIFO, &sp);

// ③ CPU 고정
cpu_set_t set; CPU_ZERO(&set); CPU_SET(3, &set);
::pthread_setaffinity_np(::pthread_self(), sizeof(set), &set);
```

```bash
# ④ CPU 격리 (커널 부팅 파라미터)
isolcpus=3 nohz_full=3 rcu_nocbs=3

# ⑤ 인터럽트 병합 끄기
sudo ethtool -C eth0 rx-usecs 0 rx-frames 1

# ⑥ 오프로드 끄기 (프레임을 모으거나 쪼개는 기능)
sudo ethtool -K eth0 gro off gso off tso off

# ⑦ 소켓 버퍼 상한 올리기
sudo sysctl -w net.core.rmem_max=8388608

# ⑧ 지연 측정
sudo cyclictest -m -p 99 -i 1000 -l 3600000 -h 400
```

②③④를 안 하면 나머지가 무의미하다. OS 스케줄링이 가장 큰 항목이기 때문이다.

`SCHED_FIFO` 우선순위 99는 쓰지 않는다. 커널의 일부 워커보다 높아져서 시스템이 멎을 수 있다. 80에서 90 정도로 잡는다.

## 6. Raw 소켓

EtherCAT 마스터는 IP도 UDP도 쓰지 않는다. EtherType `0x88A4` 프레임을 직접 보내야 하므로 raw 소켓을 쓴다.

```cpp
int open_raw_ethercat_socket(const char* ifname) {
    // AF_PACKET + SOCK_RAW = 이더넷 프레임을 통째로 다룬다
    int fd = ::socket(AF_PACKET, SOCK_RAW, ::htons(ETH_P_ALL));
    if (fd < 0) return -1;   // CAP_NET_RAW 권한 필요

    ifreq ifr{};
    std::strncpy(ifr.ifr_name, ifname, IFNAMSIZ - 1);
    ::ioctl(fd, SIOCGIFINDEX, &ifr);

    sockaddr_ll sll{};
    sll.sll_family   = AF_PACKET;
    sll.sll_ifindex  = ifr.ifr_ifindex;
    sll.sll_protocol = ::htons(0x88A4);   // EtherCAT EtherType (01편)
    ::bind(fd, reinterpret_cast<sockaddr*>(&sll), sizeof(sll));

    return fd;
}
```

여기서 보내는 것은 이더넷 프레임 전체다. 목적지 MAC부터 직접 채운다. 커널의 IP 스택을 전혀 안 거치므로 03편의 TCP/IP 지연이 통째로 사라진다.

권한이 필요하다. root로 돌리거나 `sudo setcap cap_net_raw,cap_net_admin+eip ./my_master` 로 능력만 준다. 후자가 안전하다. 그리고 그 NIC는 EtherCAT 전용이어야 한다. 일반 트래픽이 섞이면 타이밍이 깨진다. 04편에서 말한 NIC 2개 구성의 이유다.

## 7. 이더넷 폴더를 마치며

[기초 01편](/posts/01-basics-what-comm-solves/)의 여섯 칸을 이더넷으로 채우면 이렇다.

| | 표준 이더넷 + UDP |
| --- | --- |
| ① 도달 | 100BASE-TX, 세그먼트 100 m, 트랜스포머 절연 |
| ② 동기 | PHY의 PLL 클럭 복원 (4B/5B) |
| ③ 경계 | 프리앰블 + SFD + 길이/EtherType |
| ④ 무결 | CRC-32 (FCS) + UDP 체크섬 |
| ⑤ 조정 | 스위치가 큐로 처리한다. 결정적이지 않다 |
| ⑥ 시간 | 상한이 없다 |

①에서 ④까지는 훌륭하다. 물리계층은 성숙했고 CRC-32는 강력하다. ⑤와 ⑥이 문제인데 그건 이더넷이 범용 네트워크로 설계됐기 때문이지 결함이 아니다.

EtherCAT는 ①에서 ④를 그대로 물려받고 ⑤⑥만 다시 만든다. 그게 다음 폴더의 이야기다.

## 정리

- 이더넷 소켓의 자리는 텔레메트리, 설정, 진단이다. 제어 루프는 아니다
- UDP 소켓 필수 옵션 셋: `O_NONBLOCK`, `SO_RCVBUF`, `SO_REUSEADDR`
- `SO_RCVBUF` 는 `net.core.rmem_max` 상한에 걸린다. 실제 설정값을 `getsockopt` 로 확인한다
- 제어 루프에서 직접 `sendto()` 를 부르지 않는다. 3버퍼로 넘기고 별도 저우선순위 스레드가 보낸다
- `SO_TIMESTAMPING` 으로 지연을 네트워크, 커널, 애플리케이션 스케줄링으로 분해할 수 있다
- 실시간 튜닝은 `mlockall`, `SCHED_FIFO`(80~90, 99 금지), CPU 고정, `isolcpus`, 인터럽트 병합과 오프로드 끄기
- Raw 소켓(`AF_PACKET`)이 EtherCAT 마스터의 통로다. EtherType `0x88A4` 로 커널 IP 스택을 통째로 건너뛴다
- 이더넷은 여섯 칸 중 ①에서 ④가 훌륭하고 ⑤⑥이 없다. EtherCAT는 앞을 물려받고 뒤를 다시 만든다

## 참고

- [Linux 커널 — SO_TIMESTAMPING 문서](https://www.kernel.org/doc/html/latest/networking/timestamping.html)
- [Linux packet(7) 매뉴얼](https://man7.org/linux/man-pages/man7/packet.7.html)
- [Linux socket(7) 매뉴얼](https://man7.org/linux/man-pages/man7/socket.7.html)
