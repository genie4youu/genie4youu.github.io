# genie4youu.github.io

로봇 제어 소프트웨어 공부 기록. [Chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) 테마 기반 Jekyll 사이트.

**사이트** → <https://genie4youu.github.io>
**시리즈 목록** → <https://genie4youu.github.io/series/>

편수와 시리즈 수는 여기 안 적는다. 손으로 적으면 글이 늘 때마다 조용히 낡는다. 위 시리즈 페이지가 `_posts/` 를 직접 세서 보여준다.

---

## 이 저장소만의 규칙

Chirpy 문서에 없고 여기서 겪어서 정한 것들이다. 어기면 조용히 깨진다.

### 1. `_data/series.yml` 이 시리즈의 단일 정본이다

카드 이름, 아이콘, 소개, 어느 폴더를 묶는지가 전부 여기 있다. 카드를 고치려면 `_layouts/landing.html` 이 아니라 이 파일을 고친다.

- **편수는 이 파일에 적지 않는다.** `landing.html` 과 `_tabs/series.md` 가 `_posts/<dir>/` 를 직접 센다
- **00 목차 글은 편수에서 뺀다.** 세면 카드는 "23편" 인데 그 카드를 눌러 들어간 목차 글 본문은 "22편으로 정리한다" 가 되어 같은 시리즈에 두 숫자가 뜬다
- **카드를 늘릴 때 `assets/css/jekyll-theme-chirpy.scss` 의 색 맵도 같이 늘린다.** 카드 `id` 와 색 키 이름이 같아야 한다
- 🔴 **`index:` 가 가리키는 글이 실재해야 한다.** 없는 글을 가리키면 htmlproofer 가 internal-link 실패를 내고 배포가 통째로 떨어진다 (2026-08-07 에 실제로 겪었다)

### 2. 탭 제목은 frontmatter 가 아니라 `_data/locales/ko-KR.yml` 이 정한다

`_tabs/*.md` 에 한글 `title:` 을 넣으면 사이드바에는 나오는데 `<title>` 태그가 빈다. 파일명과 같은 키로 로케일 파일에 적는다.

### 3. 탭 파일은 BOM 없이 저장한다

BOM 이 있으면 그 탭이 통째로 안 만들어진다.

### 4. 볼트가 원본이고 이 저장소는 사본이다

글은 볼트에서 쓰고 여기로 복사한다. 복사할 때 `publish:` 와 `sources:` 두 필드를 뺀다. **그 둘 말고 다른 필드는 양쪽이 같아야 한다.**

한쪽만 고치면 다음 개정 때 다른 쪽이 덮어써서 조용히 되돌아간다. 2026-08-24 에 `categories:` 57편이 이렇게 어긋나 있던 것을 발견해 맞췄다.

---

## 발행 전 검사

```bash
node tools/lint-site.mjs
```

다섯 가지를 본다.

| # | 검사 | 왜 |
| --- | --- | --- |
| 1 | 태그 슬러그 충돌 | Jekyll 이 대소문자를 접는다. `EtherCAT` 과 `ethercat` 이 한 페이지가 되면서 표기가 불안정해진다 |
| 2 | 위키링크 잔존 | 볼트에서 옮길 때 `[[...]]` 를 안 걷으면 깨진 글자로 나온다 |
| 3 | 내부 링크 실재 | CI 가 최종적으로 잡지만 push 전에 알면 왕복이 준다 |
| 4 | frontmatter | 필수 필드 누락, 그리고 볼트 전용 필드가 딸려 왔는지 |
| 5 | mermaid 플래그 | 플래그가 없으면 그림이 통째로 코드 블록으로 나온다 |

**이 스크립트는 금칙어 검사를 안 한다.** 그 목록은 이 저장소에 없고 있어서도 안 된다. 볼트 쪽에서 따로 돈다.

⚠️ 오탐이 나면 항목을 고친다. 경고가 잦으면 사람이 이 스크립트를 무시하게 되고, 그때 검사가 죽는다.

---

## 배포

`main` 에 push 하면 `.github/workflows/pages-deploy.yml` 이 돈다.

```
build → Test site (htmlproofer) → deploy
```

세 단계가 다 통과해야 발행이 끝난 것이다. `Test site` 가 내부 링크를 전수 검사하므로 여기서 떨어지면 링크 문제다.

```bash
gh run watch <run-id> --exit-status
```

Liquid 를 고쳤으면 **반드시 빌드를 지켜본다.** 로컬에 ruby 와 bundler 가 없으면 순회 문법이 실제로 도는지는 빌드에서만 확인된다.

---

## 구조

| 경로 | 무엇 |
| --- | --- |
| `_posts/<시리즈>/` | 글. 폴더는 사람이 찾기 쉬우라고 나눈 것이고 URL 에는 영향이 없다 |
| `_data/series.yml` | 시리즈 카드 정본 |
| `_tabs/` | 고정 페이지 (시리즈, 이력, 소개, 아카이브, 카테고리, 태그) |
| `_layouts/landing.html` | 홈. 시리즈 카드와 최근 글을 `series.yml` 에서 도출한다 |
| `tools/lint-site.mjs` | 발행 전 검사 |

`_posts/` 하위 폴더는 URL 에 영향을 주지 않는다. permalink 는 `/posts/<slug>/` 그대로이고, 사이트에서의 분류는 `categories:` 가 한다. 둘 다 맞춰야 의미가 있다.

---

테마 원본: [cotes2020/jekyll-theme-chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) (MIT)
