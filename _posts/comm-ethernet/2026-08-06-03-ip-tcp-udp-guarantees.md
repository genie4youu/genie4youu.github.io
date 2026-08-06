---
title: 03. IP, TCP, UDP는 각각 무엇을 보장하나
date: 2026-08-06 11:03:00 +0900
description: TCP가 제어 루프에서 재앙인 다섯 가지 이유. 그리고 UDP의 "보장이 없다" 가 실시간에서 장점이 되는 지점.
categories: [로봇 통신, 이더넷]
tags: [통신, 이더넷, TCP, UDP, IP, 실시간, 재전송]
math: true
---

> **기준 출처:** RFC 791 · RFC 768 · RFC 9293 · RFC 896 · RFC 1122 · RFC 5681 · [Linux 커널 네트워킹 문서](https://www.kernel.org/doc/html/latest/networking/) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [02. 스위치와 큐](/posts/02-ethernet-switch-queue-delay/) | 다음 → [04. 표준 이더넷이 실시간에 안 맞는 이유](/posts/04-why-ethernet-not-realtime/)

## 1. 세 층이 각각 파는 것

| 계층 | 프로토콜 | 파는 것 | 가격 |
| --- | --- | --- | --- |
| 3 (네트워크) | IP | 다른 망까지 배달 | 헤더 20 B, 라우팅 지연, 단편화 |
| 4 (전송) | UDP | 포트 번호(다중화) + 체크섬 | 헤더 8 B |
| 4 (전송) | TCP | 신뢰성, 순서, 흐름 제어, 혼잡 제어 | 헤더 20 B + 재전송, 버퍼링, 지연 |

[기초 02편](/posts/02-basics-layers-osi-fieldbus/)에서 필드버스가 3·4 계층을 지운다고 했다. 이 편은 그때 무엇을 버리는지를 구체적으로 보는 것이다.

## 2. IP는 최선을 다하지만 보장은 없다

IPv4 헤더는 20바이트다. 버전/IHL, TOS, 총 길이, 식별자와 단편 오프셋, 플래그, TTL, 프로토콜 번호(6=TCP, 17=UDP), 헤더 체크섬, 출발지와 목적지 주소가 각 4바이트씩 들어간다.

| 안 보장하는 것 | 뜻 |
| --- | --- |
| 도착 | 라우터가 버려도 안 알려준다 |
| 순서 | 경로가 달라지면 뒤바뀐다 |
| 중복 없음 | 같은 패킷이 두 번 올 수 있다 |
| 무결성 | 헤더만 체크섬한다. 데이터는 안 본다 |

IPv4 헤더 체크섬은 헤더만 보호한다. 데이터 무결성은 상위(TCP/UDP 체크섬)와 하위(이더넷 FCS)가 맡는다. IPv6는 헤더 체크섬을 아예 없앴다.

### 단편화는 실시간에서 특히 나쁘다

MTU(보통 1500 B)보다 큰 패킷은 쪼개진다. 조각 하나만 잃어도 전체를 버리고, 재조립 버퍼가 타임아웃될 때까지 메모리를 잡는다. 제어 데이터는 MTU보다 작게 유지한다. 어차피 수십에서 수백 바이트라 문제될 일이 드물지만 로그나 파형 덤프에서는 조심한다.

## 3. UDP는 거의 아무것도 안 한다

헤더 8바이트에 출발 포트, 목적 포트, 길이, 체크섬이 전부다. UDP가 IP에 더하는 것은 두 가지뿐이다.

1. 포트 번호로 한 호스트 안의 여러 프로그램을 구분
2. 체크섬으로 헤더와 데이터를 보호 (IPv4에서는 선택, IPv6에서는 필수)

### 실시간에는 UDP가 낫다

| | 이유 |
| --- | --- |
| 재전송이 없다 | [기초 08편](/posts/08-basics-flow-control/)에서 본 대로 낡은 값을 살리지 않는다 |
| 버퍼링이 없다 | 보내면 바로 나간다. Nagle이 없다 |
| 순서 보장이 없다 | 오히려 좋다. head-of-line blocking이 없다 |
| 헤더가 작다 | 8 B |

"보장이 없다" 가 여기서는 장점이다. 제어 데이터는 상태이므로 최신값만 의미 있다는 원칙 때문이다.

필요한 신뢰성은 애플리케이션이 직접 만든다. 시퀀스 번호로 유실과 순서 뒤바뀜을 감지하고, 타임스탬프로 낡은 값을 폐기하고, 주기 전송으로 유실이 다음 주기에 복구되게 하고, 워치독으로 안 오는 걸 감지한다.

## 4. TCP가 제어에서 재앙인 다섯 가지 이유

TCP는 훌륭한 프로토콜이지만 제어 루프 안에서는 재앙이다. 하나씩 본다.

### ① 재전송과 head-of-line blocking

`[1][2][3][4][5]` 를 보냈는데 2번이 유실됐다고 하자. TCP는 순서를 보장해야 하므로 이미 도착한 `[3][4][5]` 를 애플리케이션에 주지 않는다. 2번 재전송을 기다린다. 최소 1 RTT, 최대 RTO다.

낡은 값 하나 때문에 새 값 셋이 막힌다. 그리고 RTO에는 최소값이 있다. Linux 기본 `TCP_RTO_MIN` 은 200 ms다. 1 kHz 루프에서 200주기다.

### ② Nagle 알고리즘 (RFC 896)

작은 데이터를 모아서 한 번에 보낸다. "미확인 데이터가 있으면 새 작은 데이터는 ACK이 올 때까지 버퍼에 모은다" 는 규칙이다.

제어 명령은 작다. 매 주기 20바이트를 보내면 Nagle이 그걸 모으고 지연이 RTT만큼 붙는다.

```cpp
// 반드시 끈다
int flag = 1;
::setsockopt(fd, IPPROTO_TCP, TCP_NODELAY, &flag, sizeof(flag));
```

### ③ Delayed ACK (RFC 1122)

받는 쪽이 ACK을 바로 안 보낸다. 다음 데이터에 얹어 보내려고 최대 200 ms 기다린다. Linux 기본은 더 짧지만 수십 ms다.

Nagle과 Delayed ACK이 만나면 최악이다. 송신자는 ACK이 와야 다음을 보내고(Nagle), 수신자는 데이터가 더 와야 ACK을 보낸다(Delayed ACK). 서로 기다리다가 수십에서 수백 ms의 지연이 갑자기 생긴다. 이 조합이 실시간 시스템에서 재현하기 어려운 지연의 고전적 원인이다.

### ④ 혼잡 제어

패킷 유실을 "네트워크가 혼잡하다" 로 해석하고 전송 속도를 줄인다. 제어망에서 유실은 노이즈이지 혼잡이 아니다. TCP는 그걸 구분 못 하고 속도를 줄여버리고, slow start로 천천히 회복한다.

### ⑤ 연결 관리

| 상황 | 지연 |
| --- | --- |
| 연결 수립 (3-way handshake) | 1.5 RTT |
| 연결이 끊긴 것을 감지 | keepalive 기본이 2시간 |
| 재연결 | 애플리케이션이 처리해야 |

케이블이 빠져도 TCP는 한동안 모른다. 데이터를 보내면 재전송을 반복하다가 결국 실패하는데 그때까지 수십 초가 걸릴 수 있다. `TCP_USER_TIMEOUT`, `TCP_KEEPIDLE`, `TCP_KEEPINTVL`, `TCP_KEEPCNT` 로 줄일 수 있지만 애초에 워치독을 애플리케이션에 두는 게 낫다.

## 5. 지연 비교

같은 20바이트 제어 명령을 보낼 때다. 100 Mbps, 전용 스위치 1단 기준이다.

| | UDP | TCP (정상) | TCP (유실 1회) |
| --- | --- | --- | --- |
| 프레임 크기 | 62 B → 64 B 패딩 | 74 B | |
| 전송 시간 | 6.7 µs | 6.9 µs | |
| 스위치 | ~7 µs | ~7 µs | |
| 프로토콜 지연 | 0 | Nagle 껐다면 0 | 최소 200 ms (RTO) |
| 합계 | ~14 µs | ~14 µs | 200 ms 이상 |

정상일 때는 TCP도 UDP만큼 빠르다. 문제는 유실이 한 번이라도 났을 때의 최악값이다. 실시간 시스템의 사양은 평균이 아니라 최악으로 쓴다. 그 기준에서 TCP는 200 ms짜리 프로토콜이다.

## 6. 무엇을 어디에 쓰나

| 용도 | 프로토콜 | 이유 |
| --- | --- | --- |
| 제어 루프 | 셋 다 아니다 | 다음 폴더의 EtherCAT |
| 텔레메트리와 모니터링 | UDP | 몇 개 잃어도 된다. 최신값이 중요 |
| 설정과 파라미터 | TCP | 확실히 도착해야 한다. 급하지 않다 |
| 펌웨어 업데이트 | TCP | 신뢰성이 전부 |
| 로그 수집 | UDP 또는 TCP | 잃어도 되면 UDP |
| 비상 정지 | 네트워크로 하지 않는다 | 하드와이어 또는 안전 통신(FSoE) |

마지막 줄이 중요하다. 안전 정지를 일반 이더넷으로 하면 안 된다. 지연 상한이 없고 유실을 감지하는 데 시간이 걸린다.

실무 구성은 이렇다. EtherCAT로 제어하고, 같은 케이블 위에 EoE(Ethernet over EtherCAT)로 TCP/IP를 터널링해서 설정과 진단을 한다. 물리 배선을 하나로 유지하면서 두 세계를 쓴다.

## 7. UDP로 텔레메트리를 보낼 때의 최소 규약

```cpp
// comm_ros/telemetry_packet.hpp
// UDP는 아무것도 보장하지 않으므로 필요한 만큼 직접 만든다.
struct TelemetryHeader {
    std::uint32_t magic;        // 0x54454C45 ('TELE') 잘못 온 패킷 걸러내기
    std::uint16_t version;
    std::uint16_t payload_len;
    std::uint32_t sequence;     // 유실과 순서 감지
    std::uint64_t timestamp_ns; // 낡은 값 폐기
};
inline constexpr std::size_t kTelemetryHeaderBytes = 20;

// 직렬화는 기초 09편의 명시적 방식으로. 구조체를 그대로 memcpy 하지 않는다.
inline void write_header(std::uint8_t* p, const TelemetryHeader& h) {
    put_u32_le(p +  0, h.magic);
    put_u16_le(p +  4, h.version);
    put_u16_le(p +  6, h.payload_len);
    put_u32_le(p +  8, h.sequence);
    put_u64_le(p + 12, h.timestamp_ns);
}

// 수신 측에서 유실률을 센다
class TelemetryReceiver {
public:
    void on_packet(const TelemetryHeader& h) {
        if (primed_) {
            const std::int64_t gap =
                static_cast<std::int64_t>(h.sequence) - last_seq_ - 1;
            if (gap > 0) lost_ += gap;      // 유실
            if (gap < 0) ++reordered_;      // 순서 뒤바뀜 또는 중복
        }
        primed_ = true; last_seq_ = h.sequence; ++received_;
    }
    double loss_rate() const {
        const auto total = received_ + lost_;
        return total ? static_cast<double>(lost_) / total : 0.0;
    }
private:
    std::uint32_t last_seq_{}, received_{}, lost_{}, reordered_{};
    bool primed_{false};
};
```

`sequence` 와 `timestamp` 만 있어도 UDP의 약점 대부분이 관리 가능해진다. 유실은 세면 되고(재전송하지 않는다), 순서가 뒤바뀌면 낡은 것을 버리고, 지연은 타임스탬프로 잰다. 기초 08편의 "재전송 대신 감지" 원칙 그대로다.

`magic` 필드는 다른 프로그램의 패킷이 같은 포트로 왔을 때 걸러낸다. 포트 충돌은 생각보다 자주 있다.

## 정리

- IP는 배달만 한다. 도착, 순서, 중복 없음을 보장하지 않고 헤더만 체크섬한다
- IP 단편화는 조각 하나만 잃어도 전체를 버린다. 제어 데이터는 MTU 이하로
- UDP는 포트와 체크섬뿐이다. "보장이 없다" 가 실시간에서는 장점이다
- TCP가 제어에서 재앙인 다섯 가지: 재전송과 head-of-line blocking(RTO 최소 200 ms), Nagle, Delayed ACK, 혼잡 제어, 느린 연결 감지
- Nagle과 Delayed ACK이 만나면 서로 기다린다. 재현 어려운 지연의 고전적 원인
- 정상일 때는 TCP도 UDP만큼 빠르지만 유실 한 번에 200 ms다. 최악값이 사양이다
- 용도: 텔레메트리는 UDP, 설정과 펌웨어는 TCP, 제어 루프는 셋 다 아니고, 비상정지는 네트워크로 안 한다
- UDP에는 `sequence` 와 `timestamp` 와 `magic` 을 직접 붙인다. 유실은 세고 낡은 값은 버린다

## 참고

- [RFC 9293 — TCP](https://www.rfc-editor.org/rfc/rfc9293.html)
- [RFC 768 — UDP](https://www.rfc-editor.org/rfc/rfc768.html)
- [RFC 896 — Nagle 알고리즘](https://www.rfc-editor.org/rfc/rfc896.html)
- [Linux 커널 네트워킹 문서](https://www.kernel.org/doc/html/latest/networking/)
