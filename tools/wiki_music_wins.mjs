#!/usr/bin/env node
// 음악방송 1위 수집 — 영문 위키피디아 "List of {Show} Chart winners ({year})" 표를 파싱해
// music_show_wins에 넣을 import SQL을 만든다(2026-09-04). 표 파싱은 결정적(LLM 아님)이라 정확.
//
// 왜 위키피디아인가: 나무위키는 그룹마다 문서 구조가 제각각이지만, 위키피디아는 방송×연도별 표가
// 일관돼 있고 날짜·곡·아티스트가 셀로 분리돼 있다. 기존 DB는 최근 편중(2020+)이라 옛 연도·2~3세대
// 그룹이 대량 누락 — 이 표들로 채운다. anon키는 쓰기 불가라 SQL만 만들고 사람이 Supabase에 실행.
//
// 사용법: node tools/wiki_music_wins.mjs [--years 2010-2019] [--no-dedup]
//   출력: ~/Downloads/wiki_wins/import.sql  + unmapped.txt(매핑 실패 아티스트) + stats

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT = path.join(os.homedir(), 'Downloads', 'wiki_wins');
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(CACHE, { recursive: true });
const argv = process.argv.slice(2);
const yarg = (() => { const i = argv.indexOf('--years'); if (i < 0) return null; const m = argv[i + 1].match(/(\d{4})-(\d{4})/); return m ? [+m[1], +m[2]] : null; })();
const [Y0, Y1] = yarg || [2008, 2026];
const DEDUP = !argv.includes('--no-dedup');

const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const arts = Array.isArray(A) ? A : Object.values(A);

// ── 방송명 매핑(위키 아티클명 ↔ DB show) ──
const SHOWS = [
  { wiki: 'Music Bank', db: '뮤직뱅크' },
  { wiki: 'Inkigayo', db: '인기가요' },
  { wiki: 'Show! Music Core', db: '쇼음악중심' },
  { wiki: 'M Countdown', db: '엠카운트다운' },
  { wiki: 'Show Champion', db: '쇼챔피언' },
  { wiki: 'The Show', db: '더쇼' },
];
const MONTHS = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };

