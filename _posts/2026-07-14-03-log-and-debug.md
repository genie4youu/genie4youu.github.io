---
title: 로깅을 켜보니 충전량이 100%를 넘고 있었다
description: 돌아가는 Chart가 맞는 Chart는 아니다. Active State 로깅과 조건부 Breakpoint로 설계 결함을 찾아내는 과정.
date: 2026-07-14 10:20:00 +0900
categories: [Stateflow, 시작하기]
tags: [stateflow, 디버깅, breakpoint, SDI, 검증]
mermaid: true
---

[지난 글](/posts/02-first-chart/)에서 만든 Chart는 돌아간다. 스위치를 토글하면 `Charge` 와 `Discharge` 사이를 오가고, 애니메이션도 잘 나온다.

그런데 요구사항을 다시 보자. 충전량은 0%에서 100% 사이를 유지해야 한다. 이 조건을 지키고 있는가? 눈으로 봐서는 알 수 없다. State 테두리가 켜지는 건 보이지만 `charge` 값이 얼마인지는 안 보인다.

돌아간다고 해서 요구사항을 지키는 건 아니다. 로그로 찍어봐야 안다.

## 무엇을 로깅할 것인가

Stateflow에서 로깅할 수 있는 건 두 종류다.

| 로깅 대상 | 켜는 법 | 무엇을 보나 |
| --- | --- | --- |
| **Active State** | Simulation 탭 → Prepare → Log Active State | 어느 State가 언제 active였는지 |
| **Data** | Symbols 창 우클릭 → Property Inspector → Log signal data | 변수 값의 시간 변화 |

둘 다 켜야 한다. 값만 봐서는 원인을 모르고, State만 봐서는 결과를 모른다. 어느 모드에서 값이 어떻게 변했는지를 함께 봐야 한다.

로그는 Simulation Data Inspector(SDI)에서 그래프로 확인한다.

## 로그를 보니 넘어간다

SDI를 2행 레이아웃으로 놓고 `Battery:ActiveChild` 와 `charge` 를 나란히 본다. `Charge` State에 오래 머물러 두면 이렇게 나온다.

| 스텝 | active State | `charge` |
| --- | --- | --- |
| … | Charge | 92 |
| … | Charge | 96 |
| … | Charge | 100 |
| … | Charge | 104 |
| … | Charge | 108 |

멈추지 않는다. `during: charge = charge + 4` 는 매 스텝 4를 더할 뿐이고, 100에서 멈추라는 말이 어디에도 없다. 방전 쪽도 마찬가지여서 `charge` 가 0을 지나 음수로 내려간다.

> 이건 코드가 잘못 짜인 게 아니라 요구사항 하나가 Chart에 표현되지 않은 것이다. "0에서 100% 사이를 유지한다"는 조건이 그림 어디에도 없다.
{: .prompt-danger }

`if` 문으로 짰다면 `if (charge < 100)` 을 어딘가에 끼워 넣었을 것이다. Chart에서는 State 구조 자체로 풀어야 한다. 그게 다음 글의 주제다.

## Breakpoint로 문제 지점을 잡는다

값이 이상하다는 건 알았다. 이제 정확히 어느 순간에 그렇게 되는지 잡아야 한다.

State나 Transition을 우클릭해 Set Breakpoint를 걸면 빨간 원 배지가 붙는다. 기본값은 State에 진입하거나 머무를 때마다 멈추는 것인데, 이러면 너무 자주 멈춘다. 매 스텝 멈추면 문제 지점에 도달하기까지 Continue를 백 번쯤 눌러야 한다.

그래서 조건을 건다. Debug 탭의 Breakpoints List에서 각 Breakpoint에 조건식을 넣을 수 있다.

```text
Discharge State 의 Breakpoint
  조건:  charge < 0
```

이렇게 두면 충전량이 음수가 되는 바로 그 스텝에만 멈춘다.

> 언제든 멈춘다를 이럴 때만 멈춘다로 바꾸는 것. 조건을 정확히 쓸 수 있다는 건 문제를 정확히 정의했다는 뜻이기도 하다.
{: .prompt-tip }

멈춘 뒤에는 Symbols 창이나 Watch Window에서 현재 변수 값을 확인하고, Step Through로 한 스텝씩 진행하며 관찰한다. 끝나면 우클릭해서 Clear Breakpoint 한다.

## 이 과정이 알려주는 것

이 튜토리얼의 교훈은 SDI 쓰는 법이나 Breakpoint 거는 법이 아니다. 로깅해서 결함을 찾고, 구조를 바꿔서 고치는 흐름 자체다.

```mermaid
flowchart LR
    A[Chart 작성] --> B[실행]
    B --> C[로깅]
    C --> D[결함 발견]
    D --> E[구조 개선]
    E --> B
```

그리고 여기서 발견한 결함은 코드를 고쳐서 풀지 않는다. `charge` 에 `if` 를 하나 더 씌우는 대신, `Charge` State 안에 세부 모드를 만들어서 100%에서 멈추게 한다. 그게 계층 State다.

## 정리

돌아가는 Chart가 맞는 Chart는 아니다. 애니메이션은 State만 보여주지 값은 보여주지 않는다. Active State 로깅과 Data 로깅을 함께 켜서 SDI에서 겹쳐 보고, 조건부 Breakpoint로 문제 지점을 좁힌다. 그렇게 발견한 결함은 코드가 아니라 구조로 푼다.

## 다음

충전량이 100%를 넘는 문제를 `Charge` State 안에 세부 모드를 만들어 해결한다. 급속 충전에서 완속 충전으로, 그리고 완충으로.

---

> **1부 Stateflow 시작하기 (3/7)**
>
> 1. [배터리 충전 로직을 `if` 문으로 짜다가 포기한 이유](/posts/01-why-state-machine/)
> 2. [배터리로 만드는 첫 Chart](/posts/02-first-chart/)
> 3. **로깅을 켜보니 충전량이 100%를 넘고 있었다** (지금 글)
> 4. [계층 State로 버그를 고치다](/posts/04-hierarchy/)
> 5. [Junction으로 경로를 나누다](/posts/05-junction-flowchart/)
> 6. [병렬 State와 Event 브로드캐스트](/posts/06-parallel-and-events/)
> 7. [Function으로 로직을 재사용하다](/posts/07-reuse-functions/)
{: .prompt-tip }

### 참고

- [Log, Verify, and Debug Charts](https://www.mathworks.com/help/stateflow/gs/get-started-log-chart.html)
- [Set Breakpoints to Debug Charts](https://www.mathworks.com/help/stateflow/ug/set-breakpoints-to-debug-charts.html)
- [Simulation Data Inspector](https://www.mathworks.com/help/simulink/simulation-data-inspector.html)
