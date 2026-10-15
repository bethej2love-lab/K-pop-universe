#!/usr/bin/env node
// 수록곡 보충 — 곡 목록이 비었거나 곡 수(trackCount)보다 짧은 앨범을 멜론 앨범 상세로 다시 채운다(2026-10-15).
//
// 왜: 엑소 데뷔 앨범 'Mama'를 눌렀더니 곡 정보가 아예 없었다(사용자 제보). 전수 조사하니 본 앨범 중 곡 목록이 빈 것 1장,
// 곡 수보다 짧은 것 65장(god 7집 6/14·S.E.S. 3집 8/27 등 1세대에 몰림) — 스포티파이·초기 수집이 일부만 담았던 것.
//  · 멜론 앨범 번호(melonAlbumId)가 없으면 커버 주소(cdnimg.melon.co.kr/…/<번호>_500.jpg)의 번호를 후보로 쓴다(Mama).
//  · **멜론 앨범명이 우리 제목과 맞을 때만** 채운다(번호가 틀린 앨범에 엉뚱한 곡이 들어가지 않게).
//  · 기존 곡의 songId·크레딧(cr)·제목 표기는 제목 대조로 그대로 유지하고, 멜론 쪽이 더 길 때만 바꾼다.
// 캐시: melon_disco_audit/cache/album_<번호>.html(다른 멜론 수집기와 공유, 기기별). 기본은 캐시만 — 없는 건 --fetch로 받는다.
// 실행: node tools/melon_track_refill.mjs [--fetch] [--apply]   (각 회차 뒤 build_slim_data → validate)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const CACHE_DIR = path.join(os.homedir(), 'Downloads', 'melon_disco_audit', 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const APPLY = process.argv.includes('--apply');
const FETCH = process.argv.includes('--fetch');
const SLEEP = Number(process.env.MELON_SLEEP || 1200);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).trim();
const tnorm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^0-9a-z가-힣]/g, '');
let req = 0, hit = 0, blocked = 0;
// ⚠️ 차단은 HTTP 200 + "페이지를 찾을 수 없습니다"(3.5KB) — 크기로 판정해 캐시에 넣지 않는다
async function detail(id) {
  const f = path.join(CACHE_DIR, `album_${id}.html`);
  if (fs.existsSync(f) && fs.statSync(f).size > 8000) { hit++; return fs.readFileSync(f, 'utf8'); }
  if (!FETCH) return '';
  req++; await sleep(SLEEP);
  try {
    const tmp = f + '.tmp';
    await execFileP('curl', ['-skL', '--max-time', '40', '-A', UA, '-e', 'https://www.melon.com/', `https://www.melon.com/album/detail.htm?albumId=${id}`, '-o', tmp]);
    const s = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp);
    if (s.length < 8000) { blocked++; return ''; }
    fs.writeFileSync(f, s); return s;
  } catch { return ''; }
}
function parse(html) {
  const nameBlk = (html.match(/<div class="song_name">[\s\S]{0,400}?<\/div>/) || [''])[0];
  const albumName = dec(nameBlk.replace(/<[^>]*>/g, ' ').replace(/앨범명/, '').replace(/\s+/g, ' '));
  const i = html.indexOf('d_song_list'); const t0 = i < 0 ? -1 : html.indexOf('<tbody>', i);
  const tracks = [];
  if (t0 > 0) {
    const body = html.slice(t0, html.indexOf('</tbody>', t0));
    body.split('<tr').slice(1).forEach((row, k) => {
      const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] || (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
      if (!t) return;
      const songId = (row.match(/data-song-no="(\d+)"/) || row.match(/goSongDetail\('(\d+)'\)/) || [])[1];
      const no = Number((row.match(/<span class="rank\s*">(\d+)<\/span>/) || [])[1] || 0) || k + 1;
      tracks.push({ no, title: dec(t), isTitle: /bullet_icons title/.test(row), ...(songId ? { songId } : {}) });
    });
  }
  return { albumName, tracks };
}
const coverId = al => ((al.cover || '').match(/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/\d+\/\d+\/\d+\/(\d+)_/) || [])[1];
// 앨범명 대조 — 통째 비교는 "Super Star - 4집" ↔ "4집 Super Star", "Remember - 20th…" ↔ "Remember - S.E.S. 20th…"를 못 맞춘다.
// 'N집'·'리패키지' 같은 꼬리표를 빼고 단어 단위로, 우리 제목 단어의 80% 이상이 멜론 제목에 있으면 같은 앨범으로 본다.
const words = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\d+(\.\d+)?\s*집|리패키지|디지털\s*앨범/g, ' ').split(/[^0-9a-z가-힣]+/).filter(w => w.length > 1 || /[가-힣]/.test(w));
const nameOk = (ours, melon) => {
  const a = tnorm(ours), b = tnorm(melon);
  if (a && b && (a === b || b.includes(a) || a.includes(b))) return true;
  const wa = words(ours), wb = new Set(words(melon));
  return wa.length > 0 && wa.filter(w => wb.has(w)).length / wa.length >= 0.8;
};

