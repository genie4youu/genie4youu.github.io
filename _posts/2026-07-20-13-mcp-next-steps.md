---
title: 13. 운영 시 검토할 것
description: 편의 설정보다 먼저 처리할 항목, Host 이식, 작업 디렉터리 범위 설계, 남은 검증 과제를 정리한다. MCP 시리즈 13편.
date: 2026-07-20 06:13:00 +0900
categories: [MCP, 실무 설정]
tags: [mcp, 운영, 보안, 승인, 텔레메트리, vscode]
mermaid: true
---

> **기준:** 확인일 2026-07-20
> **시리즈:** [목차](/posts/00-mcp-series/) · 이전 → [12. 트러블슈팅](/posts/12-mcp-troubleshooting/)

---

## 1. 연결 확인 이후의 상태

```
✅ Host ↔ MATLAB MCP 서버 ↔ MATLAB 연결
✅ Simulink 도구 7개 + MATLAB 도구 5개 노출
✅ 빈 Chart 생성·검증 완주
❌ 설정이 기본값에 가깝다   ← 여기부터가 운영 영역
```

**동작 확인과 운영 설정은 별개다.** 아래는 편의 기능보다 우선순위가 높은 항목들이다.

## 2. 우선 처리 — 텔레메트리

`--disable-telemetry`의 **기본값이 수집 ON**이다. 익명화된 사용 데이터가 전송된다.

```
--disable-telemetry=true
```
또는 환경변수 `MW_MCP_SERVER_DISABLE_TELEMETRY=true`

데이터 반출이 제한된 환경에서는 설치 직후 적용하는 것이 맞다. **기본값이 안전한 쪽이 아니므로 명시가 필요하다.**

## 3. 우선 처리 — 도구별 승인 범위

기본 설정에서는 모든 도구가 동일한 승인 정책을 따른다. [07편](/posts/07-matlab-mcp-server/)에서 확인한 대로 파괴적인 것은 `model_edit` 하나이고 `evaluate_matlab_code`는 임의 코드를 실행한다.

```toml
[mcp_servers.matlab]
default_tools_approval_mode = "auto"

[mcp_servers.matlab.tools.model_edit]
approval_mode = "prompt"

[mcp_servers.matlab.tools.evaluate_matlab_code]
approval_mode = "prompt"
```

### 🚨 값 이름이 직관과 반대다

| 값 | 실제 동작 |
| --- | --- |
| **`"prompt"`** | **확인을 요청한다** ← 게이트를 걸려면 이것 |
| `"approve"` | **자동 승인한다** |

`model_edit`에 `approve`를 지정하면 게이트를 거는 것이 아니라 **여는** 결과가 된다.

> ⚠️ **이 기능은 공식 문서에 없다.** 소스 확인으로만 동작이 파악되므로, 적용 후 실제로 확인 프롬프트가 뜨는지 검증해야 한다. 버전 업데이트 시 깨질 수 있다.

**목적은 승인 횟수를 줄이는 것이 아니라 승인을 기능하게 만드는 것이다.** 모든 호출에 확인을 요구하면 기계적으로 통과시키게 되고, 그러면 위험한 호출도 함께 통과한다.

## 4. 라이선스 제약

> "MCP servers ... **must not be shared by multiple users**."

**중앙 서버 하나를 여러 사용자가 공유하는 배치는 금지된다.** 1인 1설치가 전제다. 조직 단위 도입을 검토한다면 이 조항의 확인이 선행되어야 한다.

## 5. Host 이식

[02편](/posts/02-mcp-architecture/)에서 정리한 대로 **서버는 그대로 두고 Host만 교체할 수 있다.**

| 방식 | 추가 설치 | 비고 |
| --- | --- | --- |
| 에디터 통합 터미널에서 기존 CLI 실행 | 없음 | 현재 설정 그대로 사용 |
| 에디터 확장 사용 | 확장 | 별도 확인 필요 |
| **에디터의 AI 기능이 직접 MCP 연결** | 설정 파일 | `mcp.json` |

세 번째의 설정 형태다.

```json
{
  "servers": {
    "matlab": {
      "type": "stdio",
      "command": "<서버 실행 파일 경로>",
      "args": []
    }
  }
}
```

