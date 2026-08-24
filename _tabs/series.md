---
# the default layout is 'page'
# 탭 이름은 _data/locales/ko-KR.yml 의 tabs.series 가 정한다.
# 키가 파일명(series)이어야 하므로 여기에 한글 title 을 두지 않는다.
# 한글 title 을 두면 사이드바에는 나오지만 <title> 태그가 비어 버린다.
#
# 🔴 편수는 손으로 적지 않는다. 아래 Liquid 가 _posts/ 를 직접 센다.
#    (2026-08-24: 손으로 적힌 값이 101편에서 멈춰 있었고, 시리즈 절 3개가
#     통째로 빠져 사이트의 58%가 이 페이지에 안 보였다.)
icon: fas fa-layer-group
order: 1
---

{%- assign n_comm = 0 -%}{%- assign n_rtos = 0 -%}{%- assign n_mp = 0 -%}
{%- assign n_sf = 0 -%}{%- assign n_sfl = 0 -%}{%- assign n_adrc = 0 -%}
{%- assign n_amr = 0 -%}{%- assign n_mcp = 0 -%}{%- assign n_read = 0 -%}{%- assign n_etc = 0 -%}{%- assign n_orch = 0 -%}{%- assign n_cc = 0 -%}
{%- for p in site.posts -%}
  {%- comment -%} 🔴 00 목차 글은 세지 않는다 — landing.html 의 카드 편수와 같은 규약이다. {%- endcomment -%}
  {%- if p.categories contains '목차' -%}{%- continue -%}{%- endif -%}
  {%- if p.path contains '_posts/comm-' -%}{%- assign n_comm = n_comm | plus: 1 -%}
  {%- elsif p.path contains '_posts/rtos-' -%}{%- assign n_rtos = n_rtos | plus: 1 -%}
  {%- elsif p.path contains '_posts/matlab/' or p.path contains '_posts/simulink/' or p.path contains '_posts/stateflow-syntax/' -%}{%- assign n_mp = n_mp | plus: 1 -%}
  {%- elsif p.path contains '_posts/stateflow/' -%}{%- assign n_sf = n_sf | plus: 1 -%}
  {%- elsif p.path contains '_posts/sflayout/' -%}{%- assign n_sfl = n_sfl | plus: 1 -%}
  {%- elsif p.path contains '_posts/adrc/' -%}{%- assign n_adrc = n_adrc | plus: 1 -%}
  {%- elsif p.path contains '_posts/amr/' -%}{%- assign n_amr = n_amr | plus: 1 -%}
  {%- elsif p.path contains '_posts/mcp/' -%}{%- assign n_mcp = n_mcp | plus: 1 -%}
  {%- elsif p.path contains '_posts/news/' or p.path contains '_posts/papers/' or p.path contains '_posts/trends/' -%}{%- assign n_read = n_read | plus: 1 -%}
  {%- elsif p.path contains '_posts/orch/' -%}{%- assign n_orch = n_orch | plus: 1 -%}
  {%- elsif p.path contains '_posts/ccsetup/' -%}{%- assign n_cc = n_cc | plus: 1 -%}
  {%- elsif p.path contains '_posts/etc/' -%}{%- assign n_etc = n_etc | plus: 1 -%}
  {%- endif -%}
{%- endfor -%}

이 블로그는 **다시 찾아보기 위한 자료 정리함**입니다. 글이 {{ site.posts.size }}편이라 시간순으로는 찾기 어려워서, 시리즈 단위로 정리했습니다.

각 시리즈의 **00번 글이 그 시리즈의 목차**입니다. 거기서 시작하면 됩니다. 다만 업계 읽기는 흐름 콘텐츠라 목차 글 대신 카테고리로 갑니다.

---

## 📡 로봇 통신 — {{ n_comm }}편

