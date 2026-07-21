---
title: 12. 튜닝 절차
date: 2026-07-21 06:12:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, 튜닝, 대역폭, b0, 제어]
description: LADRC의 노브는 b0·ωc·ωo 세 개다. 조정 순서와 증상별 처방, ωc와 b0를 구분하는 법을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** MathWorks ADRC 문서 · Gao, *Bandwidth-Parameterization* (ACC, 2003) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [11. 이산화](/posts/11-discretization/) · 다음 → [13. 대역폭을 제한하는 것들](/posts/13-bandwidth-limits/)

---

## 1. 튜닝할 것은 세 개

LADRC의 노브는 $$b_0, \omega_c, \omega_o$$뿐이다. 게인은 이 셋에서 자동으로 나온다. 그래서 서로 얽힌 $$K_p, K_i, K_d$$보다 체계적이다. 순서가 중요하다.

```mermaid
flowchart LR
    Ts["Ts 확인"] --> N["차수"] --> B0["b0"] --> WC["ωc"] --> WO["ωo=5~10ωc"] --> F["미세조정"]
```

## 2. 단계별

| 단계 | 할 일 |
| --- | --- |
| Ts 확인 | $$\omega_o T_s \lesssim 0.1{\sim}0.5$$가 대역폭 천장. 넘으면 샘플링을 먼저 올린다 |
| 차수 | 관성체 위치는 2차, 속도·전류 루프는 1차. 스텝응답이 직선이면 1차, 포물선이면 2차 |
| b0 | 스텝응답 $$b_0 = a/u_{OL}$$ 또는 $$K_t/J$$. 부호만 확실히 |
| ωc | 낮은 값에서 시작해 서서히 올림. 오버슈트 직전까지 |
| ωo | $$\omega_o = (5{\sim}10)\,\omega_c$$. 노이즈 심하면 5쪽, 깨끗하면 10쪽 |

$$\omega_c$$를 올릴 때 $$\omega_o$$도 비율을 유지하며 같이 올린다. $$\omega_o$$를 더 올리면 추정은 빨라지지만 노이즈가 증폭돼 입력이 떨린다. 입력이 떨리기 시작하면 $$\omega_o$$를 낮춘다.

## 3. 증상별 처방

| 증상 | 원인 후보 | 처방 |
| --- | --- | --- |
| 응답이 굼뜸 | $$\omega_c$$ 작음 | $$\omega_c$$ 올림 |
| 오버슈트·입력 요동 | $$\omega_c$$ 큼 또는 $$b_0$$ 작음 | $$\omega_c$$ 낮춤 또는 $$b_0$$ 올림 |
| 입력이 고주파로 떨림 | $$\omega_o$$ 큼 | $$\omega_o$$ 낮춤 |
| 외란 대응 느림 | $$\omega_o$$ 작음 | $$\omega_o$$ 올림 |
| 힘이 과함/모자람 | $$b_0$$ 어긋남 | $$b_0$$ 조정 |

## 4. ωc와 b0 구분

둘 다 입력 크기에 영향을 줘 헷갈린다. $$\omega_c$$는 "얼마나 빠르게 갈까"이고, $$b_0$$는 "입력 1이 얼마나 먹히는가의 환산"이다.

- 입력이 요동치는데 응답 속도는 그대로면 $$b_0$$ 문제다.
- 응답 자체가 너무 공격적이면 $$\omega_c$$ 문제다.

## ⚠️ 주의

- 안전이 중요한 응용에서는 대역폭을 성능 한계까지 밀지 말고 위상여유를 남긴다.
- 포화·안티windup·차수 오판을 반드시 점검한다. 13편에서 다룬다.

## 📌 정리

- 노브는 $$b_0, \omega_c, \omega_o$$ 세 개, 게인은 자동이다. 순서는 Ts, 차수, b0, ωc, ωo, 미세조정이다.
- $$\omega_c$$는 낮게 시작해 서서히 올리고, $$\omega_o$$는 그 5배에서 10배다.
- 입력만 떨리면 $$b_0$$, 응답이 공격적이면 $$\omega_c$$다.
- 안전이 중요하면 대역폭에 여유를 두고 최악 조건을 먼저 확인한다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [11. 이산화](/posts/11-discretization/) · 다음 → [13. 대역폭을 제한하는 것들](/posts/13-bandwidth-limits/)

## 참고

- [MathWorks — Active Disturbance Rejection Control](https://www.mathworks.com/help/slcontrol/ug/active-disturbance-rejection-control.html)
- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](http://dcsl.gatech.edu/papers/acc03.pdf)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
