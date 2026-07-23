---
title: 11. Costmap, inflation, A* — 전역 경로를 만든다
description: occupancy map을 planning costmap으로 바꾸고 robot footprint를 inflation에 반영한 뒤 8-connected A*로 전역 경로를 구한다.
date: 2026-07-23 06:11:00 +0900
categories: [AMR, 전역 경로계획]
tags: [amr, costmap, inflation, astar, path-planning, occupancy-grid]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [10. Loop closure와 pose graph](/posts/10-amr-loop-closure-pose-graph/) · 다음 → [12. Path smoothing](/posts/12-amr-path-smoothing/)

occupancy map은 환경에 대한 관측이고 costmap은 주행 정책이다. 같은 장애물 지도라도 로봇 크기, 안전 여유, unknown-space 정책에 따라 지나갈 수 있는 경로가 달라진다.

## occupancy와 cost를 분리한다

전역 costmap에는 다음 층을 생각할 수 있다.

- static obstacle
- robot footprint를 반영한 inflation
- unknown space 허용/금지
- keepout zone
- 선택적 speed zone

확률이 높다고 반드시 높은 주행 비용인 것은 아니며, 관측되지 않은 공간을 금지할지 허용할지도 mission 정책이다.

## 장애물을 팽창시키는 이유

격자 planner가 robot center만 하나의 점으로 움직인다고 가정하면 차체 모서리가 벽에 닿을 수 있다. 장애물을 로봇 반경과 안전 여유만큼 팽창하면 point planning으로 footprint 제약을 근사할 수 있다.

```text
physical obstacle
→ robot radius
→ safety margin
→ inflated obstacle
```

프로젝트에서는 전역 계획용 `0.40 m`, 독립 collision 검사용 `0.30 m` 팽창 지도를 사용했다. 서로 다른 값은 planner의 보수성과 실제 검증 경계를 분리하기 위한 프로젝트 선택이다.

## A*의 평가 함수

$$
f(n)=g(n)+h(n)
$$

- $g(n)$: 시작점부터 현재 node까지 누적 비용
- $h(n)$: goal까지 남은 비용의 heuristic

open set에서 $f$가 가장 작은 node를 꺼내 이웃을 확장하고, 더 좋은 경로를 찾으면 parent와 $g$를 갱신한다. goal에 도달하면 parent pointer를 거꾸로 따라 path를 복원한다.

## 8-connected grid와 heuristic

프로젝트 설정은 다음과 같다.

| 항목 | 선택 |
| --- | --- |
| neighbor | 8-connected |
| heuristic | Euclidean |
| 직선 이동 비용 | `1` |
| 대각 이동 비용 | `sqrt(2)` |
| corner cutting | 금지 |
| path 없음 | 빈 배열 반환 |

Euclidean heuristic은 장애물을 무시한 직선거리이므로 실제 최단 비용을 과대평가하지 않는다. 대각 이동을 허용하면서 Manhattan distance를 그대로 쓰면 admissibility를 따져야 한다.

## corner cutting

두 orthogonal 이웃이 막혀 있는데 대각 cell만 비었다고 그 사이를 통과하면 장애물 모서리를 가로지른다.

```text
# .
. G
```

현재 cell에서 goal 방향 대각 이동을 허용하려면 인접한 두 축 방향 cell도 통과 가능해야 한다. inflation과 별개로 필요한 grid rule이다.

## 반드시 정의할 예외

- start 또는 goal이 occupied
- goal이 map 밖
- path가 없음
- unknown cell
- 같은 비용의 여러 경로
- 너무 좁아 footprint가 통과할 수 없는 통로

현재 planner는 path가 없으면 빈 배열을 반환하고 scenario engine은 blocked 상태로 정지한다. Stateflow timeout, retry, operator reason까지 연결하는 작업은 남아 있다.

## 프로젝트 구현과 결과

`planAStarGrid`를 구현해 정상 배송, 장애물 재계획, 충전소 복귀, 잘못된 길 복귀에 사용했다. 세 합성 지도에서 start–goal과 charger 연결성을 단위검사했다.

동적 장애물 시나리오에서 global A*는 아직 scenario가 제공한 rectangle을 알고 있다. local DWA는 LiDAR hit를 사용하지만 global replan이 완전히 scan-derived인 것은 아니다.

## 최단 grid path가 곧 좋은 주행 path는 아니다

A*가 반환한 path에는 collinear point와 불필요한 꺾임이 많다. 다음 글에서 line-of-sight shortcut으로 waypoint를 줄이고, 모든 선분을 다시 충돌 검사한 이유를 다룬다.

## 참고

- [Nav2 — Costmap 2D](https://docs.nav2.org/configuration/packages/configuring-costmaps.html)
- [Nav2 — Inflation Layer](https://docs.nav2.org/configuration/packages/costmap-plugins/inflation.html)
- [프로젝트 A* 구현](https://github.com/genie4youu/amr_robot_planning/blob/main/src/%2Bamr/%2Bplanning/planAStarGrid.m)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [10. Loop closure와 pose graph](/posts/10-amr-loop-closure-pose-graph/) · 다음 → [12. Path smoothing](/posts/12-amr-path-smoothing/)