> [**목차 →**](/posts/00-comm-series/) 도달, 동기, 경계, 무결, 조정, 시간. 여섯 칸을 정해 두고 SPI 부터 EtherCAT 까지 같은 표를 채워 나갑니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [기초](/posts/01-basics-what-comm-solves/) | 01~12 | 계층, 차동 신호, 전송선, 동기와 비동기, 프레이밍, 오류 검출, 흐름 제어, 엔디안, 지터 |
| [보드 안 — SPI, I²C](/posts/01-spi-i2c-why-onboard/) | 01~10 | 왜 보드 안에서는 이 둘인가, 클럭 모드, 주소 지정, 센서 드라이버 |
| [직렬](/posts/01-uart-async-meaning/) | 01~17 | UART 의 비동기가 뜻하는 것, RS-232/422/485, Modbus, 엔코더 SSI / BiSS-C / EnDat |
| [CAN](/posts/01-can-what-it-solves/) | 01~16 | 중재, 비트 타이밍, 오류 상태 관리, CANopen, [**CiA 402 드라이브**](/posts/16-cia402-sequencer-example/) |
| [이더넷](/posts/01-ethernet-frame-mac/) | 01~05 | 프레임과 MAC, 스위치 큐 지연, TCP/UDP 가 보장하는 것, [**왜 표준 이더넷은 실시간이 아닌가**](/posts/04-why-ethernet-not-realtime/) |
| [**EtherCAT**](/posts/00-ethercat-overview/) | 00~17 | **처음 읽는 사람을 위한 지도**부터. on-the-fly 처리, FMMU, SyncManager, ESM, 분산 클럭, PDO 매핑, CoE, [마스터 구현](/posts/17-ethercat-master-skeleton/) |
| [정리](/posts/01-protocol-comparison-table/) | 01~05 | 비교표, 선택 가이드, 계층 대응표, 공통 실패 패턴, 통합 디버그 체크리스트 |

이더넷 5편은 독립 주제가 아니라 EtherCAT 의 디딤돌입니다. "왜 표준 이더넷으로는 안 되는가" 하나를 위해 있습니다.

## ⏱️ RTOS와 실시간 — {{ n_rtos }}편

> [**목차 →**](/posts/00-rtos-series/) 실시간은 빠른 것이 아니라 늦지 않는 것입니다. 스케줄 가능성을 손으로 계산하고, 리눅스와 윈도우에서 실제로 재봤습니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [이론](/posts/01-what-is-realtime/) | 01~16 | 태스크 모델, RM 과 EDF, 응답시간 분석, [**우선순위 역전과 Mars Pathfinder**](/posts/08-priority-inversion-mars-pathfinder/), 지터, WCET, 멀티코어 |
| [리눅스 실시간](/posts/01-why-linux-not-realtime/) | 01~14 | PREEMPT_RT 가 하는 일, `SCHED_FIFO`, `mlockall`, 코어 격리와 IRQ 친화도, `cyclictest`, [**1 kHz 제어 루프 C 코드**](/posts/11-realtime-control-loop-c/) |
| [윈도우 실시간](/posts/01-why-windows-not-realtime/) | 01~11 | 📏 **이 PC 실측** — 타이머 해상도, DPC/ISR 지연, MMCSS, 코어 파킹, RTX64, TwinCAT |

제어와 만나는 지점 → [리눅스에서 EtherCAT 마스터](/posts/13-ethercat-master-on-linux/) · [지터가 어디서 생기나](/posts/11-jitter-sources/)

## 🧮 MATLAB과 Simulink 문법 — {{ n_mp }}편

> [**목차 →**](/posts/00-mp-series/) 남이 만든 모델을 읽기 위한 최소 문법입니다. 정수 타입과 비트 연산에서 시작합니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [MATLAB](/posts/01-matlab-variables-arrays/) | 01~06 | 변수와 배열, 데이터 타입, **형 변환과 포화**, **비트 연산**, 연산자, 내장 함수 |
| [Simulink](/posts/01-reading-simulink-models/) | 01~09 | 모델 읽는 법, 수학과 논리 블록, 비트 시프트, 신호 라우팅과 Bus, 데이터 타입, 상태 블록과 Data Store, 계층과 조건부 실행, 샘플 타임 |
| [Stateflow 문법](/posts/01-sf-chart-elements/) | 01~06 | 구성 요소, Chart 속성, State 와 Action, **Transition 읽는 법**, Data Scope, 시간 연산자 |

## 📐 Stateflow — {{ n_sf }}편