⚠️ **동시 사용은 제약이 있다.** 같은 공유 세션에 엔진 클라이언트 두 개를 동시에 연결할 수 없으므로, 여러 Host를 동시에 붙이는 구성은 실패할 가능성이 높다. **하나씩 사용하는 것을 전제로 설계한다.** → [12편](/posts/12-mcp-troubleshooting/)

## 6. 초기화 자동화의 판단

`startup.m`에 초기화를 넣으면 MATLAB 기동 시 자동 실행된다. 공식 문서도 권장한다.

**다만 항상 적용할 사항은 아니다.**

| | 자동화 | 수동 |
| --- | --- | --- |
| 세션 공유 상태 | **항상** | 필요할 때만 |
| 노출 표면 | 에이전트 미사용 작업 중에도 유지 | 작업 시에만 |
| 상태 인지 | 사라진다 | **유지된다** |

에이전트를 상시 사용하지 않는 환경이라면 수동 실행이 낫다. 상세는 [10편](/posts/10-matlab-session-sharing/).

## 7. 작업 디렉터리 범위 설계

에이전트에게 어떤 디렉터리를 노출할지는 **연결 설정과 별개의 설계 문제다.**

개인 노트나 문서 저장소를 작업 대상으로 삼는 경우, 그 안에 공개해서는 안 되는 내용이 섞여 있다면 **디렉터리 전체가 모델에 전달될 수 있다.** Host가 클라우드 모델을 사용한다면 외부 전송 경로가 된다.

[04편](/posts/04-mcp-primitives/)의 Roots가 떠오르지만, **Roots는 방어 수단이 아니다.**

> "Roots serve as a **coordination mechanism** between clients and servers, **not a security boundary**."
> "Actual security must be enforced at the **operating system level**, via file permissions and/or sandboxing."

**따라서 "이 폴더만 보라고 알려주기"는 방어가 아니다.**

| 방식 | 평가 |
| --- | --- |
| 전체 디렉터리를 주고 범위를 지시 | ❌ 지시는 강제되지 않는다 |
| **공개 가능한 것만 담은 별도 디렉터리를 준다** | ✅ 구조적 분리 |

번거롭지만 **범위를 지시로 좁히는 것과 물리적으로 좁히는 것은 다르다.** 전자는 확률적이고 후자는 결정적이다.

## 8. 남은 검증 과제

**한 번에 하나씩 변경한다.**

| # | 시도 | 확인 대상 |
| --- | --- | --- |
| 1 | State 생성 | Stateflow API 사용의 정확성 |
| 2 | Transition 추가 | 방향과 Condition의 일치 |
| 3 | 기존 Chart 해석 | `model_read` 결과의 해석 정확성 |
| 4 | **결함 Chart에 `model_check`** | **미검출 범위** |

**4번이 실용적 가치를 결정한다.** 생성 기능은 설계를 위임하는 것이라 얻는 것이 제한적이다. 반면 검사 기능은 그대로 이득이지만, **무엇을 검출하지 못하는지 알아야** 통과를 안전으로 오인하지 않는다. [11편](/posts/11-mcp-first-run/)에서 확인했듯 빈 모델도 lint를 통과한다.

## 📌 정리

- **편의 설정보다 먼저:** 텔레메트리 차단, `model_edit`·`evaluate_matlab_code`만 확인 게이트
- **`"approve"`는 자동 통과다.** 확인을 받으려면 `"prompt"`
- 다중 사용자 공유는 라이선스상 금지
- **한 MATLAB 세션에 클라이언트는 하나** — 동시 사용을 전제하지 않는다
- 초기화 자동화는 **상시 공유 상태**라는 대가가 있다
- **범위는 지시가 아니라 구조로 좁힌다.** Roots는 보안 경계가 아니다
- 다음 과제는 **`model_check`의 미검출 범위 파악**

## 시리즈

[목차](/posts/00-mcp-series/) · 이전 → [12. 트러블슈팅](/posts/12-mcp-troubleshooting/)

## 참고

- [matlab-mcp-server](https://github.com/matlab/matlab-mcp-server)
- [simulink-agentic-toolkit](https://github.com/matlab/simulink-agentic-toolkit)
- [Client Concepts](https://modelcontextprotocol.io/docs/learn/client-concepts)
- [matlab.engine.shareEngine](https://www.mathworks.com/help/matlab/ref/matlab.engine.shareengine.html)
