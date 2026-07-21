---
title: 08. b0 — 유일한 모델 정보
date: 2026-07-21 06:08:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, b0, critical-gain, 강인성, 제어]
description: b0는 ADRC가 요구하는 유일한 모델 정보다. 스텝응답으로 구하는 법과, 틀렸을 때 총외란으로 흡수되는 강인성을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** MathWorks ADRC 문서 · Gao, *Bandwidth-Parameterization* (ACC, 2003) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [07. 제어기 대역폭](/posts/07-controller-bandwidth/) · 다음 → [09. 제어기 차수](/posts/09-adrc-order/)

---

## 1. b0만은 왜 못 버리나

ADRC는 마찰·중력·관성·비선형을 전부 총외란으로 쓸어담아 모른다고 했다. 그런데 $$b_0$$ 하나는 반드시 줘야 한다. 제어법칙에 있다.

$$u = \frac{u_0 - \hat F}{b_0}$$

$$b_0$$로 나눈다. 이것은 "원하는 만큼 움직이려면 입력을 얼마나 넣어야 하는가"의 환산 계수다. 총외란을 아무리 잘 추정해도 그것을 입력으로 되돌릴 자가 $$b_0$$다.

## 2. 스텝응답으로 구하기

정확한 물리 값을 몰라도 열린 루프 스텝 테스트로 얻는다.

1. 열린 루프에서 크기 $$u_{OL}$$인 계단을 준다.
2. 출력의 초기 모양을 근사한다. 1차면 $$y \approx a\,t$$, 2차면 $$y \approx \tfrac12 a\,t^2$$.
3. $$b_0 = a / u_{OL}$$.

모터라면 물리적으로 $$b_0 \approx K_t/J$$(토크상수 나누기 관성)에 가깝다. 데이터시트로 어림해도 되고 스텝응답으로 재도 된다.

## 3. b0가 틀리면

참 이득을 $$b$$, 사용 값을 $$b_0$$라 하면 실제 플랜트는 이렇게 정리된다.

$$\ddot y = \underbrace{\big[f(\cdot) + (b-b_0)u\big]}_{F} + b_0 u$$

$$b_0$$의 오차 $$(b-b_0)u$$가 그대로 총외란 $$F$$ 안으로 들어간다. 그리고 $$F$$는 ESO가 추정해 상쇄한다. $$b_0$$를 틀리게 잡으면 그 만큼이 추가 외란이 되어 관측기가 흡수한다.

```mermaid
flowchart LR
    B["b0 오차 (b-b0)u"] -->|총외란에 편입| F["F"]
    F -->|ESO가 추정·상쇄| OK["동작 유지"]
```

무한정은 아니다.

| $$b_0$$ 상태 | 결과 |
| --- | --- |
| 참값에 가까움 | 최선, ESO 부담 최소 |
| 다소 작거나 큼 | 동작함, ESO 부담 증가 |
| 너무 작음 | 입력 과대, 포화·발진 위험 |
| 너무 큼 | 입력 부족, 굼뜸 |
| 부호 반대 | 불안정 |

문헌 경험칙으로 대략 참값의 0.5배에서 2배 범위면 안정적으로 동작한다. 실무에서는 정밀하게 맞추기보다 대략 잡고 튜닝 노브로 쓴다.

## 4. b0 튜닝 감각

- 오버슈트가 크고 입력이 요동치면 $$b_0$$가 작다는 신호다. 키운다.
- 응답이 굼뜨고 힘이 안 실리면 $$b_0$$가 크다. 줄인다.
- $$b_0$$는 $$\omega_c, \omega_o$$와 상호작용하므로 셋을 왕복하며 맞춘다.

## ⚠️ 주의

- $$b_0$$의 부호는 절대 조건이다. 부호가 틀리면 되먹임이 뒤집혀 즉시 불안정하다.
- TDC도 같은 $$b_0$$(또는 추정 관성)를 요구하고 오차를 지연 추정으로 흡수한다. 구조가 같다.

## 📌 정리

- $$b_0$$는 추정 외란을 입력 단위로 되돌리는 척도다. ADRC가 요구하는 유일한 모델 정보다.
- 스텝응답 $$b_0 = a/u_{OL}$$로 구한다. 모터면 $$b_0 \approx K_t/J$$.
- 오차는 총외란으로 흡수된다. 대략 0.5배에서 2배 범위면 동작한다.
- 부호는 반드시 맞아야 한다. 실무에서는 튜닝 노브로 활용한다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [07. 제어기 대역폭](/posts/07-controller-bandwidth/) · 다음 → [09. 제어기 차수](/posts/09-adrc-order/)

## 참고

- [MathWorks — Active Disturbance Rejection Control](https://www.mathworks.com/help/slcontrol/ug/active-disturbance-rejection-control.html)
- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](http://dcsl.gatech.edu/papers/acc03.pdf)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
