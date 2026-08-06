---
title: 10. CAN 대역폭과 최악 지연 계산
date: 2026-08-06 10:10:00 +0900
description: 6축 1 kHz 를 CAN 1 Mbps 로 하면 부하율이 162%다. 다축 로봇이 EtherCAT 를 쓰는 정량적 이유가 여기 있다.
categories: [로봇 통신, CAN]
tags: [통신, can, 실시간제어, 최악지연, ethercat, cpp]
mermaid: true
math: true
---

> **기준 출처:** Bosch CAN Specification 2.0 §3, Tindell, Burns & Wellings "Calculating Controller Area Network (CAN) Message Response Times"(Control Engineering Practice, 1995), Davis, Burns, Bril & Lukkien "CAN Schedulability Analysis: Refuted, Revisited and Revised"(Real-Time Systems, 2007) / 확인일 2026-08-03
> **시리즈:** [목차](/posts/00-comm-series/) | 이전 → [09. CAN FD](/posts/09-can-fd/) | 다음 → [11. CANopen 객체 사전과 NMT](/posts/11-canopen-od-nmt/)

---

## 1. 두 개의 다른 질문

| 질문 | 무엇을 계산하나 |
| --- | --- |
| 버스가 감당할 수 있나 | 평균 부하율, 곧 대역폭이다 |
| 이 메시지가 언제까지 도착하나 | 최악 응답 시간, 곧 실시간성이다 |

둘째가 훨씬 중요하다. [기초 10편](/posts/10-basics-realtime-jitter/)에서 봤듯 실시간 시스템의 사양은 평균이 아니라 최악으로 쓴다. 부하율이 30% 여도 우선순위가 낮은 메시지는 오래 기다릴 수 있다.

## 2. 프레임 하나의 시간

| 프레임 | 최소 (스터핑 없음) | 최악 (스터핑 최대) |
| --- | --- | --- |
| 표준 11비트 ID 에 데이터 $n$ 바이트 | $47 + 8n$ 비트 | $55 + 10n$ 비트 |
| 확장 29비트 ID | $67 + 8n$ 비트 | $80 + 10n$ 비트 |

$$C = \frac{\text{비트 수}}{\text{비트레이트}}$$

표준 프레임에 8바이트면 최악 135비트다.

| 비트레이트 | 최악 프레임 시간 $C$ |
| --- | --- |
| 1 Mbps | 135 µs |
| 500 kbps | 270 µs |
| 250 kbps | 540 µs |
| 125 kbps | 1080 µs |

반드시 최악인 스터핑 최대로 계산한다. 데이터가 `0x00` 이나 `0xFF` 로 가득 차면 스터프 비트가 많이 들어간다. 평균으로 계산해 놓고 특정 데이터 패턴에서 마감을 놓치는 사고가 실제로 난다.

## 3. 버스 부하율

$$\text{부하율} = \sum_{i} \frac{C_i}{T_i}$$

$C_i$ 는 메시지 $i$ 의 프레임 시간이고 $T_i$ 는 주기다.

6축 로봇을 CAN 1 Mbps 로 1 kHz 제어한다고 하자. 축 명령이 6개, 축 피드백이 6개이고 각각 8바이트에 1 ms 주기이며 최악 프레임 시간이 135 µs 다.

$$\text{부하율} = \frac{12 \times 135\,\mu s}{1000\,\mu s} = 162\%$$

100% 를 넘으니 물리적으로 불가능하다. 1 kHz 6축 제어는 Classic CAN 1 Mbps 로 안 된다. 이게 계산으로 나오는 명확한 결론이다.

| 방법 | 결과 | 판단 |
| --- | --- | --- |
| 제어 주기를 250 Hz 로 낮춘다 | 부하율 40.5% | 가능하지만 제어 성능이 떨어진다 |
| CAN FD 로 데이터를 2 Mbps 로 | 프레임 시간이 약 1/3 이 된다 | 부하율 약 60% 로 빠듯하다 |
| 여러 축을 한 프레임에 넣는다 | 위치를 16비트로 줄여 4축을 한 프레임에 담는다 | 분해능을 손해 본다 |
| CAN 버스를 두 개로 나눈다 | 축 3개씩 나눈다 | 배선과 비용이 늘고 동기는 여전히 안 된다 |
| EtherCAT 로 간다 | 6축 8바이트씩이 프레임 하나에 들어간다 | 정답이다 |

이 계산이 왜 다축 로봇은 EtherCAT 를 쓰는가에 대한 정량적 답이다. CAN 이 나빠서가 아니라 구조적으로 못 하는 일이다. [기초 02편](/posts/02-basics-layers-osi-fieldbus/)에서 본 EtherCAT 의 효율 계산을 떠올린다. 슬레이브가 늘어도 프레임 개수가 늘지 않는다.

| 부하율 | 판단 |
| --- | --- |
| 30% 미만 | 여유롭다 |
| 30~50% | 실무 권장 상한이다 |
| 50~70% | 낮은 우선순위 메시지의 지연이 급격히 는다 |
| 70% 초과 | 위험하다. 최악 지연이 폭발한다 |

