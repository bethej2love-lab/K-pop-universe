#!/usr/bin/env node
// 멜론 정본 대조 — 그룹 디스코그래피 누락 감사/채우기 (2026-09-17)
//
// 왜 또 만드나: 싱글이 통째로 빠지는 구조적 구멍이 있다.
//   · 나무위키 기반 수집기(group_disco_fill.mjs)의 labelToType()은 **정규/미니만** 통과시킨다.
//     싱글·디지털싱글은 null로 버려져서 그 경로로는 영영 안 들어온다.
//   · 싱글을 넣는 유일한 자동 경로는 스포티파이 일일 수집(2026-09-15~)인데 2023년 이후만 본다.
//   → 실측(2026-09-17): 그룹 268팀 중 **79팀이 싱글 0장**. 82메이저는 `ON`(2023 데뷔전 싱글)과
//     `HEAT`(2026.09.01)가 둘 다 없었다.
//
// ⚠️ 2026-08-23에 "멜론 전체 diff"를 한 번 시도했다가 오탐 1,922건으로 접은 전례가 있다
//    (group_disco_audit.mjs 머리 주석). 그때 실패한 이유와 이번 대응:
//      ① 멜론은 참여앨범까지 보여준다        → 행의 **대표 아티스트 aid == 그룹 aid** 인 것만 본다
//      ② 리믹스·Sped Up·Inst 변형판이 쏟아진다 → spotify_disco_lib.isVariant 재사용(같은 규칙 유지)
//      ③ 일본반이 국내반처럼 섞인다          → detectRegion 으로 jp/cn 은 분리 집계(기본 미적용)
//      ④ 정규/미니는 '집 번호'가 필요하다     → **번호가 필요 없는 종류만** 채운다(기본 싱글).
//         번호 있는 종류는 리포트만 하고 나무위키 경로(group_disco_fill.mjs)에 맡긴다.
//    ①~④를 다 걸러도 남는 게 "진짜 누락"이다.
//
// 아티스트 id는 **레포에 남긴다**(melon_artist_map.json). 예전 감사는 aid 를
// ~/Downloads/melon_solo_audit/result.json 에만 뒀다가 그 파일이 사라져서 재현이 불가능해졌다.
//
// 실행:
//   node tools/melon_disco_audit.mjs                     # 전체 감사(읽기 전용)
//   node tools/melon_disco_audit.mjs --groups 82메이저,마마무
//   node tools/melon_disco_audit.mjs --apply             # 싱글만 groups.json 에 추가
//   node tools/melon_disco_audit.mjs --apply --types 싱글,스페셜
// env: MELON_SLEEP(기본 150ms)

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
// 채울 종류. 기본 '전체' — 사용자 결정(2026-09-17): **수집은 몽땅 하고 노출을 선별**한다.
// 버리는 게 아니라 태그(variant·region·type·isMain)를 붙여 넣고, 화면이 기본값에서 걸러낸다.
// 좁히고 싶으면 `--types 싱글,미니`.
const FILL_TYPES = new Set((argOf('--types') || '전체').split(',').map(s => s.trim()).filter(Boolean));

const sleep = ms => new Promise(r => setTimeout(r, ms));
let req = 0, hit = 0, blocked = 0;

const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();

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
  if (CACHE_ONLY) return '';
  for (let i = 1; i <= 3; i++) {
    try {
      req++;
      await execFileP('curl', ['-skL', '--max-time', '40', '-A', UA, '-e', 'https://www.melon.com/', encodeURI(url), '-o', f]);
    } catch { /* 재시도 */ }
    const b = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (isBlocked(b)) { blocked++; try { fs.unlinkSync(f); } catch {} await sleep(3000 * i); continue; }
    if (b.length >= minSize) return b;
    if (i < 3) await sleep(800 * i);
  }
  return '';
}

// 아주 작은 동시 실행 풀. 앨범 상세는 **후보 수만큼** 받아야 해서 순차로는 268팀에 1.8시간이 걸린다
// (실측). 동시 CONC 개면 그만큼 줄어든다. 멜론에 부담을 주지 않도록 기본값은 낮게 둔다.
const CONC = Number(process.env.MELON_CONC || 4);
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

