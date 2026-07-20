---
publish: true
title: 16. 설정 적용 — 승인 모드의 실제 값과 trust_level의 오해
description: 승인 모드 네 값의 실제 동작과 우선순위, 텔레메트리 차단 표기, trust_level이 정하지 않는 것을 소스와 공식 문서로 확인한다. MCP 시리즈 16편.
date: 2026-07-20 06:18:00 +0900
categories: [MCP, 실무 설정]
tags: [mcp, 설정, 승인, 텔레메트리, 보안, toml]
mermaid: true
sources:
  - https://github.com/matlab/matlab-mcp-core-server
  - https://github.com/openai/codex
  - https://modelcontextprotocol.io/specification/
---

> **기준:** 확인일 2026-07-20
> **시리즈:** [목차](/posts/00-mcp-series/) · 이전 → [15. 세션 초기화 자동화](/posts/15-matlab-startup-automation/) · 다음 → [17. 작업공간 경계 설계](/posts/17-workspace-boundary/)

---

[13편](/posts/13-mcp-next-steps/)에서 "편의보다 먼저"라고 정리한 두 항목을 실제로 적용했다. **적용 과정에서 처음 판단이 틀렸다는 것이 드러났고, 그 방식이 이 글의 핵심이다.**

## 1. 🚨 값 이름의 어감으로 짐작하면 안 된다

처음에는 이렇게 쓰려 했다.

```toml
[mcp_servers.<서버>.tools.<파괴적_도구>]
approval_mode = "approve"     # "파괴적 도구만 매번 승인" 이라고 생각했다
```

**정반대였다.** 소스를 확인하니 값이 네 개이고 의미가 이렇다.

| 값 | 실제 동작 |
| --- | --- |
| `auto` | 도구의 MCP annotation을 보고 판단 (기본값) |
| `prompt` | **항상 확인을 요청한다** |
| `writes` | 읽기 전용 힌트가 없으면 확인을 요청한다 |
| `approve` | **확인하지 않는다 = 미리 승인해 둔 것** |

그대로 넣었다면 **모델을 수정하는 도구가 확인 없이 실행됐을 것이다.** 안전하게 만들려던 설정이 정확히 반대로 작동한다.

> **`approve`는 "승인을 요구한다"가 아니라 "승인이 끝났다"는 뜻이었다.**
> 필드 이름은 자연어처럼 읽히지만 자연어가 아니다. **동작을 확인하기 전까지는 이름을 근거로 쓰지 않는다.**

이걸 잡을 수 있었던 이유는 [13편](/posts/13-mcp-next-steps/)에 *"정확한 문법은 실측으로 확인할 것"* 이라고 **모르는 상태를 그대로 적어뒀기** 때문이다. 확실한 것처럼 적어뒀다면 그대로 복사해 넣었을 것이다.

### 우선순위

```
도구별 approval_mode  >  서버의 기본 승인 모드  >  auto
```

### ⚠️ 이 기능은 공식 문서에 없다

설정 문서를 검색해도 해당 필드 언급이 **없다.** 소스에만 존재하는, 사실상 문서화되지 않은 기능이다.

**따라서 버전을 올리면 예고 없이 바뀔 수 있다.** 검증은 설치된 버전과 같은 릴리스 태그에 고정해서 했다.

> 다행인 점 하나. 설정 구조체가 **알 수 없는 필드를 거부**하도록 되어 있어, 오타를 내면 조용히 무시되지 않고 **설정 파싱 에러**가 난다. *"설정했다고 믿었는데 사실 안 먹고 있었다"*는 최악의 상황은 일어나지 않는다.

## 2. 텔레메트리 — 표기에 값이 필요하다

