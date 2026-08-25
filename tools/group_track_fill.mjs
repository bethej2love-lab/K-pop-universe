#!/usr/bin/env node
// 기존 앨범인데 트랙이 1~2개만 저장된 것들을 멜론 트랙리스트로 채운다(2026-08-26).
// group_disco_fill의 멜론 fetch/parse 로직 재사용 + 아티스트 검색으로 aid 해석.
// 기본은 드라이런(제안만 출력). --apply 주면 groups.json 갱신(백업 후).
// 사용법: node tools/group_track_fill.mjs [--apply] [--groups "엔시티 드림,오마이걸"]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const CACHE_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit', 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PAGE_SIZE = 100;
const APPLY = process.argv.includes('--apply');
const ONLY = (() => { const i = process.argv.indexOf('--groups'); return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null; })();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || '').replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();

let blocked = false;
async function get(url, key, minSize = 2000, referer = 'https://www.melon.com/') {
  const f = path.join(CACHE_DIR, key + '.html');
  if (fs.existsSync(f)) { const b = fs.readFileSync(f, 'utf8'); if (b.length >= minSize) return b; }
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(30000) });
      const b = await res.text();
      if (res.status === 406 || /비정상적인 접근|robot|자동입력 방지/.test(b)) { blocked = true; console.error(`  ⛔ 멜론 차단(status ${res.status}) — 시간 두고 재시도 필요`); return null; }
      if (res.ok && b.length >= minSize) { fs.writeFileSync(f, b); await sleep(150); return b; }
    } catch (e) { await sleep(400 * i); }
  }
  return null;
}
async function resolveAid(name) {
  const html = await get(`https://www.melon.com/search/artist/index.htm?q=${encodeURIComponent(name)}`, `asearch_${name}`, 1500);
  if (!html) return null;
  // 검색결과 아티스트 항목: goArtistDetail('aid') ... class="ellipsis rank01" ... title/텍스트에 이름
  const cands = [];
  for (const m of html.matchAll(/goArtistDetail\('(\d+)'\)[\s\S]{0,200}?class="ellipsis rank01"[\s\S]{0,80}?>([^<]+)</g)) cands.push({ aid: m[1], name: dec(m[2]) });
  if (!cands.length) for (const m of html.matchAll(/goArtistDetail\('(\d+)'\)/g)) cands.push({ aid: m[1], name: '' });
  return cands;
}
function parseAlbumRows(html) {
  const rows = html.split('album11_li').slice(1); const out = [];
  for (const r of rows) {
    const albumId = (r.match(/goAlbumDetail\('(\d+)'\)/) || [])[1]; if (!albumId) continue;
    out.push({ albumId, title: dec((r.match(/class="ellipsis" title="([\s\S]*?) - 페이지 이동">/) || [])[1]), artistAid: (r.match(/goArtistDetail\('(\d+)'\);" title="[^"]*" class="play_artist"/) || [])[1] || null, type: (r.match(/class="vdo_name">\[([^\]]*)\]/) || [])[1] || '', date: (r.match(/class="cnt_view">([\d.]+)</) || [])[1] || '', trackCount: Number((r.match(/class="tot_song">(\d+)곡/) || [])[1] || 0) });
  }
  return out;
}
async function groupAlbums(aid) {
  const all = [], seen = new Set();
  for (let s = 1; s <= 3000; s += PAGE_SIZE) {
    const html = await get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${s}&pageSize=${PAGE_SIZE}&orderBy=ISSUE_DATE&artistId=${aid}`, `galbums_${aid}_${s}`, 1500, `https://www.melon.com/artist/album.htm?artistId=${aid}`);
    if (!html) break; const rows = parseAlbumRows(html);
    const fresh = rows.filter(r => !seen.has(r.albumId)); fresh.forEach(r => seen.add(r.albumId)); all.push(...fresh);
    if (rows.length < PAGE_SIZE || !fresh.length) break;
  }
  return all;
}
function parseAlbumDetail(html) {
  const tbodyIdx = html.indexOf('<tbody>', html.indexOf('d_song_list')); const tracks = [];
  if (tbodyIdx > 0) {
    const body = html.slice(tbodyIdx, html.indexOf('</tbody>', tbodyIdx));
    body.split('<tr').slice(1).forEach((row, i) => {
      const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] || (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
      if (!t) return;
      const no = Number((row.match(/<span class="rank\s*">(\d+)<\/span>/) || [])[1] || 0) || i + 1;
      tracks.push({ no, title: dec(t), isTitle: /bullet_icons title/.test(row) });
    });
  }
  return tracks;
}
const normTitle = s => (s || '').normalize('NFKC').toLowerCase().replace(/[\s'’"“”()（）[\]!?.,\-_:&·]/g, '');
const stripParen = s => (s || '').replace(/[(（[].*?[)）\]]/g, ' ').replace(/-\s*(EP|시즌 스페셜|Repackage).*/i, '');

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const targets = [];
for (const [ko, info] of Object.entries(groups)) {
  if (ONLY && !ONLY.has(ko)) continue;
  (info.discography || []).forEach((al, idx) => {
    const tr = al.tracks || [];
    if (['정규', '미니', '스페셜', 'EP', '리패키지'].includes(al.type) && tr.length <= 2) targets.push({ ko, idx, title: al.title, date: al.releaseDate || al.date, en: info.en });
  });
}
const byGroup = {}; for (const t of targets) (byGroup[t.ko] ||= []).push(t);

const proposals = [];
for (const [ko, items] of Object.entries(byGroup)) {
  const info = groups[ko];
  console.log(`\n■ ${ko} (${items.length}개 앨범)`);
  let aid = null;
  for (const q of [info.en, ko].filter(Boolean)) {
    const cands = await resolveAid(q); if (blocked) break;
    if (cands && cands.length) { aid = cands[0].aid; console.log(`  aid=${aid} (검색 "${q}" → ${cands[0].name || '?'})`); break; }
  }
  if (blocked) break;
  if (!aid) { console.log('  ⚠️ aid 못 찾음 — 스킵'); continue; }
  const albums = await groupAlbums(aid); if (blocked) break;
  const mine = albums.filter(a => a.artistAid === aid || !a.artistAid);
  for (const it of items) {
    const ym = (it.date || '').slice(0, 7); // 연-월(2024.03)까지 봐야 DREAM( )SCAPE↔DREAMSCAPE 같은 동명 충돌 방지
    const cand = mine.find(a => (normTitle(a.title) === normTitle(it.title) || normTitle(stripParen(a.title)) === normTitle(stripParen(it.title))) && (!ym || a.date.startsWith(ym)))
      || mine.find(a => normTitle(a.title).includes(normTitle(stripParen(it.title))) && (!ym || a.date.startsWith(ym)));
    if (!cand) { console.log(`  ✗ [${it.title}] (${it.date}) — 멜론에서 매칭 실패`); continue; }
    const detail = await get(`https://www.melon.com/album/detail.htm?albumId=${cand.albumId}`, `album_${cand.albumId}`, 10000); if (blocked) break;
    const tracks = detail ? parseAlbumDetail(detail) : [];
    if (tracks.length <= (groups[ko].discography[it.idx].tracks || []).length) { console.log(`  ~ [${it.title}] 멜론도 ${tracks.length}곡 — 안 채움`); continue; }
    console.log(`  ✓ [${it.title}] → 멜론 "${cand.title}" (${cand.date}) ${tracks.length}곡: ${tracks.map(t => (t.isTitle ? '★' : '') + t.title).join(' / ')}`);
    proposals.push({ ko, title: it.title, date: it.date, tracks, titleTrack: (tracks.find(t => t.isTitle) || tracks[0] || {}).title || '' });
  }
}
console.log(`\n총 ${proposals.length}개 앨범 채울 수 있음.${blocked ? ' (⛔ 차단으로 중단됨)' : ''}`);
if (APPLY && proposals.length) {
  // ⚠️ groups.json은 커스텀 포맷(일부 배열 inline)이라 JSON.stringify로 통째로 쓰면 전체 리포맷 diff 폭탄.
  // 트랙 배열/trackCount/titleTrack만 라인 단위로 수술적 교체(들여쓰기는 기존 "tracks": [ 줄에서 감지).
  fs.copyFileSync(path.join(ROOT, 'groups.json'), path.join(ROOT, 'groups.json.bak-tracks'));
  let lines = fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8').split('\n');
  let applied = 0;
  for (const p of proposals) {
    const titleJson = '"title": ' + JSON.stringify(p.title);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(titleJson)) { for (let j = i; j < Math.min(i + 14, lines.length); j++) if (lines[j].includes('"releaseDate": "' + p.date + '"')) { start = i; break; } if (start !== -1) break; }
    }
    if (start === -1) { console.log('  apply: 앨범 못 찾음', p.ko, p.title); continue; }
    let ti = -1; for (let j = start; j < Math.min(start + 16, lines.length); j++) if (/^\s*"tracks":\s*\[/.test(lines[j])) { ti = j; break; }
    if (ti === -1) { console.log('  apply: tracks 못 찾음', p.ko, p.title); continue; }
    const ind = lines[ti].match(/^(\s*)/)[1], i2 = ind + '  ', i3 = ind + '    ';
    let close = -1; for (let j = ti + 1; j < lines.length; j++) if (lines[j] === ind + ']') { close = j; break; }
    if (close === -1) { console.log('  apply: tracks 닫힘 못 찾음', p.ko, p.title); continue; }
    // trackCount / titleTrack 라인 갱신(앨범 블록 안, tracks 줄 앞)
    for (let j = start; j < ti; j++) {
      lines[j] = lines[j].replace(/("trackCount":\s*)\d+/, `$1${p.tracks.length}`).replace(/("titleTrack":\s*)"[^"]*"/, `$1${JSON.stringify(p.titleTrack)}`);
    }
    const body = p.tracks.map((t, k) => `${i2}{\n${i3}"no": ${t.no},\n${i3}"title": ${JSON.stringify(t.title)},\n${i3}"isTitle": ${t.isTitle ? 'true' : 'false'}\n${i2}}${k < p.tracks.length - 1 ? ',' : ''}`).join('\n');
    lines.splice(ti, close - ti + 1, `${ind}"tracks": [\n${body}\n${ind}]`);
    lines = lines.join('\n').split('\n'); // splice로 넣은 멀티라인 요소를 다시 분해(다음 검색 안정화)
    applied++;
  }
  const out = lines.join('\n');
  JSON.parse(out); // 유효성 검증(깨졌으면 여기서 throw → 파일 안 씀)
  fs.writeFileSync(path.join(ROOT, 'groups.json'), out);
  console.log(`✅ ${applied}개 앨범 적용 완료 (백업: groups.json.bak-tracks)`);
} else if (proposals.length) {
  console.log('※ 드라이런 — 적용하려면 --apply');
}