/* ------------------------------ aid 해석 ------------------------------ */

const MAP_F = 'melon_artist_map.json';
const map = fs.existsSync(P(MAP_F)) ? JSON.parse(fs.readFileSync(P(MAP_F), 'utf8')) : {};

// 후보 검증: 그 아티스트의 앨범 제목이 우리 디스코와 몇 장이나 겹치는가.
// ⚠️ 이름만 보고 고르면 동명 그룹·커버 계정이 걸린다. 겹침 0이면 매핑을 저장하지 않는다 —
//    틀린 aid 를 저장하면 그 뒤로 영영 그 그룹만 엉뚱한 앨범을 본다.
async function resolveAid(ko, g, ourKeys, ourDates) {
  // ⚠️ 영문명 질의에서 결과가 나오면 거기서 멈추면 안 된다(2026-09-17 실측). `Coed School`(남녀공학)은
  //    엉뚱한 합창단 하나가 잡혀서 한글명 질의로 못 넘어갔다. 두 질의를 **다 모아서** 고른다.
  const queries = [...new Set([g.en, ko].filter(Boolean))];
  const cands = [];
  for (const q of queries) {
    const html = await get(`https://www.melon.com/search/artist/index.htm?q=${encodeURIComponent(q)}`, `asearch_${encodeURIComponent(q)}`, 3000);
    for (const c of parseArtistSearch(html)) if (!cands.some(x => x.aid === c.aid)) cands.push(c);
  }
  if (!cands.length) return { ok: false, why: '검색 결과 없음' };

  // 그룹만 본다 — '그룹' 표기가 있는 후보가 하나라도 있으면 솔로 후보는 뺀다(동명 솔로 오매칭 방지).
  // 한국 그룹을 앞으로 당긴다(동명 해외 그룹이 검색 상위에 오는 일이 잦다 — `Supernova` 6명 중 5명이 해외).
  const groupCands = cands.filter(c => /그룹/.test(c.gubun));
  const pool = (groupCands.length ? groupCands : cands)
    .sort((a, b) => (/한국/.test(b.gubun) ? 1 : 0) - (/한국/.test(a.gubun) ? 1 : 0))
    .slice(0, 5);

  let best = null;
  for (const c of pool) {
    const albums = (await albumsOf(c.aid)).filter(a => a.artistAid === c.aid);
    let overlap = 0;
    // ⚠️ 여기서 dedupKey 를 쓰면 안 된다 — 호출부의 ourKeys 는 mkey(제목 꼬리표까지 턴 키)다.
    //    한 번 어긋났더니 비비지처럼 `The 1st Mini Album 'X'` 형식으로 저장된 그룹이 전부
    //    "앨범 겹침 0"으로 매핑 실패했다(실측 2026-09-17).
    // ⚠️ 제목만으로는 부족하다 — 에이프릴·엑스원처럼 멜론 제목 표기가 우리와 통째로 다른 팀이 있다.
    //    **발매일 일치**는 표기 차이에 면역이라 같이 센다(정답 아티스트가 아니면 날짜가 안 맞는다).
    for (const a of albums) if (ourKeys.has(mkey(a.title)) || (a.date && ourDates.has(a.date))) overlap++;
    if (!best || overlap > best.overlap) best = { c, overlap, albums };
    if (overlap >= 3) break;   // 충분히 확실하면 더 안 본다
  }
  if (!best || best.overlap === 0) return { ok: false, why: `앨범 겹침 0 (후보 ${pool.length}명)`, cands: pool };
  return {
    ok: true, aid: best.c.aid, melonName: best.c.title, gubun: best.c.gubun,
    overlap: best.overlap, albums: best.albums,
    confidence: best.overlap >= 3 ? 'high' : best.overlap >= 2 ? 'medium' : 'low',
  };
}

/* ------------------------------ 분류 규칙 ------------------------------ */

