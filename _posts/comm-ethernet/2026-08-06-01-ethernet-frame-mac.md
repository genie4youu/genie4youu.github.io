---
title: 01. 이더넷 프레임과 MAC 주소
date: 2026-08-06 11:01:00 +0900
description: 프레임이 어떻게 생겼고 얼마나 걸리는지. 최소 64바이트의 유래와 100 Mbps에서 최대 프레임 123 µs라는 숫자.
categories: [로봇 통신, 이더넷]
tags: [통신, 이더넷, 프레임, MAC, EtherType, 물리계층]
math: true
---

> **기준 출처:** IEEE 802.3 · IEEE 802.1Q · [IANA EtherType 등록부](https://www.iana.org/assignments/ieee-802-numbers/ieee-802-numbers.xhtml) · [IEEE OUI 등록부](https://standards-oui.ieee.org/) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [CAN 16. 예제](/posts/16-cia402-sequencer-example/) | 다음 → [02. 스위치와 큐](/posts/02-ethernet-switch-queue-delay/)

이 폴더는 짧고 목적이 하나다. **표준 이더넷은 왜 실시간 제어에 못 쓰는가.**

그 답을 하려면 프레임이 어떻게 생겼고 얼마나 걸리는지를 먼저 알아야 한다. 그리고 여기서 나오는 숫자들이 다음 폴더의 대역폭 계산에 그대로 쓰인다.

## 1. 프레임 구조

| 필드 | 크기 | 역할 |
| --- | --- | --- |
| Preamble | 7 B | `10101010` × 7, 수신 PHY의 클럭 복원용 |
| SFD | 1 B | `10101011`, 여기부터 프레임 |
| 목적지 MAC | 6 B | 누구에게 |
| 출발지 MAC | 6 B | 누가 |
| EtherType | 2 B | 페이로드가 무슨 프로토콜인가 |
| 페이로드 | 46~1500 B | 최소 46바이트, 모자라면 패딩 |
| FCS | 4 B | CRC-32 |
| (IFG) | 12 B 상당 | 프레임 간 간격 |

프레임 자체는 목적지 MAC부터 FCS까지 64~1518 바이트다. 프리앰블과 IFG는 프레임 밖이지만 링크 시간은 잡아먹는다.

### 왜 최소 64바이트인가

옛 CSMA/CD 시대의 유물이다.

충돌을 감지하려면 내 프레임이 아직 나가는 중일 때 반대편에서 오는 충돌 신호가 도착해야 했다. 당시 최대 네트워크 길이 2500 m의 왕복 시간 동안 계속 송신하고 있어야 했고, 그게 512비트, 즉 64바이트였다.

지금은 전부 스위치라 충돌이 없는데도 이 규칙이 남아 있다. 호환성 때문이다. 그래서 8바이트를 보내려면 46바이트로 패딩해야 한다. [기초 02편](/posts/02-basics-layers-osi-fieldbus/)에서 "8바이트 보내는 데 92바이트" 라고 계산한 것의 근거가 이것이다.

## 2. MAC 주소

48비트를 반으로 나눠 앞 24비트가 OUI(제조사 식별), 뒤 24비트가 제조사가 배정하는 장치 번호다. `00:1B:21:3A:5F:C2` 라면 앞 세 바이트가 OUI다.

| 비트 | 이름 | 뜻 |
| --- | --- | --- |
| 첫 바이트 bit0 | I/G | 0=유니캐스트, 1=멀티캐스트 |
| 첫 바이트 bit1 | U/L | 0=전역 고유(OUI 등록), 1=로컬 관리 |

`FF:FF:FF:FF:FF:FF` 는 브로드캐스트다.

다음 폴더에서 볼 EtherCAT는 이 주소 체계를 사실상 쓰지 않는다. 슬레이브에 MAC 주소가 없고 프레임의 목적지 주소는 무시된다. 주소 지정을 자동증가와 논리 주소라는 완전히 다른 방식으로 다시 만들었다. [CAN 01편](/posts/01-can-what-it-solves/)에서 본 발상과 같다. "누구에게" 가 아니라 다른 기준으로 데이터를 식별한다.

## 3. EtherType

페이로드가 무슨 프로토콜인지 나타낸다. 값이 1500 이하면 길이 필드로 해석한다(옛 802.3 형식).

| EtherType | 프로토콜 |
| --- | --- |
| `0x0800` | IPv4 |
| `0x0806` | ARP |
| `0x86DD` | IPv6 |
| `0x8100` | VLAN 태그 (802.1Q) |
| `0x88A4` | EtherCAT |
| `0x8892` | PROFINET |
| `0x88CC` | LLDP |
| `0x88F7` | PTP (IEEE 1588) |

EtherCAT는 IP도 TCP도 쓰지 않고 EtherType `0x88A4` 로 이더넷 프레임에 직접 붙는다. 기초 02편에서 "필드버스는 3·4·5·6 계층을 지운다" 고 한 것이 여기서 구체적으로 보인다. IP 헤더 20바이트, TCP 헤더 20바이트가 통째로 없다.

대가도 분명하다. 일반 NIC는 `0x88A4` 프레임을 그냥 버리고, 라우터를 못 넘고, 일반 네트워크 도구로 안 보인다.

## 4. 프레임 하나에 걸리는 시간

$$t_{\text{frame}} = \frac{(\text{프레임 바이트} + 8 + 12) \times 8}{\text{링크 속도}}$$

프리앰블 8과 IFG 12를 더한다.

### 100BASE-TX (100 Mbps)

| 프레임 크기 | 총 바이트 | 시간 |
| --- | --- | --- |
| 최소 64 B | 84 | 6.72 µs |
| 128 B | 148 | 11.8 µs |
| 512 B | 532 | 42.6 µs |
| 최대 1518 B | 1538 | 123 µs |

### 1000BASE-T (1 Gbps)

| 프레임 크기 | 시간 |
| --- | --- |
| 최소 64 B | 0.67 µs |
| 최대 1518 B | 12.3 µs |

**최대 프레임 123 µs.** 이 숫자를 기억하면 이 폴더의 나머지가 쉬워진다. 02편의 큐잉 지연도, 04편의 블로킹도, 다음 폴더의 사이클 시간 계산도 전부 여기서 나온다.

[CAN 10편](/posts/10-can-bandwidth-worst-case/)에서 본 CAN의 블로킹과 같은 개념이다. 이미 전송이 시작된 프레임은 끝까지 간다.

### 계산을 코드로

```cpp
// comm_core/ethernet.hpp
constexpr std::size_t kEthMinFrame = 64;    // 목적지MAC ~ FCS
constexpr std::size_t kEthMaxFrame = 1518;  // VLAN 태그 있으면 1522
constexpr std::size_t kEthPreamble = 8;
constexpr std::size_t kEthIfg      = 12;

// 링크에서 프레임 하나가 차지하는 시간 (µs)
constexpr double eth_frame_time_us(std::size_t frame_bytes, double link_mbps) {
    const auto b = std::max(frame_bytes, kEthMinFrame) + kEthPreamble + kEthIfg;
    return b * 8.0 / link_mbps;
}

static_assert(eth_frame_time_us(64,   100) > 6.71  && eth_frame_time_us(64,   100) < 6.73);
static_assert(eth_frame_time_us(1518, 100) > 123.0 && eth_frame_time_us(1518, 100) < 123.1);
```

## 5. 물리계층: 왜 100BASE-TX인가

| 항목 | 100BASE-TX |
| --- | --- |
| 케이블 | Cat5 이상, 트위스트 페어 2쌍 (송신·수신 분리 = 전이중) |
| 인코딩 | 4B/5B + MLT-3, 엣지 보장과 대역폭 절약 |
| 절연 | 펄스 트랜스포머 필수 |
| 세그먼트 길이 | 100 m |
| 클럭 | PHY가 데이터에서 복원 (PLL) |

산업용 실시간 이더넷이 1 Gbps가 아니라 100 Mbps를 쓰는 경우가 많은데 이유가 여럿이다.

| 이유 | |
| --- | --- |
| PHY 지연이 작고 예측 가능 | 1000BASE-T는 인코딩이 복잡해 지연이 크고 변동이 있다 |
| 전이중 2쌍이면 충분 | 제어 프레임은 짧다 (수백 바이트) |
| 비용과 전력 | 슬레이브마다 PHY가 2개씩 필요하다 |
| 절연을 공짜로 | 트랜스포머가 규격에 있다 |
| 대역폭이 병목이 아니다 | 기초 02편에서 봤듯 노드가 늘어도 효율이 좋아진다 |

빠른 것보다 예측 가능한 것이 중요하다는 [기초 10편](/posts/10-basics-realtime-jitter/)의 원칙이 물리계층 선택에서도 나타난다.

## 6. VLAN 태그

EtherType 자리에 `0x8100` 이 오면 그다음 2바이트가 VLAN 태그(TCI)이고, 그 뒤에 진짜 EtherType이 온다.

| 필드 | 용도 |
| --- | --- |
| PCP (Priority Code Point) | 3비트 우선순위, 스위치가 큐를 나눌 때 쓴다 |
| VID | VLAN ID (망 분리) |

PCP가 04편에서 다시 나온다. 표준 이더넷의 실시간성을 조금이라도 개선하려는 시도(802.1p 우선순위)의 근거이고 TSN의 출발점이기도 하다. 다만 우선순위만으로는 결정성이 안 나온다. 이유는 02편과 04편에서.

## 정리

- 프레임 = 프리앰블(8) + 목적지MAC(6) + 출발지MAC(6) + EtherType(2) + 페이로드(46~1500) + FCS(4) + IFG(12)
- 최소 64바이트는 옛 CSMA/CD의 유물. 지금은 불필요한데 호환성으로 남았고, 작은 데이터의 오버헤드가 커진다
- MAC 주소는 OUI(24) + 장치(24). 브로드캐스트 `FF:FF:...`, 멀티캐스트는 첫 바이트 bit0=1
- EtherCAT는 MAC 주소 체계를 쓰지 않고 주소 지정을 다시 만들었다. CAN과 같은 발상이다
- EtherType `0x88A4` 가 EtherCAT. IP도 TCP도 없이 이더넷에 직접 붙는다. 대가는 일반 NIC가 버리고 라우터를 못 넘는 것
- 100 Mbps에서 최소 프레임 6.72 µs, 최대 프레임 123 µs. 이 숫자가 계속 쓰인다
- 100 Mbps를 쓰는 이유: PHY 지연이 작고 예측 가능, 비용과 전력, 절연이 규격에 포함, 대역폭이 병목이 아니다
- 100BASE-TX는 트랜스포머 절연이 필수라 노드 간 절연을 공짜로 얻는다
- VLAN 태그의 PCP(우선순위)가 04편과 TSN에서 다시 나온다

## 참고

- [IEEE GET 802 프로그램 (일부 규격 무료 공개)](https://ieeexplore.ieee.org/browse/standards/get-program/page/series?id=68)
- [IANA EtherType 등록부](https://www.iana.org/assignments/ieee-802-numbers/ieee-802-numbers.xhtml)
- [IEEE OUI 등록부](https://standards-oui.ieee.org/)
