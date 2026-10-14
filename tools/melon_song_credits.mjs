#!/usr/bin/env node
// 곡 전체 크레딧(작사·작곡·편곡) 멜론 수집 (2026-10-14)
//
// 왜: 지금은 아이돌 본인이 참여한 크레딧만 있다(artist_credits.json). 사용자: "곡 전체 크레딧이 궁금할 때가 많다". 크레딧은 사실
//     정보라 수집해도 된다(가사는 저작물이라 링크만 — tools/melon_link_backfill.mjs). 작곡가 → 그 사람의 다른 곡으로 이어지는 디깅의 바탕.
// 방법: 디스코 트랙의 songId(melon_link_backfill.mjs가 채움)마다 멜론 곡 상세의 '작사 / 작곡' 영역을 읽어
//     tracks[].cr = {l:[[이름,aid]], c:[...], a:[...]} (작사·작곡·편곡)로 넣는다. 멜론 aid로 동명이인 작곡가를 가른다.
// 4만 곡이 넘어 멜론 차단(수천 건마다)을 여러 번 거친다 — 300곡마다 저장하고, 다시 돌리면 이어서 한다(캐시+이미 채운 곡 건너뜀).
// 멜론 파싱·캐시·차단 대응은 melon_disco_audit.mjs 에서 가져왔다.
//
// 실행: node tools/melon_song_credits.mjs [--limit 2000] [--apply]   → 적용 후 node tools/build_slim_data.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
import { dedupKey, isVariant, detectRegion, parseTypeFromTitle } from './spotify_disco_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const OUT_DIR = path.join(os.homedir(), 'Downloads', 'melon_disco_audit');
const CACHE_DIR = path.join(OUT_DIR, 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SLEEP = Number(process.env.MELON_SLEEP || 150);
const argOf = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const APPLY = process.argv.includes('--apply');
const ONLY = argOf('--groups') ? new Set(argOf('--groups').split(',')) : null;
const REFRESH = process.argv.includes('--refresh');          // 캐시 무시하고 다시 받기
// ⚠️ 멜론은 연속 요청이 많으면 **IP 단위로 잠시 막는다**(2026-09-17 실측: 동시 4로 약 2,400요청 뒤
//    모든 페이지가 "페이지를 찾을 수 없습니다" 3.5KB로 돌아왔다 — HTTP 200이라 상태코드로는 안 잡힌다).
//    그때 이미 받아둔 캐시로만 재분류·적용하려고 쓰는 스위치다. 캐시에 없으면 그냥 건너뛴다.
const CACHE_ONLY = process.argv.includes('--cache-only');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let req = 0, hit = 0, blocked = 0, blockedStreak = 0, aborted = false;
// 연속 차단 응답이 이만큼이면 회차를 접는다(계속 두드리면 차단만 길어진다).
const BLOCK_ABORT = Number(process.env.MELON_BLOCK_ABORT || 8);

const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(new RegExp(String.fromCharCode(160), 'g'), ' ').trim(); // U+00A0(줄바꿈 없는 공백)도 일반 공백으로 — 'IM HIM'이 비교·삭제에서 안 맞았다(2026-10-12)

// ⚠️ 회사망에서는 node fetch 가 TLS 가로채기 때문에 전부 죽는다(메모리: 회사망 TLS).
//    curl -k 는 멀쩡하므로 수집은 curl 로 한다 — 환경 따라 갈리는 실패를 없앤다.
// ⚠️ 차단 페이지는 **HTTP 200에 3.5KB짜리 정상 HTML**로 온다. 길이만 보면 앨범 목록(minSize 1200)을
//    통과해서 "앨범 0장"으로 캐시에 굳고, 그러면 그 그룹은 조용히 통째로 누락된다. 내용으로 잡아야 한다.
const isBlocked = h => /페이지를 찾을 수 없습니다|잘못된 경로로 접근/.test(h || '');

async function get(url, key, minSize = 1500) {
  const f = path.join(CACHE_DIR, key + '.html');
  if (!REFRESH && fs.existsSync(f)) {
    const b = fs.readFileSync(f, 'utf8');
    if (b.length >= minSize && !isBlocked(b)) { hit++; return b; }
  }
  if (CACHE_ONLY || aborted) return '';
  for (let i = 1; i <= 3; i++) {
    try {
      req++;
      await execFileP('curl', ['-skL', '--max-time', '40', '-A', UA, '-e', 'https://www.melon.com/', encodeURI(url), '-o', f]);
    } catch { /* 재시도 */ }
    const b = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (isBlocked(b)) {
      blocked++; blockedStreak++;
      try { fs.unlinkSync(f); } catch {}
      // ⚠️ 막힌 뒤에도 계속 두드리면 차단만 길어지고, 그 사이 대상들은 "앨범 0장"으로 지나가
      //    **누락이 아니라 정상**처럼 리포트에 찍힌다. 연속으로 막히면 그 회차를 접는다.
      if (blockedStreak >= BLOCK_ABORT) { aborted = true; return ''; }
      await sleep(3000 * i);
      continue;
    }
    blockedStreak = 0;
    if (b.length >= minSize) return b;
    if (i < 3) await sleep(800 * i);
  }
  return '';
}

// 아주 작은 동시 실행 풀. 앨범 상세는 **후보 수만큼** 받아야 해서 순차로는 268팀에 1.8시간이 걸린다
// (실측). 동시 CONC 개면 그만큼 줄어든다.
// ⚠️ 기본값을 4→2로 낮췄다(2026-09-17). 동시 4 · 무지연으로 2,400요청을 쏘고 나니 멜론이
//    `albumPaging.htm`·`album/detail.htm` **두 엔드포인트만** 골라 막았다(아티스트 앨범 페이지와
//    홈은 계속 정상이라 "IP 전면 차단"이 아니라 그 API에 대한 속도 제한으로 보인다).
//    한 바퀴가 좀 느려지는 것보다 벽에 부딪혀 그날을 통째로 날리는 게 훨씬 비싸다.
const CONC = Number(process.env.MELON_CONC || 2);
async function pool(items, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(CONC, items.length || 1) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

/* ------------------------------ 멜론 파싱 ------------------------------ */

function parseArtistSearch(html) {
  const out = [];
  const re = /melon\.link\.goArtistDetail\('(\d+)'\);"\s*title="([^"]*?) - 페이지 이동"\s*class="ellipsis">([\s\S]*?)<\/a>[\s\S]{0,400}?<dd class="gubun">\s*([^<]*?)\s*<\/dd>/g;
  let m;
  while ((m = re.exec(html))) {
    out.push({ aid: m[1], title: dec(m[2]), gubun: dec(m[4]) });
  }
  return out;
}

function parseAlbumRows(html) {
  const rows = html.split('album11_li').slice(1);
  const out = [];
  for (const r of rows) {
    const albumId = (r.match(/goAlbumDetail\('(\d+)'\)/) || [])[1];
    if (!albumId) continue;
    out.push({
      albumId,
      title: dec((r.match(/class="ellipsis" title="([\s\S]*?) - 페이지 이동">/) || [])[1]),
      artistAid: (r.match(/goArtistDetail\('(\d+)'\);" title="[^"]*" class="play_artist"/) || [])[1] || null,
      melonType: (r.match(/class="vdo_name">\[([^\]]*)\]/) || [])[1] || '',
      date: (r.match(/class="cnt_view">([\d.]+)</) || [])[1] || '',
      trackCount: Number((r.match(/class="tot_song">(\d+)곡/) || [])[1] || 0),
      // ⚠️ 구형 앨범은 /cm/album/, 신형은 /cm2/album/ 이고 뒤에 "?" 가 없는 경우도 있다(커버 886장 누락 원인)
      cover: (r.match(/src="(https:\/\/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/[^"]+?)(?:\?|\/melon\/)/) || [])[1] || '',
    });
  }
  return out;
}

// ⚠️ startIndex 는 페이지 번호가 아니라 **행 인덱스(1-base)** 다(melon_solo_fill.mjs 에서 한 번 틀렸던 자리).
const PAGE = 100;
async function albumsOf(aid) {
  const all = [], seen = new Set();
  for (let s = 1; s <= 3000; s += PAGE) {
    const html = await get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${s}&pageSize=${PAGE}&orderBy=ISSUE_DATE&artistId=${aid}`, `alb_${aid}_${s}`, 1200);
    if (!html) break;
    const rows = parseAlbumRows(html);
    const fresh = rows.filter(r => !seen.has(r.albumId));
    fresh.forEach(r => seen.add(r.albumId));
    all.push(...fresh);
    if (rows.length < PAGE || !fresh.length) break;
  }
  return all;
}

function parseAlbumDetail(html) {
  const nameBlk = (html.match(/<div class="song_name">[\s\S]{0,400}?<\/div>/) || [''])[0];
  const albumName = dec(nameBlk.replace(/<[^>]*>/g, ' ').replace(/앨범명/, '').replace(/\s+/g, ' '));
  const rel = (html.match(/발매일[\s\S]{0,120}?(\d{4}\.\d{2}\.\d{2})/) || [])[1] || '';
  // ⚠️ 일본·중국 발매를 가려내는 **가장 정확한 신호**(2026-09-17 실측). 제목만 보는 detectRegion 은
  //    `Bloom`·`SAPPY`·`#Cookie Jar`처럼 영문 제목인 일본 발매를 못 잡는다(레드벨벳 실측 4장).
  //    멜론 상세의 장르 필드는 이런 발매에 예외 없이 `J-POP`이 찍혀 있다.
  const genre = dec(((html.match(/<dt>장르<\/dt>\s*<dd>([\s\S]{0,120}?)<\/dd>/) || [])[1] || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
  const agency = dec(((html.match(/<dt>기획사<\/dt>\s*<dd>([\s\S]{0,160}?)<\/dd>/) || [])[1] || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
  const tbodyIdx = html.indexOf('<tbody>', html.indexOf('d_song_list'));
  const tracks = [];
  if (tbodyIdx > 0) {
    const body = html.slice(tbodyIdx, html.indexOf('</tbody>', tbodyIdx));
    body.split('<tr').slice(1).forEach((row, i) => {
      const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] || (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
      if (!t) return;
      const no = Number((row.match(/<span class="rank\s*">(\d+)<\/span>/) || [])[1] || 0) || i + 1;
      tracks.push({ no, title: dec(t), isTitle: /bullet_icons title/.test(row) });
    });
  }
  return { albumName, releaseDate: rel, genre, agency, tracks };
}

// 멜론 장르 → 발매 지역. 장르가 비면 null(= 판정 못 함)이지 '국내'가 아니다 — 빈 값을 국내로 읽으면
// 상세 수집이 실패한 앨범이 전부 국내반으로 들어간다.
const regionFromGenre = genre => {
  if (!genre) return null;
  if (/J-?POP|재즈보컬\s*\/\s*J-?POP/i.test(genre)) return 'jp';
  if (/C-?POP|중국/i.test(genre)) return 'cn';
  return null;
};


function parseArtistDetail(html) {
  const between = (a, b) => { const i = html.indexOf(a); if (i < 0) return ''; const j = html.indexOf(b, i + a.length); return html.slice(i, j < 0 ? i + 30000 : j); };
  const memBlk = between('<!-- 그룹멤버 시작-->', '<!-- //그룹멤버 종료 -->');
  const members = [];
  for (const m of memBlk.matchAll(/goArtistDetail\('(\d+)'\);" title="([^"]*)" class="ellipsis"/g)) members.push({ aid: m[1], title: dec(m[2]) });
  const grpBlk = between('<dt>소속그룹</dt>', '</dd>');
  const groupAids = [...grpBlk.matchAll(/goArtistDetail\('(\d+)'\)/g)].map(m => m[1]);
  const bday = (html.match(/<dt>생일<\/dt>\s*<dd>\s*(\d{4}\.\d{2}\.\d{2})\s*<\/dd>/) || [])[1] || null;
  return { members, groupAids, bday };
}
async function detailOf(aid) {
  return parseArtistDetail(await get(`https://www.melon.com/artist/detail.htm?artistId=${aid}`, `adetail_${aid}`, 5000));
}

const preStrip = s => String(s || '')
  .replace(/\s*[-–—]\s*(SM\s+)?STATION.*$/i, '')
  .replace(/\s*[-–—]\s*WINTER\s+GARDEN.*$/i, '')
  .replace(/\s*[-–—]\s*(the\s+)?(\d+(?:st|nd|rd|th)|first)?\s*(summer|winter|spring|christmas|special)?\s*(mini\s+|single\s+)?album(\s+repackage)?\s*$/i, '')
  .replace(/^the\s+\d+(?:st|nd|rd|th)\s+(mini\s+)?(album|single)\s*['‘"]?(.+?)['’"]?$/i, '$3')
  .trim();
const mkey = s => dedupKey(preStrip(s));

// 저장할 제목. **대조용 preStrip 과 다르다** — `- SM STATION`, `- WINTER GARDEN` 같은 건 발매 브랜드라
// 정보이므로 남기고, 종류 배지와 중복되는 `- The 4th Mini Album` 류만 턴다(2026-09-16에 `- EP`/
// `- Single` 꼬리표 292건을 턴 것과 같은 취지).
const cleanTitle = s => String(s || '')
  .replace(/\s*[-–—]\s*(the\s+)?(\d+(?:st|nd|rd|th)|first)?\s*(summer|winter|spring|christmas|special)?\s*(mini\s+|single\s+)?album(\s+repackage)?\s*$/i, '')
  .replace(/^the\s+\d+(?:st|nd|rd|th)\s+(mini\s+)?(album|single)\s*['‘"](.+?)['’"]\s*$/i, '$3')
  .trim() || String(s || '').trim();

// 멜론의 [ ] 종류표기 → 우리 스키마 type.
// ⚠️ 번호(정규 N집·미니 N집)는 **제목 꼬리에 근거가 있을 때만** 붙인다. 근거 없이 번호를 박으면
//    나중에 사람이 고치기가 더 어렵다(spotify_disco_lib.parseTypeFromTitle 주석과 같은 원칙).
function typeOf(melonType, trackCount, title) {
  const t = (melonType || '').trim();
  const ti = String(title || '');
  // ⚠️ 멜론의 [ ] 표기를 그대로 믿으면 안 된다(2026-09-17 표본 확인). 드라마 OST가 `[싱글]`로,
  //    리패키지·스페셜·공연 DVD가 `[정규]`로 태그돼 있다. **제목이 말하는 쪽이 더 정확하다.**
  if (/OST/i.test(t) || /\bOST\b/i.test(ti)) return 'OST';
  if (/리패키지/.test(t) || /\brepackage\b/i.test(ti)) return '리패키지';
  if (/베스트|컴필|Compilation/i.test(t) || /\bbest\s+(album|collection)\b/i.test(ti)) return '컴필레이션';
  // 공연 실황·DVD/블루레이는 앨범이 아니다 — 부가로 둔다(`CNBLUE COME TOGETHER TOUR DVD` 21곡 사례)
  if (/라이브|Live/i.test(t) || /\b(dvd|blu-?ray)\b/i.test(ti) || /\b(tour|concert)\b.*\b(dvd|live)\b/i.test(ti)) return '라이브';
  if (/\bspecial\s+album\b/i.test(ti)) return '스페셜';
  // 제목이 집 번호를 직접 말하면 그게 가장 정확하다(`The Velvet - The 2nd Mini Album` → 미니 2집)
  const fromTitle = parseTypeFromTitle(ti, trackCount, null);
  if (/^(정규|미니)\s*\d+집$/.test(fromTitle)) return fromTitle;
  if (/싱글|Single/i.test(t)) return '싱글';
  if (/^EP$|미니/i.test(t)) return '미니';
  if (/정규|Studio|Album/i.test(t)) return '정규';
  return (trackCount || 0) <= 3 ? '싱글' : (trackCount >= 7 ? '정규' : '미니');
}

const NUMBERED = t => /^(정규|미니)\s*\d+집$/.test(t);

/* --------------------------------- main --------------------------------- */
/* ============================ 곡 전체 크레딧 ============================ */
// 곡 상세의 '작사 / 작곡' 영역 → [{n:이름, aid, t:'l'|'c'|'a'}]
function parseSongCredits(html) {
  const i = html.indexOf('section_prdcr'); if (i < 0) return null;
  const end = html.indexOf('</ul>', i); const blk = html.slice(i, end < 0 ? i + 20000 : end);
  const out = [];
  for (const li of blk.split('<li').slice(1)) {
    const aid = (li.match(/goArtistDetail\((\d+)\)/) || [])[1] || null;
    const n = dec((li.match(/class="artist_name"[^>]*>([^<]*)</) || [])[1] || '');
    const ty = dec((li.match(/<span class="type">([^<]*)</) || [])[1] || '');
    const t = /작사/.test(ty) ? 'l' : /작곡/.test(ty) ? 'c' : /편곡/.test(ty) ? 'a' : null;
    if (n && t) out.push({ n, aid, t });
  }
  return out;
}
const GROUPS = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const keep = f => { const raw = fs.readFileSync(P(f), 'utf8'); return (/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || 2; };
const save = () => {
  fs.writeFileSync(P('groups.json'), JSON.stringify(GROUPS, null, keep('groups.json')) + '\n');
  fs.writeFileSync(P('artists.json'), JSON.stringify(artists, null, keep('artists.json')) + '\n');
};
// 같은 songId가 여러 앨범(그룹·멤버·유닛 디스코에 같은 앨범)에 있으니 곡 번호 → 트랙 객체들로 모은다
const bySong = new Map();
const addAlbum = al => (al.tracks || []).forEach(t => { if (t.songId) { if (!bySong.has(t.songId)) bySong.set(t.songId, []); bySong.get(t.songId).push(t); } });
Object.values(GROUPS).forEach(g => (g.discography || []).forEach(addAlbum));
artists.forEach(a => { (a.discography || []).forEach(addAlbum); (a.unitDiscography || []).forEach(u => (u.albums || []).forEach(addAlbum)); });
const todo = [...bySong.entries()].filter(([, ts]) => !ts[0].cr);
const LIMIT = Number(argOf('--limit') || 0) || todo.length;
console.log(`[song-credits] 곡 ${bySong.size} · 남은 ${todo.length} · 이번 회차 최대 ${LIMIT}`);
let done = 0, empty = 0, sinceSave = 0;
for (const [sid, ts] of todo.slice(0, LIMIT)) {
  const html = await get(`https://www.melon.com/song/detail.htm?songId=${sid}`, `song_${sid}`, 8000);
  if (aborted) break;
  if (!html) continue;
  const cr = parseSongCredits(html);
  if (!cr) { empty++; continue; }
  // 저장 형태: {l:[[이름,aid]], c:[...], a:[...]} — 짧게(디스코 파일에 실린다)
  const o = {};
  for (const x of cr) (o[x.t] = o[x.t] || []).push(x.aid ? [x.n, x.aid] : [x.n]);
  for (const t of ts) t.cr = o;
  done++; sinceSave++;
  if (APPLY && sinceSave >= 300) { save(); sinceSave = 0; console.log(`  ...${done} 저장`); }
  if (SLEEP) await sleep(SLEEP);
}
if (APPLY && sinceSave) save();
console.log(`크레딧 ${done}곡${empty ? ` · 크레딧 영역 없음 ${empty}` : ''} · 요청 ${req} 캐시 ${hit} 차단 ${blocked}${aborted ? ' · ⚠️ 차단 중단' : ''}${APPLY ? ' · 저장함' : ' · 읽기 전용'}`);
