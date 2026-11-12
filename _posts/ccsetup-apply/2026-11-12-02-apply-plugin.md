---
title: 02. Plugin 적용법 — 남이 묶은 꾸러미를 받을 때
date: 2026-11-12 11:02:00 +0900
description: 남이 묶은 plugin 을 받기 전에 안에 든 것을 열어 보고, 범위를 골라 설치하고, 켜졌는지 확인하고, 안 쓰면 끄는 순서를 정리한다.
categories: [Claude Code 세팅, Plugin]
tags: [ClaudeCode, plugin, 설정, 보안, 권한, hook, codex]
---

> **기준 출처:** [Claude Code Docs, Plugins](https://code.claude.com/docs/en/plugins) · [Install and manage plugins](https://code.claude.com/docs/en/plugins/install) · [Plugin security and trust](https://code.claude.com/docs/en/plugins/security) · [Codex Plugins](https://learn.chatgpt.com/docs/plugins) / 확인일 2026-11-12 · Claude Code 2.1.322 · Codex CLI 0.167.0
> **시리즈:** [목차](/posts/00-ccsetup-series/) | 이전 → [01. Skill 적용법](/posts/01-apply-skill/) | 다음 → [03. MCP 적용법](/posts/03-apply-mcp/)

Plugin 은 skill, 서브에이전트, hook, MCP 서버를 한 폴더에 담아 이름 하나로 설치하고 갱신하는 단위다. 남이 묶은 여러 구성을 한 번에 받을 때 쓰고, skill 하나나 바깥 프로그램 하나라면 [Skill](/posts/01-apply-skill/) 이나 [MCP](/posts/03-apply-mcp/) 로 직접 둔다.

## 1. 받기 전에 연다

설치한 plugin 은 내 권한으로 임의 코드를 실행할 수 있다. 켜 두면 쓰지 않는 세션에도 skill 설명이 매 턴 실리고, MCP 서버가 뜨고, hook 이 돈다. 설치 전에 네 가지를 본다.

| 질문 | 어디서 보나 |
| --- | --- |
| 누가 만들었나 | `claude plugin marketplace list` 의 소스. 공식 이름은 `github.com/anthropics/` 소스에만 허용된다. 이름이 내용을 보증하지는 않는다 |
| 무엇을 실행하나 | 원본의 `hooks/hooks.json`, `.mcp.json`, `bin/`. 상세 창의 **Will install** 은 hook 이 있다는 것만 보여 준다 |
| 어디까지 닿나 | hook 과 MCP 서버는 샌드박스 밖에서 내 권한으로 돈다. 권한 규칙은 Claude 의 도구 호출만 덮는다 |
| 얼마나 드나 | 공식 marketplace 는 상세 창의 **Context cost**, 설치 뒤에는 `claude plugin details` 의 `Always-on` |

안전 검사가 먼저다. 맞지 않는 skill 은 지우면 끝이지만 hook 이 이미 한 일은 되돌릴 수 없다. clone 한 폴더는 `claude --plugin-dir <폴더> plugin details <이름>` 으로 세션 없이 구성을 본다. 공식 marketplace 는 대부분 자동 갱신이 켜져 있어 검토한 파일이 바뀔 수 있다.

## 2. 범위 — 어디에 적히나

| 범위 | 적히는 곳 | 누가 받나 |
| --- | --- | --- |
| user | `~/.claude/settings.json` 의 `enabledPlugins` | 나, 모든 프로젝트 |
| project | `.claude/settings.json` (커밋) | 협업자 전원. 각자 한 번 설치해야 받는다 |
| local | `.claude/settings.local.json` | 나, 이 저장소만 |
| 계정 동기화 | `<이름>@synced` | claude.ai 계정으로 로그인한 터미널 세션 |

겹치면 local, project, user 순으로 이긴다. 파일은 `~/.claude/plugins/cache/` 에 버전별로 받아지며 갱신하면 새 폴더로 바뀌니 고쳐 쓰지 않는다. 클라우드 세션은 로컬에 설치한 plugin 을 읽지 않는다.

## 3. 붙이는 순서

marketplace 등록은 카탈로그만 받는다. 공식 `claude-plugins-official` 은 첫 대화형 세션에서 자동 등록된다.

```text
/plugin marketplace add owner/repo#v1.2.0     # GitHub, 태그 고정
/plugin marketplace add ./my-marketplace      # 로컬. ./ 를 빼면 GitHub 로 읽는다
/plugin install <plugin>@<marketplace>        # 상세 창에서 범위를 고른다
claude plugin install <plugin>@<marketplace> --scope project   # 셸. 기본 user
```

설치 요약의 마지막 문장을 본다.

| 마지막 문장 | 할 일 |
| --- | --- |
| `Plugin is now active.` | 없다 |
| `Run /reload-plugins to apply.` | 자동으로 reload 된다. 보류되면 `/reload-plugins --force` |
| `... needs configuration ...` | `/plugin` Installed 탭에서 Configure |
| `The plugin couldn't be loaded` | `/plugin` Errors 탭 |

셸에서 설치했으면 다음 시작이나 `/reload-plugins` 때 뜬다. `defaultEnabled: false` 인 plugin 은 따로 `enable` 한다.

## 4. 켜졌는지 확인

| 명령 | 보이는 것 |
| --- | --- |
| `/` 입력 | `/<plugin>:<skill>` |
| `claude plugin list` | `Version`, `Scope`, `Status` |
| `claude plugin details <이름>` | `Component inventory`, `Always-on` 토큰 |
| `/plugin` Errors, Installed 탭 | 오류, **Not used recently** |

plugin 이 들여온 MCP 도구는 이름이 `mcp__plugin_<plugin>_<서버>__<도구>` 라서 서버 이름만으로 쓴 권한 규칙이나 hook matcher 에 걸리지 않는다. skill 수는 노출된 수로 센다(노출 26개인 툴킷의 폴더에 `SKILL.md` 157개).

## 5. 끄기와 되돌리기

| 하고 싶은 것 | 명령 |
| --- | --- |
| 잠시 끄기 | `claude plugin disable <p>@<m>`, 되돌리기는 `enable` |
| 제거 | `claude plugin uninstall <p>@<m> --scope <설치한 범위>` |
| marketplace 째로 | `claude plugin marketplace remove <m>`. 거기서 설치한 plugin 도 전부 제거 |
| 프로젝트가 켠 것을 나만 | `/plugin uninstall` 후 `y` |
| 동기화된 것 | `claude plugin disable <이름>@synced` |

uninstall 기본 범위는 user 다. 데이터 폴더도 지워지고(`--keep-data` 로 남긴다) cache 는 14일 뒤 정리된다. plugin 이 홈의 다른 곳에 쓴 설정은 남을 수 있어 붙일 때 적어 둔다.

## 6. 겪은 것

| 관측 | 대응 |
| --- | --- |
| 동기화로 딸려 온 plugin 10개가 끌고 온 MCP 서버 44개는 한 번도 불리지 않았다 | `@synced` 10개 disable. 세션당 서버 51 → 7 |
| hook 이 든 plugin 을 「두 회차 이상 쓰면 유지」로 넣었는데 한 달 동안 0회 | disable |
| 하위 폴더 전용 plugin 을 user 로 설치해 모든 세션에 hook 이 걸렸다 | uninstall 후 그 폴더 안에서 `--scope project` |
| `npx <도구> init` 으로 `.claude/` 를 만드는 킷은 plugin 이라 불려도 `plugin list` 에 없다 | 빈 폴더에서 먼저 돌린다 |

## 7. Codex 쪽

Codex CLI 는 `/plugins` 에서 설치하고 Space 로 켜고 끄며, 설치 뒤 새 세션에서 보인다. hook 은 돌기 전에 검토하라고 문서가 적는다.

## 참고

- [Claude Code Docs: Plugins overview](https://code.claude.com/docs/en/plugins)
- [Claude Code Docs: Install and manage plugins](https://code.claude.com/docs/en/plugins/install)
- [Claude Code Docs: Plugin security and trust](https://code.claude.com/docs/en/plugins/security)
- [Claude Code Docs: Plugin loading reference](https://code.claude.com/docs/en/plugins/loading)
- [Claude Code Docs: MCP](https://code.claude.com/docs/en/mcp)
- [Codex: Plugins](https://learn.chatgpt.com/docs/plugins)
