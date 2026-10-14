#!/usr/bin/env node
// 유닛 디스코그래피 멜론 수집 (2026-10-14)
//
// 왜: 유닛 카드(index.html _showUnitCard)는 유닛원들의 artists.json unitDiscography를 모아 보여주는데, 93개 유닛 중
//     12개가 0장(SuperM·V8·B.D.U·UNB…)이고 나머지도 1~2장뿐인 곳이 많았다(사용자: "당연히 채워져야 하는데 빠뜨림").
//     그룹 수집기(melon_disco_audit.mjs)는 groups.json/솔로만 대상이라 유닛은 어떤 경로로도 안 들어왔다.
//
// 대상: shared.js _PROJECT_UNITS. 유닛 멜론 aid는 melon_artist_map.json 에 'u:<유닛>' 키로 남긴다(재현 가능하게).
// 본인확인: 이름(괄호 안팎) 일치 + [멜론 아티스트 상세의 멤버가 우리 유닛원과 2명 이상(유닛원 1명이면 1명) 겹침
//           또는 이미 가진 유닛 앨범 제목이 그 aid 앨범 목록에 있음]. 근거 없으면 넣지 않고 리포트에만 남긴다.
// 저장: 유닛원 **각자의** unitDiscography[{unitName, albums}]에 같은 앨범을 넣는다(기존 데이터 관례 — 슬림 빌드가
//       멤버 단위로 disco 파일을 나누기 때문). 앨범 스키마·종류 판정·변형판/해외반 태그는 그룹 수집기와 동일.
// 멜론 파싱·차단 대응·캐시는 melon_disco_audit.mjs 에서 그대로 가져왔다(같은 캐시 폴더를 쓴다).
//
// 실행: node tools/melon_unit_disco.mjs [--units SuperM,V8] [--apply] [--refresh]
//       → 리포트 ~/Downloads/melon_disco_audit/melon_unit_disco_report.txt, 적용 후 node tools/build_slim_data.mjs
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
/* ================================ 유닛 전용 ================================ */
// _PROJECT_UNITS 읽기(shared.js 는 브라우저용 스크립트라 import 가 안 된다 — validate-data.js 와 같은 방식으로 잘라 평가)
const sharedSrc = fs.readFileSync(P('shared.js'), 'utf8');
const UNITS = Function('return ' + /const _PROJECT_UNITS=(\{[\s\S]*?\n\});/.exec(sharedSrc)[1])();
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const MAP_F = 'melon_artist_map.json';
const map = JSON.parse(fs.readFileSync(P(MAP_F), 'utf8'));
const GROUPS = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
// 멜론 이름이 우리 유닛명과 달라 자동으로 못 붙는 것 — 검색 결과를 사람이 보고 확인(2026-10-14)
const MANUAL = { 'BTOB 4U': '2902241' /* 비투비 포유 */, 'ZE:A Five': '719888' /* 제아파이브 */, 'EXO-SC': '2739460' /* 세훈&찬열 */,
  '바스타즈': '858846' /* 블락비 바스타즈 */, '구구단 오구오구': '1867147', '구구단 세미나': '2203723' };

const inG = (a, k) => (a.group && a.group.ko === k) || (a.groups || []).some(g => g && g.ko === k);
const memberRecs = u => u.members.map(({ mko, gko }) => artists.find(a => a.name && a.name.ko === mko && (inG(a, gko) || (gko === mko && a.group && !a.group.ko.startsWith('__'))))).filter(Boolean);
const nrm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^0-9a-z가-힣]/g, '');
// 멜론 표기 "슈퍼주니어-D&E (SUPER JUNIOR-D&E)" → 괄호 안팎 각각을 이름 후보로
const nameParts = t => [t, ...String(t).split(/[()]/), ...String(t).split(/[()-]/)].map(nrm).filter(Boolean); // '소녀시대-태티서'·'WayV-TEN&YANGYANG'
const memberNameKeys = recs => new Set(recs.flatMap(a => [a.name.ko, a.name.en, ...(a.matchAliases || [])].filter(Boolean).map(nrm)));

