#!/usr/bin/env node
// Round 3 — 그룹 디스코 공백 채우기 (나무위키에 있는 정규/미니인데 groups.json 에 없는 앨범)
//
//  ① 나무위키 한국 음반 구간의 정규/미니 목록을 정본으로 삼아 json 에 없는 앨범을 찾고
//  ② 멜론 그룹 앨범 목록(대표아티스트 == 그룹 aid)에서 같은 앨범을 찾아
//  ③ 앨범 상세로 커버·트랙·타이틀곡을 채워 groups.json 스키마의 엔트리를 만든다.
//  ④ 덤으로, json 에 이미 있으나 번호가 없는 앨범(`미니`/`정규`)은 나무위키 번호로 채운다.
//
// 안전장치: 적용 전 그룹 내부 번호 충돌 시뮬레이션. 충돌 나면 그 그룹은 통째로 건너뛴다.
// 사용법: node tools/group_disco_fill.mjs [--apply] [--groups A,B]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit');
const CACHE_DIR = path.join(OUT_DIR, 'cache');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_SIZE = 100;
const APPLY = process.argv.includes('--apply');
const ONLY = (() => { const i = process.argv.indexOf('--groups'); return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null; })();

const sleep = ms => new Promise(r => setTimeout(r, ms));
let reqCount = 0, cacheHits = 0;

const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();

async function get(url, key, minSize = 2000, referer = 'https://www.melon.com/') {
  const f = path.join(CACHE_DIR, key + '.html');
  if (fs.existsSync(f)) {
    const b = fs.readFileSync(f, 'utf8');
    if (b.length >= minSize) { cacheHits++; return b; }
  }
  for (let i = 1; i <= 4; i++) {
    try {
      reqCount++;
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(30000) });
      const b = await res.text();
      if (res.ok && b.length >= minSize) { fs.writeFileSync(f, b); await sleep(120); return b; }
      if (res.ok && i >= 2) { fs.writeFileSync(f, b); return b; }
      await sleep(1200 * i);
    } catch { await sleep(1200 * i); }
  }
  return null;
}

/* ------------------------------- 나무위키 ------------------------------- */

const namuMissing = h => !h || h.length < 5000 || /문서를 찾을 수 없습니다/.test(h);
const flatten = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
                      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

function readNamu(gname, g) {
  const cands = [g.links?.namu, `https://namu.wiki/w/${gname}`, g.en ? `https://namu.wiki/w/${g.en}` : null].filter(Boolean);
  for (let i = 0; i < cands.length; i++) {
    const f = path.join(CACHE_DIR, `gnamu_${encodeURIComponent(gname)}_${i}.html`);
    if (fs.existsSync(f)) { const h = fs.readFileSync(f, 'utf8'); if (!namuMissing(h)) return h; }
  }
  for (let i = 0; i < cands.length; i++) {
    const f = path.join(CACHE_DIR, `gnamu_${encodeURIComponent(gname)}_${i}.html`);
    try { execFileSync('curl', ['-sk', '--max-time', '40', '-A', UA, encodeURI(cands[i]), '-o', f], { stdio: 'ignore' }); reqCount++; } catch { continue; }
    const h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (!namuMissing(h)) return h;
  }
  return '';
}

