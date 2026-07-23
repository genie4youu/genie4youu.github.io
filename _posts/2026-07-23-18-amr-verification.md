---
title: 18. AMR 시나리오와 회귀검증 — 한 번 성공을 근거로 바꾸기
description: 수식, MATLAB 단위검사, subsystem, 통합 scenario, baseline 회귀 순으로 AMR을 검증하고 위치오차·충돌·상태순서를 자동 판정한다.
date: 2026-07-23 06:18:00 +0900
categories: [AMR, 검증]
tags: [amr, verification, regression, scenario, matlab, simulink]
math: true
---

> **연재:** [목차](/posts/00-amr-series/) · 이전 → [17. 시스템 통합](/posts/17-amr-system-integration/) · 다음 → [19. 배송·배터리·도킹](/posts/19-amr-delivery-battery-docking/)

애니메이션이 목표점에 도착하는 장면은 좋은 demo지만 검증 결과는 아니다. 코드가 바뀐 뒤에도 같은 조건에서 허용 기준을 만족하는지 자동으로 판단해야 한다.

## 검증 계층

1. 수식 손계산
2. 순수 MATLAB 함수 단위검사
3. subsystem prototype 비교
4. 통합 scenario
5. 반복 random simulation
6. baseline과 regression 비교

작은 함수에서 잡을 수 있는 부호 오류를 40초 통합 simulation으로 찾지 않는다. 반대로 함수 단위검사만으로 Stateflow event timing과 command arbitration을 검증할 수는 없다.

## 입력을 실패 방식으로 분류한다

- nominal
- boundary
- invalid
- noisy
- delayed
- missing
- contradictory

예를 들어 LiDAR는 정상 거리뿐 아니라 maximum range, invalid beam, beam dropout, frame dropout, delay, stale recovery를 각각 시험한다.

## 현재 단위검사 범위

- 차동구동 순·역변환과 pose 적분
- grid/world 변환과 occupancy query
- A* 시작·끝과 path 선분 비충돌
- LiDAR DDA 거리, no-hit, stop/slowdown zone
- local costmap hit marking과 inflation
- DWA dynamic window, rollout collision, goal progress, 가속도 step
- 세 환경의 goal/charger 연결성
- LiDAR noise/dropout/delay/freshness
- log-odds free/occupied/unknown
- pose EKF covariance 증가와 health 복귀

Simulink Test가 없는 환경이므로 기본 MATLAB `assert` runner를 사용했다.

## scenario matrix

주행 상황은 네 가지다.

1. 정상 배송
2. 돌발 장애물
3. 배터리 부족
4. 잘못된 길

환경은 사무실/배송 구역, 병원 중앙 복도, 물류 창고 랙 구역이다. 두 축을 곱해 12개 조합을 만든다. 별도로 Industrial Supervisor는 nominal, obstacle, battery, health fault, E-stop을 실행한다.

## pass/fail 기준

| 항목 | 기준 |
| --- | --- |
| 목표 위치 오차 | `< 0.12 m` |
| 충돌 | 모든 pose와 pose 사이 선분 비충돌 |
| 안전 지도 | `0.30 m` inflation |
| 상태기계 | 예상 lifecycle/parallel mode 순서 포함 |
| event alignment | obstacle와 LiDAR stop `<= 0.11 s` |
| DWA command | linear/angular acceleration limit 준수 |
| 완료 | 제한 시간 안에 goal 도달 |

sample point만 검사하지 않고 sample 사이 선분까지 보는 이유는 큰 step 사이에 벽을 통과하는 오류를 놓치지 않기 위해서다.

## baseline 결과

- Scenario Lab 환경 행렬 `12/12 PASS`
- Integrated Plant/Supervisor 환경 행렬 `12/12 PASS`
- Industrial Supervisor `5/5 PASS`
- `CollisionFree`, `LidarValidated`, `DwaValidated` 모두 true
- 최종 위치 오차 약 `0.080 m` 이하
- Scenario/Industrial/Integrated 모델 구조 검사 healthy

통합 12개 조합에서 lifecycle 순서는 `[0 1 2 3 0]`이었고 `NavFailed` 없이 끝났다.

## 시간도 결과다

| 환경 | 정상 | 장애물 | 배터리 | 잘못된 길 |
| --- | ---: | ---: | ---: | ---: |
| 사무실 | 26.35 s | 34.40 s | 74.45 s | 35.05 s |
| 병원 | 26.40 s | 40.00 s | 61.40 s | 35.20 s |
| 창고 | 42.00 s | 56.50 s | 66.30 s | 51.65 s |

성공 여부만 보면 창고의 긴 경로와 장애물 회피 비용이 보이지 않는다. mission completion time은 환경별 난이도와 변경 영향의 baseline이 된다.

## 재현성 정보

- MATLAB/모델 버전
- parameter snapshot
- scenario와 environment ID
- random seed
- 실행 명령
- 결과 timestamp
- pass/fail과 reason code

검증 요약 구조체는 `data/expected/`에 저장하고 새 실행 결과는 Git에서 제외되는 `results/`에 둔다.

## 아직 부족한 검증

- Monte Carlo와 통계 분포
- 실제 encoder/IMU bias가 폐루프에 미치는 영향
- 복합 fault의 우선순위 경계
- online log-odds replan
- coverage, HIL, real-time deadline
- 실제 하드웨어와 안전 인증

PASS 개수는 검증한 범위 안에서만 의미가 있다. 다음 글의 배송·배터리·도킹도 현재 구현과 계획을 나눠 본다.

## 참고

- [프로젝트 검증 결과](https://github.com/genie4youu/amr_robot_planning/blob/main/docs/RESULTS.md)
- [프로젝트 unit runner](https://github.com/genie4youu/amr_robot_planning/blob/main/scripts/run_unit_verification.m)
- [프로젝트 verification 단계](https://github.com/genie4youu/amr_robot_planning/tree/main/docs/stages/12_verification)

## 연재

[목차](/posts/00-amr-series/) · 이전 → [17. 시스템 통합](/posts/17-amr-system-integration/) · 다음 → [19. 배송·배터리·도킹](/posts/19-amr-delivery-battery-docking/)
