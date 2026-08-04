---
# the default layout is 'page'
# Chirpy 는 탭 이름을 locale 에서 찾고, 없으면 이 title 을 쓴다.
# 커스텀 탭이라 locale 항목이 없으므로 title 이 없으면 파일명(SERIES)이 그대로 나온다.
title: 시리즈
icon: fas fa-layer-group
order: 1
---

이 블로그는 **다시 찾아보기 위한 자료 정리함**입니다. 글이 101편이라 시간순으로는 찾기 어려워서, 시리즈 단위로 정리했습니다.

각 시리즈의 **00번 글이 그 시리즈의 목차**입니다. 거기서 시작하면 됩니다.

---

## 📐 Stateflow — 23편

> [**목차 →**](/posts/00-stateflow-series/) 배터리 충전 제어를 관통 예제로 씁니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [기초](/posts/01-why-fsm/) | 01~07 | State와 Transition, 계층, Junction, 병렬, Function |
| [**실행 순서**](/posts/08-chart-execution/) | 08~11 | **같은 Chart가 다르게 도는 이유.** `during` 실행 조건, Backtracking, 병렬 순서, Super Step |
| [설계 판단](/posts/16-sf-chart-type-choice/) | 12, 15~17 | debounce, Bus Signals, 어느 형태로 그릴지, History Junction |
| [관측과 디버깅](/posts/14-sf-data-inspector/) | 14, 19 | Simulation Data Inspector, Sequence Viewer, Activity Profiler |
| [**검증**](/posts/21-sf-coverage/) | 18, 21~22 | **"테스트했다"와 "검증했다"의 차이.** edit-time 검사, 커버리지, 형식 증명 |
| [자동화](/posts/20-sf-api-basics/) | 13, 20 | Stateflow API, User's Guide 탐색법 |

## 🔧 Stateflow 레이아웃을 코드로 만들기 — 6편

> [**목차 →**](/posts/00-sflayout-series/) State 37개, Transition 67개짜리 차트를 사람이 읽을 수 있게 만든 기록입니다.

논리가 맞는 것과 사람이 검토할 수 있는 것은 다릅니다. 그래픽 위반 32건을 0으로 만들면서 확인한 것들입니다. Transition 그래픽 속성이 서로 독립이 아니라는 것, `subviewS.pos` 를 배치 영역으로 착각했던 것, 검사기가 세 번 통과시킨 것을 실패 경로 그대로 남겼습니다.

## 🎛️ ADRC — 22편

> [**목차 →**](/posts/00-adrc-series/) 정확한 모델 없이 외란을 추정해 상쇄하는 제어 기법입니다.

| 부 | 편 | 내용 |
| --- | --- | --- |
| [발상](/posts/01-why-adrc/) | 01~04 | PID의 한계, 총외란, 표준형, 원형 3요소 |
| [설계](/posts/05-extended-state-observer/) | 05~10 | ESO, 대역폭 파라미터화, b0, 차수, PID 등가성 |
| [구현](/posts/11-discretization/) | 11~16 | 이산화, 튜닝, 대역폭 한계, 안정성, 실시간, CLA |
| [적용](/posts/17-motor-joint-loops/) | 17~18 | 모터 조인트 루프, 검증 |
| [**부록 — 수식 유도**](/posts/19-adrc-derivation-cancellation-eso/) | 19~21 | 본편이 건너뛴 증명. **한 줄도 안 건너뜁니다** |

원전을 직접 읽은 기록도 있습니다 → [Han 2009](/posts/paper-han2009-pid-to-adrc/), [Herbst & Madoński](/posts/book-adrc-principles-to-practice/)

## 🤖 실내 배송 AMR — 21편

