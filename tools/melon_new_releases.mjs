// 멜론 최신 앨범 일일 수집 (2026-10-12, 사용자: "매일 전 그룹/멤버 신보 반영")
//
// ── 왜 필요한가 ───────────────────────────────────────────────────────────────
// 스포티파이 수집(spotify_disco_sync.mjs)은 호출 한도 때문에 547팀을 매일 다 못 본다(실측: 하루 확인 118팀,
// 7일+ 미확인 327팀) — 그래서 B·C등급 컴백을 3~4주 놓쳤다. 게다가 스포티파이 검색은 상위 10개만 보는데
// 동명 아티스트·솔로곡이 그 자리를 채워 본편이 안 보이는 경우가 있었다(TIOT '다섯시간의 조각들', BTS).
// 멜론 **최신 앨범 목록**은 국내 발매 전체를 발매일 순으로 한 번에 준다(하루 수백 장 = 수십 요청). 각 앨범에
// 참여 아티스트의 **멜론 아티스트 ID**가 붙어 있어 melon_artist_map.json(그룹·솔로 1,100여 명)과 **ID로**
// 맞춘다 — 이름 추측이 없으니 동명이인 오수집이 구조적으로 없다(솔로 27명 201장 오수집 사고의 재발 방지).
//
// ── 하는 일 ──────────────────────────────────────────────────────────────────
//  1) 최신 앨범 목록(국내 I + 해외 O)을 최근 DAYS일치까지 넘긴다
//  2) 참여 아티스트 ID가 우리 매핑에 있는 앨범만 고른다(blocked·low 매핑 제외)
//  3) 이미 있는 앨범(멜론 albumId 같음 · 같은 제목+발매일 · 같은 제목 ±7일)은 건너뛴다
//  4) 앨범 상세(트랙·타이틀곡·장르·발매일)를 받아 groups.json / artists.json 디스코에 넣는다
//     — 형식·타입 판정·변형판/일본반 태그는 melon_disco_audit.mjs와 같다(거기서 옮겨 온 함수, 바꾸면 둘 다)
// ⚠️ 원본(groups.json/artists.json)만 고친다. 파생물(disco/·slim·tracks_index)은 rebuild-disco-artifacts가 만든다.
// ⚠️ 이미 있는 앨범은 절대 덮어쓰지 않는다(사람이 고친 값 보호 — spotify 수집과 같은 원칙).
// ⚠️ 차단 응답은 HTTP 200 + 정상 HTML로 온다 — 내용으로 판정하고, 연속 차단이면 회차를 접는다.
//
// 실행: node tools/melon_new_releases.mjs [--dry] [--days 7] [--pages 40]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dedupKey, isVariant, detectRegion, parseTypeFromTitle } from './spotify_disco_lib.mjs';

