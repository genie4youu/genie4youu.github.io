---
title: 09. Correlative scan matching — scan과 map을 맞추는 법
description: odometry prior 주변의 dx, dy, dtheta 후보를 탐색해 LiDAR scan endpoint와 기존 map의 일치도를 최대화하는 방법과 한계를 정리한다.
date: 2026-07-23 06:09:00 +0900
categories: [AMR, SLAM]
tags: [amr, slam, scan-matching, lidar, correlative, localization]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [08. Odometry, EKF, MCL](/posts/08-amr-localization/) · 다음 → [10. Loop closure와 pose graph](/posts/10-amr-loop-closure-pose-graph/)

odometry는 다음 pose의 좋은 초기값을 주지만 drift가 누적된다. scan matching은 그 주변에서 LiDAR 관측이 기존 map과 가장 잘 맞는 pose 보정을 찾는다.

## 문제의 형태

odometry prior를 $\bar{\mathbf{x}}=[\bar{x},\bar{y},\bar{\theta}]$라 하자. 작은 후보 보정

$$
\Delta\mathbf{x}=[\Delta x,\Delta y,\Delta\theta]
$$

를 여러 개 만들고, 각 후보로 scan endpoint를 map frame에 옮긴다. occupied cell 또는 obstacle distance field와의 일치도를 점수화해 가장 높은 후보를 고른다.

$$
\Delta\mathbf{x}^*=
\arg\max_{\Delta\mathbf{x}\in\mathcal{W}}
S(\bar{\mathbf{x}}\oplus\Delta\mathbf{x}, z)
$$

$\mathcal{W}$는 prior 주변의 탐색 window다.

## endpoint score

가장 단순한 score는 변환한 scan endpoint가 occupied cell에 닿을 때 점수를 더하는 방식이다.

$$
S(\mathbf{x},z)=\sum_i M\bigl(T(\mathbf{x})p_i\bigr)
$$

$M$이 binary occupancy라면 한 cell 차이에도 점수가 급격히 바뀐다. obstacle distance field나 blurred map을 사용하면 가까운 endpoint에도 부분 점수를 줄 수 있다.

## 탐색 범위와 해상도의 trade-off

| 선택 | 장점 | 비용/위험 |
| --- | --- | --- |
| 넓은 탐색 범위 | 나쁜 prior에서도 복구 | 후보 수 증가, 오정합 가능 |
| 작은 translation step | 정밀한 위치 | 계산량 증가 |
| 작은 angle step | 정밀한 heading | 후보 수 증가 |
| 강한 prior 제한 | 빠르고 안정적 | 큰 drift 복구 불가 |

translation 후보 수를 $N_x,N_y$, rotation 후보 수를 $N_\theta$, 유효 beam 수를 $N_b$라 하면 단순 탐색 비용은 대략 $N_xN_yN_\theta N_b$에 비례한다.

## coarse-to-fine

처음부터 고해상도로 넓게 찾지 않고 단계적으로 줄인다.

1. 큰 step으로 넓은 범위 탐색
2. 상위 후보 주변만 유지
3. 작은 step으로 재탐색
4. 최고점과 차선점의 score 차이 확인

최고 score만 보는 것보다 1등과 2등의 차이, score peak의 폭을 함께 보면 결과가 모호한지 판단할 수 있다.

## 실패하기 쉬운 환경

- 긴 직선 복도: 진행 방향 위치를 구분할 특징이 적다.
- 반복되는 문과 기둥: 여러 pose가 비슷한 score를 낸다.
- 좁은 FOV: 관측 제약이 부족하다.
- 동적 장애물: 기존 map과 다른 점이 score를 오염시킨다.
- 나쁜 prior: local optimum의 탐색 window에 들어간다.

따라서 matching 실패 시 억지로 map을 갱신하지 않는 정책이 필요하다. 낮은 품질의 pose로 map을 업데이트하면 다음 scan의 기준까지 망가져 오류가 자기강화된다.

## incremental mapping에서의 순서

```text
odometry prediction
→ scan matching correction
→ quality check
→ 통과: occupancy update
→ 실패: map update 보류 + health 보고
```

모든 scan을 graph node로 만들기보다 이동 거리, 회전량, 시간, matching 품질을 기준으로 key scan을 선택하면 계산량을 줄일 수 있다.

## 현재 프로젝트 상태

이 프로젝트에서는 scan matching의 이론, 단계별 구현 계획, 검증 시나리오까지 정리했다. `correlativeScanMatch` 함수와 incremental SLAM은 아직 구현하지 않았다. 현재 주행은 known static map과 별도 pose EKF prototype을 사용한다.

구현할 때는 다음 순서를 지킬 계획이다.

1. known pose scan의 최고점 확인
2. 작은 pose offset 복구
3. coarse-to-fine
4. 긴 복도와 잘못된 prior
5. matching 실패 시 map update 정지

scan matching이 통과하기 전에 loop closure를 붙이지 않는다. 다음 글에서 그 이유와 pose graph 구조를 다룬다.

## 참고

- [Edwin Olson — Real-Time Correlative Scan Matching](https://april.eecs.umich.edu/papers/details.php?name=olson2009icra)
- [프로젝트 SLAM 단계 문서](https://github.com/genie4youu/amr_robot_planning/tree/main/docs/stages/06_slam)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [08. Odometry, EKF, MCL](/posts/08-amr-localization/) · 다음 → [10. Loop closure와 pose graph](/posts/10-amr-loop-closure-pose-graph/)
