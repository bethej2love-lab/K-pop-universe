#!/usr/bin/env node
// 미니/정규 N집 번호 정리 — 발매순 위치로 빈 번호를 채운다(2026-09-04).
//
// group_disco_fill(나무위키 파싱)은 최근 앨범 번호를 못 채우는 한계가 있어(요청 0), 여기서는
// **위치 기반 추론 + 연속성 검증**으로 채운다: 그룹별로 미니/정규 계열(순정규/순미니만, 리패키지·
// 스페셜·PART 제외)을 발매일순 정렬 → 이미 번호가 있는 것들이 그 위치(1,2,3…)와 **전부 일치**하면
// (=중간에 빠짐/뒤섞임 없음) 안전하다고 보고 번호 없는 것만 그 위치 번호로 채운다. 하나라도
// 어긋나면 그 그룹-계열은 통째로 건너뛰고 리포트에 남긴다(사람이 나무위키로 확인).
//
// 사용법: node tools/disco_number_fill.mjs [--apply]
//   --apply 없으면 드라이런(무엇을 채울지/건너뛸지만 출력).
//   ⚠️ --apply 후 반드시 node tools/build_slim_data.mjs 로 파생물 재생성.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const APPLY = process.argv.includes('--apply');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let filled = 0, skipGroups = [], filledEg = [];
const FAMS = ['미니', '정규'];

for (const gk of Object.keys(G)) {
  const disco = G[gk].discography || [];
  for (const fam of FAMS) {
    const re = new RegExp('^' + fam + '\\s*(\\d+)집$'); // "미니 3집"(딱 그 형태만 — 리패키지·PART·스페셜 제외)
    const fam0 = disco.filter(d => d.type === fam || re.test(d.type || ''));
    if (fam0.length < 2) continue; // 1장뿐인 계열은 건드리지 않음
    // 발매일순
    const sorted = fam0.slice().sort((a, b) => String(a.releaseDate || '').localeCompare(String(b.releaseDate || '')));
    // 가드1: 같은 발매일이 둘 이상 = 중복등록/리패키지 의심(엔시티127 'Regular-Irregular' vs '…The 1st Album') → 건너뜀
    const dates = sorted.map(d => d.releaseDate || '');
    if (dates.some((d, i) => d && dates.indexOf(d) !== i)) { skipGroups.push(`${gk}/${fam}(같은날 중복)`); continue; }
    // 가드2: 앵커(이미 번호 있는 앨범)가 최소 1개 있어야 — 전부 번호 없으면 생짜 위치라 못 믿음
    const numbered = sorted.filter(d => re.test(d.type || ''));
    if (!numbered.length) { skipGroups.push(`${gk}/${fam}(앵커없음)`); continue; }
    // 연속성 검증: 이미 번호 있는 것이 위치와 일치하나
    let ok = true;
    const fills = [];
    sorted.forEach((d, i) => {
      const pos = i + 1;
      const m = (d.type || '').match(re);
      if (m) { if (Number(m[1]) !== pos) ok = false; }
      else fills.push({ d, pos });
    });
    if (!ok) { if (fills.length) skipGroups.push(`${gk}/${fam}(번호 불일치)`); continue; }
    if (!fills.length) continue;
    for (const f of fills) {
      if (filledEg.length < 20) filledEg.push(`${gk}: ${f.d.title} → ${fam} ${f.pos}집`);
      if (APPLY) f.d.type = `${fam} ${f.pos}집`;
      filled++;
    }
  }
}

console.log(`채울 수 있음: ${filled}장 (연속성 검증 통과)`);
console.log(`건너뜀(번호 어긋남 — 나무위키 확인 필요): ${skipGroups.length}건`);
if (skipGroups.length) console.log('  ' + skipGroups.slice(0, 30).join(' · '));
console.log('\n채움 예시:');
filledEg.forEach(e => console.log('  ' + e));

if (APPLY) {
  fs.writeFileSync(path.join(ROOT, 'groups.json'), JSON.stringify(G, null, 2) + '\n');
  console.log(`\n✅ groups.json 저장(${filled}장). 이제 node tools/build_slim_data.mjs 실행할 것.`);
} else {
  console.log('\n[dry] 저장 안 함. --apply 로 반영.');
}
