---
title: 08. 워크트리의 제약과 함정
date: 2026-11-12 12:08:00 +0900
description: 같은 브랜치 두 곳 불가, 따라오지 않는 파일, 지워지지 않는 브랜치, prunable, lock 과 detach 를 연습 저장소에서 일으킨 출력으로 정리한다.
categories: [Git, Git 기초]
tags: [git, worktree, 브랜치, 디버깅, 입문]
---

> **기준 출처:** [git-worktree](https://git-scm.com/docs/git-worktree) · [git-switch](https://git-scm.com/docs/git-switch) · [git-branch](https://git-scm.com/docs/git-branch) / 확인일 2026-11-12 · git 2.55.0.windows.2
> **시리즈:** [목차](/posts/00-git-series/) | 이전 → [07. 워크트리](/posts/07-git-worktree/) | 다음 → [09. 브랜치 전략](/posts/09-git-branch-strategy/)

07편이 워크트리의 쓸모였다면 이 편은 워크트리를 여러 개 굴릴 때 부딪히는 제약이다. 아래 출력은 연습 저장소에서 일부러 일으킨 것이고, 경로는 홈 폴더를 `~` 로 줄여 적었다.

## 1. 같은 브랜치를 두 폴더에 꺼낼 수 없다

```text
$ git worktree add ../demo_wt_main main
Preparing worktree (checking out 'main')
fatal: 'main' is already used by worktree at '~/git-practice/demo'
```

종료 코드는 128 이다. git-worktree 문서에 따르면 `add` 는 그 브랜치가 이미 다른 워크트리에 꺼내져 있으면 거부하고, `--force` 를 줘야 넘어간다. `git switch` 도 다른 워크트리가 들고 있는 브랜치로는 옮기지 않는다(`--ignore-other-worktrees` 로 넘긴다).

브랜치는 저장소에 하나뿐이라 한쪽 폴더에서 커밋하면 브랜치가 앞으로 가고, 같은 브랜치를 꺼낸 다른 폴더의 파일과 스테이징은 옛 커밋에 머문다. 이 거부는 그 어긋남을 막는 장치로 판단된다.

**대응:** 같은 시작점에서 일하려면 새 브랜치를 딴다. `git worktree add -b <새 브랜치> ../<폴더> main`.

## 2. 커밋하지 않은 파일은 따라오지 않는다

원래 폴더에 `add` 하지 않은 파일을 하나 두고 워크트리를 꺼낸다.

```text
$ git status --short
?? notes_untracked.txt
$ git worktree add ../demo_wt_b feature/wt_demo
$ ls ../demo_wt_b
README.md  config.txt  limits.txt  ramp.txt
```

워크트리는 커밋을 꺼내 놓는 것이라 커밋에 없는 것은 오지 않는다.

| 따라오지 않는 것 | 대응 |
| --- | --- |
| 커밋하지 않은 새 파일 (`??`) | 커밋하거나 필요한 폴더에 복사한다 |
| `.gitignore` 에 걸린 것: 빌드 산출물, 내려받은 의존성, 로컬 설정 | 워크트리마다 다시 빌드하거나 설치한다 |

새 워크트리에서 빌드가 안 되면 먼저 `.gitignore` 를 본다. 거기 적힌 것이 다시 만들어야 할 목록이다.

## 3. 꺼내 놓은 브랜치는 지울 수 없다

```text
$ git branch -d feature/wt_demo
error: cannot delete branch 'feature/wt_demo' used by worktree at '~/git-practice/demo_wt_b'
```

종료 코드는 1 이다. 어느 폴더가 그 브랜치를 들고 있는 동안은 지워지지 않는다. git-branch 문서도 다른 워크트리에 꺼내진 브랜치는 `-f` 를 줘도 옮기지 않는다고 적는다. 순서는 워크트리가 먼저, 브랜치가 나중이다: `git worktree remove ../demo_wt_b` 다음에 `git branch -d feature/wt_demo`. 4절은 이 순서를 일부러 어긴 경우다.

## 4. 폴더만 지우면 등록이 남는다 — `prune`

탐색기에서 워크트리 폴더를 그냥 지우면 저장소 쪽 `.git/worktrees/<이름>/` 이 남는다.

```text
$ rm -rf ../demo_wt_b
$ git worktree list
~/git-practice/demo      a0d9ec0 [main]
~/git-practice/demo_wt_b 5f2892a [feature/wt_demo] prunable

$ git worktree prune -v
Removing worktrees/demo_wt_b: gitdir file points to non-existent location
$ git worktree list
~/git-practice/demo a0d9ec0 [main]
```

`prunable` 은 폴더는 없는데 등록이 남은 상태다. `prune` 이 그 관리 파일을 지운다. 두어도 `gc.worktreePruneExpire` 설정에 따라 언젠가 자동으로 정리되지만, 그 전까지는 브랜치가 여전히 꺼내진 것으로 남는다. 별도의 빈 저장소에서 폴더만 지운 상태를 만들어 확인한 결과, `git branch -d` 는 3절의 `cannot delete branch … used by worktree` 로, 같은 브랜치의 `worktree add` 는 1절의 `already used by worktree` 로 거부되고, `prune` 뒤에는 둘 다 통과한다. 폴더를 지웠는데 브랜치가 안 지워지면 `git worktree list` 부터 본다.

반대로 main worktree 를 옮기면 linked worktree 가 저장소를 찾지 못한다. 이때는 main worktree 에서 `git worktree repair` 를 실행해 연결을 다시 잇는다.

## 5. 어느 폴더에 있느냐가 어느 브랜치냐다

4절에서 정리한 뒤 같은 브랜치를 `../demo_wt_c` 에 다시 꺼낸 상태다.

```text
$ git -C ../demo_wt_c status --short --branch | head -1
## feature/wt_demo
$ git -C ../demo status --short --branch | head -1
## main
```

같은 명령이 폴더에 따라 다른 브랜치를 본다. 터미널을 여럿 열어 두면 지금 어느 폴더인지 놓치기 쉽다. 셸 프롬프트에 브랜치 이름을 띄우거나, `git -C <폴더>` 로 폴더를 적어 실행하면 실수가 준다.

## 6. 덜 쓰지만 알아 둘 것 — `lock`, `--detach`

```text
$ git worktree lock ../demo_wt_c --reason "실습 보존"
$ git worktree list --porcelain | grep locked
locked "실습 보존"
$ git worktree unlock ../demo_wt_c
```

이동식 드라이브나 네트워크 폴더에 둔 워크트리는 연결이 끊기면 폴더가 없는 것처럼 보여 `prune` 대상이 된다. `lock` 은 관리 파일이 자동으로 정리되지 않게 막고, 옮기거나 지우는 것도 막는다. 이유는 `--reason` 으로 남긴다.

```text
$ git worktree add --detach ../demo_wt_old HEAD~3
HEAD is now at 0cad026 속도 150 (A안)
$ git worktree list
~/git-practice/demo        a0d9ec0 [main]
~/git-practice/demo_wt_c   5f2892a [feature/wt_demo]
~/git-practice/demo_wt_old 0cad026 (detached HEAD)
```

`--detach` 는 브랜치 없이 과거 시점을 폴더로 꺼낸다. 세 커밋 전에는 이 동작이 됐는지 볼 때 브랜치를 만들 필요가 없다. `(detached HEAD)` 는 브랜치를 거치지 않고 커밋을 직접 보고 있다는 뜻이다. 여기서 커밋하면 그 커밋을 가리키는 브랜치가 없어 나중에 찾기 어려우니 보기만 하고 `remove` 한다.

## 7. 정리 — 메시지별 대응

| 메시지, 증상 | 뜻 | 대응 |
| --- | --- | --- |
| `'main' is already used by worktree at …` | 다른 폴더가 그 브랜치를 들고 있다 | 새 브랜치로 꺼낸다 (`-b`) |
| 새 워크트리에 파일이나 빌드 산출물이 없다 | 커밋하지 않았거나 `.gitignore` 에 걸렸다 | 커밋하거나 다시 빌드한다 |
| `cannot delete branch … used by worktree` | 폴더가 아직 들고 있다 | `worktree remove` 를 먼저 한다 |
| `worktree list` 에 `prunable` | 폴더만 지웠다 | `git worktree prune` |
| 저장소를 옮긴 뒤 워크트리가 깨졌다 | 가리키는 경로가 옛 것이다 | `git worktree repair` |
| 명령이 엉뚱한 브랜치에 먹었다 | 다른 폴더였다 | `git -C <폴더>` 로 적어 실행한다 |

## 참고

- [git-worktree](https://git-scm.com/docs/git-worktree)
- [git-switch](https://git-scm.com/docs/git-switch)
- [git-branch](https://git-scm.com/docs/git-branch)