const NAMU_LABEL = '(?:정규|미니|싱글|EP|스페셜|리패키지|디지털 싱글|선공개 싱글|베스트|라이브|OST|리메이크)';
function parseNamuAlbums(text) {
  const out = [];
  // 날짜 구분자는 문서마다 "2020.03.24." / "2010. 01. 14." / "2010.04.12" / "2010/06/09" 가 다 있다
  const re = new RegExp(`([^\\]]{1,60}?)\\s+((?:${NAMU_LABEL})[^0-9]{0,12}(?:\\d+집)?(?:\\s*리패키지)?)\\s+(\\d{4})[./]\\s*(\\d{1,2})[./]\\s*(\\d{1,2})\\.?(?![0-9])`, 'g');
  let m;
  while ((m = re.exec(text))) {
    out.push({
      title: dec(m[1]).replace(/^.*?\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*/, '').replace(/^[\s\W_]+/, '').trim(),
      label: dec(m[2]).replace(/\s+/g, ' ').trim(),
      date: `${m[3]}.${String(m[4]).padStart(2, '0')}.${String(m[5]).padStart(2, '0')}`,
      idx: m.index,
    });
  }
  const marks = [];
  for (const label of ['한국 음반', '일본 음반', '참여 음반', '음반 목록', '관련 문서', '디스코그래피']) {
    let i = -1;
    while ((i = text.indexOf(label, i + 1)) >= 0) marks.push({ i, label });
  }
  marks.sort((a, b) => a.i - b.i);
  for (const a of out) {
    let cur = null;
    for (const mk of marks) { if (mk.i < a.idx) cur = mk; else break; }
    a.jp = cur?.label === '일본 음반';
    a.section = cur?.label || '';
  }
  // ⚠ "첫 역행에서 자르기"는 너무 약하다 — 에스파처럼 목록 앞머리에 SMCU 묶음이 끼어
  //    날짜가 잠깐 뒤집히면 한국 음반 전체가 통째로 잘려나간다(파싱 0의 주원인).
  //    방향은 다수결로 정하고, 1년 이상 크게 되감기면서 그 뒤가 다시 단조로울 때만 새 섹션으로 본다.
  markSecondary(out);
  return out;
}

function markSecondary(out) {
  if (out.length < 4) return;
  let up = 0, down = 0;
  for (let i = 1; i < out.length; i++) (out[i].date >= out[i - 1].date ? up++ : down++);
  const asc = up >= down;
  const days = (a, b) => Math.abs(new Date(a.replace(/\./g, '-')) - new Date(b.replace(/\./g, '-'))) / 86400000;
  for (let i = 1; i < out.length; i++) {
    const back = asc ? out[i].date < out[i - 1].date : out[i].date > out[i - 1].date;
    // 1년 이상 크게 되감기는 첫 지점부터 잘라낸다.
    // ⚠ "그 뒤가 단조로울 때만" 조건을 달았더니 일본 음반 구간이 통과해 씨엔블루 Stay Gold·
    //    SF9 GOLDEN ECHO·데이식스 The DECADE 같은 일본 앨범이 국내 정규로 추가됐다(되돌림).
    //    작은 흔들림(에스파 SMCU 묶음 등)만 무시하고, 큰 되감기는 무조건 새 구간으로 본다.
    if (!back || days(out[i].date, out[i - 1].date) < 300) continue;
    for (let j = i; j < out.length; j++) out[j].secondary = true;
    return;
  }
  return out.filter(n => !n.jp && !n.secondary && n.section !== '참여 음반');
}

/* --------------------------------- 멜론 --------------------------------- */

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
      type: (r.match(/class="vdo_name">\[([^\]]*)\]/) || [])[1] || '',
      date: (r.match(/class="cnt_view">([\d.]+)</) || [])[1] || '',
      trackCount: Number((r.match(/class="tot_song">(\d+)곡/) || [])[1] || 0),
      // ⚠ 구형 앨범은 /cm/album/, 신형은 /cm2/album/ 이고 뒤에 "?" 가 없는 경우도 있다(커버 886장 누락 원인)
      cover: (r.match(/src="(https:\/\/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/[^"]+?)(?:\?|\/melon\/)/) || [])[1] || '',
    });
  }
  return out;
}

