---
title: 05. 서브에이전트 적용법 — 좁은 권한의 별도 작업자
date: 2026-11-12 11:05:00 +0900
description: 정의 파일의 위치와 필드, 도구를 빼서 읽기 전용 검토자를 만드는 법, Codex 에서는 그 방식이 왜 안 되는지 정리한다.
categories: [Claude Code 세팅, 서브에이전트]
tags: [ClaudeCode, 서브에이전트, 권한, 검증, 샌드박스, codex]
---

> **기준 출처:** [Claude Code Docs, Create custom subagents](https://code.claude.com/docs/en/sub-agents) · [Codex, Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) / 확인일 2026-11-12 · Claude Code 2.1.322 · Codex CLI 0.167.0
> **시리즈:** [목차](/posts/00-ccsetup-series/) | 이전 → [04. Hook 적용법](/posts/04-apply-hook/) | 다음 → [06. 슬래시 명령 적용법](/posts/06-apply-slash-command/)

격리가 왜 필요한지는 [03편](/posts/03-subagents/), 도구를 빼는 이유는 [04편](/posts/04-tools-not-requests/), 검증을 쓴 쪽과 나누는 이유는 [05편](/posts/05-independent-verification/)에서 다뤘다. 이 편은 파일을 놓고, 부르고, 끄는 순서다.

## 1. 어디에 놓나

| 범위 | 위치 | 우선순위 |
| --- | --- | --- |
| 조직 | managed settings | 1 |
| 이번 세션 | `claude --agents '<JSON>'` | 2 |
| 이 프로젝트 | `.claude/agents/*.md` | 3 |
| 내 모든 프로젝트 | `~/.claude/agents/*.md` | 4 |
| plugin | `agents/` | 5 |

- 이름이 같으면 숫자가 작은 쪽이 이긴다. 이름은 파일명이 아니라 frontmatter 의 `name` 이다.
- 파일을 추가하거나 고치면 몇 초 안에 감지되어 다음 위임부터 반영된다. 세션 시작 뒤 `agents` 폴더를 처음 만들었다면 재시작한다.

## 2. 파일 쓰기

`.claude/agents/doc-verifier.md`:

```markdown
---
name: doc-verifier
description: 방금 만든 문서나 코드가 실제로 맞는지 독립 검사한다. 완료 보고 전에 use proactively.
tools: Read, Grep, Glob
model: sonnet
maxTurns: 30
---

앞선 작업의 완료 보고를 근거로 삼지 않는다. 대상 파일을 직접 읽어 확인한다. 고치지 않는다.
결과는 검사한 항목 수, 통과, 실패와 근거(파일:행)로 낸다.
```

frontmatter 가 설정이고 본문이 시스템 프롬프트다. 필수는 `name`, `description` 둘이다.

| 필드 | 뜻 | 주의 |
| --- | --- | --- |
| `tools` | 허용 목록 | **생략하면 쓸 수 있는 도구를 전부 상속한다** |
| `disallowedTools` | 거부 목록 | 상속받거나 지정한 목록에서 뺀다 |
| `model` | `sonnet` `opus` `haiku` `fable`, 모델 ID, `inherit` | 생략하면 정해진 순서로 고른다 |
| `maxTurns` | 턴 상한 | 넘으면 부분 결과로 돌아온다 |
| `permissionMode` | 권한 모드 | 메인이 `bypassPermissions`, `acceptEdits`, auto 면 무시된다 |
| `hooks` | 이 에이전트 전용 hook | 프로젝트 에이전트는 폴더 신뢰 뒤에만 돈다 |
| `memory` | 세션을 넘는 기억 | Read, Write, Edit 가 자동으로 붙는다 |

plugin 에이전트는 `hooks`, `mcpServers`, `permissionMode` 를 무시한다.

## 3. 도구로 읽기 전용을 만든다

| 역할 | `tools` |
| --- | --- |
| 탐색자, 검증자 | `Read, Grep, Glob` |
| 작성자 | 위에 `Write, Edit` 추가 |
| 코드 수정자 | `Write, Edit` 에 `isolation: worktree` (임시 git worktree) |

🔴 **Bash 를 남기면 읽기 전용이 아니다.** 문서 예시의 code-reviewer 는 `git diff` 를 돌리려고 Bash 를 둔다. Edit, Write 는 빠졌지만 셸 명령으로도 파일을 만들고 고칠 수 있다. 실측 환경에서는 Bash 가 남은 검토자가 외부 프로그램을 새로 띄워 다른 작업과 충돌했고, 그 뒤 검토자에서 Bash 를 뺐다. 실행이 필요한 집계는 메인이 하고 결과만 넘긴다.

Bash 가 꼭 필요하면 문서 예시처럼 frontmatter 에 `PreToolUse` hook 을 걸어 명령을 검사한다. `tools` 는 동작의 종류만 정하므로 쓰기 경로를 좁힐 때도 이 방식을 쓴다.

## 4. 부르기와 끄기

| 하고 싶은 것 | 방법 |
| --- | --- |
| 자동 위임 | 과제가 `description` 과 맞으면 맡긴다. `use proactively` 가 부추긴다 |
| 지명 | 이름으로 시키거나 `@` 로 고른다 |
| 세션 전체 | `claude --agent doc-verifier`. 메인 스레드가 그 도구 제한과 모델을 쓴다 |
| 끄기 | 파일을 지우거나, 파일은 두고 `permissions.deny` 에 `"Agent(doc-verifier)"` |

과제 메시지 말고는 넘어가는 것이 없다. 대화 이력, 이미 부른 skill, 이미 읽은 파일 모두 안 보인다. CLAUDE.md 는 읽는다(내장 `Explore`, `Plan` 은 건너뛴다). `AskUserQuestion` 도 빠지므로 결정은 메인이 한다. 그래서 과제에 경로, 범위, 출력 형식을 적고, 검증자에게는 결론을 빼고 산출물만 준다.

`/agents` 는 v2.1.197 뒤로 안내만 낸다. 읽혔는지는 이름으로 지명해 보면 안다.

## 5. Codex 에서 같은 일을 할 때

`.codex/agents/reviewer.toml`:

```toml
name = "reviewer"
description = "변경의 정확성과 빠진 테스트를 검토한다."
developer_instructions = "파일을 고치지 않는다. 문제마다 파일:행과 근거를 적는다."
model_reasoning_effort = "medium"
features.shell_tool = false
```

- 위치는 `~/.codex/agents/`(개인), `.codex/agents/`(프로젝트). 필수는 `name`, `description`, `developer_instructions`.
- 같은 이름이면 커스텀이 내장 `explorer` 등을 이긴다.
- 현재 로컬 릴리스는 직접 요청하거나 프로젝트, skill 지시가 있을 때 띄운다.
- 실행 중인 스레드는 `/subagents` 로 보고 전환한다. 전부 끄려면 `[agents]` 의 `enabled = false`.

🔴 **에이전트 파일로는 샌드박스를 못 좁힌다.** `sandbox_mode`, `approval_policy`, `model_provider`, `mcp_servers` 는 에이전트 파일에 써도 부모 설정을 덮지 않는다. 서브에이전트는 부모 턴의 샌드박스와 승인 설정을 그대로 물려받는다. 「편집하지 마라」 지시도 별도의 읽기 전용 샌드박스를 만들지 않는다. 줄일 수 있는 것은 `features.shell_tool` 같은 기능 키다.

| | Claude Code | Codex |
| --- | --- | --- |
| 읽기 전용 수단 | `tools` 에서 쓰기 도구를 뺀다 | 지시. 샌드박스는 부모 것 |
| 누가 지키나 | 하네스. 그 도구가 없다 | 모델의 판단 |
| 구조로 막으려면 | 이미 막혀 있다 | 부모 세션을 `-s read-only` 로 띄운다 |

이 경우 부모도 읽기 전용이 되므로 검토만 하는 세션을 따로 띄운다.

## 참고

- [Claude Code Docs: Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Docs: Hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Docs: Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)
- [Codex: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex: CLI reference](https://learn.chatgpt.com/docs/cli/reference)
