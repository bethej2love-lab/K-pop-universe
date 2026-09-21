// 앨범 제목에 남은 "종류 꼬리표" 정리 (2026-09-21)
//
// 왜: 종류(미니/정규/싱글)는 카드에서 **배지로 따로** 표기하는데 제목에도 들어가 있으면 중복이고,
// 무엇보다 dedupKey가 달라져 같은 앨범이 두 번 들어오는 원인이 된다(2026-09-16 베이비복스 사례).
//
// 수집 단계(spotify_disco_lib.mjs의 stripSuffix)는 2026-09-16에 이미 고쳐졌고 그때 287건을 정리했다.
// 여기서 잡는 건 그 규칙이 못 보던 형태로, **옛 멜론 수집분에 남아 있던 것들**이다:
//   · `We Boom - The 3rd Mini Album`  (수집 단계 규칙엔 있지만 그 시절 데이터엔 적용된 적이 없음)
//   · `BigBang Is V.I.P (Single)`      (괄호형 — 수집 단계도 못 잡는다. 같이 추가해 뒀다)
//
// ⚠️ 제목이 같아지는 경우는 **건너뛴다**. 실측 2건이 전부 진짜 다른 앨범이었다:
//   · 오메가엑스 `Stand up! (single)` 싱글 1트랙(2022.07.01) vs `Stand up!` 미니 6트랙(2022.08.26)
//   · 보아 `Rock With You (Single)` 6트랙(2003.12.06) vs `Rock With You` 4트랙(2003.12.03)
//   꼬리표를 떼면 둘을 구분할 표시가 사라진다 — 합치는 건 사람이 판단할 일이다.
//
// 실행: node tools/disco_title_suffix_cleanup.mjs         (드라이런)
//       node tools/disco_title_suffix_cleanup.mjs --apply (groups.json·artists.json 수정)
//       ⚠️ --apply 뒤에는 반드시 `node tools/build_slim_data.mjs`로 파생물을 다시 만들 것
//          (tests/disco-artifacts.test.js가 어긋남을 잡는다).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

// 제목 **끝**에서만 뗀다. 중간에 있는 건 앨범명의 일부일 수 있다
// (엔하이픈 `Liminality - EP.DREAM`은 꼬리표가 아니라 시리즈 표기다 — 건드리면 안 된다).
const TAIL = [
  /\s*[-–—]\s*The\s+\d+(?:st|nd|rd|th)\s+(?:Mini|Full|Single|Studio)\s+Album\s*$/i,
  /\s*[-–—]\s*The\s+\d+(?:st|nd|rd|th)\s+Album\s*$/i,
  /\s*[-–—]\s*EP\s*$/i,
  /\s*\((?:Single|EP)\)\s*$/i,
];
const strip = t => { let s = String(t || ''); for (const re of TAIL) s = s.replace(re, ''); return s.trim(); };

const load = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const groups = load('groups.json');
const artists = load('artists.json');

let changed = 0, skipped = 0;
const rows = [], skips = [];

function sweep(disco, owner) {
  if (!Array.isArray(disco)) return;
  const titles = new Set(disco.map(a => String(a?.title || '')));
  for (const al of disco) {
    const from = String(al?.title || '');
    const to = strip(from);
    if (!to || to === from) continue;
    if (titles.has(to)) { skips.push({ owner, from, to }); skipped++; continue; }
    rows.push({ owner, from, to, type: al.type || '' });
    if (APPLY) { al.title = to; titles.delete(from); titles.add(to); }
    changed++;
  }
}

for (const [ko, g] of Object.entries(groups)) sweep(g?.discography, ko);
for (const a of artists) sweep(a?.discography, a?.name?.ko);

for (const r of rows) console.log(`  ${r.owner} [${r.type}]  ${r.from}  →  ${r.to}`);
if (skips.length) {
  console.log('\n건너뜀(떼면 같은 주인 안에서 제목이 겹침 — 진짜 다른 앨범이다):');
  for (const s of skips) console.log(`  ${s.owner}  ${s.from}  ≠  ${s.to}`);
}
console.log(`\n${APPLY ? '적용' : '드라이런'}: ${changed}건 정리 · ${skipped}건 건너뜀`);

// ⚠️ 원본 들여쓰기를 **보존해서** 쓴다 — groups.json은 2칸인데 artists.json은 **1칸**이라,
//    둘 다 `JSON.stringify(x, null, 2)`로 쓰면 artists.json 47만 줄이 통째로 리포맷된 diff가 된다
//    (실제로 이 스크립트 첫 실행에서 그렇게 나왔다). spotify_disco_sync.mjs가 같은 이유로 쓰는 방식.
function writeKeepingStyle(file, obj) {
  const p = path.join(ROOT, file);
  const raw = fs.readFileSync(p, 'utf8');
  const m = /^[[{]\r?\n([ \t]+)/.exec(raw);
  const indent = m ? m[1] : 2;
  fs.writeFileSync(p, JSON.stringify(obj, null, indent) + (raw.endsWith('\n') ? '\n' : ''));
}

if (APPLY) {
  writeKeepingStyle('groups.json', groups);
  writeKeepingStyle('artists.json', artists);
  console.log('groups.json · artists.json 저장 — 이제 node tools/build_slim_data.mjs 를 돌리세요.');
}