// ── 아티스트 EN → KO 매핑 ──
const norm = s => (s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[\s'’.\-!:()]/g, '').replace(/^the/, '');
const groupByEn = {};
for (const k of Object.keys(G)) { if (G[k].en) groupByEn[norm(G[k].en)] = k; groupByEn[norm(k)] = k; }
// 위키 표기가 다른 알려진 그룹 별칭
const ALIAS = {
  'girlsgeneration': '소녀시대', 'snsd': '소녀시대', 'wondergirls': '원더걸스', 'exok': '엑소', 'exom': '엑소',
  '2ne1': '투애니원', 'missa': '미쓰에이', '4minute': '포미닛', 'tara': '티아라', 'apink': '에이핑크',
  'gfriend': '여자친구', 'ohmygirl': '오마이걸', 'mamamoo': '마마무', 'got7': '갓세븐', 'monstax': '몬스타엑스',
  'wjsn': '우주소녀', 'cosmicgirls': '우주소녀', 'gugudan': '구구단', 'lovelyz': '러블리즈', 'infinite': '인피니트',
  'sistar': '씨스타', 'kara': '카라', 'girlsday': '걸스데이', 'btob': '비투비', 'nuest': '뉴이스트', 'nuestw': '뉴이스트',
  'vixx': '빅스', 'superjunior': '슈퍼주니어', 'tvxq': '동방신기', 'god': 'god', 'sechskies': '젝스키스',
  'finkl': '핑클', 'babyvox': '베이비복스', 'blockb': '블락비', 'teentop': '틴탑', 'beast': '하이라이트',
  'highlight': '하이라이트', 'b1a4': '비원에이포', 'winner': '위너', 'ikon': '아이콘', 'bigbang': '빅뱅',
  'redvelvet': '레드벨벳', 'twice': '트와이스', 'blackpink': '블랙핑크', 'itzy': '있지', 'aespa': '에스파',
  'ive': '아이브', 'nmixx': '엔믹스', 'lesserafim': '르세라핌', 'newjeans': '뉴진스', 'stayc': '스테이씨',
  'fromis9': '프로미스나인', 'weeekly': '위클리', 'purplekiss': '퍼플키스', 'kep1er': '케플러', 'nixl': '엔싸인',
  'exid': '이엑스아이디', 'aoa': '에이오에이', 'idle': '아이들', 'gidle': '아이들', 'gidle2': '아이들',
  'txt': '투모로우바이투게더', 'tomorrowxtogether': '투모로우바이투게더', 'wannaone': '워너원',
};
const memberByEn = {};
for (const a of arts) { if (a.name && a.name.en) memberByEn[norm(a.name.en)] = a; }

function resolveArtist(enName) {
  const n = norm(enName);
  if (ALIAS[n] !== undefined) return ALIAS[n] ? { group_ko: ALIAS[n], member_ko: null } : null;
  if (groupByEn[n]) return { group_ko: groupByEn[n], member_ko: null };
  const m = memberByEn[n];
  if (m) return { group_ko: '솔로', member_ko: m.name.ko };
  return null;
}

// ── 위키 페이지 가져오기(캐시) ──
function fetchWiki(title) {
  const key = title.replace(/[^\w]/g, '_') + '.html';
  const f = path.join(CACHE, key);
  if (fs.existsSync(f) && fs.statSync(f).size > 2000) return fs.readFileSync(f, 'utf8');
  const url = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'));
  for (let i = 0; i < 3; i++) {
    try { execFileSync('curl', ['-skL', '--max-time', '40', url, '-o', f], { stdio: 'ignore' });
      const h = fs.readFileSync(f, 'utf8'); if (h.length > 2000 && !/Wikipedia does not have an article/.test(h)) return h; } catch {}
  }
  return '';
}

const strip = s => s.replace(/<[^>]+>/g, '\t').replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&').replace(/&[a-z]+;/g, ' ').replace(/\t+/g, '\t').replace(/[ ]+/g, ' ').trim();

function parseYear(html, year) {
  const out = [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
  for (const r of rows) {
    const cells = (r.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || []).map(strip);
    // 날짜 셀 찾기
    const di = cells.findIndex(c => /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/.test(c));
    if (di < 0) continue;
    const dm = cells[di].match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/);
    const mm = MONTHS[dm[1]], dd = +dm[2];
    // 아티스트·곡 = 날짜 다음 셀들. 곡은 보통 따옴표로 감싸짐.
    const rest = cells.slice(di + 1).filter(c => c && !/^\d[\d,]*$/.test(c) && !/^\[[\d\s\]\[]*$/.test(c));
    if (rest.length < 1) continue; // 수상자 없는 주(포인트만)
    let artist = rest[0], song = '';
    const songCell = rest.find(c => /["“]/.test(c));
    if (songCell) song = songCell.replace(/["“”]/g, '').trim();
    if (rest.length >= 2 && !/["“]/.test(rest[0])) { artist = rest[0]; if (!song) song = rest[1].replace(/["“”]/g, '').trim(); }
    artist = artist.replace(/\(.*?\)/g, '').replace(/\s+(feat|featuring|ft)\.?\s.*$/i, '').trim();
    if (!artist) continue;
    const date = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    out.push({ date, artist, song });
  }
  return out;
}

// ── 메인 ──
(async () => {
  // 중복제거용 기존 DB 키
  const existing = new Set();
  if (DEDUP) {
    const BASE = 'https://dukgguehegnembimqvkm.supabase.co', KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
    let fromN = 0;
    while (true) {
      const r = await fetch(BASE + '/rest/v1/music_show_wins?select=group_ko,win_date,show', { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${fromN}-${fromN + 999}` } });
      const b = await r.json(); if (!Array.isArray(b) || !b.length) break;
      b.forEach(x => existing.add(`${x.group_ko}|${x.win_date}|${x.show}`));
      if (b.length < 1000) break; fromN += 1000;
    }
    console.log(`기존 DB 키 ${existing.size}개 로드(중복제거)`);
  }

  const rows = [], unmapped = {};
  let pages = 0;
  for (const show of SHOWS) {
    for (let y = Y0; y <= Y1; y++) {
      const html = fetchWiki(`List of ${show.wiki} Chart winners (${y})`);
      if (!html) continue;
      pages++;
      for (const w of parseYear(html, y)) {
        const res = resolveArtist(w.artist);
        if (!res) { unmapped[w.artist] = (unmapped[w.artist] || 0) + 1; continue; }
        const gko = res.group_ko;
        const dkey = `${gko}|${w.date}|${show.db}`;
        if (existing.has(dkey)) continue;
        existing.add(dkey); // 이번 수집 내 중복도 방지
        rows.push({ show: show.db, win_date: w.date, song_title: w.song || null, group_ko: gko, member_ko: res.member_ko });
      }
    }
  }

  // SQL 생성
  const esc = s => s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`;
  const sql = ['-- music_show_wins 보강 (위키피디아 방송1위 표, ' + Y0 + '-' + Y1 + ')',
    '-- 생성: tools/wiki_music_wins.mjs · Supabase SQL 에디터에서 실행',
    'INSERT INTO music_show_wins (show, win_date, song_title, group_ko, member_ko) VALUES'];
  const vals = rows.map(r => `  (${esc(r.show)}, ${esc(r.win_date)}, ${esc(r.song_title)}, ${esc(r.group_ko)}, ${esc(r.member_ko)})`);
  sql.push(vals.join(',\n') + '\nON CONFLICT DO NOTHING;');
  fs.writeFileSync(path.join(OUT, 'import.sql'), sql.join('\n'));
  const un = Object.entries(unmapped).sort((a, b) => b[1] - a[1]);
  fs.writeFileSync(path.join(OUT, 'unmapped.txt'), un.map(([a, n]) => `${n}\t${a}`).join('\n'));

  // 그룹별 신규 건수
  const byG = {}; rows.forEach(r => byG[r.group_ko] = (byG[r.group_ko] || 0) + 1);
  console.log(`\n페이지 ${pages}개 파싱 · 신규 수상 ${rows.length}건 (그룹 ${Object.keys(byG).length})`);
  console.log('신규 상위:', Object.entries(byG).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([g, n]) => `${g}(${n})`).join(' · '));
  console.log(`매핑 실패 아티스트 ${un.length}종(상위): ` + un.slice(0, 15).map(([a, n]) => `${a}(${n})`).join(', '));
  console.log(`\n→ ${path.join(OUT, 'import.sql')}  ·  unmapped.txt`);
})();
