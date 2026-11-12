#!/usr/bin/env node
// 앨범 수록곡 복원용 근거 만들기 — 멜론 앨범 상세를 받아 album_restore_reference.mjs가 읽는 모양으로(2026-11-12 Codex 검수 후속).
// 앨범 번호가 저장 안 된 앨범은 커버 주소의 멜론 번호를 후보로 쓰고, 멜론 앨범명이 우리 제목과 맞을 때만 채택한다.
// 발매일은 멜론 값을 쓴다(6IXENSE: 우리 2021.07.26 → 실제 2019.10.07).
// 실행: node tools/album_restore_fetch.mjs [--fetch] > out.json   (캐시: ~/Downloads/melon_disco_audit/cache/album_<번호>.html — 다른 멜론 도구와 공유)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);
const CACHE_DIR = path.join(os.homedir(), 'Downloads', 'melon_disco_audit', 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });
const FETCH = process.argv.includes('--fetch');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => (s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#039;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
const tnorm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^0-9a-z가-힣]/g, '');
async function detail(id) {
  const f = path.join(CACHE_DIR, `album_${id}.html`);
  if (fs.existsSync(f) && fs.statSync(f).size > 8000) return fs.readFileSync(f, 'utf8');
  if (!FETCH) return '';
  await sleep(1500);
  try {
    const tmp = f + '.tmp';
    await execFileP('curl', ['-skL', '--max-time', '40', '-A', UA, '-e', 'https://www.melon.com/', `https://www.melon.com/album/detail.htm?albumId=${id}`, '-o', tmp]);
    const s = fs.readFileSync(tmp, 'utf8'); fs.unlinkSync(tmp);
    if (s.length < 8000) { console.error(`  차단/없음 #${id} (${s.length}B)`); return ''; }
    fs.writeFileSync(f, s); return s;
  } catch (e) { console.error(`  실패 #${id} ${e.message}`); return ''; }
}
function parse(html) {
  const nameBlk = (html.match(/<div class="song_name">[\s\S]{0,400}?<\/div>/) || [''])[0];
  const albumName = dec(nameBlk.replace(/<[^>]*>/g, ' ').replace(/앨범명/, '').replace(/\s+/g, ' ')).trim();
  const date = (html.match(/발매일<\/dt>\s*<dd>([\d.]+)<\/dd>/) || [])[1] || '';
  const i = html.indexOf('d_song_list'); const t0 = i < 0 ? -1 : html.indexOf('<tbody>', i);
  const tracks = [];
  if (t0 > 0) {
    const body = html.slice(t0, html.indexOf('</tbody>', t0));
    body.split('<tr').slice(1).forEach(row => {
      const t = (row.match(/title="[^"]*재생">([^<]*)</) || [])[1] || (row.match(/title="(.*?) 곡정보"/) || [])[1] || '';
      if (!t) return;
      const id = (row.match(/data-song-no="(\d+)"/) || row.match(/goSongDetail\('(\d+)'\)/) || [])[1] || '';
      tracks.push({ id, title: dec(t), isTitle: /bullet_icons title/.test(row) });
    });
  }
  return { albumName, date, tracks };
}
const words = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\d+(\.\d+)?\s*집|리패키지|디지털\s*앨범/g, ' ').split(/[^0-9a-z가-힣]+/).filter(w => w.length > 1 || /[가-힣]/.test(w));
const nameOk = (ours, melon) => { const a = tnorm(ours), b = tnorm(melon); if (a && b && (a === b || b.includes(a) || a.includes(b))) return true; const wa = words(ours), wb = new Set(words(melon)); return wa.length > 0 && wa.filter(w => wb.has(w)).length / wa.length >= 0.8; };
// [주인, 우리 앨범 제목, 우리 발매일, 멜론 번호(커버 주소에서)]
const LIST = [
  ['에스에프나인', 'The Wave OF9', '2022.07.05', '11003062'],
  ['빅스', 'CONTINUUM', '2023.11.10', '11369120'],
  ['비투비', 'Brother Act.', '2017.10.26', '10102658'],
  ['펜타곤', 'LOVE or TAKE', '2021.04.13', '10577623'],
  ['에이프릴', 'Da Capo', '2020.04.22', '10421256'],
  ['오마이걸', 'Golden Hourglass', '2023.07.24', '11290943'],
  ['오마이걸', 'Coloring Book', '2017.04.03', '10051269'],
  ['비투비', 'Complete', '2015.06.29', '2326467'],
  ['에이비식스', '6IXENSE', '2021.07.26', '10335957'],
  ['아이콘', 'WELCOME BACK', '2015.10.01', '2640151'],
];
const out = [];
for (const [owner, title, releaseDate, id] of LIST) {
  const h = await detail(id); if (!h) { console.error(`  캐시 없음 ${owner} | ${title}`); continue; }
  const d = parse(h);
  if (!nameOk(title, d.albumName) || !d.tracks.length) { console.error(`  ✗ 앨범명 불일치/곡 없음 ${owner} | ${title} ≠ ${d.albumName} (${d.tracks.length})`); continue; }
  console.error(`  ✓ ${owner} | ${title} ↔ ${d.albumName} ${d.date} · ${d.tracks.length}곡`);
  out.push({ owner, k: 'g', title, releaseDate, date: releaseDate, melonDate: d.date, melonAlbumId: id, officialTitle: d.albumName, reference: d.tracks });
}
console.log(JSON.stringify(out, null, 1));