const execFileP = promisify(execFile);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const argOf = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry');
const DAYS = Number(argOf('--days') || process.env.MELON_NEW_DAYS || 7);
const MAX_PAGES = Number(argOf('--pages') || 40);   // 한 지역당 페이지 상한(20장/페이지)
const PAGE = 20;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'melon-new-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── melon_disco_audit.mjs에서 옮겨 온 것 ──
const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(new RegExp(String.fromCharCode(160), 'g'), ' ').trim(); // U+00A0(줄바꿈 없는 공백)도 일반 공백으로 — 'IM HIM'이 비교·삭제에서 안 맞았다(2026-10-12)
const isBlocked = h => /페이지를 찾을 수 없습니다|잘못된 경로로 접근/.test(h || '');
const preStrip = s => String(s || '')
  .replace(/\s*[-–—]\s*(SM\s+)?STATION.*$/i, '')
  .replace(/\s*[-–—]\s*WINTER\s+GARDEN.*$/i, '')
  .replace(/\s*[-–—]\s*(the\s+)?(\d+(?:st|nd|rd|th)|first)?\s*(summer|winter|spring|christmas|special)?\s*(mini\s+|single\s+)?album(\s+repackage)?\s*$/i, '')
  .replace(/^the\s+\d+(?:st|nd|rd|th)\s+(mini\s+)?(album|single)\s*['‘"]?(.+?)['’"]?$/i, '$3')
  .trim();
const mkey = s => dedupKey(preStrip(s));
const cleanTitle = s => String(s || '')
  .replace(/\s*[-–—]\s*(the\s+)?(\d+(?:st|nd|rd|th)|first)?\s*(summer|winter|spring|christmas|special)?\s*(mini\s+|single\s+)?album(\s+repackage)?\s*$/i, '')
  .replace(/^the\s+\d+(?:st|nd|rd|th)\s+(mini\s+)?(album|single)\s*['‘"](.+?)['’"]\s*$/i, '$3')
  .trim() || String(s || '').trim();
const regionFromGenre = genre => {
  if (!genre) return null;
  if (/J-?POP|재즈보컬\s*\/\s*J-?POP/i.test(genre)) return 'jp';
  if (/C-?POP|중국/i.test(genre)) return 'cn';
  return null;
};
function typeOf(melonType, trackCount, title) {
  const t = (melonType || '').trim();
  const ti = String(title || '');
  if (/OST/i.test(t) || /\bOST\b/i.test(ti)) return 'OST';
  if (/리패키지/.test(t) || /\brepackage\b/i.test(ti)) return '리패키지';
  if (/베스트|컴필|Compilation/i.test(t) || /\bbest\s+(album|collection)\b/i.test(ti)) return '컴필레이션';
  if (/라이브|Live/i.test(t) || /\b(dvd|blu-?ray)\b/i.test(ti) || /\b(tour|concert)\b.*\b(dvd|live)\b/i.test(ti)) return '라이브';
  if (/\bspecial\s+album\b/i.test(ti)) return '스페셜';
  const fromTitle = parseTypeFromTitle(ti, trackCount, null);
  if (/^(정규|미니)\s*\d+집$/.test(fromTitle)) return fromTitle;
  if (/싱글|Single/i.test(t)) return '싱글';
  if (/^EP$|미니/i.test(t)) return '미니';
  if (/정규|Studio|Album/i.test(t)) return '정규';
  return (trackCount || 0) <= 3 ? '싱글' : (trackCount >= 7 ? '정규' : '미니');
}
function parseAlbumDetail(html) {
  const nameBlk = (html.match(/<div class="song_name">[\s\S]{0,400}?<\/div>/) || [''])[0];
  const albumName = dec(nameBlk.replace(/<[^>]*>/g, ' ').replace(/앨범명/, '').replace(/\s+/g, ' '));
  const rel = (html.match(/발매일[\s\S]{0,120}?(\d{4}\.\d{2}\.\d{2})/) || [])[1] || '';
  const genre = dec(((html.match(/<dt>장르<\/dt>\s*<dd>([\s\S]{0,120}?)<\/dd>/) || [])[1] || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');
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
  return { albumName, releaseDate: rel, genre, tracks };
}

// ── 요청 ──
let req = 0, blocked = 0, blockedStreak = 0, aborted = false;
async function get(url, minSize = 1500) {
  if (aborted) return '';
  const f = path.join(TMP, 'r' + (++req) + '.html');
  for (let i = 1; i <= 3; i++) {
    try { await execFileP('curl', ['-skL', '--max-time', '40', '-A', UA, '-e', 'https://www.melon.com/', url, '-o', f]); } catch { /* 재시도 */ }
    const b = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (isBlocked(b)) { blocked++; if (++blockedStreak >= 6) { aborted = true; return ''; } await sleep(3000 * i); continue; }
    blockedStreak = 0;
    if (b.length >= minSize) { await sleep(400); return b; }
    await sleep(800 * i);
  }
  return '';
}

// 최신 앨범 목록 한 줄 → {albumId, title, aids[], melonType, date, trackCount, cover}
function parseNewList(html) {
  const out = [];
  for (const li of html.split('<li>').slice(1)) {
    const albumId = (li.match(/goAlbumDetail\('(\d+)'\)/) || [])[1];
    if (!albumId) continue;
    const aids = [...new Set([...li.matchAll(/goArtistDetail\('(\d+)'\)/g)].map(m => m[1]))];
    // 앨범 아티스트 표기(aids와 같은 순서) — 참여 앨범의 byline(주인 이름)에 쓴다
    const names = [];
    for (const m of li.matchAll(/goArtistDetail\('(\d+)'\)[^>]*title="([^"]*?)(?: - 페이지 이동)?"/g)) if (!names.some(n => n.aid === m[1])) names.push({ aid: m[1], n: dec(m[2]) });
    out.push({
      albumId,
      names,
      title: dec((li.match(/class="ellipsis album_name" title="([\s\S]*?) - 페이지 이동"/) || [])[1]),
      aids,
      melonType: (li.match(/class="vdo_name">\[([^\]]*)\]/) || [])[1] || '',
      date: (li.match(/class="reg_date"[^>]*>([\d.]+)</) || [])[1] || '',
      trackCount: Number((li.match(/class="tot_song"[^>]*>(\d+)곡/) || [])[1] || 0),
      cover: (li.match(/src="(https:\/\/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/[^"]+?)(?:\?|\/melon\/)/) || [])[1] || '',
    });
  }
  return out;
}

// ── 대상: 멜론 aid → 우리 디스코 ──
const readJ = f => JSON.parse(fs.readFileSync(P(f), 'utf8'));
const groups = readJ('groups.json');
const artists = readJ('artists.json');
const map = readJ('melon_artist_map.json');
const byAid = new Map();
// low 매핑은 기본 제외 — 단 **그룹**이고 멜론 이름에 우리 그룹명(한글·영문)이 그대로 들어 있으면 쓴다. 신생 그룹은
// 우리 디스코와 겹치는 앨범이 1장뿐이라 low로 찍힌다(AND2BLE·QWER·Baby DONT Cry·NAZE 등 9팀, 2026-10-12).
// 솔로는 동명이인 위험(솔로 27명 201장 오수집 사고) 때문에 low를 끝까지 제외한다.
const nk = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const lowGroupOk = (k, v) => !k.startsWith('a:') && groups[k]
  && [k, groups[k].en, ...(groups[k].altNames || [])].filter(x => x && nk(x).length >= 2).some(x => nk(v.melonName).includes(nk(x)));
for (const [k, v] of Object.entries(map)) {
  if (!v || !v.aid || v.blocked || v.rejected || (v.confidence === 'low' && !lowGroupOk(k, v))) continue;
  let t = null;
  if (k.startsWith('a:')) {
    const [name, gko] = k.slice(2).split('|');
    const a = artists.find(x => x.name?.ko === name && (x.group?.ko === gko || (x.groups || []).some(g => g?.ko === gko)));
    if (a) t = { kind: 'solo', label: `${name}(${gko})`, obj: a, get disco() { return a.discography || []; }, file: 'artists.json' };
  } else if (groups[k]) {
    const g = groups[k];
    t = { kind: 'group', label: k, obj: g, get disco() { return g.discography || []; }, file: 'groups.json' };
  }
  if (t) byAid.set(String(v.aid), t);
}

// ── 참여 앨범(2026-10-22, 사용자: "크러쉬 신곡(Feat. 아이유)도 수집하면 좋겠다 — 디스코는 숨김, 소식엔 노출") ──
// 주인이 우리 쪽이 아닌 앨범이라 위 aid 대조에 안 걸린다. 멜론은 피처링 가수를 앨범·트랙 아티스트로 안 붙이고(삐그덕 상세 = Crush만)
// 제목에만 적는다. 그래서 ① 제목의 "(Feat./with …)" 이름으로 우리 후보를 고르고 ② 그 후보의 멜론 '참여'(listType=F) 탭 첫 페이지에
// 같은 앨범 ID가 있을 때만 확정한다 — 이름은 후보 고르기에만 쓰고 확정은 멜론 ID라 동명이인이 안 들어온다. 후보 1명 = 요청 1번.
// 넣을 땐 feat:true·isMain:false(디스코 기본 숨김 — '부가 앨범 포함'으로 펼침) + host(앨범 주인, 멜론 표기 순).
const FEAT_RE = /[(\[]\s*(?:feat\.?|ft\.?|with)\s+([^)\]]+)[)\]]/i;
const featRows = [];
const nameIdx = new Map(); // 정규화 이름 → aid[]
{
  const addN = (n, aid) => { const k = nk(n); if (k.length < 2) return; if (!nameIdx.has(k)) nameIdx.set(k, new Set()); nameIdx.get(k).add(aid); };
  for (const [aid, t] of byAid) {
    const mn = (map[Object.keys(map).find(k => String(map[k]?.aid) === aid)] || {}).melonName || '';
    addN(mn, aid); for (const p of mn.split(/[()]/)) addN(p, aid);
    if (t.kind === 'solo') { addN(t.obj.name?.ko, aid); addN(t.obj.name?.en, aid); }
    else { addN(t.label, aid); addN(t.obj.en, aid); }
  }
}
const featCache = new Map(); // aid → Set(albumId) — 참여 탭 첫 페이지
async function featAlbumsOf(aid) {
  if (featCache.has(aid)) return featCache.get(aid);
  const html = await get(`https://www.melon.com/artist/songPaging.htm?startIndex=1&pageSize=50&listType=F&orderBy=ISSUE_DATE&artistId=${aid}`, 1000);
  const s = new Set([...html.matchAll(/goAlbumDetail\('(\d+)'\)/g)].map(m => m[1]));
  featCache.set(aid, s); return s;
}

const today = new Date();
const cutoff = new Date(today.getTime() - DAYS * 86400000).toISOString().slice(0, 10).replace(/-/g, '.');
const found = [];
for (const area of ['I', 'O']) {   // I=국내, O=해외(일본반 등)
  for (let p = 0; p < MAX_PAGES && !aborted; p++) {
    const url = `https://www.melon.com/new/album/listPaging.htm?startIndex=${p * PAGE + 1}&pageSize=${PAGE}&areaFlg=${area}&orderBy=issueDate`;
    const html = await get(url, 3000);
    if (!html) break;
    const rows = parseNewList(html);
    if (!rows.length) break;
    for (const r of rows) {
      if (r.date && r.date < cutoff) continue;
      const ts = r.aids.map(a => byAid.get(a)).filter(Boolean);
      for (const t of ts) found.push({ ...r, t, collab: r.aids.length > 1 });
      if (!ts.length && FEAT_RE.test(r.title)) featRows.push(r);
    }
    if (rows.every(r => r.date && r.date < cutoff)) break; // 이 페이지 전부가 기간 밖 → 다음 지역
  }
}

// 참여 후보 확정 — 제목 이름 → 우리 aid 후보 → 그 사람 참여 탭에 이 앨범이 있으면
const featChecked = [];
for (const r of featRows) {
  if (aborted) break;
  const inner = (r.title.match(FEAT_RE) || [])[1] || '';
  const cands = new Set();
  for (const part of inner.split(/\s*(?:,|&|×|\/|\s+x\s+|\s+and\s+)\s*/i)) {
    const k = nk(part.replace(/\(.*?\)/g, ' ')); const k2 = nk(part);
    for (const kk of [k, k2, ...(part.match(/\(([^)]+)\)/g) || []).map(s => nk(s))]) for (const aid of nameIdx.get(kk) || []) cands.add(aid);
  }
  for (const aid of cands) {
    if (r.aids.includes(aid)) continue;
    const ok = (await featAlbumsOf(aid)).has(r.albumId);
    featChecked.push(`${r.title} → ${byAid.get(aid).label} ${ok ? '✓' : '✗(참여 탭에 없음)'}`);
    if (ok) found.push({ ...r, t: byAid.get(aid), collab: true, feat: true });
  }
}

