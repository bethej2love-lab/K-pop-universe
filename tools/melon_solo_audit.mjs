#!/usr/bin/env node
// 멜론 솔로 디스코그래피 전수 오디트 (읽기 전용 — artists.json 수정 안 함)
//
// 파이프라인: 그룹명 검색 → 그룹 aid 검증(멤버명 교집합) → 멤버 aid 수집
//             → 멤버별 앨범 목록 전 페이지 순회 → 대표아티스트 aid == 멤버 aid 인 것만 솔로
//
// 핵심(2026-08-23 오디트에서 놓쳤던 것):
//  - 멤버 개인 페이지엔 그룹 앨범도 섞여 나옴 → 제목 대조로는 솔로 판별 불가.
//    목록 행의 `class="play_artist"` aid 가 대표아티스트 크레딧이고, 이게 유일한 신호.
//  - startIndex 는 페이지 번호가 아니라 **행 인덱스(1-base)**. 한 페이지만 읽으면 언더카운트.
//    → 0건 나올 때까지 startIndex += PAGE_SIZE 로 끝까지 순회한다.
//
// 사용법:  node tools/melon_solo_audit.mjs [--groups 그룹명,그룹명] [--no-cache]
//   결과:  ~/Downloads/melon_solo_audit/result.json  +  report.txt

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit');
const CACHE_DIR = path.join(OUT_DIR, 'cache');
const PAGE_SIZE = 100;
const CONCURRENCY = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const USE_CACHE = !argv.includes('--no-cache');
const ONLY_GROUPS = (() => {
  const i = argv.indexOf('--groups');
  return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(',').map(s => s.trim())) : null;
})();

fs.mkdirSync(CACHE_DIR, { recursive: true });

/* ---------------------------------- util ---------------------------------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().replace(/[\s·.\-_'’"()[\]]/g, '');

let reqCount = 0, cacheHits = 0, throttleWaits = 0;

/** 멜론 GET + 디스크 캐시 + 스로틀링 재시도. 실패 시 null. */
async function get(url, cacheKey, { minSize = 2000, referer = 'https://www.melon.com/' } = {}) {
  const cacheFile = path.join(CACHE_DIR, cacheKey + '.html');
  if (USE_CACHE && fs.existsSync(cacheFile)) {
    const body = fs.readFileSync(cacheFile, 'utf8');
    if (body.length >= minSize || body === '__EMPTY__') { cacheHits++; return body === '__EMPTY__' ? '' : body; }
  }
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      reqCount++;
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: referer, 'Accept-Language': 'ko-KR,ko;q=0.9' },
        signal: AbortSignal.timeout(25000),
      });
      const body = await res.text();
      // 빈 페이지 = IP 스로틀링 신호(2026-08-23 세션에서 겪음). 백오프 후 재시도.
      if (res.ok && body.length >= minSize) {
        fs.writeFileSync(cacheFile, body);
        await sleep(120 + Math.floor(attempt * 30));
        return body;
      }
      // 정상적으로 "결과 없음"인 경우(마지막 페이지)는 짧은 본문이 정답이라 호출부가 판단
      if (res.ok && body.length < minSize && attempt >= 2) {
        fs.writeFileSync(cacheFile, body || '__EMPTY__');
        return body;
      }
      throttleWaits++;
      await sleep(1500 * attempt);
    } catch (e) {
      throttleWaits++;
      await sleep(1500 * attempt);
    }
  }
  return null;
}

/** 동시성 제한 매퍼 */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

/* --------------------------------- parsing -------------------------------- */

/** 검색 결과 → [{aid, name}] */
function parseSearchArtists(html) {
  const out = [];
  const re = /goArtistDetail\('?(\d+)'?\)[^>]*title="([^"]*?)(?: - 페이지 이동)?"/g;
  let m;
  while ((m = re.exec(html))) {
    if (!out.some(o => o.aid === m[1])) out.push({ aid: m[1], name: m[2] });
  }
  return out;
}

