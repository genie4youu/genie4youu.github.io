---
title: 13. Local costmap과 Pure Pursuit
description: 로봇 중심 local window에 최신 LiDAR 장애물을 표시하고 전역 경로의 lookahead point를 추종하는 Pure Pursuit 기준 제어기를 정리한다.
date: 2026-07-23 06:13:00 +0900
categories: [AMR, 지역 경로계획]
tags: [amr, local-costmap, pure-pursuit, path-tracking, lidar]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [12. Path smoothing](/posts/12-amr-path-smoothing/) · 다음 → [14. Dynamic Window Approach](/posts/14-amr-dwa/)

전역 costmap은 전체 경로를 찾는 데 적합하지만 최신 동적 장애물을 빠르게 반영하기에는 크고 느리다. local costmap은 로봇 주변의 작은 window에서 최근 sensor 관측과 정적 지도를 합친다.

## local costmap의 책임

- 최신 LiDAR hit marking
- beam을 따라 free-space clearing
- 오래된 동적 장애물 decay
- robot footprint 주변 clearing
- obstacle inflation
- stale scan 거부

프로젝트의 window는 로봇 중심 `6 m × 6 m`다. 정적 안전 지도와 raw static map에 없던 새로운 LiDAR hit를 합치고, hit point를 `0.30 m` 팽창시킨다.

## truth map을 그대로 주지 않는다

초기 DWA 구현은 scenario의 동적 장애물 rectangle 전체를 local planner에 직접 제공했다. 회피는 잘 됐지만 센서 범위와 dropout을 무시했다. 보이지 않는 장애물까지 아는 planner였기 때문에 이 접근을 폐기했다.

현재 local costmap에는 다음만 들어간다.

```text
robot 주변 static occupancy
+ LiDAR가 실제로 검출한 novel hit
= local planning map
```

동적 장애물이 scan에 들어오기 전에는 local planner가 알지 못한다. 그래서 LiDAR FOV, delay, freshness가 실제 주행 결과에 영향을 준다.

## Pure Pursuit의 기하

Pure Pursuit는 global path에서 로봇보다 앞선 lookahead point를 고르고 그 점을 향하는 원호 곡률을 계산한다.

로봇 base frame의 lookahead point를 $(x_L,y_L)$, lookahead distance를 $L_d$라 하면 curvature는 다음과 같이 쓸 수 있다.

$$
\kappa=\frac{2y_L}{L_d^2}
$$

선속도 $v$를 정하면 각속도는

$$
\omega=v\kappa
$$

가 된다.

## lookahead의 trade-off

| lookahead | 거동 |
| --- | --- |
| 짧음 | path에 민감하게 붙지만 oscillation 가능 |
| 긺 | 부드럽지만 corner cutting 가능 |

goal 근처에서는 남은 거리보다 긴 lookahead를 그대로 쓰지 않고 속도를 줄이며 정지 조건을 별도로 둔다.

## Pure Pursuit를 기준선으로 두는 이유

Pure Pursuit는 trajectory 후보를 여러 개 rollout하지 않는다. 그래서 장애물 회피보다 “경로가 정상일 때 controller와 plant가 제대로 연결됐는가”를 확인하는 기준선으로 좋다.

다음 비교가 가능하다.

- 같은 path에서 기본 cross-track error
- lookahead에 따른 corner cutting
- DWA가 장애물 때문에 path에서 얼마나 벗어나는가
- goal 접근 시 overshoot

## 현재 프로젝트 구현 상태

local costmap의 LiDAR hit marking/inflation과 검증은 구현했다. 다만 일반 배송·충전·경로복귀의 기준 controller는 아직 정식 Pure Pursuit 함수가 아니라 pose-feedback waypoint follower다. Pure Pursuit의 독립 함수와 lookahead 비교는 계획 항목이다.

장애물 scenario에서는 local costmap을 DWA에 전달한다. local costmap 구현이 통과한 뒤에야 trajectory rollout과 cost tuning을 시작했다.

## stale 관측과 decay

움직이는 장애물이 사라진 뒤 hit를 영구히 남기면 local map이 점점 막힌다. 반대로 너무 빠르게 지우면 잠시 가려진 장애물이 사라진다. timestamp와 관측 지속시간을 이용한 decay가 필요하다.

현재 프로젝트는 deterministic 장애물과 scan-derived hit를 사용하지만 일반적인 decay와 ray clearing은 완성되지 않았다. 이 또한 “local costmap이 있다”는 말 속에서 구분해야 할 경계다.

## 참고

- [MathWorks — Pure Pursuit Controller](https://www.mathworks.com/help/robotics/ug/pure-pursuit-controller.html)
- [Nav2 — Obstacle Layer](https://docs.nav2.org/configuration/packages/costmap-plugins/obstacle.html)
- [프로젝트 local costmap 구현](https://github.com/genie4youu/amr_robot_planning/blob/main/src/%2Bamr/%2Bplanning/buildLocalCostmapFromLidar.m)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [12. Path smoothing](/posts/12-amr-path-smoothing/) · 다음 → [14. Dynamic Window Approach](/posts/14-amr-dwa/)
