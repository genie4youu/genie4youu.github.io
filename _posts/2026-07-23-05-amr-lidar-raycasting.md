---
title: 05. 2D LiDAR와 grid ray casting
description: 합성 occupancy grid에 LiDAR beam을 투사해 첫 장애물까지 거리를 구하고 DDA와 다중 빔 scan을 검증한 과정.
date: 2026-07-23 06:05:00 +0900
categories: [AMR, 센서]
tags: [amr, lidar, raycasting, dda, occupancy-grid, matlab]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [04. 차동구동](/posts/04-amr-differential-drive/) · 다음 → [06. LiDAR 비이상성](/posts/06-amr-lidar-imperfections/)

시뮬레이션의 planner가 ground-truth 장애물 좌표를 직접 받으면 센서가 없는 로봇을 만든 셈이다. 이 프로젝트에서는 합성 floor map을 occupancy grid로 만들고, 각 LiDAR beam이 처음 만나는 occupied cell까지의 거리를 계산했다.

## 한 빔이 지나가는 과정

로봇 pose가 $(x,y,\theta)$이고 LiDAR가 base에서 $(x_s,y_s,\theta_s)$만큼 떨어져 있다고 하자. beam 각도 $\alpha_i$의 map 기준 방향은 transform 합성으로 구한다.

$$
\phi_i=\theta+\theta_s+\alpha_i
$$

ray의 연속 위치는 다음과 같다.

$$
\mathbf{r}_i(d)=
\begin{bmatrix}
x_{\text{lidar}}\\y_{\text{lidar}}
\end{bmatrix}
+
d
\begin{bmatrix}
\cos\phi_i\\\sin\phi_i
\end{bmatrix}
$$

$d$를 최소 거리에서 최대 거리까지 진행시키며 처음 occupied cell을 만나면 그 거리를 반환한다.

```text
beam angle 생성
→ lidar origin을 map frame으로 변환
→ grid cell 순회
→ 첫 occupied cell 확인
→ range, hit, valid 반환
```

## 왜 단순한 작은 간격 sampling만으로 부족한가

ray를 일정한 거리 간격으로 찍는 방식은 구현이 쉽지만 간격이 cell보다 크거나 대각선으로 지나가면 얇은 장애물을 건너뛸 수 있다. grid traversal은 ray가 통과하는 cell 경계를 기준으로 다음 cell을 선택한다.

대표적인 방법은 Bresenham, DDA(Digital Differential Analyzer), Amanatides–Woo traversal이다. 프로젝트의 기준 구현 `raycastGrid`는 DDA 방식으로 한 ray가 지나가는 cell을 추적한다.

## DDA의 핵심

현재 cell에서 x 방향 다음 경계와 y 방향 다음 경계까지 필요한 ray parameter를 비교한다.

```text
if tNextX < tNextY
    x cell로 한 칸 이동
else
    y cell로 한 칸 이동
end
```

매 단계에서 최소 한 cell 경계를 넘으므로 빈 공간에서 불필요한 작은 step을 반복하지 않는다. 동시에 ray가 통과한 cell을 빠뜨리지 않는다.

## 프로젝트 scan 설정

| 항목 | 값 |
| --- | ---: |
| Field of view | `-135° ~ +135°` |
| 각해상도 | `3°` |
| beam 수 | `91` |
| range | `0.10 ~ 5.00 m` |
| sample time | `0.10 s` |
| mounting offset | base 앞 `0.18 m` |

물리 표면을 찾는 raw occupancy grid는 `20 cells/m` 해상도이며 장애물 inflation을 적용하지 않는다. 센서가 측정하는 것은 안전 여유가 포함된 costmap 경계가 아니라 실제 벽의 근사 표면이어야 하기 때문이다.

## 기준 구현과 다중 빔 구현

프로젝트는 두 경로를 두었다.

- `raycastGrid`: 정확성을 확인하기 쉬운 단일 ray DDA
- `simulateLidar2D`: 여러 beam을 계산하는 vectorized scan

다중 scan 경로는 `0.45 cell`보다 짧은 간격으로 ray를 진행해 cell 누락을 막았다. 기준 DDA와 단순 지도의 기대값을 먼저 맞춘 뒤 성능 경로를 사용했다.

## 최소 검증 세트

- 벽에 수직인 beam
- 대각선 beam
- 최대 거리 안에 장애물이 없는 beam
- map 밖으로 나가는 beam
- 센서 mounting offset
- 최소 거리 안의 장애물
- maximum range와 invalid의 구분

수직 벽 시험에서 기대거리와 계산거리가 모두 `1.000 m`였고, 미검출 beam은 `hit=false`와 maximum range를 함께 반환했다. “최대 거리에서 장애물이 검출됐다”와 “장애물이 없어 최대 거리를 반환했다”를 같은 숫자 하나로 표현하지 않은 것이 중요하다.

## ray casting은 센서 모델의 절반이다

이 단계까지의 scan은 지나치게 완벽하다. 실제 제어를 검증하려면 range noise, beam dropout, frame dropout, delay와 timestamp freshness가 필요하다. 다음 글에서 이 비이상성을 하나씩 분리해 넣는다.

## 참고

- [Amanatides & Woo — A Fast Voxel Traversal Algorithm for Ray Tracing](http://www.cse.yorku.ca/~amana/research/grid.pdf)
- [프로젝트 LiDAR 구현](https://github.com/genie4youu/amr_robot_planning/tree/main/src/%2Bamr/%2Bsensors)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [04. 차동구동](/posts/04-amr-differential-drive/) · 다음 → [06. LiDAR 비이상성](/posts/06-amr-lidar-imperfections/)
