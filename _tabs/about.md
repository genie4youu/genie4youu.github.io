---
# the default layout is 'page'
icon: fas fa-info-circle
order: 4
---

로봇 제어 소프트웨어를 개발합니다. 재활 로봇으로 석사를 했고, 센서와 모터 캘리브레이션, 통신, 연속 제어가 익숙한 영역입니다.

이 블로그는 **공부한 것을 다시 찾아보기 위해 정리하는 자료 정리함**입니다. 세 가지를 합니다.

- 공부한 내용을 주제별로 정리합니다.
- 공부하다 막힌 부분과 문서에서 확인되지 않는 것을 구분해 남깁니다.
- 배운 것을 예제와 프로젝트로 직접 만들어 확인하고, 그 과정을 남깁니다.

예제 코드는 [stateflow-examples](https://github.com/genie4youu/stateflow-examples) 저장소에 있습니다. `make` 한 번으로 빌드되고 테스트가 돌아갑니다.

## 시리즈

### [Stateflow](/posts/00-stateflow-series/) — 14편

Chart 만들기부터 실행 순서와 안전 패턴까지. 충전식 배터리를 관통 예제로 씁니다.

| 구간 | 내용 |
| --- | --- |
| [기초 01~07](/posts/01-why-fsm/) | State와 Transition, 계층, Junction, 병렬, Function |
| [**실행 순서 08~11**](/posts/08-chart-execution/) | **같은 Chart가 다르게 실행되는 이유.** `during`의 실행 조건, Backtracking, 병렬 실행 순서, Super Step |
| [패턴과 학습 12~13](/posts/12-debounce/) | debounce와 `duration`, User's Guide 탐색법 |

08~11편이 실무에서 가장 자주 문제가 되는 영역입니다. Chart를 그릴 줄 아는 것과 그 Chart가 언제 무엇을 실행하는지 아는 것은 다릅니다.

### [MCP와 MATLAB 연결](/posts/00-mcp-series/) — 15편

AI 에이전트를 MATLAB에 연결하는 프로토콜과 실무 설정입니다.

| 구간 | 내용 |
| --- | --- |
| [프로토콜 이론 01~06](/posts/01-what-is-mcp/) | 아키텍처, 트랜스포트, Primitives, JSON-RPC, 보안 모델 |
| [실무 설정 07~14](/posts/07-matlab-mcp-server/) | MATLAB MCP 서버, 설치, 세션 공유, 검증, 트러블슈팅 |

## 쓰는 방식

각 글은 **기준 버전과 확인일**을 머리말에 밝히고, 주장마다 **공개 출처**를 답니다.

문서에서 확인하지 못한 것은 **미확인**으로 표시합니다. 실측값과 문서화된 사양도 구분합니다. 도구가 빠르게 바뀌는 영역이라 **유통기한이 있는 내용은 따로 표시**합니다.

## 용어

Stateflow 편집기 화면에 영어로 표시되는 것은 영어 그대로 씁니다. State, Transition, Junction, Action, Event, Condition, Data, Chart, Truth Table 같은 것들입니다. 코드 키워드(`entry`, `during`, `exit`, `after()`)도 그대로 씁니다.
