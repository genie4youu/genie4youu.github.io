---
title: 08. 온톨로지 짓는 법 — 역량 질문부터
date: 2026-11-12 13:08:00 +0900
description: Ontology Development 101 의 세 규칙과 7단계를 로봇 예제로 따라가고, 역량 질문으로 범위를 정하는 법과 상위 온톨로지 재사용, 흔한 실수를 정리한다.
categories: [온톨로지, 온톨로지 짓기]
tags: [온톨로지, 설계, 역량질문, 상위온톨로지, robotics]
mermaid: true
---

> **기준 출처:** [Ontology Development 101](https://protege.stanford.edu/publications/ontology_development/ontology101.pdf) · [TOVE 방법론 (EIL, Toronto)](https://eil.mie.utoronto.ca/theory/enterprise-modelling/entmethod) / 확인일 2026-11-12
> **시리즈:** [목차](/posts/00-ontology-series/) | 이전 → [07. SPARQL, SHACL, 속성 그래프](/posts/07-sparql-shacl-property-graph/) | 다음 → [09. 실습 — rdflib 로 로봇 온톨로지 짓기](/posts/09-rdflib-robot-ontology/)

04편부터 07편까지 적는 법, 묻는 법, 검사하는 법을 봤다. 이 편은 무엇을 어떤 순서로 짓는지를 Noy 와 McGuinness 의 Ontology Development 101(Stanford, 2001)을 따라 정리하되, 안내서의 와인 예제 대신 09편의 로봇 예제로 적는다.

## 1. 세 가지 기본 규칙

1. 한 분야를 모델링하는 올바른 방법은 하나가 아니다. 무엇이 나은지는 용도와 예상되는 확장에 달려 있다
2. 온톨로지 개발은 반복할 수밖에 없다. 거친 첫 판을 만들고 써 보면서 고친다
3. 개념은 그 분야의 사물과 관계에 가깝게 잡는다. 분야를 설명하는 문장의 명사가 사물, 동사가 관계가 되기 쉽다

## 2. 7단계

```mermaid
flowchart LR
    A["1 범위와 역량 질문"] --> B["2 재사용 검토"]
    B --> C["3 용어 나열"]
    C --> D["4~6 클래스, 속성, 제약"]
    D --> E["7 개체"]
    E -.-> A
```

| 단계 | 하는 일 | 로봇 예제 |
| --- | --- | --- |
| 1. 범위 | 분야, 용도, 답할 질문, 쓰고 관리할 사람을 정한다 | 역량 질문 목록 (3절) |
| 2. 재사용 | 남이 만든 온톨로지를 다듬어 쓸 수 있는지 본다 | IEEE 1872 CORA 의 `Robot` 이름을 빌린다. CORA 의 `robotPart` 관계는 `RobotPart` 클래스로 단순화한다 |
| 3. 용어 나열 | 겹침과 관계를 따지지 않고 말을 다 적는다 | 로봇, 축, 모터, 그리퍼, 센서, 구동하다, 정격 토크 |
| 4. 클래스와 계층 | 독립적으로 존재하는 것을 클래스로. 하향식, 상향식, 섞는 방식 | `RobotPart` 아래 `Actuator`, 그 아래 `Motor` |
| 5. 속성 (slot) | 남은 용어 대부분. 성질, 부분, 다른 개체와의 관계 | `hasPart`, `drives`, `ratedTorqueNm` |
| 6. 제약 (facet) | 값 타입, 허용 값, 기수 | `drives` 는 Actuator 에서 Axis 로, 토크는 decimal 하나 |
| 7. 개체 | 클래스를 고르고 개체를 만들어 값을 채운다 | `arm1`, `j1`~`j6`, `motor1`~`motor6` |

안내서는 4단계와 5단계가 얽혀 있어서 클래스와 속성을 오가며 짓는다고 적는다.

## 3. 역량 질문 — 답해야 할 질문에서 거꾸로 짓는다

역량 질문(competency question)은 Grüninger 와 Fox(1995)의 개념이다. 안내서는 그 온톨로지 위의 지식 베이스가 답할 수 있어야 하는 질문 목록으로 소개하고, 나중에 온톨로지가 충분한지 가려 보는 시험지로 쓰라고 한다. 처음 목록은 스케치라 빠짐없을 필요는 없다. 토론토 대학 EIL 의 TOVE 방법론은 시나리오에서 비형식 역량 질문을 뽑고, 용어를 1차 논리로 정의한 뒤 질문도 1차 논리로 다시 적는다.

RDF 와 OWL 로 짓는다면 다시 적은 질문이 SPARQL 질의다. 09편 실습의 역량 질문은 다음과 같다.

| 역량 질문 | SPARQL | 답에 필요한 것 |
| --- | --- | --- |
| 어떤 것이 센서인가 | `SELECT ?s WHERE { ?s a ex:Sensor . }` | `ForceTorqueSensor ⊑ Sensor` |
| arm1 의 부품은 몇 개인가 | `SELECT (COUNT(?p) AS ?n) WHERE { ex:arm1 ex:hasPart ?p . }` | `hasPart` 의 이행성 |
| fingerL 은 무엇인가 | `SELECT ?t WHERE { ex:fingerL a ?t . }` | `hasPart` 의 range |
| arm1 에 카메라가 있나 | `ASK { ex:arm1 ex:hasPart ?c . ?c a ex:Camera . }` | 「없다」를 답하려면 OWL 이 아니라 SHACL (06편, 07편) |

질문을 질의로 옮기면 필요한 공리와 도구가 드러난다. 역량 질문은 개체와 클래스의 경계도 정한다. 안내서는 답이 되는 가장 구체적인 개념을 개체 후보로 본다. 「arm1 의 부품은 몇 개인가」에 답하려면 `j1` 같은 낱낱의 축이 개체여야 한다.

## 4. 재사용 — 상위 온톨로지

안내서는 특정 온톨로지에 맞춘 다른 응용과 연동해야 한다면 재사용이 요구 사항이 된다고 적는다. 대상에는 같은 분야의 도메인 온톨로지 말고도 모든 분야에 공통인 것을 정해 두는 상위(top-level) 온톨로지가 있다.

| 상위 온톨로지 | 무엇인가 | 갈래와 형식 |
| --- | --- | --- |
| BFO (Basic Formal Ontology) | 정보 검색, 분석, 통합을 돕는 작은 상위 온톨로지. ISO/IEC 21838-2:2021 | continuant(정체성을 유지하며 계속 존재)와 occurrent(시간 속에 펼쳐짐). OWL 2, CLIF |
| DUL (DOLCE+DnS Ultralite) | DOLCE Lite-Plus 일부를 단순화한 OWL 온톨로지 | Descriptions and Situations(DnS) 포함 |
| SUMO (Suggested Upper Merged Ontology) | SUO-KIF 로 적은 상위 온톨로지 | WordNet 형식 파일도 배포 |

로봇 분야에서 SOMA 논문(Beßler 등)은 DUL 의 존재론적 약속을 이유로 DUL 을 기초로 삼고 물리 모델(사물, 행동)과 사회 모델(역할, 작업)을 나눈다. IEEE-RAS ORA 작업 그룹의 온톨로지는 SUMO 를 기초 층으로 쓰는데, 논문은 자기들이 기초 층에서 더 풍부한 공리화를 쓴다고 비교한다(10편, 12편).

## 5. 흔한 실수

안내서 4장의 지침 가운데 로봇 온톨로지에서 걸리기 쉬운 것이다.

| 실수 | 안내서의 판정 | 로봇 예 |
| --- | --- | --- |
| 계층의 순환 | A 가 B 의 하위이면서 상위면 둘은 동치다 | `Motor ⊑ Actuator` 와 `Actuator ⊑ Motor` |
| 형제의 일반성이 다르다 | 루트 바로 아래가 아니면 형제는 같은 일반성이어야 한다 | `Actuator` 와 특정 모터 모델이 형제 |
| 하위 클래스가 하나뿐이거나 열둘을 넘는다 | 하나면 모델링 문제이거나 덜 지은 것, 열둘을 넘으면 중간 층이 필요할 수 있다 | `Sensor` 아래 하위가 하나뿐인 09편 실습 |
| 새 클래스인가 속성값인가 | 하위 클래스는 보통 새 속성, 다른 제약, 다른 관계를 가진다 | 색만 다른 `RedMotor` 는 속성값이면 된다 |
| 개체의 클래스가 자주 바뀐다 | 개체가 속한 클래스는 자주 바뀌면 안 된다 (예: 차게 식힌 와인) | `RunningMotor` 대신 운전 상태를 속성값으로 둔다 |

추론기에게 `Motor` 라는 이름은 기호일 뿐이고, 06편의 추론은 전부 공리에서 나왔다. 공리 없이 이름만 잘 지으면 추론기가 끌어낼 것이 없다.

## 6. 정리

- 정답 모델은 하나가 아니고, 반드시 반복하며, 분야의 명사와 동사에 가깝게 잡는다
- 7단계는 범위, 재사용, 용어, 클래스와 계층, 속성, 제약, 개체 순이고 4단계와 5단계는 오가며 짓는다
- 역량 질문은 범위를 자르고 나중의 시험지가 된다. SPARQL 로 옮기면 필요한 공리와 도구가 보인다
- 상위 온톨로지는 기초 층의 약속이다. SOMA 는 DUL 위에, ORA 작업은 SUMO 위에 섰다
- 순환, 형제 수준, 하위 클래스 수, 클래스와 속성값, 자주 바뀌는 클래스를 점검한다

## 참고

- [N. F. Noy, D. L. McGuinness, Ontology Development 101, Stanford KSL-01-05, 2001](https://protege.stanford.edu/publications/ontology_development/ontology101.pdf)
- [EIL, Enterprise Modelling Methodology (Grüninger, Fox 1995 인용)](https://eil.mie.utoronto.ca/theory/enterprise-modelling/entmethod)
- [IEEE1872-owl: OWL specification of CORA (GitHub)](https://github.com/srfiorini/IEEE1872-owl)
- [Basic Formal Ontology (BFO)](https://bfo-ontology.github.io/) · [BFO-2020 (GitHub)](https://github.com/bfo-ontology/BFO-2020)
- [ISO/IEC 21838-2:2021 Top-level ontologies (TLO) — Part 2: BFO](https://webstore.iec.ch/en/publication/72703)
- DOLCE+DnS Ultralite (DUL.owl) — `http://www.ontologydesignpatterns.org/ont/dul/DUL.owl` (이 사이트는 https 를 제공하지 않아 링크 없이 주소만 적는다)
- [SUMO (GitHub, ontologyportal)](https://github.com/ontologyportal/sumo)
- [D. Beßler et al., Foundations of the Socio-physical Model of Activities (SOMA) (arXiv:2011.11972)](https://arxiv.org/abs/2011.11972)