// 멜론 제목 꼬리표 정리 — **대조용 키를 만들 때만** 쓴다(저장하는 제목은 건드리지 않는다).
// 우리 데이터도 같은 함수로 정규화하므로 비교는 대칭이다.
// 실측(레드벨벳): `Rookie - The 4th Mini Album`, `The 1st Single '행복 (Happiness)'`,
// `환생 (Rebirth) - SM STATION`, `Velvet Summer - Summer Mini Album` 이 전부 같은 앨범인데 안 붙었다.
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

const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
let names = Object.keys(groups).filter(k => Array.isArray(groups[k].discography) && groups[k].discography.length);
if (ONLY) names = names.filter(n => ONLY.has(n));

console.log(`[melon-audit] 대상 ${names.length}팀${APPLY ? ` · 적용(${[...FILL_TYPES].join(',')})` : ' · 읽기 전용'}`);

const report = [];
const unresolved = [];
const addQueue = [];
let done = 0, detailFail = 0;

for (const ko of names) {
  const g = groups[ko];
  const ourKeys = new Set(g.discography.map(d => mkey(d.title)).filter(Boolean));
  const ourDates = new Set(g.discography.map(d => d.releaseDate).filter(Boolean));

  let m = map[ko];
  let albums = null;
  if (!m || !m.aid) {
    if (m && m.failedWhy && !REFRESH) { unresolved.push(`${ko} — ${m.failedWhy} (이전 회차)`); continue; }
    const r = await resolveAid(ko, g, ourKeys, ourDates);
    if (!r.ok) {
      unresolved.push(`${ko} — ${r.why}`);
      map[ko] = { aid: null, failedWhy: r.why, checkedAt: new Date().toISOString().slice(0, 10) };
      continue;
    }
    m = map[ko] = { aid: r.aid, melonName: r.melonName, gubun: r.gubun, confidence: r.confidence, overlap: r.overlap, checkedAt: new Date().toISOString().slice(0, 10) };
    albums = r.albums;
  }
  if (!albums) albums = (await albumsOf(m.aid)).filter(a => a.artistAid === m.aid);

  const counts = { melon: albums.length, ours: g.discography.length, variant: 0, dup: 0 };
  const cands = [];
  for (const a of albums) {
    const key = mkey(a.title);
    if (!key) continue;
    if (ourKeys.has(key)) { counts.dup++; continue; }
    // ⚠️ 제목 표기가 달라 못 붙는 경우를 **같은 발매일**로 한 번 더 건진다. 날짜까지 같은데 제목만
    //    다른 건 대개 우리가 이미 가진 앨범이다 — 중복 추가가 누락보다 고치기 어렵다.
    //    단, 변형판은 원판과 발매일이 같은 경우가 있어(Sped Up 동시 발매) 날짜로 지우면 안 된다.
    if (ourDates.has(a.date) && !isVariant(a.title)) { counts.dup++; continue; }
    if (isVariant(a.title)) counts.variant++;
    // 수집은 **전부** 한다(사용자 결정 2026-09-17: "몽땅 수집하고 노출을 선별"). 리믹스·Sped Up 같은
    // 변형판은 버리지 않고 variant:true + isMain:false 로 태그해서 넣고, 화면에서 기본 숨김 처리한다.
    // 버리면 "왜 없지?"를 매번 다시 조사하게 된다 — 82메이저·레드벨벳이 딱 그 상태였다.
    cands.push({ ...a, variant: isVariant(a.title) });
  }

  // 후보만 상세를 받는다(장르로 해외반 판정 + 트랙/타이틀곡 확보). 목록에만 있는 정보로는
  // 영문 제목의 일본 발매를 절대 못 가른다 — 레드벨벳 `Bloom`·`SAPPY`가 그 사례다.
  const missing = await pool(cands, async a => {
    const html = await get(`https://www.melon.com/album/detail.htm?albumId=${a.albumId}`, `album_${a.albumId}`, 8000);
    if (!html) { detailFail++; return { ...a, type: typeOf(a.melonType, a.trackCount, a.title), region: null, detail: null, why: '상세 수집 실패' }; }
    const d = parseAlbumDetail(html);
    const region = regionFromGenre(d.genre) || detectRegion(a.title, d.tracks.map(t => t.title));
    return {
      ...a,
      type: typeOf(a.melonType, d.tracks.length || a.trackCount, a.title),
      region, genre: d.genre, agency: d.agency, detail: d,
    };
  });

  if (missing.length) report.push({ ko, aid: m.aid, missing, counts });
  for (const x of missing) {
    if (!x.detail) continue;                                  // 상세 수집 실패분은 넣지 않는다
    if (FILL_TYPES.has('전체')) { addQueue.push({ ko, ...x }); continue; }
    const t = x.type;
    if (FILL_TYPES.has(t) || (FILL_TYPES.has('미니') && /^미니/.test(t)) || (FILL_TYPES.has('정규') && /^정규/.test(t))) addQueue.push({ ko, ...x });
  }

  if (++done % 10 === 0) console.log(`  ...${done}/${names.length} | 누락후보 ${report.reduce((s, r) => s + r.missing.length, 0)} | 요청 ${req} 캐시 ${hit}`);
  if (SLEEP) await sleep(SLEEP);
}

