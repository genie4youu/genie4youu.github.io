---
title: 07. MATLAB MCP 서버와 Agentic Toolkit
description: MathWorks가 배포하는 구성요소, 노출되는 도구 12종, .satk 정책 게이트, 텔레메트리와 라이선스 조항을 정리한다. MCP 시리즈 7편.
date: 2026-07-20 06:07:00 +0900
categories: [AI 에이전트, MATLAB 연결]
tags: [mcp, matlab, simulink, stateflow, agentic-toolkit, 라이선스]
mermaid: true
---

> **기준:** MATLAB MCP Server `v0.11.2` / Simulink Agentic Toolkit `2026.07.15` / 확인일 2026-07-20
> **시리즈:** [목차](/posts/00-mcp-series/) · 이전 → [06. 보안 모델](/posts/06-mcp-security/) · 다음 → [08. 사전 준비](/posts/08-matlab-mcp-prerequisites/)

---

## 1. 구성요소

MathWorks가 배포하는 것은 GitHub의 repo 네 개다.

| repo | 역할 |
| --- | --- |
| [matlab-mcp-server](https://github.com/matlab/matlab-mcp-server) | **MCP 서버 본체** |
| [matlab-agentic-toolkit](https://github.com/matlab/matlab-agentic-toolkit) | MATLAB용 스킬·에이전트 설정 |
| [simulink-agentic-toolkit](https://github.com/matlab/simulink-agentic-toolkit) | **Simulink/Stateflow용 도구 확장** |
| [polyspace-agentic-toolkit](https://github.com/mathworks/polyspace-agentic-toolkit) | Polyspace용 |

> ⚠️ **File Exchange 배포가 아니다.** 배포 채널은 **GitHub Releases**다. 실제 다운로드는 `agenticToolkitInstaller.mltbx` 하나이고, MATLAB에서 `setupAgenticToolkit("install")`을 실행하면 서버 바이너리와 툴킷을 자동으로 내려받는다.

| 실측 버전 (2026-07-16) | 값 |
| --- | --- |
| Agentic Toolkit Setup | 1.1.0 |
| MATLAB MCP Server | **v0.11.2** (2026-07-10 릴리스) |
| MATLAB Agentic Toolkit | 2026.07.02 (repo README 기준 최신은 2026.07.16) |
| Simulink Agentic Toolkit | **2026.07.15** |

> 📌 `v0.11.0`에서 **"MATLAB MCP Core Server" → "MATLAB MCP Server"** 로 개명됐다. 옛 이름(`matlab-mcp-core-server`)이 일부 문서에 남아 있어 검색 시 주의가 필요하다.

## 2. 서버는 Go 단일 바이너리다

MATLAB MCP 서버는 **Go로 작성된 단일 실행 파일**이다.

```
go install github.com/matlab/matlab-mcp-server/cmd/matlab-mcp-server@latest
```

| 오해 | 실제 |
| --- | --- |
| MATLAB 연동에 Node.js가 필요하다 | **불필요하다.** 서버는 별도 런타임을 요구하지 않는다 |

Node.js가 필요한 경우는 **Host(AI CLI 도구) 설치 때문**이다. [02편](/posts/02-mcp-architecture/)의 층 구분이 여기서 실무적으로 작용한다.

```
Node.js / npm  →  Host (AI CLI)       ← 여기만 필요
Go 바이너리     →  matlab-mcp-server   ← 런타임 불필요
```

기본 설치 경로는 `~/.matlab/agentic-toolkits/bin/matlab-mcp-server` (Windows는 `.exe`)다.

## 3. CLI 플래그

| 플래그 | 의미 |
| --- | --- |
| `--matlab-root` | MATLAB 설치 경로 (`/bin` 제외) |
| **`--matlab-session-mode`** | 세션 연결 방식. 아래 상술 |
| `--matlab-display-mode` | `desktop` / `nodesktop` |
| `--initialize-matlab-on-startup` | 시작 시 MATLAB 즉시 기동 |
| `--initial-working-folder` | MATLAB 작업 디렉터리 |
| **`--extension-file`** | 커스텀 tools JSON. **Simulink 연동에 필수** |
| `--setup-matlab` | MATLAB MCP Server Toolbox 애드온 설치 |
| `--log-folder` / `--log-level` | 로그 (`debug`/`info`/`warn`/`error`) |
| **`--disable-telemetry`** | ⚠️ **기본값이 수집 ON** |

환경변수 대응 규칙은 `MW_MCP_SERVER_` 접두 + 대문자 + 하이픈을 언더스코어로 변환이다. `--matlab-root` → `MW_MCP_SERVER_MATLAB_ROOT`.

### `--matlab-session-mode`

| 값 | 동작 | 요구 |
| --- | --- | --- |
| `auto` (기본) | 기존 세션에 연결 시도, 없으면 새로 기동 | — |
| `new` | 항상 새 세션 기동 | — |
| **`existing`** | **이미 공유된 세션에만 연결. 새로 기동하지 않는다** | R2023a+ |

`existing`이 Simulink 작업의 전제가 되는 이유는 **화면에 표시된 MATLAB과 에이전트가 조작하는 MATLAB을 일치시키기 위함**이다. 새 세션을 기동하면 열려 있는 모델, 워크스페이스 변수, 작업 경로가 분리된다. → [10편](/posts/10-matlab-session-sharing/)

## 4. 노출되는 도구

### MATLAB MCP Server — 5개

| 도구 | 역할 |
| --- | --- |
| `detect_matlab_toolboxes` | 설치된 툴박스 확인 |
| `check_matlab_code` | 정적 분석 (read-only) |
| **`evaluate_matlab_code`** | ⚠️ 임의 MATLAB 코드 실행 |
| `run_matlab_file` | `.m` 파일 실행 |
| `run_matlab_test_file` | 테스트 파일 실행 |

MCP **resource** 2종도 함께 노출된다 — `matlab_coding_guidelines`(`guidelines://coding`), `plain_text_live_code_guidelines`(`guidelines://plain-text-live-code`, R2025a+). [04편](/posts/04-mcp-primitives/)에서 정리한 Resource의 실제 사용 사례다. 모델이 호출하는 것이 아니라 앱이 컨텍스트에 주입한다.

### Simulink Agentic Toolkit — 7개

`tools/tools.json`과 `tools/registry.json` 기준이며, 전부 `matlab_release: ">=R2023a"`로 명시돼 있다.

| 도구 | 역할 | 성격 |
| --- | --- | --- |
| `model_overview` | subsystem 계층·인터페이스·연결 개관. `detail`: `tree`/`interfaces`/`full` | readOnly |
| `model_read` | 블록 topology·연결·표현식. `depth`: `0`/`1`/`inf` | readOnly |
| `model_query_params` | 파라미터 임의 접근 (sample time, solver, StopTime, 신호 속성) | readOnly |
| `model_resolve_params` | 워크스페이스 변수를 수치로 해석 | readOnly |
| **`model_edit`** | **모델 생성·수정·블록 추가** | ⚠️ **파괴적.** registry에서 유일한 `readOnlyHint: false` |
| `model_check` | 구조 검증. 미연결 포트, dangling line, **State와 Subchart의 Edit-Time Checks** | readOnly |
| `model_test` | Gherkin 테스트·harness 생성 | **Simulink Test 라이선스 필요** |

> ⚠️ **도구 목록에 표시되는 것과 사용 가능한 것은 다르다.** `model_test`는 Simulink Test가 없어도 목록에 나타나며, 호출 시 실패한다.

### `model_read` 표현식 표기법

| 표기 | 의미 |
| --- | --- |
| `u1(blk_5.y1)` | 입력포트1 ← 소스 `blk_5`의 출력1 |
| `@Gain(Kp)` | 변수 참조. 수치는 `model_resolve_params` 필요 |
| `@Gain(5000)` | 확정 수치 |

⚠️ **Model Reference, Subsystem Reference, Library 블록은 인터페이스만 노출되고 내부는 보이지 않는다.** 참조 모델 비중이 큰 구조에서는 제약이 크다.

## 5. `.satk/` — 정책 게이트

Simulink Agentic Toolkit은 프로젝트 루트에 `.satk/`를 생성하고 에이전트 동작을 제약한다. [공식 문서](https://github.com/matlab/simulink-agentic-toolkit/blob/main/skills-catalog/model-based-design-core/setup-custom-libraries/references/library-setup.md) 기준 **3단 게이트** 구조다.

| Gate | 파일 | 동작 |
| --- | --- | --- |
| 1 | `.satk/reuse-libraries.json` | 재사용 커스텀 라이브러리 등록. **없으면 에이전트가 사용자에게 질의하고 응답 전까지 진행하지 않는다.** 라이브러리 부재는 `confirmedNone: true`로 기록 |
| 2 | `.satk/block-policy.json` | `policyMode`: `approved_blocks_only`(Knowledge Graph 등재 블록만) 또는 `prefer_customer_libraries`(커스텀 우선, 없으면 내장 폴백 — 기본값) |
| 3 | `.satk/library-kg/index.md` | 라이브러리 블록 Knowledge Index |

**off-limits 파라미터**와 **excluded 블록**을 지정할 수 있다.

> 💡 **안전이 중요한 환경에서 실질적 통제 지점은 여기다.** "AI의 모델 편집"을 전면 허용하거나 전면 금지하는 대신, **사용 가능한 블록과 변경 금지 파라미터를 파일로 고정**할 수 있다. 승인 프롬프트가 그때그때의 주의력에 의존하는 것과 달리 구조적이다.

## 6. ⚠️ 도입 전 확인 사항

### 텔레메트리 기본 활성화

`--disable-telemetry`의 **기본값이 수집하는 쪽**이다. 익명화된 사용 데이터가 MathWorks로 전송된다.

```
--disable-telemetry=true
```
또는 환경변수 `MW_MCP_SERVER_DISABLE_TELEMETRY=true`

데이터 반출이 제한된 환경이라면 설정 시점에 명시하는 편이 안전하다.

### 다중 사용자 공유 금지

README 원문이다.

> "MCP servers are only permitted to be used with MATLAB and Simulink in accordance with the MathWorks Software License Agreement, and **must not be shared by multiple users**."

**중앙 서버 하나를 여러 사용자가 공유하는 배치는 금지된다.** 1인 1설치가 전제이며, 그 이상은 MathWorks에 별도 문의가 필요하다.

## 7. 모델 편집에 대한 공식 경고

Simulink Agentic Toolkit README에 있다.

> "you should **thoroughly review and validate all tool calls before you run them**. Always keep a **human in the loop** for important actions and only proceed once you are confident the call will do exactly what you expect."

근거로 MCP 스펙의 User Interaction Model과 Security Considerations를 인용한다. → [06편](/posts/06-mcp-security/)

## 📌 정리

- repo 4개. 설치는 `.mltbx` 하나로 시작하고 나머지는 자동 다운로드
- **서버는 Go 바이너리라 Node.js가 불필요하다.** npm은 Host 설치용
- `--matlab-session-mode=existing`이 Simulink 작업의 전제
- Simulink 도구 7개 중 **`model_edit`만 파괴적**
- **`.satk/`로 사용 가능 블록과 변경 금지 파라미터를 파일로 고정**할 수 있다
- ⚠️ **텔레메트리 기본 ON, 다중 사용자 공유 금지**

## 시리즈

[목차](/posts/00-mcp-series/) · 이전 → [06](/posts/06-mcp-security/) · 다음 → [08. 설치 — 사전 준비](/posts/08-matlab-mcp-prerequisites/)

## 참고

- [matlab-mcp-server](https://github.com/matlab/matlab-mcp-server)
- [simulink-agentic-toolkit](https://github.com/matlab/simulink-agentic-toolkit)
- [커스텀 라이브러리 설정 문서](https://github.com/matlab/simulink-agentic-toolkit/blob/main/skills-catalog/model-based-design-core/setup-custom-libraries/references/library-setup.md)
- [MathWorks 설치 FAQ](https://www.mathworks.com/matlabcentral/answers/2183787-how-do-i-install-the-matlab-mcp-server-and-the-agentic-toolkits)
