---
title: 03. 좌표계·멀티레이트·데이터 유효성
description: map, odom, base, lidar frame과 서로 다른 실행 주기, timestamp freshness, valid 계약을 AMR 시스템 관점에서 정리한다.
date: 2026-07-23 06:03:00 +0900
categories: [AMR, 시스템 설계]
tags: [amr, frame, timestamp, multirate, sample-time, watchdog]
mermaid: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [02. SE(2)와 2D pose](/posts/02-amr-se2-pose/) · 다음 → [04. 차동구동](/posts/04-amr-differential-drive/)

센서 값이 수학적으로 맞아도 잘못된 frame이거나 너무 오래된 값이면 제어에는 틀린 데이터다. AMR에서 데이터의 의미는 `value` 하나가 아니라 최소한 다음 묶음이다.

```text
value + frame + timestamp + valid (+ covariance)
```

## 네 frame의 역할

```mermaid
flowchart LR
    M["map<br/>전역적으로 일관"] --> O["odom<br/>연속적이지만 drift"]
    O --> B["base<br/>로봇 회전 중심"]
    B --> L["lidar<br/>센서 원점"]
```

- `map`: 전역 경로와 고정 지도를 표현하는 기준
- `odom`: 짧은 시간 동안 연속적인 local motion 기준
- `base`: 로봇 차체의 기준점
- `lidar`: 센서 장착 위치와 방향

`odom`은 연속성이 중요하고 `map`은 전역 일관성이 중요하다. localization 보정으로 map pose가 바뀔 때 제어 입력까지 갑자기 튀지 않게 두 역할을 분리한다.

이 프로젝트의 LiDAR는 base 중심보다 전방 `0.18 m`에 있다. 센서 원점을 base pose와 같다고 두면 회전할 때 모든 beam 시작점에 체계적인 오차가 생긴다.

## AMR은 본질적으로 multirate다

하나의 주기로 모든 것을 계산할 이유가 없다.

| 기능 | 상대적으로 필요한 주기 |
| --- | --- |
| plant integration, wheel control | 빠름 |
| encoder, IMU | 빠름 |
| LiDAR | 중간 |
| localization, local planner | 중간 |
| global planner, mission supervisor | 느림 또는 event 기반 |

프로젝트의 현재 플랜트 적분 주기는 `0.01 s`, LiDAR 주기는 `0.10 s`다. 플랜트가 열 번 갱신되는 동안 scan은 한 번만 바뀐다. 따라서 scan을 읽는 쪽은 이전 값을 hold할지, 새 frame event에서만 실행할지, rate transition을 둘지 의도적으로 정해야 한다.

Simulink에서 sample time은 단순 표기값이 아니라 블록이 출력을 갱신하는 시점을 뜻한다. 서로 다른 rate 사이에는 zero-order hold, Rate Transition, triggered/enable 중 하나를 선택한다. 현재 프로젝트는 일부 sensor/control 경계를 함수와 adapter로 처리하며, 명시적인 Rate Transition 정리는 남은 작업이다.

## freshness는 센서 품질의 일부다

scan의 값이 정상 범위여도 마지막 수신이 오래전이면 장애물이 사라졌다는 뜻이 아니다. 새 정보를 모른다는 뜻이다.

$$
\text{age}=t_{\text{now}}-t_{\text{measurement}}
$$

프로젝트에서는 LiDAR freshness timeout을 `0.25 s`로 두었다. frame dropout 동안에는 마지막 scan을 잠시 유지하지만 age가 한계를 넘으면 stale로 판정하고 planner와 독립된 정지 조건을 건다.

유효성 검사에는 다음 항목이 필요하다.

- 미래 timestamp 거부
- 허용 age 초과 거부
- 예상 frame 불일치 거부
- `NaN`, `Inf` 거부
- 크기와 단위 불일치 거부
- covariance의 비정상 값 검출

## `valid=false`일 때 값은 의미가 없다

가장 위험한 인터페이스는 `valid=false`인데도 지난 value가 그럴듯하게 남아 있는 경우다. consumer는 value의 숫자를 보고 추측하면 안 된다. `valid`가 false면 명시된 fallback으로 가야 한다.

```text
fresh scan      → planner와 safety가 사용
short dropout   → hold-last + age 증가
stale scan      → planner 제한 + safety stop
new valid frame → 정상 복귀
```

프로젝트 단위검사에서 이 네 단계의 순서를 고정해 회귀검사했다.

## 이 단계의 교훈

frame과 시간은 알고리즘 바깥의 부가 정보가 아니다. 같은 점, 같은 속도, 같은 scan도 “어디 기준인가”와 “언제 측정했는가”가 없으면 사용할 수 없다. 이후 모든 글에서 pose나 scan을 말할 때 이 계약이 전제된다.

## 참고

- [Nav2 — Setting Up Transformations](https://docs.nav2.org/setup_guides/transformation/setup_transforms.html)
- [MathWorks — Sample Time in Systems and Subsystems](https://www.mathworks.com/help/simulink/ug/managing-sample-times-in-systems.html)
- [MathWorks — Handle Rate Transitions](https://www.mathworks.com/help/simulink/ug/handle-rate-transitions.html)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [02. SE(2)와 2D pose](/posts/02-amr-se2-pose/) · 다음 → [04. 차동구동](/posts/04-amr-differential-drive/)
