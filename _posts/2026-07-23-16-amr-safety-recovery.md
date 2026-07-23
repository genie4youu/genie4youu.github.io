---
title: 16. Safety gate, watchdog, recovery — 마지막 방어선
description: local planner 뒤에 독립 safety gate를 두고 stop·slowdown zone, freshness watchdog, progress checker, recovery ladder를 구성한다.
date: 2026-07-23 06:16:00 +0900
categories: [AMR, 안전과 복구]
tags: [amr, safety-gate, watchdog, recovery, emergency-stop, collision-monitor]
mermaid: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [15. Stateflow 감독제어](/posts/15-amr-stateflow-supervisor/) · 다음 → [17. 시스템 통합](/posts/17-amr-system-integration/)

DWA가 trajectory collision을 검사해도 최종 명령 앞에는 독립 safety gate가 필요하다. planner의 bug, stale map, 잘못된 cost weight, adapter 오류를 모두 “planner가 안전할 것”이라는 같은 가정에 맡기지 않기 위해서다.

## command chain의 마지막

```mermaid
flowchart LR
    P["Local planner"] --> V["Velocity shaping"]
    V --> S["Safety gate"]
    S --> W["Wheel command"]
```

프로젝트의 명령 우선순위 초안은 다음과 같다.

```text
EmergencyStop
> SafetyStop
> ControlledStop
> Slowdown
> NavigationCommand
> ZeroCommand
```

여러 조건이 동시에 활성화되면 더 공격적인 안전 동작이 이긴다.

## 공간 zone

LiDAR point가 robot base 앞의 영역에 들어오는지 검사한다.

| zone | 전방 거리 | 반폭 | 동작 |
| --- | ---: | ---: | --- |
| slowdown | `1.55 m` | `0.55 m` | 속도 제한 |
| protective stop | `0.85 m` | `0.36 m` | 정지 |

장애물 시나리오에서는 slowdown, protective stop, A*/DWA 회피 순서를 확인했다.

고정 거리 zone은 단순하고 설명하기 쉽지만 속도에 따라 정지 여유가 달라진다. 그래서 고급 단계에는 current speed 기반 time-to-collision(TTC)이 필요하다.

## freshness watchdog

안전 판단은 obstacle point뿐 아니라 데이터의 나이도 본다.

- LiDAR scan age
- estimated pose age와 covariance
- command age
- localization valid
- wheel command와 measured motion 불일치
- emergency request

현재 LiDAR timeout은 `0.25 s`다. hold-last 중에도 timestamp를 갱신하지 않고, stale이면 planner와 무관하게 정지한다.

## progress checker

충돌하지 않아도 goal에 가까워지지 않는 로봇은 실패 중이다. 일정 시간 window에서 다음을 본다.

- 실제 이동 거리
- goal distance 감소량
- heading만 좌우로 반복하는지
- 유효 local command가 계속 없는지
- 같은 recovery를 반복하는지

현재 프로젝트는 `goalReached`, `atCharger`, `recoveryComplete`, off-route event로 기본 progress를 판단한다. 일반적인 stuck window와 oscillation count는 남은 작업이다.

## recovery ladder

모든 실패에 즉시 mission abort를 적용하지 않는다.

```text
Replan
→ Wait
→ RotateInPlace
→ BackUp
→ ClearLocalCostmap
→ Relocalize
→ MissionAbort
```

각 recovery에는 진입 조건, timeout, 성공 조건, 최대 retry가 있어야 한다. retry 제한이 없으면 “복구 상태”가 새로운 무한루프가 된다.

프로젝트에서 현재 구현한 scenario recovery는 다음과 같다.

- 장애물: 정지 → 우회 waypoint → 원 경로 재진입
- 배터리: 충전소 복귀 → 90% 충전 → 배송 재개
- 잘못된 길: 정지 → 위치 확인 → 기준 경로 복귀

일반 retry counter와 escalation은 아직 없다.

## latch와 reset guard

순간 장애물 정지는 조건이 사라지면 자동 복귀할 수 있다. E-stop과 actuator fault는 다르다.

- E-stop: `EmergencyStopLatched`에 머물고 guarded reset 뒤 Boot부터 재시작
- actuator fault: `FaultLatched`에 머물며 입력 해제만으로 자동 복귀하지 않음

이 구분은 “조건이 없어졌다”와 “안전하게 재가동해도 된다”가 같은 뜻이 아니기 때문이다.

## 세 겹의 충돌 방어

프로젝트에는 세 검사가 있다.

1. DWA rollout trajectory collision
2. DWA braking trajectory collision
3. 최종 command segment safety gate

같은 local costmap 오류에 완전히 독립적이지는 않지만, 서로 다른 실행 지점과 failure path를 감시한다.

## 안전 관련 한계

이 로직은 교육용 desktop simulation이다. 안전 PLC, safety-rated LiDAR, 물리 E-stop, hard real-time controller 또는 안전 인증을 대체하지 않는다. Nav2 공식 문서도 CPU 수준 collision monitor가 hard real-time safety certification을 제공하지 않는다고 구분한다.

## 참고

- [Nav2 — Collision Monitor Node](https://docs.nav2.org/configuration/packages/collision_monitor/configuring-collision-monitor-node.html)
- [Nav2 — Replanning and Recovery](https://docs.nav2.org/behavior_trees/overview/detailed_behavior_tree_walkthrough)
- [프로젝트 safety/recovery 단계](https://github.com/genie4youu/amr_robot_planning/tree/main/docs/stages/10_safety_recovery)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [15. Stateflow 감독제어](/posts/15-amr-stateflow-supervisor/) · 다음 → [17. 시스템 통합](/posts/17-amr-system-integration/)
