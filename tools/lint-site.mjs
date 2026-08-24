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

// ── 결과 ─────────────────────────────────────────────────────
if (bad === 0) {
  console.log(`통과. 검사 5종 / 포스트 ${docs.length}편 / 위반 0건`);
  process.exit(0);
}
console.log(`실패 ${bad}건. 위 줄을 하나씩 읽고 판정한다.`);
console.log('오탐이면 항목을 고친다. 경고가 잦으면 이 스크립트를 무시하게 되고 그때 검사가 죽는다.');
process.exit(1);
