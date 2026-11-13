#!/usr/bin/env node
// 같은 음반이 멜론(한국어)·스포티파이(영어) 두 레코드로 따로 들어간 것 합치기(2026-11-13 Codex 11-12 검수 '한영 중복').
// 왜: 신보 수집이 멜론·스포티파이 두 경로라, 같은 날 같은 곡 수 음반이 '오늘만 I LOVE YOU' / 'IF I SAY, I LOVE YOU'처럼
//     카드에 타일 두 개로 보였다(가영 16쌍·레이나·2AM·보이넥스트도어 등).
// 규칙(후보를 넓게 잡지 않는다):
//   · 같은 주인·같은 발매일·같은 곡 수, 한쪽은 src 'spotify'이고 다른 쪽은 멜론(번호·커버)
//   · 곡마다 번호 순으로 짝: Inst. 여부가 같아야 하고, 스포티파이 곡명엔 한글이 없어야(번역 표기)
//   · 멜론 앨범명에 한글이 있어야(둘 다 영어면 별개 영어판일 수 있어 건너뜀)
// 합칠 때: 멜론 레코드를 남기고 spotifyId를 옮기고, 곡 en이 비어 있으면 스포티파이 곡명을 en으로. 스포티파이 레코드는 지운다.
// 실행: node tools/album_merge_spotify_dupes.mjs [--owner=이름,…] [--apply]
import fs from 'node:fs';
const APPLY = process.argv.includes('--apply');
const ONLY = new Set(((process.argv.find(a => a.startsWith('--owner=')) || '').slice(8)).split(',').filter(Boolean));
const HAN = /[가-힣]/;
const INST = s => /\binst(\.|rumental)?\b|반주|MR\b/i.test(s || '');
const isSpot = a => a && a.src === 'spotify';
const isMelon = a => a && !isSpot(a) && (a.melonAlbumId || /melon\.co\.kr/.test(a.cover || ''));
const tt = t => typeof t === 'string' ? t.replace(/#\d+$/, '') : (t && t.title) || '';
const files = { g: 'groups.json', a: 'artists.json' };
const data = { g: JSON.parse(fs.readFileSync(files.g, 'utf8')), a: JSON.parse(fs.readFileSync(files.a, 'utf8')) };
const owners = [...Object.entries(data.g).map(([k, v]) => ['g', k, v]), ...data.a.map(a => ['a', a.name && a.name.ko, a])];
let n = 0;
for (const [kind, name, o] of owners) {
  if (ONLY.size && !ONLY.has(name)) continue;
  const d = o.discography; if (!Array.isArray(d)) continue;
  const drop = new Set();
  for (const s of d.filter(isSpot)) {
    const st = s.tracks || [];
    const m = d.filter(x => isMelon(x) && !drop.has(x) && x.releaseDate === s.releaseDate && (x.tracks || []).length === st.length && st.length > 0);
    if (m.length !== 1) continue;
    const mel = m[0], mt = mel.tracks;
    if (!HAN.test(mel.title)) continue;
    const ok = mt.every((t, i) => INST(tt(t)) === INST(tt(st[i])) && !HAN.test(tt(st[i])));
    if (!ok) continue;
    n++;
    console.log(`${kind}:${name} ${s.releaseDate} | ${mel.title} ⇐ ${s.title} | ${mt.map((t, i) => tt(t) + '=' + tt(st[i])).join('; ').slice(0, 160)}`);
    if (APPLY) {
      if (s.spotifyId && !mel.spotifyId) mel.spotifyId = s.spotifyId;
      mel.tracks = mt.map((t, i) => {
        if (typeof t !== 'object') return t;
        const e = tt(st[i]);
        return (!t.en && HAN.test(t.title) && e) ? { ...t, en: e } : t;
      });
      drop.add(s);
    }
  }
  if (drop.size) o.discography = d.filter(x => !drop.has(x));
}
console.log(`합칠 쌍 ${n}${APPLY ? ' · 저장' : ' · 읽기 전용'}`);
if (APPLY && n) for (const k of ['g', 'a']) {
  const raw = fs.readFileSync(files[k], 'utf8');
  const ind = ((/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || '  ').length;
  let s = JSON.stringify(data[k], null, ind) + '\n'; if (/\r\n/.test(raw.slice(0, 200))) s = s.replace(/\n/g, '\r\n');
  if (s !== raw) fs.writeFileSync(files[k], s);
}
