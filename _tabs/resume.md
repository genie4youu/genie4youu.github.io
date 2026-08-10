---
# 탭 이름은 _data/locales/ko-KR.yml 의 tabs.resume 가 정한다.
# 키가 파일명(resume)이어야 하므로 여기에 한글 title 을 두지 않는다.
icon: fas fa-id-card
order: 6
---

로봇 제어 소프트웨어 엔지니어입니다. 석사 과정에서 재활 로봇의 전장 설계부터 이종 통신, 실시간 제어 루프, 제어 알고리즘, 운영자 HMI 까지 시스템 전 계층을 직접 구축했습니다. 현재는 상위 제어기 설계와 검증으로 범위를 넓히고 있습니다.

- 국제 학술 논문 1편, 국내 학술 논문 1편 (KSME, IEEE ICORR 2025), 국내 특허 1건 출원
- 15명 대상 현장 검증을 완료한 센서 기반 제어 시스템 개발 경험

## 학력

| 기간 | 학교 | 전공 | 상태 |
| --- | --- | --- | --- |
| 2023.08 ~ 2025.07 | 성균관대학교 대학원(자연과학) | 지능형로봇학과 (석사) | 졸업 |
| 2017.03 ~ 2023.02 | 아주대학교 (4년제) | 전자공학과 (학사) | 졸업 |

- 석사 소속 연구실: RBL
- 석사 연구분야: 정밀 실시간 제어와 스트리밍 데이터 예측을 접목한 로봇 시스템

## 경력

### 로봇 제어 소프트웨어 엔지니어 (2026.07 ~ 재직 중)

- Stateflow 기반 제어 FSM 설계 및 검토
- 모델 기반 설계로 작성된 제어 모델의 C 코드 변환 및 검증
- EtherCAT 기반 제어 보드 연동 및 시험

### RBL 연구실, 연구원 (석사과정) (2023.08 ~ 2025.07, 2년)

연구분야는 정밀 실시간 제어와 스트리밍 데이터 예측을 접목한 로봇 시스템입니다.

#### 부분체중부하 지면보행훈련을 위한 로보틱 체중탈부하 시스템의 고도화

국립재활원 수행과제 (2024.05 ~ 2025.11)

수행 업무

- 시스템 전장 설계 및 제작
- SBC 기반 실시간 제어 시스템 구축. Linux PREEMPT-RT 환경에서 C++ 과 Python 으로 실시간 제어기를 구성하고, 고정 주기 루프에서 위치, 속도, 장력 신호를 처리
- 이종 통신 통합. Serial, CAN, EtherCAT
- ROS 2 기반 플랫폼 설계. 실시간 제어, 데이터 분석, HMI 를 독립 노드(프로세스)로 분리하고, 분석 결과를 퍼블리시하여 제어 노드의 폐루프 의사결정에 반영
- Fuzzy Logic 기반 힘 제어(Assist-as-needed) 알고리즘 개발. Rule-base 추론으로 실시간 보조력 조절
- 적응형 속도 제어 알고리즘 개발
- 보행 패턴 분석 및 개인 맞춤형 트레드밀 속도 제어 알고리즘 개발
- Qt Creator 기반 운영자 HMI 구현. 상태 모니터링, 데이터 로깅
- MATLAB 과 Simulink 활용. 파라미터 튜닝, 주파수 응답 확인, 실험 데이터 후처리
- 안전 로직 설계. E-stop, fail-safe, 속도와 가속도 한계, 예외 처리
- 실험 설계 및 임상 테스트 진행 (15명)

실적

- 국제 학술 대회 학술 논문 발표. The IEEE International Conference on Rehabilitation Robotics (ICORR)
- 국내 학술 대회 학술 논문 발표. 대한기계학회
- 특허 출원 1건

| 항목 | 수치 |
| --- | --- |
| 제어 주기 | 1 kHz, on-time 98.2% (Linux PREEMPT-RT, SCHED_FIFO) |
| 추종 성능 | 게인 스케줄링 적용으로 84% 향상 |
| 과도 응답 가속도 | AR 예측과 attenuator 적용으로 50% 이상 억제 |
| 현장 검증 | 피험자 15명 |
| ROS 2 노드 구성 | 3노드 (실시간 제어, 데이터 분석, HMI) |
| EtherCAT | PDO 동기 매핑으로 모터 위치와 속도 제어 |

## 경험, 활동, 교육

### 한국산업기술진흥원, 교육 이수 내역 (2023.08 ~ 2025.07)

친환경자동차(xEV) 부품개발 R&D 전문인력양성. 친환경자동차 관련 교육 수강

- 전력 반도체
- 파워모듈의 이해
- V2G 기술의 이해
- Chat GPT 이해와 활용
- 개발자도 알아야 할 차량 SW 품질 이론과 사례

