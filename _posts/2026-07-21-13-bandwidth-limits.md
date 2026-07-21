---
title: 13. 대역폭을 제한하는 것들
date: 2026-07-21 06:13:00 +0900
categories: [제어 이론, ADRC]
tags: [adrc, 대역폭, 노이즈, 포화, 제어]
description: 이론상 대역폭은 클수록 좋지만 실무엔 다섯 개의 벽이 있다. 노이즈·양자화·지연·포화·공진과 진단법을 정리한다.
mermaid: true
math: true
---

> **기준 출처:** Gao, *Bandwidth-Parameterization* (ACC, 2003) · *Cascade ESO under Measurement Noise* (arXiv 2004.01483) / 확인일 2026-07-21
> **시리즈:** [목차](/posts/00-adrc-series/) · 이전 → [12. 튜닝 절차](/posts/12-tuning-procedure/) · 다음 → [14. 안정성과 강인성](/posts/14-stability-robustness/)

---

## 1. 이론은 크게, 실무는 못 크게

대역폭 $$\omega_o, \omega_c$$는 클수록 성능이 좋지만 실무에서는 어딘가에서 막힌다. 무엇이 막는지 알아야 억지로 올리다 발진시키는 사고를 막는다. 다섯 가지 벽을 본다.

## 2. 다섯 개의 벽

| 벽 | 원인 | 신호 |
| --- | --- | --- |
| 노이즈 | $$\beta_3 = \omega_o^3$$가 위치 노이즈를 증폭 | 입력이 고주파로 떨림 |
| 양자화 | 엔코더·ADC의 이산 계단 | 저속에서 속도 추정이 튐 |
| 지연 | 연산·통신·PWM 지연이 위상여유를 깎음 | 대역폭 올리자 서서히 발산 |
| 포화 | 작동기 상한, ESO 추정 오염 | 큰 목표에서만 이상 |
| 공진 | 감속기·링크 탄성 | 특정 주파수로 크게 발진 |

가장 흔한 것은 노이즈다. $$\omega_o$$를 2배 하면 $$\beta_3$$는 8배가 되고, 관측기가 위치 노이즈를 그 이득으로 곱해 외란 추정에 싣는다.

$$\omega_o \to 2\omega_o \quad\Rightarrow\quad \beta_3 = \omega_o^3 \to 8\omega_o^3$$

입력이 떨리기 시작하면 노이즈 벽에 닿은 것이다.

## 3. 지연과 포화

지연은 위상여유를 깎는다. 위상 지연은 $$\omega \cdot t_{delay}$$이므로 대역폭이 클수록 같은 지연이 더 큰 위상 손실이 된다. 연산·통신 주기가 대역폭 상한을 직접 정한다.

포화는 작동기 상한에 걸리는 것인데, ESO가 "명령한 입력이 실제로 들어갔다"고 믿고 추정하므로 포화로 실제 입력이 다르면 추정이 틀어진다. 안티windup으로 실제 입력값을 되먹여 추정 정합성을 지킨다.

## 4. 공진

```mermaid
flowchart LR
    W["대역폭 상승"] -->|공진 주파수 접근| R["공진 자극"] --> O["발진"]
```

조인트는 감속기·링크 탄성 공진이 있다. 대역폭을 그 아래로 유지해야 한다. 노치 필터를 쓰거나 대역폭을 최저 공진의 3분의 1에서 5분의 1 아래로 둔다.

## 5. 상한은 다섯의 최솟값

$$\omega_{\max} = \min(\text{노이즈, 양자화, 지연, 포화, 공진})$$

튜닝에서 대역폭을 올리다 가장 먼저 만나는 벽이 그 시스템의 상한이다. 진단은 이렇다.

| 증상 | 부딪힌 벽 |
| --- | --- |
| 입력이 고주파로 떨림 | 노이즈 또는 양자화 |
| 특정 주파수로 크게 발진 | 공진 |
| 대역폭 올리자 서서히 발산 | 지연 |
| 큰 목표에서만 이상 | 포화 |

## ⚠️ 주의

- ADRC엔 I가 없어 고전적 windup은 약하지만, ESO의 외란 추정이 포화로 오염되는 문제가 대신 생긴다.
- 노이즈에 강한 변형으로 cascade ESO가 있다.

## 📌 정리

- 실무 대역폭은 다섯 벽으로 막힌다. 노이즈·양자화·지연·포화·공진이다.
- 노이즈($$\beta_3 = \omega_o^3$$ 증폭)가 $$\omega_o$$ 천장인 경우가 가장 흔하다.
- 지연은 위상여유를 깎고, 포화는 ESO 추정을 오염시킨다.
- 실제 상한은 다섯 벽의 최솟값이다. 증상으로 어느 벽인지 진단한다.

## 시리즈

[목차](/posts/00-adrc-series/) · 이전 → [12. 튜닝 절차](/posts/12-tuning-procedure/) · 다음 → [14. 안정성과 강인성](/posts/14-stability-robustness/)

## 참고

- [Gao, Scaling and Bandwidth-Parameterization Based Controller Tuning (ACC, 2003)](http://dcsl.gatech.edu/papers/acc03.pdf)
- [Cascade Extended State Observer for ADRC under Measurement Noise (arXiv 2004.01483)](https://arxiv.org/abs/2004.01483)
- [Herbst & Madoński, ADRC: From Principles to Practice (Springer, 2025)](https://link.springer.com/book/10.1007/978-3-031-72687-3)
