#!/usr/bin/env node
// 솔로 디스코 반영안 생성 (Round 1: 정규/미니 보유 멤버)
//  입력: ~/Downloads/melon_solo_audit/result.json  (melon_solo_audit.mjs 산출)
//  출력: ~/Downloads/melon_solo_audit/proposal.json + review.txt
//  ※ artists.json 은 건드리지 않음. 검토 후 별도 적용 스크립트로 반영.
//
// 앨범 번호(정규 N집/미니 N집) 확정 순서:
//   1) 멜론 앨범명에 박힌 표기  ("TAP - The 2nd Mini Album", "OO (정규 1집)")   ← 1차
//   2) 나무위키 본문에서 해당 앨범명 주변의 "정규 N집 / 미니 N집" 표기         ← 검증
//   3) 둘 다 없으면 타입별 발매일 순 자동 번호                                  ← 확인 필요로 표시
//
// 사용법: node tools/melon_solo_reflect.mjs [--limit N] [--members 이름,이름]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// 회사 PC는 self-signed 인증서로 TLS가 가로채여서 나무위키가 fetch 단계에서 실패함
// (curl 의 -k 와 동일). 멜론은 통과하지만 namu.wiki 는 이게 없으면 못 받음.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit');
const CACHE_DIR = path.join(OUT_DIR, 'cache');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CONCURRENCY = 3;

const argv = process.argv.slice(2);
const LIMIT = (() => { const i = argv.indexOf('--limit'); return i >= 0 ? Number(argv[i + 1]) : 0; })();
const ONLY = (() => { const i = argv.indexOf('--members'); return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(',')) : null; })();

fs.mkdirSync(CACHE_DIR, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let reqCount = 0, cacheHits = 0;

async function get(url, cacheKey, minSize = 2000, referer = 'https://www.melon.com/') {
  const f = path.join(CACHE_DIR, cacheKey + '.html');
  if (fs.existsSync(f)) {
    const b = fs.readFileSync(f, 'utf8');
    if (b.length >= minSize) { cacheHits++; return b; }
  }
  for (let i = 1; i <= 4; i++) {
    try {
      reqCount++;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: referer, 'Accept-Language': 'ko-KR,ko;q=0.9' },
        signal: AbortSignal.timeout(30000),
      });
      const b = await res.text();
      if (res.ok && b.length >= minSize) { fs.writeFileSync(f, b); await sleep(120); return b; }
      await sleep(1200 * i);
    } catch { await sleep(1200 * i); }
  }
  return null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();

/* ------------------------- 앨범명에서 종류/번호 뽑기 ------------------------- */

const ORD_EN = { '1st': 1, '2nd': 2, '3rd': 3, first: 1, second: 2, third: 3 };
const ordNum = s => {
  const t = String(s).toLowerCase();
  if (ORD_EN[t]) return ORD_EN[t];
  const m = t.match(/^(\d+)(st|nd|rd|th)?$/);
  return m ? Number(m[1]) : null;
};

