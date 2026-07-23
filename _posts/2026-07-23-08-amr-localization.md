---
title: 08. Odometry, EKF, MCL — 연속 pose와 전역 보정
description: wheel odometry의 drift, EKF prediction과 measurement update, 고정 지도 기반 MCL의 역할을 구분하고 covariance health prototype을 검증한다.
date: 2026-07-23 06:08:00 +0900
categories: [AMR, 위치추정]
tags: [amr, odometry, ekf, mcl, localization, covariance]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [07. 점유격자와 log-odds](/posts/07-amr-occupancy-logodds/) · 다음 → [09. Scan matching](/posts/09-amr-scan-matching/)

로봇의 위치추정에는 서로 다른 역할의 추정기가 있다. wheel odometry는 연속적인 짧은 시간 motion에 강하고, 지도 기반 localization은 누적 drift를 전역 기준으로 보정한다. 하나의 pose 숫자로 합치기 전에 각 추정기가 무엇을 보장하는지 구분해야 한다.

## wheel odometry

좌우 바퀴의 회전 증분으로 이동 거리와 heading 변화를 구한다.

$$
\Delta s_R=r\Delta\phi_R,\qquad
\Delta s_L=r\Delta\phi_L
$$

$$
\Delta s=\frac{\Delta s_R+\Delta s_L}{2},\qquad
\Delta\theta=\frac{\Delta s_R-\Delta s_L}{L}
$$

odometry는 scan이 잠시 없어도 부드럽게 이어진다. 하지만 wheel radius 오차, track-width 오차, slip이 매 step 누적되므로 장시간의 전역 정확도를 보장하지 않는다.

## EKF의 두 단계

Extended Kalman Filter는 nonlinear motion model을 현재 상태 주변에서 선형화한다. 상태를 단순하게 다음처럼 둘 수 있다.

$$
\mathbf{x}=[x,\;y,\;\theta]^T
$$

prediction:

$$
\hat{\mathbf{x}}^-_k=f(\hat{\mathbf{x}}_{k-1},\mathbf{u}_k)
$$

$$
P^-_k=F_kP_{k-1}F_k^T+Q_k
$$

measurement update:

$$
\mathbf{y}_k=\mathbf{z}_k-h(\hat{\mathbf{x}}^-_k)
$$

$$
K_k=P^-_kH_k^T(H_kP^-_kH_k^T+R_k)^{-1}
$$

$$
\hat{\mathbf{x}}_k=\hat{\mathbf{x}}^-_k+K_k\mathbf{y}_k
$$

heading innovation은 반드시 `[-pi,pi]`로 정규화한다. $\pi$ 경계를 건너는 작은 차이를 큰 회전 오차로 해석하면 update가 망가진다.

## covariance도 출력이다

pose 평균만 내보내면 추정기가 얼마나 자신 있는지 알 수 없다. 프로젝트는 covariance에서 position sigma와 heading sigma를 계산해 health를 만들었다.

```text
prediction만 장시간 지속
→ covariance 증가
→ position sigma 임계 초과
→ localization degraded
→ 유효 pose measurement 반복
→ covariance 감소
→ healthy 복귀
```

600회 prediction 동안 covariance trace가 증가하고 position sigma가 `0.08 m` 임계를 넘는지 확인했다. 이후 반복 update로 covariance와 health가 회복되는 것도 검증했다.

## MCL은 고정 지도에서 전역 pose를 찾는다

Monte Carlo Localization은 여러 particle로 pose 분포를 표현한다.

1. 초기 particle 생성
2. odometry motion model로 전파
3. LiDAR와 map 일치도로 weight 계산
4. weight 정규화
5. effective sample size가 작으면 resampling
6. weighted pose와 covariance 계산

초기 구현은 beam endpoint가 occupied cell에 닿는 정도를 점수로 쓸 수 있다. 더 부드러운 likelihood-field 방식은 장애물 distance field를 이용한다.

MCL은 여러 가설과 kidnapped robot 문제를 다룰 수 있지만 particle 수와 scan score 비용이 필요하다. 대칭 복도에서는 서로 다른 위치가 비슷한 scan을 만들어 분포가 여러 군집으로 갈라질 수 있다.

## 실패를 pose 숫자로 숨기지 않는다

다음 조건에서는 추정 결과와 함께 실패 상태를 내보내야 한다.

- covariance 임계 초과
- 모든 particle weight가 거의 0
- 장시간 유효 update 없음
- 추정 pose가 occupied cell
- innovation이 비정상적으로 큼
- particle distribution이 다봉성

Stateflow Health region은 이 상태를 받아 degraded mode나 fault로 전환해야 한다.

## 현재 구현과 계획의 경계

현재 구현된 것은 `[x,y,theta]` pose EKF의 prediction/update와 covariance health prototype이다. 아직 하지 않은 것은 wheel encoder/IMU 생성, slip과 bias를 포함한 폐루프 odometry, MCL, kidnapped robot 복구다. EKF health도 통합 Industrial Supervisor 입력에는 아직 연결하지 않았다.

다음 두 글의 SLAM은 localization과 mapping을 함께 풀지만, 현재 프로젝트에서는 이론·구현 계획 단계로 남아 있다.

## 참고

- [MathWorks — Monte Carlo Localization Algorithm](https://www.mathworks.com/help/nav/ug/monte-carlo-localization-algorithm.html)
- [Nav2 — Navigation Concepts](https://docs.nav2.org/concepts/index.html)
- [프로젝트 localization prototype](https://github.com/genie4youu/amr_robot_planning/tree/main/src/%2Bamr/%2Blocalization)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [07. 점유격자와 log-odds](/posts/07-amr-occupancy-logodds/) · 다음 → [09. Scan matching](/posts/09-amr-scan-matching/)
