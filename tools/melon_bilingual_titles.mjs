#!/usr/bin/env node
// 곡 한·영 제목 짝 맞추기(2026-11-12).
// 왜: 클로즈유어아이즈 ETERNALT가 스포티파이·애플 경로로 들어와 곡 제목이 전부 영어('All My Poetry')였다. 멜론(한국 활동명)은
// '내 안의 모든 시와 소설은'. 카드 곡 필터에 영어 제목만 있고, 한글 제목 직캠은 곡에 안 붙었다(사용자 제보).
// 규칙(docs/NAMING.md '곡의 정답 이름' = 한국 활동 곡명): 같은 곡 번호(songId = 멜론 곡 번호)인데 멜론 제목은 한글, 우리 제목은
// 한글 없음 → 정본 title을 멜론 제목으로, 원래 영어 제목은 곡의 en(영어 화면 표기)과 shared.js _SONG_ALIASES(검색·영상 연결)에 남긴다.
// 둘 다 한글이거나 둘 다 영문이면 손대지 않는다(같은 문자 체계 정정은 melon_track_refill의 공용 규칙 몫).
// 타이틀곡: 멜론이 타이틀 표시를 한 앨범이면 isTitle·titleTrack을 멜론 기준으로(ETERNALT는 'Close Your Eyes'가 타이틀로 잘못 찍혀 있었다).
// 캐시: ~/Downloads/melon_disco_audit/cache/album_<번호>.html(다른 멜론 수집기와 공유). --fetch면 멜론 커버가 아닌 앨범(스포티파이·애플 수집분)만 새로 받는다.
// 실행: node tools/melon_bilingual_titles.mjs [--fetch] [--apply]  → build_slim_data → validate → admin.js _SONG_RULES_VER 올리기(song_keys 재계산)
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
// --recent N: 발매 N일 안의 앨범만(주간 워크플로 itunes-en-titles.yml — 지난 앨범은 2026-11-12 전량 처리)
const RECENT = (() => { const i = process.argv.indexOf('--recent'); return i >= 0 ? Number(process.argv[i + 1]) : 0; })();
const isRecent = al => { if (!RECENT) return true; const m = String(al.releaseDate || '').match(/(\d{4})\D?(\d{1,2})\D?(\d{1,2})/); return !!m && (Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5 <= RECENT; };

const FETCH = process.argv.includes('--fetch');
const SLEEP = Number(process.env.MELON_SLEEP || 1200);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).trim();
const HAN = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
// 본 제목(괄호·피처링 바깥)에 한글이 있어야 한국어 제목 — 'Baby Bossa Nova (ft. 주혜린)'·'HOOK(훜) Inst.'는 영어 제목
const baseHan = t => HAN.test(String(t || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\b(ft|feat)\..*$/i, ' '));
const isInst = t => /\binst(\.|rumental)?(\b|$)|\bMR\b|instrumental/i.test(t || '');
let req = 0, hit = 0, blocked = 0;
async function detail(id, mayFetch) {
  const f = path.join(CACHE_DIR, `album_${id}.html`);
  if (fs.existsSync(f) && fs.statSync(f).size > 8000) { hit++; return fs.readFileSync(f, 'utf8'); }
  if (!FETCH || !mayFetch) return '';
  req++; await sleep(SLEEP);
  try {
    const tmp = f + '.tmp';
    await execFileP('curl', ['-skL', '--max-time', '40', '-A', UA, '-e', 'https://www.melon.com/', `https://www.melon.com/album/detail.htm?albumId=${id}`, '-o', tmp]);
    const s = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp);
    if (s.length < 8000) { blocked++; return ''; } // 차단은 HTTP 200 + 3.5KB
    fs.writeFileSync(f, s); return s;
  } catch { return ''; }
}
function rows(html) {
  const i = html.indexOf('d_song_list'); const t0 = i < 0 ? -1 : html.indexOf('<tbody>', i);
  const out = [];
  if (t0 < 0) return out;
  const body = html.slice(t0, html.indexOf('</tbody>', t0));
  body.split('<tr').slice(1).forEach(row => {
    const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] || (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
    const songId = (row.match(/data-song-no="(\d+)"/) || row.match(/goSongDetail\('(\d+)'\)/) || [])[1];
    if (t && songId) out.push({ title: dec(t), songId, isTitle: /bullet_icons title/.test(row) });
  });
  return out;
}

