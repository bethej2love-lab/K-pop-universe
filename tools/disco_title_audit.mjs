#!/usr/bin/env node
// 디스코그래피 "타이틀곡" 감사 — groups.json의 titleTrack/isTitle이 멜론과 다른 앨범을 찾는다.
//
// 왜: 82메이저 FEELM의 타이틀이 2번 'Sign'인데 1번 'W.T.F'로 저장돼 있었다(2026-09-07 사용자 제보).
// 원인은 수집기의 폴백 — 멜론 상세에서 타이틀 표식(`bullet_icons title`)을 하나도 못 찾으면
// `tracks[0]`을 타이틀로 삼는 코드가 여러 스크립트에 있다(group_disco_fill/melon_solo_reflect 등).
// 표식이 정상인 앨범도 그 폴백을 타면 조용히 1번으로 굳는다.
//
// 판정은 멜론 상세 페이지의 타이틀 표식 하나만 본다(정본). 트랙 목록이 저장본과 어긋나면(개수·제목)
// 손대지 않고 리포트만 남긴다 — 다른 판(리패키지·해외반)을 잘못 집어 덮어쓰는 사고를 막기 위해서.
//
// 사용법:
//   node tools/disco_title_audit.mjs                 # 의심 그룹(전 앨범이 1번 타이틀)만 점검, 리포트만
//   node tools/disco_title_audit.mjs --groups 82메이저,레드벨벳
//   node tools/disco_title_audit.mjs --all           # 전체 그룹(느림)
//   node tools/disco_title_audit.mjs --apply         # groups.json에 반영
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const CACHE_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit', 'cache_title_audit');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const APPLY = process.argv.includes('--apply');
const ALL = process.argv.includes('--all');
const ONLY = (() => { const i = process.argv.indexOf('--groups'); return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null; })();
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : 0; })();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/[\s'’"“”()[\]!?.,\-_:&·~]/g, '');
// 곡 제목 동일성 — 멜론은 한글 제목에 영문을 괄호로 붙이는 표기가 흔하다("촉(Choke)" ↔ 저장본 "Choke").
// 괄호 안/밖을 각각 떼어내 한쪽이라도 맞으면 같은 곡으로 본다(2자 이상일 때만 — 짧은 조각의 우연일치 방지).
function agree(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const parts = s => {
    const raw = String(s || '');
    const inner = [...raw.matchAll(/[(（[]([^)）\]]+)[)）\]]/g)].map(m => norm(m[1]));
    const outer = norm(raw.replace(/[(（[][^)）\]]*[)）\]]/g, ' '));
    return [norm(raw), outer, ...inner].filter(v => v && v.length >= 2);
  };
  const pa = parts(a), pb = parts(b);
  return pa.some(p => pb.includes(p));
}

async function get(url, key, referer = 'https://www.melon.com/') {
  const f = path.join(CACHE_DIR, key.replace(/[^A-Za-z0-9_.-]/g, '_') + '.html');
  if (fs.existsSync(f)) { const b = fs.readFileSync(f, 'utf8'); if (b.length > 2000) return b; }
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: referer, 'Accept-Language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(30000) });
      const b = await res.text();
      if (res.ok && b.length > 2000) { fs.writeFileSync(f, b); await sleep(150); return b; }
      await sleep(900 * i);
    } catch { await sleep(900 * i); }
  }
  return null;
}