[MathWorks 공식 README](https://github.com/matlab/matlab-mcp-core-server):

> *"The MATLAB MCP Server **may collect** fully anonymized information about your usage of the server and send it to MathWorks."*

**기본 활성이고 opt-out 방식**이다. 차단 표기는 이렇다.

```
--disable-telemetry=true
```

⚠️ **`=true`를 반드시 붙인다.** README의 인자 표는 *"set this argument to `true`"*라고 하고 예시도 값을 포함한다. **값 없는 단독 형태는 문서에 없다.**

환경변수 형태도 언급되지만 **허용 값이 명시되어 있지 않다.** 확실한 쪽인 CLI 인자를 쓰는 편이 낫다.

> 문서는 "fully anonymized"라고만 하고 **구체적 수집 항목을 밝히지 않는다.** 무엇이 나가는지 확인할 수 없다는 사실 자체가 차단의 근거가 된다. 비용은 인자 하나이고, 잃는 기능이 없다.

## 3. 적용 결과

```toml
[mcp_servers.<서버>]
command = "<서버 실행 파일>"
args = ["<기존 인자들>", "--disable-telemetry=true"]
default_tools_approval_mode = "auto"

[mcp_servers.<서버>.tools.<모델_수정_도구>]
approval_mode = "prompt"

[mcp_servers.<서버>.tools.<임의_코드_실행_도구>]
approval_mode = "prompt"
```

**확인 게이트를 건 도구는 둘뿐이다.**

| 도구 | 최악의 경우 | 정책 |
| --- | --- | --- |
| 조회·검사 계열 | 없음 | `auto` |
| 모델 수정 | 모델이 손상된다 | **`prompt`** |
| 임의 코드 실행 | **무엇이든 가능하다** | **`prompt`** |

전부 확인을 요구하지 않은 이유는 [13편](/posts/13-mcp-next-steps/)에 적은 그대로다. **모든 호출에 확인을 요구하면 기계적으로 통과시키게 되고, 그러면 위험한 호출도 함께 통과한다.** [06편](/posts/06-mcp-security/)의 "사람의 승인이 마지막 방어선"이 성립하려면 사람이 실제로 읽어야 하고, 읽으려면 물음이 드물어야 한다.

> TOML에서 테이블 헤더 이후의 키는 그 테이블에 귀속된다. **도구별 설정 블록은 해당 서버 블록 바로 뒤에 둔다.** 다른 테이블 아래에 붙이면 엉뚱한 곳으로 들어간다.

## 4. `trust_level`은 접근 권한이 아니다

설정 파일에는 작업했던 디렉터리가 신뢰 항목으로 누적된다.

```toml
[projects.'<경로>']
trust_level = "trusted"
```

이것을 "이 디렉터리를 볼 수 있게 하는 설정"으로 읽기 쉽다. **아니다.**

| | 정하는 것 | 정하지 않는 것 |
| --- | --- | --- |
| `trust_level` | **승인 절차** — 물어볼 것인가 | 접근 가능 여부 |
| 워크스페이스로 무엇을 여는가 | **실제 노출 범위** | — |

**항목을 삭제해도 그 디렉터리를 워크스페이스로 열면 에이전트는 여전히 읽는다.** 물어보고 읽을 뿐이다.

이건 [04편](/posts/04-mcp-primitives/)의 Roots가 보안 경계가 아닌 것과 같은 구조다. **설정에 적힌 범위와 실제 강제되는 범위는 다르다.** 이 주제는 [17편](/posts/17-workspace-boundary/)에서 이어간다.

## 5. 적용 후 확인

설정을 고쳤으면 파싱되는지 바로 확인한다. 오타는 여기서 드러난다.

```
<에이전트 CLI> mcp list
```

서버가 `enabled`로 보이고 인자에 추가한 값이 나타나면 된다. **서버는 다시 띄워야 반영된다.**

> 고치기 전에 백업을 뜬다. `config.toml.bak-<날짜>` 정도면 충분하다.

## 📌 정리

- 🚨 **`approve`는 자동 통과다.** 확인을 받으려면 `prompt` — 이름과 뜻이 반대다
- **모르는 것을 모른다고 적어둔 메모가 잘못된 설정을 막았다**
- 승인 모드는 **공식 문서에 없다.** 버전 업데이트 시 깨질 수 있다
- 텔레메트리는 **기본 수집 ON**, 차단은 `--disable-telemetry=true` (값 필수)
- **위험한 도구만 확인을 요구한다.** 전부 요구하면 사람이 읽지 않는다
- **`trust_level`은 승인 절차이지 접근 권한이 아니다**
- 고친 뒤에는 목록 명령으로 파싱을 확인하고, 서버를 다시 띄운다

## 시리즈

[목차](/posts/00-mcp-series/) · 이전 → [15. 세션 초기화 자동화](/posts/15-matlab-startup-automation/) · 다음 → [17. 작업공간 경계 설계](/posts/17-workspace-boundary/)

## 참고

- [matlab-mcp-core-server](https://github.com/matlab/matlab-mcp-core-server)
- [openai/codex](https://github.com/openai/codex)
- [MCP Specification](https://modelcontextprotocol.io/specification/)