/** 그룹 상세 → 멤버 [{aid, name}] (그룹멤버 섹션 한정) */
function parseGroupMembers(html) {
  const start = html.indexOf('멤버명');
  if (start < 0) return [];
  const seg = html.slice(start, start + 20000);
  const end = seg.indexOf('atist_info');
  const block = end > 0 ? seg.slice(0, end) : seg;
  const out = [];
  const re = /goArtistDetail\('?(\d+)'?\)"\s+title="([^"]*)"\s+class="atistname"/g;
  let m;
  while ((m = re.exec(block))) {
    if (!out.some(o => o.aid === m[1])) out.push({ aid: m[1], name: m[2] });
  }
  return out;
}

/** 앨범 목록 페이지 → [{albumId, title, type, date, trackCount, artistAid, artistName, cover}] */
function parseAlbumRows(html) {
  const rows = html.split('album11_li').slice(1);
  const out = [];
  for (const r of rows) {
    const albumId = (r.match(/goAlbumDetail\('(\d+)'\)/) || [])[1];
    if (!albumId) continue;
    const title = (r.match(/class="ellipsis" title="([\s\S]*?) - 페이지 이동">/) || [])[1];
    const artistAid = (r.match(/goArtistDetail\('(\d+)'\);" title="[^"]*" class="play_artist"/) || [])[1] || null;
    const artistName = (r.match(/class="play_artist"><span>([^<]*)<\/span>/) || [])[1] || null;
    const type = (r.match(/class="vdo_name">\[([^\]]*)\]/) || [])[1] || '';
    const date = (r.match(/class="cnt_view">([\d.]+)</) || [])[1] || '';
    const trackCount = Number((r.match(/class="tot_song">(\d+)곡/) || [])[1] || 0);
    const cover = (r.match(/src="(https:\/\/cdnimg\.melon\.co\.kr\/cm2\/album\/images\/[^"]+?)\?/) || [])[1] || '';
    out.push({ albumId, title: decodeEntities(title), type, date, trackCount, artistAid, artistName: decodeEntities(artistName), cover });
  }
  return out;
}

function decodeEntities(s) {
  if (!s) return s;
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
}

/* ------------------------------ melon fetchers ----------------------------- */

async function searchArtist(name, key) {
  const url = `https://www.melon.com/search/artist/index.htm?q=${encodeURIComponent(name)}&section=&searchGnbYn=Y&kkoSpl=N`;
  const html = await get(url, `search_${key}`, { minSize: 5000 });
  return html ? parseSearchArtists(html) : [];
}

async function artistDetail(aid) {
  const html = await get(`https://www.melon.com/artist/detail.htm?artistId=${aid}`, `artist_${aid}`, { minSize: 10000 });
  return html || '';
}

/** 멤버 앨범 전 페이지 순회 (언더카운트 방지) */
async function allAlbums(aid) {
  const seen = new Set();
  const all = [];
  for (let startIndex = 1; startIndex <= 3000; startIndex += PAGE_SIZE) {
    const url = `https://www.melon.com/artist/albumPaging.htm?startIndex=${startIndex}&pageSize=${PAGE_SIZE}&orderBy=ISSUE_DATE&artistId=${aid}`;
    const html = await get(url, `albums_${aid}_${startIndex}`, {
      minSize: 1500,
      referer: `https://www.melon.com/artist/album.htm?artistId=${aid}`,
    });
    if (html === null) return { albums: all, incomplete: true };
    const rows = parseAlbumRows(html);
    const fresh = rows.filter(r => !seen.has(r.albumId));
    fresh.forEach(r => seen.add(r.albumId));
    all.push(...fresh);
    if (rows.length < PAGE_SIZE) break;   // 마지막 페이지
    if (fresh.length === 0) break;        // 방어: 같은 페이지 반복
  }
  return { albums: all, incomplete: false };
}

/* ---------------------------------- main ---------------------------------- */

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8')));

// 우리 로스터: 그룹ko -> [멤버]
const roster = new Map();
for (const a of artists) {
  const gk = a.group?.ko;
  if (!gk) continue;
  if (!roster.has(gk)) roster.set(gk, []);
  roster.get(gk).push(a);
}

let groupNames = Object.keys(groups).filter(g => roster.has(g));
if (ONLY_GROUPS) groupNames = groupNames.filter(g => ONLY_GROUPS.has(g));

console.log(`[시작] 그룹 ${groupNames.length}개 / 멤버 ${artists.length}명 / 캐시 ${USE_CACHE ? 'ON' : 'OFF'}`);

