#!/usr/bin/env node
// 발행 전 저장소 검사. 위반이 있으면 exit 1.
//
// 왜 있나:
//   같은 종류의 어긋남이 반복해서 생겼다. 고치는 건 쉬운데 생기는 것을 막는 장치가 없었다.
//   2026-08-24 에 태그 대소문자 충돌 12군을 고친 그날, 새로 쓴 글이 4군을 다시 만들었다.
//   그래서 검사를 저장소 안에 둔다.
//
// 쓰는 법:
//   node tools/lint-site.mjs
//
// 여기서 안 하는 것:
//   금칙어 검사 — 그 목록은 이 저장소에 없고 있어서도 안 된다. 볼트 쪽에서 돈다.
//   htmlproofer — CI 의 Test site 단계가 이미 한다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);

let bad = 0;
const fail = (m) => { console.log('  x ' + m); bad++; };
const ok = (m) => console.log('  o ' + m);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const files = walk('_posts').sort();
const docs = files.map((f) => ({
  file: f,
  name: path.basename(f),
  slug: path.basename(f, '.md').replace(/^\d{4}-\d{2}-\d{2}-/, ''),
  text: fs.readFileSync(f, 'utf8'),
}));
const slugs = new Set(docs.map((d) => d.slug));

console.log(`검사 대상: 포스트 ${docs.length}편\n`);

// ── 1. 태그 대소문자 충돌 ────────────────────────────────────
// Jekyll 은 태그를 슬러그로 접는다. EtherCAT 과 ethercat 이 같은 페이지가 되면서
// 어느 쪽 표기가 이기는지 불안정해진다.
console.log('[1] 태그 슬러그 충돌');
{
  const seen = new Map(); // 표기 -> 편수
  for (const d of docs) {
    const m = d.text.match(/^tags:\s*\[(.*)\]\s*$/m);
    if (!m) continue;
    for (const raw of m[1].split(',')) {
      const t = raw.trim();
      if (t) seen.set(t, (seen.get(t) || 0) + 1);
    }
  }
  const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
  const groups = new Map();
  for (const [t, n] of seen) {
    const k = slugOf(t);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([t, n]);
  }
  const collide = [...groups].filter(([, v]) => v.length > 1);
  if (collide.length === 0) ok(`고유 표기 ${seen.size}개, 충돌 0군`);
  else for (const [k, v] of collide) fail(`'${k}' 로 접히는 표기가 여럿: ${v.map(([t, n]) => `${t}(${n})`).join(' , ')}`);
}
console.log();

// ── 2. 위키링크 잔존 ─────────────────────────────────────────
// 볼트에서 옮길 때 [[...]] 를 안 걷으면 사이트에 깨진 글자로 나온다.
console.log('[2] 위키링크 잔존');
{
  const hit = docs.filter((d) => d.text.includes('[['));
  if (hit.length === 0) ok('0건');
  else hit.forEach((d) => fail(`위키링크 잔존: ${d.name}`));
}
console.log();

