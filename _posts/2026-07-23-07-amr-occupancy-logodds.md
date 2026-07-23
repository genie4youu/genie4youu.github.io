---
title: 07. 점유격자와 log-odds — scan을 확률 지도로 누적하기
description: occupancy probability를 log-odds로 바꾸고 LiDAR inverse sensor model로 free, occupied, unknown cell을 누적 갱신한다.
date: 2026-07-23 06:07:00 +0900
categories: [AMR, 매핑]
tags: [amr, occupancy-grid, log-odds, mapping, lidar, bayes]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [06. LiDAR 비이상성](/posts/06-amr-lidar-imperfections/) · 다음 → [08. Odometry, EKF, MCL](/posts/08-amr-localization/)

binary map은 cell이 비었는지 막혔는지만 표현한다. 센서로 지도를 만들 때는 아직 모르는 공간과 비어 있다고 관측한 공간을 구분해야 한다.

| 점유 확률 | 의미 |
| ---: | --- |
| $p\approx0$ | free |
| $p=0.5$ | unknown |
| $p\approx1$ | occupied |

## 왜 log-odds를 쓰는가

확률 $p$를 odds와 log-odds로 바꾸면 다음과 같다.

$$
\operatorname{odds}(p)=\frac{p}{1-p}
$$

$$
l=\log\frac{p}{1-p}
$$

독립 측정이라는 단순화 아래에서 새 관측은 log-odds 덧셈으로 누적할 수 있다.

$$
l_{t,i}=l_{t-1,i}+
\operatorname{logit}\bigl(p(m_i\mid z_t,x_t)\bigr)-l_0
$$

$l_0$는 prior의 log-odds다. 초기 확률을 0.5로 두면 $l_0=0$이므로 unknown map에서 시작하기 쉽다.

확률로 되돌릴 때는 logistic 함수를 쓴다.

$$
p=\frac{1}{1+\exp(-l)}
$$

## inverse sensor model

LiDAR beam 하나는 세 구간을 만든다.

```text
sensor ── free evidence ── hit cell ── unknown
```

- 센서와 반사점 사이: free evidence
- 반사점 주변: occupied evidence
- 반사점 뒤: 가려졌으므로 갱신하지 않음
- invalid beam: 전체 갱신하지 않음
- maximum-range no-hit beam: 지나온 free cell만 갱신

“hit 뒤가 비어 보인다”는 추론을 하면 벽 너머를 free로 지우는 오류가 생긴다.

## 구현에서 자주 틀리는 경계

- world의 `(x,y)`와 행렬의 `(row,column)` 순서
- map origin과 resolution
- 경계 밖 ray clipping
- 같은 scan에서 한 cell을 여러 beam이 지날 때의 정책
- occupied endpoint의 두께
- log-odds가 무한히 커지지 않게 saturation
- unknown을 binary 변환에서 free로 취급하는 문제

프로젝트의 map metadata는 floor map의 `xLim`, `yLim`과 `10 cells/m` 해상도를 공유한다. 계획용 지도는 `0.40 m`, 독립 안전 검사용 지도는 `0.30 m` 팽창시키지만, log-odds 원본은 관측 증거를 보관한다.

## 프로젝트 구현

```text
initializeLogOddsMap
updateLogOddsWithScan
logOddsToOccupancy
worldToGrid / gridToWorld
```

단일 ray를 반복 관측해 다음을 확인했다.

- 센서와 벽 사이 cell은 free
- wall hit cell은 occupied
- wall 뒤 cell은 unknown 유지
- maximum-range beam은 free-space만 갱신

이 작은 시험은 최종 map 이미지보다 중요하다. 어떤 cell이 왜 바뀌었는지 한 칸씩 설명할 수 있기 때문이다.

## occupancy map과 costmap은 다르다

occupancy map은 관측 확률을 표현한다. costmap은 로봇이 지나가기 싫은 정도를 표현한다. 장애물 inflation, keepout, speed zone은 주행 정책이므로 확률 map과 분리해야 한다.

## 현재 통합 경계

log-odds 함수와 단위검사는 구현됐지만 통합 주행의 global A*는 아직 known static map을 사용한다. 동적 장애물의 전역 replan도 scenario가 제공한 사각형을 알고 있다. local DWA만 실제 LiDAR hit로 새 장애물을 표시한다.

즉 “mapping prototype을 검증했다”와 “온라인 SLAM 지도로 주행한다”는 다른 상태다. 이 구분을 프로젝트 문서와 블로그에 그대로 남긴다.

## 참고

- [Alberto Elfes — Using Occupancy Grids for Mobile Robot Perception and Navigation](https://doi.org/10.1109/2.30720)
- [MathWorks — Occupancy Grids](https://www.mathworks.com/help/nav/ug/occupancy-grids.html)
- [프로젝트 mapping 구현](https://github.com/genie4youu/amr_robot_planning/tree/main/src/%2Bamr/%2Bmapping)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [06. LiDAR 비이상성](/posts/06-amr-lidar-imperfections/) · 다음 → [08. Odometry, EKF, MCL](/posts/08-amr-localization/)
