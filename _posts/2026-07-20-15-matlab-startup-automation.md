---
publish: true
title: 15. 세션 초기화 자동화 — 자동과 수동의 경계를 파일로 나눈다
description: startup.m 에 전부 넣지 않고, 경로 등록은 자동으로 세션 공유는 수동으로 분리한 구현과 그 근거를 정리한다. MCP 시리즈 15편.
date: 2026-07-20 06:17:00 +0900
categories: [AI 에이전트, 운영과 경계]
tags: [mcp, matlab, startup, 세션공유, 자동화]
mermaid: true
sources:
  - https://www.mathworks.com/help/matlab/ref/startup.html
  - https://www.mathworks.com/help/matlab/ref/matlab.engine.shareengine.html
  - https://www.mathworks.com/help/matlab/ref/exist.html
---

> **기준:** 확인일 2026-07-20
> **시리즈:** [목차](/posts/00-mcp-series/) · 이전 → [14. 에디터 통합](/posts/14-mcp-editor-integration/) · 다음 → [16. 설정 적용](/posts/16-mcp-config-applied/)

---

[13편 §6](/posts/13-mcp-next-steps/)에서 초기화 자동화의 **판단**을 정리했다. 이 글은 그것을 **어떻게 구현했는가**다.

## 1. 문제

MATLAB을 새로 띄울 때마다 두 줄을 입력해야 했다.

```matlab
addpath("<도구 폴더 경로>")
satk_initialize
```

경로가 길어 매번 치기 번거롭고, 오타가 나면 원인을 찾는 데 시간이 든다.

`startup.m`은 [MATLAB이 기동할 때 자동 실행하는 파일](https://www.mathworks.com/help/matlab/ref/startup.html)이다. userpath 폴더(Windows 기본값은 `Documents\MATLAB`)에 두면 된다. 그 폴더는 검색 경로에 기본 포함되므로, 여기 둔 `.m` 파일은 어디서든 함수처럼 호출된다.

## 2. 전부 자동화하지 않은 이유

가장 편한 형태는 두 줄을 다 `startup.m`에 넣는 것이다. **그러면 MATLAB을 켤 때마다 세션이 자동으로 공유 상태가 된다.**

초기화 함수는 [세션 공유](https://www.mathworks.com/help/matlab/ref/matlab.engine.shareengine.html)를 켠다([10편](/posts/10-matlab-session-sharing/)). 그 순간부터 외부 프로세스가 그 세션에 연결할 수 있다.

**에이전트를 쓰지 않는 평소 작업에서까지 그 상태로 둘 이유가 없다.** 특히 다른 목적으로 열어둔 세션이 자동으로 공유되는 것은 의도가 아니다.

> **편의를 위해 기본값을 넓히지 않는다.** 기본값은 좁게 두고, 필요할 때 명시적으로 넓힌다.

## 3. 구현 — 두 파일로 나눈다

핵심은 **두 가지 일을 한 파일에 넣지 않는 것**이다.

| 하는 일 | 위험 | 어디에 |
| --- | --- | --- |
| 도구 경로를 검색 경로에 추가 | 없음 | **자동** (`startup.m`) |
| 세션 공유를 켠다 | 외부 프로세스가 붙을 수 있게 된다 | **수동** (단축 함수) |

### `startup.m` — 경로만

```matlab
% MATLAB 시작 시 자동 실행.
% 경로만 추가한다. 세션 공유는 켜지 않는다.

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
- **에러가 아니라 경고를 낸다.** `startup.m`에서 에러를 내면 기동이 지저분해지고, 이후 줄이 실행되지 않는다.
- **변수를 정리한다.** `startup.m`의 변수는 기본 작업공간에 그대로 남는다.

### 단축 함수 — 초기화

```matlab
function satk()
%SATK  도구 초기화 단축 명령.
%   주의: 이 명령은 세션 공유를 켜서 현재 세션을 외부에서 접근 가능하게 만든다.

    if exist('satk_initialize', 'file') ~= 6 && exist('satk_initialize', 'file') ~= 2
        error('satk:notOnPath', ...
            '초기화 함수를 찾을 수 없습니다. startup.m 이 경로를 추가했는지 확인하세요.');
    end

    fprintf('초기화를 시작합니다. 이 세션은 외부에서 접근 가능해집니다.\n');
    satk_initialize;
end
```

**실행하면 무엇이 일어나는지 한 줄로 알린다.** 세션이 공유 상태가 된다는 사실이 조용히 지나가면 안 된다. [13편](/posts/13-mcp-next-steps/)에서 자동화의 대가로 지적한 *"상태 인지가 사라진다"*를 이 한 줄이 막는다.

> ⚠️ **`exist`의 반환값에 주의.** 도구 진입점이 P-code(`.p`)로 배포되면 [`exist(name, 'file')`](https://www.mathworks.com/help/matlab/ref/exist.html)이 `2`가 아니라 **`6`**을 돌려준다. 존재 확인 코드를 쓴다면 둘 다 허용해야 한다. 여기서 걸려서 확인했다.

결과적으로 두 줄이 한 단어가 됐다.

```matlab
satk
```

## 4. 확인 방법

`startup.m`은 **기동할 때만** 읽힌다. 고쳤으면 MATLAB을 다시 띄워야 반영된다.

경로가 잡혔는지는 이것으로 본다.

```matlab
which satk_initialize
```

경로가 출력되면 `startup.m`이 동작한 것이다. 아무것도 안 나오면 파일 위치(userpath)부터 확인한다.

## 5. 이 분리가 일반적으로 뜻하는 것

초기화 스크립트를 쓸 때 반복되는 판단이다.

| | 자동화 | 수동 |
| --- | --- | --- |
| 편의 | 높다 | 한 단어 차이 |
| 노출 표면 | **상시** | 필요할 때만 |
| 상태 인지 | 사라진다 | **유지된다** |

**편의의 차이는 "0단어 vs 1단어"인데, 노출 표면의 차이는 "상시 vs 필요할 때"다.** 비대칭이 크면 덜 편한 쪽이 맞다.

그리고 **자동화할 것과 하지 않을 것의 경계를 파일 단위로 나누면** 나중에 읽을 때 의도가 드러난다. 한 파일에 조건문으로 섞어두면 6개월 뒤에 왜 그렇게 했는지 알 수 없다.

## 📌 정리

- `startup.m`은 userpath에 두면 MATLAB 기동 시 자동 실행된다
- **전부 자동화하지 않는다.** 초기화는 세션을 공유 상태로 만든다
- **경로 등록은 자동, 세션 공유는 수동** — 경계를 파일로 나눈다
- 공유가 시작된다는 사실을 **명시적으로 출력**한다. 상태 인지를 잃지 않기 위해
- `startup.m`에서는 에러 대신 경고를 쓰고, 사용한 변수는 정리한다
- P-code로 배포된 함수는 `exist`가 **`6`**을 돌려준다

## 시리즈

[목차](/posts/00-mcp-series/) · 이전 → [14. 에디터 통합](/posts/14-mcp-editor-integration/) · 다음 → [16. 설정 적용](/posts/16-mcp-config-applied/)

## 참고

- [startup](https://www.mathworks.com/help/matlab/ref/startup.html)
- [matlab.engine.shareEngine](https://www.mathworks.com/help/matlab/ref/matlab.engine.shareengine.html)
- [exist](https://www.mathworks.com/help/matlab/ref/exist.html)
