#!/usr/bin/env node
// 솔로 디스코 반영 (proposal.json → artists.json)
//
// 적용 규칙 (2026-08-24 사용자 결정: "미확정도 번호 없이 반영")
//   NO_NUM_NEEDED  : 싱글/OST — 그대로
//   NAMU_CONFIRMED : 나무위키 대조 확정 — 번호 포함 그대로
//   MELON_ONLY     : 멜론 앨범명에 번호가 박혀 있던 것 — 번호 포함 그대로
//   그 외(NO_SOURCE / REVIEW_WEAK / CONFLICT / REVIEW_JP / REVIEW_LABEL)
//                  : 번호를 떼고 "미니" / "정규" 로만 넣는다.
//                    (틀린 번호를 박느니 존재만 보존. 번호는 다음 라운드에서 확정)
//
// 안전장치: 기존 discography 가 있는 멤버는 절대 건드리지 않는다(덮어쓰기 금지).
// 사용법: node tools/melon_solo_apply.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit');
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');   // 기존 discography 를 덮어씀(링크 정정 후 재확정용)
const ONLY = (() => { const i = process.argv.indexOf('--members'); return i >= 0 && process.argv[i+1] ? new Set(process.argv[i+1].split(',')) : null; })();

const NUMBERED_OK = new Set(['NO_NUM_NEEDED', 'NAMU_CONFIRMED', 'MELON_ONLY']);

const proposals = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'proposal.json'), 'utf8'));
const P = path.join(ROOT, 'artists.json');
const artists = JSON.parse(fs.readFileSync(P, 'utf8'));

let added = 0, members = 0, stripped = 0, skipped = [];

for (const p of proposals) {
  if (ONLY && !ONLY.has(p.ko)) continue;
  const idx = artists.findIndex(a => a?.name?.ko === p.ko && a?.group?.ko === p.group);
  if (idx < 0) { skipped.push(`${p.ko}(${p.group}) — artists.json 에서 못 찾음`); continue; }
  const a = artists[idx];
  if (a.discography && a.discography.length && !FORCE) { skipped.push(`${p.ko}(${p.group}) — 이미 discography ${a.discography.length}장 보유(보존)`); continue; }

  const entries = [];
  for (const al of p.albums) {
    if (!al.entry && !al.baseKind) continue;
    const e = al.entry ? { ...al.entry } : null;
    if (!e) {
      // 번호 근거가 없어 entry 자체가 안 만들어진 것 — 번호 없는 타입으로 생성
      if (al.baseKind !== '미니' && al.baseKind !== '정규') continue;
      entries.push({
        title: al.title, type: al.baseKind, releaseDate: al.releaseDate,
        trackCount: al.trackCount, isMain: true, titleTrack: al.titleTrack,
        cover: al.cover, tracks: al.tracks,
      });
      stripped++;
      continue;
    }
    if (!NUMBERED_OK.has(al.confidence)) {
      const bare = e.type.replace(/\s*\d+집.*$/, '').trim();
      if (bare !== e.type) { e.type = bare; stripped++; }
    }
    entries.push(e);
  }
  if (!entries.length) { skipped.push(`${p.ko}(${p.group}) — 넣을 앨범 없음`); continue; }

  entries.sort((x, y) => (y.releaseDate || '').localeCompare(x.releaseDate || ''));
  a.discography = entries;   // 키 순서상 마지막 = 기존 데이터와 동일한 위치
  added += entries.length;
  members++;
}

console.log(`반영 대상 ${members}명 / ${added}장 (번호 제거 ${stripped}장)`);
if (skipped.length) { console.log(`건너뜀 ${skipped.length}건:`); skipped.forEach(s => console.log('   ' + s)); }

if (DRY) { console.log('\n[--dry] 저장 안 함'); process.exit(0); }

if (!fs.existsSync(P + '.bak-predisco')) fs.copyFileSync(P, P + '.bak-predisco');  // 최초 1회만 — 재실행이 원본 백업을 덮어쓰지 않게
fs.writeFileSync(P, JSON.stringify(artists, null, 2));
console.log(`\n저장 완료 (백업: artists.json.bak-predisco)`);
