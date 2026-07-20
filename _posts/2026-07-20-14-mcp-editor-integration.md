---
publish: true
title: 14. 에디터 통합 — 확인된 것과 새로 드러난 위험
description: 에디터 확장에서 MCP가 동작하는지 실측하고, 확장의 컨텍스트 자동 수집이 만드는 새로운 노출 경로를 정리한다. MCP 시리즈 14편.
date: 2026-07-20 06:15:00 +0900
categories: [MCP, 실무 설정]
tags: [mcp, vscode, 확장, 보안, 작업디렉터리, matlab]
mermaid: true
sources:
  - https://developers.openai.com/codex/ide
  - https://marketplace.visualstudio.com/items?itemName=openai.chatgpt
  - https://modelcontextprotocol.io/specification/
  - https://www.mathworks.com/help/matlab/ref/matlab.engine.shareengine.html
---

> **기준:** 확인일 2026-07-20
> **시리즈:** [목차](/posts/00-mcp-series/) · 이전 → [13. 운영 시 검토할 것](/posts/13-mcp-next-steps/)

---

[13편](/posts/13-mcp-next-steps/)에서 "별도 확인 필요"로 남긴 항목들을 실제로 확인했다. **하나는 예상대로 됐고, 하나는 문서로 결론이 나지 않아 직접 해봐야 했으며, 예상하지 못한 것이 하나 나왔다.**

## 1. 최소 형태 — 설치가 필요 없다

CLI 방식의 에이전트는 **에디터의 통합 터미널에서 그대로 실행된다.** 전역 설정과 인증을 그대로 쓰므로 추가 설정이 없다.

즉 **"에디터 통합"의 최소 형태는 아무것도 설치하지 않아도 이미 가능하다.** 별도 터미널 창을 여는 번거로움만 제거하는 것이 목적이라면 여기서 끝난다.

> 사소하지만 걸리는 점: 셸 프롬프트가 떠 있는 상태에서 자연어 프롬프트를 붙여넣으면 셸이 그것을 명령어로 해석한다. **에이전트가 기동해 화면이 바뀐 것을 확인한 뒤** 입력한다. 그리고 에이전트 입력창에서는 개행이 곧 전송인 경우가 많아, 여러 줄 프롬프트는 한 줄로 합치는 편이 안전하다.

## 2. 확장 — 문서가 엇갈린다

확장 방식은 문서만으로 판단이 서지 않았다.