> [**목차 →**](/posts/00-stateflow-series/) 배터리 충전 제어 하나를 처음부터 끝까지 이어서 씁니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [기초](/posts/01-why-fsm/) | 01~07 | State와 Transition, 계층, Junction, 병렬, Function |
| [**실행 순서**](/posts/08-chart-execution/) | 08~11 | **같은 Chart가 다르게 도는 이유.** `during` 실행 조건, Backtracking, 병렬 순서, Super Step |
| [설계 판단](/posts/16-sf-chart-type-choice/) | 12, 15~17 | debounce, Bus Signals, 어느 형태로 그릴지, History Junction |
| [관측과 디버깅](/posts/14-sf-data-inspector/) | 14, 19 | Simulation Data Inspector, Sequence Viewer, Activity Profiler |
| [**검증**](/posts/21-sf-coverage/) | 18, 21~22 | **"테스트했다"와 "검증했다"의 차이.** edit-time 검사, 커버리지, 형식 증명 |
| [자동화](/posts/20-sf-api-basics/) | 13, 20 | Stateflow API, User's Guide 탐색법 |

## 🔧 Stateflow 레이아웃을 코드로 만들기 — {{ n_sfl }}편

> [**목차 →**](/posts/00-sflayout-series/) State 37개, Transition 67개짜리 차트를 사람이 읽을 수 있게 만든 기록입니다.

논리가 맞는 것과 사람이 검토할 수 있는 것은 다릅니다. 그래픽 위반 32건을 0으로 만들면서 확인한 것들입니다. Transition 그래픽 속성이 서로 독립이 아니라는 것, `subviewS.pos` 를 배치 영역으로 착각했던 것, 검사기가 세 번 통과시킨 것을 실패 경로 그대로 남겼습니다.

## 🎛️ ADRC — {{ n_adrc }}편

> [**목차 →**](/posts/00-adrc-series/) 정확한 모델 없이 외란을 추정해 상쇄하는 제어 기법입니다.

| 부 | 편 | 내용 |
| --- | --- | --- |
| [발상](/posts/01-why-adrc/) | 01~04 | PID의 한계, 총외란, 표준형, 원형 3요소 |
| [설계](/posts/05-extended-state-observer/) | 05~10 | ESO, 대역폭 파라미터화, b0, 차수, PID 등가성 |
| [구현](/posts/11-discretization/) | 11~16 | 이산화, 튜닝, 대역폭 한계, 안정성, 실시간, CLA |
| [적용](/posts/17-motor-joint-loops/) | 17~18 | 모터 조인트 루프, 검증 |
| [**부록 — 수식 유도**](/posts/19-adrc-derivation-cancellation-eso/) | 19~21 | 본편이 건너뛴 증명. **한 줄도 안 건너뜁니다** |

원전을 직접 읽은 기록도 있습니다 → [Han 2009](/posts/paper-han2009-pid-to-adrc/), [Herbst & Madoński](/posts/book-adrc-principles-to-practice/)

## 🤖 실내 배송 AMR — {{ n_amr }}편

> [**목차 →**](/posts/00-amr-series/) MATLAB, Simulink, Stateflow 만으로 만든 프로젝트입니다.
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

## 🔌 MCP와 MATLAB 연결 — {{ n_mcp }}편

> [**목차 →**](/posts/00-mcp-series/) AI 에이전트를 MATLAB 에 붙이는 프로토콜과 실무 설정입니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [프로토콜 이론](/posts/01-what-is-mcp/) | 01~06 | 아키텍처, 트랜스포트, Primitives, JSON-RPC, 보안 모델 |
| [실무 설정](/posts/07-matlab-mcp-server/) | 07~12 | MATLAB MCP 서버, 설치, 세션 공유, 첫 실행, 트러블슈팅 |
| [운영과 경계](/posts/13-mcp-next-steps/) | 13~17 | 편집기 연동, 시작 자동화, 승인 모드, 작업공간 경계 |

## 🎛️ Claude Code 세팅 — {{ n_cc }}편

> [**목차 →**](/posts/00-ccsetup-series/) 슬래시 명령, 서브에이전트, Skill, Hook, MCP. 다섯 갈래가 각각 무엇을 고정하고 언제 고르는지 정리했습니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [왜와 무엇](/posts/01-why-prompt-is-not-enough/) | 01~03 | 프롬프트의 한계, 절차를 파일로, [**컨텍스트 격리**](/posts/03-subagents/) |
| [통제](/posts/04-tools-not-requests/) | 04~06 | 도구로 막기, [**검증은 쓴 쪽이 하지 않는다**](/posts/05-independent-verification/), Hook 과 오탐률 |
| [확장과 운영](/posts/07-skills/) | 07~10 | Skill, MCP, [예약 실행과 중단 검출](/posts/09-scheduled-runs/), 고르는 기준 |

