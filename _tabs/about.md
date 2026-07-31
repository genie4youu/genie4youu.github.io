---
# the default layout is 'page'
icon: fas fa-info-circle
order: 5
---

로봇 제어 소프트웨어를 개발합니다. 재활 로봇으로 석사를 했고, 센서와 모터 캘리브레이션, 통신, 연속 제어가 익숙한 영역입니다. 지금은 이산적인 모드 전환과 안전 설계 쪽으로 범위를 넓히는 중입니다.

이 블로그는 **공부한 것을 다시 찾아보기 위해 정리하는 자료 정리함**입니다. 세 가지를 합니다.

- 공부한 내용을 주제별로 정리합니다.
- 공부하다 막힌 부분과 문서에서 확인되지 않는 것을 구분해 남깁니다.
- 배운 것을 예제와 프로젝트로 직접 만들어 확인하고, 그 과정을 남깁니다.

시리즈 전체 지도는 [시리즈](/series/) 에 있습니다.

## 만든 것

| 저장소 | 무엇 |
| --- | --- |
| [amr_robot_planning](https://github.com/genie4youu/amr_robot_planning) | 실내 배송 AMR. MATLAB, Simulink, Stateflow. State 37개 / Transition 67개 supervisor 와 LiDAR, A*, DWA, 독립 safety gate |
| [stateflow-examples](https://github.com/genie4youu/stateflow-examples) | 순수 C 예제. `make` 한 번으로 빌드되고 테스트가 돕니다. push 마다 CI 가 실행됩니다 |

## 쓰는 방식

각 글은 **기준 버전과 확인일**을 머리말에 밝히고, 주장마다 **공개 출처**를 답니다.

문서에서 확인하지 못한 것은 **미확인**으로 표시합니다. 실측값과 문서화된 사양도 구분합니다. 도구가 빠르게 바뀌는 영역이라 **유통기한이 있는 내용은 따로 표시**합니다.

**실패한 경로도 남깁니다.** 결과만 적으면 왜 그 결론에 왔는지가 사라집니다. 잘못 든 길, 검사기가 통과시켜서 못 잡은 것, 요청한 값과 저장된 값이 달랐던 것 같은 기록이 나중에 더 쓸모 있었습니다.

## 용어

Stateflow 편집기 화면에 영어로 표시되는 것은 영어 그대로 씁니다. State, Transition, Junction, Action, Event, Condition, Data, Chart, Truth Table 같은 것들입니다. 코드 키워드(`entry`, `during`, `exit`, `after()`)도 그대로 씁니다.

조사는 한글 발음 받침을 따릅니다. Transition은/이/을, State는/가/를 로 씁니다.
