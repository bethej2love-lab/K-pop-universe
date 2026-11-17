// 퍼포먼스 탭 제외 키워드(_LIVE_EXCLUDE) — Codex 추천 상단 검수(2026-11-17): 극장상영 예고편·방송 코너·반응 영상이 live로 저장돼 상단에 올랐다.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const m = /const _LIVE_EXCLUDE=\[([^\]]*)\];/.exec(src); assert(m, '_LIVE_EXCLUDE 없음');
const list = m[1].split(',').map(s => s.trim().replace(/^'|'$/g, ''));
const norm = t => t.normalize('NFKC').toLowerCase();
const hit = t => list.some(k => norm(t).includes(norm(k)));
for (const t of ['BTS WORLD TOUR \'ARIRANG\' LIVE VIEWING FROM KAOHSIUNG & JAKARTA - Official Trailer', '인생은 hell이라 하루의 시작을 매점 hello👋 #인기가요끝나면매점가요2 EP.2', '261114 에스파 무대 보는 하츠투하츠 직캠 (Hearts2Hearts’ reaction to aespa’s performance) | MMA', '콘서트 예고편 공개'])
  assert(hit(t), '걸러져야 함: ' + t.slice(0, 40));
// 진짜 공연은 그대로(곡명 Chain Reaction·일반 무대 제목)
for (const t of ['[MPD직캠] 에스파 카리나 직캠 4K \'Supernova\'', 'Westlife - Chain Reaction (live)', '[#2024MAMA] G-DRAGON - HOME SWEET HOME (feat. 태양, 대성)'])
  assert(!hit(t), '걸러지면 안 됨: ' + t.slice(0, 40));
console.log('✅ 퍼포먼스 제외 키워드: 예고편·매점가요·reaction to 제외, 진짜 공연·곡명은 유지');
