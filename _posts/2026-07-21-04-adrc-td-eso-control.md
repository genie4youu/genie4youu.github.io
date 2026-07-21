---
title: 04. 원형의 3요소 — TD / ESO / 제어법칙
date: 2026-07-21 06:04:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, td, eso, ladrc, 제어]
description: Han의 원형 ADRC는 TD·ESO·제어법칙 세 블록으로 되어 있다. 각 블록의 역할과, 실무 표준이 된 선형화 과정을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** Han, *From PID to ADRC* (IEEE TIE, 2009) · Gao, *Bandwidth-Parameterization* (ACC, 2003) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [03. 표준형](/posts/03-canonical-form/) · 다음 → [05. 확장상태관측기](/posts/05-extended-state-observer/)

---

## 1. 전체 구조

원형 ADRC는 세 블록으로 되어 있고, 각 블록이 PID의 한계 하나에 대응한다.

```mermaid
flowchart LR
    R["설정값 r"] --> TD["TD<br/>전이궤적 생성"]
    TD --> C["PD 제어법칙"]
    ESO["ESO<br/>상태·외란 추정"] --> C
    C -->|u=(u0-F̂)/b0| P["플랜트"]
    P --> ESO
    P --> Y["출력 y"]
```

| 블록 | 하는 일 | 대응하는 PID 한계 |
| --- | --- | --- |
| TD (Tracking Differentiator) | 계단을 따라갈 수 있는 궤적으로 바꾸고 미분도 같이 뽑음 | 계단 설정값, 미분의 노이즈 |
| ESO (Extended State Observer) | 상태와 총외란을 추정 | 적분의 부작용 |
| 제어법칙 | 오차를 결합해 입력 결정 | 가중합 |

## 2. TD — 계단을 부드러운 궤적으로

TD는 계단 설정값을 물리적으로 따라갈 수 있는 전이 궤적으로 바꾸고, 그 과정에서 궤적의 미분도 부산물로 얻는다. 목표가 부드럽게 올라가니 초기 오차 폭발이 없어 오버슈트가 구조적으로 줄고, 미분을 설정값 쪽에서 만들어내므로 측정 노이즈를 건드리지 않는다. TD는 생략하기도 한다. ESO가 필수 심장이고 TD는 선택적 앞단이다.

## 3. ESO — 총외란을 상태로 승격

02편의 질문 "$F$를 어떻게 추정하나"에 대한 답이다. $F$를 상태 변수 하나로 취급한다. 그래서 이름이 확장(Extended)이다. 2차 시스템이면 원래 상태 $$x_1, x_2$$에 $$x_3 = F$$를 세 번째 상태로 추가하고, 관측기가 $$\hat x_3 = \hat F$$까지 추정한다. 05편에서 상세히 다룬다.

## 4. 제어법칙 — 오차의 결합

ESO가 준 추정으로 두 단계를 밟는다. 먼저 외란을 상쇄한다.

$$u = \frac{u_0 - \hat F}{b_0}$$

그다음 깨끗해진 적분기 사슬을 움직이는 $$u_0$$를 만든다. Han의 원형은 여기에 비선형 함수(fal)를 썼다. 작은 오차에 큰 게인, 큰 오차에 완만한 게인을 주는 함수다.

## 5. 실무는 선형(LADRC)으로 갔다

Han의 원형은 강력하지만 파라미터가 많았다. 비선형 함수의 지수와 여러 게인을 다 튜닝해야 해서 현장에서 손대기 어려웠다. 2003년 Gao가 전부 선형으로 두고 파라미터를 대역폭 두 개로 접었다.

| | Han 원형 (비선형) | Gao 선형 LADRC |
| --- | --- | --- |
| 제어법칙 | 비선형 결합 | 선형 PD |
| ESO | 비선형 이득 | 선형 이득(LESO) |
| 튜닝 | 다수 파라미터, 시행착오 | $$\omega_c, \omega_o, b_0$$ 세 개, 대역폭 지정 |

이 선형화와 대역폭 파라미터화가 ADRC를 실무에 퍼지게 한 사건이다. 게인을 직접 잡는 것이 아니라 대역폭을 지정하면 게인이 공식으로 나온다. 이후 이 시리즈는 선형 LADRC를 기준으로 간다.

## ⚠️ 주의

- 비선형을 버린 것이 아니다. 원형의 비선형 요소는 성능 상한이 더 높지만, 이해와 튜닝 비용 대비 선형판이 실용적이라 표준이 됐다.
- 안전이 중요한 응용에서는 지금도 비선형·개량형을 쓴다.

## 📌 정리

- 원형 ADRC는 **TD + ESO + 제어법칙** 세 블록이다.
- TD는 계단을 부드러운 궤적으로 바꾸고 미분을 공짜로 준다. ESO는 총외란을 상태로 승격해 추정한다.
- 제어법칙은 상쇄 $$u=(u_0-\hat F)/b_0$$와 오차 결합으로 이뤄진다.
- Gao(2003)의 선형화·대역폭 파라미터화로 튜닝 노브가 $$\omega_c, \omega_o, b_0$$ 세 개로 줄었다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [03. 표준형](/posts/03-canonical-form/) · 다음 → [05. 확장상태관측기](/posts/05-extended-state-observer/)

## 참고

- [Han, From PID to Active Disturbance Rejection Control (IEEE TIE, 2009)](https://ieeexplore.ieee.org/document/4796887)
- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](https://ieeexplore.ieee.org/document/1242516)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