## 🕸️ 에이전트 오케스트레이션 — {{ n_orch }}편

> [**목차 →**](/posts/00-orch-series/) 여러 에이전트를 어떻게 엮을 것인가. State, Transition, 병렬, History 라는 FSM 어휘로 그 배선을 읽습니다.

| 구간 | 편 | 내용 |
| --- | --- | --- |
| [문제와 정의](/posts/01-why-one-agent-breaks/) | 01~03 | 에이전트 하나가 깨지는 세 가지, 하네스라는 층, [**Stateflow 대응표**](/posts/03-stateflow-mapping/) |
| [배선](/posts/04-fanout-as-parallel-states/) | 04~06 | 축으로 나누는 팬아웃, [**파이프라인과 배리어**](/posts/05-pipeline-and-barrier/), 스키마가 곧 guard |
| [신뢰성](/posts/07-adversarial-verification/) | 07~12 | 적대적 검증, 수렴 조건, [**자원 경합**](/posts/09-resource-contention/), 권한 인터록, 재개, [깨지는 방식들](/posts/12-how-it-breaks/) |

⚠️ 대응은 **어휘 수준**이고 의미론까지 같지는 않습니다. Stateflow 의 병렬 상태는 실제로 동시에 돌지 않고, 오케스트레이션의 팬아웃은 실제로 동시에 돕니다. 03편에서 그 선을 긋습니다.

## 📄 업계 읽기 — {{ n_read }}편

<!-- 아래 카테고리 주소의 %EC%97%85%EA%B3%84-%EC%9D%BD%EA%B8%B0 는 "업계-읽기" 다.
     한글을 날것으로 적으면 htmlproofer 가 내부 링크를 못 찾을 수 있어 퍼센트 인코딩해 둔다. -->

> 매일 읽은 뉴스, 논문과 책 한 편씩의 상세 리딩, 그것을 한 주 단위로 묶은 동향입니다.
> 이 시리즈만 목차 글이 없습니다. 흐름 콘텐츠라 시간순으로 읽는 편이 맞습니다.
> [카테고리 전체 →](/categories/%EC%97%85%EA%B3%84-%EC%9D%BD%EA%B8%B0/)

**논문과 책**

- [Han 2009 — From PID to ADRC](/posts/paper-han2009-pid-to-adrc/)
- [Herbst & Madoński — ADRC: From Principles to Practice](/posts/book-adrc-principles-to-practice/)
- [UniFP — 위치와 힘 통합 정책](/posts/paper-unifp-force-position/)

**주간 동향** — [2026-W31 규제는 증명 체계를 보고, 기술은 계층을 합친다](/posts/trend-2026-w31/)

**뉴스** — 하루치 로보틱스 브리핑입니다. 최신 글은 위 카테고리 페이지에서 바로 보입니다.

## ☕ 쉬어가기 — {{ n_etc }}편

> [**목차 →**](/posts/00-office-rpg-series/) 공부 글이 아닌 읽을거리입니다.

---

## 어디서부터 읽을까

| 이런 분 | 추천 |
| --- | --- |
| Stateflow 를 처음 본다 | [01. FSM이 필요한 이유](/posts/01-why-fsm/) |
| Chart 는 그릴 줄 안다 | [08~11 실행 순서](/posts/08-chart-execution/) |
| 돌아가는 건 봤고 맞는지 알고 싶다 | [21. 관찰과 증명](/posts/21-sf-coverage/) |
| 산업용 통신을 처음 본다 | [EtherCAT 지도](/posts/00-ethercat-overview/) |
| 제어 주기를 못 지켜서 왔다 | [RTOS 목차](/posts/00-rtos-series/) |
| 남이 만든 모델을 읽어야 한다 | [MATLAB과 Simulink 문법 목차](/posts/00-mp-series/) |
| 제어 이론 쪽이 궁금하다 | [ADRC 목차](/posts/00-adrc-series/) |
| 실제로 굴러가는 프로젝트가 보고 싶다 | [AMR 목차](/posts/00-amr-series/) |
| 코드 예제가 보고 싶다 | [stateflow-examples](https://github.com/genie4youu/stateflow-examples) |