/** "TAP - The 2nd Mini Album" → {clean:'TAP', kind:'미니', no:2} */
function parseDescriptor(rawTitle) {
  let title = rawTitle;
  let kind = null, no = null;

  // 영문: "The 2nd Mini Album" / "1st Full Album" / "Vol.2" ...
  const en = title.match(/[-–—(\[]\s*(?:the\s+)?(\d+(?:st|nd|rd|th)?|first|second|third)?\s*(mini|full|single|studio|ep|special|repackage)?\s*album\s*[)\]]?\s*$/i);
  if (en) {
    const n = en[1] ? ordNum(en[1]) : null;
    const k = (en[2] || '').toLowerCase();
    kind = /mini|ep/.test(k) ? '미니' : /full|studio/.test(k) ? '정규' : /single/.test(k) ? '싱글' : /special|repackage/.test(k) ? null : (n ? '정규' : null);
    no = n;
    if (kind) title = title.slice(0, en.index).replace(/[\s\-–—(\[]+$/, '').trim();
  }
  // 한글: "(정규 1집)" / "- 미니 2집"
  if (!kind) {
    const ko = title.match(/[-–—(\[]?\s*(정규|미니|싱글|EP)\s*(\d+)?\s*집?\s*[)\]]?\s*$/);
    if (ko) {
      kind = ko[1] === 'EP' ? '미니' : ko[1];
      no = ko[2] ? Number(ko[2]) : null;
      title = title.slice(0, ko.index).replace(/[\s\-–—(\[]+$/, '').trim();
    }
  }
  return { clean: title || rawTitle, kind, no };
}

/** 멜론 목록 type → 우리 표기 (PRINCIPLES: EP는 미니로 통일) */
const TYPE_MAP = { '정규': '정규', 'EP': '미니', '싱글': '싱글', '디지털': '싱글', 'OST': 'OST' };
const DEFER = new Set(['리믹스', '베스트', '라이브', '재발매', '비정규', '리메이크']);

/* ----------------------------- 앨범 상세 파싱 ----------------------------- */

function parseAlbumDetail(html) {
  const nameBlk = (html.match(/<div class="song_name">[\s\S]{0,400}?<\/div>/) || [''])[0];
  const albumName = dec(nameBlk.replace(/<[^>]*>/g, ' ').replace(/앨범명/, '').replace(/\s+/g, ' '));
  const rel = (html.match(/발매일[\s\S]{0,120}?(\d{4}\.\d{2}\.\d{2})/) || [])[1] || '';

  const tbodyIdx = html.indexOf('<tbody>', html.indexOf('d_song_list'));
  const tracks = [];
  if (tbodyIdx > 0) {
    const body = html.slice(tbodyIdx, html.indexOf('</tbody>', tbodyIdx));
    const rows = body.split('<tr').slice(1);
    rows.forEach((row, i) => {
      // ⚠ 앞 정규식이 "빈 캡처"로 매칭될 수 있어 `A || B` 로 묶으면 폴백이 안 돈다 — 값 기준으로 폴백할 것
      // ⚠ "Physical Album Only" 처럼 스트리밍 불가 트랙은 순번(rank)도 재생링크도 없음 → 곡정보 title 로 회수
      const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] ||
                (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
      if (!t) return;
      const no = Number((row.match(/<span class="rank\s*">(\d+)<\/span>/) || [])[1] || 0) || i + 1;
      tracks.push({ no, title: dec(t), isTitle: /bullet_icons title/.test(row) });
    });
  }
  return { albumName, releaseDate: rel, tracks };
}

/* ------------------------------ 나무위키 검증 ------------------------------ */

// 나무위키는 Node fetch 로는 안 받아짐(회사망 TLS 가로채기 + 봇 차단).
// 검증된 우회: curl -sk + 브라우저 UA  →  [[reference_namuwiki_scraping_workflow]]
// ⚠ 크기로 유효성을 판단하면 안 됨 — 강타(H.O.T.) 처럼 정상 문서도 35KB 짜리가 있고,
//    존재하지 않는 문서도 35KB 로 온다. "문서를 찾을 수 없습니다" 문구가 유일한 신호.
const namuMissing = h => !h || h.length < 5000 || /문서를 찾을 수 없습니다/.test(h);
const readIfValid = f => {
  if (!fs.existsSync(f)) return '';
  const h = fs.readFileSync(f, 'utf8');
  return namuMissing(h) ? '' : h;
};
function curlGet(url, cacheFile) {
  // 한글이 든 URL 은 반드시 퍼센트 인코딩해서 보낼 것 (안 하면 스텁 페이지를 받음)
  try { url = encodeURI(decodeURI(url)); } catch { url = encodeURI(url); }
  const cached = readIfValid(cacheFile);
  if (cached) { cacheHits++; return cached; }
  if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 5000) return '';  // 문서 없음 확정 — 재시도 무의미
  for (let i = 1; i <= 3; i++) {
    try {
      reqCount++;
      execFileSync('curl', ['-sk', '--max-time', '40', '-A', UA, url, '-o', cacheFile], { stdio: 'ignore' });
      const h = readIfValid(cacheFile);
      if (h) return h;
      if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 5000) return '';
    } catch { /* 재시도 */ }
  }
  return '';
}

async function namuText(url, key) {
  const html = curlGet(url, path.join(CACHE_DIR, `namu_${key}.html`));
  if (!html) return '';
  return html.replace(/<script[\s\S]*?<\/script>/g, ' ')
             .replace(/<style[\s\S]*?<\/style>/g, ' ')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&nbsp;/g, ' ')
             .replace(/\s+/g, ' ');
}

/**
 * 나무위키 음반 목록 파싱.
 * 평문으로 펴면 "앨범명 종류표기 2020.03.24." 가 반복되는 구조라, 날짜를 앵커로 끊는다.
 * 날짜는 멜론 발매일과 정확히 맞아서 매칭 키로 가장 강력함(동명 앨범/표기차 영향 없음).
 * ⚠ 앨범명 ±N자 윈도우로 "미니 N집"을 찾으면 옆 앨범 번호를 집어온다 — 반드시 제목 뒤~날짜 사이만 볼 것.
 */
const NAMU_LABEL = '(?:정규|미니|싱글|EP|스페셜|리패키지|디지털 싱글|선공개 싱글|베스트|라이브|OST|리메이크)';
function parseNamuAlbums(text) {
  if (!text) return [];
  const out = [];
  // ⚠ 날짜 표기가 문서/섹션마다 제각각: "2020.03.24." / "2010. 01. 14." / "2010.04.12"(마침표 없음)
  //    공백 허용 + 끝 마침표 선택으로 셋 다 받는다.
  //    제목에 마침표가 들어가는 경우("STYLISH...")가 있어 캡처에서 . 을 막으면 안 된다.
  const re = new RegExp(`([^\\]]{1,60}?)\\s+((?:${NAMU_LABEL})[^0-9]{0,12}(?:\\d+집)?(?:\\s*리패키지)?)\\s+(\\d{4})\\.\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.?(?![0-9])`, 'g');
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 60), m.index);
    const jp = /일본 음반|일본반/.test(before) ? true : undefined;
    out.push({
      // 앞 항목 잔재(직전 앨범의 날짜 등)가 딸려오면 잘라낸다
      title: dec(m[1]).replace(/^.*?\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*/, '').replace(/^[\s\W_]+/, '').trim(),
      label: dec(m[2]).replace(/\s+/g, ' ').trim(),
      date: `${m[3]}.${String(m[4]).padStart(2, '0')}.${String(m[5]).padStart(2, '0')}`,
      idx: m.index,
      jp,
    });
  }
  // ⚠ "일본 음반" 이 한 번이라도 나오면 그 뒤 전부를 일본반으로 보면 안 된다
  //    (에이핑크 섹션의 일본 음반 때문에 정은지 국내 앨범이 전부 일본반으로 잡혔음).
  //    각 항목 바로 앞의 섹션 헤더가 무엇인지로 판정한다.
  const marks = [];
  // ⚠ 여기에 '음반' 같은 짧은 라벨을 넣으면 '일본 음반' 내부에 겹쳐서 일본반 판정을 덮어쓴다
  for (const label of ['한국 음반', '일본 음반', '참여 음반', '음반 목록', '관련 문서', '디스코그래피']) {
    let i = -1;
    while ((i = text.indexOf(label, i + 1)) >= 0) marks.push({ i, label });
  }
  marks.sort((a, b) => a.i - b.i);
  for (const a of out) {
    let cur = null;
    for (const mk of marks) { if (mk.i < a.idx) cur = mk; else break; }
    a.section = cur?.label || '';
    a.jp = cur?.label === '일본 음반' || undefined;
  }
  return out;
}

