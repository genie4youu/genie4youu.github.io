---
title: 09. 실습 — rdflib 로 로봇 온톨로지 짓기
date: 2026-11-12 13:09:00 +0900
description: rdflib 로 로봇 한 대의 TBox 와 ABox 를 짓고 owlrl 로 추론해 65 트리플이 305 개가 되는 과정, 열린 세계, SHACL 위반을 실측으로 확인한다.
categories: [온톨로지, 온톨로지 짓기]
tags: [온톨로지, python, owl, owlrl, sparql, shacl, 실측]
---

> **기준 출처:** [rdflib](https://rdflib.readthedocs.io/en/stable/) · [OWL-RL](https://owl-rl.readthedocs.io/) · [pySHACL](https://github.com/RDFLib/pySHACL) / 확인일 2026-11-12 · uv 0.11.28 · CPython 3.14.6 · rdflib 7.6.0 · owlrl 7.6.2 · pySHACL 0.40.2
> **시리즈:** [목차](/posts/00-ontology-series/) | 이전 → [08. 온톨로지 짓는 법](/posts/08-competency-questions/) | 다음 → [10. IEEE 1872 CORA](/posts/10-ieee-1872-cora/)

06편과 07편의 추론, 열린 세계, SHACL 검사를 작은 로봇 온톨로지로 돌린다. `robot_onto.py` 가 짓기, 추론, 질의를, `robot_shacl.py` 가 검사를 맡는다.

## 1. 실행

> 실습 스크립트의 개체 이름은 글에서 `motor1` 처럼 풀어 적었다. 출력의 다른 부분은 실행한 그대로다.
{: .prompt-info }

```bash
uv run --with rdflib --with owlrl   python robot_onto.py
uv run --with rdflib --with pyshacl python robot_shacl.py
```

`uv run --with` 는 필요한 패키지를 붙여 스크립트를 실행한다. 실측 환경(Windows)에서는 한글 출력을 위해 `PYTHONIOENCODING=utf-8` 을 설정했다. 추론된 그래프는 `robot_onto_inferred.ttl` 로 저장된다.

## 2. 코드 — TBox 와 ABox

설계는 08편의 7단계 표 그대로다. 역량 질문 넷에 답할 만큼만 클래스 여덟과 속성 셋을 적고, OWL 쪽 제약은 domain 과 range 뿐이며 개수와 필수 여부는 SHACL 로 검사한다. 아래 짓기 부분은 `subClassOf` 여섯 줄을 반복문으로 묶은 것 말고는 원본과 같고 트리플 수도 같다.

```python
from decimal import Decimal
from rdflib import Graph, Namespace, Literal, RDF, RDFS, OWL, XSD
import owlrl

EX = Namespace("http://example.org/robot#")
g = Graph()

# TBox: 클래스와 계층
for c in ["Robot", "RobotPart", "Sensor", "Actuator", "Axis",
          "Gripper", "ForceTorqueSensor", "Motor"]:
    g.add((EX[c], RDF.type, OWL.Class))
for sub, sup in [("Sensor", "RobotPart"), ("Actuator", "RobotPart"),
                 ("Axis", "RobotPart"), ("Gripper", "RobotPart"),
                 ("ForceTorqueSensor", "Sensor"), ("Motor", "Actuator")]:
    g.add((EX[sub], RDFS.subClassOf, EX[sup]))

# TBox: 속성
g.add((EX.hasPart, RDF.type, OWL.ObjectProperty))
g.add((EX.hasPart, RDF.type, OWL.TransitiveProperty))
g.add((EX.hasPart, RDFS.range, EX.RobotPart))
g.add((EX.drives, RDF.type, OWL.ObjectProperty))
g.add((EX.drives, RDFS.domain, EX.Actuator))
g.add((EX.drives, RDFS.range, EX.Axis))
g.add((EX.ratedTorqueNm, RDF.type, OWL.DatatypeProperty))
g.add((EX.ratedTorqueNm, RDFS.range, XSD.decimal))

# ABox: 로봇 한 대
g.add((EX.arm1, RDF.type, EX.Robot))
for i in range(1, 7):
    axis, motor = EX[f"j{i}"], EX[f"m{i}"]
    g.add((axis, RDF.type, EX.Axis))
    g.add((motor, RDF.type, EX.Motor))
    g.add((motor, EX.drives, axis))
    g.add((motor, EX.ratedTorqueNm,
           Literal(Decimal("1.2") * i, datatype=XSD.decimal)))
    g.add((EX.arm1, EX.hasPart, axis))
    g.add((EX.arm1, EX.hasPart, motor))
g.add((EX.gripper1, RDF.type, EX.Gripper))
g.add((EX.arm1, EX.hasPart, EX.gripper1))
g.add((EX.gripper1, EX.hasPart, EX.fingerL))   # fingerL 의 타입은 적지 않는다
g.add((EX.gripper1, EX.hasPart, EX.fingerR))
g.add((EX.ft1, RDF.type, EX.ForceTorqueSensor))
g.add((EX.arm1, EX.hasPart, EX.ft1))

owlrl.DeductiveClosure(owlrl.OWLRL_Semantics).expand(g)   # 추론
```

질의 넷은 08편 표의 SPARQL 을 `g.query()` 로 돌리고, `ASK` 결과는 `bool()` 로 받는다.

## 3. 추론 전과 후

출력은 다음과 같다(빈 줄과 안내문 생략).

```text
[작성한 트리플] 65 개
[추론 전]
  Sensor 인 것: []
  arm1 의 부품 수: [('14',)]
  fingerL 의 타입: []
  arm1 에 카메라가 있나 (ASK): False
[추론] 65 → 305 트리플 (+240)
[추론 후]
  Sensor 인 것: [('ft1',)]
  arm1 의 부품 수: [('16',)]
  fingerL 의 타입: [('RobotPart',), ('Thing',)]
  arm1 에 카메라가 있나 (ASK): False
```

| 질의 | 전 → 후 | 어느 공리에서 |
| --- | --- | --- |
| Sensor 인 것 | 없음 → `ft1` | `ForceTorqueSensor ⊑ Sensor` |
| arm1 의 부품 수 | 14 → 16 | `hasPart` 의 이행성으로 손가락 둘이 더해진다 |
| fingerL 의 타입 | 없음 → `RobotPart`, `Thing` | `hasPart` 의 range. 검사가 아니라 추론이다 |
| 카메라 | False → False | 근거가 되는 사실이 없다 |

늘어난 240개를 추론 전후 차집합으로 나누면 다음과 같다(실측).

| 묶음 | 개수 | 예 |
| --- | --- | --- |
| RDF, OWL, XSD 어휘와 리터럴에 관한 것 | 133 | `owl:Thing owl:sameAs owl:Thing`, `xsd:decimal a rdfs:Datatype` |
| 예제 IRI 의 자기 동일성 | 28 | `ex:motor1 owl:sameAs ex:motor1` |
| 예제 클래스와 속성의 닫힘 | 37 | `ex:Motor rdfs:subClassOf ex:RobotPart`, `ex:drives rdfs:domain ex:RobotPart` |
| 개체의 새 타입과 관계 | 42 | `ex:motor1 a ex:Actuator`, `ex:arm1 ex:hasPart ex:fingerL` |

역량 질문의 답은 마지막 묶음에서 바뀌었고, 저장량은 4.7배가 됐다.

## 4. 카메라 ASK — 열린 세계

추론 뒤에도 카메라 ASK 는 False 다. `arm1 hasPart cam1`, `cam1 a Camera` 를 더하면 True 가 되고 `ft1 a Sensor` 같은 앞 결론은 그대로다(실측). 「없다」를 온톨로지 안에서 말하려면 부정을 공리로 적는다. `arm1` 을 「Camera 인 부품을 가진 것」의 여집합에 넣는다.

```python
from rdflib import BNode
some, notsome = BNode(), BNode()
g.add((some, RDF.type, OWL.Restriction))
g.add((some, OWL.onProperty, EX.hasPart))
g.add((some, OWL.someValuesFrom, EX.Camera))
g.add((notsome, RDF.type, OWL.Class))
g.add((notsome, OWL.complementOf, some))
g.add((EX.arm1, RDF.type, notsome))
```

OWL 2 RL 문법은 개체 단언에 이런 여집합을 허용한다. 이 상태에서 카메라 두 줄이 들어오면 owlrl 은 `Violation of complementarity ...` 오류를 그래프에 싣는다(실측). 카메라가 들어오기 전까지 ASK 는 여전히 False 다. 「없다」는 질의의 답이 아니라 「들어오면 모순」으로만 나타난다.

## 5. SHACL 로 빠진 값을 잡는다

`robot_shacl.py` 는 모터 셋 중 `motor3` 의 정격 토크를 빼고 07편의 `MotorShape` 로 검사한다.

```python
conforms, report_graph, report_text = validate(
    data, shacl_graph=shapes, inference="none", abort_on_first=False)
```

보고서는 다음과 같다(일부 줄 생략).

```text
적합(conforms): False
Results (1):
Constraint Violation in MinCountConstraintComponent
	Focus Node: ex:motor3
	Result Path: ex:ratedTorqueNm
```

토크 값을 넣는 방식에 따라 결과가 달랐다(실측).

| 토크 값 | 위반 |
| --- | --- |
| `Literal(Decimal("1.2"), datatype=XSD.decimal)` | 1건 (`motor3` MinCount) |
| `Literal(1.2, datatype=XSD.decimal)` | 3건 (`motor1`, `motor2` Datatype 추가) |
| 위 float 판을 Turtle 로 저장했다가 다시 읽음 | 1건 |

rdflib 문서의 대응표에서 Python `float` 는 `xsd:double`, `Decimal` 은 `xsd:decimal` 이다. float 에 datatype 만 decimal 을 붙이면 직렬화된 모양은 `"1.2"^^xsd:decimal` 로 같지만 메모리 안의 값은 float 로 남고, pySHACL 은 이를 위반으로 봤다. 파일에서 다시 읽으면 값이 `Decimal` 이 되어 통과한다.

## 6. 변주 — 실측

| 바꾼 것 | 결과 | 확인하는 것 |
| --- | --- | --- |
| `TransitiveProperty` 선언 삭제 | 추론 뒤 부품 수 14 | 성질 하나가 규칙 하나 |
| 추론 없이 `ex:arm1 ex:hasPart+ ?p` 로 셈 | 16 | 경로 질의는 추론 없이 이행을 따라간다 |
| `ft1 drives j1` 추가 | `ft1 a Actuator`, 오류 없음 | domain 은 추론이다 |
| 위에 `Sensor owl:disjointWith Actuator` 추가 | `Disjoint classes ...` 오류 | 오류는 서로소 공리가 있어야 난다 |
| `Motor` 에 `drives` 최대 1, `motor1 drives j2` 추가 | `j1 owl:sameAs j2`, 오류 없음 | 고유 이름 가정 부재 |
| 위에 축 여섯 `owl:AllDifferent` 추가 | `'sameAs' and 'AllDifferent' ...` 오류 | 다름은 명시해야 한다 |

owlrl 은 모순이 있어도 예외를 던지지 않는다. 실측에서는 `http://www.daml.org/2002/03/agents/agent-ont#ErrorMessage` 타입 노드에 오류 문장이 붙어 그래프에 들어왔다. 추론 뒤 이 노드를 찾아봐야 한다.

## 7. 정리

- 65 트리플이 추론 뒤 305 가 됐다. 답을 바꾼 것은 subClassOf 전파, 이행성, range 추론이고 나머지는 자명한 닫힘이다
- 카메라 ASK 는 추론 뒤에도 False 이고, 사실을 보태면 True 가 되며 앞 결론은 그대로다
- 부정을 공리로 적으면 카메라가 들어올 때 모순이 보고될 뿐 질의 답이 「없다」로 바뀌지는 않는다
- 빠진 토크는 SHACL 위반 1건으로 잡힌다. 값은 `Decimal` 로 넣는다
- owlrl 의 모순 보고는 예외가 아니라 그래프 안의 `ErrorMessage` 노드다

## 참고

- [RDFLib 문서](https://rdflib.readthedocs.io/en/stable/) · [RDF terms](https://rdflib.readthedocs.io/en/stable/rdf_terms/) · [Introduction to SPARQL](https://rdflib.readthedocs.io/en/stable/intro_to_sparql/)
- [OWL-RL (owlrl) 문서](https://owl-rl.readthedocs.io/)
- [pySHACL](https://github.com/RDFLib/pySHACL)
- [uv, Running scripts](https://docs.astral.sh/uv/guides/scripts/)
- [W3C, OWL 2 Web Ontology Language Profiles (Second Edition)](https://www.w3.org/TR/owl2-profiles/)
- [W3C, Shapes Constraint Language (SHACL)](https://www.w3.org/TR/shacl/)