fs.writeFileSync(P(MAP_F), JSON.stringify(map, null, 2) + '\n');

/* --------------------------------- 리포트 --------------------------------- */

const bucketOf = x => x.variant ? '변형판'
  : x.region ? `해외반(${x.region})`
  : /OST|컴필레이션|라이브/.test(x.type) ? '참고'
  : NUMBERED(x.type) ? '번호있음'
  : x.type === '싱글' ? '싱글'
  : '번호미상';

const tally = {};
for (const r of report) for (const x of r.missing) { const b = bucketOf(x); tally[b] = (tally[b] || 0) + 1; }

const L = [];
L.push(`멜론 대조 감사 — ${new Date().toISOString().slice(0, 10)}`);
L.push(`대상 ${names.length}팀 · 누락 있는 팀 ${report.length} · 누락 후보 ${report.reduce((s, r) => s + r.missing.length, 0)}장`);
L.push(`분류: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
L.push(`매핑 실패 ${unresolved.length}팀 · 상세 수집 실패 ${detailFail}장 · 요청 ${req} 캐시 ${hit}${blocked ? ` · ⚠️ 차단응답 ${blocked}` : ''}`);
L.push('');
L.push('범례: 싱글/번호있음 = 기본 노출 · 번호미상 = 집 번호 근거 없음(나무위키 경로가 나중에 채움) · 참고 = OST·컴필·라이브(부가) · 해외반 = 일본/중국 발매(케밥 토글) · 변형판 = 리믹스·Sped Up(부가)');
L.push('');
for (const r of report.sort((a, b) => b.missing.length - a.missing.length)) {
  const fillable = r.missing.filter(x => !x.region && (x.type === '싱글' || NUMBERED(x.type))).length;
  L.push(`■ ${r.ko}  (누락후보 ${r.missing.length} · 바로채움 ${fillable} / 우리 ${r.counts.ours}장 · 멜론 ${r.counts.melon}장 · 변형판 ${r.counts.variant} · 이미보유 ${r.counts.dup})`);
  for (const x of r.missing.sort((a, b) => (b.date || '').localeCompare(a.date || ''))) {
    L.push(`   [${bucketOf(x).padEnd(8)}] ${String(x.type).padEnd(7)} ${x.date}  ${x.title}  [${x.trackCount}곡]${x.genre ? ` (${x.genre})` : ''}${x.why ? ` — ${x.why}` : ''}`);
  }
}
L.push('');
L.push(`[매핑 실패 — ${unresolved.length}]`);
unresolved.forEach(u => L.push('   ' + u));

const outFile = path.join(OUT_DIR, 'melon_disco_report.txt');
fs.writeFileSync(outFile, L.join('\n'));
console.log('\n' + L.slice(0, 4).join('\n'));
console.log(`\n리포트: ${outFile}`);

if (!APPLY) { console.log(`[읽기 전용] groups.json 은 손대지 않았습니다. 채우려면 --apply`); process.exit(0); }

/* --------------------------------- 적용 --------------------------------- */

// 번호 충돌 처리 — 같은 `미니 3집`이 둘이 되면 **번호만 떼고 앨범은 넣는다**.
// ⚠️ 처음엔 group_disco_fill.mjs 처럼 그 그룹을 통째로 건너뛰게 했는데, 실제로 걸린 두 건이 전부
//    **정상 발매**였다(2026-09-17): 슈퍼주니어 `The Road` 11집 Vol.1/Vol.2, 몬스타엑스 2집
//    Take.1/Take.2 — 한 집 번호를 두 장이 나눠 갖는 기획이다. 그룹을 통째로 버리면 그 팀의 싱글까지
//    다 날아간다(실측: 그 두 팀에서 40장). 번호를 지어내지도, 앨범을 버리지도 않는 중간이 맞다.
const byGroup = {};
for (const x of addQueue) (byGroup[x.ko] = byGroup[x.ko] || []).push(x);
const clashDemoted = [];
for (const [ko, list] of Object.entries(byGroup)) {
  const seen = new Map();
  for (const d of groups[ko].discography) if (NUMBERED(d.type)) seen.set(d.type, d.title);
  for (const x of list) {
    if (!NUMBERED(x.type)) continue;
    if (seen.has(x.type)) {
      clashDemoted.push(`${ko} — ${x.type} 중복("${seen.get(x.type)}" 이미 있음) → "${x.title}" 은 번호 없이 '${x.type.replace(/\s*\d+집$/, '')}' 으로 넣음`);
      x.type = x.type.replace(/\s*\d+집$/, '');
      continue;
    }
    seen.set(x.type, x.title);
  }
}

let added = 0;
const addedLog = [];
for (const [ko, list] of Object.entries(byGroup)) {
  for (const x of list) {
    const d = x.detail;
    const tracks = d.tracks;
    const titleTrack = (tracks.find(t => t.isTitle) || (tracks.length === 1 ? tracks[0] : null) || {}).title || null;
    // isMain=false 는 화면에서 '부가'(흐리게 + 더보기 안쪽)라는 뜻이다. OST·컴필·라이브는 기존 관례가
    // 그랬고, 변형판(리믹스·Sped Up)도 같은 취급으로 넣는다 — 기본 목록을 리믹스로 도배하지 않으면서
    // 데이터는 남긴다.
    const extra = x.variant || /OST|컴필레이션|라이브/.test(x.type);
    const entry = {
      title: cleanTitle(x.title),
      type: x.type,
      isMain: !extra,
      cover: x.cover || null,
      releaseDate: d.releaseDate || x.date,
      trackCount: tracks.length || x.trackCount,
      titleTrack,
      ...(x.region ? { region: x.region } : {}),
      ...(x.variant ? { variant: true } : {}),
      tracks,
      src: 'melon',
      melonAlbumId: x.albumId,
    };
    const dl = groups[ko].discography;
    if (dl.some(dd => mkey(dd.title) === mkey(entry.title) && dd.releaseDate === entry.releaseDate)) continue;
    dl.push(entry);
    dl.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
    added++;
    addedLog.push(`   ${ko}  ${entry.type.padEnd(7)} ${entry.releaseDate}  ${entry.title} [${entry.trackCount}곡, 타이틀:${titleTrack || '미상'}]`);
  }
}

// ⚠️ groups.json 은 2칸 들여쓰기 + 끝 개행이다. 스타일이 바뀌면 전체 리포맷 diff 가 되어 리뷰가 불가능해진다.
fs.writeFileSync(P('groups.json'), JSON.stringify(groups, null, 2) + '\n');
console.log(`\n추가 ${added}장${clashDemoted.length ? ` · 번호 중복으로 번호 뗀 앨범 ${clashDemoted.length}` : ''}`);
console.log(addedLog.join('\n'));
if (clashDemoted.length) console.log('\n[번호 중복 → 번호 제거]\n' + clashDemoted.map(s => '   ' + s).join('\n'));
fs.appendFileSync(outFile, `\n\n[적용 — ${added}장]\n` + addedLog.join('\n') + (clashDemoted.length ? `\n\n[번호 중복 → 번호 제거]\n` + clashDemoted.map(s => '   ' + s).join('\n') : ''));
