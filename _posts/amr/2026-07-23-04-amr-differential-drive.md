---
title: 04. 차동구동 운동학과 자세 적분
description: 좌우 바퀴 속도에서 차체 선속도와 각속도를 구하고 역운동학과 pose 적분으로 Simulink AMR 플랜트를 만든 과정.
date: 2026-07-23 06:04:00 +0900
categories: [AMR, 로봇 모델링]
tags: [amr, 차동구동, kinematics, odometry, simulink, matlab]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [03. 좌표계·멀티레이트](/posts/03-amr-frames-timing/) · 다음 → [05. 2D LiDAR ray casting](/posts/05-amr-lidar-raycasting/)

두 바퀴를 독립적으로 구동하는 AMR은 바퀴 속도의 합으로 전진하고 차이로 회전한다. 이 단순한 관계가 wheel command, odometry, trajectory rollout의 공통 바닥이다.

## 순운동학

바퀴 반지름을 $r$, 좌우 바퀴 각속도를 $\omega_L,\omega_R$, 윤거를 $L$이라 하자.

$$
v=\frac{r}{2}(\omega_R+\omega_L)
$$

$$
\omega=\frac{r}{L}(\omega_R-\omega_L)
$$

차체 속도를 전역 pose 변화율로 옮기면 다음 unicycle 형태가 된다.

$$
\dot{x}=v\cos\theta,\qquad
\dot{y}=v\sin\theta,\qquad
\dot{\theta}=\omega
$$

두 바퀴가 같은 방향·같은 속도면 직진하고, 크기가 같고 방향이 반대면 제자리 회전한다. 한쪽 바퀴만 돌면 정지한 바퀴 주변의 원호를 따른다.

## 역운동학

planner는 보통 $(v,\omega)$를 내보내고 모터는 좌우 wheel speed를 받는다. 위 식을 풀면 다음과 같다.

$$
\omega_R=\frac{1}{r}\left(v+\frac{L}{2}\omega\right)
$$

$$
\omega_L=\frac{1}{r}\left(v-\frac{L}{2}\omega\right)
$$

구현에서는 부호와 단위를 직접 검증해야 한다. `rad/s`와 `m/s`를 섞거나 왼쪽·오른쪽 순서를 바꾸면 직진 검사는 통과해도 회전에서 반대 방향으로 돈다.

## 이산 pose 적분

가장 단순한 전진 Euler 적분은 다음과 같다.

$$
\begin{aligned}
x_{k+1}&=x_k+T_s v_k\cos\theta_k\\
y_{k+1}&=y_k+T_s v_k\sin\theta_k\\
\theta_{k+1}&=\operatorname{wrap}(\theta_k+T_s\omega_k)
\end{aligned}
$$

학습용 첫 구현에는 충분하지만 큰 $T_s$나 빠른 회전에서는 원호를 직선 조각으로 근사하는 오차가 커진다. 다음 단계에서는 midpoint 또는 exact arc integration과 비교하고, $\omega\to0$에서 나눗셈이 불안정하지 않게 분기해야 한다.

## 프로젝트에서 구현한 함수

```text
amr.modeling.differentialDriveForward
amr.modeling.differentialDriveInverse
amr.modeling.integrateDifferentialDrive
```

사용한 기준 파라미터는 다음과 같다.

| 항목 | 값 |
| --- | ---: |
| 바퀴 반지름 | `0.05 m` |
| 윤거 | `0.30 m` |
| plant sample time | `0.01 s` |

순·역변환 일관성, 직진, 제자리 회전, pose 적분을 기본 MATLAB `assert`로 확인했다.

## 첫 Simulink/Stateflow 수직 절편

Stateflow가 4초 직진, 2초 좌회전, 다시 4초 직진을 명령했다. 차동구동 플랜트는 시작 `[0,0,0]`에서 종료 `[2,2,pi/2]`에 도달했다.

```text
Stateflow v,ω
      ↓
Inverse kinematics
      ↓
Left/right wheel speeds
      ↓
Forward kinematics
      ↓
Pose integration
```

이 작은 모델은 상태 전이, command, wheel speed, pose 로그가 한 번에 이어지는지 확인하는 smoke test였다.

## 이상적 운동학과 실제 구동계는 다르다

현재 통합 플랜트는 평면 강체와 이상적 속도 추종을 가정한다. 아직 폐루프에 들어가지 않은 항목은 다음과 같다.

- 모터 1차 지연과 dead zone
- wheel speed saturation
- 가속도 제한을 포함한 모터 응답
- 좌우 바퀴 반경 오차
- track-width 오차
- slip, 하중, 배터리 영향

DWA command 쪽에는 속도·가속도 제한이 있지만 물리 모터 모델을 대신하지 않는다. 따라서 이 프로젝트의 `0.08 m`급 최종 오차를 실제 로봇 위치 정확도로 해석하면 안 된다.

## 검증 포인트

- 좌우 같은 속도: $\omega=0$
- 좌우 반대 속도: $v=0$
- forward → inverse → forward 왕복
- $\theta=\pm\pi$ 경계
- sample time을 바꿨을 때 적분 오차
- 포화 후 wheel speed로 실제 $(v,\omega)$ 재계산

다음 글에서는 이 ground-truth 세계를 직접 보지 않고 LiDAR 빔으로 관측하는 방법을 다룬다.

## 참고

- [MathWorks — Mobile Robot Kinematics Equations](https://www.mathworks.com/help/robotics/ug/mobile-robot-kinematics-equations.html)
- [프로젝트 차동구동 구현](https://github.com/genie4youu/amr_robot_planning/tree/main/src/%2Bamr/%2Bmodeling)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [03. 좌표계·멀티레이트](/posts/03-amr-frames-timing/) · 다음 → [05. 2D LiDAR ray casting](/posts/05-amr-lidar-raycasting/)