// ── 이미 있는 앨범 제외 + 상세 받아 넣기 ──
const dateOf = s => Date.parse(String(s || '').replace(/\./g, '-'));
const touched = new Set();
const added = [], skipped = [], problems = [], filled = [];
for (const x of found) {
  const disco = x.t.disco;
  const k = mkey(x.title);
  const dup = disco.find(d => (d.melonAlbumId && String(d.melonAlbumId) === x.albumId)
    || (mkey(d.title) === k && (d.releaseDate === x.date || Math.abs(dateOf(d.releaseDate) - dateOf(x.date)) <= 7 * 86400000)));
  if (dup) { skipped.push(`${x.t.label} · ${x.title}`); continue; }
  const html = await get(`https://www.melon.com/album/detail.htm?albumId=${x.albumId}`, 5000);
  if (!html) { problems.push(`${x.t.label} · ${x.title} — 상세 못 받음(다음 회차 재시도)`); continue; }
  const d = parseAlbumDetail(html);
  const tracks = d.tracks;
  // 다른 경로(스포티파이)로 이미 들어온 같은 앨범 — 제목 표기가 달라 위 검사를 통과한다(영파씨 'GO해'=스포티파이
  // 'GO AHEAD', 키비츠 'A1ㄱ'='A1 GO'). 발매일 ±2일 안에 수록곡이 하나라도 겹치면 같은 앨범으로 본다.
  const GENERIC = new Set(['intro', 'outro', 'inst', 'instrumental', 'interlude']);
  const tk = new Set(tracks.map(t => dedupKey(t.title)).filter(k => k && k.length >= 2 && !GENERIC.has(k)));
  const rel = d.releaseDate || x.date;
  // 곡명까지 로마자로 바뀐 경우(스포티파이 'GO AHEAD' 1곡 = 멜론 'GO해' 1곡)는 수록곡 비교도 안 겹친다 →
  // 스포티파이 출처 항목이 발매일 ±1일·같은 수록곡 수면 같은 앨범으로 본다(같은 날 같은 곡 수 다른 앨범은 드묾).
  const same = disco.find(dd => Math.abs(dateOf(dd.releaseDate) - dateOf(rel)) <= 2 * 86400000
    && (dd.tracks || []).some(t => tk.has(dedupKey(t.title))))
    || disco.find(dd => dd.src === 'spotify' && Math.abs(dateOf(dd.releaseDate) - dateOf(rel)) <= 86400000
      && (dd.trackCount || (dd.tracks || []).length) === (tracks.length || x.trackCount));
  if (same) {
    // 스포티파이엔 타이틀곡 표시가 없어 그 경로로 들어온 앨범은 타이틀곡이 비어 있다(키비츠 'Mixtape : A1 GO').
    // 멜론 상세의 타이틀 표시로 **비어 있을 때만** 채운다 — 사람이 넣은 값은 건드리지 않는다.
    const mt = tracks.filter(t => t.isTitle);
    if (!same.titleTrack && mt.length && !DRY) {
      const idx = new Map((same.tracks || []).map((t, i) => [dedupKey(t.title), i]));
      // 곡명이 우리 쪽과 맞으면 우리 표기를, 안 맞으면(로마자/한글 차이) 같은 트랙 번호의 우리 곡명을 쓴다
      const ours = mt.map(t => (same.tracks || [])[idx.has(dedupKey(t.title)) ? idx.get(dedupKey(t.title)) : (t.no - 1)]).filter(Boolean);
      if (ours.length) {
        same.titleTrack = ours[0].title;
        ours.forEach(t => { t.isTitle = true; });
        touched.add(x.t.file);
        filled.push(`${x.t.label} · ${same.title} → 타이틀곡 '${same.titleTrack}'`);
      }
    }
    skipped.push(`${x.t.label} · ${x.title} (= ${same.title})`); continue;
  }
  // 멤버별 버전("… (LEO Ver.)")은 본판이 있으면 같은 앨범의 변형 — 기본 목록에서 숨긴다(variant)
  const verM = x.title.match(/^(.*?)\s*\(([^()]+?)\s+ver\.?\)\s*$/i);
  const baseKey = verM ? mkey(verM[1]) : null;
  const variant = isVariant(x.title) || !!(baseKey && (disco.some(dd => mkey(dd.title) === baseKey)
    || found.some(o => o !== x && o.t === x.t && mkey(o.title) === baseKey)));
  const type = typeOf(x.melonType, tracks.length || x.trackCount, x.title);
  const region = regionFromGenre(d.genre) || detectRegion(x.title, tracks.map(t => t.title));
  const extra = variant || x.feat || /OST|컴필레이션|라이브/.test(type);
  // 참여 앨범의 주인(멜론 표기 순서) — byline(공동 앨범 표기)이 아니라 host에 둔다: "피처링과 공동 앨범은 다르다"(2026-10-19 사용자 결정,
  // tests/album-byline). 소식 선반 주인 표기가 host를 읽는다.
  const featHost = x.feat ? (x.names || []).map(o => ({ n: o.n, aid: o.aid })) : null;
  const titleTrack = (tracks.find(t => t.isTitle) || (tracks.length === 1 ? tracks[0] : null) || {}).title || null;
  const entry = {
    title: cleanTitle(x.title),
    type,
    isMain: !extra,
    cover: x.cover || null,
    releaseDate: d.releaseDate || x.date,
    trackCount: tracks.length || x.trackCount,
    titleTrack,
    ...(region ? { region } : {}),
    ...(variant ? { variant: true } : {}),
    ...(x.feat ? { feat: true, host: featHost } : {}),
    tracks,
    src: 'melon',
    melonAlbumId: x.albumId,
  };
  if (!DRY) {
    if (!Array.isArray(x.t.obj.discography)) x.t.obj.discography = [];
    const dl = x.t.obj.discography;
    if (dl.some(dd => String(dd.melonAlbumId || '') === x.albumId)) continue; // 같은 앨범이 두 aid로 잡힌 경우
    dl.push(entry);
    dl.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
    touched.add(x.t.file);
  }
  added.push(`${x.t.label} · ${entry.releaseDate} · ${entry.type} · ${entry.title}${x.feat ? ' · 참여(' + (x.names || []).map(o => o.n).join(', ') + ')' : ''}${titleTrack ? '' : ' (타이틀곡 미상)'}${region ? ' · ' + region : ''}`);
}