const t0 = Date.now();
const results = [];      // 멤버 단위 결과
const groupReport = [];  // 그룹 단위 진단

let done = 0;
await mapLimit(groupNames, CONCURRENCY, async (gname) => {
  const gInfo = groups[gname];
  const members = roster.get(gname) || [];
  const rosterNorm = new Set(members.map(m => norm(m.name?.ko)).concat(members.map(m => norm(m.name?.en))).filter(Boolean));

  // --- 1) 그룹 aid 후보: 한글명 + 영문명 검색
  const cands = [];
  for (const [q, tag] of [[gname, 'ko'], [gInfo?.en, 'en']]) {
    if (!q) continue;
    const found = await searchArtist(q, `${tag}_${encodeURIComponent(gname)}`);
    for (const c of found.slice(0, 6)) if (!cands.some(x => x.aid === c.aid)) cands.push(c);
  }

  // --- 2) 후보 검증: 그룹 페이지 멤버명이 우리 로스터와 얼마나 겹치나
  let best = null;
  for (const c of cands.slice(0, 8)) {
    const html = await artistDetail(c.aid);
    if (!html) continue;
    const mem = parseGroupMembers(html);
    if (!mem.length) continue;
    let hit = 0;
    for (const m of mem) {
      const ko = norm(m.name.split('(')[0]);
      const en = norm((m.name.match(/\(([^)]*)\)/) || [])[1]);
      if (rosterNorm.has(ko) || (en && rosterNorm.has(en))) hit++;
    }
    const score = hit / Math.max(mem.length, 1);
    if (!best || hit > best.hit || (hit === best.hit && score > best.score)) best = { ...c, members: mem, hit, score };
    // 확실한 매칭이면 나머지 후보는 안 열어봄(요청수 절감) — 멤버 과반 일치 + 2명 이상
    if (best.score >= 0.6 && best.hit >= 2) break;
  }

  if (!best || best.hit === 0) {
    groupReport.push({ group: gname, status: 'UNRESOLVED', cands: cands.slice(0, 3).map(c => `${c.name}(${c.aid})`) });
    if (++done % 10 === 0) console.log(`  ...${done}/${groupNames.length} 그룹 (${Math.round((Date.now() - t0) / 1000)}s)`);
    return;
  }

  groupReport.push({
    group: gname, status: 'OK', aid: best.aid, melonName: best.name,
    melonMembers: best.members.length, matched: best.hit, roster: members.length,
  });

  // --- 3) 멜론 멤버 → 우리 멤버 매칭
  for (const mm of best.members) {
    const ko = norm(mm.name.split('(')[0]);
    const en = norm((mm.name.match(/\(([^)]*)\)/) || [])[1]);
    const mine = members.find(m => norm(m.name?.ko) === ko) ||
                 (en ? members.find(m => norm(m.name?.en) === en) : null);
    if (!mine) continue;

    const { albums, incomplete } = await allAlbums(mm.aid);
    const solo = albums.filter(a => a.artistAid === mm.aid);
    results.push({
      ko: mine.name.ko, en: mine.name.en || '', group: gname,
      melonAid: mm.aid, melonName: mm.name,
      totalAlbums: albums.length, incomplete,
      hasDiscogInJson: !!(mine.discography && mine.discography.length),
      jsonDiscogCount: mine.discography?.length || 0,
      solo,
    });
  }

  if (++done % 10 === 0) {
    console.log(`  ...${done}/${groupNames.length} 그룹 | 요청 ${reqCount} 캐시 ${cacheHits} 대기 ${throttleWaits} | ${Math.round((Date.now() - t0) / 1000)}s`);
  }
});

/* --------------------------------- output --------------------------------- */

const TYPE_MAIN = /정규|미니|EP/i;   // 정규/미니(=EP) 보유 = 나무위키 번호대조 대상
const bucket = a => {
  const t = (a.type || '').toUpperCase();
  if (/OST/.test(t)) return 'OST';
  if (/정규/.test(t)) return '정규';
  if (/미니|EP/.test(t)) return '미니';
  if (/싱글|SINGLE/.test(t)) return '싱글';
  return t || '기타';
};