async function groupAlbums(aid) {
  const all = [], seen = new Set();
  for (let s = 1; s <= 3000; s += PAGE_SIZE) {
    const html = await get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${s}&pageSize=${PAGE_SIZE}&orderBy=ISSUE_DATE&artistId=${aid}`,
      `galbums_${aid}_${s}`, 1500, `https://www.melon.com/artist/album.htm?artistId=${aid}`);
    if (!html) break;
    const rows = parseAlbumRows(html);
    const fresh = rows.filter(r => !seen.has(r.albumId));
    fresh.forEach(r => seen.add(r.albumId));
    all.push(...fresh);
    if (rows.length < PAGE_SIZE || !fresh.length) break;
  }
  return all;
}

function parseAlbumDetail(html) {
  const nameBlk = (html.match(/<div class="song_name">[\s\S]{0,400}?<\/div>/) || [''])[0];
  const albumName = dec(nameBlk.replace(/<[^>]*>/g, ' ').replace(/앨범명/, '').replace(/\s+/g, ' '));
  const rel = (html.match(/발매일[\s\S]{0,120}?(\d{4}\.\d{2}\.\d{2})/) || [])[1] || '';
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
  return { albumName, releaseDate: rel, tracks };
}

/* -------------------------------- 매칭 유틸 -------------------------------- */

const normTitle = s => (s || '').normalize('NFKC').toLowerCase().replace(/[\s'’"“”()[\]!?.,\-_:&·]/g, '');
const stripParen = s => (s || '').replace(/[(（[].*?[)）\]]/g, ' ');
const titleAgrees = (a, b) => {
  for (const [p, q] of [[a, b], [stripParen(a), stripParen(b)]]) {
    const x = normTitle(p), y = normTitle(q);
    if (!x || !y) continue;
    if (x === y) return true;
    if ((x.length >= 5 && y.length >= 5) && (x.includes(y) || y.includes(x))) return true;
  }
  return false;
};
const kindOf = t => {
  const m = (t || '').match(/^(정규|미니|싱글)\s*(\d+)?집?/);
  return m ? { kind: m[1], no: m[2] ? Number(m[2]) : null } : { kind: (t || '').trim(), no: null };
};
const labelToType = label => {
  const l = (label || '').replace(/^EP/, '미니');
  if (/리패키지/.test(l)) return null;
  const m = l.match(/(정규|미니)\s*(\d+)\s*집/);
  return m ? `${m[1]} ${m[2]}집` : null;
};
const dayDiff = (a, b) => Math.abs(new Date(a.replace(/\./g, '-')) - new Date(b.replace(/\./g, '-'))) / 86400000;

/* ---------------------------------- main ---------------------------------- */

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'result.json'), 'utf8'));
const aidOf = Object.fromEntries(audit.groupReport.filter(g => g.status === 'OK').map(g => [g.group, g.aid]));

let names = Object.keys(groups).filter(k => groups[k].discography?.length && aidOf[k]);
if (ONLY) names = names.filter(n => ONLY.has(n));

console.log(`[Round 3] 대상 ${names.length}개 그룹`);

const added = [], numbered = [], notOnMelon = [], skipped = [];
let done = 0;

