---
title: 18. 에이전트 도구 스키마는 작은 온톨로지다
date: 2026-11-12 13:18:00 +0900
description: MCP 도구 정의를 온톨로지의 자로 재면 이름은 서버 안에서만 고유하고 뜻은 description 에만 있으며 도구 사이의 관계는 적을 곳이 없다.
categories: [온톨로지, 온톨로지와 AI]
tags: [온톨로지, mcp, 도구, 에이전트, 스키마]
mermaid: true
---

> **기준 출처:** [MCP Specification 2026-07-28: Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) · [Schema Reference](https://modelcontextprotocol.io/specification/2026-07-28/schema) · [Claude Docs: Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools) / 확인일 2026-11-12
> **시리즈:** [목차](/posts/00-ontology-series/) | 이전 → [17. Palantir 식 운영 온톨로지](/posts/17-palantir-ontology/)

Gruber 는 온톨로지를 쓰임으로 정의되는 공학의 도구로 보고, 검색 서비스 API 가 질의 낱말의 용어집만 제공해도 그것이 온톨로지 노릇을 한다고 적었다. 에이전트가 읽는 도구 정의가 그런 물건이다. 이 자로 재면 뜻은 description 에만 있고 도구 사이의 관계는 적을 자리가 없다. MCP 의 프리미티브 자체는 [04. Primitives](/posts/04-mcp-primitives/)에 정리했다.

## 1. 도구 정의 한 장

MCP 사양(2026-07-28)에서 도구는 모델이 통제한다. 클라이언트가 `tools/list` 로 목록을 받고, 모델이 도구를 고르고, `tools/call` 로 부른다. 사양은 사람이 호출을 거부할 수 있어야 한다고 권한다.

| 필드 | 사양의 설명 |
| --- | --- |
| `name` | 도구의 고유 식별자 (서버 하나 안에서) |
| `description` | 사람이 읽는 기능 설명. 스키마 문서는 모델에게 주는 「힌트」 같은 것이라고 적는다 |
| `inputSchema` | 파라미터를 정의하는 JSON Schema. 루트는 `type: object`, `$schema` 가 없으면 2020-12 |
| `outputSchema` | 구조화 결과의 JSON Schema (선택) |
| `annotations` | 행동을 서술하는 힌트. 신뢰하는 서버가 아니면 믿지 말라고 한다 |

Claude API 도 `name`, `description`, `input_schema` 가 뼈대이고, 문서는 자세한 description 이 도구 성능에 가장 크게 작용한다고 적는다.

## 2. 온톨로지의 자로 재기

```mermaid
flowchart LR
    A["용어집: description"] --> B["데이터 모델: inputSchema"] --> C["형식 논리: 없음"]
```

| 필드 | 온톨로지에 대면 | 기계가 확인할 수 있는 것 |
| --- | --- | --- |
| `name` | 이름. IRI 와 달리 서버 안에서만 고유해 여러 서버를 모으면 충돌할 수 있다 (사양은 접두사 같은 구분을 권한다) | 같은 문자열인가 |
| `description` | 사람이 읽는 주석 | 없음. 모델이 언어로 읽는다 |
| `inputSchema` | 데이터 모델. OWL 클래스보다 SHACL 형상에 가깝다 | 타입, 필수 여부, 허용값 |
| `outputSchema` | 결과의 모양 | 결과가 모양에 맞는가 |
| `annotations` | `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` | 없음. 힌트일 뿐 보장하지 않는다 |

`inputSchema` 는 검사 언어다. JSON Schema 의 `required` 는 적힌 이름이 모두 인스턴스에 있어야 유효하다고 정의한다. 없으면 거부다. [07편](/posts/07-sparql-shacl-property-graph/)의 SHACL `sh:minCount 1` 과 같은 쪽이고, [06편](/posts/06-reasoning-open-world/)의 열린 세계와는 반대쪽이다. 도구 호출에는 이쪽이 맞는 선택으로 판단된다.

뜻은 description 에만 있다. `name` 은 뜻을 보장하지 않고 `inputSchema` 는 모양만 보장한다. 형식 온톨로지가 공리에 두는 것을 도구 스키마는 산문에 둔다.

> `openWorldHint` 의 open world 는 06편의 열린 세계 가정과 다른 말이다. 사양의 뜻은 도구가 외부 개체와 상호작용할 수 있는가이고(웹 검색은 열림, 메모리 도구는 닫힘), OWL 의 열린 세계는 적히지 않은 사실을 거짓으로 보지 않는다는 추론의 가정이다.
{: .prompt-warning }

## 3. 온톨로지 설계 규칙이 그대로 맞는 곳

[08편](/posts/08-competency-questions/)에서 본 Ontology 101 의 규칙과 Claude 문서의 권고를 나란히 놓으면 짝이 맞는다. 짝은 이 글의 해석이다.

| 온톨로지 설계 (Ontology 101) | 도구 정의 (Claude 문서) |
| --- | --- |
| 역량 질문으로 범위를 정한다 | description 에 하는 일과 언제 쓰고 언제 쓰지 말지를 적는다 |
| 클래스는 낱말이 아니라 개념이다 | 이름이 불분명하면 돌려주지 않는 정보 같은 한계까지 적는다 |
| 구분이 다른 제약을 낳을 때만 새 클래스, 아니면 속성값 | 관련 동작은 `action` 파라미터를 둔 도구 하나로 묶는다 |

Gruber 는 온톨로지를 에이전트와 대화하는 인터페이스 명세로 보고, 그것을 지키는 쪽이 내부 표현까지 그 어휘로 할 필요는 없다고 적었다. 서버 구현이 바뀌어도 `name`, `inputSchema`, description 의 약속은 유지해야 한다는 말과 같다.

## 4. 빠진 것 — 도구 사이의 관계

Tool 인터페이스에는 다른 도구를 가리키는 필드가 없고 `tools/list` 는 목록이다. 사양의 Stateful Tools 절이 이 빈자리를 보여 준다. `create_basket` 이 돌려준 `basket_id` 를 `add_item` 이 인자로 받는 예에서, 사양은 프로토콜에 이 핸들 개념이 없고 다음 호출로 넘기는 것은 모델의 몫이며 보관 기간은 만드는 도구의 description 에 적으라고 한다.

| 온톨로지라면 적을 수 있는 것 | 도구 정의에서는 |
| --- | --- |
| A 는 B 의 특수한 경우 | 없음 |
| A 다음에 B (`create_basket` 다음 `add_item`) | 없음. description 문장과 모델의 몫 |
| A 의 출력이 B 의 입력 | `outputSchema` 와 `inputSchema` 는 있지만 둘을 잇는 선언은 없음 |
| 두 서버의 A 가 같은 도구 | 없음. 이름은 서버 안에서만 고유하다 |

[15편](/posts/15-state-machine-ontology/)의 말로 하면 State 는 있고 Transition 이 없는 FSM 이다. [17편](/posts/17-palantir-ontology/)처럼 도구가 온톨로지 위에 있으면 객체 사이의 관계는 Link Type 에 있다.

> 사양의 결함을 말하는 것이 아니다. 도구 사이의 관계는 MCP 의 범위 밖이고, 지금은 description 과 하네스 쪽 문서가 산문으로 채운다. 하네스는 [에이전틱 엔지니어링 목차](/posts/00-agentic-series/), MCP 서버를 붙이는 실무는 [03. MCP 적용법](/posts/03-apply-mcp/)에 있다.
{: .prompt-info }

## 5. 같은 자로 잰 표

| 물건 | 사전 | 논리와 추론 | 이름 | 쓰기 |
| --- | --- | --- | --- | --- |
| OWL 온톨로지 (05, 06편) | 클래스, 속성, 공리 | 있음 | IRI | 없음 |
| Part 16 FSM (15편) | StateType, TransitionType | 없음 | 주소 공간의 노드 | Method 가 Cause |
| GraphRAG 그래프 (16편) | 개체 타입 목록 | 없음 | 문자열 | 없음 |
| Palantir Ontology (17편) | Object Type, Link Type | 없음, Function 이 계산 | 기본 키 | Action Type |
| MCP 도구 정의 (18편) | `inputSchema` (모양만) | 없음 | 서버 안의 이름 | 도구 호출 자체 |

어느 것도 온톨로지라는 이름을 독점하지 않고 쓰임이 정의한다. 모델이 도구를 고르는 자리에서는 description 한 문단이 온톨로지다. 무엇을 보든 사전, 논리, 목적을 묻는다.

## 6. 정리

- `name` 은 서버 안의 이름, `inputSchema` 는 닫힌 세계 쪽 검사이고, 뜻은 description 에만 있다
- 역량 질문, 개념과 낱말의 구분, 새 클래스와 속성값의 구분이 도구 정의 권고와 짝이 맞는다
- 도구 사이의 관계(특수화, 선후, 입출력 연결, 동일성)는 적을 자리가 없고 description 과 모델이 메운다

## 참고

- [MCP Specification 2026-07-28: Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) · [Schema Reference](https://modelcontextprotocol.io/specification/2026-07-28/schema)
- [Claude Platform Docs: Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- [JSON Schema Validation 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation)
- [T. Gruber, Ontology, Encyclopedia of Database Systems, 2009](https://tomgruber.org/writing/definition-of-ontology.pdf)
- [N. Noy, D. McGuinness, Ontology Development 101, 2001](https://protege.stanford.edu/publications/ontology_development/ontology101.pdf)
- [W3C OWL 2 Primer](https://www.w3.org/TR/owl2-primer/)
