---
title: 03. 트랜스포트 — stdio와 Streamable HTTP
description: MCP의 두 트랜스포트를 비교하고, 로컬 stdio 서버에 인증이 없는 이유를 정리한다. MCP 시리즈 3편.
date: 2026-07-20 11:00:00 +0900
categories: [MCP, 프로토콜 이론]
tags: [mcp, stdio, http, sse, 트랜스포트, 인증]
mermaid: true
---

> **기준:** MCP 스펙 `2025-11-25` / 확인일 2026-07-20
> **시리즈:** [목차](/posts/00-mcp-series/) · 이전 → [02. 아키텍처](/posts/02-mcp-architecture/) · 다음 → [04. Primitives](/posts/04-mcp-primitives/)

---

## 1. 두 가지 표준 트랜스포트

> "The protocol currently defines two standard transport mechanisms: 1. **stdio**, 2. **Streamable HTTP**"
> "Clients **SHOULD** support stdio whenever possible."
> — [Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

메시지 형식(JSON-RPC)은 하나이고, 전달 수단만 둘로 나뉜다.

| | stdio | Streamable HTTP |
| --- | --- | --- |
| 용도 | 로컬 | 원격 |
| 서버 위치 | 클라이언트가 띄운 **자식 프로세스** | 별도 호스트 |
| 설정에 적는 것 | **실행 파일 경로** | URL |
| 인증 | 해당 없음 | OAuth 등 |
| 스펙 권장 | **우선 지원** | — |

## 2. stdio

> "The client **launches the MCP server as a subprocess**."

```mermaid
flowchart LR
    P["Host (부모 프로세스)"] -->|stdin: JSON-RPC 요청| S["MCP 서버 (자식)"]
    S -->|stdout: JSON-RPC 응답| P
    S -.->|stderr: 로그| L["로그"]
```

실무에서 중요한 규칙 세 가지다.

| 규칙 (스펙 원문) | 의미 |
| --- | --- |
| "Messages are delimited by newlines, and **MUST NOT** contain embedded newlines." | 메시지 하나 = 한 줄 |
| "The server **MUST NOT** write anything to its `stdout` that is not a valid MCP message." | ⚠️ **stdout에 로그 출력 금지.** 연결이 깨진다 |
| "The client **MAY** capture, forward, or ignore the server's `stderr` output and **SHOULD NOT** assume `stderr` output indicates error conditions." | 로그는 stderr로. stderr 출력이 곧 오류는 아니다 |

**stdout은 통신 채널이지 콘솔이 아니다.** stdio 서버 디버깅에서 가장 흔한 실패 원인이다.

## 3. Streamable HTTP

| 항목 | 내용 |
| --- | --- |
| 엔드포인트 | 단일 URL이 POST와 GET을 모두 처리 |
| `Accept` 헤더 | `application/json`과 `text/event-stream`을 **둘 다** 명시 |
| 응답 형태 | 단일 JSON 또는 SSE 스트림 (서버가 선택) |
| 재개 | SSE `id` + `Last-Event-ID` 헤더 |
| 버전 헤더 | `MCP-Protocol-Version` 필수. 없으면 서버는 `2025-03-26`으로 가정 |

스펙의 보안 요구 세 가지다.

> 1. "Servers **MUST** validate the `Origin` header on all incoming connections to prevent **DNS rebinding attacks**"
> 2. "When running locally, servers **SHOULD** bind only to **localhost (127.0.0.1)** rather than all network interfaces (0.0.0.0)"
> 3. "Servers **SHOULD** implement proper authentication for all connections"

> 📌 **HTTP+SSE는 deprecated다.** 최초 버전(`2024-11-05`)의 트랜스포트였고 `2025-03-26`에서 Streamable HTTP로 대체됐다. 오래된 자료에 이쪽 설명이 남아 있다.

## 4. 로컬 stdio 서버에 인증이 없는 이유

**스펙에 "stdio에는 인증이 없다"고 명시한 문장은 없다.** 대신 다음과 같이 기술한다.

> "MCP servers intending for their servers to be run locally **SHOULD** implement measures to prevent unauthorized usage from malicious processes:
> - **Use the `stdio` transport to limit access to just the MCP client**
> - Restrict access if using an HTTP transport, such as: Require an authorization token / Use unix domain sockets..."
> — [Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)

**stdio 자체가 접근 제어 수단으로 취급된다.** 인증의 대안이 아니라 인증과 나란히 놓인 선택지다.

논리는 다음과 같다.

```
stdio 서버 = 클라이언트가 spawn한 자식 프로세스
           → 파이프가 그 부모-자식 쌍에만 연결됨
           → 네트워크 표면 없음
           → "누가 접속했는가"를 물을 대상이 없음
```

**인증은 접속자가 여럿일 수 있는 채널에서만 의미가 있다.** stdio에서 신뢰의 근거는 토큰이 아니라 **프로세스를 실행할 수 있는 OS 사용자 권한**이다.

이는 동시에 경고이기도 하다. **stdio 서버는 사용자와 동일한 권한으로 실행된다.** → [06편](/posts/06-mcp-security/)

## 5. `Auth: Unsupported` 표시의 의미

일부 클라이언트는 등록된 MCP 서버 목록에서 인증 상태를 `Unsupported`로 표시한다. **로컬 stdio 서버에서는 정상 표시다.**

실제 출력 구조는 다음과 같다.

```json
{
  "name": "...",
  "enabled": true,
  "transport": { "type": "streamable_http", "url": "http://127.0.0.1:29467/" },
  "auth_status": "unsupported"
}
```
— [openai/codex issue #15609](https://github.com/openai/codex/issues/15609)

| 오해 | 실제 |
| --- | --- |
| `unsupported`는 설정 오류다 | 정상이다 |
| `unsupported` = stdio다 | **두 필드는 독립이다.** 위 예시는 `streamable_http`인데도 `unsupported`다 |
| 인증이 없다는 뜻이다 | **"대화형 OAuth 플로우를 광고하지 않는다"** 는 뜻이다 |

로컬 stdio 서버는 정의상 OAuth를 광고할 수 없으므로 항상 `unsupported`가 된다.

> ⚠️ **미확인:** 사람이 읽는 목록 출력에서 컬럼명이 정확히 `Auth`인지는 공식 문서에 출력 예시가 없어 확인되지 않았다. 확인된 것은 JSON 출력의 `auth_status` 필드다.

## 📌 정리

- 로컬은 **stdio**, 원격은 **Streamable HTTP**. 스펙은 stdio를 우선 권장
- stdio 서버는 클라이언트가 띄우는 **자식 프로세스**
- **stdout에 로그를 출력하면 연결이 깨진다.** 로그는 stderr
- 로컬 stdio에 인증이 없는 것은 정상. 네트워크 표면이 없어 인증 대상이 없다
- 신뢰의 근거는 **OS 사용자 권한**이다. 곧 서버가 사용자 권한으로 실행된다는 뜻이기도 하다

## 시리즈

[목차](/posts/00-mcp-series/) · 이전 → [02](/posts/02-mcp-architecture/) · 다음 → [04. Primitives](/posts/04-mcp-primitives/)

## 참고

- [Transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [Security Best Practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)
- [HTTP with SSE (2024-11-05, deprecated)](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports)
