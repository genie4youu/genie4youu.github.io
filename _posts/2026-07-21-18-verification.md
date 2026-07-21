---
title: 18. 검증 — Simulink와 C 시뮬레이션
date: 2026-07-21 06:18:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, 검증, simulink, c, 제어]
description: ADRC를 두 경로로 확인한다. Simulink 블록으로 빠르게 PID와 비교하고, 손으로 짠 C 시뮬레이션으로 원리를 검증한다.
mermaid: true
math: true
---

> **기준 출처:** MathWorks ADRC 문서 · Herbst & Madoński (Springer, 2025, Ch.10) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [17. 모터 조인트 루프 구조](/posts/17-motor-joint-loops/)

---

## 1. 두 경로로 확인

이론은 직접 돌려보지 않으면 안다고 할 수 없다. 두 경로로 확인한다. 하나는 제품이 제공하는 Simulink ADRC 블록으로 빠르게 거동을 보고 PID와 비교하는 것이고, 다른 하나는 ESO·제어법칙을 직접 코드로 옮겨 원리를 검증하는 것이다. 아래 예제 코드는 공개 원리로 처음부터 작성한 것이다.

## 2. 검증 시나리오

ADRC의 가치는 외란과 모델 변화에서 나온다. 검증도 거기에 맞춘다.

| 시나리오 | 보는 것 | ADRC 기대 |
| --- | --- | --- |
| 계단 응답 | 기본 추종, 오버슈트 | PID와 비슷하거나 나음 |
| 외란 주입 | 외란 억제 | ESO가 추정·상쇄, 회복 빠름 |
| 파라미터 변화 | 강인성 | PID는 재튜닝 필요, ADRC는 버팀 |
| 측정 노이즈 | 노이즈 민감도 | $$\omega_o$$ 크면 입력 떨림 확인 |

핵심은 같은 플랜트에 PID와 ADRC를 나란히 두는 것이다. 외란 주입과 파라미터 변화에서 차이가 극적으로 드러난다. 계단만 보면 정상 상태에서는 등가라 차이가 안 보인다.

## 3. Simulink 경로

블록 설정은 앞 편들과 1:1로 대응한다.

| 파라미터 | 정하는 법 |
| --- | --- |
| Order | 1차/2차, 스텝 모양으로 |
| Critical gain $$b_0$$ | 스텝응답 $$a/u_{OL}$$ |
| Controller bandwidth $$\omega_c$$ | 원하는 응답 속도 |
| Observer bandwidth $$\omega_o$$ | $$5\sim10\,\omega_c$$ |

플랜트 모델에 ADRC 블록을 붙이고 네 파라미터를 넣은 뒤 12편 순서로 튜닝하고 PID 블록과 병렬로 비교한다.

## 4. C 시뮬레이션 경로

11편의 이산식을 그대로 C로 옮긴다. 플랜트도 같은 코드에서 적분해 닫힌 루프를 만든다.

```c
// 2차 LADRC — 이산(전진 Euler), 원리 확인용
typedef struct { double z1, z2, z3; } ESO;   // 위치, 속도, 총외란

void eso_update(ESO* o, double y, double u,
                double b0, double wo, double Ts) {
    double b1 = 3*wo, b2 = 3*wo*wo, b3 = wo*wo*wo;
    double e  = y - o->z1;
    o->z1 += Ts * (o->z2 + b1*e);
    o->z2 += Ts * (o->z3 + b0*u + b2*e);
    o->z3 += Ts * (b3*e);
}

double adrc_step(ESO* o, double r, double y, double u_prev,
                 double b0, double wc, double wo, double Ts) {
    eso_update(o, y, u_prev, b0, wo, Ts);
    double kp = wc*wc, kd = 2*wc;
    double u0 = kp*(r - o->z1) + kd*(0.0 - o->z2);
    double u  = (u0 - o->z3) / b0;
    return saturate(u, U_MIN, U_MAX);
}
```

검증 포인트는 이렇다. 총외란 추정 z3가 실제 주입 외란으로 수렴하는지 로그로 확인한다. $$b_0$$를 일부러 2배 틀리게 넣어도 동작하는지 본다. $$\omega_o$$를 키우며 노이즈 상황에서 입력 떨림을 관찰한다. 같은 시나리오로 PID 버전과 비교한다.

## 5. 시리즈 종료 점검

이 시리즈를 마치면 다음을 스스로 설명할 수 있어야 한다.

```mermaid
flowchart LR
    A["총외란·ESO"] --> B["대역폭 파라미터화"] --> C["차수·b0"] --> D["이산·구현"] --> E["조인트 적용"]
```

- ADRC가 PID의 무엇을 잇고 무엇을 바꿨나
- 총외란을 왜 묶고 어떻게 상쇄하나
- ESO가 왜 model-free인데 추정이 되나
- $$\omega_c, \omega_o, b_0$$ 각각이 무엇이고 어떻게 정하나
- 차수를 어떻게 고르나, 대역폭이 어디서 막히나
- 조인트 어느 루프에 넣고 임피던스와 어떻게 결합하나

## ⚠️ 주의

- 계단 응답만으로는 PID와 차이가 안 보인다. 외란 주입과 파라미터 변화를 반드시 넣는다.
- C 스켈레톤은 순수 C라 별도 라이브러리 없이 컴파일된다.

## 📌 정리

- 검증은 두 경로다. Simulink 블록으로 빠른 비교, 손 C 시뮬로 원리 확인이다.
- 시나리오는 ADRC가 이기는 곳(외란 주입, 파라미터 변화)에 맞춘다.
- Simulink 네 파라미터는 앞 편들과 1:1로 대응한다.
- C 스켈레톤으로 총외란 수렴·$$b_0$$ 강인성·노이즈 떨림을 직접 확인한다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [17. 모터 조인트 루프 구조](/posts/17-motor-joint-loops/)

## 참고

- [MathWorks — Active Disturbance Rejection Control](https://www.mathworks.com/help/slcontrol/ug/active-disturbance-rejection-control.html)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](https://ieeexplore.ieee.org/document/1242516)
