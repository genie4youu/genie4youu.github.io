---
title: 05. 전환 안정성 — 각 모드가 안정해도 전체는 불안정할 수 있다
date: 2026-11-12 14:05:00 +0900
description: 두 Hurwitz 행렬 사이의 전환이 안정성을 잃는 예와 공통 Lyapunov 함수, 다중 Lyapunov 함수, 평균 체류시간 하한 ln μ / α 를 정리하고, 세 갈래를 비교해 설계에 남는 손잡이와 한계를 본다.
categories: [제어 이론, 다중 모드 제어]
tags: [제어, 안정성, lyapunov, dwell-time, 검증]
mermaid: true
math: true
---

> **기준 출처:** [Hafstein, Tanwani, arXiv:2303.17858](https://ar5iv.labs.arxiv.org/html/2303.17858) · [Shevchenko, Liu, arXiv:2607.12189](https://arxiv.org/html/2607.12189) · [Mitra 외, ACM TECS 2008](https://liberzon.csl.illinois.edu/research/ADT06.pdf) / 확인일 2026-11-12
> **시리즈:** [목차](/posts/00-multimode-series/) | 이전 → [04. 채터링](/posts/04-chattering-hysteresis-dwell/) | 다음 → [06. 전환 순간의 상태](/posts/06-state-reset-at-switch/)

04편은 dwell time 을 채터링을 막는 장치로 넣었다. 그때의 이유는 너무 자주 바뀌면 구동기가 상하고 어느 모드도 일을 끝내지 못한다는 현상 쪽이었다. 이 편은 같은 장치가 안정성 조건으로도 나온다는 것을 본다. 그리고 여기서 나오는 값 $$\mu$$, 곧 전환하는 순간 Lyapunov 함수가 몇 배로 뛰는가는 전환 순간 상태를 어떻게 넘기느냐로 정해지고, 그것이 06편의 주제다.

이 편에 필요한 앞 개념은 넷이다.

| 용어 | 뜻 |
| --- | --- |
| Lyapunov 함수 | 상태의 「에너지」 노릇을 하는 양의 함수 $$V(x)$$. 원점에서만 0 이고, 궤적을 따라 계속 줄어들면 그 시스템은 안정하다 |
| Hurwitz 행렬 | 고유값의 실수부가 모두 음수인 행렬. $$\dot{x} = Ax$$ 가 점근 안정하다는 말과 같다 |
| 임의 전환 (arbitrary switching) | 언제 어느 모드로든 갈 수 있다고 두고 최악의 전환 순서를 상대하는 것 |
| 최소 체류시간, 평균 체류시간 | 한 모드에 최소 이만큼 머문다는 시간 하한, 길게 보면 전환 간격의 평균이 이보다 짧지 않다는 조건 (04편) |

## 1. 모드별 안정성은 전체 안정성이 아니다

> 개별 부분 시스템이 모두 점근 안정해도 불안정이 생길 수 있다.

Wu 는 이 문장에 이어, 전환 신호가 시스템 거동을 정하는 데 결정적인 역할을 하므로 제어기 설계에서 명시적으로 고려해야 한다고 쓴다. 이 글은 이것을 전환이 모드들 사이의 접착제가 아니라 그 자체로 설계 대상이라는 뜻으로 읽는다. Mitra 등도 hybrid automaton 의 안정성 분석이 어려운 이유를 같은 곳에서 찾는다. Paxman 과 Vinnicombe 는 하나의 선형 플랜트에 대해 안정화 제어기들 사이를 전환해 궤적을 불안정하게 만드는 예를 어렵지 않게 만들 수 있다고 적는다.

이 글의 설명으로는 Lyapunov 함수로 보면 이유가 보인다. 안정성을 보인다는 것은 시간이 갈수록 줄어드는 양을 하나 찾아 보이는 일이다. 모드 A 가 안정하다는 것은 A 의 궤적을 따라 줄어드는 함수 $$V_A$$ 가 있다는 뜻이고, B 도 자기 함수 $$V_B$$ 를 갖는다. 두 함수가 다르면 $$V_A$$ 가 줄어드는 동안 $$V_B$$ 는 늘 수 있다. 전환 시점이 나쁘게 맞물리면 각 구간에서 활성 모드는 자기 함수를 줄이는데도 상태의 크기는 커진다.

```mermaid
flowchart LR
    PHA["구간: 모드 A, V_A 감소"] --> SWA["전환: 재는 함수가 바뀐다"]
    SWA --> PHB["구간: 모드 B, V_B 감소"]
    PHB --> SWB["전환"]
    SWB --> LAP["한 바퀴 뒤 상태가 커져 있다"]
```

각 구간에서는 잘못된 일이 일어나지 않는다. 모드마다 자기 기준으로 계속 줄어들고 있다. 문제는 전환에서 재는 함수가 바뀐다는 데 있고, 그 바뀜이 나쁜 시점에 반복되면 상태가 커진다.

## 2. 예 — 두 Hurwitz 행렬

Shevchenko 와 Liu 의 예 4.1 이다.

$$
A_1(\theta) = \begin{bmatrix} -1 & \theta \\ -1 & -1 \end{bmatrix}, \qquad
A_2(\theta) = \begin{bmatrix} -1 & -1 \\ \theta & -1 \end{bmatrix}, \qquad
\theta \in [2, 4]
$$

두 행렬 모두 대각합이 $$-2$$, 행렬식이 $$1 + \theta > 0$$ 이므로 이 범위에서 Hurwitz 다. 각각 따로 돌리면 안정하다. 임의 전환 아래 전환 시스템에 대한 논문의 결론은 $$\theta$$ 에 따라 갈린다.

| $$\theta$$ | 결론 |
| --- | --- |
| $$[2, 3)$$ | 공통 Lyapunov 함수 $$x^\top x$$ 가 있어 균등 점근 안정 |
| $$[3, 4]$$ | 두 행렬의 볼록 결합이 Hurwitz 가 아니어서 균등 점근 안정이 아니다 |
| $$(3, 4]$$ | 전환 시스템에 주기해가 존재한다 |

> 이 문단은 이 글의 계산이다. 경계 $$\theta = 3$$ 은 직접 계산해도 나온다. $$A_i^\top + A_i$$ 의 고유값은 두 모드 모두 $$-2 \pm (\theta - 1)$$ 이라 $$x^\top x$$ 는 $$\theta < 3$$ 에서만 두 모드 모두에서 줄어든다. 평균 행렬 $$\tfrac{1}{2}(A_1 + A_2)$$ 의 고유값은 $$-1 \pm \tfrac{\theta - 1}{2}$$ 이라 $$\theta \ge 3$$ 에서 하나가 0 이상이 된다. 두 행렬을 빠르게 번갈아 쓰면 이 평균에 가까운 거동이 나온다. 각각은 안정한데 평균이 안정하지 않은 것이다.
{: .prompt-info }

균등 점근 안정이 아니라는 결론은 안정성을 깨는 전환 신호가 있다는 뜻이다. 모든 전환에서 발산한다는 뜻이 아니다. 이 글은 이 결과의 무게를 「발산할 것이다」가 아니라 「모드별로 확인했다는 사실이 전체 안정의 근거가 되지 못한다」 쪽에 둔다.

## 3. 세 갈래

Mitra 등은 안정성 분석의 기본 기법을 모든 모드에서 줄어드는 공통 Lyapunov 함수를 찾는 것으로 두고, 그런 함수를 찾지 못하거나 존재하지 않으면 다중 Lyapunov 함수를 쓰며, 각 모드가 안정하면 dwell time 과 평균 dwell time 이 안정을 보장하는 전환 신호의 부류를 정한다고 정리한다.

```mermaid
flowchart LR
    CLF["공통 Lyapunov 함수"] -->|"없거나 못 찾으면"| MLF["다중 Lyapunov 함수"]
    STABLE["각 모드가 안정"] -->|"전환 신호를 제한"| ADT["dwell time, 평균 dwell time"]
```

## 4. 공통 Lyapunov 함수 — 재는 함수를 하나로

1절의 원인이 「재는 함수가 모드마다 다르다」였으므로, 가장 직접적인 처방은 모든 모드가 같은 함수를 줄이게 만드는 것이다. 그런 $$V$$ 가 있으면 전환이 언제 어떻게 일어나든 $$V$$ 는 계속 줄고, 전환 신호를 볼 필요가 없다.

Hafstein 과 Tanwani 는 임의 전환 아래에서 공통 Lyapunov 함수의 존재가 평형점의 점근 안정성에 대한 필요충분조건이라고 적는다. 필요조건이기도 하므로 안정하면 그런 함수가 원리상 존재하고, 어려운 것은 찾는 일이다.

선형 모드에서 후보를 이차형식 $$V(x) = x^\top P x$$ 로 좁히면 조건이 LMI(선형 행렬 부등식)가 된다.

$$P \succ 0, \qquad A_i^\top P + P A_i \prec 0 \quad (\text{모든 } i)$$

$$P \succ 0$$ 은 $$P$$ 가 양의 정부호, $$\prec 0$$ 은 음의 정부호라는 뜻이다. 2절의 예에서는 $$P = I$$ 가 $$\theta < 3$$ 에서 이 조건을 만족한다. 이차형식은 후보의 일부이므로 이 LMI 가 풀리지 않는다고 불안정한 것은 아니다. 좁히는 순간 조건은 충분조건이 된다. Shorten 등의 SIAM Review 는 공통 이차 Lyapunov 함수와 조각별 선형 Lyapunov 함수의 결과를 정리하면서, 전환 시스템의 안정성 판정이 일반적으로 어렵다는 NP-hard 와 결정 불가능성 결과도 함께 다룬다. 이 글은 모드 수가 늘고 모드끼리 성격이 다를수록 하나의 $$P$$ 로 모두 덮기가 어려워진다고 본다.

> 이 문단은 이 글의 판단이다. 공통 Lyapunov 함수가 잡히면 안정성 관점에서는 전환 논리를 자유롭게 설계해도 된다. 히스테리시스와 체류시간이 안정성을 위해서는 필요 없어진다. 채터링을 막기 위해서는 여전히 필요하다(04편). 그만큼 강한 결론이라 그만큼 잘 잡히지 않는다.
{: .prompt-info }

## 5. 다중 Lyapunov 함수 — 모드마다 하나씩, 전환에서 이어 붙인다

하나로 안 되면 모드마다 하나씩 둔다. 대신 모드가 바뀌는 순간에 조건을 하나 더 건다. Huang, Li, Yin 은 다중 Lyapunov 함수가 보편적인 Lyapunov 함수가 없는 시스템에 더 큰 유연성을 준다고 쓰고, 모드 $$i$$ 에서 $$j$$ 로 전환할 때마다 $$V_j(x) < V_i(x)$$ 를 요구한다. 모드 안에서는 그 모드의 함수가 줄고, 전환하는 순간에도 새 함수 값이 옛 값보다 작으므로 줄어드는 양이 끊기지 않는다.

같은 논문은 모드 전환이 전환마다 정해진 영역 안에서만 허용되는 상태 의존 전환을 다루고, 그 전환 영역 위에서 이 부등식을 요구한다. 전환을 허용하는 영역, 곧 guard 의 위치가 안정성 조건에 들어간다. 이 글은 이것을 guard 를 「물리적으로 말이 되는가」로만 정하던 것과 다른 요구로 본다. guard 자체가 안정성 논증의 일부가 된다.

전환 순간 상태가 바뀌는 경우에는 비교할 상태가 전환 전후로 달라진다. Paxman 과 Vinnicombe 는 이런 reset switching system 을 Lyapunov 함수로 분석하고, 안정한 reset 규칙을 LMI 로 합성한다.

> 이 문단은 이 글의 해석이다. 전환 전 상태를 $$x^-$$, 전환 직후 상태를 $$x^+$$ 라 하면 비교는 $$V_j(x^+)$$ 와 $$V_i(x^-)$$ 사이에서 일어난다. 제어기 내부 상태를 그대로 이어받으면 $$x^+ = x^-$$ 이고, 적분기를 0 으로 두면 $$x^+$$ 의 일부가 0 이 된다. 어느 쪽을 고르느냐가 이 부등식을 지키기도 하고 깨기도 하므로, 전환 순간의 상태 처리는 구현 편의가 아니라 안정성 조건에 직접 들어간다. 06편이 이 자리를 다룬다.
{: .prompt-info }

## 6. 느린 전환 — 평균 dwell time 하한

전환할 때마다 감소를 요구하기는 어렵다. 세 번째 갈래는 그것을 요구하지 않는 대신 도약에 값을 매긴다. Hafstein 과 Tanwani 의 따름정리 1은 두 수를 정한다. 모드마다 $$V_i(x) = x^\top P_i x$$ 를 두고 $$A_i^\top P_i + P_i A_i + \alpha P_i \preceq 0$$ 과 $$P_j \preceq \mu P_i$$ 를 요구한다.

| 기호 | 뜻 | 무엇이 정하나 (이 글의 정리) |
| --- | --- | --- |
| $$\alpha$$ | 각 모드 안에서 Lyapunov 함수가 줄어드는 비율 | 각 모드 제어기의 성능 |
| $$\mu \ge 1$$ | 모드 사이 Lyapunov 함수의 비율. $$V_i(x) \le \mu V_j(x)$$ | 모드들의 차이와 전환 순간 상태 처리 |

이때 평균 dwell time 이 다음 하한보다 크면 원점이 전역 지수 안정하다.

$$\tau_a > \frac{\ln \mu}{\alpha}$$

> 이 글의 풀이다. 한 모드에 시간 $$\tau$$ 머무는 동안 $$V$$ 가 $$e^{-\alpha \tau}$$ 배로 줄고 전환할 때 최대 $$\mu$$ 배로 뛴다면, $$\mu e^{-\alpha \tau} < 1$$ 일 때 반복해도 계속 줄어든다. 로그를 취하면 전환할 때마다 $$\ln \mu$$ 만큼 늘고 머무는 동안 $$\alpha \tau$$ 만큼 줄어든다고 읽을 수 있다. 줄어드는 쪽이 크면 수렴한다.
{: .prompt-info }

Mitra 등은 평균 dwell time 이 크다는 것을 각 모드에 충분히 오래 머물러 전환으로 얻은 과도 에너지를 소산한다는 뜻으로 설명한다. 여기의 $$\tau_a$$ 는 04편의 평균 체류시간과 같은 대상이고, $$N_0$$ 는 Della Rossa 와 Tanwani 가 chattering bound 라고 부르는 그 값이다.

> 이 문단은 이 글의 판단이다. 채터링을 막으려고 거는 체류시간과 여기서 안정성 조건으로 나온 체류시간은 같은 대상이고, 다른 것은 값을 정하는 근거다. 채터링 쪽에서는 구동기가 견디는가로, 안정성 쪽에서는 $$\ln \mu / \alpha$$ 로 정한다. 둘 중 큰 값을 쓴다.
{: .prompt-info }

## 7. 세 갈래 비교

| | 공통 Lyapunov 함수 | 다중 Lyapunov 함수 | 느린 전환 |
| --- | --- | --- | --- |
| 보이는 것 | 모든 모드가 같은 $$V$$ 를 줄인다 | 모드마다 $$V_i$$, 전환할 때 $$V_j < V_i$$ | 모드마다 $$V_i$$, 전환할 때 최대 $$\mu$$ 배 도약 허용 |
| 전환 신호에 거는 제약 | 없다 | 전이가 정해진 영역에서만 일어나야 한다 | 평균 간격이 $$\ln \mu / \alpha$$ 보다 길어야 한다 |
| 결론의 강도 | 가장 강하다 | 중간 | 가장 약하다 |
| 찾기 | 가장 어렵다 | 중간 | 상대적으로 쉽다 |
| 실패하면 | 답이 이차형식 밖에 있을 수 있다 | 전이 영역을 다시 잡는다 | 더 느리게 전환하거나 $$\mu$$ 를 줄인다 |
| 설계에 주는 손잡이 | 모드 제어기 설계 자체 | 전이 조건의 위치 | 전환 빈도, $$\mu$$, $$\alpha$$ |

첫 줄과 둘째 줄은 4절에서 6절까지의 출처를 따랐고, 나머지 줄은 이 글의 정리다. 이 글은 세 갈래를 서로 바꿔 고르는 대안이라기보다 결론을 조금씩 양보하는 순서로 본다. 공통 함수가 잡히면 나머지는 필요 없고, 잡히지 않으면 모드별 함수와 전이 영역을 보고, 그것도 어려우면 전환 빈도에 제약을 건다. 뒤로 갈수록 결론은 약해지고 전환 논리에 붙는 제약은 많아진다.

## 8. 설계에 남는 것

Mitra 등은 평균 dwell time 검증 기법을 개별 모드의 안정성 검사와 결합해 hybrid system 의 안정성을 검증한다. 검증 대상은 모드별 안정성에 전환 신호의 성질을 더한 것이다. 이 글은 이것을 모드 $$m$$ 개짜리 설계의 검증 항목이 모드 $$m$$ 개가 아니라 모드 $$m$$ 개와 전환 논리 하나라는 뜻으로 읽는다.

부등식 $$\tau_a > \ln \mu / \alpha$$ 의 세 기호를 이 글이 읽은 대로 나누면, 맞추는 손잡이는 셋이고 서로 바꿔 쓸 수 있다.

| 손잡이 | 하는 일 | 대가 | 다루는 편 |
| --- | --- | --- | --- |
| $$\tau_a$$ 를 늘린다 | 덜 자주 전환한다. 히스테리시스와 체류시간을 세게 건다 | 반응이 늦어진다 | 04편 |
| $$\mu$$ 를 줄인다 | 전환 순간 Lyapunov 함수의 도약을 줄인다 | 연산량, 제어기 내부 접근 | 06편 |
| $$\alpha$$ 를 키운다 | 각 모드가 더 빨리 수렴하게 한다 | 대역폭을 올리는 대가 전부. 잡음 증폭, 포화, 로버스트성 감소 | 각 모드의 제어기 설계 |

> 이 문단은 이 글의 판단이다. 빨리 전환해야 하는 설계라면 $$\tau_a$$ 를 늘릴 수 없으므로 $$\mu$$ 를 줄이는 쪽이 남고, $$\mu$$ 를 줄이는 일이 곧 전환 순간에 상태를 무엇으로 둘지 정하는 일이다. 이 시리즈 안에서는 대개 이 손잡이가 가장 싸다고 본다.
{: .prompt-info }

이 하한의 한계도 이 글은 셋으로 정리한다.

| 한계 | 내용 |
| --- | --- |
| 충분조건이고 보수적이다 | $$\tau_a > \ln \mu / \alpha$$ 를 맞추지 못했다고 불안정한 것은 아니다. 계산된 하한은 실제로 필요한 값보다 큰 경우가 많다 |
| $$\mu$$ 와 $$\alpha$$ 를 구하는 것이 일이다 | 이 값들은 Lyapunov 함수를 먼저 찾아야 나온다. Hafstein 과 Tanwani 가 선형계획법으로 하한을 계산하는 것도 이 계산을 최적화 문제로 바꾸는 시도다 |
| 안정과 쓸 만함은 다르다 | 이 이론은 발산하지 않음을 말할 뿐, 과도 응답이 얼마나 큰지, 접촉력이 얼마나 튀는지는 말하지 않는다. 안정성은 하한선이지 목표가 아니다 |

## 9. 정리

- 개별 부분 시스템이 모두 점근 안정해도 전환으로 불안정이 생길 수 있다. 모드마다 줄어드는 함수가 서로 다르기 때문이고, 전환은 그 자체로 설계 대상이다
- 두 Hurwitz 행렬 $$A_1(\theta)$$, $$A_2(\theta)$$ 의 예에서 $$\theta < 3$$ 은 공통 Lyapunov 함수 $$x^\top x$$ 로 안정하고, $$\theta \ge 3$$ 은 평균 행렬이 Hurwitz 가 아니어서 균등 점근 안정을 잃는다. 「그런 전환 신호가 있다」는 뜻이지 「아무렇게나 전환하면 발산한다」는 뜻이 아니다
- 공통 Lyapunov 함수의 존재는 임의 전환 아래 점근 안정의 필요충분조건이다. 이차형식 LMI 로 좁히면 충분조건이 된다. 잡히면 안정성 관점에서 전환 논리가 자유로워진다
- 다중 Lyapunov 함수는 전환할 때 $$V_j(x) < V_i(x)$$ 를 요구하고, 상태 의존 전환에서는 guard 의 위치가 이 조건에 들어간다. 전환 순간 상태 처리도 이 부등식에 들어간다
- 느린 전환 조건은 $$\tau_a > \ln \mu / \alpha$$ 이고, 「전환마다 $$\ln \mu$$ 만큼 늘고 머무는 동안 $$\alpha \tau$$ 만큼 준다」로 읽는다
- 여기의 평균 체류시간은 채터링을 막는 그 장치와 같은 대상이고, 근거가 다른 두 값 가운데 큰 값을 쓴다
- 세 갈래는 결론을 양보하는 순서로 볼 수 있다. 뒤로 갈수록 결론은 약해지고 전환 논리의 제약은 는다
- 설계에 남는 손잡이는 전환 빈도, 전환 순간의 도약, 모드 안의 수렴 속도 셋이고, 하한은 보수적인 충분조건이다

## 참고

- [F. Wu, Hybrid Control Technique for Switched LPV Systems and Its Application to Active Magnetic Bearing System (arXiv:2602.01524)](https://arxiv.org/html/2602.01524)
- [S. Mitra, D. Liberzon, N. Lynch, Verifying Average Dwell Time of Hybrid Systems, ACM TECS 8(1), 2008](https://liberzon.csl.illinois.edu/research/ADT06.pdf)
- [J. P. Paxman, G. Vinnicombe, Stability of Reset Switching Systems, ECC 2003](https://skoge.folk.ntnu.no/prost/proceedings/ecc03/pdfs/084.pdf)
- [I. O. Shevchenko, X. Liu, Stability and Bifurcations of Planar Switched Linear and Homogeneous Systems (arXiv:2607.12189)](https://arxiv.org/html/2607.12189)
- [S. Hafstein, A. Tanwani, Linear Programming based Lower Bounds on Average Dwell-Time via Multiple Lyapunov Functions (arXiv:2303.17858)](https://ar5iv.labs.arxiv.org/html/2303.17858)
- [R. Shorten, F. Wirth, O. Mason, K. Wulff, C. King, Stability Criteria for Switched and Hybrid Systems, SIAM Review 49(4), 2007](https://mural.maynoothuniversity.ie/id/eprint/1757/1/HamiltonStabilitySwitched.pdf)
- [J. Huang, S. Li, X. Yin, Stability Verification for Switched Systems using Neural Multiple Lyapunov Functions (arXiv:2601.00587)](https://arxiv.org/html/2601.00587)
- [M. Della Rossa, A. Tanwani, Converse Lyapunov Results for Stability of Switched Systems with Average Dwell-Time (arXiv:2405.03560)](https://arxiv.org/html/2405.03560v1)