| 출처 | Windows 지원 |
| --- | --- |
| [공식 IDE 문서](https://developers.openai.com/codex/ide) | **experimental**, WSL 권장 |
| [마켓플레이스 페이지](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt) | 지원 |

그리고 **MCP 서버 지원 여부가 확장 문서에 명시되어 있지 않다.** 우리 목적에서 가장 중요한 항목인데 문서로는 알 수 없었다.

### WSL 권장을 따르지 않은 이유

공식 권장은 WSL이지만 적용하지 않았다. **연결 대상인 MATLAB이 Windows 측에서 동작하기 때문이다.**

[10편](/posts/10-matlab-session-sharing/)에서 정리한 대로 서버는 **실행 중인 세션에 연결**하는 모드로 동작한다. 에이전트를 WSL 안에서 실행하면 그 세션에 도달하지 못한다. **권장을 따르면 오히려 연결이 깨진다.**

> 공식 권장은 일반적인 조건을 가정한다. **권장의 근거(샌드박스 안정성)와 내 제약(호스트 OS에 있는 대상 프로그램)이 충돌하면 제약이 우선한다.** 권장을 적용하기 전에 그 권장이 무엇을 위한 것인지 확인해야 한다.

### 실측 — 동작한다

문서로 결론이 나지 않아 설치해서 확인했다. 확장 패널에서 모델 조회 도구를 호출한 결과다.

```
status: ok
model: <모델명>
blocks: Chart 1개
```

터미널에서 실행했을 때와 동일했다. **확장도 같은 전역 설정과 서버 등록을 그대로 사용한다.** 별도의 MCP 설정이 필요하지 않았다.

## 3. ⚠️ 예상하지 못한 것 — 확장은 열린 파일을 함께 보낸다

확장의 소개 문구에 이렇게 적혀 있다.

> *"Bring **open files and selections** into the prompt"*

**편집기에 열려 있는 파일과 선택 영역이 질문과 함께 전송된다.** 이것이 확장의 편의가 나오는 지점이자, 터미널 방식에는 없는 동작이다.

이 사실이 [13편 §7](/posts/13-mcp-next-steps/)의 작업 디렉터리 범위 설계를 한 단계 더 밀어붙인다.

```
13편의 전제:  "어떤 디렉터리를 열어주느냐"가 노출 범위를 정한다
14편의 추가:  "그때 무엇이 편집기에 떠 있었느냐"도 노출 범위에 들어간다
```

즉 **"개념만 질문했으니 괜찮다"가 성립하지 않는다.** 질문의 내용과 무관하게 그 시점의 편집기 상태가 함께 간다.

> **실무 규칙 두 가지.**
> ① 민감한 파일을 띄운 채로 질문하지 않는다. 질문 전에 탭을 정리한다.
> ② **개념 질문은 어느 디렉터리에서 하든 답이 같다.** 민감한 디렉터리를 연 창에서 물을 이유가 없다.

②가 특히 값이 싸다. 창을 옮기는 비용은 클릭 한 번인데, "방금 질문에 무엇이 딸려갔나"를 걱정할 일이 사라진다.

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

항목을 삭제해도 그 디렉터리를 워크스페이스로 열면 에이전트는 여전히 읽는다. **물어보고 읽을 뿐이다.**

[13편 §7](/posts/13-mcp-next-steps/)의 결론과 같은 구조다. 스펙이 Roots에 대해 한 말이 여기에도 그대로 적용된다.

> "Roots serve as a **coordination mechanism** between clients and servers, **not a security boundary**."
> "Actual security must be enforced at the **operating system level**."

**규칙 파일에 "여기 밖은 보지 마라"라고 쓰는 것도 마찬가지다.** 그것은 협조 요청이지 강제가 아니다.

```
❌ 규칙 파일에 범위를 적는다      → 협조 요청
❌ 설정에서 신뢰 항목을 지운다     → 승인 절차만 바뀐다
✅ 그 디렉터리를 열지 않는다       → 실제 경계
```

에디터 확장은 **창 단위로 워크스페이스를 잡는다.** 그래서 실무에서는 **창을 나누는 것**이 경계가 된다.

## 5. 초기화 자동화 — 자동과 수동의 경계를 파일로 나눈다

[13편 §6](/posts/13-mcp-next-steps/)에서 정리한 판단을 실제로 구현했다. 핵심은 **두 가지 일을 한 파일에 넣지 않는 것**이다.

| 하는 일 | 위험 | 어디에 |
| --- | --- | --- |
| 도구 경로를 검색 경로에 추가 | 없음 | **자동** (`startup.m`) |
| 세션 공유를 켠다 | 외부 프로세스가 붙을 수 있게 된다 | **수동** (단축 함수) |

`startup.m`은 경로만 추가한다.

```matlab
satkPath = fullfile(getenv('USERPROFILE'), '.matlab', 'agentic-toolkits', 'simulink');

if isfolder(satkPath)
    addpath(satkPath);
else
    warning('startup:satkMissing', '도구 폴더를 찾지 못했습니다: %s', satkPath);
end

clear satkPath
```

세 가지를 의도적으로 넣었다.

- **경로를 하드코딩하지 않는다.** 환경변수로 조립하면 사용자명이 달라도 동작한다.
- **에러가 아니라 경고를 낸다.** `startup.m`에서 에러를 내면 기동이 지저분해진다.
- **변수를 정리한다.** `startup.m`의 변수는 기본 작업공간에 그대로 남는다.

초기화는 별도 함수로 두고, 실행할 때 **무엇이 일어나는지 알린다.**

```matlab
function satk()
    fprintf('초기화를 시작합니다. 이 세션은 외부에서 접근 가능해집니다.\n');
    satk_initialize;
end
```

세션이 공유 상태가 된다는 사실이 조용히 지나가면 안 된다. **13편에서 지적한 "상태 인지가 사라진다"는 문제를 한 줄로 막는다.**

> 도구 진입점이 P-code(`.p`)로 배포되는 경우 `exist(name, 'file')`이 `2`가 아니라 **`6`**을 돌려준다. 존재 확인 코드를 쓴다면 둘 다 허용해야 한다.

## 6. 사소하지만 매번 걸리는 것 — 모델은 먼저 로드되어야 한다

연결이 정상인데도 모델 조회가 실패하는 경우가 있다.

```
MODEL_NOT_FOUND
```

**연결 장애가 아니다.** 모델이 세션의 메모리에 로드되어 있지 않아서다. 파일을 수정하지 않는 로드 명령을 먼저 실행하면 해결된다.

```matlab
load_system('<모델 파일>')
```

한 번 로드하면 그 세션 동안 유지되고, **세션을 새로 띄우면 다시 필요하다.** [12편](/posts/12-mcp-troubleshooting/)의 분류를 적용하면 이것은 "도구는 보이는데 실행이 실패" — 즉 대상 프로그램 쪽 상태 문제다.

## 📌 정리

- **통합 터미널만으로 목적의 대부분이 해결된다.** 설치가 필요 없다
- 확장도 동작하고, **MCP도 그대로 동작한다** — 문서에 없어 실측이 필요했던 부분
- **공식 권장(WSL)을 따르지 않았다.** 대상 프로그램이 호스트 OS에 있으면 권장이 오히려 연결을 끊는다
- ⚠️ **확장은 열린 파일을 프롬프트에 함께 넣는다.** 질문 내용과 무관하다 — 탭 정리가 실무 규칙이 된다
- **`trust_level`은 승인 절차이지 접근 권한이 아니다.** 실제 경계는 워크스페이스 하나
- 초기화는 **경로(자동)와 세션 공유(수동)를 파일로 분리**한다. 공유 시작은 명시적으로 알린다
- 조회 실패가 곧 연결 실패는 아니다 — **모델 로드 상태를 먼저 확인**한다

## 시리즈

[목차](/posts/00-mcp-series/) · 이전 → [13. 운영 시 검토할 것](/posts/13-mcp-next-steps/)

## 참고

- [Codex IDE extension](https://developers.openai.com/codex/ide)
- [확장 마켓플레이스 페이지](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt)
- [MCP Specification](https://modelcontextprotocol.io/specification/)
- [matlab.engine.shareEngine](https://www.mathworks.com/help/matlab/ref/matlab.engine.shareengine.html)
