// 멜론 작사/작곡 크레딧 수집 — 아티스트가 참여한 곡(작사=listType L, 작곡=C)을 긁는다 (2026-08-31 신설)
//
// 카드에서 "이 아티스트가 작사/작곡한 곡"을 보여주기 위한 데이터. 멜론 artist/songPaging.htm의 탭:
//   발매=A · 참여=F · 작사=L · 작곡=C  (radio-value 실측). 서버 렌더 HTML이라 파싱 가능.
// ⚠️ 동명이인 방어: melon_solo_fill과 동일하게 이름검색 후보 aid를 **기존 discography 제목 겹침**으로
//    검증해 채택한다(우리 타깃은 솔로 디스코 3+라 이 지문 매칭이 잘 먹는다). 겹침 0이면 건너뜀.
// ⚠️ 멜론 차단(HTTP 406/429): 크기만 보고 성공 처리하면 조용히 0건 스킵됨 → 상태코드로 판정, 3연속이면 중단.
//
// 실행: node tools/melon_credits.mjs 태민 리아 텐        (이름 나열, 결과만 출력 — 저장 X)
//       node tools/melon_credits.mjs 키=629371           (aid 직접 지정, 자동검증 우회)
//       node tools/melon_credits.mjs --top 5             (솔로 디스코 3+ 중 앞 5명 샘플)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const argv = process.argv.slice(2);
const topIdx = argv.indexOf('--top');
const TOP = topIdx !== -1 ? Number(argv[topIdx + 1] || 5) : 0;
const forced = {}; // 이름 → aid 직접 지정
const names = argv.filter(a => !a.startsWith('--') && a !== String(TOP)).map(a => {
  const m = a.match(/^(.+)=(\d+)$/); if (m) { forced[m[1]] = m[2]; return m[1]; } return a;
});

let blocked = 0;
const get = url => {
  for (let t = 0; t < 3; t++) {
    try {
      const b = execFileSync('curl', ['-sk', '-L', '-m', '45', '-A', UA, '-w', '\\n@@HTTP:%{http_code}', url], { maxBuffer: 1 << 28, encoding: 'binary' });
      const s = Buffer.from(b, 'binary').toString('utf8');
      const i = s.lastIndexOf('\n@@HTTP:');
      const code = i === -1 ? 0 : Number(s.slice(i + 8).trim());
      const body = i === -1 ? s : s.slice(0, i);
      if (code === 200 && body.length > 400) { blocked = 0; return body; }
      if (code === 406 || code === 429) {
        if (++blocked >= 3) { console.error(`\n❌ 멜론 차단(HTTP ${code}). 잠시 뒤 재실행.`); process.exit(3); }
        execFileSync('curl', ['-s', '-m', '10', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', 'https://www.melon.com/']);
      }
    } catch (e) { }
  }
  return '';
};
const dec = s => String(s || '').replace(/&nbsp;/gi, ' ').replace(/ /g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

// 앨범 목록(aid 검증용) — 목록의 앨범 제목만 필요
function albumTitles(aid) {
  const out = new Set();
  for (let idx = 1, g = 0; g < 6; g++, idx += 50) {
    const html = get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${idx}&pageSize=50&orderBy=ISSUE_DATE&artistId=${aid}`);
    const rows = [...html.matchAll(/goAlbumDetail\('\d+'\);" title="(.+?) - 페이지 이동"/g)];
    if (!rows.length) break;
    rows.forEach(m => out.add(norm(dec(m[1]))));
    if (rows.length < 50) break;
  }
  return out;
}
// 이름검색 → 후보 aid → discography 제목 겹침으로 검증(동명이인 차단)
function resolveAid(a) {
  const html = get(`https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(a.name.ko)}&section=&searchGnbYn=Y&kkoSpl=Y&kkoDpType=`);
  const cands = [...new Set([...html.matchAll(/goArtistDetail\('?(\d+)/g)].map(m => m[1]))].slice(0, 6);
  const known = new Set((a.discography || []).map(d => norm(d.title)).filter(t => t.length >= 2));
  if (!known.size) return null;
  let best = null;
  for (const aid of cands) {
    const titles = albumTitles(aid);
    if (!titles.size) continue;
    let hit = 0; known.forEach(t => { if (titles.has(t)) hit++; });
    if (!best || hit > best.hit) best = { aid, hit };
    if (hit >= 2) break;
  }
  return best && best.hit >= 1 ? best.aid : null;
}
// 크레딧(작사 L / 작곡 C) 곡 목록 — songId·제목·앨범
function fetchCredits(aid, listType) {
  const out = []; const seen = new Set();
  for (let idx = 1, g = 0; g < 20; g++, idx += 50) {
    const html = get(`https://www.melon.com/artist/songPaging.htm?startIndex=${idx}&pageSize=50&listType=${listType}&orderBy=ISSUE_DATE&artistId=${aid}`);
    if (!html) break;
    const blocks = html.split("goSongDetail('");
    let added = 0;
    for (const p of blocks.slice(1)) {
      const id = (p.match(/^(\d+)/) || [])[1]; if (!id || seen.has(id)) continue;
      const title = dec((p.match(/title="(.+?) 곡정보/) || [])[1] || '');
      const album = dec((p.match(/goAlbumDetail\('\d+'\);" title="(.+?) 앨범정보/) || [])[1] || '');
      if (!title) continue;
      seen.add(id); out.push({ songId: id, title, album }); added++;
    }
    if (added === 0 || blocks.length - 1 < 50) break;
  }
  return out;
}

const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const ARR = Array.isArray(A) ? A : Object.values(A);
let targets;
if (TOP) targets = ARR.filter(a => a.discography && a.discography.length >= 3).slice(0, TOP);
else targets = names.map(n => ARR.find(a => a.name.ko === n) || { name: { ko: n }, discography: [] });

for (const a of targets) {
  const ko = a.name.ko;
  const aid = forced[ko] || resolveAid(a);
  if (!aid) { console.log(`\n[${ko}] aid 못 찾음(디스코 지문 겹침 없음) — 건너뜀`); continue; }
  const lyr = fetchCredits(aid, 'L');
  const com = fetchCredits(aid, 'C');
  console.log(`\n[${ko}] aid ${aid} · 작사 ${lyr.length} · 작곡 ${com.length}`);
  console.log('  작사:', lyr.slice(0, 8).map(s => s.title).join(' / ') + (lyr.length > 8 ? ` …+${lyr.length - 8}` : ''));
  console.log('  작곡:', com.slice(0, 8).map(s => s.title).join(' / ') + (com.length > 8 ? ` …+${com.length - 8}` : ''));
}
