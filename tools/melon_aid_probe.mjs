// 동명이인 방어에 걸린 사람의 올바른 멜론 aid 찾기.
// 검색 결과 후보들의 **아티스트 상세 페이지**를 열어 소속그룹/활동유형을 직접 읽는다.
// (앨범 제목 겹침 검증이 0인 경우 = 기존 데이터가 비었거나 표기가 달라서, 사람 눈 확인이 필요)
import { execFileSync } from 'child_process';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const get = u => { for (let t = 0; t < 3; t++) { try { const b = execFileSync('curl', ['-sk', '-L', '-m', '45', '-A', UA, u], { maxBuffer: 1 << 28, encoding: 'binary' }); const s = Buffer.from(b, 'binary').toString('utf8'); if (s.length > 400) return s; } catch (e) { } } return ''; };
const dec = s => String(s || '').replace(/&nbsp;/gi, ' ').replace(/ /g, ' ').replace(/&amp;/g, '&').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

for (const q of process.argv.slice(2)) {
  const h = get(`https://www.melon.com/search/artist/index.htm?q=${encodeURIComponent(q)}&section=artist`);
  const cands = [...new Set([...h.matchAll(/goArtistDetail\('?(\d+)/g)].map(m => m[1]))].slice(0, 8);
  console.log(`\n### "${q}" 후보 ${cands.length}`);
  for (const aid of cands) {
    const d = get(`https://www.melon.com/artist/detail.htm?artistId=${aid}`);
    const name = dec((d.match(/<p class="title_atist">[\s\S]{0,200}?<\/p>/) || [''])[0]).replace(/^아티스트명\s*/, '');
    const info = dec((d.match(/<div class="section_atistinfo03">[\s\S]{0,1500}?<\/div>/) || [''])[0]).slice(0, 220);
    console.log(`  aid ${aid} | ${name}`);
    if (info) console.log(`        ${info}`);
  }
}
