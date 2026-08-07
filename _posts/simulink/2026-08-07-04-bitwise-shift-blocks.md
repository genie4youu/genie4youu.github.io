---
title: 04. 비트와 시프트 블록
date: 2026-08-07 06:08:00 +0900
description: Bitwise Operator는 체크박스 하나로 입력 포트 수가 달라진다. 시프트는 포화하지 않고 절단하며, Bidirectional 부호 규약은 추측하지 않고 최소 모델로 실측한다.
categories: [MATLAB과 Simulink, Simulink]
tags: [simulink, BitwiseOperator, ShiftArithmetic, ExtractBits, 마스크, 필드추출]
mermaid: true
---

> **기준 출처:** [MathWorks Bitwise Operator](https://www.mathworks.com/help/simulink/slref/bitwiseoperator.html) · [Shift Arithmetic](https://www.mathworks.com/help/simulink/slref/shiftarithmetic.html) · Bit Set, Bit Clear, Extract Bits 레퍼런스 / 확인일 2026-08-07
> **시리즈:** [목차](/posts/00-mp-series/) | 이전 → [03. 비교와 논리 블록](/posts/03-compare-logic-blocks/) | 다음 → [05. 신호 라우팅과 버스](/posts/05-signal-routing-bus/)

개념 쪽인 마스크와 플래그와 필드 추출은 [MATLAB 04편](/posts/04-bitwise-operations/)에 정리돼 있다. 이 글은 Simulink 블록의 파라미터 구성과 주의점을 다룬다.

## 1. Bitwise Operator

이 블록은 사용 방식이 두 가지이고 Use bit mask 체크박스로 갈린다.

마스크를 쓰지 않으면 입력 포트가 두 개가 되고 두 신호를 비트 단위로 연산한다. MATLAB의 `bitand(u1, u2)`에 대응한다.

```text
Use bit mask : 해제
Number of input ports : 2
Operator : AND
```

마스크를 쓰면 입력 포트가 하나가 되고 파라미터로 지정한 상수 마스크와 연산한다. 플래그 판정과 필드 추출에서 쓰는 형태다.

```text
Use bit mask : 체크
Operator : AND
Bit Mask : bin2dec('0000000011110000')
```

마스크는 다음 표현 중 편한 것으로 쓸 수 있다.

| 표기 | 예 |
| --- | --- |
| 10진수 | `240` |
| `bin2dec` | `bin2dec('11110000')` |
| `hex2dec` | `hex2dec('F0')` |
| MATLAB 2진 리터럴 | `0b11110000` |

가독성 측면에서 `bin2dec`이나 `hex2dec`를 쓰는 편이 낫다. 10진수 240은 어느 비트를 가리키는지 즉시 알 수 없다.

![Bitwise Operator 두 방식](/assets/img/mp/simulink/04_Bitwise_two_modes.png)
_위는 Use bit mask를 해제한 경우로 입력 포트가 두 개이고 두 신호를 AND한다. 12 AND 10은 8이다. 아래는 체크한 경우로 입력 포트가 하나로 줄고 블록 아이콘에 마스크 값이 표시된다. 결과는 같은 8이다. 같은 이름의 블록인데 포트 수가 다르고 체크박스 하나가 사용 방식을 가른다._

| 설정 | 의미 |
| --- | --- |
| `AND` | 골라내기 |
| `OR` | 켜기 |
| `XOR` | 뒤집기 |
| `NOT` | 비트 반전, 입력 1개이고 마스크를 쓸 수 없다 |
| `NAND`와 `NOR` | 각각의 부정 |

제약이 셋이다. 입력은 정수나 고정소수점이어야 하고 `single`과 `double`은 지원되지 않으므로 실수 신호는 Data Type Conversion으로 정수로 바꾼 뒤 넣는다. 출력 타입은 입력 타입을 따른다. 그리고 부호 있는 정수에서는 최상위 비트가 부호로 해석되므로 플래그 용도로는 부호 없는 타입을 쓴다.

이름이 비슷한 Logical Operator와는 완전히 다른 블록이다.

| | Bitwise Operator | Logical Operator |
| --- | --- | --- |
| 대상 | 정수의 각 비트 | 값의 참과 거짓 |
| 입력 타입 | 정수와 고정소수점 | `boolean` |
| 출력 타입 | 입력과 같은 정수 | `boolean` |
| 마스크 파라미터 | 있다 | 없다 |

## 2. Shift Arithmetic

비트를 좌우로 이동시키는 블록이다. 이름의 Arithmetic은 부호 있는 정수의 오른쪽 시프트에서 부호 비트를 복제한다는 뜻이다.

이 블록은 비트 위치와 소수점 위치를 각각 이동시킬 수 있어서 파라미터가 두 벌이다.

| 파라미터 | 의미 |
| --- | --- |
| Bits to shift의 Direction | 비트 이동 방향으로 Left나 Right나 Bidirectional |
| Bits to shift의 Number of bits | 비트 이동 칸 수 |
| Binary points to shift | 소수점 이동 칸 수 |

정수 신호만 다룬다면 Binary points to shift는 0으로 두면 된다. 고정소수점 신호에서 스케일을 바꿀 때 의미가 생긴다.

Direction을 Bidirectional로 두면 입력 포트가 하나 더 생긴다. 두 번째 포트로 들어오는 신호 값이 이동 칸 수가 되고 그 부호가 방향을 결정한다.

이 모드에서 부호가 어느 방향에 대응하는지, 곧 양수가 왼쪽인지 오른쪽인지는 릴리스와 설정에 따라 다를 수 있어 여기서 단정하지 않는다. 미확인으로 둔다. 실제 모델을 해석할 때는 최소 모델을 만들어 실측한 뒤 판단한다. Constant로 입력값과 시프트량을 주고 Shift Arithmetic을 거쳐 Display로 받는 구성을 놓고, 시프트량을 +1과 -1로 바꿔 가며 출력을 확인하면 된다.

이 항목을 추측으로 넘기지 않는 이유가 있다. 부호 규약을 반대로 읽으면 값이 2의 2k 제곱 배만큼 어긋나고, 결과가 그럴듯한 크기로 나와도 틀린 해석일 수 있다.

시프트는 포화하지 않고 타입 폭 밖으로 나간 비트는 사라진다.

![시프트 절단과 곱셈 포화 비교](/assets/img/mp/simulink/04_shift_truncate_vs_mul_saturate.png)
_입력은 위아래 모두 `uint8(255)`로 같은데 결과는 254와 255로 다르다. 위는 Shift Arithmetic 왼쪽 1칸이고 8비트 밖으로 나간 최상위 1이 버려져 254가 된다. 아래는 Gain 2에 포화 설정이라 510이 범위를 넘어 최댓값 255에 고정된다. 블록 아이콘의 표기가 저장 정수를 왼쪽으로 미는 것과 실세계 값 기준의 의미를 각각 나타낸다._

곱셈 블록은 포화 설정에 따라 최댓값에 고정되지만 시프트는 절단된다. 2를 곱한다를 시프트로 대체할 때 동작이 달라질 수 있다.

Bitwise Operator와 조합하면 필드 추출의 표준 구조가 된다.

```mermaid
flowchart LR
  W["워드"] --> M["Bitwise Operator: AND 와 마스크"]
  M --> S["Shift Arithmetic: Right n 칸"]
  S --> V["필드 값"]
```

마스크로 원하는 자리만 남기고 시프트로 최하위까지 끌어내린다. 순서를 바꾸어도 되지만 마스크 다음에 시프트하는 쪽이 상위 비트 오염을 확실히 제거한다.

![필드 추출 구성](/assets/img/mp/simulink/04_field_extract.png)
_`uint16` 워드에서 5번에서 8번 비트를 꺼내는 구성이다. 첫 블록에 표시된 생략 기호는 값 표현식이 길어 아이콘에 다 들어가지 않을 때 Simulink가 쓰는 표기이고, 실제 값을 보려면 블록 파라미터를 열어야 한다. 마스크로 해당 비트만 남기고 오른쪽 4칸 시프트하면 값이 나온다. 두 블록이 한 줄로 이어지는 이 모양이 필드 추출의 표준 형태다._

## 3. Extract Bits

필드 추출을 한 블록으로 처리하는 라이브러리 블록이다. Bits to extract 파라미터로 다음 중 하나를 고른다.

| 설정 | 의미 |
| --- | --- |
| Upper half | 상위 절반 |
| Lower half | 하위 절반 |
| Range starting with most significant bit | 최상위부터 n개 |
| Range ending with least significant bit | 최하위까지 n개 |
| Range of bits | 시작과 끝 비트 번호를 지정한다 |

마스크와 시프트를 직접 조합하는 것보다 의도가 드러나지만 비트 번호 기준을 확인해야 한다. Extract Bits의 비트 번호는 0부터 시작하고, 이는 MATLAB `bitget`의 1-기반과 다르다.

## 4. Bit Set와 Bit Clear

지정한 번호의 비트 하나를 1이나 0으로 만든다.

| 블록 | 동작 |
| --- | --- |
| Bit Set | 지정 비트를 1로 만든다 |
| Bit Clear | 지정 비트를 0으로 만든다 |

Index of bit 파라미터가 대상 비트이고 0-기반이다. 여러 비트를 동시에 다루려면 Bitwise Operator와 마스크를 쓰는 편이 간결하다.

## 5. 비트 신호를 논리 신호로 바꾸기

비트 연산의 결과는 정수다. 이것을 Stateflow 입력이나 Logical Operator 입력으로 쓰려면 논리값으로 바꿔야 한다. Bitwise Operator로 플래그 마스크를 씌운 뒤 Relational Operator나 Compare To Zero로 0과 비교해 `boolean`을 만든다.

이 변환 단계를 생략하고 정수를 그대로 조건에 쓰면 두 문제가 생긴다. Logical Operator의 입력 타입 검사에서 걸리고, 통과하더라도 0이 아니면 참이라는 암묵적 규칙에 의존하게 되어 읽는 사람이 마스크 값과 판정 기준을 혼동한다. 0과의 비교를 명시하는 것이 원칙이다.

## 6. 자주 발생하는 문제

| 증상 | 원인 |
| --- | --- |
| 블록이 실수 입력을 거부한다 | 비트 블록은 정수와 고정소수점 전용이다. Data Type Conversion을 앞에 둔다 |
| 플래그 판정이 항상 참이다 | 마스크 결과를 0과 비교하지 않고 조건으로 썼다 |
| 상위 비트가 예상과 다르다 | 부호 있는 타입을 써서 최상위 비트가 부호로 해석됐다 |
| 시프트 결과가 커지지 않는다 | 타입 폭 밖으로 비트가 밀려나 버려졌다. 넓은 타입으로 변환 후 시프트한다 |
| 필드 값이 2의 거듭제곱 배만큼 어긋난다 | 시프트 방향이나 칸 수가 반대다. Bidirectional 부호 규약을 실측한다 |
| 마스크 아래 블록이 조회에 안 나온다 | `find_system`에 `LookUnderMasks`를 `all`로 준다 |

## 정리

- Bitwise Operator는 Use bit mask 체크 여부에 따라 입력 포트 수와 사용 방식이 달라진다.
- 마스크는 `bin2dec`나 `hex2dec`로 표기해 어느 비트인지 드러낸다.
- 비트 블록은 정수와 고정소수점 전용이고 플래그 용도로는 부호 없는 타입을 쓴다.
- Shift Arithmetic은 비트와 소수점을 각각 이동시킬 수 있다.
- Bidirectional 모드의 부호 규약은 추측하지 않고 최소 모델로 실측한다.
- 시프트는 포화하지 않고 절단한다. 곱셈과 다르다.
- 필드 추출은 마스크 다음에 시프트 순서이고 Extract Bits로 한 블록에 담을 수도 있다.
- 비트 연산 결과를 조건으로 쓰려면 0과 비교해 `boolean`을 만든다.

## 확인 문제

1. Bitwise Operator에서 입력 포트가 하나인 경우와 둘인 경우는 무엇으로 갈리는가.
2. `uint8` 신호 255를 Shift Arithmetic으로 왼쪽 1칸 이동시킨 결과와 Gain 2를 통과시킨 결과를 각각 쓰고 차이의 원인을 설명하라.
3. 16비트 워드의 5번에서 8번 비트를 꺼내는 블록 구성을 두 가지 방법으로 쓰라.
4. Shift Arithmetic의 Bidirectional 부호 규약을 확인하는 최소 모델 구성을 설명하라.

## 참고

- [MathWorks — Bitwise Operator](https://www.mathworks.com/help/simulink/slref/bitwiseoperator.html)
- [MathWorks — Shift Arithmetic](https://www.mathworks.com/help/simulink/slref/shiftarithmetic.html)