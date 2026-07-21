---
title: 14. 안정성과 강인성
date: 2026-07-21 06:14:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, 안정성, 강인성, 분리원리, 제어]
description: ADRC는 관측기 루프와 제어 루프의 겹침이다. 분리 원리, b0 강인 범위, 주파수 영역 검증을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** Herbst & Madoński, *ADRC: From Principles to Practice* (Springer, 2025) · Gao, *Bandwidth-Parameterization* (ACC, 2003) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [13. 대역폭을 제한하는 것들](/posts/13-bandwidth-limits/) · 다음 → [15. 실시간 임베디드 구현](/posts/15-realtime-embedded/)

---

## 1. 두 가지를 나눈다

안정성은 추정 오차와 제어 오차가 발산하지 않고 유계로 수렴하는가이고, 강인성은 $$b_0$$ 오차·모델 변화·외란이 있어도 성능이 유지되는가이다. 대역폭 파라미터화 덕분에 둘 다 분석이 깔끔하다. 극이 $$-\omega_o, -\omega_c$$에 몰려 위치가 명확하기 때문이다.

## 2. 안정성 — 두 루프의 겹침

ADRC는 사실상 두 루프다.

```mermaid
flowchart LR
    O["관측기 루프<br/>극 -ωo"] -->|정확한 상태 전달| C["제어 루프<br/>극 -ωc"]
```

관측기 루프의 추정 오차 극은 $$-\omega_o$$, 제어 루프의 오차 극은 $$-\omega_c$$다. 둘 다 $$>0$$이면 안정이다. 관측기가 제어기보다 충분히 빠르면($$\omega_o \gg \omega_c$$), 두 루프를 거의 독립으로 봐도 된다. 관측기가 먼저 수렴해 정확한 상태를 넘기고 제어 루프가 그것을 받는다. 이것이 $$\omega_o \approx 5\sim10\,\omega_c$$의 안정성 근거다. 너무 가까우면 두 루프가 상호작용해 발진 위험이 생긴다.

ESO는 총외란을 완벽히 맞히지 못하고 유계로 수렴한다. $$\omega_o$$가 클수록 그 유계가 작아진다. 정확히 0이 아니라 충분히 작게다.

## 3. 강인성 — b0 오차 허용 범위

참 이득 $$b$$, 사용 값 $$b_0$$, 비율 $$\rho = b/b_0$$라 하면 이렇다.

| $$\rho$$ | 결과 |
| --- | --- |
| 1 | 완벽 |
| 0.5 ~ 2 근처 | 안정적으로 동작 |
| 너무 크거나 작음 | 흡수할 외란이 과도해져 발진 |
| 음수(부호 반대) | 즉시 불안정 |

$$b_0$$를 작게 잡으면 가짜 외란이 커져 ESO가 실효 대역폭을 소모한다. $$b_0$$ 오차는 공짜 흡수가 아니라 강인성 여유를 빌려 쓰는 것이다. 여유가 바닥나면 불안정하다.

## 4. 주파수 영역 검증

시간 영역 설계를 10편의 등가 전달함수로 옮기면 주파수 도구를 쓸 수 있다.

- 위상여유는 보통 30도에서 60도를 확보한다. 지연이 이걸 깎으므로 대역폭을 올릴 때 감시한다.
- 감도함수는 외란 억제 성능이다. $$\omega_o$$가 클수록 저주파 외란을 잘 누르지만 고주파에서 노이즈가 증폭된다.
- $$b_0, \omega$$ 변동에 대한 이득·위상 마진을 Bode에서 읽는다.

## ⚠️ 주의

- ESO 수렴은 정확히 0이 아니라 유계다. 느린 외란일수록 추정이 정확하다.
- 안전이 중요한 응용에서는 최악 부하에서 $$\rho$$가 안전 범위인지 확인하고, 통신·연산 지연을 포함한 실측 위상여유를 확보한다.

## 📌 정리

- ADRC는 관측기 루프($$-\omega_o$$)와 제어 루프($$-\omega_c$$)의 겹침이다. $$\omega_o \gg \omega_c$$면 **분리 원리**로 독립 분석된다.
- ESO는 유계로 수렴하며 $$\omega_o$$가 클수록 오차 유계가 작다.
- $$b/b_0$$가 대략 0.5에서 2 사이면 안정, 부호 반대는 즉시 불안정하다.
- 검증은 주파수 영역에서 한다. 위상여유 30도에서 60도, 감도함수를 본다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [13. 대역폭을 제한하는 것들](/posts/13-bandwidth-limits/) · 다음 → [15. 실시간 임베디드 구현](/posts/15-realtime-embedded/)

## 참고

- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](https://ieeexplore.ieee.org/document/1242516)
- [Active disturbance rejection control: between the formulation in time and the understanding in frequency (2016)](https://link.springer.com/article/10.1007/s11768-016-6059-9)