> [**목차 →**](/posts/00-amr-series/) MATLAB, Simulink, Stateflow 만으로 만든 관통 프로젝트입니다.
> 저장소 → [genie4youu/amr_robot_planning](https://github.com/genie4youu/amr_robot_planning)

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [시스템 설계](/posts/01-amr-architecture/) | 01, 03 | 아키텍처, 좌표계와 시간 |
| [로봇 모델링](/posts/02-amr-se2-pose/) | 02, 04 | SE(2) 포즈, 차동구동 |
| [센서와 인지](/posts/05-amr-lidar-raycasting/) | 05~06 | LiDAR ray casting, 노이즈와 dropout |
| [지도와 위치추정](/posts/07-amr-occupancy-logodds/) | 07~10 | log-odds 점유격자, EKF, scan matching, pose graph |
| [경로계획](/posts/11-amr-costmap-astar/) | 11~14 | costmap과 A*, 경로 평활화, Pure Pursuit, DWA |
| [감독제어와 안전](/posts/15-amr-stateflow-supervisor/) | 15~16 | Stateflow supervisor, 독립 safety gate |
| [통합과 검증](/posts/17-amr-system-integration/) | 17~20 | 통합 모델, 회귀검증, 배송과 도킹, 회고 |

## 🔌 MCP와 MATLAB 연결 — 18편

> [**목차 →**](/posts/00-mcp-series/) AI 에이전트를 MATLAB 에 붙이는 프로토콜과 실무 설정입니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [프로토콜 이론](/posts/01-what-is-mcp/) | 01~06 | 아키텍처, 트랜스포트, Primitives, JSON-RPC, 보안 모델 |
| [실무 설정](/posts/07-matlab-mcp-server/) | 07~12 | MATLAB MCP 서버, 설치, 세션 공유, 첫 실행, 트러블슈팅 |
| [운영과 경계](/posts/13-mcp-next-steps/) | 13~17 | 편집기 연동, 시작 자동화, 승인 모드, 작업공간 경계 |

## 📄 업계 읽기 — 8편

<!-- 아래 카테고리 주소의 %EC%97%85%EA%B3%84-%EC%9D%BD%EA%B8%B0 는 "업계-읽기" 다.
     한글을 날것으로 적으면 htmlproofer 가 내부 링크를 못 찾을 수 있어 퍼센트 인코딩해 둔다. -->

> 매일 읽은 뉴스, 논문과 책 한 편씩의 상세 리딩, 그것을 한 주 단위로 묶은 동향입니다.
> [카테고리 전체 →](/categories/%EC%97%85%EA%B3%84-%EC%9D%BD%EA%B8%B0/)

**논문과 책**

- [Han 2009 — From PID to ADRC](/posts/paper-han2009-pid-to-adrc/)
- [Herbst & Madoński — ADRC: From Principles to Practice](/posts/book-adrc-principles-to-practice/)
- [UniFP — 위치와 힘 통합 정책](/posts/paper-unifp-force-position/)

**주간 동향** — [2026-W31 규제는 증명 체계를 보고, 기술은 계층을 합친다](/posts/trend-2026-w31/)

**뉴스** — 하루치 로보틱스 브리핑 4편. 최신은 [2026-07-31](/posts/news-20260731/)

## ☕ 쉬어가기 — 3편

> [**목차 →**](/posts/00-office-rpg-series/) 공부 글이 아닌 읽을거리입니다.

---

## 어디서부터 읽을까

| 이런 분 | 추천 |
| --- | --- |
| Stateflow 를 처음 본다 | [01. FSM이 필요한 이유](/posts/01-why-fsm/) |
| Chart 는 그릴 줄 안다 | [08~11 실행 순서](/posts/08-chart-execution/) |
| 돌아가는 건 봤고 맞는지 알고 싶다 | [21. 관찰과 증명](/posts/21-sf-coverage/) |
| 제어 이론 쪽이 궁금하다 | [ADRC 목차](/posts/00-adrc-series/) |
| 실제로 굴러가는 프로젝트가 보고 싶다 | [AMR 목차](/posts/00-amr-series/) |
| 코드 예제가 보고 싶다 | [stateflow-examples](https://github.com/genie4youu/stateflow-examples) |