for (const gname of names) {
  const g = groups[gname];
  const html = readNamu(gname, g);
  if (!html) { skipped.push(`${gname}: 나무위키 문서 없음`); continue; }
  const namu = parseNamuAlbums(flatten(html)).filter(n => labelToType(n.label));
  if (!namu.length) { skipped.push(`${gname}: 나무위키 정규/미니 목록 파싱 0`); continue; }

  // 나무위키 항목 하나에 json 여러 장이 붙으면 그 그룹 번호 체계를 못 믿는다
  const claims = new Map();
  for (const d of g.discography) {
    const hit = namu.find(n => titleAgrees(n.title, d.title));
    if (hit) { if (!claims.has(hit)) claims.set(hit, []); claims.get(hit).push(d); }
  }
  if ([...claims.values()].some(l => l.length > 1)) { skipped.push(`${gname}: 나무위키 1항목에 json 여러 장 매칭 — 건너뜀`); continue; }

  // ⚠ 나무위키가 같은 앨범을 두 번 싣는 경우가 있다(시리즈 박스 + 음반 목록).
  //    claims 는 json 1장당 나무위키 1개만 잡으므로, 남은 쪽이 "누락"으로 보여 중복 추가된다(실제 16장 발생).
  //    반드시 json 전체와 다시 대조해서 거른다.
  const missing = namu.filter(n => !claims.has(n) && !g.discography.some(d => titleAgrees(d.title, n.title)));
  const fillTargets = [...claims.entries()].filter(([n, [d]]) => !kindOf(d.type).no && labelToType(n.label));
  if (!missing.length && !fillTargets.length) { if (++done % 20 === 0) console.log(`  ...${done}/${names.length}`); continue; }

  // 멜론 그룹 앨범 목록
  const mAlbums = (await groupAlbums(aidOf[gname])).filter(a => a.artistAid === aidOf[gname]);

  const groupAdds = [];
  for (const n of missing) {
    // ⚠ "날짜만 맞으면 채택" 폴백은 금지 — 나무위키에 없는 일본 앨범(씨엔블루 Stay Gold)이
    //    같은 날짜라는 이유로 국내 정규로 들어왔다. 제목이 맞아야만 채택한다.
    const cand = mAlbums.find(a => titleAgrees(a.title, n.title) && dayDiff(a.date || n.date, n.date) <= 45) ||
                 mAlbums.find(a => titleAgrees(a.title, n.title));
    if (!cand) { notOnMelon.push({ gname, label: n.label, title: n.title, date: n.date }); continue; }
    // 나무위키 제목 파싱이 흔들려 "누락"으로 잡혔더라도, 멜론 제목이 기존 항목과 같으면 이미 있는 앨범이다
    if (g.discography.some(d => titleAgrees(d.title, cand.title) || d.releaseDate === cand.date)) continue;
    // 변형판(… Ver./Edition)이 원판 대신 잡히는 걸 막는다 — 나무위키 제목에 없는 표기면 후보에서 뺀다
    const variant = /\((?:[^)]*(?:ver\.?|version|edition|리패키지|repackage)[^)]*)\)/i;
    if (variant.test(cand.title) && !variant.test(n.title)) {
      const plain = mAlbums.find(a => titleAgrees(a.title, n.title) && !variant.test(a.title));
      if (plain) Object.assign(cand, plain); else { notOnMelon.push({ gname, label: n.label, title: n.title, date: n.date, why: '변형판만 있음' }); continue; }
    }
    const detail = await get(`https://www.melon.com/album/detail.htm?albumId=${cand.albumId}`, `album_${cand.albumId}`, 10000);
    if (!detail) { notOnMelon.push({ gname, label: n.label, title: n.title, date: n.date, why: '상세 수집 실패' }); continue; }
    const d = parseAlbumDetail(detail);
    // 정규/미니라면서 곡이 2곡 이하면 싱글을 잘못 집은 것 (오메가엑스 "Dream" 1곡짜리 미니 3집 사례)
    const cnt = d.tracks.length || cand.trackCount;
    if (cnt < 3) { notOnMelon.push({ gname, label: n.label, title: n.title, date: n.date, why: `${cnt}곡뿐 — 싱글 오매칭 의심` }); continue; }
    groupAdds.push({
      gname, type: labelToType(n.label), namuTitle: n.title,
      entry: {
        title: cand.title || d.albumName || n.title,
        type: labelToType(n.label),
        isMain: true,
        cover: cand.cover,
        releaseDate: d.releaseDate || cand.date || n.date,
        trackCount: d.tracks.length || cand.trackCount,
        titleTrack: (d.tracks.find(t => t.isTitle) || d.tracks[0] || {}).title || '',
        tracks: d.tracks,
      },
    });
  }

  const groupNums = fillTargets.map(([n, [d]]) => ({ gname, d, from: d.type, to: labelToType(n.label), title: d.title }));

  // 충돌 시뮬레이션 (전체 문자열 일치 기준)
  const sim = new Map(groupNums.map(x => [x.d, x.to]));
  const seen = new Map();
  let clash = null;
  for (const d of g.discography.concat(groupAdds.map(a => a.entry))) {
    const t = sim.get(d) ?? d.type;
    if (!/^(정규|미니)\s*\d+집$/.test(t)) continue;
    if (seen.has(t)) { clash = `${t}: "${seen.get(t)}" vs "${d.title}"`; break; }
    seen.set(t, d.title);
  }
  if (clash) { skipped.push(`${gname}: 적용 시 번호 충돌(${clash}) — 그룹 전체 건너뜀`); continue; }

  added.push(...groupAdds);
  numbered.push(...groupNums);
  if (++done % 20 === 0) console.log(`  ...${done}/${names.length} | 요청 ${reqCount} 캐시 ${cacheHits}`);
}

