---
title: 07. 앱설정 적용법 — 확장 없이 동작을 바꾸는 키
date: 2026-11-12 11:07:00 +0900
description: 설정 파일의 우선순위, 권한 규칙, model 과 effort, statusline, Codex config.toml 을 바꾸고 확인하고 되돌리는 순서.
categories: [Claude Code 세팅, 앱설정]
tags: [ClaudeCode, codex, 설정, 권한, 승인, 샌드박스]
---

> **기준 출처:** [Claude Code Docs, Settings](https://code.claude.com/docs/en/settings) · [Codex, Config basics](https://learn.chatgpt.com/docs/config-file/config-basic) / 확인일 2026-11-12 · Claude Code 2.1.322 · Codex CLI 0.167.0
> **시리즈:** [목차](/posts/00-ccsetup-series/) | 이전 → [06. 슬래시 명령 적용법](/posts/06-apply-slash-command/) | 다음 → [08. Claude Code 와 Codex 같이 쓰기](/posts/08-claude-and-codex/)

확장 없이 settings 키만으로 바뀌는 것들이다. 권한이 지시보다 단단한 이유는 [04편](/posts/04-tools-not-requests/)에 있다.

## 1. 어디에 놓나

Claude Code 는 위가 이긴다.

| 순위 | 위치 | 범위 |
| --- | --- | --- |
| 1 | 관리 설정 (`managed-settings.json`, MDM 등) | 조직 |
| 2 | `claude --settings '<json>'` | 그 세션만 |
| 3 | `.claude/settings.local.json` | 이 프로젝트, 나만 |
| 4 | `.claude/settings.json` | 이 프로젝트, 커밋하면 팀 공유 |
| 5 | `~/.claude/settings.json` | 내 모든 프로젝트 |

- **목록은 합쳐진다.** `permissions.allow` 는 범위끼리 모이고, 값 하나짜리 키만 위가 이긴다.
- **환경 변수는 이 층에 없다.** 키마다 따로 정해지며, `ANTHROPIC_MODEL` 은 어느 파일의 `model` 보다 앞선다.
- `defaultMode` 의 `auto`, `bypassPermissions` 는 프로젝트와 로컬 파일에서 효과가 없다.
- 커밋된 `.claude/settings.json` 의 `allow` 는 폴더를 신뢰한 뒤에 적용된다. `deny`, `ask` 는 바로 적용된다.

Codex 는 CLI 플래그와 `-c`, 프로젝트 `.codex/config.toml`, `--profile`, `~/.codex/config.toml` 순으로 이긴다. 프로젝트 층은 신뢰한 프로젝트에서만 읽는다.

## 2. 바꾸는 순서

백업을 남기고 키 한 곳만 고친다. 새 값은 `--settings`(Codex 는 `-c`)로 한 세션 먼저 돌려 본다. settings 는 엄격한 JSON 이라 주석과 끝 쉼표가 오류다. `"$schema": "https://json.schemastore.org/claude-code-settings.json"` 줄이 있으면 편집기가 검사한다.

### 2.1 권한 규칙

```json
"permissions": {
  "allow": ["Bash(npm run test *)", "PowerShell(Get-ChildItem *)"],
  "ask":   ["Bash(git push *)"],
  "deny":  ["Read(./.env)", "Read(./.env.*)"]
}
```

- deny, ask, allow 순으로 보고 처음 맞은 것이 결정한다. 좁은 allow 가 넓은 deny 의 예외가 되지 못한다. 범위가 달라도 같다.
- `&&`, `;`, `|` 로 이은 명령은 부분이 전부 허용돼야 지나간다. `PowerShell(Get-ChildItem *)` 은 `gci`, `ls`, `dir` 도 잡는다.
- 규칙은 Claude Code 가 집행한다. CLAUDE.md 의 문장은 허용 범위를 바꾸지 않는다.
- 새 세션의 권한 모드(`default`, `plan`, `auto` 등)는 `defaultMode` 로 정한다.

### 2.2 model 과 effort

```json
"model": "opus",
"modelSettings": { "claude-opus-5-5": { "effortLevel": "high" } }
```

- 저장할 수 있는 effort 는 `low`, `medium`, `high`, `xhigh` 다. `max` 는 그 세션에만 적용된다. `CLAUDE_CODE_EFFORT_LEVEL` 은 모든 설정보다 앞선다.
- 🔴 **사용자 settings 의 최상위 `effortLevel` 은 Opus 5.5 부터 적용되지 않는다.** 그 모델은 `modelSettings` 의 값을 보고, 없으면 기본값 `medium` 으로 돈다. `/effort` 도 거기에 쓴다.

### 2.3 statusline

```json
"statusLine": { "type": "command", "command": "powershell -NoProfile -File ~/.claude/statusline.ps1" }
```

- stdin 으로 세션 JSON 이 오고 stdout 이 화면에 뜬다. 컨텍스트 사용률은 `context_window.used_percentage` 로 오며 세션 초반엔 `null` 일 수 있다.
- Windows 에서 Git Bash 가 있으면 Git Bash 로 돈다. 경로의 `\` 는 이스케이프 문자로 처리돼 오류 없이 빈 줄이 되므로 `/` 로 쓴다.
- 키는 `statusLine` 이다. 검토한 외부 패키지는 `statusline`(소문자)을 써서 맞지 않았다.
- 폴더 신뢰 전에는 비어 있고, `disableAllHooks: true` 도 statusline 을 끈다.

### 2.4 Codex config.toml

```toml
model_reasoning_effort = "medium"
approval_policy = "on-request"      # on-request | never | { granular = {...} }
sandbox_mode    = "workspace-write" # read-only | workspace-write | danger-full-access
```

- 샌드박스는 **할 수 있는 것**, 승인은 **묻는 시점**이다. 다른 축이다.
- 한 세션만 바꾸려면 `codex -s read-only -a on-request`, `codex -c model_reasoning_effort=high`.
- `approval_policy = "untrusted"` 는 더 이상 지원하지 않는다. 옛 설정에 남아 있으면 지운다.

## 3. 적용됐는지 확인하는 법

| 무엇 | Claude Code | Codex |
| --- | --- | --- |
| 읽은 파일 | `/status` 의 `Setting sources` (키별 출처는 안 보임) | `/debug-config` |
| 거부된 항목 | 시작 시 Settings Error, Warning 과 `claude doctor` | |
| 권한 | `/permissions` (규칙마다 출처 파일) | `/permissions`, `/status` |
| model, effort | `/model`, `/effort status` | `/model`, `/status` |

Claude Code 는 `permissions`, `hooks` 등 대부분을 실행 중 세션에 바로 반영한다. `model`, `effortLevel`, `modelSettings` 는 시작할 때만 읽으므로 세션 중에는 `/model`, `/effort` 를 쓴다.

## 4. 되돌리기

- 키를 지우면 아래 범위의 값이나 기본값으로 돌아간다. 위 범위에 같은 키가 있으면 달라 보이지 않는다.
- 여러 키를 고쳤으면 백업을 되살린다. `--settings`, `-c` 시험은 파일에 남지 않는다.
- statusline 은 `/statusline delete`, effort 는 `/effort auto`(지금 모델의 저장 값만 지운다).

## 5. 자주 걸리는 것

1. **「다시 묻지 않기」를 골랐는데 또 묻는다.** 로컬 파일에 저장된 그 allow 는 프로젝트나 관리 파일의 ask 를 이기지 못한다.
2. **다른 손이 같은 파일을 고친다.** `/model`, `/effort` 도 사용자 settings 에 쓴다. 실측 환경에서는 hook 을 정리하던 다른 작업이 `statusLine` 까지 지워 백업에서 되살렸다.

## 참고

- [Claude Code Docs: Settings files and precedence](https://code.claude.com/docs/en/settings)
- [Claude Code Docs: Configure permissions](https://code.claude.com/docs/en/permissions)
- [Claude Code Docs: Model configuration](https://code.claude.com/docs/en/model-config)
- [Claude Code Docs: Customize your status line](https://code.claude.com/docs/en/statusline)
- [Codex: Config basics](https://learn.chatgpt.com/docs/config-file/config-basic)
- [Codex: Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Codex: CLI reference](https://learn.chatgpt.com/docs/cli/reference)
- [Codex: Slash commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
