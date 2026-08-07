---
title: 07. 상태를 가진 블록과 Data Store
date: 2026-08-07 06:11:00 +0900
description: Unit Delay는 출력 단계와 갱신 단계를 나눠 수행해서 대수 루프를 끊는다. Data Store는 실행 순서가 보장되지 않아 Read가 Write보다 먼저 돌 수 있다.
categories: [MATLAB과 Simulink, Simulink]
tags: [simulink, UnitDelay, Memory, DataStore, 상태, 대수루프, 실행순서]
mermaid: true
math: true
---

> **기준 출처:** [MathWorks Unit Delay](https://www.mathworks.com/help/simulink/slref/unitdelay.html) · Memory와 Delay와 Zero-Order Hold와 Rate Transition 레퍼런스 · Data Store Memory와 Read와 Write 레퍼런스 · Data Stores 문서 / 확인일 2026-08-07
> **시리즈:** [목차](/posts/00-mp-series/) | 이전 → [06. 데이터 타입과 포화](/posts/06-data-type-saturation/) | 다음 → [08. 계층구조와 조건부 실행](/posts/08-hierarchy-conditional-execution/)

## 1. 상태란 무엇인가

지금까지의 블록은 입력만으로 출력이 정해졌다. 같은 입력을 주면 언제나 같은 출력이 나오는 무상태 블록이다.

이 글의 블록들은 다르다. 과거에 무슨 일이 있었는지를 기억하고 같은 입력이라도 이전 이력에 따라 다른 출력을 낸다. 이 기억을 상태라고 한다. 상태가 있으면 세 가지 성질이 생긴다. 초기값이 동작에 영향을 주어 첫 스텝의 출력이 초기값으로 정해지고, 언제 상태를 초기로 되돌릴 것인가가 설계 항목이 되며, 언제 읽고 언제 쓰는가에 따라 값이 달라져 실행 순서가 의미를 갖는다.

## 2. Unit Delay

가장 기본적인 상태 블록이고 출력은 한 샘플 전의 입력이다.

$$y(k) = u(k-1)$$

블록 그림에 `1/z`로 표시된다.

| 파라미터 | 의미 |
| --- | --- |
| Initial condition | 첫 스텝의 출력값 |
| Sample time | 갱신 주기다. -1이면 상속한다 |

용도가 둘이다. 첫째는 이전 값이 필요할 때로 변화량 계산과 엣지 검출과 이산 필터 구현에 쓴다.

![Unit Delay 차분 구성](/assets/img/mp/simulink/07_UnitDelay_diff.png)
_입력이 두 갈래로 갈라져 한쪽은 Sum의 더하기로 바로 가고 다른 쪽은 Unit Delay를 거쳐 빼기로 간다. 결과는 한 스텝 사이의 변화량이다. 블록에 표시된 `1/z`가 한 스텝 지연을 뜻한다. 이 구조가 변화량 계산과 엣지 검출과 이산 미분의 기본형이다._

둘째는 대수 루프를 끊을 때다. 피드백 경로에 지연이 없으면 대수 루프가 생기는데 Unit Delay를 넣으면 한 스텝의 지연이 생겨 순환이 해소된다. [01편](/posts/01-reading-simulink-models/)에서 다뤘다.

Unit Delay는 한 스텝 안에서 두 가지 일을 나누어 한다.

```mermaid
flowchart LR
  O["출력 단계: 저장해 둔 값을 내보낸다"] --> O1["여기서 나오는 값은 지난 스텝의 입력이다"]
  O1 --> U["갱신 단계: 현재 입력을 저장한다"]
  U --> U1["다음 스텝을 위한 것이다"]
  U1 --> C["출력을 먼저 쓰고 나중에 갱신하므로 순환 의존이 끊긴다"]
```

## 3. Memory

Unit Delay와 비슷하게 이전 값을 내보내지만 기준이 다르다.

| | Unit Delay | Memory |
| --- | --- | --- |
| 기준 | 이전 샘플 시간 | 이전 주요 시간 스텝 |
| 샘플 시간 | 이산이고 지정하거나 상속한다 | 상속하고 연속 시간 문맥에서도 쓸 수 있다 |
| 주 용도 | 이산 제어 로직 | 연속과 가변 스텝 모델에서의 지연 |

고정 스텝 이산 모델에서는 둘의 동작이 사실상 같다. 그러나 가변 스텝 솔버에서는 결과가 달라질 수 있고 코드 생성 관점에서도 Unit Delay 쪽이 의도가 명확하다. 이산 제어 로직에서는 Unit Delay를 쓰는 것이 권장된다.

## 4. 그 밖의 상태 블록

| 블록 | 하는 일 | 비고 |
| --- | --- | --- |
| Delay | N 스텝 지연 | 지연 길이를 파라미터나 신호로 지정한다. 외부 리셋과 enable 포트를 지원한다 |
| Zero-Order Hold | 입력을 지정 주기로 샘플링해 다음 샘플까지 유지한다 | 빠른 신호를 느린 주기로 받을 때 쓴다 |
| Rate Transition | 서로 다른 샘플 시간 사이의 데이터 전달을 안전하게 처리한다 | 데이터 무결성과 결정론 옵션을 본다 |
| Discrete-Time Integrator | 이산 적분 | 포화와 리셋과 안티와인드업 옵션이 있다 |
| Discrete Transfer Fcn과 Discrete Filter | 이산 전달함수 | 필터 구현에 쓴다 |
| Detect Change 계열 | 변화 감지 | 내부에 지연을 포함한다. [03편](/posts/03-compare-logic-blocks/) |

Delay 블록은 Unit Delay의 상위 호환으로 볼 수 있다. 지연 길이를 1로 두면 Unit Delay와 같고 리셋 포트와 enable 포트를 추가로 쓸 수 있다.

## 5. Data Store

세 블록이 한 조다.

| 블록 | 역할 | C 대응 |
| --- | --- | --- |
| Data Store Memory | 저장소를 선언한다 | 전역 변수 선언 |
| Data Store Write | 값을 쓴다 | 대입 |
| Data Store Read | 값을 읽는다 | 참조 |

Data Store Memory 블록의 Data store name 파라미터가 저장소 이름이고 Read와 Write는 같은 이름으로 그 저장소를 지목한다. 선이 그려지지 않는다. 모델 전체에서 쓰려면 `Simulink.Signal` 객체를 데이터 딕셔너리나 기본 워크스페이스에 정의해 두는 방식도 쓴다.

![Data Store 세 블록](/assets/img/mp/simulink/07_DataStore_three.png)
_세 블록 모두 이름이 같고 셋 사이에 선이 하나도 없다. 맨 위가 저장소 선언이고 가운데가 쓰기이며 아래가 읽기다. 여기서는 쓴 값이 그대로 나왔지만 그것이 보장된 것은 아니다. 읽기가 쓰기보다 먼저 실행되었다면 초기값이 나왔을 것이고 다이어그램만으로는 어느 쪽인지 알 수 없다._

쓰는 이유는 값을 참조하는 곳이 여러 계층에 흩어져 있어 배선이 비현실적일 때, 그리고 상태 워드처럼 여러 서브시스템이 공유하는 값을 다룰 때다.

여기서 가장 중요한 것은 실행 순서가 보장되지 않는다는 점이다. 선으로 연결된 블록은 의존 관계가 실행 순서를 강제하지만 Data Store는 선이 없으므로 의존 관계에 잡히지 않는다. 같은 스텝 안에서 Read가 Write보다 먼저 실행될 수 있다.

```text
서브시스템 A : Data Store Write  (X 에 새 값을 쓴다)
서브시스템 B : Data Store Read   (X 를 읽는다)

A 가 먼저 실행되면 -> B 는 이번 스텝의 값을 읽는다
B 가 먼저 실행되면 -> B 는 지난 스텝의 값을 읽는다 (한 스텝 지연)
```

어느 쪽이 될지는 다이어그램만 봐서는 알 수 없다. 모델 구조와 최적화 설정에 따라 달라지고 모델을 수정하면 순서가 바뀔 수도 있다.

대응이 셋이다. 첫째로 진단 옵션을 켠다. Configuration Parameters의 Diagnostics에 read before write와 write after read와 write after write와 동시 실행 감지 항목이 있고, 기본값이 경고나 무시인 경우가 있으므로 오류로 올려 두는 것이 안전하다. 둘째로 한 스텝 지연을 설계로 인정한다. 순서에 의존하지 않도록 읽는 쪽이 항상 지난 스텝의 값을 본다고 전제하고 설계한다. 셋째로 가능하면 선으로 연결하고 Data Store는 배선이 정말 어려운 경우로 한정한다.

분석할 때는 저장소별로 Write 지점과 Read 지점을 표로 만들어야 한다.

```matlab
w = find_system(mdl, 'LookUnderMasks','all', 'FollowLinks','on', ...
                     'BlockType', 'DataStoreWrite');
names = get_param(w, 'DataStoreName');
```

Write 지점이 여러 곳인 저장소는 특히 주의해서 본다. 어느 것이 마지막에 실행되는지에 따라 최종 값이 달라지기 때문이다.

## 6. Goto와 From과의 비교

| | Goto와 From | Data Store |
| --- | --- | --- |
| 개념 | 이름 붙은 배선 | 전역 변수 |
| 실행 순서 의존성 | 유지된다 | 유지되지 않는다 |
| 쓰는 곳 | 하나 | 여러 곳이 가능하다 |
| 값의 시점 | 항상 같은 스텝이다 | 순서에 따라 다르다 |
| 상태 | 없다 | 있다. 스텝을 넘어 값이 남는다 |

Goto와 From은 배선의 편의이고 Data Store는 저장이다. 둘을 같은 것으로 취급하면 실행 순서 줄에서 문제가 생긴다.

## 정리

- 상태를 가진 블록은 초기값과 리셋과 실행 순서가 설계 항목이 된다.
- Unit Delay는 한 샘플 전의 입력을 내보내고 이전 값 제공과 대수 루프 해소에 쓴다.
- Unit Delay는 한 스텝 안에서 출력 단계와 갱신 단계를 나누어 수행한다.
- Memory는 이전 주요 시간 스텝 기준이고 이산 제어에서는 Unit Delay를 쓰는 편이 명확하다.
- Data Store는 전역 변수이고 실행 순서가 보장되지 않는다.
- Data Store 진단 옵션을 오류로 올려 둔다.
- Data Store 분석 시 저장소별 Write와 Read 지점을 표로 만들고 Write가 여러 곳인 저장소를 특히 확인한다.

## 확인 문제

1. Unit Delay가 대수 루프를 해소하는 원리를 출력 단계와 갱신 단계로 나누어 설명하라.
2. Data Store Read가 같은 스텝의 값을 읽을지 지난 스텝의 값을 읽을지 다이어그램으로 알 수 없는 이유를 쓰라.
3. Goto와 From과 Data Store 중 실행 순서 의존성이 유지되는 것은 무엇인가.
4. 하나의 Data Store에 Write가 세 곳 있을 때 확인해야 할 것은 무엇인가.

## 참고

- [MathWorks — Unit Delay](https://www.mathworks.com/help/simulink/slref/unitdelay.html)
- MathWorks Simulink — Data Store Memory, Read, Write 레퍼런스