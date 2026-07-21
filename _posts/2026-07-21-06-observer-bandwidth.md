---
title: 06. 관측기 대역폭 ωo
date: 2026-07-21 06:06:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, eso, 대역폭, 극배치, 관측기]
description: ESO의 이득 세 개를 대역폭 하나로 접는 대역폭 파라미터화를 이항전개로 유도하고, ωo와 노이즈의 맞교환을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** Gao, *Scaling and Bandwidth-Parameterization Based Controller Tuning* (ACC, 2003) · MathWorks ADRC 문서 / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [05. 확장상태관측기](/posts/05-extended-state-observer/) · 다음 → [07. 제어기 대역폭](/posts/07-controller-bandwidth/)

---

## 1. 문제 — 관측기 이득 세 개

3차 ESO는 이득 $$\beta_1, \beta_2, \beta_3$$를 갖는다. 이 셋을 따로 튜닝하는 것은 어렵다. 서로 얽혀 있어 하나를 바꾸면 전체 거동이 흔들린다. Gao(2003)의 대역폭 파라미터화가 이 지점을 해결한다.

> 관측기의 극을 전부 한 점 $$-\omega_o$$에 몰면, 이득이 $$\omega_o$$ 하나의 함수로 정해진다.

튜닝 노브가 3개에서 1개로 준다.

## 2. 극배치로 이득을 하나로

선형 관측기의 수렴 속도는 추정 오차 동역학의 극이 정한다. 극이 복소평면에서 왼쪽으로 멀수록 오차가 빨리 0으로 간다.

2차 플랜트에 붙는 3차 ESO의 오차 특성다항식은 이득으로 이렇게 쓰인다.

$$s^3 + \beta_1 s^2 + \beta_2 s + \beta_3 = 0$$

Gao의 처방은 이 다항식을 $$(s+\omega_o)^3$$과 같게 두는 것이다. 즉 세 극을 전부 $$-\omega_o$$에 둔다.

$$s^3 + \beta_1 s^2 + \beta_2 s + \beta_3 = (s+\omega_o)^3$$

## 3. 이항전개로 이득 공식 유도

우변을 이항정리로 전개한다.

$$(s+\omega_o)^3 = s^3 + 3\omega_o s^2 + 3\omega_o^2 s + \omega_o^3$$

같은 차수의 계수를 맞추면 이득이 바로 나온다.

| 차수 | 좌변 | 우변 | 결론 |
| --- | --- | --- | --- |
| $$s^2$$ | $$\beta_1$$ | $$3\omega_o$$ | $$\beta_1 = 3\omega_o$$ |
| $$s^1$$ | $$\beta_2$$ | $$3\omega_o^2$$ | $$\beta_2 = 3\omega_o^2$$ |
| $$s^0$$ | $$\beta_3$$ | $$\omega_o^3$$ | $$\beta_3 = \omega_o^3$$ |

$$\beta_1 = 3\omega_o, \qquad \beta_2 = 3\omega_o^2, \qquad \beta_3 = \omega_o^3$$

$$\omega_o$$ 하나를 정하면 세 이득이 자동으로 나온다. 일반화하면 $$N{+}1$$차 ESO의 이득은 이항계수로 $$\beta_i = \binom{N+1}{i}\omega_o^{\,i}$$가 된다.

## 4. ωo의 의미와 노이즈 맞교환

$$\omega_o$$는 관측기가 신호를 따라잡는 주파수 한계, 곧 관측기 대역폭이다. 단위는 rad/s다.

| $$\omega_o$$ | 추정 속도 | 대가 |
| --- | --- | --- |
| 크다 | 빠름, 빠른 외란도 추종 | 측정 노이즈 증폭, 이산 구현 시 불안정 |
| 작다 | 느림, 빠른 외란을 놓침 | 안정적이지만 굼뜸 |

무조건 크게 두면 되지 않는다. $$\beta_3 = \omega_o^3$$가 문제다. $$\omega_o$$를 2배로 올리면 이득은 8배가 된다.

$$\omega_o \to 2\omega_o \quad\Rightarrow\quad \beta_3:\ \omega_o^3 \to 8\omega_o^3$$

관측기는 위치 노이즈를 이 이득으로 곱해 외란 추정에 싣는다. 그래서 $$\omega_o$$를 키우면 추정 외란이 노이즈로 지저분해지고, 제어 입력이 고주파로 떨린다. 대역폭을 못 올리게 막는 실제 벽이 이 노이즈다.

## 5. 관측기는 제어기보다 빠르게 — ωo ≈ 5~10 ωc

제어법칙은 외란 추정이 정확하다고 믿고 상쇄한다. 추정이 아직 수렴 중이면 틀린 값으로 상쇄하는 것이다. 그래서 관측기가 제어 루프보다 먼저 자리를 잡아야 한다.

> "The observer also needs to converge faster than the controller. Therefore, set the observer bandwidth to **5 to 10 times the controller bandwidth**."
> — [MathWorks, ADRC](https://www.mathworks.com/help/slcontrol/ug/active-disturbance-rejection-control.html)

$$\omega_o \approx (5 \sim 10)\,\omega_c$$

```mermaid
flowchart LR
    O["관측기 ωo<br/>먼저 수렴"] -->|정확한 상태·외란 추정| C["제어기 ωc<br/>그 값으로 제어"]
```

노이즈가 심하면 배율을 5쪽으로 낮추고, 측정이 깨끗하면 10쪽으로 올린다.

## ⚠️ 주의

- 위 공식은 3차 ESO(2차 플랜트) 기준이다. 1차 플랜트의 2차 ESO는 $$\beta_1 = 2\omega_o,\ \beta_2 = \omega_o^2$$다.
- 이산 구현에서는 샘플링 주기 $$T_s$$가 $$\omega_o$$의 상한을 묶는다. 11편에서 다룬다.
- 배율의 하한을 문헌에 따라 3으로 잡기도 한다. 관측기를 제어기보다 충분히 빠르게 둔다는 원칙은 같다.

## 📌 정리

- ESO 이득 세 개를 극 한 점 $$-\omega_o$$에 몰아 $$\omega_o$$ 하나로 접는다.
- 이항전개와 계수 비교로 $$\beta_1 = 3\omega_o,\ \beta_2 = 3\omega_o^2,\ \beta_3 = \omega_o^3$$.
- $$\omega_o$$는 추정 속도다. 크면 빠르지만 노이즈를 $$\omega_o^3$$로 증폭한다.
- 관측기는 제어기보다 빨라야 한다. $$\omega_o \approx (5\sim10)\,\omega_c$$.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [05. 확장상태관측기](/posts/05-extended-state-observer/) · 다음 → [07. 제어기 대역폭](/posts/07-controller-bandwidth/)

## 참고

- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](https://ieeexplore.ieee.org/document/1242516)
- [MathWorks — Active Disturbance Rejection Control](https://www.mathworks.com/help/slcontrol/ug/active-disturbance-rejection-control.html)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
