#!/usr/bin/env node
// 한글 곡의 공식 영문 제목 모으기 — 아이튠즈 미국 스토어(2026-11-12).
// 왜: 영어 화면엔 영문 제목을 보여야 한다(사용자 — '오늘만 I LOVE YOU' → 'IF I SAY, I LOVE YOU'). 멜론 디스코는 한글 정본만 있고,
// 스포티파이는 /artists/albums 100회에 24시간 잠겨 전수 수집이 안 된다. 아이튠즈 검색 API(무료·키 없음)의 미국 스토어 곡 이름이 공식 영문 제목이다.
// 맞추는 법(틀린 짝을 막는 게 우선):
//   · 주인(그룹 영문명·솔로 영문명)으로 앨범 검색 → 아티스트 이름이 정확히 같은 앨범만
//   · 우리 앨범 ↔ 아이튠즈 앨범: 발매일 ±3일 + 곡 수 같음. 후보가 여럿이면 버림
//   · 양쪽 다 영어인 곡이 있으면 그 제목이 같은 비율 ≥ 0.6이어야(앨범 짝 검증)
//   · 곡은 트랙 번호(1번 디스크)로. 우리 제목 본문(괄호·피처링 바깥)에 한글이 있고 아이튠즈 이름에 한글이 없을 때만 en
//   · 이미 en·영문 별칭이 있으면 건드리지 않는다
// 결과: 곡 객체 en + shared.js _SONG_ALIASES(검색·영상 연결). 캐시: ~/Downloads/melon_disco_audit/itunes/<키>.json
// 실행: node tools/itunes_en_titles.mjs [--fetch] [--apply] [--only 보이넥스트도어,아이브]  → build_slim_data → validate → _SONG_RULES_VER
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const CACHE = path.join(os.homedir(), 'Downloads', 'melon_disco_audit', 'itunes');
fs.mkdirSync(CACHE, { recursive: true });
const APPLY = process.argv.includes('--apply');
const FETCH = process.argv.includes('--fetch');
const argOf = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = argOf('--only') ? new Set(argOf('--only').split(',')) : null;
const SLEEP = Number(process.env.ITUNES_SLEEP || 3200); // 공개 API 분당 ~20회
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HAN = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
const baseHan = t => HAN.test(String(t || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\b(ft|feat)\..*$/i, ' '));
const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]|\bfeat\..*$|\bft\..*$/g, '').replace(/[^0-9a-z]/g, '');
const anorm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^0-9a-z가-힣]/g, '');
let req = 0, hit = 0, fail = 0;
async function getJson(key, url) {
  const f = path.join(CACHE, key.replace(/[^0-9A-Za-z가-힣_.-]/g, '_') + '.json');
  if (fs.existsSync(f)) { hit++; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { } }
  if (!FETCH) return null;
  for (let t = 0; t < 3; t++) {
    req++; await sleep(SLEEP * (t + 1));
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.status === 403 || r.status === 429) { await sleep(60000); continue; }
      if (!r.ok) continue;
      const j = await r.json(); fs.writeFileSync(f, JSON.stringify(j)); return j;
    } catch { }
  }
  fail++; return null;
}
const day = s => { const m = String(s || '').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };

const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(P('shared.js'), 'utf8') + ';this.A=_songAliasesFor;', ctx);
// 주인 목록: [소유자 키(별칭 표 주인), 검색 이름(영문), 앨범들]
const owners = [];
for (const [ko, g] of Object.entries(groups)) if (g.en && (g.discography || []).length) owners.push({ key: ko, en: g.en, albums: g.discography });
for (const a of artists) {
  const en = a.name && a.name.en; if (!en || !(a.discography || []).length) continue;
  owners.push({ key: a.name.ko, en, albums: a.discography, who: a.name.ko + '(' + (a.group && a.group.ko) + ')' });
}
const st = { owners: 0, albumsNeed: 0, matched: 0, ambiguous: 0, verifyFail: 0, en: 0 };
const log = [], aliases = {};
for (const o of owners) {
  if (ONLY && !ONLY.has(o.key)) continue;
  const need = o.albums.filter(al => (al.tracks || []).some(t => t && typeof t === 'object' && baseHan(t.title) && !t.en && !(ctx.A(o.key, t.title) || [])[0]));
  if (!need.length) continue;
  st.owners++; st.albumsNeed += need.length;
  const s = await getJson('s_' + o.en, `https://itunes.apple.com/search?term=${encodeURIComponent(o.en)}&entity=album&attribute=artistTerm&country=us&limit=200`);
  if (!s || !Array.isArray(s.results)) continue;
  const colls = s.results.filter(r => r.collectionType === 'Album' && anorm(r.artistName) === anorm(o.en));
  // 후보 앨범 짝(발매일 ±3·곡 수)
  const pairs = [];
  for (const al of need) {
    const d = day(al.releaseDate), n = (al.tracks || []).length;
    const c = colls.filter(r => d != null && Math.abs(day(r.releaseDate) - d) <= 3 && r.trackCount === n);
    if (c.length === 1) pairs.push([al, c[0]]); else if (c.length > 1) st.ambiguous++;
  }
  // 곡 목록 — 50개씩 묶어 조회
  const songsBy = new Map();
  for (let i = 0; i < pairs.length; i += 40) {
    const ids = pairs.slice(i, i + 40).map(p => p[1].collectionId);
    const j = await getJson('l_' + ids.join('_').slice(0, 120) + '_' + ids.length, `https://itunes.apple.com/lookup?id=${ids.join(',')}&entity=song&country=us&limit=200`);
    (j && j.results || []).filter(r => r.wrapperType === 'track').forEach(r => { const a = songsBy.get(r.collectionId) || []; a.push(r); songsBy.set(r.collectionId, a); });
  }
  for (const [al, c] of pairs) {
    // 라이브·콘서트 앨범은 스토어마다 트랙 순서·구성이 달라 번호 짝이 어긋난다(H.O.T. Forever 2001 Live — 앵콜곡에 다른 곡 이름)
    if (/\blive\b|concert|콘서트|라이브/i.test(al.title + ' ' + c.collectionName)) continue;
    const tr = (songsBy.get(c.collectionId) || []).filter(r => (r.discNumber || 1) === 1);
    if (!tr.length) continue;
    const byNo = new Map(tr.map(r => [r.trackNumber, r]));
    const ours = (al.tracks || []).filter(t => t && typeof t === 'object');
    // 앨범 짝 검증 — 양쪽 다 영어인 곡의 제목 일치율
    let both = 0, same = 0;
    ours.forEach((t, i) => { const r = byNo.get(t.no || i + 1); if (r && !HAN.test(t.title || '') && !HAN.test(r.trackName || '')) { both++; if (norm(t.title) === norm(r.trackName) || norm(t.title).includes(norm(r.trackName)) || norm(r.trackName).includes(norm(t.title))) same++; } });
    if (both && same / both < 0.6) { st.verifyFail++; log.push(`  ✗ 짝 검증 실패 ${o.who || o.key} | ${al.title} ↔ ${c.collectionName} (${same}/${both})`); continue; }
    st.matched++;
    ours.forEach((t, i) => {
      if (!baseHan(t.title) || t.en || (ctx.A(o.key, t.title) || [])[0]) return;
      const r = byNo.get(t.no || i + 1); if (!r) return;
      const en = String(r.trackName || '').trim();
      if (!en || HAN.test(en)) return;
      t.en = en; st.en++;
      log.push(`  + ${o.who || o.key} | ${al.title} | ${t.title} → ${en}`);
      const m = (aliases[o.key] = aliases[o.key] || {});
      (m[t.title] = m[t.title] || []).includes(en) || m[t.title].push(en);
    });
  }
}
console.log(log.join('\n'));
console.log(`대상 주인 ${st.owners} · 영문 필요 앨범 ${st.albumsNeed} · 짝 ${st.matched} · 후보 여럿 ${st.ambiguous} · 짝 검증 실패 ${st.verifyFail} · 영문 제목 ${st.en}곡 · 요청 ${req} 캐시 ${hit} 실패 ${fail}${APPLY ? ' · 저장함' : ' · 읽기 전용'}`);
if (APPLY && st.en) {
  const keep = f => { const raw = fs.readFileSync(P(f), 'utf8'); return { ind: ((/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || '  ').length, crlf: /\r\n/.test(raw.slice(0, 200)) }; };
  for (const [f, obj] of [['groups.json', groups], ['artists.json', artists]]) {
    const k = keep(f); let s = JSON.stringify(obj, null, k.ind) + '\n'; if (k.crlf) s = s.replace(/\n/g, '\r\n');
    fs.writeFileSync(P(f), s);
  }
  const sp = P('shared.js'); let src = fs.readFileSync(sp, 'utf8');
  const a0 = src.indexOf('const _SONG_ALIASES={'), b0 = src.indexOf('\n};', a0);
  const cur = Function('return ' + src.slice(a0 + 'const _SONG_ALIASES='.length, b0 + 2))();
  for (const [o, m] of Object.entries(aliases)) for (const [t, ens] of Object.entries(m)) {
    const c = ((cur[o] = cur[o] || {})[t] = cur[o][t] || []);
    ens.forEach(e => { if (!c.includes(e)) c.push(e); });
  }
  const nl = src.slice(a0, b0).includes('\r\n') ? '\r\n' : '\n';
  const body = Object.keys(cur).sort((x, y) => x.localeCompare(y, 'ko')).map(o => `  ${JSON.stringify(o)}:${JSON.stringify(cur[o])},`).join(nl);
  src = src.slice(0, a0) + 'const _SONG_ALIASES={' + nl + body + src.slice(b0);
  fs.writeFileSync(sp, src);
}
