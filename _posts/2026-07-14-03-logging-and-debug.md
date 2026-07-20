---
title: 03. 로깅과 디버깅
description: Active State 로깅과 Data 로깅을 함께 켜서 SDI로 확인하고, 조건부 Breakpoint로 결함 지점을 좁힌다. Stateflow 시리즈 3편.
date: 2026-07-14 05:03:00 +0900
categories: [Stateflow, 기초]
tags: [stateflow, 디버깅, breakpoint, sdi, 검증]
mermaid: true
---

> **기준:** MathWorks 공개 문서 / 확인일 2026-07-14
> **시리즈:** [목차](/posts/00-stateflow-series/) · 이전 → [02. 첫 Chart](/posts/02-first-chart/) · 다음 → [04. 계층 State](/posts/04-hierarchy/)

---

## 1. 애니메이션이 보여주지 않는 것

[02편](/posts/02-first-chart/)의 Chart는 실행된다. 스위치를 토글하면 `Charge`와 `Discharge` 사이를 오가고 State 테두리가 강조된다.

**그러나 요구사항 준수 여부는 알 수 없다.**

| 확인 대상 | 애니메이션으로 보이는가 |
| --- | --- |
| 어느 State가 active인가 | ✅ 보인다 |
| **`charge`가 0~100% 범위인가** | ❌ **보이지 않는다** |

> **실행된다는 것과 요구사항을 지킨다는 것은 다른 명제다.** State 애니메이션은 모드만 보여주고 값은 보여주지 않는다.
{: .prompt-danger }

## 2. 로깅 대상 두 종류

| 대상 | 켜는 위치 | 확인 내용 |
| --- | --- | --- |
| **Active State** | Simulation 탭 → Prepare → Log Active State | 어느 State가 언제 active였는지 |
| **Data** | Symbols 창 우클릭 → Property Inspector → Log signal data | 변수 값의 시간 변화 |

**둘 다 켜야 한다.**

| 하나만 켜면 | 결과 |
| --- | --- |
| Data만 | 값은 알지만 어느 모드에서 그렇게 됐는지 모른다 |
| Active State만 | 모드는 알지만 결과를 모른다 |

로그는 Simulation Data Inspector(SDI)에서 확인한다. 2행 레이아웃으로 `Battery:ActiveChild`와 `charge`를 나란히 배치한다.

## 3. 확인된 결함

`Charge` State에 오래 머물면 다음과 같이 나타난다.

| 스텝 | active State | `charge` |
| --- | --- | --- |
| … | Charge | 92 |
| … | Charge | 96 |
| … | Charge | **100** |
| … | Charge | **104** |
| … | Charge | **108** |

`during: charge = charge + 4`는 매 스텝 4를 더할 뿐이며, 100에서 멈추는 조건이 없다. 방전 측도 동일하게 `charge`가 0을 지나 음수가 된다.

> **이는 코드 오류가 아니라 요구사항 하나가 Chart에 표현되지 않은 것이다.** "0~100% 유지"라는 조건이 그림 어디에도 없다.
{: .prompt-danger }

| 접근 | 방식 |
| --- | --- |
| `if` 문 방식 | `if (charge < 100)`을 어딘가에 삽입 |
| **Chart 방식** | **State 구조로 해결** → [04편](/posts/04-hierarchy/) |

## 4. 조건부 Breakpoint

State나 Transition을 우클릭해 **Set Breakpoint**를 걸면 빨간 원 배지가 붙는다.

| | 기본 Breakpoint | 조건부 Breakpoint |
| --- | --- | --- |
| 정지 시점 | State 진입·유지 시마다 | **조건 만족 시에만** |
| 문제 | 매 스텝 정지 → Continue를 반복해야 함 | — |

Debug 탭의 **Breakpoints List**에서 조건식을 지정한다.

```text
Discharge State 의 Breakpoint
  조건:  charge < 0
```

이 설정은 충전량이 음수가 되는 스텝에서만 정지한다.

> **"언제든 멈춘다"를 "이럴 때만 멈춘다"로 바꾸는 것.** 조건을 정확히 작성할 수 있다는 것은 문제를 정확히 정의했다는 뜻이기도 하다.
{: .prompt-tip }

정지 후에는 Symbols 창이나 Watch Window에서 변수 값을 확인하고, Step Through로 한 스텝씩 진행한다. 완료 후 우클릭하여 Clear Breakpoint 한다.

## 5. 검증 흐름

```mermaid
flowchart LR
    A[Chart 작성] --> B[실행]
    B --> C[로깅]
    C --> D[결함 발견]
    D --> E[구조 개선]
    E --> B
```

**발견된 결함은 코드가 아니라 구조로 해결한다.** `charge`에 `if`를 추가하는 대신 `Charge` State 안에 세부 모드를 만들어 100%에서 정지시킨다.

## 📌 정리

- **실행된다 ≠ 요구사항을 지킨다.** 애니메이션은 State만 보여준다
- **Active State 로깅과 Data 로깅을 함께 켠다.** 하나만으로는 원인과 결과를 연결하지 못한다
- 조건부 Breakpoint로 정지 지점을 좁힌다
- 발견된 결함은 **조건문이 아니라 State 구조로** 해결한다

## 시리즈

[목차](/posts/00-stateflow-series/) · 이전 → [02](/posts/02-first-chart/) · 다음 → [04. 계층 State](/posts/04-hierarchy/)

## 참고

- [Log, Verify, and Debug Charts](https://www.mathworks.com/help/stateflow/gs/get-started-log-chart.html)
- [Set Breakpoints to Debug Charts](https://www.mathworks.com/help/stateflow/ug/set-breakpoints-to-debug-charts.html)
- [Simulation Data Inspector](https://www.mathworks.com/help/simulink/simulation-data-inspector.html)