50% 를 권장 상한으로 두는 이유는 최악 지연 때문이다. 부하율이 오르면 최악 응답 시간이 선형이 아니라 급격히 나빠진다.

## 4. 최악 응답 시간은 세 항의 합이다

메시지 $m$ 이 보내고 싶다고 결정한 순간부터 실제로 전송이 끝날 때까지의 최악 시간이다.

$$R_m = B_m + w_m + C_m$$

| 항 | 뜻 |
| --- | --- |
| $B_m$ 블로킹 | 나보다 낮은 우선순위 프레임이 이미 시작해버려 끝날 때까지 못 끼어든다 |
| $w_m$ 간섭 | 나보다 높은 우선순위 메시지들이 그동안 계속 끼어든다 |
| $C_m$ 내 전송 시간 | |

CAN 은 비파괴 중재라 선점이 없다. 이미 전송이 시작된 프레임은 끝까지 간다. 낮은 우선순위 메시지가 t=0 에 시작하면 t=1 µs 에 최우선 메시지가 보내고 싶어져도 t=135 µs 까지 기다려야 한다.

$$B_m = \max_{k \in \text{lower priority}} C_k$$

최우선 메시지도 최악 135 µs 를 기다린다. 이게 CAN 의 근본적인 지터 하한이다. [04편](/posts/04-can-frame-formats/)에서 CAN 이 프레임을 일부러 짧게 만들었다고 한 이유가 이것이다. 프레임이 길면 블로킹도 길어진다. CAN FD 로 64바이트를 쓰면 블로킹이 커져서 최우선 메시지의 지연이 나빠진다. FD 의 숨은 대가다.

간섭은 반복으로 푼다. 높은 우선순위 메시지들이 내가 기다리는 동안 계속 오고, 내가 기다리는 시간이 길어지면 그동안 더 많이 온다. 순환 관계다.

$$w_m^{(k+1)} = B_m + \sum_{j \in \text{hp}(m)} \left\lceil \frac{w_m^{(k)} + \tau_{bit}}{T_j} \right\rceil C_j$$

$w_m^{(0)} = B_m$ 에서 시작해 수렴할 때까지 반복한다. 수렴하지 않고 계속 커지면 그 메시지는 마감을 지키지 못한다.

위 식은 개념을 보이기 위한 단순화다. 정확한 분석은 지터와 큐잉과 재전송과 오류를 다 넣어야 하고, Davis 등이 2007년에 Tindell 의 1995년 원래 분석에 있던 오류를 정정했다. 실제 안전 설계에서는 원 논문이나 검증된 도구를 쓴다.

## 5. 계산 예제

CAN 500 kbps 에 표준 프레임이다. 8바이트 프레임은 $C$ 가 270 µs 이고 2바이트 프레임은 150 µs 다.

| 메시지 | ID | 데이터 | 주기 $T$ | $C$ |
| --- | --- | --- | --- | --- |
| A (E-stop 상태) | 0x001 | 2B | 10 ms | 150 µs |
| B (축 명령) | 0x100 | 8B | 5 ms | 270 µs |
| C (축 피드백) | 0x180 | 8B | 5 ms | 270 µs |
| D (시스템 상태) | 0x300 | 8B | 20 ms | 270 µs |
| E (진단) | 0x700 | 8B | 100 ms | 270 µs |

부하율은 각 항을 더해 13.9% 다. 여유롭다. 이제 각 메시지의 최악 응답을 본다.

메시지 A 는 최우선이다. 블로킹은 나보다 낮은 것 중 최대인 270 µs 이고 간섭은 없다.

$$R_A = 270 + 0 + 150 = 420\ \mu s$$

최우선 메시지도 420 µs 가 걸린다. 부하율이 13.9% 인데도 그렇다. 블로킹이 지배적이다.

메시지 D 는 블로킹이 E 의 270 µs 이고 높은 우선순위로 A, B, C 가 있다. 반복 계산하면 초기값 270 에서 시작해 960 으로 수렴한다.

$$R_D = 960 + 270 = 1230\ \mu s$$

주기가 20 ms 이므로 여유롭다. 메시지 E 는 최하위라 블로킹이 0 이고 A, B, C, D 가 간섭한다. 반복하면 역시 960 으로 수렴해 $R_E$ 도 1230 µs 다.

| 관찰 | 의미 |
| --- | --- |
| 최우선 A 도 420 µs 다 | 블로킹은 우선순위로 피할 수 없다 |
| 부하율이 13.9% 인데 최하위가 1.23 ms 다 | 부하율만 봐서는 모른다 |
| D 와 E 가 같은 값이다 | 둘 다 상위 트래픽에 지배된다 |

부하율을 50% 로 올리면 간섭 항의 올림 함수가 계단식으로 커지면서 최악 응답이 수 배로 뛴다. 그래서 30~50% 를 상한으로 잡는다.

## 6. 계산에 빠진 것들

위 계산은 이상적인 경우다. 실제로는 더 나쁘다.