for (const r of results) {
  r.buckets = r.solo.reduce((acc, a) => { const b = bucket(a); acc[b] = (acc[b] || 0) + 1; return acc; }, {});
  r.hasMain = r.solo.some(a => TYPE_MAIN.test(a.type) || /정규|미니/.test(bucket(a)));
}

const withSolo = results.filter(r => r.solo.length > 0);
const newFinds = withSolo.filter(r => !r.hasDiscogInJson);           // 기존 discography 없는데 솔로 보유
const mainHolders = newFinds.filter(r => r.hasMain);                  // 정규/미니 보유
const singleOnly = newFinds.filter(r => !r.hasMain);                  // 싱글/OST만
const incompletes = results.filter(r => r.incomplete);
const unresolved = groupReport.filter(g => g.status === 'UNRESOLVED');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'result.json'), JSON.stringify({
  scannedGroups: groupNames.length,
  resolvedGroups: groupReport.filter(g => g.status === 'OK').length,
  scannedMembers: results.length,
  reqCount, cacheHits, throttleWaits,
  groupReport, results,
}, null, 1));

const L = [];
L.push('멜론 솔로 디스코그래피 전수 오디트 (읽기전용 재수집)');
L.push(`스캔 그룹 ${groupReport.filter(g => g.status === 'OK').length}/${groupNames.length} | 멜론 매칭 멤버 ${results.length}명 | 요청 ${reqCount}건`);
L.push(`솔로 앨범 보유 ${withSolo.length}명 | 그중 artists.json에 discography 없는 멤버 ${newFinds.length}명`);
L.push(`  ├ 정규/미니 보유: ${mainHolders.length}명  (나무위키 번호대조 필요)`);
L.push(`  └ 싱글/OST만:   ${singleOnly.length}명`);
if (incompletes.length) L.push(`⚠ 수집 미완료(스로틀링 등) ${incompletes.length}명 — 재실행 필요: ${incompletes.map(r => r.ko).join(', ')}`);
if (unresolved.length) L.push(`⚠ 멜론 그룹 매칭 실패 ${unresolved.length}개: ${unresolved.map(g => g.group).join(', ')}`);
L.push('');
L.push('='.repeat(70));
L.push(`[A] 정규/미니 보유 — ${mainHolders.length}명`);
L.push('='.repeat(70));
for (const r of mainHolders.sort((a, b) => b.solo.length - a.solo.length)) {
  L.push(`\n■ ${r.ko} (${r.group}) — 솔로 ${r.solo.length}장  ${JSON.stringify(r.buckets)}  aid=${r.melonAid}`);
  for (const a of r.solo) L.push(`   [${a.type || '-'}] ${a.date}  ${a.title}  (${a.trackCount}곡, album=${a.albumId})`);
}
L.push('');
L.push('='.repeat(70));
L.push(`[B] 싱글/OST만 — ${singleOnly.length}명`);
L.push('='.repeat(70));
for (const r of singleOnly.sort((a, b) => b.solo.length - a.solo.length)) {
  L.push(`\n■ ${r.ko} (${r.group}) — 솔로 ${r.solo.length}장  ${JSON.stringify(r.buckets)}  aid=${r.melonAid}`);
  for (const a of r.solo) L.push(`   [${a.type || '-'}] ${a.date}  ${a.title}  (${a.trackCount}곡, album=${a.albumId})`);
}
L.push('');
L.push('='.repeat(70));
L.push(`[C] 이미 artists.json에 discography 있는 멤버 중 멜론 솔로 발견 — ${withSolo.filter(r => r.hasDiscogInJson).length}명 (갭 점검용)`);
L.push('='.repeat(70));
for (const r of withSolo.filter(r => r.hasDiscogInJson)) {
  L.push(`  ${r.ko}(${r.group}): json ${r.jsonDiscogCount}장 / 멜론 솔로 ${r.solo.length}장`);
}

fs.writeFileSync(path.join(OUT_DIR, 'report.txt'), L.join('\n'));

console.log('\n' + L.slice(0, 8).join('\n'));
console.log(`\n[완료] ${Math.round((Date.now() - t0) / 1000)}s`);
console.log(`  ${path.join(OUT_DIR, 'report.txt')}`);
console.log(`  ${path.join(OUT_DIR, 'result.json')}`);
