---
title: 05. 확장상태관측기(ESO)
date: 2026-07-21 06:05:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, eso, 관측기, luenberger, 제어]
description: 외란을 상태로 승격하면 model-free인데도 관측기가 성립한다. ESO의 구조와 수렴 원리를 정리하고 TDC와 비교한다.
mermaid: true
math: true
---

> **기준 출처:** Herbst & Madoński, *ADRC: From Principles to Practice* (Springer, 2025) · Han, *From PID to ADRC* (IEEE TIE, 2009) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [04. 원형의 3요소](/posts/04-adrc-td-eso-control/) · 다음 → [06. 관측기 대역폭](/posts/06-observer-bandwidth/)

---

## 1. 관측기의 뼈대

관측기(observer)는 측정되지 않는 상태를 측정되는 것으로부터 추정한다. 모터에서 위치만 읽을 때 속도를 추정하는 것이 전형적인 예다. Luenberger 관측기의 구조는 이렇다.

$$\dot{\hat x} = \underbrace{A\hat x + Bu}_{\text{모델로 예측}} + \underbrace{L(y - \hat y)}_{\text{측정으로 교정}}$$

이득 $$L$$이 크면 측정을 더 믿어 빨리 수렴하지만 노이즈에 민감하고, 작으면 반대다.

## 2. ESO의 한 수 — 총외란을 상태로 승격

보통 관측기는 아는 모델 $$A$$가 필요하다. ADRC는 model-free인데 어떻게 관측기를 다나. 모르는 것 $$F$$를 통째로 상태 변수 하나로 세운다. 그래서 이름이 확장(Extended)이다.

2차 시스템 $$\ddot y = F + b_0 u$$에서 상태를 이렇게 잡는다.

$$x_1 = y, \quad x_2 = \dot y, \quad x_3 = F$$

확장된 상태공간은 다음과 같다. $$F$$의 변화 $$\dot F = h(t)$$는 무엇인지 몰라도 되고, 유계라고만 가정한다.

$$\dot x_1 = x_2, \qquad \dot x_2 = x_3 + b_0 u, \qquad \dot x_3 = h(t)$$

이 식에는 마찰도 중력도 관성 값도 없다. 아는 것은 $$b_0$$와 적분기 사슬 구조뿐이다. 그래서 model-free 관측기가 성립한다.

## 3. ESO 방정식

측정은 $$y = x_1$$뿐이다. Luenberger 구조를 그대로 씌운다.

$$
\begin{aligned}
\dot{\hat x}_1 &= \hat x_2 + \beta_1(y-\hat x_1)\\
\dot{\hat x}_2 &= \hat x_3 + b_0 u + \beta_2(y-\hat x_1)\\
\dot{\hat x}_3 &= \beta_3(y-\hat x_1)
\end{aligned}
$$

$$\hat x_3 \to F$$가 목적이다. 하나의 오차 신호 $$(y-\hat x_1)$$이 세 이득을 통해 세 추정을 동시에 끌고 간다.

## 4. 왜 수렴하나

추정 외란 $$\hat x_3$$가 참 $$F$$보다 작다고 하자. 그러면 모델 예측이 실제보다 작아 $$\hat x_1$$이 실제 $$y$$보다 뒤처지고, 오차 $$(y-\hat x_1)$$이 양수가 되어 $$\beta_3(y-\hat x_1)$$이 $$\hat x_3$$를 밀어 올린다. 반대도 대칭이다.

```mermaid
flowchart LR
    E["추정 외란이 틀림"] --> D["출력 추정이 어긋남"]
    D --> C["오차 신호 발생"]
    C -->|β3로 되먹임| E
```

추정이 틀리면 그 틀림이 출력 오차로 드러나고, 되먹여져 스스로 교정된다. 이 루프가 충분히 빠르면 $$\hat x_3 \to F$$가 된다. "충분히 빠르면"이 조건이고, 그 빠르기를 이득 $$\beta_1, \beta_2, \beta_3$$가 정한다. 이 셋을 대역폭 하나로 묶는 것이 06편이다.

## 5. TDC와의 비교

02편에서 TDC는 과거값 $$\hat F(t)=\ddot y(t{-}L)-b_0 u(t{-}L)$$을 썼다. ESO는 그 대신 되먹임 루프로 능동 추정한다. TDC가 "지난 순간의 $F$를 그대로 쓴다"면, ESO는 "출력 오차를 보며 $F$를 계속 조정한다". 그래서 ESO는 $$\ddot y$$를 직접 미분하지 않아도 되고, 빠르기를 $$\omega_o$$로 자유롭게 정한다. 대가는 이득 튜닝이 필요하다는 것이다.

## ⚠️ 주의

- ESO는 Luenberger 관측기의 특수한 경우다. 다른 점은 모델 안에 총외란을 입력 외란으로 넣었다는 것뿐이다.
- $$\dot F = h(t) \neq 0$$이라 추정은 정확히 0 오차가 아니라 유계로 수렴한다.

## 📌 정리

- 관측기는 측정되지 않는 상태를 측정에서 추정한다. 예측과 교정, 이득 $$L$$로 이뤄진다.
- ESO는 총외란 $$F$$를 상태 $$x_3$$로 승격해, model-free인데도 관측기를 성립시킨다.
- ESO를 돌리면 위치·속도와 함께 $$\hat x_3 = \hat F$$가 딸려 나온다.
- 수렴 원리는 자가 교정이며, 관측기가 충분히 빨라야 한다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [04. 원형의 3요소](/posts/04-adrc-td-eso-control/) · 다음 → [06. 관측기 대역폭](/posts/06-observer-bandwidth/)

## 참고

- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
- [Han, From PID to Active Disturbance Rejection Control (IEEE TIE, 2009)](https://ieeexplore.ieee.org/document/4796887)
- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](http://dcsl.gatech.edu/papers/acc03.pdf)
