---
title: Stateflow의 병렬(AND) 상태는 "동시"에 실행되지 않는다
date: 2026-07-14 21:00:00 +0900
categories: [Stateflow]
tags: [stateflow, statechart, fsm, 실행순서, 임베디드]
---

Stateflow를 배우기 시작하면서 병렬(AND) 상태를 처음 봤을 때, 나는 이렇게 이해했다.

> "아, 이 둘이 **동시에** 도는구나."

점선 테두리로 그려지고, 문서도 *concurrent* 라고 부르니까 자연스러운 오해였다. 그런데 이건 **절반만 맞다.** 그리고 나머지 절반을 모르면, 버그가 **한 스텝씩 늦게** 나타난다. 재현도 잘 안 된다.

## active와 execution은 다른 축이다

이 둘을 분리해서 봐야 한다.

| 관점 | 병렬 상태는? |
| --- | --- |
| **active** (활성) | ✅ 동시에 활성이다 |
| **execution** (실행) | ❌ **순차 실행된다** |

MathWorks 문서가 명시적으로 말한다 — *"Although parallel (AND) states appear concurrent, they execute **sequentially** during simulation."*

즉 "동시에 켜져 있다"와 "동시에 돈다"는 다른 얘기다. 병렬 상태는 전자만 참이다.

## 순서는 누가 정하나 — 우선순위 번호

각 병렬 상태의 **우측 상단에 숫자**가 붙는다. 이게 실행 순서다.

- **낮은 번호가 먼저 실행된다**
- 기본값은 **생성 순서**대로 자동 부여된다
- 바꾸려면 우클릭 → **Execution Order**

여기서 중요한 건 **기본값이 "내가 상태를 그린 순서"** 라는 점이다. 설계 의도가 아니라 **마우스를 움직인 순서**가 실행 순서를 정한다. 이게 사고의 출발점이 된다.

## 그래서 뭐가 문제냐 — 공유 변수

병렬 상태 둘이 **같은 변수를 하나는 쓰고 하나는 읽는다**고 하자.

- `TempSensor` — 센서를 읽어 `temp` 를 **갱신**한다 (write)
- `FanControl` — `temp` 를 **읽어** 팬을 켜고 끈다 (read)

실행 순서에 따라 결과가 갈린다.

| 실행 순서 | 무슨 일이 일어나나 |
| --- | --- |
| `TempSensor`(1) → `FanControl`(2) | 팬이 **방금 읽은 온도**로 판단한다 ✅ |
| `FanControl`(1) → `TempSensor`(2) | 팬이 **지난 스텝의 온도**로 판단한다 ⚠️ **1 스텝 지연** |

### 생성되는 C 코드로 보면 당연하다

Stateflow가 뭘 만들어내는지 떠올리면 헷갈릴 일이 없다. 병렬 상태는 **그냥 순서대로 나열된 함수 호출**이 된다.

```c
/* order: TempSensor=1, FanControl=2 */
void chart_step(void) {
    temp = read_adc();          /* TempSensor  — 먼저 쓴다 */
    fan  = (temp > 30.0f);      /* FanControl  — 방금 쓴 값을 읽는다 ✅ */
}
```

순서를 뒤집으면:

```c
/* order: FanControl=1, TempSensor=2 */
void chart_step(void) {
    fan  = (temp > 30.0f);      /* FanControl  — 이번 스텝 값이 아직 없다.
                                                 지난 스텝의 temp 를 읽는다 ⚠️ */
    temp = read_adc();          /* TempSensor  — 쓰는 건 그 다음 */
}
```

**"병렬"이라는 그림에 속으면 안 된다.** 실행 모델은 순차다. 그림이 concurrent하게 생겼을 뿐이다.

이 지연은 특히 고약한데, **틀린 값이 아니라 늦은 값**이기 때문이다. 대부분의 스텝에서 온도는 천천히 변하니까 결과가 그럴듯해 보인다. 온도가 급격히 변하는 순간에만 한 스텝 틀린다. 그런 버그는 눈에 안 띈다.

## 한 걸음 더 — 둘 다 **쓰면** 어떻게 되나

방금은 한 쪽이 쓰고 한 쪽이 읽는 경우였다. 그럼 **둘 다 쓰는** 경우는?

문서가 명확하게 답한다 — *"각 상태는 자기가 실행될 때만 데이터를 읽고 쓴다. 그 결과, 어떤 상태는 **다른 상태가 이미 써 놓은 데이터를 덮어쓸 수 있다.**"*