const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const st = { short: 0, filled: 0, noId: 0, noCache: 0, nameMiss: 0, notLonger: 0 };
const log = [];
async function fix(al, who) {
  if (!al || typeof al !== 'object') return;
  // 옛 데이터 일부는 곡이 문자열 목록 — 객체로 다뤄야 병합 때 글자가 키로 쪼개지지 않는다
  const cur = (Array.isArray(al.tracks) ? al.tracks : []).map((t, i) => typeof t === 'string' ? { no: i + 1, title: t } : t);
  if (cur.length && !(al.trackCount && cur.length < al.trackCount)) return;
  st.short++;
  const id = al.melonAlbumId || coverId(al);
  if (!id) { st.noId++; return; }
  const html = await detail(id);
  if (!html) { st.noCache++; return; }
  const d = parse(html);
  if (!nameOk(al.title, d.albumName)) { st.nameMiss++; log.push(`  ✗ 앨범명 불일치 ${who} | ${al.title} ≠ 멜론 ${d.albumName} (#${id})`); return; }
  if (d.tracks.length <= cur.length) { st.notLonger++; return; }
  const used = new Set();
  al.tracks = d.tracks.map(p => {
    const k = cur.findIndex((o, i) => !used.has(i) && ((o.songId && o.songId === p.songId) || tnorm(o.title) === tnorm(p.title)));
    const o = k >= 0 ? (used.add(k), cur[k]) : {};
    return { ...p, ...o, no: p.no, isTitle: !!(p.isTitle || o.isTitle), ...(p.songId || o.songId ? { songId: o.songId || p.songId } : {}) };
  });
  if (!al.melonAlbumId) al.melonAlbumId = String(id);
  if (!al.titleTrack) { const t = al.tracks.find(x => x.isTitle); if (t) al.titleTrack = t.title; }
  st.filled++;
  log.push(`  ✓ ${who} | ${al.title} ${cur.length}→${al.tracks.length}곡`);
}
for (const [ko, g] of Object.entries(groups)) for (const al of g.discography || []) await fix(al, ko);
for (const a of artists) {
  const who = a.name.ko + '(' + a.group.ko + ')';
  for (const al of a.discography || []) await fix(al, who);
  for (const u of a.unitDiscography || []) for (const al of u.albums || []) await fix(al, who + '/' + u.unitName);
}
console.log(log.join('\n'));
console.log(`곡 목록이 비었거나 짧은 앨범 ${st.short} · 채움 ${st.filled} · 멜론번호 없음 ${st.noId} · 상세 없음(캐시) ${st.noCache} · 앨범명 불일치 ${st.nameMiss} · 멜론도 안 김 ${st.notLonger} · 요청 ${req} 캐시 ${hit} 차단 ${blocked}${APPLY ? ' · 저장함' : ' · 읽기 전용'}`);
if (APPLY && st.filled) {
  const keep = f => { const raw = fs.readFileSync(P(f), 'utf8'); return ((/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || '  ').length; };
  fs.writeFileSync(P('groups.json'), JSON.stringify(groups, null, keep('groups.json')) + '\n');
  fs.writeFileSync(P('artists.json'), JSON.stringify(artists, null, keep('artists.json')) + '\n');
}