## 논문 및 특허

### 논문

**1) Real-Time Gait-Adaptive Acceleration Control for Natural Overground Walking on Interactive Treadmills**<br>
대한기계학회(KSME), 2025.05

- **적응형 속도 제어 (Souman 기반):** 보행자의 위치와 속도 오차, 이동 추세에 따라 제어기 파라미터를 실시간 갱신하는 adaptive controller 설계. 프로젝션, 데드존, 레이트 리미터로 게인 변화를 안전 범위로 제한하여 급복귀와 오버슈트를 억제하고 중심 유지 성능을 높임
- **순간 속도 변화 완화 (예측과 감쇠):** 사용자 연결 케이블의 장력 변화를 AR(Autoregressive) 시계열 예측으로 다음 구간의 속도 요구를 추정하고, attenuator 로 속도를 부드럽게 이행

**2) Toward a Customizable Body Weight Support System with Interactive Treadmill for Patients with diverse gait impairments**<br>
IEEE International Conference on Rehabilitation Robotics (ICORR) 2025, 2025.05

- **Fuzzy Logic 기반 보조력 제어:** 사용자의 움직임에 따라 보조력이 자동 조절되는 Assist-as-needed 알고리즘 설계, Rule-base 추론으로 실시간 제어 수행
- **보행 상태 추정 및 지표 산출:** IMU, 로드셀, 엔코더 데이터를 통합하여 보행 상태와 사용자 협응도를 실시간 추정, 개인 맞춤형 보조값 계산

### 특허

| 명칭 | 출원번호 | 국가 | 출원일 |
| --- | --- | --- | --- |
| 보행 훈련 장치 | 10-2024-0190629 | 대한민국 | 2024.12.18 |

## 자격, 어학, 수상

| 시기 | 항목 | 상세 |
| --- | --- | --- |
| 2025.03 | OPIc | Intermediate High / PASS (영어) |
| 2018.12 | 자유 PPT 발표 대회 **대상(1등)** | 아주대학교 |
| 2018.09 | 2018년 하계 전자 전시회 **장려상** | 아주대학교 |
| 2017.12 | 자유 PPT 발표 대회 **우수상(3등)** | 아주대학교 |

## 기술 스택

- **프로그래밍 언어:** C++, C, Python, MATLAB
- **툴 및 환경:** ROS 2, Linux (PREEMPT-RT), MATLAB, Simulink, Stateflow, Visual Studio, Qt Creator, Git
- **스킬 태그:** MATLAB, Simulink, ROS, Linux, C, C++, Python, 알고리즘, RTOS
- **실시간 및 임베디드:** RTOS, Linux PREEMPT-RT, SCHED_FIFO, 고정 주기 제어 루프
- **제어:** 적응형 제어, 게인 스케줄링, AR 기반 시계열 예측, Fuzzy Logic, 외란 관측기 기반 제어
- **모델 기반 설계:** Simulink, Stateflow, 계층 및 병렬 FSM, 커버리지와 형식 검증
- **통신:** EtherCAT, CAN, Serial
- **자율주행:** 점유격자, EKF, scan matching, A\*, DWA

### 핵심 역량

- 지능형로봇공학 수업 수강: 로봇 키네마틱스 이론, 다중 센서 통합 및 3D 좌표계 변환
- Linux PREEMPT-RT 환경에서 C++ 기반 1 kHz 고정 주기 제어 루프 구축
- ROS 2 기반 로봇 소프트웨어 플랫폼 설계: 실시간 제어 / 데이터 분석 / HMI 노드 분리
- EtherCAT / CAN / Serial 이종 통신 기반 모터 위치와 속도 제어 및 센서 시스템 통합
- 적응형 제어 알고리즘 설계: 게인 스케줄링, AR 기반 시계열 예측, Fuzzy Logic 기반 실시간 파라미터 갱신으로 추종 성능 향상
- Qt Creator 기반 운영자 HMI 설계와 구현 (상태 모니터링, 데이터 로깅)
- MATLAB / Simulink 기반 시스템 모델링 및 파라미터 튜닝

## 프로젝트

### 실내 배송 AMR supervisory FSM

MATLAB 과 Simulink, Stateflow 로 구현한 자율주행 로봇입니다.

- 계층과 병렬을 사용한 supervisor(State 37개, Transition 67개)에 2D LiDAR, A\* 전역 계획, local costmap, DWA, 제어 경로와 분리된 독립 safety gate 를 결합
- 검증: 환경 3종과 상황 4종을 조합한 12개 시나리오를 2회 반복하여 12/12 통과, 최종 위치 오차 0.080 m 이하
- supervisor 레이아웃을 Stateflow API 로 자동 배치하여 그래픽 규칙 위반 32건을 0건으로 정리

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
