---
title: 15. 실시간 임베디드 구현
date: 2026-07-21 06:15:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, 임베디드, 실시간, 지터, 제어]
description: ADRC를 MCU에 얹으면 무엇이 도는가. 연산량이 아니라 타이밍의 결정성이 성능을 좌우한다. 지터·실행시간 예산·수 표현을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** MathWorks ADRC 문서 · TI, *What it takes to do real-time control* (spry157) · Herbst & Madoński (Springer, 2025, Ch.9) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [14. 안정성과 강인성](/posts/14-stability-robustness/) · 다음 → [16. 제어 전용 보조 코어(CLA)](/posts/16-cla-accelerator/)

---

## 1. MCU에서 실제로 도는 것

한 제어 주기 $$T_s$$마다 이 순서가 돈다.

```c
// 매 Ts 마다 (예: 10 kHz → 100 us)
y  = read_encoder();               // 1. 측정
eso_update(y, u_prev);             // 2. ESO: 위치·속도·총외란 추정
u0 = kp*(r - y_hat) + kd*(dr - v_hat);   // 3. 제어법칙(PD)
u  = (u0 - f_hat) / b0;            // 4. 외란 상쇄
u  = saturate(u, u_min, u_max);    // 5. 포화 처리
write_pwm(u);                      // 6. 출력
u_prev = u;
```

전부 곱셈과 덧셈 몇십 번이다. ADRC의 연산량은 작다. 문제는 연산량이 아니라 타이밍이다.

## 2. 지터가 성능이다

제어 성능은 평균 주기가 아니라 주기의 일정함에 달렸다. $$T_s$$가 매번 흔들리면(지터), 이산 ESO의 계수가 가정한 $$T_s$$와 어긋나 추정이 오염된다.

- 인터럽트 지연의 변동이 지터를 만든다. 다른 인터럽트가 끼어들면 제어 인터럽트가 밀린다.
- 그래서 제어 루프는 최고 우선순위여야 하고, 그 안에서 블로킹과 긴 연산을 피한다.
- 측정 시점이 흔들리면 그것도 지터다. ADC 트리거를 타이머·PWM에 하드웨어로 동기시킨다.

이 지터를 없애려는 요구가 제어 전용 보조 코어를 낳는다. 16편에서 다룬다.

## 3. 실행시간 예산

한 주기 $$T_s$$ 안에 읽기·ESO·제어·쓰기가 다 끝나야 한다.

$$t_{ADC} + t_{ESO} + t_{law} + t_{PWM} + t_{margin} < T_s$$

10 kHz면 $$T_s = 100\,\mu s$$다. 2차 ESO는 부동소수점으로 수 마이크로초라 여유가 있다. 다만 여러 축을 한 MCU가 돌리면 합산해야 한다. 연산 지연이 곧 위상 지연이므로 예산을 빡빡하게 쓰면 대역폭이 깎인다.

## 4. 부동소수점과 고정소수점

| | 부동소수점 | 고정소수점 |
| --- | --- | --- |
| $$\omega_o^3$$ 같은 큰 수 | 자연스럽게 처리 | 오버플로·스케일링 관리 필요 |
| 구현 난이도 | 쉬움 | 어려움 |
| 하드웨어 | FPU 필요 | 저가 MCU 가능 |

ADRC는 $$\omega_o^3$$, $$b_0$$ 나눗셈 등 동적 범위가 큰 연산이 많아 부동소수점이 사실상 표준이다.

## 5. 초기화와 모드 전환

```mermaid
flowchart LR
    S["시작"] -->|ESO를 현재 측정으로 초기화| N["정상 제어"]
    N -->|이상 감지| F["안전 상태로 전환"]
```

시작 시 ESO 상태를 현재 측정으로 세팅해 초기 튐을 막는다. 다른 제어기와 ADRC 사이를 전환할 때는 입력이 튀지 않게 상태를 정합시킨다(범프리스). 이상 시 안전 상태로 전이하는 상위 관리는 유한 상태 머신(FSM)의 몫이다. 연속 제어를 감독하는 이산 로직이다.

## ⚠️ 주의

- 지터를 줄이려면 ADC를 하드웨어로 동기시키고 제어 루프를 최고 우선순위로 둔다.
- current estimator ESO(11편)로 ADC 직후 즉시 갱신하면 연산 지연을 최소화할 수 있다.

## 📌 정리

- ADRC 연산량은 작다. 진짜 문제는 **타이밍의 결정성**이다.
- 지터가 이산 ESO 계수를 오염시킨다. 제어 루프를 최고 우선순위로, ADC를 하드웨어 동기로.
- 실행시간 예산 안에 읽기·ESO·제어·쓰기를 끝낸다. 연산 지연은 위상 지연이다.
- $$\omega_o^3$$·나눗셈 때문에 부동소수점이 표준이다. 모드 전환은 상위 FSM이 감독한다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [14. 안정성과 강인성](/posts/14-stability-robustness/) · 다음 → [16. 제어 전용 보조 코어(CLA)](/posts/16-cla-accelerator/)

## 참고

- [MathWorks — Active Disturbance Rejection Control](https://www.mathworks.com/help/slcontrol/ug/active-disturbance-rejection-control.html)
- [TI — What it takes to do real-time control (spry157)](https://www.ti.com/lit/wp/spry157/spry157.pdf)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
