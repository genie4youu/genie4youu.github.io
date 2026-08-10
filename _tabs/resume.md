---
title: 이력
icon: fas fa-id-card
order: 6
---

로봇 제어 소프트웨어를 개발합니다. 석사 과정에서는 재활 로봇의 전장 설계부터 통신, 실시간 제어 루프, 제어 알고리즘, 운영자 화면까지 시스템의 아래 계층을 직접 만들었습니다. 지금은 그 위 계층인 상위 제어기 설계를 하고 있습니다.

이 페이지의 표에는 근거 칸이 있습니다. 근거를 걸 수 없는 항목은 넣지 않았습니다.

## 지금 하는 일

2026년 7월부터 로봇 제어 소프트웨어 엔지니어로 일하고 있습니다. 회사와 제품에 관한 것은 쓰지 않고, 맡고 있는 일의 범위만 적습니다.

- Stateflow 로 제어 FSM 을 설계하고 검토합니다.
- 모델 기반 설계로 만든 제어 모델을 C 코드로 옮기고 검증합니다.
- EtherCAT 으로 제어 보드를 연결하고 시험합니다.

## 할 수 있는 것

| 영역 | 내용 | 근거 |
| --- | --- | --- |
| **FSM 설계와 검증** | 계층과 병렬을 쓴 supervisor 설계, Chart 실행 순서, 커버리지와 형식 증명까지의 검증 | [Stateflow 연재 23편](/posts/00-stateflow-series/) |
| **읽을 수 있는 Chart 만들기** | State 37개, Transition 67개짜리 Chart 를 API 로 배치해 그래픽 위반 32건을 0으로 | [레이아웃 연재 6편](/posts/00-sflayout-series/) |
| **실시간 제어 루프** | Linux PREEMPT-RT 에서 C++ 로 1 kHz 고정 주기, on-time 98.2% | 석사 연구 (아래) |
| **이종 통신 통합** | EtherCAT 으로 모터 위치와 속도 제어, CAN 과 시리얼로 센서 연결 | 석사 연구 (아래) |
| **적응형 제어** | 오차와 이동 추세로 게인을 실시간 갱신, 추종 성능 84% 향상 | KSME 2025 논문 (아래) |
| **힘 제어** | Fuzzy Logic 기반 Assist-as-needed, 사용자 상태에 따른 보조력 조절 | ICORR 2025 논문 (아래) |
| **외란 관측 제어** | ESO 와 대역폭 파라미터화, 이산화와 튜닝, 수식 유도까지 | [ADRC 연재 22편](/posts/00-adrc-series/) |
| **자율주행 스택** | 점유격자, EKF, scan matching, A\*, DWA 를 하나로 이어 붙인 AMR | [AMR 연재 21편](/posts/00-amr-series/) |
| **안전 설계** | E-stop 과 fail-safe, 속도와 가속도 한계를 3계층으로. 독립 safety gate | 석사 연구, [AMR 15~16편](/posts/15-amr-stateflow-supervisor/) |
| **로봇 소프트웨어 플랫폼** | ROS 2 로 실시간 제어와 데이터 분석, HMI 를 독립 노드로 분리 | 석사 연구 (아래) |
| **개발 도구 연결** | MCP 로 AI 에이전트를 MATLAB 에 붙이고 운영 경계를 정리 | [MCP 연재 18편](/posts/00-mcp-series/) |

언어는 C++, C, Python, MATLAB 을 씁니다. 도구는 Simulink 와 Stateflow, Linux PREEMPT-RT, ROS 2, Qt Creator, Git 입니다.

## 만든 것

### 실내 배송 AMR

MATLAB 과 Simulink, Stateflow 만으로 만든 프로젝트입니다. 계층과 병렬을 쓴 supervisor(State 37개, Transition 67개)에 2D LiDAR 와 A\* 전역계획, local costmap, DWA, 그리고 제어 경로와 분리된 safety gate 를 붙였습니다.

환경 3종과 상황 4종을 조합한 12가지를 두 번 돌려 12/12 를 통과했고, 최종 위치 오차는 0.080 m 이하였습니다.

[저장소](https://github.com/genie4youu/amr_robot_planning) · [연재 21편](/posts/00-amr-series/)

### stateflow-examples

순수 C 로 쓴 FSM 예제입니다. `make` 한 번으로 빌드되고 테스트가 돌며, push 마다 CI 가 상태 전이를 검증합니다.

[저장소](https://github.com/genie4youu/stateflow-examples)

## 석사 연구

부분체중부하 지면보행훈련을 위한 로보틱 체중탈부하 시스템을 만들었습니다. 국립재활원 과제였고, 전장 설계와 제작부터 임상 테스트까지 직접 수행했습니다.

SBC 에 Linux PREEMPT_RT 를 올려 C++ 과 Python 으로 제어기를 구성했고, 고정 주기 루프에서 위치와 속도, 장력 신호를 처리했습니다. 통신은 EtherCAT 과 CAN, 시리얼을 함께 썼습니다. ROS 2 로는 실시간 제어와 데이터 분석, HMI 를 독립 노드로 나누고, 분석 결과를 퍼블리시해 제어 노드의 폐루프 판단에 반영했습니다.

제어 쪽에서는 두 가지를 설계했습니다. 하나는 보행자의 위치와 속도 오차, 이동 추세에 따라 게인을 실시간으로 갱신하는 적응형 속도 제어입니다. 게인이 튀지 않도록 프로젝션과 데드존, 레이트 리미터로 변화 범위를 제한했습니다. 다른 하나는 사용자의 움직임에 따라 보조력을 조절하는 Fuzzy Logic 기반 힘 제어입니다. IMU 와 로드셀, 엔코더를 묶어 보행 상태와 협응도를 실시간으로 추정하고 개인별 보조값을 계산했습니다.

| 항목 | 결과 |
| --- | --- |
| 제어 주기 | 1 kHz 고정 주기, on-time 98.2% (SCHED_FIFO) |
| 추종 성능 | 게인 스케줄링 적용으로 84% 향상 |
| 과도 응답 가속도 | AR 예측과 감쇠기 적용으로 50% 이상 억제 |
| 현장 검증 | 피험자 15명 |

안전 쪽은 E-stop 과 fail-safe, 속도와 가속도 한계를 3계층으로 두었고, 실시간 로깅과 리플레이로 이상 상황을 재현해 원인을 추적했습니다.

## 논문과 특허

- **Real-Time Gait-Adaptive Acceleration Control for Natural Overground Walking on Interactive Treadmills**, 대한기계학회, 2025.05
- **Toward a Customizable Body Weight Support System with Interactive Treadmill for Patients with diverse gait impairments**, IEEE International Conference on Rehabilitation Robotics (ICORR), 2025.05
- **보행 훈련 장치**, 특허 출원 10-2024-0190629, 대한민국, 2024.12.18

## 학력

- 성균관대학교 대학원 지능형로봇학과 석사, 2023.08 ~ 2025.07
- 아주대학교 전자공학과 학사, 2017.03 ~ 2023.02
- OPIc Intermediate High, 2025.03

## 쓴 글

공부한 것을 다시 찾아보려고 정리합니다. 시리즈별 목록은 [시리즈](/series/) 에, 전체 목록은 [아카이브](/archives/) 에 있습니다.

## 연락

[github.com/genie4youu](https://github.com/genie4youu)
