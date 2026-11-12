---
title: 01. 온톨로지란 무엇인가
date: 2026-11-12 13:01:00 +0900
description: Gruber 의 정의 「개념화의 명시적 명세」를 풀고, 용어집과 분류체계 가운데 어디부터 온톨로지라 부르는지 McGuinness 의 스펙트럼으로 가른다.
categories: [온톨로지, 온톨로지 개념]
tags: [온톨로지, 입문, 스키마, owl, robotics]
mermaid: true
---

> **기준 출처:** [Gruber 1993](https://tomgruber.org/writing/ontolingua-kaj-1993.pdf) · [Gruber, Ontology (2009)](https://tomgruber.org/writing/definition-of-ontology.pdf) · [McGuinness, Ontologies Come of Age](https://www.daml.org/2001/06/ontologies-come-of-age-mit-press-%28with-citation%29.doc) / 확인일 2026-11-12
> **시리즈:** [목차](/posts/00-ontology-series/) | 다음 → [02. 구성 요소](/posts/02-ontology-building-blocks/)

「온톨로지」라는 말은 지금 적어도 세 가지 뜻으로 쓰인다. W3C 의 OWL 로 적는 형식 논리, LLM 과 함께 쓰는 지식그래프, Palantir 가 말하는 조직의 운영 층이다. 이 시리즈는 셋을 같은 자로 잰 뒤 로봇과 산업 자동화 표준으로 넘어간다. 첫 편은 그 자를 만든다.

## 1. 철학의 말에서 공학의 물건으로

Gruber 가 Encyclopedia of Database Systems(2009)에 쓴 항목에 따르면 철학에서 온톨로지는 존재를 다루는 분야이고, 컴퓨터과학에서는 어떤 영역의 지식을 모델링하려고 목적을 갖고 설계한 인공물(artifact)이다. 1990년대 초 상호운용 표준 작업이 지식 시스템 스택에 온톨로지 층을 넣으면서 이 뜻이 자리 잡았다. 이 시리즈의 온톨로지는 만들어서 주고받는 물건이다.

## 2. Gruber 의 정의 — 개념화의 명시적 명세

가장 많이 인용되는 정의는 Gruber 의 1993년 논문 첫머리에 있다.

> *An ontology is an explicit specification of a conceptualization.*
> 온톨로지는 개념화(conceptualization)의 명시적 명세(specification)다.

| 낱말 | 논문의 설명 |
| --- | --- |
| 개념화 | 관심 영역에 있다고 전제하는 객체, 개념, 그 밖의 개체와 그 사이의 관계. 어떤 목적으로 세계를 추상하고 단순하게 본 것 |
| 명세 | 영역의 이름(클래스, 관계, 함수 등)마다 사람이 읽는 설명과, 해석과 쓰임을 제약하는 형식 공리를 붙인 것 |

Studer, Benjamins, Fensel(1998)은 Gruber 와 Borst 의 정의를 바탕으로 *formal, explicit specification of a shared conceptualisation* 이라고 다시 썼다. 논문의 풀이로 explicit 은 개념의 종류와 쓰임의 제약을 명시적으로 정의한다는 뜻이고, formal 은 기계가 읽을 수 있다는 뜻(자연어는 빠진다), shared 는 한 사람이 아니라 집단이 받아들인 지식이라는 뜻이다.

이 정의가 용어집부터 술어논리 이론까지 다 받아들일 만큼 넓다는 반론에 Gruber(2009)는 온톨로지를 쓰임으로 정의하자고 답한다. 질의 낱말의 용어집만 내주는 검색 API 도 온톨로지 노릇을 한다는 예를 들고, [18편](/posts/18-tool-schema-ontology/)의 도구 스키마 이야기가 여기서 출발한다.

## 3. 데이터베이스 스키마와는 층이 다르다

Gruber 2009 는 온톨로지를 계층형, 관계형 모델과 나란한 데이터 모델의 한 추상 수준으로 놓는다. 온톨로지 언어는 구현 전략에서 떨어져 있고 표현력은 1차 논리에 가깝다. 그래서 온톨로지는 의미(semantic) 수준, 스키마는 논리 또는 물리 수준이라고 부른다.

| | 데이터베이스 스키마 | 온톨로지 |
| --- | --- | --- |
| 수준 | 논리, 물리 | 의미 |
| 개체 식별 | 기본키. 모델링의 산물이고 영역 안의 무엇을 가리키지 않는다 | 키 없이 「이 개체는 이 클래스에 속한다」를 말한다 |
| 「A 는 B 의 하위 클래스」 | 외래키 조인으로 구현될 수 있다 | 선언 한 줄 |
| 기술 범위 | 한 상황을 빠짐없이 적는다 | 일부만 적는다. 공리에 맞는 세계가 여럿일 수 있다 |

마지막 줄은 Krötzsch 등의 DL 입문서에서 왔고 [06편](/posts/06-reasoning-open-world/)의 열린 세계 가정으로 이어진다.

## 4. 스펙트럼 — 어디서부터 온톨로지라 부르나

McGuinness 의 「Ontologies Come of Age」는 온톨로지라 불리는 것들을 명세가 얼마나 자세한가에 따라 일렬로 세운다. 각주에 따르면 AAAI '99 온톨로지 패널을 준비하던 대화에서 나온 그림이다.

```mermaid
flowchart LR
    A["용어 목록"] --> B["용어집"] --> C["시소러스"] --> D["비형식 계층"] --> E["엄격한 하위 클래스"] --> F["속성, 값 제약, 논리"]
```

| 자리 | 논문의 설명 |
| --- | --- |
| 통제 어휘 | 유한한 용어 목록. 카탈로그 |
| 용어집 | 용어와 자연어 뜻풀이. 해석이 모호해 기계 처리에는 부족하다 |
| 시소러스 | 동의어 같은 관계. 넓은 말과 좁은 말이 있어도 명시적 계층은 아니다 |
| 비형식 계층 | 하위 범주의 것이 상위 범주의 것이라는 규칙이 늘 지켜지지는 않는다. 초기 Yahoo 범주 |
| 엄격한 하위 클래스 | A 가 B 의 상위 클래스이면 B 의 개체는 반드시 A 의 개체다 |
| 그 오른쪽 | 형식 인스턴스, 클래스별 속성, 값 제약, 서로소, 역관계 같은 논리 제약 |

선은 엄격한 하위 클래스 자리에 그어진다. 논문은 유한하되 늘릴 수 있는 통제 어휘, 클래스와 관계의 모호하지 않은 해석, 엄격한 하위 클래스 관계 셋을 갖춰야 온톨로지라 부르고, 선 오른쪽은 모두 추론의 바탕이 된다고 한다.

폴더 트리가 비형식 계층의 예다. 「로봇」 폴더 아래 「그리퍼」 폴더를 둘 수 있지만 그리퍼는 로봇의 한 종류가 아니어서, 로봇에 대해 적은 규칙을 그리퍼에 물려줄 수 없다.

IEEE 로봇 온톨로지 워킹그룹의 Schlenoff 는 2019년 IEEE RAS 표준 전략 회의 발표에서 같은 생각을 두 식으로 줄였다.

> Vocabulary + Structure = Taxonomy
> Taxonomy + (Relationships and Constraints) = Ontology

같은 발표의 형식성 그림은 용어집에서 데이터 모델(UML, STEP)을 거쳐 OWL 과 기술 논리로 이어지고, IEEE 온톨로지 그룹(IEEE ORA)을 형식 쪽 끝에 둔다. 이 시리즈가 쓰는 자가 이 그림이고, OPC UA 와 AAS 의 자리는 [13편](/posts/13-opc-ua-information-model/)과 [14편](/posts/14-aas-digital-twin/)에서 잰다.

## 5. 온톨로지적 약속 — 대화의 언어를 정한다

Gruber 2009 는 온톨로지를 소프트웨어 에이전트의 입출력에 쓰는 어휘, 즉 인터페이스 명세로 본다. 에이전트가 그 용어를 내부 인코딩으로 쓸 의무는 없지만, 입출력에 내놓는 문장은 온톨로지의 정의와 제약에 논리적으로 맞아야 한다. 이것을 온톨로지에 약속(commit)한다고 한다. 제조사가 다른 로봇 제어기 둘이 내부에서 축 상태를 다른 구조체로 들고 있어도, 같은 온톨로지로 말하기로 했다면 「이 축은 저 모터가 구동한다」를 같은 뜻으로 주고받을 수 있다.

## 6. 정리

- 컴퓨터과학의 온톨로지는 영역 지식을 모델링하려고 설계한 인공물이다
- Gruber(1993): 개념화의 명시적 명세. Studer 등(1998)의 판에는 formal 과 shared 가 붙는다
- 온톨로지는 의미 수준, 데이터베이스 스키마는 논리 또는 물리 수준의 모델이다
- McGuinness 의 스펙트럼에서 선은 엄격한 하위 클래스 관계에 그어진다
- 온톨로지에 약속한다는 것은 입출력에서 쓰는 어휘의 뜻을 지키는 것이다

## 참고

- [T. Gruber, A Translation Approach to Portable Ontology Specifications, Knowledge Acquisition 5(2), 1993](https://tomgruber.org/writing/ontolingua-kaj-1993.pdf)
- [T. Gruber, Ontology, Encyclopedia of Database Systems, Springer, 2009](https://tomgruber.org/writing/definition-of-ontology.pdf)
- [R. Studer, V. R. Benjamins, D. Fensel, Knowledge Engineering: Principles and Methods, Data & Knowledge Engineering 25, 1998](https://publikationen.bibliothek.kit.edu/189497/3003)
- [D. L. McGuinness, Ontologies Come of Age](https://www.daml.org/2001/06/ontologies-come-of-age-mit-press-%28with-citation%29.doc)
- [C. Schlenoff, Structure of the IEEE Robotics and Automation Ontologies, IEEE RAS 표준 전략 회의, 2019](https://www.ieee-ras.org/images/Standards_strategy_Meeting_19_May_2019/1b-Schlenoff-CORA.pdf)
- [M. Krötzsch, F. Simančík, I. Horrocks, A Description Logic Primer, arXiv:1201.4089](https://arxiv.org/abs/1201.4089)
