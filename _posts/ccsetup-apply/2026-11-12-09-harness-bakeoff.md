---
title: 09. 남의 하네스와 같은 과제로 겨뤄 보기
date: 2026-11-12 11:09:00 +0900
description: 내 세팅과 ruflo, ECC 에 같은 Stateflow 과제를 주고 숨은 시험으로 채점하니 정확성은 같고 비용과 그림 배치만 갈렸다.
categories: [Claude Code 세팅, 하네스 비교]
tags: [ClaudeCode, 하네스, 검증, 실측, stateflow, ethercat]
---

> **기준 출처:** [ruvnet/ruflo](https://github.com/ruvnet/ruflo) · [affaan-m/ECC](https://github.com/affaan-m/ECC) · [Claude Code Docs, Run Claude Code programmatically](https://code.claude.com/docs/en/headless) / 비교 실행 2026-09-17 (ruflo 3.42.0, ECC 플러그인 2.2.1) · 확인일 2026-11-12 · Claude Code 2.1.322 · Codex CLI 0.167.0
> **시리즈:** [목차](/posts/00-ccsetup-series/) | 이전 → [08. Claude Code 와 Codex 같이 쓰기](/posts/08-claude-and-codex/) | 다음 → [10. 터미널에서 에이전트 여럿 돌리기 — Orca 에서 herdr 로](/posts/10-agent-multiplexer/)

Claude Code 위에 얹는 남의 하네스가 내 세팅보다 나은지는 후기로는 알 수 없어서, 같은 과제를 주고 같은 방식으로 채점했다. 아래 숫자는 2026-09-17 에 한 PC 에서 돌린 한 회차의 관측이다.

## 1. 세 쪽

| 쪽 | 무엇 | 붙이는 방식 |
| --- | --- | --- |
| 내 세팅 | 평소 쓰는 규칙 파일, 명령, 서브에이전트, MCP | 그대로 |
| [ruflo](https://github.com/ruvnet/ruflo) | README 의 표현으로 「Claude Code 와 Codex 를 위한 에이전트 메타 하네스」. 옛 이름 Claude Flow | `npx ruflo@latest init` 이 프로젝트에 에이전트, hook, 기억, MCP 서버를 써 넣는다 |
| [ECC](https://github.com/affaan-m/ECC) | skill, 에이전트, 명령, hook 을 묶은 킷 | 플러그인 `ecc@ecc`. rules 는 플러그인으로 안 오고 손으로 복사한다 |

모델은 세 쪽 다 opus 로 지정했고 추가 허용 도구도 같게 주었다. MCP 는 맞추지 못했다. 내 세팅은 평소 MCP 전부, ruflo 쪽은 자기 MCP 하나, ECC 쪽은 없음이다.

## 2. 과제 — EtherCAT ESM 을 Stateflow 로

EtherCAT 슬레이브의 ESM(EtherCAT State Machine) 중 Init(1), Pre-Operational(2), Safe-Operational(4), Operational(8) 네 상태를 Stateflow 로 만드는 과제다. 표준의 허용 전이에 오류 규칙은 이 과제가 따로 정해 더했다.

| 항목 | 내용 |
| --- | --- |
| 입출력 | 입력 `req`(요청 상태, 0 = 없음), `ack`(오류 해제). 출력 `st`, `err`, `outEn = (st == 8)` |
| 매 틱 순서 | ① `ack` 면 `err = 0` ② 허용 전이면 이동, 아니면 `err = 1`. `err` 중에는 Init 요청만 받는다 ③ `outEn` 갱신 |
| 허용 전이 | 1→2, 2→1, 2→4, 4→1, 4→2, 4→8, 8→1, 8→2, 8→4 |
| 결과물 | 모델, 모델을 다시 만드는 빌드 스크립트, 사양표, 공개 시험 스크립트 |

t = 0 은 입력을 보지 않는 초기화 틱이다. 같은 틱의 `ack` 와 요청, 연속 불법 요청, 오류 중 Init 요청 같은 모서리를 일부러 넣었다. 각 쪽에는 과제 절만 보내고, 예측과 채점 기준은 실행 전에 따로 적었다.

## 3. 공정하게 돌리기

PowerShell 실행기가 쪽마다 자기 폴더에서 `claude -p` 를 헤드리스로 띄운다.

| 장치 | 막는 것 |
| --- | --- |
| 실행 중에는 회차 폴더(예측, 채점 기준, 숨은 시험)를 작업 영역 밖으로 옮겼다가 끝나면 되돌린다 | 채점 기준에 맞춰 만들기 |
| 쪽마다 `--disallowedTools "Read(<회차 폴더>/**) Read(<다른 쪽 폴더>/**)"`. 앞 쪽 폴더는 복사 뒤 지운다 | 다른 쪽 결과물 보기 |
| `--output-format stream-json --verbose` 로 도구 호출 전부 저장 | 「밖에 쓴 파일」을 수정 시각이 아니라 실제 Write/Edit 경로로 판정. 동시에 돈 다른 세션의 편집이 섞이지 않는다 |
| 마지막 `result` 이벤트 | 비용, 시간, 턴, 권한 거부를 같은 형식으로 |

경로 Read 차단만으로는 Grep 이나 Glob 으로 새는 길이 남을 수 있다고 봐서(미확인) 폴더를 옮기는 쪽을 주 장치로 두었다.

## 4. 숨은 시험으로 채점

각 쪽의 「공개 시험 3/3 통과」 보고는 근거로 쓰지 않았다. 별도 검증 세션이 세 쪽의 빌드 스크립트를 다시 돌려 모델을 만들고, 기준 구현이 낸 숨은 시퀀스 14개(285틱)와 공개 시험 3개를 틱 단위로 대조했다. 채점기는 먼저 참조 모델이 14개를 모두 통과하는지, Condition 하나를 일부러 뺀 오답 모델이 6개에서 실패하는지를 확인했다. 채점기가 틀린 모델을 떨어뜨리는지부터 본 것이다([05편](/posts/05-independent-verification/)).

## 5. 결과

| | 내 세팅 | ruflo | ECC |
| --- | --- | --- | --- |
| 숨은 시험 | 14/14 | 14/14 | 14/14 |
| 공개 시험 재실행 | 3/3 | 3/3 | 3/3 |
| 비용 | $9.43 | $6.68 | $5.90 |
| 시간 | 27분 | 27분 | 77분 |
| 턴 | 69 | 50 | 46 |
| 입력 토큰 (턴당) | 11.5M (166k) | 5.8M (117k) | 6.1M (133k) |
| 도구 호출 / 권한 거부 | 68 / 9 | 49 / 4 | 45 / 5 |
| 밖에 쓴 파일 | 0 | 0 | 2 |
| 채점 기준 읽기 시도 | 0 | 0 | 0 |

정확성은 갈리지 않았고 구조까지 같았다. 상위 State `Al` 의 `during: err = err && !ack;` 가 ack 를 먼저 처리하고, 그 아래 네 State 사이에 `[req == N && !err]` Condition 의 Transition 9개(Init 행만 `[req == 1]`)를 두고, 불법 요청은 자식 `during` 에서 표시한다. 상위 State 이름까지 같았다.

갈린 것은 둘이다.

- **그림 배치.** ruflo 쪽은 네 State 를 세로 한 줄로 놓고 내려가는 Transition 은 왼쪽, 올라가는 것은 오른쪽으로 나눠 겹침이 없었다. 내 세팅은 2×2 격자에 대각선이 교차했고, ECC 쪽은 가로 한 줄에 라벨 셋이 겹쳤다.
- **비용.** 내 세팅이 가장 비쌌다. 매 턴 싣는 MCP 스키마와 명령 목록으로 턴당 입력이 가장 컸고, 검증 스크립트를 따로 만들어 여러 번 돌렸다. 규칙이 많은 세팅은 단발 헤드리스 과제에서 비싸다고 판단한다. ECC 의 77분은 hook 비용으로 보인다.

ECC 가 밖에 쓴 2건은 Claude Code 자동 기억 폴더 `~/.claude/projects/<프로젝트>/memory/` 의 메모 두 개다. 해는 없지만 「결과 폴더 밖에는 쓰지 않는다」는 조건 위반이다.

실행 전 예측과 비교하면, 내 세팅은 $3~5 와 10~20분으로 예상했는데 $9.4 와 27분이 나왔다. ruflo 가 입력 토큰을 더 쓸 것이라는 예상은 빗나갔고(절반), ECC 가 가장 느리다는 예상은 맞았다. 초기화 틱과 오류 중 Init 요청에서 갈릴 것이라 봤는데 셋 다 맞혔다.

## 6. 정한 것과 남은 것

이 과제에서 정확성에 대한 하네스의 몫은 0 이었다. 세 쪽 작업 폴더가 모두 내 노트 폴더 아래라 상위 규칙 파일을 같이 읽었고, 같은 모델에 같은 상위 규칙이 붙으면 하네스가 달라도 설계가 모인다고 본다. ruflo 가 이긴 배치는 좌표를 찍는 규칙이라 옮길 수 있다. 그래서 내 세팅을 유지하고 그 규칙을 배치 스크립트로 넣었다. MATLAB 모델 과제는 당분간 내 세팅과 ruflo 를 나란히 돌려 보고, ruflo 가 계속 나으면 그때 바꾼다.

> - 한 회차, 한 PC, 과제 하나다. 더 어려운 과제에서도 같을지는 모른다.
> - ruflo 쪽이 왜 세로 배치를 골랐는지는 모른다. ruflo 가 깐 `CLAUDE.md` 의 영향인지 우연인지 확인하지 못했다.
> - 「밖에 쓴 파일」은 도구 호출로만 셌다. hook 이나 MCP 서버가 직접 쓴 파일은 잡히지 않는다.
{: .prompt-warning }

## 참고

- [ruvnet/ruflo](https://github.com/ruvnet/ruflo)
- [affaan-m/ECC](https://github.com/affaan-m/ECC)
- [Claude Code Docs: Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [Claude Code Docs: CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Claude Code Docs: How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Beckhoff Information System: EtherCAT State Machine](https://infosys.beckhoff.com/content/1033/el1202_el1252/1036980875.html)
