---
title: 06. 슬래시 명령 적용법 — 내가 부르는 절차
date: 2026-11-12 11:06:00 +0900
description: 명령이 skill 로 합쳐진 뒤 /이름 을 어디에 만들고, 인자를 어떻게 넘기고, 예약 실행과 이름 충돌과 끄기를 어떻게 다루는지 정리한다
categories: [Claude Code 세팅, 슬래시 명령]
tags: [ClaudeCode, 슬래시명령, skill, 절차, headless, codex]
---

> **기준 출처:** [Claude Code Docs, Extend Claude with skills](https://code.claude.com/docs/en/skills) · [Run Claude Code programmatically](https://code.claude.com/docs/en/headless) · [Codex, Custom Prompts](https://learn.chatgpt.com/docs/custom-prompts) · [Build skills](https://learn.chatgpt.com/docs/build-skills) / 확인일 2026-11-12 · Claude Code 2.1.322 · Codex CLI 0.167.0
> **시리즈:** [목차](/posts/00-ccsetup-series/) | 이전 → [05. 서브에이전트 적용법](/posts/05-apply-subagent/) | 다음 → [07. 앱설정 적용법](/posts/07-apply-settings/)

명령을 왜 파일로 남기는지는 [02. 슬래시 명령](/posts/02-slash-commands/) 에서 다뤘다. 이 편은 바뀐 문서를 기준으로 만들고, 확인하고, 끄는 법을 적는다.

## 1. 명령은 skill 로 합쳐졌다

문서에 따르면 `.claude/commands/deploy.md` 와 `.claude/skills/deploy/SKILL.md` 는 둘 다 `/deploy` 를 만들고 똑같이 동작한다. 기존 `commands/` 파일도 계속 동작한다.

| | `commands/<이름>.md` | `skills/<이름>/SKILL.md` |
| --- | --- | --- |
| 머리말 | skill 과 같고 `name`, `paths` 만 없다 | 전부 |
| 모양 | 파일 하나 (`frontend/component.md` → `/frontend:component`) | 폴더 (스크립트, 참고 문서 동봉) |
| 같은 이름이면 | 진다 | 이긴다 |
| Claude 가 알아서 부르기 | `disable-model-invocation: true` 가 없으면 된다 | 같다 |

`commands/` 에 있다고 사람만 부르는 것이 아니다. 그래서 이 편의 슬래시 명령은 파일 위치가 아니라 **시점을 내가 정해 `/이름` 으로 부르는 절차**를 뜻한다. 놓는 위치와 우선순위는 [01. Skill 적용법](/posts/01-apply-skill/) 의 표와 같다.

내가 만든 명령은 같은 이름의 기본 명령을 대신한다. 프로젝트에 `usage` skill 을 두면 로컬 터미널의 `/usage` 가 그 skill 을 부르고, 별칭만 남는다.

## 2. 최소 예 — 인자 둘, 수동 전용

`.claude/skills/release-prep/SKILL.md`:

```markdown
---
name: release-prep
description: 버전 번호와 기준 브랜치를 받아 CHANGELOG 를 갱신하고 태그 명령을 준비한다
argument-hint: "[version] [base-branch]"
arguments: [version, base]
disable-model-invocation: true
---

$base 브랜치 기준으로 $version 릴리스를 준비한다.

최근 커밋: !`git log --oneline -20`

1. 받은 인자를 그대로 되풀이한다. 비어 있으면 묻고 멈춘다.
2. 위 커밋 목록으로 CHANGELOG 의 $version 절을 쓴다.
3. 태그는 만들지 않는다. 만들 명령만 출력하고 멈춘다.
```

| 자리표 | 뜻 |
| --- | --- |
| `$ARGUMENTS` | 친 인자 전부. 자리표가 없으면 끝에 `ARGUMENTS: <입력>` 이 붙는다 |
| `$0`, `$1` | 0부터 센 위치 |
| `$version` | `arguments:` 로 이름 붙인 위치. `/release-prep 1.4.0 main` 이면 `1.4.0` |
| `` !`명령` `` | Claude 가 보기 전에 실행해 결과로 바꾼다. 실패하면 호출 전체가 취소된다. Windows 는 `shell: powershell` |

이름은 `/` 를 먼저 쳐서 기본 명령과 겹치지 않는지 본다. description 의 `<branch>` 는 `&lt;` 로 보이므로 `[branch]` 로 쓰고, 대괄호로 시작하는 `argument-hint` 값은 따옴표로 감싼다.

## 3. 정해진 시각에 돌리기

문서상 `claude -p` 에서도 사용자가 부르는 skill 과 custom command 가 동작한다. 프롬프트에 `/이름` 을 넣으면 실행 전에 펼쳐진다.

```powershell
claude -p "/daily-summary" --allowedTools "Read,Write,Edit" --output-format json
```

- `--bare` 는 skill 과 custom command 를 찾지 않는다. 명령을 부르는 예약 실행에는 붙이지 않는다.
- v2.1.302 부터 `-p` 는 모드를 정하지 않으면 Manual 로 시작해 승인이 필요한 호출을 거부한다. `--allowedTools` 나 `--permission-mode` 로 미리 연다.
- 결과는 JSON 의 `result` 필드와 종료 코드(성공 0)로 본다.
- 첫 단계에 「이번 주기 결과가 이미 있으면 건너뛴다」를 두면 빠진 날 손으로 다시 쳐도 된다.

무인 운영 전반은 [09. 예약 실행과 무인 운영](/posts/09-scheduled-runs/) 에 있다.

## 4. 켜졌는지 확인

| 확인 | 방법 |
| --- | --- |
| 메뉴에 떴나 | `/` 와 이름 일부를 친다. 뒤에 `argument-hint` 가 보이나 |
| 인자가 들어갔나 | 시험 인자로 한 번. 첫 단계가 인자를 되풀이하면 바로 보인다 |
| 수동 전용이 됐나 | description 이 목록에서 빠진다. 새 세션에서 스스로 부를 수 있는 skill 을 물어 확인했다 |
| 기본 명령을 안 가리나 | 새 세션에서 같은 이름의 기본 명령을 쳐 본다 |

메시지 중간의 `/이름` 은 써도 된다는 허락일 뿐 실행되지 않는다. 맨 앞에 쳐야 바로 돈다.

## 5. 끄기와 되돌리기

| 하고 싶은 것 | 방법 |
| --- | --- |
| Claude 의 후보에서만 빼기 | `disable-model-invocation: true`. 끝난 절차를 지우지 않고 보관할 때 |
| 파일은 두고 끄기 | skill 형식이면 `skillOverrides` 에 `"이름": "off"`, 또는 deny 규칙 `Skill(이름)` |
| 지우기, 이름 바꾸기 | 그 이름을 부르는 곳(예약 스크립트, 안내 문서)도 같이 고친다 |

## 6. 이 PC 에서 겪은 것

- `/resume` 을 쳤더니 세션 목록 대신 같은 이름의 내 명령이 돌았다. `/resume-update` 로 바꾸고 예약 스크립트 속 이름도 고쳤다. `/model` 도 같은 이유로 `/model-review` 가 됐다.
- 세 명령에 복사해 둔 검사 코드가 서로 달라져 있었다. 스크립트 하나로 빼고 명령은 부르기만 한다.
- 헤드리스 실행의 전체 기록(`stream-json`)에 세션이 읽은 파일 내용이 그대로 들어갔다. 전체 기록은 공개 폴더 밖에 둔다.

## 7. Codex 에서는

custom prompt 는 `~/.codex/prompts/<이름>.md` 에 두고 `/prompts:<이름>` 으로 부른다. 맨 위 폴더만 읽고, 고치면 재시작하며, 저장소로 공유되지 않는다. 문서는 이것을 deprecated 로 표시하고 skill(`.agents/skills/`, `$이름`)을 쓰라고 한다. 두 도구를 같이 쓰는 운영은 [08. Claude Code 와 Codex 같이 쓰기](/posts/08-claude-and-codex/) 에서 다룬다.

## 참고

- [Claude Code Docs: Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Claude Code Docs: Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [Codex: Custom Prompts](https://learn.chatgpt.com/docs/custom-prompts)
- [Codex: Build skills](https://learn.chatgpt.com/docs/build-skills)
