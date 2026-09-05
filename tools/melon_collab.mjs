// 멜론 참여(F) 탭 수집 — 각 아티스트가 참여(피처링/세션)한 곡 + 그 곡의 메인 아티스트(=콜라보 상대).
// result.json의 멤버 aid로 긁는다. 콜라보 네트워크 엣지용. 중간저장·재개(2026-09-05).
// 결과: /tmp/melon_collab.json { "aid": {ko, group, feats:[{song, artist}]} }
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
let blocked = 0;
const get = url => {
  try { execFileSync('sleep', ['0.4']); } catch (e) {}
  for (let t = 0; t < 3; t++) {
    try {
      const b = execFileSync('curl', ['-sk', '-L', '-m', '45', '-A', UA, '-w', '\\n@@HTTP:%{http_code}', url], { maxBuffer: 1 << 28, encoding: 'binary' });
      const s = Buffer.from(b, 'binary').toString('utf8');
      const i = s.lastIndexOf('\n@@HTTP:');
      const code = i === -1 ? 0 : Number(s.slice(i + 8).trim());
      const body = i === -1 ? s : s.slice(0, i);
      if (code === 200 && body.length > 300) { blocked = 0; return body; }
      if (code === 406 || code === 429) { if (++blocked >= 3) { console.error(`\n❌ 멜론 차단(${code})`); process.exit(3); } execFileSync('curl', ['-s', '-m', '10', '-o', '/dev/null', 'https://www.melon.com/']); }
    } catch (e) {}
  }
  return '';
};
const dec = s => String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

// 참여 곡 목록 — 곡 제목 + 메인 아티스트(그 곡 주인 = 콜라보 상대)
function fetchFeats(aid) {
  const out = []; const seen = new Set();
  for (let idx = 1, g = 0; g < 10; g++, idx += 50) {
    const html = get(`https://www.melon.com/artist/songPaging.htm?startIndex=${idx}&pageSize=50&listType=F&orderBy=ISSUE_DATE&artistId=${aid}`);
    if (!html) break;
    const blocks = html.split("goSongDetail('");
    let added = 0;
    for (const p of blocks.slice(1)) {
      const id = (p.match(/^(\d+)/) || [])[1]; if (!id || seen.has(id)) continue;
      const song = dec((p.match(/title="(.+?) 곡정보/) || [])[1] || '');
      const artist = dec((p.match(/goArtistDetail\('\d+'\);" title="(.+?)( - 페이지 이동)?"/) || [])[1] || '').replace(/ - 페이지 이동$/, '');
      if (!song) continue;
      seen.add(id); out.push({ song, artist }); added++;
    }
    if (added === 0 || blocks.length - 1 < 50) break;
  }
  return out;
}

const OUT = '/tmp/melon_collab.json';
const store = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const members = (JSON.parse(fs.readFileSync(path.join(process.env.HOME, 'Downloads', 'melon_solo_audit', 'result.json'), 'utf8')).results || []).filter(m => m.melonAid);
let done = 0, fresh = 0;
for (const m of members) {
  done++;
  const aid = String(m.melonAid);
  if (store[aid]) continue;
  const feats = fetchFeats(aid);
  store[aid] = { ko: m.ko, group: m.group, feats };
  fresh++;
  fs.writeFileSync(OUT, JSON.stringify(store));
  process.stderr.write(`\r[${done}/${members.length}] +${fresh} ${m.ko} 참여${feats.length}    `);
}
console.log(`\n\n참여 수집 완료 — ${Object.keys(store).length}명 · 이번 신규 ${fresh}`);
