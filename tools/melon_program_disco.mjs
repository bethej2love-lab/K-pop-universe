#!/usr/bin/env node
// 서바이벌 프로그램 앨범 멜론 수집 (2026-10-14)
//
// 왜: 서바이벌 출신 그룹(groups.json projectShow)은 정식 결성 전에 프로그램 명의('PRODUCE 101' 등)로 앨범이 나왔는데
//     그룹 디스코에 없었다(사용자: "일단 수집은 해야 한다, 노출은 고민"). 노출은 사용자 결정으로 **케밥 '프로그램 앨범 보기'
//     토글로만**(일본판 보기와 같은 방식) — 그래서 program:<프로그램명> + isMain:false 로 넣고, 타임라인·이번 주 발매에서도 뺀다.
// 방법: 프로그램명으로 멜론 아티스트를 찾고(국내 아티스트 + 이름 일치), 그 아티스트 대표 앨범 중 **그룹 데뷔 1년 전 ~ 데뷔 1개월 후**
//     발매만 받는다 — 시즌이 여러 개인 프로그램(프로듀스 101 시즌1·2)이 한 멜론 아티스트에 묶여 있어도 데뷔 시기로 갈린다.
// 멜론 파싱·차단 대응·캐시는 melon_disco_audit.mjs 에서 가져왔다.
//
// 실행: node tools/melon_program_disco.mjs [--groups 워너원,아이즈원] [--apply]  → 리포트 ~/Downloads/melon_disco_audit/melon_program_report.txt
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
      // 곡별 부른 아티스트 aid — 경연형 컴필레이션(킹덤·퀸덤)은 곡마다 그룹이 달라 이걸로 나눈다(--contest)
      const aids = [...new Set([...row.matchAll(/goArtistDetail\('(\d+)'\)/g)].map(m => m[1]))];
      tracks.push({ no, title: dec(t), isTitle: /bullet_icons title/.test(row), aids });
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
/* ============================ 서바이벌 프로그램 앨범 ============================ */
const GROUPS = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const MAP_F = 'melon_artist_map.json';
const map = JSON.parse(fs.readFileSync(P(MAP_F), 'utf8'));
const nrm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^0-9a-z가-힣]/g, '');
// 멜론 검색어 — 프로그램 한글명으로 안 나오는 것(영문 표기로 등록) 보강
const QUERY = {
  '프로듀스 48': ['PRODUCE 48', '프로듀스48'], '프로듀스 101': ['PRODUCE 101', '프로듀스101'], '프로듀스 101 시즌2': ['PRODUCE 101', '프로듀스101'],
  '프로듀스 X 101': ['PRODUCE X 101', '프로듀스X101'], '보이즈 플래닛': ['BOYS PLANET', '보이즈플래닛'], '보이즈 II 플래닛': ['BOYS II PLANET', '보이즈2플래닛'],
  'Girls Planet 999': ['Girls Planet 999', '걸스플래닛999'], '유니버스 티켓': ['UNIVERSE TICKET'], '유니버스 리그': ['UNIVERSE LEAGUE'],
  'I-LAND': ['I-LAND', '아이랜드'], 'I-LAND 2': ['I-LAND 2', '아이랜드2'], 'R U NEXT?': ['R U Next?', '알유넥스트'], 'SIXTEEN': ['SIXTEEN', '식스틴'],
  'PROJECT 7': ['PROJECT 7', '프로젝트7'], '방과후 설렘': ['방과후 설렘'], '아이돌학교': ['아이돌학교'], '더 유닛': ['더 유닛', 'THE UNIT'],
  'LOUD': ['LOUD', '라우드'], '언더나인틴': ['언더나인틴', 'UNDER NINETEEN'], '퀸덤 퍼즐': ['퀸덤퍼즐', 'QUEENDOM PUZZLE'], '소년판타지 2': ['소년판타지'],
  '청춘스타': ['청춘스타'], 'MAKE MATE 1': ['MAKEMATE1', '메이크메이트원'], 'K팝스타 시즌2': ['K팝스타'], '극한데뷔 야생돌': ['야생돌'],
};
const ONLY_G = argOf('--groups') ? new Set(argOf('--groups').split(',')) : null;