async function resolveUnit(key, u, recs, ourKeys) {
  const want = new Set([key, ...u.names].map(nrm).filter(s => s.length >= 2));
  const queries = [...new Set([key, ...u.names])].slice(0, 4);
  const seen = new Map();
  for (const q of queries) {
    const h = await get(`https://www.melon.com/search/artist/index.htm?q=${encodeURIComponent(q)}&section=artist`, `usearch_${nrm(q)}`, 3000);
    for (const c of parseArtistSearch(h)) if (!seen.has(c.aid)) seen.set(c.aid, c);
    if (aborted) return { ok: false, why: '멜론 차단' };
  }
  const named = [...seen.values()].filter(c => nameParts(c.title).some(p => want.has(p)));
  if (!named.length) return { ok: false, why: `이름 맞는 후보 없음(후보 ${seen.size})` };
  const mk = memberNameKeys(recs);
  let best = null;
  for (const c of named.slice(0, 6)) {
    const d = await detailOf(c.aid);
    const memHit = d.members.filter(m => nameParts(m.title).some(p => mk.has(p))).length;
    let alHit = 0;
    if (ourKeys.size) { const al = (await albumsOf(c.aid)).filter(a => a.artistAid === c.aid); alHit = al.filter(a => ourKeys.has(mkey(a.title))).length; }
    const score = memHit * 2 + alHit * 3;
    // 근거: 멤버 2명 이상 겹침(유닛원이 1~2명이면 전원) 또는 이미 가진 유닛 앨범 제목 겹침
    const needMem = Math.min(2, recs.length);
    // 앨범 겹침만으로 인정하는 건 국내 아티스트일 때만 — 트리플에스 'EVOLution'이 동명 외국 밴드(1999~)로 붙었다(2026-10-14)
    const ok = memHit >= needMem || (alHit >= 1 && /대한민국/.test(c.gubun || ''));
    if (ok && (!best || score > best.score)) best = { ...c, score, memHit, alHit };
  }
  if (!best) return { ok: false, why: `본인확인 실패(이름 후보 ${named.length}: ${named.slice(0, 3).map(c => c.title + '/' + c.aid).join(', ')})` };
  return { ok: true, aid: best.aid, melonName: best.title, gubun: best.gubun, evidence: `멤버 ${best.memHit} · 기존앨범 ${best.alHit}` };
}