/* --------------------------------- 출력 --------------------------------- */

const L = [];
L.push('Round 3 — 그룹 디스코 공백 채우기');
L.push(`추가 예정 ${added.length}장 | 번호 채우기 ${numbered.length}장 | 멜론에 없어 보류 ${notOnMelon.length}장 | 건너뛴 그룹 ${skipped.length}`);
L.push(`요청 ${reqCount} 캐시 ${cacheHits}`);
L.push('');
const byG = {};
for (const a of added) (byG[a.gname] = byG[a.gname] || []).push(a);
L.push('='.repeat(70)); L.push('[추가]'); L.push('='.repeat(70));
for (const [g, list] of Object.entries(byG).sort((a, b) => b[1].length - a[1].length)) {
  L.push(`\n■ ${g} (+${list.length})`);
  for (const a of list) L.push(`   ${a.entry.type.padEnd(9)} ${a.entry.releaseDate}  ${a.entry.title}  [${a.entry.trackCount}곡, 타이틀:${a.entry.titleTrack}]`);
}
const byG2 = {};
for (const n of numbered) (byG2[n.gname] = byG2[n.gname] || []).push(n);
L.push(''); L.push('='.repeat(70)); L.push('[번호 채우기]'); L.push('='.repeat(70));
for (const [g, list] of Object.entries(byG2)) L.push(`■ ${g}: ${list.map(x => `"${x.title}" ${x.from}→${x.to}`).join(', ')}`);
L.push(''); L.push('='.repeat(70)); L.push(`[멜론에서 못 찾음 — ${notOnMelon.length}장]`); L.push('='.repeat(70));
for (const x of notOnMelon) L.push(`   ${x.gname}: ${x.label} "${x.title}" (${x.date})${x.why ? ' — ' + x.why : ''}`);
L.push(''); L.push('='.repeat(70)); L.push(`[건너뛴 그룹 — ${skipped.length}]`); L.push('='.repeat(70));
skipped.forEach(s => L.push('   ' + s));
fs.writeFileSync(path.join(OUT_DIR, 'round3_report.txt'), L.join('\n'));
console.log('\n' + L.slice(0, 3).join('\n'));

if (!APPLY) { console.log(`\n[dry] 저장 안 함 — ${path.join(OUT_DIR, 'round3_report.txt')}`); process.exit(0); }

for (const n of numbered) n.d.type = n.to;
for (const a of added) groups[a.gname].discography.push(a.entry);
for (const gname of new Set(added.map(a => a.gname))) {
  groups[gname].discography.sort((x, y) => (y.releaseDate || '').localeCompare(x.releaseDate || ''));
}
if (!fs.existsSync(path.join(ROOT, 'groups.json.bak-round3'))) fs.copyFileSync(path.join(ROOT, 'groups.json'), path.join(ROOT, 'groups.json.bak-round3'));
fs.writeFileSync(path.join(ROOT, 'groups.json'), JSON.stringify(groups, null, 2));
console.log(`\ngroups.json 저장 완료 — 추가 ${added.length}장 / 번호 ${numbered.length}장`);