// NFKC: 나무위키가 𝐆𝐥𝐨𝐰 𝐭𝐨 𝐇𝐚𝐳𝐞 처럼 수학기호 알파벳으로 쓴 제목을 일반 알파벳으로 되돌림
const normTitle = s => (s || '').normalize('NFKC').toLowerCase().replace(/[\s'’"“”()[\]!?.,\-_:&]/g, '');

/** 멜론 앨범 → 나무위키 항목 매칭 (발매일 우선, 제목 보조) */
// ⚠ 멤버 문서의 인포박스엔 "그 멤버 솔로"가 아니라 소속 그룹의 음반 목록이 뜬다.
//    날짜만 맞다고 채택하면 그룹 앨범 번호를 멤버 솔로에 붙이게 되므로, 제목 일치를 반드시 함께 요구한다.
// 괄호 안 한자/부제 표기가 한쪽에만 있는 경우가 많다 — "혜화(暳花)" vs "혜화"
const stripParen = s => (s || '').replace(/[(（[].*?[)）\]]/g, ' ');
const titleAgrees = (a, b) => {
  const pairs = [[a, b], [stripParen(a), stripParen(b)]];
  for (const [p, q] of pairs) {
    const x = normTitle(p), y = normTitle(q);
    if (!x || !y) continue;
    if (x === y) return true;
    if ((x.length >= 4 && y.length >= 4) && (x.includes(y) || y.includes(x))) return true;
  }
  return false;
};

function matchNamu(namuAlbums, album) {
  if (!namuAlbums.length) return null;
  const byDate = namuAlbums.filter(n => n.date === album.releaseDate);
  const dateTitle = byDate.find(n => titleAgrees(n.title, album.title));
  if (dateTitle) return { ...dateTitle, via: '날짜+제목' };
  const byTitle = namuAlbums.filter(n => titleAgrees(n.title, album.title));
  if (byTitle.length === 1) return { ...byTitle[0], via: '제목' };
  // 날짜만 맞고 제목이 다르면 그룹 앨범일 가능성이 커서 채택하지 않음
  if (byDate.length === 1) return { ...byDate[0], via: '날짜만(제목불일치)', weak: true };
  return null;
}

/** 나무위키 표기 → artists.json type 문자열 */
function labelToType(label) {
  if (!label) return null;
  const l = label.replace(/\s+/g, ' ').trim();
  if (/OST/i.test(l)) return { type: 'OST', ok: true };
  const rep = /리패키지/.test(l);
  const m = l.match(/(정규|미니|싱글|EP)\s*(\d+)\s*집/);
  if (m) {
    const kind = m[1] === 'EP' ? '미니' : m[1];
    if (kind === '싱글') return { type: '싱글', ok: true };
    return { type: `${kind} ${m[2]}집${rep ? ' 리패키지' : ''}`, ok: true };
  }
  if (/디지털 싱글|선공개 싱글|^싱글/.test(l)) return { type: '싱글', ok: true };
  if (/스페셜/.test(l)) return { type: '스페셜 앨범', ok: true };
  if (/베스트/.test(l)) return { type: '베스트 앨범', ok: false };
  if (/라이브/.test(l)) return { type: '라이브 앨범', ok: false };
  if (/리메이크/.test(l)) return { type: '리메이크 앨범', ok: false };
  return { type: l, ok: false };
}

/* ---------------------------------- main ---------------------------------- */

const audit = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'result.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const artistList = Object.values(artists);

const ROUND2 = process.argv.includes('--round2');   // 싱글/OST 만 보유한 멤버
let targets = audit.results.filter(r => !r.hasDiscogInJson && (ROUND2 ? (!r.hasMain && r.solo.length > 0) : r.hasMain));
if (ONLY) targets = targets.filter(t => ONLY.has(t.ko));
if (LIMIT) targets = targets.slice(0, LIMIT);

console.log(`[반영안 생성] 대상 ${targets.length}명 / 앨범 ${targets.reduce((s, t) => s + t.solo.length, 0)}장`);

const t0 = Date.now();
let done = 0;
const proposals = [];

await mapLimit(targets, CONCURRENCY, async (m) => {
  const mine = artistList.find(a => a.name?.ko === m.ko && a.group?.ko === m.group);

  // artists.json 의 나무위키 링크가 실제로는 없는 문서를 가리키는 경우가 있어(이효리·강타 등)
  // 표준 후보로 폴백하고, 어떤 링크가 깨졌는지는 리포트로 남긴다.
  const namuCandidates = [
    mine?.links?.namu,
    `https://namu.wiki/w/${m.ko}`,
    `https://namu.wiki/w/${m.ko}(${m.group})`,
    mine?.name?.en ? `https://namu.wiki/w/${mine.name.en}` : null,
  ].filter(Boolean);
  let namu = '', namuUsed = '', namuLinkBroken = false;
  for (let i = 0; i < namuCandidates.length; i++) {
    const key = encodeURIComponent(`${m.ko}_${m.group}_${i}`);
    namu = await namuText(namuCandidates[i], key);
    if (namu) { namuUsed = namuCandidates[i]; namuLinkBroken = i > 0 && !!mine?.links?.namu; break; }
  }

  const albums = [];
  const deferred = [];

  for (const a of m.solo) {
    const listType = (a.type || '').toUpperCase() === 'EP' ? 'EP' : (a.type || '');
    if (DEFER.has(listType)) { deferred.push({ ...a, reason: '앨범종류 보류대상' }); continue; }
    const baseKind = TYPE_MAP[listType] || null;
    if (!baseKind) { deferred.push({ ...a, reason: `미분류 타입(${a.type || '없음'})` }); continue; }

    const html = await get(`https://www.melon.com/album/detail.htm?albumId=${a.albumId}`, `album_${a.albumId}`, 10000);
    if (!html) { deferred.push({ ...a, reason: '앨범상세 수집실패' }); continue; }
    const d = parseAlbumDetail(html);
    const desc = parseDescriptor(d.albumName || a.title);

    albums.push({
      albumId: a.albumId,
      title: desc.clean,
      rawTitle: d.albumName || a.title,
      baseKind,
      descKind: desc.kind, descNo: desc.no,
      releaseDate: d.releaseDate || a.date,
      trackCount: d.tracks.length || a.trackCount,
      cover: a.cover,
      tracks: d.tracks,
      titleTrack: (d.tracks.find(t => t.isTitle) || d.tracks[0] || {}).title || '',
    });
  }

  // --- 종류/번호 확정: 나무위키가 정본. 멜론 [EP] 버킷엔 스페셜·일본반이 섞여 있어
  //     발매일 순 자동 번호는 실제로 틀림(강다니엘: 자동 미니10집 vs 실제 미니6집).
  const namuAlbums = parseNamuAlbums(namu);
  for (const al of albums) {
    const hit = matchNamu(namuAlbums, al);
    al.namu = hit ? { title: hit.title, label: hit.label, date: hit.date, via: hit.via, jp: !!hit.jp } : null;

    let type = null, confidence, note = '';

    // 싱글/OST 는 번호 자체가 없어서 나무위키 대조가 필요 없음 — 검토 목록에서 뺀다
    if (al.baseKind === 'OST' || al.baseKind === '싱글') {
      type = al.baseKind === 'OST' ? 'OST' : '싱글';
      confidence = 'NO_NUM_NEEDED';
    } else if (hit && hit.weak) {
      confidence = 'REVIEW_WEAK';
      note = `나무위키에 같은 날짜 항목이 있으나 제목이 다름("${hit.title}" ${hit.label}) — 그룹 앨범일 수 있음`;
      type = al.baseKind === 'OST' ? 'OST' : al.baseKind === '싱글' ? '싱글' : null;
    } else if (hit) {
      const conv = labelToType(hit.label);
      if (hit.jp) {
        confidence = 'REVIEW_JP';
        note = `나무위키상 일본 음반("${hit.label}") — 국내 넘버링과 섞으면 안 됨`;
        type = conv?.type || null;
      } else if (conv?.ok) {
        confidence = 'NAMU_CONFIRMED';
        note = `나무위키 "${hit.label}" (${hit.via})`;
        type = conv.type;
      } else {
        confidence = 'REVIEW_LABEL';
        note = `나무위키 표기 해석 불가: "${hit.label}"`;
        type = conv?.type || null;
      }
      // 멜론 앨범명에 번호가 박혀있는데 나무위키와 다르면 충돌로 표시
      if (al.descNo && /(\d+)집/.test(type || '')) {
        const n = Number((type.match(/(\d+)집/) || [])[1]);
        if (n !== al.descNo) { confidence = 'CONFLICT'; note = `멜론 앨범명 ${al.descNo}집 vs 나무위키 ${n}집`; }
      }
    } else if (al.baseKind === 'OST') {
      type = 'OST'; confidence = 'NO_NUM_NEEDED';
    } else if (al.baseKind === '싱글') {
      type = '싱글'; confidence = 'NO_NUM_NEEDED';
    } else if (al.descKind && al.descNo) {
      type = `${al.descKind} ${al.descNo}집`; confidence = 'MELON_ONLY';
      note = `멜론 앨범명 표기 "${al.rawTitle}" 기준 (나무위키 미발견)`;
    } else {
      type = null; confidence = 'NO_SOURCE';
      note = `번호 근거 없음 — 나무위키에서 "${al.title}"(${al.releaseDate}) 못 찾음`;
    }

    al.kind = al.baseKind;
    al.confidence = confidence;
    al.note = note;
    al.namuHasAlbum = !!hit;
    al.entry = type ? {
      title: al.title,
      type,
      releaseDate: al.releaseDate,
      trackCount: al.trackCount,
      isMain: type !== 'OST',
      titleTrack: al.titleTrack,
      cover: al.cover,
      tracks: al.tracks,
      ...(type === 'OST' ? { feat: true } : {}),
    } : null;
  }

  // --- 같은 멤버 안에서 번호가 겹치면(미니 1집이 두 장) 둘 다 확인 대상으로 내림
  const seenType = {};
  for (const al of albums) {
    const t = al.entry?.type;
    if (!t || t === '싱글' || t === 'OST') continue;
    (seenType[t] = seenType[t] || []).push(al);
  }
  for (const [t, list] of Object.entries(seenType)) {
    if (list.length < 2) continue;
    for (const al of list) {
      al.confidence = 'CONFLICT';
      al.note = `${t} 번호 중복 — ${list.map(x => `"${x.title}"(${x.releaseDate})`).join(' vs ')}`;
    }
  }

  albums.sort((x, y) => (y.releaseDate || '').localeCompare(x.releaseDate || ''));
  proposals.push({
    ko: m.ko, group: m.group, melonAid: m.melonAid,
    namuUrl: mine?.links?.namu || '', namuFetched: !!namu, namuUsed, namuLinkBroken,
    albums, deferred,
  });

  if (++done % 10 === 0) console.log(`  ...${done}/${targets.length}명 | 요청 ${reqCount} 캐시 ${cacheHits} | ${Math.round((Date.now() - t0) / 1000)}s`);
});

/* --------------------------------- output --------------------------------- */

proposals.sort((a, b) => a.group.localeCompare(b.group) || a.ko.localeCompare(b.ko));
fs.writeFileSync(path.join(OUT_DIR, 'proposal.json'), JSON.stringify(proposals, null, 1));

const stat = {};
for (const p of proposals) for (const a of p.albums) stat[a.confidence] = (stat[a.confidence] || 0) + 1;

const REVIEW = new Set(['CONFLICT', 'NO_SOURCE', 'REVIEW_JP', 'REVIEW_LABEL', 'REVIEW_WEAK', 'MELON_ONLY']);
const needCheck = proposals.flatMap(p => p.albums.filter(a => REVIEW.has(a.confidence)).map(a => ({ p, a })));
const noNamu = proposals.filter(p => !p.namuFetched);
const notInNamu = proposals.flatMap(p => p.albums.filter(a => p.namuFetched && !a.namuHasAlbum && a.kind !== 'OST' && a.kind !== '싱글').map(a => ({ p, a })));

const L = [];
L.push('솔로 디스코 반영안 (Round 1 — 정규/미니 보유 멤버)');
L.push(`대상 ${proposals.length}명 | 반영 예정 앨범 ${proposals.reduce((s, p) => s + p.albums.length, 0)}장 | 보류 ${proposals.reduce((s, p) => s + p.deferred.length, 0)}장`);
L.push(`요청 ${reqCount}건 (캐시 ${cacheHits}건) | 소요 ${Math.round((Date.now() - t0) / 1000)}s`);
L.push('');
L.push('[번호 신뢰도]');
for (const [k, v] of Object.entries(stat).sort((a, b) => b[1] - a[1])) L.push(`  ${k}: ${v}장`);
L.push('');
L.push(`⚠ 사람이 봐야 하는 것: ${needCheck.length}장`);
for (const { p, a } of needCheck) L.push(`   [${a.confidence}] ${p.ko}(${p.group}) — ${a.entry?.type||"?"} "${a.title}" (${a.releaseDate}) ${a.note}`);
L.push('');
L.push(`나무위키 본문에서 앨범명을 못 찾은 정규/미니: ${notInNamu.length}장 (오타·번역명 차이 가능)`);
for (const { p, a } of notInNamu.slice(0, 60)) L.push(`   ${p.ko}(${p.group}) — ${a.entry?.type||"?"} "${a.title}" (${a.releaseDate})`);
if (notInNamu.length > 60) L.push(`   ... 외 ${notInNamu.length - 60}장`);
L.push('');
if (noNamu.length) L.push(`나무위키 수집 실패: ${noNamu.map(p => p.ko).join(', ')}`);
const broken = proposals.filter(p => p.namuLinkBroken);
if (broken.length) {
  L.push('');
  L.push(`⚠ artists.json 나무위키 링크가 없는 문서를 가리킴 — ${broken.length}명 (아래 URL로 교체 필요)`);
  for (const p of broken) L.push(`   ${p.ko}(${p.group})\n      현재: ${p.namuUrl}\n      정상: ${p.namuUsed}`);
}
L.push('');
L.push('='.repeat(70));
L.push('멤버별 반영안');
L.push('='.repeat(70));
for (const p of proposals) {
  L.push(`\n■ ${p.ko} (${p.group}) — ${p.albums.length}장${p.deferred.length ? ` / 보류 ${p.deferred.length}장` : ''}`);
  for (const a of p.albums) L.push(`   ${(a.entry?.type||"(미정)").padEnd(10)} ${a.releaseDate}  ${a.title}  [${a.trackCount}곡, 타이틀:${a.titleTrack}]  <${a.confidence}>`);
  for (const d of p.deferred) L.push(`   (보류) [${d.type}] ${d.date} ${d.title} — ${d.reason}`);
}
fs.writeFileSync(path.join(OUT_DIR, 'review.txt'), L.join('\n'));

console.log('\n' + L.slice(0, 12).join('\n'));
console.log(`\n[완료] ${path.join(OUT_DIR, 'review.txt')} / proposal.json`);