function writeKeepingStyle(file, obj) {
  const raw = fs.readFileSync(P(file), 'utf8');
  const m = /^[[{]\r?\n([ \t]+)/.exec(raw);
  fs.writeFileSync(P(file), JSON.stringify(obj, null, m ? m[1] : 2) + (raw.endsWith('\n') ? '\n' : ''));
}
if (touched.has('groups.json')) writeKeepingStyle('groups.json', groups);
if (touched.has('artists.json')) writeKeepingStyle('artists.json', artists);

const lines = [
  '## 멜론 최신 앨범 수집',
  '',
  `- 기간 최근 **${DAYS}일** · 요청 ${req} · 차단 ${blocked}${aborted ? ' · ⚠️ 연속 차단으로 중단' : ''}`,
  `- 우리 아티스트 발매 **${found.length}**건 · 추가 **${added.length}장** · 이미 있음 ${skipped.length}`,
  '', ...added.map(s => '  - ' + s),
  ...(filled.length ? ['', '타이틀곡 채움 ' + filled.length + '건', ...filled.map(s => '  - ' + s)] : []),
  ...(featChecked.length ? ['', '참여(피처링) 후보 확인 ' + featChecked.length + '건', ...featChecked.map(s => '  - ' + s)] : []),
  ...(problems.length ? ['', '<details><summary>문제 ' + problems.length + '건</summary>', '', ...problems.map(s => '  - ' + s), '', '</details>'] : []),
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
if (aborted) process.exitCode = 0; // 차단은 실패가 아니라 "다음 회차에 이어서" — 워크플로를 빨갛게 만들지 않는다