즉 **나중에 실행되는 쪽이 이긴다.** 앞선 상태가 쓴 값은 그냥 사라진다.

그리고 여기가 읽기/쓰기 경우와 결정적으로 다르다.

- **한 쪽이 쓰고 한 쪽이 읽는다** → 순서로 **풀린다** (쓰는 쪽을 먼저 실행)
- **여러 쪽이 쓴다** → 순서로 **안 풀린다**

순서를 어떻게 정하든 **누군가의 write는 버려진다.** 순서는 *누가 이길지*를 정할 뿐, 충돌 자체를 없애지 못하기 때문이다.

그래서 [MAB 모델링 가이드라인 `jc_0722`](https://www.mathworks.com/help/simulink/mdl_gd/maab/jc_0722localdatadefinitioninparallelstates.html)는 순서를 조정하라고 하지 않는다. 아예 **데이터의 소유자를 하나로 두라**고 한다.

> *"한 병렬 상태 안에서만 쓰이는 로컬 변수는 그 상태 안에 정의되어야 한다."*
> — 변수의 유효 범위를 명시적으로 제한해서 **의도치 않은 참조와 변경을 막기 위해서다.**

설계 규칙으로 정리하면 이렇다.

| 상황 | 해법 |
| --- | --- |
| 하나가 쓰고 하나가 읽는다 | **실행 순서**를 명시한다 (쓰는 쪽 먼저) |
| 여럿이 쓴다 | **설계를 바꾼다.** 소유자를 하나로 좁힌다 |

두 번째를 순서 조정으로 때우려 하면, 겉보기엔 동작하지만 상태가 하나 추가되는 순간 무너진다.

## 차트가 깨어날 때 정확히 무슨 일이 일어나나

병렬 실행 순서를 이해했으면, 한 단계 더 들어가 **상태 하나가 실행될 때의 순서**도 알아두면 좋다. 차트는 깨어나면(wake up) 활성 상태마다 이 순서를 밟는다.

```text
① 나가는 outer transition 평가   ← 유효한 게 있으면 여기서 끝
② (없으면) during 액션 실행
③ inner transition 평가
④ 활성 자식 상태로 내려가서 ①부터 반복
```

문서의 표현을 빌리면 — *outer transition을 우선순위대로 시도하고, 성공하는 게 없으면 during 액션을 실행하고, 그 다음 inner transition을 시도한다.*

여기서 내가 착각했던 게 하나 더 있다.

> **`during` 은 백그라운드에서 상시 도는 게 아니다.**

유효한 outer transition이 **없을 때만** 그 스텝에 한 번 실행된다. 천이가 일어나면 **during은 실행조차 되지 않는다.** "상태에 머무는 동안 계속 도는 코드"라고 생각하면 틀린다.

## 정리 — 차트 검토할 때 볼 것

- [ ] 병렬 상태끼리 **같은 변수를 쓰고 읽는가?** → 쓰는 쪽이 먼저 실행되도록 order를 **명시적으로** 지정
- [ ] 애초에 병렬 상태끼리 변수를 공유하지 않는 게 최선이다
- [ ] 공유가 불가피하면, **실행 순서가 곧 설계 사양이다.** 문서에 남겨라. 나중에 누가 상태 하나를 추가하면 번호가 밀린다
- [ ] `during` 에 "항상 실행돼야 하는 것"을 넣지 않았는가?

## 다음

`{조건 동작}` 과 `/천이 동작` 의 차이, 그리고 **백트래킹**이 만드는 함정 — 조건 동작은 천이가 결국 실패해도 **이미 실행된 뒤**다. 이게 병렬 순서보다 더 까다롭다. 다음 글에서 다룬다.

---

### 참고

- [Execution Order for Parallel States — MathWorks](https://www.mathworks.com/help/stateflow/ug/execution-order-for-parallel-states.html)
- [Control Parallel State Execution Order — MathWorks](https://www.mathworks.com/help/stateflow/ug/control-state-execution-order.html)
- [Execution of a Stateflow Chart — MathWorks](https://www.mathworks.com/help/stateflow/ug/chart-during-actions.html)
- [Evaluate Transitions — MathWorks](https://www.mathworks.com/help/stateflow/ug/evaluate-transitions.html)
- [Chart Execution — MathWorks](https://www.mathworks.com/help/stateflow/chart-execution-semantics.html)
- [MAB Guideline jc_0722: Local data definition in parallel states](https://www.mathworks.com/help/simulink/mdl_gd/maab/jc_0722localdatadefinitioninparallelstates.html)