const ONLY_U = argOf('--units') ? new Set(argOf('--units').split(',')) : null;
const log = [], unresolved = [];
let added = 0;
for (const [key, u] of Object.entries(UNITS)) {
  if (ONLY_U && !ONLY_U.has(key)) continue;
  if (key === 'B.D.U' || key === 'UNB') continue; // 행성 있는 프로젝트 그룹 — 앨범은 groups.json 디스코(그룹 수집기 몫)
  const recs = memberRecs(u);
  if (!recs.length) { unresolved.push(`${key} — 유닛원 레코드 없음`); continue; }
  const ours = new Map();
  recs.forEach(a => (a.unitDiscography || []).forEach(ud => { if (ud.unitName === key || u.names.includes(ud.unitName)) ud.albums.forEach(al => ours.set(mkey(al.title) + '|' + al.releaseDate, al)); }));
  const ourKeys = new Set([...ours.values()].map(al => mkey(al.title)));
  const mk = 'u:' + key;
  let m = map[mk];
  if (m && m.blocked) { unresolved.push(`${key} — 매핑 차단(${m.blockedWhy || '수동'})`); continue; }
  if ((!m || !m.aid) && MANUAL[key]) m = map[mk] = { aid: MANUAL[key], melonName: null, kind: 'unit', evidence: '수동 확인(멜론 검색 결과·이름 다름, 2026-10-14)', checkedAt: new Date().toISOString().slice(0, 10) };
  let parentOnly = null;
  if ((!m || !m.aid) && (m && m.via === 'parent')) parentOnly = m.parent;
  if (!parentOnly && (!m || !m.aid)) {
    const r = await resolveUnit(key, u, recs, ourKeys);
    if (!r.ok) {
      // 멜론에 유닛이 따로 없는 경우(트리플에스 유닛들은 tripleS 이름으로 발매) — 한 그룹 유닛이면 그 그룹 앨범 중 제목에 유닛명이 있는 것
      const gs = [...new Set(u.members.map(x => x.gko))];
      const pm = gs.length === 1 && map[gs[0]] && map[gs[0]].aid;
      if (pm && !aborted) { parentOnly = gs[0]; m = map[mk] = { aid: null, via: 'parent', parent: gs[0], kind: 'unit', checkedAt: new Date().toISOString().slice(0, 10) }; }
    }
  }
  if (parentOnly) {
    const pa = map[parentOnly].aid;
    const keys = [...new Set([key, ...u.names].map(nrm).filter(x => x.length >= 3))];
    m = { ...m, aid: pa, melonName: parentOnly + '(제목에 유닛명)', titleFilter: keys };
  }
  if (!m || !m.aid) {
    const r = await resolveUnit(key, u, recs, ourKeys);
    if (!r.ok) { unresolved.push(`${key} — ${r.why}`); if (!aborted) map[mk] = { aid: null, kind: 'unit', failedWhy: r.why, checkedAt: new Date().toISOString().slice(0, 10) }; if (aborted) break; continue; }
    m = map[mk] = { aid: r.aid, melonName: r.melonName, gubun: r.gubun, kind: 'unit', evidence: r.evidence, checkedAt: new Date().toISOString().slice(0, 10) };
  }
  let albums = (await albumsOf(m.aid)).filter(a => a.artistAid === m.aid);
  if (m.titleFilter) albums = albums.filter(a => m.titleFilter.some(k => nrm(a.title).includes(k)));
  // 유닛원 소속 그룹 데뷔 1년 전보다 이른 발매는 다른 사람(동명이인 방어 — 그룹 수집기와 같은 규칙)
  { const debs = [...new Set(u.members.map(x => x.gko))].map(g => GROUPS[g] && GROUPS[g].debut).filter(Boolean).map(d => Date.parse(String(d).replace(/\./g, '-'))).filter(n => !isNaN(n));
    if (debs.length) { const lo = Math.min(...debs) - 365 * 86400000; albums = albums.filter(a => !a.date || Date.parse(a.date.replace(/\./g, '-')) >= lo); } }
  const fresh = albums.filter(a => {
    const k = mkey(a.title); if (!k) return false;
    if (ourKeys.has(k)) return false;
    if ([...ours.values()].some(al => al.releaseDate === a.date) && !isVariant(a.title)) return false;
    return true;
  });
  const det = await pool(fresh, async a => {
    const html = await get(`https://www.melon.com/album/detail.htm?albumId=${a.albumId}`, `album_${a.albumId}`, 8000);
    return html ? { a, d: parseAlbumDetail(html) } : null;
  });
  const entries = [];
  for (const x of det) {
    if (!x) continue;
    const { a, d } = x;
    const variant = isVariant(a.title);
    const type = typeOf(a.melonType, d.tracks.length || a.trackCount, a.title);
    const region = regionFromGenre(d.genre) || detectRegion(a.title, d.tracks.map(t => t.title));
    const titleTrack = (d.tracks.find(t => t.isTitle) || (d.tracks.length === 1 ? d.tracks[0] : null) || {}).title || null;
    entries.push({
      title: cleanTitle(a.title), type, isMain: !(variant || /OST|컴필레이션|라이브/.test(type)),
      cover: a.cover || null, releaseDate: d.releaseDate || a.date, trackCount: d.tracks.length || a.trackCount, titleTrack,
      ...(region ? { region } : {}), ...(variant ? { variant: true } : {}),
      tracks: d.tracks, src: 'melon', melonAlbumId: a.albumId,
    });
  }
  log.push(`${key} → ${m.melonName} (${m.aid}${m.evidence ? ' · ' + m.evidence : ''}) 멜론 ${albums.length} · 기존 ${ours.size} · 추가 ${entries.length}` + entries.map(e => `\n     ${e.type.padEnd(6)} ${e.releaseDate} ${e.title}${e.region ? ' [' + e.region + ']' : ''}${e.variant ? ' [변형]' : ''}`).join(''));
  if (APPLY && entries.length) {
    for (const a of recs) {
      a.unitDiscography = a.unitDiscography || [];
      let ud = a.unitDiscography.find(x => x.unitName === key || u.names.includes(x.unitName));
      if (!ud) { ud = { unitName: key, albums: [] }; a.unitDiscography.push(ud); }
      for (const e of entries) if (!ud.albums.some(al => mkey(al.title) === mkey(e.title) && al.releaseDate === e.releaseDate)) ud.albums.push(JSON.parse(JSON.stringify(e)));
      ud.albums.sort((x, y) => String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')));
    }
    added += entries.length;
  }
  if (aborted) { console.log('⚠️ 멜론 차단 — 회차 중단'); break; }
  if (SLEEP) await sleep(SLEEP);
}
fs.writeFileSync(P(MAP_F), JSON.stringify(map, null, 2) + '\n');
if (APPLY && added) {
  const raw = fs.readFileSync(P('artists.json'), 'utf8');
  const ind = (/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || 2;
  fs.writeFileSync(P('artists.json'), JSON.stringify(artists, null, ind) + (raw.endsWith('\n') ? '\n' : ''));
}
const out = log.join('\n') + '\n\n[못 찾음 ' + unresolved.length + ']\n' + unresolved.map(s => '  ' + s).join('\n') + `\n\n${APPLY ? '추가' : '추가 예정'} ${APPLY ? added : log.reduce((s, l) => s + (+(/추가 (\d+)/.exec(l) || [0, 0])[1]), 0)}장 · 요청 ${req} 캐시 ${hit} 차단 ${blocked}`;
fs.writeFileSync(path.join(OUT_DIR, 'melon_unit_disco_report.txt'), out);
console.log(out);