const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const st = { albums: 0, checked: 0, noCache: 0, retitled: 0, titleFix: 0 };
const log = [], aliases = {}; // owner → { 한글 제목: [영어 제목] }
async function fix(al, owner, who) {
  if (!al || typeof al !== 'object' || !al.melonAlbumId || !Array.isArray(al.tracks) || !al.tracks.length || !isRecent(al)) return;
  st.albums++;
  const melonCover = /cdnimg\.melon\.co\.kr/.test(al.cover || '');
  const tr = al.tracks.filter(t => t && typeof t === 'object');
  if (melonCover && !tr.some(t => t.songId && !HAN.test(t.title || ''))) return; // 멜론 수집분인데 영어 제목도 없으면 볼 것 없음
  const html = await detail(al.melonAlbumId, !melonCover);
  if (!html) { st.noCache++; return; }
  st.checked++;
  const R = rows(html), byId = new Map(R.map(r => [r.songId, r]));
  let changed = false;
  for (const t of tr) {
    const r = t.songId && byId.get(String(t.songId));
    if (!r) continue;
    if (baseHan(r.title) && !HAN.test(t.title || '') && (t.title || '').trim()) {
      const en = t.title.trim();
      log.push(`  ↺ ${who} | ${al.title} | ${en} → ${r.title}`);
      if (al.titleTrack === en) al.titleTrack = r.title;
      t.title = r.title; if (!t.en) t.en = en;
      ((aliases[owner] = aliases[owner] || {})[r.title] = aliases[owner][r.title] || []);
      if (!aliases[owner][r.title].includes(en)) aliases[owner][r.title].push(en);
      st.retitled++; changed = true;
    }
  }
  // 타이틀곡 — 멜론이 표시한 앨범만, 우리 표시와 다를 때
  const mt = new Set(R.filter(r => r.isTitle && !isInst(r.title)).map(r => r.songId));
  if (mt.size && !melonCover) { // 멜론 수집분은 이미 멜론 표시를 따랐다 — 다르면 사람이 고친 것(시대 스택 등)이라 건드리지 않는다
    const ours = tr.filter(t => t.isTitle).map(t => String(t.songId));
    const melonIds = tr.filter(t => mt.has(String(t.songId)));
    if (melonIds.length === mt.size && (ours.length !== mt.size || ours.some(id => !mt.has(id)))) {
      tr.forEach(t => { t.isTitle = mt.has(String(t.songId)); });
      al.titleTrack = melonIds[0].title;
      log.push(`  ★ ${who} | ${al.title} | 타이틀 → ${melonIds.map(t => t.title).join(', ')}`);
      st.titleFix++; changed = true;
    }
  }
  return changed;
}
for (const [ko, g] of Object.entries(groups)) for (const al of g.discography || []) await fix(al, ko, ko);
for (const a of artists) {
  const who = a.name.ko + '(' + (a.group && a.group.ko) + ')';
  for (const al of a.discography || []) await fix(al, a.name.ko, who);
  for (const u of a.unitDiscography || []) for (const al of u.albums || []) await fix(al, u.unitName || a.name.ko, who + '/' + u.unitName);
}
console.log(log.join('\n'));
console.log(`멜론 번호 있는 앨범 ${st.albums} · 확인 ${st.checked} · 상세 없음 ${st.noCache} · 한글 제목으로 ${st.retitled}곡 · 타이틀 정정 ${st.titleFix}장 · 요청 ${req} 캐시 ${hit} 차단 ${blocked}${APPLY ? ' · 저장함' : ' · 읽기 전용'}`);
fs.writeFileSync(path.join(CACHE_DIR, '..', 'bilingual_aliases.json'), JSON.stringify(aliases, null, 1));
if (APPLY && (st.retitled || st.titleFix)) {
  const keep = f => { const raw = fs.readFileSync(P(f), 'utf8'); return { ind: ((/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || '  ').length, crlf: /\r\n/.test(raw.slice(0, 200)) }; };
  for (const [f, obj] of [['groups.json', groups], ['artists.json', artists]]) {
    const k = keep(f); let s = JSON.stringify(obj, null, k.ind) + '\n'; if (k.crlf) s = s.replace(/\n/g, '\r\n');
    fs.writeFileSync(P(f), s);
  }
  // shared.js _SONG_ALIASES에 영어 제목 합치기 — 한 주인 한 줄, 가나다순(기존 줄 형식 그대로)
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
