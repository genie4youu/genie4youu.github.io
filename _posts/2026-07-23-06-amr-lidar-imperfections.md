---
title: 06. LiDAR 노이즈·dropout·delay와 watchdog
description: 완벽한 가상 LiDAR에 range noise, beam과 frame dropout, 1-sample delay, hold-last와 freshness watchdog을 넣고 복귀까지 검증한다.
date: 2026-07-23 06:06:00 +0900
categories: [AMR, 센서]
tags: [amr, lidar, noise, dropout, delay, watchdog, safety]
image:
  path: /assets/img/amr/2026-07-22_scenario_ui_lidar_dwa.png
  alt: LiDAR ray와 local planning을 표시한 AMR 시나리오 UI
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [05. LiDAR ray casting](/posts/05-amr-lidar-raycasting/) · 다음 → [07. 점유격자와 log-odds](/posts/07-amr-occupancy-logodds/)

완벽한 센서는 알고리즘이 정상 경로를 실행하는지 보여줄 뿐, 실패에 어떻게 반응하는지는 보여주지 못한다. LiDAR 비이상성은 한꺼번에 섞지 않고 각각 독립적으로 넣어야 원인과 결과를 추적할 수 있다.

## 모델링한 네 종류의 비이상성

| 비이상성 | 의미 | 이 프로젝트의 설정 |
| --- | --- | ---: |
| range noise | 유효 beam 거리의 흔들림 | 표준편차 `0.005 m` |
| beam dropout | scan 안의 일부 beam 손실 | 확률 `0.015` |
| frame dropout | scan 전체가 오지 않음 | 29 scan마다 1회 |
| delay | 측정과 사용 시점 차이 | 1-sample |

추가로 LiDAR 자체의 한계인 FOV, angular resolution, 최소·최대 range, mounting offset을 scan 생성 단계에서 반영했다.

## noise와 dropout은 다른 상태다

noise가 있는 값은 여전히 측정치다. dropout은 측정치가 없다는 사건이다. 둘을 같은 `NaN` 처리로 뭉치면 downstream이 “불확실한 관측”과 “관측 없음”을 구분할 수 없다.

프로젝트의 pipeline은 scan과 함께 다음 상태를 전달한다.

```text
ranges
hit mask
beam valid
frame valid
measurement timestamp
freshness age
```

maximum range, no-hit, invalid beam도 구분한다. mapping에서 maximum-range beam은 free-space evidence를 줄 수 있지만 invalid beam은 지도를 갱신하면 안 된다.

## hold-last에는 시간 제한이 필요하다

frame 하나가 빠질 때마다 즉시 정지하면 센서 통신의 작은 흔들림에도 로봇이 떤다. 반대로 마지막 scan을 무기한 유지하면 새 장애물을 보지 못한 채 움직인다.

그래서 짧은 dropout에는 hold-last를 사용하되 measurement timestamp를 그대로 유지한다. 현재 시간과의 차이가 `0.25 s`를 넘으면 stale로 판정한다.

```text
새 scan 수신
→ 짧은 dropout: 마지막 scan 유지
→ age 증가
→ timeout 초과: stale + 정지
→ 새 valid scan: 정상 복귀
```

값을 유지해도 age는 계속 증가해야 한다. hold한 순간 timestamp를 현재 시각으로 덮어쓰면 오래된 데이터가 영원히 fresh로 보이는 버그가 생긴다.

## planner와 safety가 같은 실패에 따로 반응한다

stale scan은 local planner의 입력 품질 문제이면서 동시에 안전 조건이다. 프로젝트에서는 planner가 보수적으로 명령을 제한하는 것과 별개로 safety gate가 최종 정지 조건을 적용했다.

정상 obstacle 시나리오의 흐름은 다음과 같다.

```text
LiDAR slowdown zone
→ protective-stop zone
→ Stateflow ObstacleStop
→ A* 재계획 / DWA 회피
→ 경로 복귀
```

Stateflow obstacle event와 LiDAR stop event의 시각 차이가 `0.11 s` 이하인지 검사했다. 센서 주기가 `0.10 s`이므로 event alignment 자체가 시스템 지표가 된다.

## 회귀검사를 위해 deterministic fault를 썼다

random fault만 쓰면 같은 실패를 다시 만들기 어렵다. 프로젝트는 beam noise와 dropout pattern을 재현 가능하게 고정하고, 다음 순서를 단위검사했다.

1. 정상 scan
2. 연속 dropout
3. freshness timeout과 stale 진입
4. 정상 frame 수신
5. safety와 pipeline 정상 복귀

무작위 Monte Carlo 검증은 별도로 필요하지만, deterministic case는 실패 원인을 고정하고 코드 변경 전후를 비교하는 데 유리하다.

## 아직 모델링하지 않은 것

- encoder quantization과 overflow
- IMU bias/random walk
- clock drift
- out-of-order timestamp
- 실제 통신 jitter와 burst loss

센서 모델은 현실을 완전히 복제하는 일이 아니라, 검증하려는 실패 mode를 명시적으로 만드는 일이다.

## 참고

- [MathWorks — Sample Time in Systems and Subsystems](https://www.mathworks.com/help/simulink/ug/managing-sample-times-in-systems.html)
- [Nav2 Collision Monitor — source timeout](https://docs.nav2.org/configuration/packages/collision_monitor/configuring-collision-monitor-node.html)
- [프로젝트 LiDAR pipeline](https://github.com/genie4youu/amr_robot_planning/tree/main/src/%2Bamr/%2Bsensors)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [05. LiDAR ray casting](/posts/05-amr-lidar-raycasting/) · 다음 → [07. 점유격자와 log-odds](/posts/07-amr-occupancy-logodds/)