// ── 3. 내부 링크가 실재하는가 ────────────────────────────────
// CI 의 htmlproofer 가 최종적으로 잡지만 push 전에 알면 왕복이 준다.
console.log('[3] 내부 링크');
{
  let broken = 0, checked = 0;
  for (const d of docs) {
    // 외부 URL 을 먼저 지운다. blog.example.com/posts/... 를 내부 링크로 오인하지 않으려고.
    const body = d.text.replace(/https?:\/\/\S+/g, '');
    for (const m of body.matchAll(/\/posts\/([a-zA-Z0-9-]+)\//g)) {
      checked++;
      if (!slugs.has(m[1])) { fail(`깨진 링크: ${d.name} -> ${m[1]}`); broken++; }
    }
  }
  if (broken === 0) ok(`내부 링크 ${checked}개 전수, 깨진 것 0건`);
}
console.log();

// ── 4. frontmatter ───────────────────────────────────────────
console.log('[4] frontmatter');
{
  let miss = 0;
  for (const d of docs) {
    for (const k of ['title', 'date', 'categories']) {
      if (!new RegExp(`^${k}:`, 'm').test(d.text)) { fail(`${k} 없음: ${d.name}`); miss++; }
    }
    // 볼트 전용 필드가 딸려 오면 안 된다.
    for (const k of ['publish', 'sources']) {
      if (new RegExp(`^${k}:`, 'm').test(d.text)) { fail(`볼트 전용 필드 '${k}' 가 남았다: ${d.name}`); miss++; }
    }
  }
  if (miss === 0) ok(`${docs.length}편 전수, 누락과 잔존 0건`);
}
console.log();

// ── 5. mermaid 플래그 ────────────────────────────────────────
// 플래그가 없으면 그림이 통째로 코드 블록으로 나온다. 조용히 나빠지는 유형이다.
console.log('[5] mermaid 플래그');
{
  let n = 0, used = 0;
  for (const d of docs) {
    const has = /^```mermaid/m.test(d.text);
    if (has) used++;
    if (has && !/^mermaid: true/m.test(d.text)) { fail(`mermaid 블록이 있는데 'mermaid: true' 가 없다: ${d.name}`); n++; }
  }
  if (n === 0) ok(`mermaid 사용 ${used}편, 플래그 누락 0건`);
}
console.log();

// ── series.yml 읽기 ──────────────────────────────────────────
// yaml 의존성을 안 넣는다. 이 파일 구조가 단순해서(스칼라 + dirs 인라인 배열) 그걸로 충분하다.
// 구조가 복잡해지면 그때 의존성을 넣는다.
const cards = [];
{
  for (const line of fs.readFileSync('_data/series.yml', 'utf8').split(/\r?\n/)) {
    if (/^\s*#/.test(line) || !line.trim()) continue;
    const start = line.match(/^-\s+id:\s*(\S+)/);
    if (start) { cards.push({ id: start[1] }); continue; }
    const kv = line.match(/^\s+([a-z_]+):\s*(.*)$/);
    if (!kv || !cards.length) continue;
    const [, k, v] = kv;
    cards[cards.length - 1][k] = k === 'dirs'
      ? v.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean)
      : v.trim();
  }
}
const postsOf = (c) => docs.filter((d) => c.dirs.some((dir) => d.file.includes(`_posts${path.sep}${dir}${path.sep}`)));
const topCat = (d) => (d.text.match(/^categories:\s*\[(.*)\]\s*$/m)?.[1] || '').split(',')[0].trim();
const subCat = (d) => (d.text.match(/^categories:\s*\[(.*)\]\s*$/m)?.[1] || '').split(',')[1]?.trim() || '';
const titleOf = (d) => (d.text.match(/^title:\s*(.*)$/m)?.[1] || '').trim().replace(/^["']|["']$/g, '');

// ── 6. 시리즈 목차가 그 시리즈 글을 전부 가리키는가 ──────────
// 2026-08-07 에 index 가 없는 글을 가리켜 배포가 통째로 떨어졌고,
// 2026-08-25 에는 목차에서 빠진 글이 있었다. 둘을 한 검사로 본다.
// 🔴 판정 단위는 series.yml 의 index 다. index 가 없는 카드(업계 읽기, 쉬어가기)는
//    카테고리 페이지가 목차 역할을 하므로 원리적으로 전부 연결된다 — 대상이 아니다.
//    이렇게 두면 예외 목록이 필요 없다.
console.log('[6] 시리즈 목차 커버리지');
{
  let n = 0, checked = 0;
  for (const c of cards.filter((c) => c.index)) {
    const idxSlug = c.index.replace(/^\/posts\//, '').replace(/\/$/, '');
    const idxDoc = docs.find((d) => d.slug === idxSlug);
    if (!idxDoc) { fail(`카드 '${c.id}' 의 index 가 없는 글을 가리킨다: ${c.index}`); n++; continue; }
    const linked = new Set([...idxDoc.text.matchAll(/\/posts\/([a-zA-Z0-9-]+)\//g)].map((m) => m[1]));
    const missing = postsOf(c).filter((d) => d.slug !== idxSlug && !linked.has(d.slug));
    checked++;
    if (missing.length) { fail(`'${c.id}' 목차에 빠진 글 ${missing.length}편: ${missing.map((d) => d.slug).join(', ')}`); n++; }
  }
  if (n === 0) ok(`목차 글 ${checked}개 전수, 빠진 글 0건`);
}
console.log();

// ── 7. 소분류가 대분류 여럿에 걸치는가 ───────────────────────
// /categories/<소분류>/ 는 대분류를 안 가리므로 한 페이지에 섞인다.
// 2026-08-24 에 '기초' 가 통신 12 + Stateflow 6 으로 섞여 있던 것을 갈랐다.
console.log('[7] 소분류 충돌');
{
  // 🔴 '목차' 는 일부러 섞는다. 전 시리즈의 입구 모음으로 쓰고, _tabs/series.md 가 링크한다.
  //    편수 계산 Liquid 도 categories contains '목차' 로 00 글을 걸러내므로 이름을 바꾸면 그쪽이 깨진다.
  const ALLOW = new Set(['목차']);
  const map = new Map();
  for (const d of docs) {
    const s = subCat(d); if (!s || ALLOW.has(s)) continue;
    if (!map.has(s)) map.set(s, new Set());
    map.get(s).add(topCat(d));
  }
  const collide = [...map].filter(([, v]) => v.size > 1);
  if (collide.length === 0) ok(`소분류 ${map.size}개, 대분류를 넘나드는 것 0건 (예외: ${[...ALLOW].join(', ')})`);
  else for (const [s, v] of collide) fail(`소분류 '${s}' 가 대분류 ${v.size}개에 걸쳐 있다: ${[...v].join(' , ')}`);
}
console.log();

// ── 8. 이름이 네 곳에서 같은가 ───────────────────────────────
// series.yml name / _tabs/series.md 절 제목 / 00 목차 글 제목 / 실제 대분류.
// 2026-08-25 실측: sflayout 이 카드는 '레이아웃 자동화', 절 제목은 '레이아웃을 코드로 만들기' 였다.
console.log('[8] 시리즈 이름 일치');
{
  let n = 0;
  const tabs = fs.readFileSync('_tabs/series.md', 'utf8');
  const headings = new Set(
    [...tabs.matchAll(/^##\s+(.+?)\s+—\s+.*편\s*$/gm)]
      .map((m) => m[1].replace(/^[^\p{L}\p{N}]+/u, '').trim())
  );
  for (const c of cards) {
    if (!headings.has(c.name)) { fail(`'${c.name}' 절 제목이 _tabs/series.md 에 없다 (카드 ${c.id})`); n++; }
    if (c.top_category) {
      const wrong = postsOf(c).filter((d) => topCat(d) !== c.top_category);
      if (wrong.length) { fail(`'${c.id}' 의 top_category 는 '${c.top_category}' 인데 다른 대분류 ${wrong.length}편: ${wrong.slice(0, 3).map((d) => `${d.slug}(${topCat(d)})`).join(', ')}`); n++; }
    } else { fail(`카드 '${c.id}' 에 top_category 가 없다`); n++; }
    if (!c.resume_note) { fail(`카드 '${c.id}' 에 resume_note 가 없다 (이력서 표가 빈칸으로 나간다)`); n++; }
    if (c.index) {
      const idx = docs.find((d) => d.slug === c.index.replace(/^\/posts\//, '').replace(/\/$/, ''));
      if (idx) {
        const t = titleOf(idx);
        const m = t.match(/^00\.\s+(.*?)\s+—\s+시리즈 목차$/);
        // 카드 이름으로 시작하면 통과한다. adrc 의 '00. ADRC(외란 관측 기반 제어) — 시리즈 목차'
        // 처럼 괄호 부연이 붙는 것은 허용한다.
        if (!m || !m[1].startsWith(c.name)) { fail(`목차 글 제목이 규격과 다르다: ${idx.slug}\n      지금: ${t}\n      규격: 00. ${c.name} — 시리즈 목차`); n++; }
      }
    }
  }
  if (n === 0) ok(`카드 ${cards.length}장, 이름이 어긋난 곳 0건`);
}
console.log();

// ── 9. 제목 번호와 파일명 번호 ───────────────────────────────
// 🔴 양방향으로 본다. 한 방향만 보면 '파일명엔 번호, 제목엔 없음' 을 못 잡는다.
//    번호는 이어지는 글에만 붙인다. 안 이어지면 양쪽 다 없어야 한다 (2026-08-25 결정).
console.log('[9] 제목 번호 = 파일명 번호');
{
  let n = 0;
  for (const d of docs) {
    const f = d.name.match(/^\d{4}-\d{2}-\d{2}-(\d{2})-/)?.[1] ?? null;
    const t = titleOf(d).match(/^(\d{2})\.\s/)?.[1] ?? null;
    if (f === t) continue;
    if (f && !t) fail(`파일명엔 번호 ${f}, 제목엔 없다: ${d.name}`);
    else if (!f && t) fail(`제목엔 번호 ${t}, 파일명엔 없다: ${d.name}`);
    else fail(`번호가 다르다 (파일 ${f} / 제목 ${t}): ${d.name}`);
    n++;
  }
  if (n === 0) ok(`${docs.length}편 전수, 어긋난 것 0건`);
}
console.log();

// ── 10. 폴더 안 번호 연속성 ──────────────────────────────────
// 폴더 하나가 연재의 한 구간이다. 번호는 구간마다 01 부터 다시 시작하고,
// 그 안에서는 빠진 번호가 없어야 한다.
console.log('[10] 폴더 안 번호 연속성');
{
  let n = 0, checked = 0;
  const byDir = new Map();
  for (const d of docs) {
    const dir = path.basename(path.dirname(d.file));
    const num = d.name.match(/^\d{4}-\d{2}-\d{2}-(\d{2})-/)?.[1];
    if (num === undefined) continue;
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir).push(Number(num));
  }
  for (const [dir, nums] of byDir) {
    checked++;
    const set = new Set(nums);
    if (set.size !== nums.length) { fail(`${dir}/ 에 번호 중복이 있다`); n++; }
    const gaps = [];
    for (let i = Math.min(...nums); i <= Math.max(...nums); i++) if (!set.has(i)) gaps.push(String(i).padStart(2, '0'));
    if (gaps.length) { fail(`${dir}/ 에 빠진 번호: ${gaps.join(', ')}`); n++; }
  }
  if (n === 0) ok(`번호를 쓰는 폴더 ${checked}개, 중복과 결번 0건`);
}
console.log();

// ── 결과 ─────────────────────────────────────────────────────
if (bad === 0) {
  console.log(`통과. 검사 10종 / 포스트 ${docs.length}편 / 위반 0건`);
  process.exit(0);
}
console.log(`실패 ${bad}건. 위 줄을 하나씩 읽고 판정한다.`);
console.log('오탐이면 항목을 고친다. 경고가 잦으면 이 스크립트를 무시하게 되고 그때 검사가 죽는다.');
process.exit(1);
