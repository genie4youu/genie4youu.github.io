---
title: 08. Claude Code 와 Codex 같이 쓰기
date: 2026-11-12 11:08:00 +0900
description: 두 에이전트가 한 저장소를 쓸 때는 규칙 파일 하나, 파일마다 작성자 하나, 넘겨받은 쪽의 재검증부터 정한다.
categories: [Claude Code 세팅, 운영]
tags: [ClaudeCode, codex, 에이전트, 검증, 하네스]
---

> **기준 출처:** [Claude Code Docs, How Claude remembers your project](https://code.claude.com/docs/en/memory) · [Codex Docs, AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) · [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) / 확인일 2026-11-12 · Claude Code 2.1.322 · Codex CLI 0.167.0
> **시리즈:** [목차](/posts/00-ccsetup-series/) | 이전 → [07. 앱설정 적용법 — 확장 없이 동작을 바꾸는 키](/posts/07-apply-settings/) | 다음 → [09. 남의 하네스와 같은 과제로 겨뤄 보기](/posts/09-harness-bakeoff/)

같은 PC 에서 Claude Code 와 Codex 를 한 저장소에 번갈아 붙이면 다섯 가지를 정해야 한다. 규칙을 어디 두나, 누가 쓰나, 무엇으로 안 겹치나, 어떻게 넘기나, 무엇이 안 넘어가나. 역할은 모델 우열로 고정하지 않고 그 작업의 맥락과 실행 도구를 가진 쪽을 작성자로 둔다.

## 1. 규칙은 한 파일에

| 폴더에 있는 것 | Claude Code (기본값) | Codex |
| --- | --- | --- |
| `AGENTS.md` 만 | `AGENTS.md` | `AGENTS.md` |
| `AGENTS.md` + `@AGENTS.md` 를 담은 `CLAUDE.md` | `CLAUDE.md` 와 가져온 `AGENTS.md` | `AGENTS.md` |
| `AGENTS.md` + import 없는 `CLAUDE.md` | `CLAUDE.md` 만 | `AGENTS.md` 만. 서로 다른 규칙 |
| `CLAUDE.md` 만 | `CLAUDE.md` | 대체 파일명을 설정해야 읽는다 |

Claude Code 는 v2.1.277 부터 `AGENTS.md` 를 직접 읽지만, 작업 폴더나 그 위에 `CLAUDE.md`(또는 `.claude/CLAUDE.md`)나 `CLAUDE.local.md` 가 있으면 읽지 않는다. 그래서 `CLAUDE.md` 가 따로 필요한 저장소는 그 안에 `@AGENTS.md` 한 줄을 둔다. Windows 에서는 심볼릭 링크보다 import 를 쓰라고 문서가 권한다.

Codex 는 `~/.codex` 의 전역 파일을 먼저 읽고, 프로젝트 루트에서 작업 폴더까지 폴더마다 한 파일씩 이어 붙인다. 가까운 파일이 이기고, 루트를 못 찾으면 현재 폴더만 본다. `CLAUDE.md` 만 있는 저장소는 설정으로 맞춘다.

```toml
# ~/.codex/config.toml
project_doc_fallback_filenames = ["CLAUDE.md"]   # AGENTS.md 가 없을 때 시도할 이름
[projects.'<저장소 경로>']
trust_level = "trusted"
```

신뢰 줄도 필요하다. 0.150.0 릴리스 노트에 따르면 신뢰하지 않은 프로젝트는 프로젝트 수준 `AGENTS.md` 지침을 주지 않는다. 내 세팅에서 Codex 가 규칙을 하나도 못 받은 저장소가 이 경우였다.

확인은 Claude 는 `/memory`, Codex 는 `codex --ask-for-approval never "Summarize the current instructions."` 로 한다. Codex 는 지침을 실행할 때 한 번 모으므로 규칙을 고치면 새 세션을 연다.

> 지침 파일은 강제가 아니다. Claude Code 문서도 CLAUDE.md 를 컨텍스트로 다루고, 막으려면 `PreToolUse` hook 을 쓰라고 한다. 규칙에 「push 는 승인 뒤」라고 적고 명령 허용 규칙에 `git push` 를 열어 두면 실제로 걸리는 쪽은 허용 규칙이다.
{: .prompt-warning }

## 2. 나누는 단위는 파일

폴더 전체에 편집 잠금을 걸어 봤는데 다른 파일을 쓰는 세션끼리도 막아서 뺐다. 지금은 셋을 지킨다.

| 규칙 | 이유 |
| --- | --- |
| 같은 파일을 둘이(사람 포함) 동시에 고치지 않는다 | 충돌은 파일에서 난다 |
| 공유 색인과 인계문은 덧붙이기 직전에 다시 읽는다 | 마지막 쓰기가 이겨 그사이 쓴 줄이 사라진다 |
| 검토자는 파일을 고치지 않고 대화로 돌려준다 | 누가 무엇을 바꿨는지 가릴 수 있다 |

git 저장소라면 `claude --worktree <이름>` 이나 Codex 앱의 Worktree 로 폴더를 갈라 둔다. 한 브랜치는 한 곳에만 체크아웃되므로 각자 자기 브랜치에서 일하고 합치는 쪽은 하나로 정한다. 포트나 하나뿐인 데스크톱 앱처럼 폴더로 안 나뉘는 자원은 따로 잠근다.

## 3. 넘겨줄 때

대화와 자동 기억은 넘어가지 않는다. 넘기는 것은 인계문 하나와 작성자 자리다.

| 인계문 항목 | 적을 것 |
| --- | --- |
| 목표 | 끝나면 무엇이 참이어야 하나 |
| 변경한 경로 | 고친 파일 목록 |
| 검증 | 명령 그대로, 통과/실패, 시점. 코드면 커밋이나 해시 |
| 미확인 | 안 돌린 것, 못 본 것 |
| 다음 행동 | 하나, 다음 작성자와 함께 |

받은 쪽은 새 세션에서 인계문을 읽고, 작업 폴더와 실제 권한(샌드박스, 승인 모드)을 확인한 뒤, 중요한 검증을 직접 다시 돌린다. 다른 에이전트의 「완료」는 근거가 아니다. 이유는 [05편](/posts/05-independent-verification/)과 같다.

## 4. Claude 안에서 Codex 부르기

[openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) 는 `/plugin install codex@openai-codex` 로 깔고, 로컬 Codex CLI 의 로그인과 `config.toml` 을 그대로 쓴다.

| 명령 | 하는 일 |
| --- | --- |
| `/codex:review` | 현재 변경 검토. 읽기 전용, 관점 지정 불가. 끝난 변경의 독립 검토에 쓴다 |
| `/codex:adversarial-review` | 설계와 가정을 따지는 검토. 읽기 전용, 볼 위험을 적어 준다 |
| `/codex:rescue` | 조사나 수정을 넘긴다. 조사만 원하면 「고치지 마」를 적는다 |
| `/codex:transfer` | 이 대화를 Codex 스레드로 옮긴다 |
| `/codex:setup` | 설치와 로그인 확인, review gate 토글 |

review gate 는 `Stop` hook 으로 응답마다 Codex 검토를 돌린다. 긴 루프로 사용량을 빨리 쓸 수 있다고 README 가 경고해서 꺼 둔다. setup 은 준비됨인데 검토가 실패한 적이 있는데, 떠 있던 중계 프로세스가 옛 CLI 를 쓰고 있었다. 옆 터미널 창에 Codex 를 띄우는 길은 [10편](/posts/10-agent-multiplexer/)에 있다.

## 5. 안 넘어가는 것

| 항목 | Claude Code | Codex | 같이 쓰려면 |
| --- | --- | --- | --- |
| skill | `.claude/skills/` | `.agents/skills/` | 양쪽에 사본. Codex 는 같은 이름을 둘 다 띄우므로 위치를 바꿀 때는 이동 |
| hook | `settings.json` | `hooks.json`, 정의마다 검토 후 신뢰 | 따로 설치하고 따로 검증 |
| 서브에이전트 | `.claude/agents/*.md` | `.codex/agents/*.toml` | 따로 정의 |
| 자동 기억 | 저장소별, 이 PC 에만 | Memories, 기본 꺼짐 | 정본 아님. 꼭 지킬 규칙은 `AGENTS.md` 에 |
| 설정과 인증 | `settings.json` | `config.toml` | 앱마다 따로 |

두 도구 모두 상대 쪽 설정을 가져오는 `/import` 가 있다. 사본을 만드는 방식이라 규칙이 두 벌이 되므로 내 세팅에서는 쓰지 않았다.

## 참고

- [Claude Code Docs: How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Claude Code Docs: Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)
- [Codex Docs: AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Codex Docs: Config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [openai/codex rust-v0.150.0](https://github.com/openai/codex/releases/tag/rust-v0.150.0)
- [Codex Docs: Git worktrees](https://learn.chatgpt.com/docs/environments/git-worktrees)
- [Codex Docs: Skills](https://learn.chatgpt.com/docs/build-skills)
- [Codex Docs: Hooks](https://learn.chatgpt.com/docs/hooks)
- [Codex Docs: Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex Docs: Memories](https://learn.chatgpt.com/docs/customization/memories)
- [Codex Docs: Import](https://learn.chatgpt.com/docs/import)
- [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)
