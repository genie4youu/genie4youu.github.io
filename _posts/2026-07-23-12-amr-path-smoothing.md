---
title: 12. Path smoothing과 충돌 재검사
description: A* 격자 경로에서 collinear point를 제거하고 line-of-sight shortcut으로 waypoint를 줄이되 연속 선분 충돌을 다시 확인한다.
date: 2026-07-23 06:12:00 +0900
categories: [AMR, 전역 경로계획]
tags: [amr, path-smoothing, line-of-sight, astar, collision-checking]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [11. Costmap, inflation, A*](/posts/11-amr-costmap-astar/) · 다음 → [13. Local costmap과 Pure Pursuit](/posts/13-amr-local-costmap-pure-pursuit/)

A*는 grid node의 연결을 따라 최단 경로를 찾는다. 해상도가 유한한 격자에서는 같은 방향의 점이 반복되고, 장애물에서 멀리 떨어진 구간도 계단처럼 꺾인다. controller에 그대로 주면 waypoint 전환이 잦고 angular command가 흔들릴 수 있다.

## 먼저 collinear point를 제거한다

연속 세 점 $p_{i-1},p_i,p_{i+1}$의 방향이 같다면 가운데 점은 경로 형상에 기여하지 않는다. 2D cross product가 0인지 확인해 제거할 수 있다.

$$
(p_i-p_{i-1})\times(p_{i+1}-p_i)=0
$$

정수 grid에서는 정확히 비교할 수 있지만 world 좌표에서는 tolerance가 필요하다.

## line-of-sight shortcut

현재 anchor에서 멀리 있는 waypoint까지 직접 연결한 선분이 충돌하지 않으면 중간 점을 건너뛴다.

```text
anchor에서 goal 쪽으로 가장 먼 후보 선택
→ 선분 collision 검사
→ 통과하면 중간 waypoint 제거
→ 실패하면 더 가까운 후보 검사
→ 새 anchor에서 반복
```

프로젝트의 `smoothGridPath`는 가장 먼 가시점을 선택하는 greedy shortcut을 사용한다. 별도 최적화 Toolbox 없이 동작하고, 각 결정의 충돌 여부를 설명하기 쉽다.

## endpoint만 보면 안 된다

두 waypoint가 모두 free cell이어도 그 사이 선분은 장애물을 통과할 수 있다. playback 로그도 마찬가지다. sample pose만 안전하고 sample 사이 이동이 벽을 가로지르면 collision-free가 아니다.

프로젝트는 다음 두 검사를 분리했다.

- `isSegmentCollisionFree`: 경로 선분 검사
- `assertCollisionFreePlayback`: 모든 기록 pose와 pose 사이 선분 검사

planning map과 validation map의 inflation도 구분했다.

## smoothing 뒤에 다시 확인할 것

1. 시작점과 goal이 유지되는가
2. 모든 새 선분이 inflated map에서 free인가
3. waypoint 간격이 controller의 lookahead에 적합한가
4. 급격한 heading 변화가 생기지 않는가
5. 장애물 clearance가 과도하게 줄지 않는가

line-of-sight는 충돌 여부만 보장한다. curvature, 속도, 동역학까지 보장하지 않는다. 필요하면 resampling, spline, curvature constraint를 추가해야 한다.

## clearance와 최단거리의 trade-off

binary map에서 충돌하지 않는 가장 짧은 shortcut은 장애물 팽창 경계를 스칠 수 있다. costmap의 연속 비용을 사용하면 clearance를 path objective에 넣을 수 있지만, 첫 버전에서는 단순하고 검증 가능한 binary line-of-sight를 선택했다.

## 프로젝트 결과

정상, 동적 장애물, 충전소 복귀, 잘못된 길 복귀 경로에서 smoothing 뒤 모든 선분을 재검증했다. 세 환경 × 네 시나리오의 실행 로그도 sample과 sample 사이 선분까지 `0.30 m` 팽창 지도에서 비충돌인지 확인했다.

이 결과가 DWA의 trajectory collision check를 대신하지는 않는다. 전역 path는 정적·느린 정책이고 local planner는 현재 속도와 새 sensor hit를 고려한다.

## 다음 단계

전역 path를 얻었다면 로봇 주변의 최신 관측을 별도 local window로 관리하고 path를 추종해야 한다. 다음 글에서는 Pure Pursuit를 기준 제어기로 두고 local costmap을 분리한 이유를 다룬다.

## 참고

- [프로젝트 path smoothing 구현](https://github.com/genie4youu/amr_robot_planning/blob/main/src/%2Bamr/%2Bplanning/smoothGridPath.m)
- [프로젝트 collision verification](https://github.com/genie4youu/amr_robot_planning/blob/main/src/%2Bamr/%2Bverification/assertCollisionFreePlayback.m)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [11. Costmap, inflation, A*](/posts/11-amr-costmap-astar/) · 다음 → [13. Local costmap과 Pure Pursuit](/posts/13-amr-local-costmap-pure-pursuit/)
