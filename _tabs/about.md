---
# the default layout is 'page'
icon: fas fa-info-circle
order: 4
---

로봇 제어 소프트웨어를 개발합니다. 재활 로봇으로 석사를 했고, 센서와 모터 캘리브레이션, 통신, 연속 제어가 익숙한 영역입니다.

이 블로그는 **Stateflow를 공부하면서 정리하는 기록**입니다. 세 가지를 합니다.

- 공부한 내용을 정리합니다.
- 공부하다 막힌 부분을 정리합니다.
- 배운 것을 예제와 프로젝트로 직접 만들어 확인하고, 그 과정을 남깁니다.

예제 코드는 [stateflow-examples](https://github.com/genie4youu/stateflow-examples) 저장소에 있습니다. `make` 한 번으로 빌드되고 테스트가 돌아갑니다.

## 글 순서

Stateflow 글은 세 부분으로 이어집니다.

**1부. Stateflow 시작하기** — 충전식 배터리 예제 하나로 기본기를 다룹니다. 만들고, 로깅해서 결함을 찾고, 구조를 바꿔 고치는 과정이 반복됩니다.

1. [배터리 충전 로직을 `if` 문으로 짜다가 포기한 이유](/posts/01-why-state-machine/)
2. [배터리로 만드는 첫 Chart](/posts/02-first-chart/)
3. [로깅을 켜보니 충전량이 100%를 넘고 있었다](/posts/03-log-and-debug/)
4. [계층 State로 버그를 고치다](/posts/04-hierarchy/)
5. [Junction으로 경로를 나누다](/posts/05-junction-flowchart/)
6. [병렬 State와 Event 브로드캐스트](/posts/06-parallel-and-events/)
7. [Function으로 로직을 재사용하다](/posts/07-reuse-functions/)

**2부. Chart 실행 순서** — 그린 Chart가 실제로 어떻게 실행되는가. 직관과 어긋나는 부분을 다룹니다.

1. [병렬(AND) State는 "동시"에 실행되지 않는다](/posts/stateflow-parallel-and-is-not-simultaneous/)
2. [Condition Action은 Transition이 실패해도 이미 실행된 뒤다](/posts/stateflow-condition-action-vs-transition-action/)
3. [`during` 은 상시 실행되지 않는다](/posts/stateflow-during-and-chart-lifecycle/)
4. [Super Step: 한 스텝에 Transition이 연쇄한다](/posts/stateflow-super-step/)

**3부. 학습 자료**

1. [1,250쪽짜리 User's Guide에서 필요한 것만 찾기](/posts/navigating-stateflow-users-guide/)

## 용어

Stateflow 편집기 화면에 영어로 표시되는 것은 영어 그대로 씁니다. State, Transition, Junction, Action, Event, Condition, Data, Chart, Truth Table 같은 것들입니다. 코드 키워드(`entry`, `during`, `exit`, `after()`)도 그대로 씁니다.