| 빠진 요소 | 영향 |
| --- | --- |
| 오류와 재전송 | 오류 하나마다 Error Frame 과 재전송이 붙는다. 최악에 n회 오류를 가정해야 한다 |
| 송신 지터 | 소프트웨어가 정확히 주기에 넣지 못한다 |
| 큐잉 지연 | 컨트롤러 메일박스가 차 있으면 늘어난다 |
| 소프트웨어 우선순위 역전 | 낮은 우선순위 메시지가 메일박스를 점유하고 있으면 생긴다 |
| 다른 노드의 동작 | 계산에 넣은 것 외의 트래픽이 있다 |

오류를 감안하는 방법은 주어진 시간 창 안에 최대 n회 오류가 난다고 가정하고 각 오류마다 Error Frame 과 최대 프레임 재전송 시간을 더하는 것이다. 안전 설계에서는 반드시 한다.

실용적 접근은 계산으로 후보를 걸러내고 반드시 실측하는 것이다. 로직 애널라이저로 특정 ID 의 송신 요청 시점과 실제 전송 완료 시점을 재면 실제 분포가 나온다.

## 7. 계산을 코드로

```cpp
// comm_can/schedulability.hpp
// 교육과 설계 초안용이다. 안전 인증이 필요한 시스템에서는
// Davis 등(2007)의 정정된 분석이나 검증된 도구를 쓴다.
#pragma once
#include <vector>
#include <algorithm>
#include <cmath>
#include <optional>

struct CanMessage {
    std::uint32_t id;        // 작을수록 우선순위가 높다
    std::uint8_t  dlc;
    bool          extended;
    double        period_us;
};

inline double frame_time_us(const CanMessage& m, double bitrate) {
    const double bits = m.extended ? (80 + 10.0 * m.dlc) : (55 + 10.0 * m.dlc);
    return bits / bitrate * 1e6;
}

inline double bus_load(const std::vector<CanMessage>& msgs, double bitrate) {
    double u = 0;
    for (const auto& m : msgs) u += frame_time_us(m, bitrate) / m.period_us;
    return u;
}

// 최악 응답 시간의 단순화 모델이다
inline std::optional<double>
worst_case_response(const std::vector<CanMessage>& msgs, std::size_t idx,
                    double bitrate, double bit_time_us) {
    const auto&  m = msgs[idx];
    const double C = frame_time_us(m, bitrate);

    // 블로킹은 나보다 낮은 우선순위, 곧 id 가 큰 것 중 최대 프레임 시간이다
    double B = 0;
    for (const auto& o : msgs)
        if (o.id > m.id) B = std::max(B, frame_time_us(o, bitrate));

    // 간섭은 수렴할 때까지 반복한다
    double w = B, prev = -1;
    for (int iter = 0; iter < 1000 && w != prev; ++iter) {
        prev = w;
        double interference = 0;
        for (const auto& o : msgs)
            if (o.id < m.id)
                interference += std::ceil((prev + bit_time_us) / o.period_us)
                              * frame_time_us(o, bitrate);
        w = B + interference;
        if (w + C > m.period_us * 10) return std::nullopt;   // 발산이라 스케줄이 불가하다
    }
    return w + C;
}
```

이 함수를 유닛 테스트로 감싸두면 메시지를 추가할 때마다 CI 가 마감 위반을 잡아준다. 새 센서를 붙이면서 조용히 최악 지연을 망가뜨리는 사고를 막는다.

## 정리

- 두 질문을 구분한다. 평균 부하율이 감당 가능한가를 묻고 최악 응답 시간이 제때 오는가를 묻는다.
- 프레임 시간은 반드시 최악인 스터핑 최대로 계산한다. 표준 8바이트가 135비트다.
- 6축 1 kHz 를 CAN 1 Mbps 로 하면 부하율이 162% 라 물리적으로 불가능하다.
- 이게 다축 로봇이 EtherCAT 를 쓰는 정량적 이유다.
- 부하율 권장 상한은 30~50% 다.
- 최악 응답은 블로킹과 간섭과 내 전송 시간의 합이다.
- 블로킹은 우선순위로 피할 수 없다. 이미 시작된 프레임은 끝까지 가므로 최우선 메시지도 최대 프레임 하나를 기다린다.
- 그래서 CAN 은 프레임을 짧게 만들었고 CAN FD 로 64바이트를 쓰면 블로킹이 커지는 숨은 대가가 있다.
- 예제에서 부하율이 13.9% 인데 최우선이 420 µs 이고 최하위가 1230 µs 다. 부하율만 봐서는 모른다.
- 계산에 오류와 재전송과 송신 지터와 큐잉과 소프트웨어 우선순위 역전이 빠져 있다.
- 계산으로 후보를 거르고 반드시 실측한다. 계산을 코드와 테스트로 만들면 CI 가 지켜준다.

## 참고

- [Bosch CAN Specification 2.0](https://www.bosch-semiconductors.com/media/ip_modules/pdf_2/can2spec.pdf)
- [CiA — CAN Knowledge](https://www.can-cia.org/can-knowledge)
