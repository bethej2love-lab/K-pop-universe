// 불변 ID 부여 (2026-09-02 신설)
//
// 왜: 이 프로젝트의 정체성이 전부 **한글 표시명 문자열**이다 — groups.json의 키가 그룹명이고,
// 즐겨찾기 키는 `group.ko + ':' + name.ko`, DB의 members는 text[], with_members는 "이름(그룹)".
// 그래서 개명 한 번에 SQL 마이그레이션이 필요하고(jamie_rename_migration.sql이 그 증거),
// 동명이인(실측 146종 325명)이 오태깅의 1순위 원인이 된다. 걸스데이 혜리↔장혜리 사고도 뿌리가 같다.
//
// 이 스크립트는 그 구조를 바꾸지 않는다. **미래 마이그레이션의 앵커만 미리 심는다** — 기존 키·
// 컬럼·코드는 하나도 건드리지 않고 `id` 필드만 더한다(additive). 나중에 이름 기반 참조를 id로
// 옮길 때 "그때의 이 사람"을 가리킬 수 있는 고정점이 있느냐 없느냐가 갈린다.
//
// ⚠️ id는 **의미 없는 순번**이다. 슬러그나 영문명을 쓰면 개명할 때 id도 같이 바뀌어서 존재 이유가
//    사라진다. 읽기 불편한 건 의도된 대가다.
// ⚠️ 이미 id가 있는 항목은 **절대 다시 매기지 않는다**. 한 번 부여된 id가 바뀌면 그 id를 참조하는
//    모든 것이 조용히 어긋난다 — 이 스크립트를 여러 번 돌려도 결과가 같아야 한다(멱등).
//
// 실행: node tools/assign_ids.mjs        (없는 항목에만 부여)
//       node tools/assign_ids.mjs --dry  (무엇이 부여될지만 출력)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
// 원본 포맷 유지 — 이 프로젝트의 json은 2칸 들여쓰기에 끝 개행이 없다(라운드트립 확인됨)
const wr = (f, o) => {
  let s = JSON.stringify(o, null, 2);
  if (s.endsWith('\n')) s = s.slice(0, -1);
  fs.writeFileSync(path.join(ROOT, f), s);
};

const groups = rd('groups.json');
const artists = rd('artists.json');

const num = (id, pfx) => {
  const m = new RegExp('^' + pfx + '(\\d+)$').exec(String(id || ''));
  return m ? parseInt(m[1], 10) : 0;
};
const pad = (n, w) => String(n).padStart(w, '0');

// ── 그룹 ──
let gMax = 0;
for (const k of Object.keys(groups)) gMax = Math.max(gMax, num(groups[k].id, 'g'));
const gNew = [];
for (const k of Object.keys(groups)) {
  if (groups[k].id) continue;
  const id = 'g' + pad(++gMax, 3);
  gNew.push(`${id}  ${k}`);
  if (!DRY) groups[k].id = id;
}

// ── 아티스트 ──
let aMax = 0;
for (const a of artists) aMax = Math.max(aMax, num(a.id, 'a'));
const aNew = [];
for (const a of artists) {
  if (a.id) continue;
  const id = 'a' + pad(++aMax, 4);
  aNew.push(`${id}  ${a.name?.ko} [${a.group?.ko}]`);
  if (!DRY) a.id = id;
}

// ── 무결성 ──
const gIds = Object.keys(groups).map(k => groups[k].id).filter(Boolean);
const aIds = artists.map(a => a.id).filter(Boolean);
const dupOf = arr => { const s = new Set(), d = new Set(); for (const x of arr) { if (s.has(x)) d.add(x); s.add(x); } return [...d]; };
const gDup = dupOf(gIds), aDup = dupOf(aIds);
if (gDup.length || aDup.length) {
  console.error('❌ 중복 id — 쓰지 않고 중단:', JSON.stringify({ groups: gDup, artists: aDup }));
  process.exit(1);
}
const gMissing = Object.keys(groups).filter(k => !groups[k].id).length;
const aMissing = artists.filter(a => !a.id).length;

if (!DRY && (gNew.length || aNew.length)) { wr('groups.json', groups); wr('artists.json', artists); }

console.log(`${DRY ? '[dry] ' : ''}그룹  신규 ${gNew.length} / 전체 ${gIds.length + (DRY ? gNew.length : 0)} · 누락 ${DRY ? gMissing - gNew.length : gMissing}`);
console.log(`${DRY ? '[dry] ' : ''}아티스트 신규 ${aNew.length} / 전체 ${aIds.length + (DRY ? aNew.length : 0)} · 누락 ${DRY ? aMissing - aNew.length : aMissing}`);
if (gNew.length) console.log('  그룹 예:', gNew.slice(0, 3).join(' · '), gNew.length > 3 ? `… 외 ${gNew.length - 3}` : '');
if (aNew.length) console.log('  아티스트 예:', aNew.slice(0, 3).join(' · '), aNew.length > 3 ? `… 외 ${aNew.length - 3}` : '');
