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

<!-- "쓰는 방식" 과 "용어" 절을 뺐다 (2026-08-03).
     기준 버전 표기, 미확인 표시, 유통기한 표시, Stateflow 용어를 영어로 쓰는 것, 조사를 발음 받침에
     맞추는 것은 전부 글을 쓸 때 스스로 정한 규칙이다. 규칙은 글에서 지키면 되는 것이고
     읽는 사람에게 따로 설명할 필요가 없다. 규칙 자체는 볼트의 _글쓰기_스타일가이드 에 있다. -->