/* ===================== 경연형 서바이벌(킹덤·퀸덤 등) — --contest (2026-10-16) =====================
 * 위의 데뷔형(프로듀스·아이랜드)은 "프로그램 앨범 = 그 프로그램 출신 그룹 하나"라 그룹 데뷔일로 잘랐다.
 * 경연형은 **이미 데뷔한 그룹 여럿이 한 앨범에 곡을 나눠 싣는다**(킹덤 FINAL에 스키즈·에이티즈·더보이즈…).
 * 그래서 곡마다 부른 아티스트(aid)를 읽어 우리 그룹(melon_artist_map)에 맞추고, 참가 그룹마다
 * "그 그룹 곡만 담은" 프로그램 앨범으로 넣는다(program:<프로그램>, isMain:false — 기존 '프로그램 앨범 보기' 토글).
 * 실행: node tools/melon_program_disco.mjs --contest [--shows 킹덤,퀸덤] [--apply]  → melon_contest_report.txt */
// ⚠️ 아티스트 이름으로 찾으면 안 된다 — 멜론에 'Kingdom'이란 외국 가수가 열 명 넘게 있고, 경연 앨범은 프로그램 명의
//    아티스트가 아니라 참가 그룹 명의로 올라 있다(2026-10-16 실측). **앨범 검색 + 제목 앞머리 정규식**으로 고른다.
const CONTEST_SHOWS = {
  '퀸덤': { q: ['퀸덤'], re: /^(컴백전쟁\s*:?\s*)?퀸덤(?!\s*(2|퍼즐|puzzle))/i },
  '로드 투 킹덤': { q: ['로드 투 킹덤'], re: /^로드\s*투\s*킹덤(?!\s*:?\s*ACE)/i },
  '킹덤: 레전더리 워': { q: ['킹덤'], re: /^킹덤\s*[<〈:：]/ },
  '퀸덤2': { q: ['퀸덤2', '퀸덤 2'], re: /^<?퀸덤\s*2/ }, // 제목이 '<퀸덤2> FINAL 신곡대결' 꼴
  '피크타임': { q: ['피크타임', 'PEAK TIME'], re: /^(피크타임|PEAK\s*TIME)\s*[-–]/i }, // 'PEAK TIME - 1 Round …' — 외국 클럽음악 'Peak Time …' 제외
  '로드 투 킹덤: ACE OF ACE': { q: ['로드 투 킹덤 ACE OF ACE'], re: /^로드\s*투\s*킹덤\s*:?\s*ACE/i },
};
// 멜론 앨범 검색 결과 → [{albumId,title}] (같은 앨범이 썸네일·제목 두 번 나오므로 id로 한 번만)
function parseAlbumSearch(html) {
  const out = new Map();
  for (const m of String(html || '').matchAll(/goAlbumDetail\('(\d+)'\);" class="ellipsis" title="([^"]*?) - 페이지 이동"/g)) if (!out.has(m[1])) out.set(m[1], { albumId: m[1], title: dec(m[2]) });
  return [...out.values()];
}
if (process.argv.includes('--contest')) {
  const onlyS = argOf('--shows') ? new Set(argOf('--shows').split(',')) : null;
  const aid2g = new Map(Object.entries(map).filter(([, v]) => v && v.aid).map(([k, v]) => [String(v.aid), k]));
  const lines = [], perGroup = new Map(); let addN = 0;
  const seenAlbum = new Set(); // 시즌끼리 같은 멜론 아티스트에 묶여 있으면 한 번만
  for (const [show, cfg] of Object.entries(CONTEST_SHOWS)) {
    if (onlyS && !onlyS.has(show)) continue;
    const found = new Map();
    for (const q of cfg.q) {
      for (let s = 1; s <= 201; s += 50) {
        const h = await get(`https://www.melon.com/search/album/index.htm?q=${encodeURIComponent(q)}&section=album&pageSize=50&startIndex=${s}`, `asearch_${nrm(q)}_${s}`, 3000);
        const rows = parseAlbumSearch(h);
        const before = found.size;
        rows.filter(r => cfg.re.test(r.title)).forEach(r => found.set(r.albumId, r));
        if (rows.length < 20 || aborted) break;
        if (s > 1 && found.size === before) break; // 이 쪽부턴 관련 앨범이 안 나옴
      }
      if (aborted) break;
    }
    const albums = [...found.values()];
    lines.push(`\n■ ${show} — 앨범 ${albums.length}장`);
    {
      const dets = await pool(albums.filter(a => !seenAlbum.has(a.albumId)), async a => {
        seenAlbum.add(a.albumId);
        const html = await get(`https://www.melon.com/album/detail.htm?albumId=${a.albumId}`, `album_${a.albumId}`, 8000);
        // 커버는 상세의 앨범 이미지에서(검색 결과엔 크기 작은 썸네일뿐)
        return html ? { a: { ...a, cover: (html.match(/src="(https:\/\/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/[^"]+?)(?:\?|\/melon\/)/) || [])[1] || null }, d: parseAlbumDetail(html) } : null;
      });
      for (const r of dets) {
        if (!r) continue;
        const { a, d } = r;
        const by = new Map(); // 그룹 → 곡들
        const unk = [];
        for (const t of d.tracks) {
          if (/\(\s*inst\.?\s*\)|instrumental/i.test(t.title)) continue; // 반주 트랙은 곡이 아니다(ACE OF ACE 앨범마다 붙어 있음)
          const gs = [...new Set((t.aids || []).map(x => aid2g.get(x)).filter(Boolean))];
          if (!gs.length) { unk.push(t.title); continue; }
          gs.forEach(g => { if (!by.has(g)) by.set(g, []); by.get(g).push(t); });
        }
        lines.push(`   · ${d.releaseDate} ${a.title} ${d.tracks.length}곡 → ${[...by.entries()].map(([g, ts]) => `${g} ${ts.length}`).join(', ') || '매칭 0'}${unk.length ? ` · 미매칭 ${unk.length}` : ''}`);
        for (const [g, ts] of by) {
          if (!perGroup.has(g)) perGroup.set(g, []);
          perGroup.get(g).push({ show, a, d, ts });
        }
      }
      if (aborted) break;
    }
    if (aborted) { lines.push('⚠️ 멜론 차단 — 중단'); break; }
  }
  // 멤버 단위 매핑('a:<이름>|<그룹>' — 멜론 맵에 멤버 솔로 aid로 들어 있는 것): 같은 프로그램에 그 그룹 곡이 있으면
  // 그룹 대표로 나온 무대(ACE OF ACE 에이스 배틀)라 **그룹**에, 없으면 솔로로 나온 것(퀸덤 박봄)이라 **그 사람 디스코**에 넣는다.
  const ARTISTS = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
  const showsOfGroup = new Map();
  for (const [g, items] of perGroup) if (!g.startsWith('a:')) showsOfGroup.set(g, new Set(items.map(it => it.show)));
  const target = new Map(); // 키 → {kind,label,disco,items}
  for (const [g, items] of perGroup) {
    if (!g.startsWith('a:')) { const G = GROUPS[g]; if (!G) continue; const t = target.get(g) || { label: g, owner: G, items: [] }; t.items.push(...items); target.set(g, t); continue; }
    const [name, grp] = g.slice(2).split('|');
    for (const it of items) {
      if (grp && GROUPS[grp] && showsOfGroup.get(grp)?.has(it.show)) {
        const t = target.get(grp) || { label: grp, owner: GROUPS[grp], items: [] }; t.items.push(it); target.set(grp, t);
      } else {
        const a = ARTISTS.find(x => x.name && x.name.ko === name && ((x.group && x.group.ko === grp) || (x.groups || []).some(y => y && y.ko === grp))) || ARTISTS.find(x => x.name && x.name.ko === name);
        if (!a) continue;
        const k = 'a:' + name; const t = target.get(k) || { label: name + '(솔로)', owner: a, items: [], artist: true }; t.items.push(it); target.set(k, t);
      }
    }
  }
  const gl = [];
  let touchA = false;
  for (const t of target.values()) {
    const disco = t.owner.discography || (t.owner.discography = []);
    const have = new Set(disco.map(x => x.melonAlbumId).filter(Boolean));
    // 같은 앨범이 그룹 곡·에이스 곡으로 두 번 들어오면 곡을 합친다
    const byAlbum = new Map();
    for (const it of t.items) { const o = byAlbum.get(it.a.albumId); if (o) { it.ts.forEach(x => { if (!o.ts.includes(x)) o.ts.push(x); }); } else byAlbum.set(it.a.albumId, { ...it, ts: [...it.ts] }); }
    const all = [...byAlbum.values()];
    const fresh = all.filter(it => !have.has(it.a.albumId));
    gl.push(`${t.label}: ${all.length}장 (새로 ${fresh.length}) — ${all.map(it => `${it.show} · ${cleanTitle(it.a.title)} (${it.ts.map(x => x.title).join(' / ')})`).join(' | ')}`);
    if (!APPLY || !fresh.length) continue;
    for (const { show, a, d, ts } of fresh) {
      disco.push({
        title: cleanTitle(a.title), type: '컴필레이션', isMain: false, cover: a.cover || null,
        releaseDate: d.releaseDate || a.date, trackCount: ts.length, titleTrack: null,
        program: show, contest: true, tracks: ts.sort((p, q) => p.no - q.no).map(({ aids, ...x }) => x), src: 'melon', melonAlbumId: a.albumId,
      });
      addN++;
    }
    if (t.artist) touchA = true;
    disco.sort((p, q) => String(q.releaseDate || '').localeCompare(String(p.releaseDate || '')));
  }
  if (APPLY && addN) {
    for (const [file, obj] of [['groups.json', GROUPS], ...(touchA ? [['artists.json', ARTISTS]] : [])]) {
      const raw = fs.readFileSync(P(file), 'utf8');
      const ind = (/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || 1; // 원본 들여쓰기 그대로(메모리: JSON 들여쓰기 보존)
      fs.writeFileSync(P(file), JSON.stringify(obj, null, ind) + (raw.endsWith('\n') ? '\n' : ''));
    }
  }
  const out = lines.join('\n') + `\n\n[그룹별]\n` + gl.join('\n') + `\n\n${APPLY ? '추가 ' + addN : '(미리보기 — --apply로 반영)'} · 요청 ${req} 캐시 ${hit} 차단 ${blocked}${aborted ? ' · ⚠️ 차단 중단' : ''}`;
  fs.writeFileSync(path.join(OUT_DIR, 'melon_contest_report.txt'), out);
  console.log(out);
  process.exit(0);
}
const day = 86400000, ts = d => Date.parse(String(d || '').replace(/\./g, '-'));
const log = [], miss = [];
let added = 0;
const aidCache = new Map(); // 프로그램명 → 후보 aid 목록(같은 프로그램 그룹 둘이면 한 번만)
for (const [ko, g] of Object.entries(GROUPS)) {
  if (!g.projectShow || (ONLY_G && !ONLY_G.has(ko))) continue;
  const ps = g.projectShow, deb = ts(g.debut);
  if (isNaN(deb)) { miss.push(`${ko} — 데뷔일 없음`); continue; }
  let cands = aidCache.get(ps);
  if (!cands) {
    const qs = [...new Set([ps, ...(QUERY[ps] || [])])];
    const want = new Set(qs.map(nrm));
    const seen = new Map();
    for (const q of qs) {
      const h = await get(`https://www.melon.com/search/artist/index.htm?q=${encodeURIComponent(q)}&section=artist`, `usearch_${nrm(q)}`, 3000);
      for (const c of parseArtistSearch(h)) if (!seen.has(c.aid)) seen.set(c.aid, c);
      if (aborted) break;
    }
    // 이름이 프로그램명과 같거나(괄호 안팎) 프로그램명으로 시작하는 국내 아티스트 — "PRODUCE 101 (프로듀스 101)" 류
    cands = [...seen.values()].filter(c => /대한민국/.test(c.gubun || '') || !c.gubun.trim())
      .filter(c => [c.title, ...String(c.title).split(/[()]/)].map(nrm).some(p => p && [...want].some(w => p === w || (w.length >= 4 && p.startsWith(w)))));
    aidCache.set(ps, cands);
  }
  if (!cands.length) { miss.push(`${ko} — 멜론에서 '${ps}' 아티스트 못 찾음`); continue; }
  // 데뷔 1년 전 ~ 데뷔 1개월 후 발매만 — 같은 프로그램 다른 시즌(프로듀스 101 시즌1·2)이 한 멜론 아티스트에 섞여도 갈린다
  const lo = deb - 365 * day, hi = deb + 31 * day;
  const albums = [];
  for (const c of cands) for (const a of (await albumsOf(c.aid)).filter(x => x.artistAid === c.aid)) {
    const t = ts(a.date); if (!isNaN(t) && t >= lo && t <= hi) albums.push({ ...a, via: c });
  }
  const disco = g.discography || [];
  const have = new Set(disco.map(d => d.melonAlbumId).filter(Boolean));
  const haveK = new Set(disco.map(d => mkey(d.title) + '|' + d.releaseDate));
  const fresh = albums.filter(a => !have.has(a.albumId) && !haveK.has(mkey(a.title) + '|' + a.date));
  const dets = await pool(fresh, async a => {
    const html = await get(`https://www.melon.com/album/detail.htm?albumId=${a.albumId}`, `album_${a.albumId}`, 8000);
    return html ? { a, d: parseAlbumDetail(html) } : null;
  });
  const entries = [];
  for (const r of dets) {
    if (!r) continue;
    const { a, d } = r;
    const titleTrack = (d.tracks.find(t => t.isTitle) || (d.tracks.length === 1 ? d.tracks[0] : null) || {}).title || null;
    entries.push({
      title: cleanTitle(a.title), type: typeOf(a.melonType, d.tracks.length || a.trackCount, a.title), isMain: false,
      cover: a.cover || null, releaseDate: d.releaseDate || a.date, trackCount: d.tracks.length || a.trackCount, titleTrack,
      program: ps, ...(isVariant(a.title) ? { variant: true } : {}),
      tracks: d.tracks.map(({ aids, ...t }) => t), src: 'melon', melonAlbumId: a.albumId,
    });
  }
  log.push(`${ko} [${ps}] 멜론 ${cands.map(c => c.title + '/' + c.aid).join(', ')} · 기간 내 ${albums.length} · 추가 ${entries.length}` + entries.map(e => `\n     ${e.type.padEnd(6)} ${e.releaseDate} ${e.title}`).join(''));
  if (APPLY && entries.length) {
    g.discography = disco;
    for (const e of entries) disco.push(e);
    disco.sort((p, q) => String(q.releaseDate || '').localeCompare(String(p.releaseDate || '')));
    added += entries.length;
  }
  if (aborted) { console.log('⚠️ 멜론 차단 — 중단'); break; }
  if (SLEEP) await sleep(SLEEP);
}
if (APPLY && added) {
  const raw = fs.readFileSync(P('groups.json'), 'utf8');
  const ind = (/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || 1;
  fs.writeFileSync(P('groups.json'), JSON.stringify(GROUPS, null, ind) + (raw.endsWith('\n') ? '\n' : ''));
}
const out = log.join('\n') + `\n\n[못 찾음 ${miss.length}]\n` + miss.map(s => '  ' + s).join('\n') + `\n\n${APPLY ? '추가 ' + added : '추가 예정 ' + log.reduce((s, l) => s + (+(/추가 (\d+)/.exec(l) || [0, 0])[1]), 0)}장 · 요청 ${req} 캐시 ${hit} 차단 ${blocked}${aborted ? ' · ⚠️ 차단 중단' : ''}`;
fs.writeFileSync(path.join(OUT_DIR, 'melon_program_report.txt'), out);
console.log(out);
