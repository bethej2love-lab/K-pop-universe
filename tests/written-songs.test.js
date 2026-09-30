// "이 사람이 쓴 곡"의 남에게 써준 곡 — 부른 가수 불변식 (2026-10-01)
//
// 배경(사용자 제보): 방예담 작곡 "White-Tee"(YC 곡)가 다이몬 "White Tee"로, "Life is A Movie"(콜드 곡)가 루네이트로 붙어 있었다.
// build_written_songs가 곡명만으로 부른 쪽을 추측했기 때문 — 멜론 크레딧 목록엔 부른 아티스트가 있는데 안 받고 있었다.
// 고친 뒤 96건이 빠졌다(알엠 "이상하지 않은가"→슈가, 이기광 "Chains"→알파드라이브원 …).
// 이 테스트: written_songs.json의 s:0(남에게 써준 곡)은 전부 artist_credits.json에서 **같은 곡의 멜론 부른 가수**가
// 그 주인(그룹·솔로)의 이름과 맞아야 한다. 데이터를 손으로 고치거나 빌드 규칙을 풀어도 여기서 잡힌다.
//
// 실행: node tests/written-songs.test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const W = rd('written_songs.json'), C = rd('artist_credits.json'), A = rd('artists.json'), G = rd('groups.json');

// 곡명 비교 키 — tools/build_written_songs.mjs의 norm과 같아야 한다(버전 표기 "- JP ver." 등을 떼는 규칙까지)
const norm = s => String(s || '').toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, ' ')
  .replace(/-[^-]*ver\.?-?/g, ' ')
  .replace(/\bfeat\..*$/, ' ')
  .replace(/\b(inst\.?|instrumental|mr)\b.*$/, ' ')
  .replace(/\b(japanese|chinese|english)\s*ver.*$/, ' ')
  .replace(/[^a-z0-9가-힣]/g, '');
const nameKey = s => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const nameParts = s => { const m = String(s || '').match(/^(.*?)\s*\((.*)\)\s*$/); return (m ? [m[1], m[2]] : [s]).map(nameKey).filter(Boolean); };
function ownerNames(o) {
  const [p0, p1] = o.split('\u0000'); const out = new Set();
  const g = G[p0];
  if (g) [p0, g.en, ...(g.altNames || [])].forEach(n => nameParts(n).forEach(x => out.add(x)));
  A.filter(a => a.name.ko === p0 && (p1 === undefined || a.group.ko === p1 || !G[p0])).forEach(a =>
    [a.name.ko, a.name.en, a.subName, ...(a.matchAliases || [])].forEach(n => nameParts(n).forEach(x => out.add(x))));
  return out;
}

let n = 0; const bad = [];
for (const [key, list] of Object.entries(W)) for (const x of list) {
  if (x.s) continue;
  n++;
  const cr = C[key] || {};
  const songs = [...(cr.lyrics || []), ...(cr.compose || [])].filter(s => norm(s.title) === norm(x.t));
  const singers = new Set(songs.flatMap(s => (s.artists || []).flatMap(a => nameParts(a.name))));
  const on = ownerNames(x.o);
  if (![...singers].some(s => on.has(s))) bad.push(`${key.replace('\u0000', '/')} → ${x.t} @${x.o.replace('\u0000', '/')} (멜론 가수: ${[...singers].join(', ') || '정보 없음'})`);
}
console.log(`남에게 써준 곡 ${n}건 점검`);
if (bad.length) { bad.slice(0, 20).forEach(b => console.log('❌ ' + b)); console.log(`\n❌ 부른 가수가 안 맞는 연결 ${bad.length}건`); process.exit(1); }
console.log('✅ 전부 멜론 부른 가수와 일치');
