#!/usr/bin/env node
// 스포티파이 ↔ 레거시(출처 없음) 같은 발매 중복 정리 (2026-10-13)
//
// 배경: tests/disco-cross-source-dupes.test.js는 **멜론(src:'melon') 항목 기준**으로만 중복을 봤다.
//       그 전부터 있던 레거시 항목(나무위키·수동 입력, src 없음)은 한글 제목(`이름의 장: FREEFALL`)인데
//       스포티파이는 영문 제목(`The Name Chapter: FREEFALL`)으로 넣어 dedupKey가 달라 같은 발매가 두 장이 됐다.
//       게다가 스포티파이 쪽은 옛 타입 판정 버그로 '정규'가 붙은 게 많아 디스코가 이중으로 틀렸다
//       (실측 54쌍, 사용자 제보 계기: 클로즈유어아이즈 `256th Note` 정규 표기).
//
// 판정(테스트와 같은 규칙): 같은 주체 · 발매일 ±1일 · 트랙 제목이 하나 이상 겹침.
//   예외 — 둘 다 feat. 표기가 있고 피처링이 서로 다른 라틴 표기면 별개 버전(르세라핌 BOOMPALA).
// 처리: 스포티파이 항목을 지우고 spotifyId를 레거시 항목에 옮긴다(다음 수집이 spotifyId로 다시 안 넣게).
//       레거시에 없던 titleTrack·cover만 채운다. 레거시 타입은 건드리지 않는다 — 단, 트랙 3곡 이하인데
//       '정규'인 레거시는 '싱글'로 바로잡는다(제로베이스원 KAIKILOVE 3곡이 '정규'였다).
//
// 실행: node tools/disco_spotify_legacy_dedupe.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const readJson = f => { const raw = fs.readFileSync(path.join(ROOT, f), 'utf8'); const m = /\n( +)\S/.exec(raw); /* 둘째 줄 = 한 단계(배열 파일은 첫 키가 두 단계 안쪽) */ return { data: JSON.parse(raw), indent: m ? m[1].length : 2 }; };
const G = readJson('groups.json'), A = readJson('artists.json');

const ts = d => Date.parse(String(d || '').replace(/\./g, '-'));
const feat = s => { const m = /feat\.?\s*([^)\]]+)/i.exec(s || ''); return m ? m[1].trim().toLowerCase() : null; };
const latin = s => /^[\x20-\x7e]+$/.test(s);
const nt = s => String(s || '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^a-z0-9가-힣]/g, '');

const log = [];
function scan(owner, list) {
  if (!Array.isArray(list)) return;
  const drop = new Set();
  for (const s of list) {
    if (s.src !== 'spotify' || drop.has(s)) continue;
    const st = new Set((s.tracks || []).map(t => nt(t.title)).filter(Boolean));
    const partner = list.find(m => m !== s && !m.src && !drop.has(m)
      && Math.abs(ts(m.releaseDate) - ts(s.releaseDate)) <= 864e5
      && (m.tracks || []).some(t => st.has(nt(t.title)))
      && !(feat(m.title) && feat(s.title) && feat(m.title) !== feat(s.title) && latin(feat(m.title)) && latin(feat(s.title))));
    if (!partner) continue;
    const notes = [];
    if (!partner.spotifyId && s.spotifyId) { partner.spotifyId = s.spotifyId; notes.push('spotifyId 이전'); }
    if (!partner.titleTrack && s.titleTrack) {
      const hit = (partner.tracks || []).find(t => nt(t.title) === nt(s.titleTrack));
      if (hit) { partner.titleTrack = hit.title; for (const t of partner.tracks) t.isTitle = t === hit; notes.push(`타이틀곡 ${hit.title}`); }
    }
    if (!partner.cover && s.cover) { partner.cover = s.cover; notes.push('커버'); }
    const ptc = partner.trackCount || (partner.tracks || []).length;
    if (/^정규/.test(partner.type || '') && ptc && ptc <= 3) { notes.push(`레거시 타입 '${partner.type}'→'싱글'`); partner.type = '싱글'; }
    drop.add(s);
    log.push(`${owner} — [레거시 ${partner.type}] ${partner.title}  ←  [spotify ${s.type}] ${s.title} 삭제${notes.length ? ' · ' + notes.join(' · ') : ''}`);
  }
  if (APPLY && drop.size) for (let i = list.length - 1; i >= 0; i--) if (drop.has(list[i])) list.splice(i, 1);
}
for (const [k, g] of Object.entries(G.data)) scan(k, g.discography);
for (const a of A.data) {
  const o = `${a.name?.ko}|${a.group?.ko || ''}`;
  scan(o, a.discography);
  for (const u of a.unitDiscography || []) scan(o + '/unit', u?.albums);
}
console.log(`${APPLY ? '정리' : 'dry-run'} ${log.length}건\n` + log.join('\n'));
if (APPLY && log.length) {
  fs.writeFileSync(path.join(ROOT, 'groups.json'), JSON.stringify(G.data, null, G.indent) + '\n');
  fs.writeFileSync(path.join(ROOT, 'artists.json'), JSON.stringify(A.data, null, A.indent) + '\n');
}
