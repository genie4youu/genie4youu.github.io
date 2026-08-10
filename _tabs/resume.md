---
# 탭 이름은 _data/locales/ko-KR.yml 의 tabs.resume 가 정한다.
# 키가 파일명(resume)이어야 하므로 여기에 한글 title 을 두지 않는다.
icon: fas fa-id-card
order: 6
---

로봇 제어 소프트웨어 엔지니어입니다. 석사 과정에서 재활 로봇의 전장 설계부터 이종 통신, 실시간 제어 루프, 제어 알고리즘, 운영자 HMI 까지 시스템 전 계층을 직접 구축했습니다. 현재는 상위 제어기 설계와 검증으로 범위를 넓히고 있습니다.

## 학력

| 기간 | 학교 | 전공 |
| --- | --- | --- |
| 2023.08 ~ 2025.07 | 성균관대학교 대학원 | 지능형로봇학과 석사 |
| 2017.03 ~ 2023.02 | 아주대학교 | 전자공학과 학사 |

석사 연구분야는 정밀 실시간 제어와 스트리밍 데이터 예측을 접목한 로봇 시스템입니다.

## 경력

### 로봇 제어 소프트웨어 엔지니어 (2026.07 ~ 재직 중)

- Stateflow 기반 제어 FSM 설계 및 검토
- 모델 기반 설계로 작성된 제어 모델의 C 코드 변환 및 검증
- EtherCAT 기반 제어 보드 연동 및 시험

### 성균관대학교 RBL 연구실, 연구원 (2023.08 ~ 2025.07)

**부분체중부하 지면보행훈련을 위한 로보틱 체중탈부하 시스템** (국립재활원 수행과제, 2024.05 ~ 2025.11)

- 시스템 전장 설계 및 제작
- SBC 기반 실시간 제어 시스템 구축. Linux PREEMPT-RT 환경에서 C++ 과 Python 으로 제어기를 구성하고, 고정 주기 루프에서 위치, 속도, 장력 신호를 처리
- 이종 통신 통합. EtherCAT 으로 모터 위치와 속도를 제어하고 CAN 과 Serial 로 센서를 연동
- ROS 2 기반 소프트웨어 플랫폼 설계. 실시간 제어, 데이터 분석, HMI 를 독립 노드로 분리하고 분석 결과를 퍼블리시해 제어 노드의 폐루프 판단에 반영
- 적응형 속도 제어 알고리즘 개발. 보행자의 위치와 속도 오차, 이동 추세로 게인을 실시간 갱신하고 프로젝션, 데드존, 레이트 리미터로 변화 범위를 제한
- Fuzzy Logic 기반 힘 제어(Assist-as-needed) 알고리즘 개발. IMU, 로드셀, 엔코더를 통합해 보행 상태와 협응도를 실시간 추정하고 개인별 보조값을 산출
- Qt Creator 기반 운영자 HMI 구현. 상태 모니터링과 데이터 로깅
- 안전 로직 설계. E-stop 과 fail-safe, 속도와 가속도 한계를 3계층으로 구성하고 실시간 로깅과 리플레이로 이상 상황을 재현
- 실험 설계 및 임상 테스트 수행

| 항목 | 결과 |
| --- | --- |
| 제어 주기 | 1 kHz 고정 주기, on-time 98.2% (SCHED_FIFO) |
| 추종 성능 | 게인 스케줄링 적용으로 84% 향상 |
| 과도 응답 가속도 | AR 예측과 감쇠기 적용으로 50% 이상 억제 |
| 임상 검증 | 피험자 15명 |

## 논문 및 특허

**Real-Time Gait-Adaptive Acceleration Control for Natural Overground Walking on Interactive Treadmills**
대한기계학회(KSME), 2025.05

**Toward a Customizable Body Weight Support System with Interactive Treadmill for Patients with diverse gait impairments**
IEEE International Conference on Rehabilitation Robotics (ICORR), 2025.05

**보행 훈련 장치**
특허 출원 10-2024-0190629, 대한민국, 2024.12.18

## 자격 및 수상

| 시기 | 항목 | 상세 |
| --- | --- | --- |
| 2025.03 | OPIc | Intermediate High (영어) |
| 2018.12 | 자유 PPT 발표 대회 대상 | 아주대학교 |
| 2018.09 | 하계 전자 전시회 장려상 | 아주대학교 |
| 2017.12 | 자유 PPT 발표 대회 우수상 | 아주대학교 |

## 기술 스택

| 구분 | 내용 |
| --- | --- |
| 언어 | C++, C, Python, MATLAB |
| 모델 기반 설계 | Simulink, Stateflow, 계층 및 병렬 FSM, 커버리지와 형식 검증 |
| 제어 | 적응형 제어, 게인 스케줄링, Fuzzy Logic, 외란 관측기 기반 제어 |
| 실시간 및 임베디드 | Linux PREEMPT-RT, SCHED_FIFO, 고정 주기 제어 루프 |
| 통신 | EtherCAT, CAN, Serial |
| 자율주행 | 점유격자, EKF, scan matching, A\*, DWA |
| 플랫폼 및 도구 | ROS 2, Qt Creator, Visual Studio, Git |

## 프로젝트

### 실내 배송 AMR

MATLAB 과 Simulink, Stateflow 로 구현한 자율주행 로봇입니다. 계층과 병렬을 사용한 supervisor(State 37개, Transition 67개)에 2D LiDAR, A\* 전역 계획, local costmap, DWA, 그리고 제어 경로와 분리된 독립 safety gate 를 결합했습니다.

환경 3종과 상황 4종을 조합한 12개 시나리오를 2회 반복해 12/12 를 통과했고, 최종 위치 오차는 0.080 m 이하입니다. supervisor 는 Stateflow API 로 레이아웃을 자동 배치해 그래픽 규칙 위반 32건을 0건으로 정리했습니다.

[저장소](https://github.com/genie4youu/amr_robot_planning), [구현 과정 21편](/posts/00-amr-series/), [레이아웃 자동화 6편](/posts/00-sflayout-series/)

### stateflow-examples

순수 C 로 작성한 FSM 예제 모음입니다. `make` 한 번으로 빌드와 테스트가 실행되고, push 마다 CI 가 상태 전이를 검증합니다.

[저장소](https://github.com/genie4youu/stateflow-examples)

## 기술 블로그

공부한 것을 다시 찾아보려고 정리합니다. 연재별 목록은 [시리즈](/series/), 전체 목록은 [아카이브](/archives/)에 있습니다.

| 연재 | 편수 | 내용 |
| --- | --- | --- |
| [Stateflow](/posts/00-stateflow-series/) | 23편 | 실행 의미론, 계층과 병렬, 커버리지와 형식 증명 |
| [ADRC](/posts/00-adrc-series/) | 22편 | 확장 상태 관측기, 대역폭 파라미터화, 이산화와 튜닝 |
| [실내 배송 AMR](/posts/00-amr-series/) | 21편 | 점유격자에서 supervisor 까지의 구현 과정 |
| [MCP](/posts/00-mcp-series/) | 18편 | AI 에이전트를 MATLAB 에 연결하고 운영 경계를 정리 |
| [Stateflow 레이아웃 자동화](/posts/00-sflayout-series/) | 6편 | API 기반 자동 배치와 그래픽 규칙 검사 |

## 연락처

[github.com/genie4youu](https://github.com/genie4youu)