// 앨범 검색 결과 → [{albumId, album, artist}]
function parseSearch(html) {
  const out = [];
  for (const blk of (html || '').split('<li class="album11_li">').slice(1)) {
    const albumId = (blk.match(/goAlbumDetail\('(\d+)'\)/) || [])[1];
    const album = dec((blk.match(/class="ellipsis" title="([^"]*?) - 페이지 이동"/) || [])[1] || '');
    const artist = dec((blk.match(/<dd class="atistname">[\s\S]*?title="([^"]*?) - 페이지 이동"/) || [])[1] || '');
    if (albumId && album) out.push({ albumId, album, artist });
  }
  return out;
}

function parseDetail(html) {
  const rel = (html.match(/발매일[\s\S]{0,120}?(\d{4}\.\d{2}\.\d{2})/) || [])[1] || '';
  // 상세 페이지는 검색 결과와 마크업이 다르다 — `class="artist_name"><span>82MAJOR(82메이저)</span>`
  const artist = dec((html.match(/<div class="artist">[\s\S]*?class="artist_name"[^>]*><span>([^<]*)</) || [])[1]
    || (html.match(/<div class="artist">[\s\S]*?title="([^"]*?)"/) || [])[1] || '');
  const i = html.indexOf('<tbody>', html.indexOf('d_song_list'));
  const tracks = [];
  if (i > 0) {
    const body = html.slice(i, html.indexOf('</tbody>', i));
    body.split('<tr').slice(1).forEach((row, k) => {
      const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] || (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
      if (!t) return;
      tracks.push({ no: k + 1, title: dec(t), isTitle: /bullet_icons title/.test(row) });
    });
  }
  return { releaseDate: rel, artist, tracks };
}

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

// 기본 대상: "앨범 2개 이상인데 전부 1번 트랙이 타이틀"인 그룹 = 폴백을 탄 흔적
function defaultTargets() {
  const out = [];
  for (const [ko, g] of Object.entries(groups)) {
    const al = (g.discography || []).filter(a => (a.tracks || []).length >= 2);
    if (al.length < 2) continue;
    if (al.every(a => a.tracks.findIndex(t => t.isTitle) === 0)) out.push(ko);
  }
  return out;
}

const targetKos = ONLY ? [...ONLY] : (ALL ? Object.keys(groups) : defaultTargets());
console.log(`대상 그룹 ${targetKos.length}개${ONLY ? '' : ALL ? '(전체)' : '(의심: 전 앨범 1번 타이틀)'}`);

const report = { checked: 0, matched: 0, mismatch: [], notFound: [], trackDiff: [], noMark: [] };
let fixed = 0;

for (const ko of targetKos) {
  const g = groups[ko];
  if (!g) { console.log(`  ? ${ko}: groups.json에 없음`); continue; }
  const albums = (g.discography || []).filter(a => (a.tracks || []).length >= 2);
  for (const a of albums) {
    if (LIMIT && report.checked >= LIMIT) break;
    report.checked++;
    const q = encodeURIComponent(a.title);
    const s = await get(`https://www.melon.com/search/album/index.htm?q=${q}`, `s_${ko}_${a.title}`);
    const cands = parseSearch(s || '');
    if (!cands.length) { report.notFound.push(`${ko} | ${a.title} (검색 결과 없음)`); continue; }
    // 아티스트명이 그룹 한글/영문과 맞는 후보를 우선, 없으면 앨범명이 정확히 같은 것
    const names = [ko, g.en].filter(Boolean).map(norm);
    const artistHit = t => names.some(n => n.length >= 2 && (norm(t).includes(n) || n.includes(norm(t))));
    let pick = cands.find(c => artistHit(c.artist)) || null;
    let detail = null;
    for (const c of (pick ? [pick] : cands.slice(0, 4))) {
      const d = parseDetail(await get(`https://www.melon.com/album/detail.htm?albumId=${c.albumId}`, `a_${c.albumId}`, 'https://www.melon.com/search/album/index.htm') || '');
      if (!d.tracks.length) continue;
      const dateOk = !a.releaseDate || !d.releaseDate || a.releaseDate === d.releaseDate;
      const nameOk = norm(c.album) === norm(a.title);
      const artistOk = artistHit(d.artist) || artistHit(c.artist);
      if ((artistOk && nameOk) || (artistOk && dateOk)) { pick = c; detail = d; break; }
    }
    if (!detail) { report.notFound.push(`${ko} | ${a.title} (아티스트/발매일 일치 후보 없음)`); continue; }
    const melonTitle = detail.tracks.find(t => t.isTitle);
    if (!melonTitle) { report.noMark.push(`${ko} | ${a.title} (멜론에 타이틀 표식 없음 — 그대로 둠)`); continue; }
    // 트랙 목록이 저장본과 어긋나면 손대지 않는다(다른 판일 수 있음).
    // 단 한/영 표기 차이는 같은 곡으로 본다 — 멜론은 "촉(Choke)", 우리 저장본은 "Choke"인 경우가 흔하다.
    const sameTracks = detail.tracks.length === a.tracks.length
      && a.tracks.every((t, i) => agree(t.title, detail.tracks[i].title));
    const curIdx = a.tracks.findIndex(t => t.isTitle);
    const curTitle = curIdx >= 0 ? a.tracks[curIdx].title : (a.titleTrack || '');
    if (agree(curTitle, melonTitle.title)) { report.matched++; continue; }
    if (!sameTracks) {
      report.trackDiff.push(`${ko} | ${a.title} | 저장 ${a.tracks.map(t => t.title).join('/')} ↔ 멜론 ${detail.tracks.map(t => t.title).join('/')}`);
      continue;
    }
    report.mismatch.push(`${ko} | ${a.title} (${a.releaseDate}) | 저장 "${curTitle}" → 멜론 "${melonTitle.title}" (${melonTitle.no}번)`);
    if (APPLY) {
      a.tracks.forEach((t, i) => { t.isTitle = norm(t.title) === norm(melonTitle.title); });
      a.titleTrack = a.tracks.find(t => t.isTitle)?.title || melonTitle.title;
      fixed++;
    }
  }
  if (LIMIT && report.checked >= LIMIT) break;
}

console.log(`\n검사 ${report.checked} · 일치 ${report.matched} · 불일치 ${report.mismatch.length} · 트랙목록 상이 ${report.trackDiff.length} · 후보없음 ${report.notFound.length} · 멜론에 표식없음 ${report.noMark.length}`);
if (report.mismatch.length) console.log('\n[타이틀곡 불일치]\n' + report.mismatch.join('\n'));
if (report.trackDiff.length) console.log('\n[트랙 목록이 달라 보류]\n' + report.trackDiff.slice(0, 30).join('\n'));
if (report.notFound.length) console.log('\n[멜론에서 못 찾음]\n' + report.notFound.slice(0, 30).join('\n'));
if (report.noMark.length) console.log('\n[멜론에 타이틀 표식 없음]\n' + report.noMark.slice(0, 20).join('\n'));

if (APPLY && fixed) {
  fs.writeFileSync(path.join(ROOT, 'groups.json'), JSON.stringify(groups, null, 2) + '\n');
  console.log(`\n✅ groups.json에 ${fixed}건 반영`);
} else if (APPLY) {
  console.log('\n반영할 것 없음');
} else {
  console.log('\n(리포트만 — 반영하려면 --apply)');
}
