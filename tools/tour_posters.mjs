// 투어 포스터 수집 — 각 투어(제목)를 위키 문서로 열어 인포박스 image → 실제 URL 해석 (2026-09-05).
// 투어당 1장. 문서 없는(List출처 섹션명) 투어는 포스터 없음. ⚠️ en.wikipedia 비자유 이미지(공정이용).
import { execFileSync } from 'child_process';
import fs from 'fs';
const UA = 'kpopuniverse-tourbot/1.0 (before0hwa@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';
const get = url => { for (let t = 0; t < 4; t++) { try { execFileSync('sleep', ['0.5']); } catch (_) {} try { const b = execFileSync('curl', ['-sk', '-m', '35', '-A', UA, url + (url.includes('?') ? '&' : '?') + 'maxlag=5'], { maxBuffer: 1 << 28, encoding: 'utf8' }); if (/^You are making too many/i.test(b.slice(0, 30))) { execFileSync('sleep', ['5']); continue; } return JSON.parse(b); } catch (e) { try { execFileSync('sleep', ['3']); } catch (_) {} } } return null; };

const RAW1 = JSON.parse(fs.readFileSync('/tmp/tours_raw.json', 'utf8'));
const RAW2 = fs.existsSync('/tmp/tours_raw2.json') ? JSON.parse(fs.readFileSync('/tmp/tours_raw2.json', 'utf8')) : {};
// 유니크 투어명 수집
const tours = new Set();
for (const R of [RAW1, RAW2]) for (const g of Object.keys(R)) for (const s of R[g]) if (s.tour || s.section) tours.add((s.section && s.section.trim()) ? s.section : String(s.tour).replace(/^List of /, '').replace(/ (concert tours|live performances)$/i, ''));
const list = [...tours].filter(t => t && !/^List of/i.test(t));
console.error(`유니크 투어명: ${list.length}`);

const posters = {}; let done = 0, hit = 0;
for (const tour of list) {
  done++;
  const j = get(`${API}?action=parse&page=${encodeURIComponent(tour)}&prop=wikitext&format=json&formatversion=2&redirects=1`);
  const wt = j?.parse?.wikitext || '';
  if (wt) {
    const ci = wt.toLowerCase().indexOf('{{infobox concert');
    const box = ci >= 0 ? wt.slice(ci, ci + 1500) : '';
    const im = box.match(/\|\s*image\s*=\s*([^\n|]+)/i);
    let file = im ? im[1].trim() : '';
    if (file && !/^file:/i.test(file)) file = 'File:' + file;
    if (file) {
      const ij = get(`${API}?action=query&titles=${encodeURIComponent(file)}&prop=imageinfo&iiprop=url&format=json&formatversion=2`);
      const url = ij?.query?.pages?.[0]?.imageinfo?.[0]?.url;
      if (url) { posters[tour] = url.split('?')[0]; hit++; }
    }
  }
  process.stderr.write(`\r[${done}/${list.length}] 포스터 ${hit}    `);
}
fs.writeFileSync('/tmp/tour_posters.json', JSON.stringify(posters));
console.log(`\n완료 — ${hit}/${list.length} 투어에 포스터 → /tmp/tour_posters.json`);
