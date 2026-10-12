// 멜론↔스포티파이 "같은 발매 두 장" 불변식 (2026-10-12)
//
// 배경: 스포티파이 일일 수집은 **제목**으로만 중복을 봤다. 멜론 전수 수집이 먼저 넣은 한글 제목
// (`괜찮아 사랑이니까 (from 오늘도 매진했습니다 OST Part 10)`)과 스포티파이 영문 제목
// (`Love Is Enough (from Sold Out On You …)`)은 dedupKey가 달라서 같은 발매가 두 장씩 들어갔다 —
// 실측 105장(OST 대부분 + 한/영 표기 싱글). 스포티파이 쪽은 OST를 '싱글·isMain'으로 넣어서 디스코 본편에
// 그대로 보였다.
// 수집 코드(spotify_disco_sync.mjs)에 "발매일 ±1일 + 트랙 수 같음 + 멜론 항목" 판정과 spotifyId 대조를
// 넣었고, 이 테스트는 **데이터 자체**로 다시 막는다(다른 수집 경로·수동 실행이 또 뚫어도 CI가 빨개지게).
//
// 판정: 같은 주체의 디스코에서 src:'melon' 항목과 다른 출처 항목이 발매일 ±1일 · 트랙 수 같음
//  예외 — 둘 다 feat. 표기가 있고 피처링이 서로 다른 라틴 표기면 별개 버전(르세라핌 BOOMPALA feat. GURU
//         RANDHAWA / feat. SANTOS BRAVOS). 한글·일본어 표기 차이(버벌진트/Verbal Jint)는 같은 발매다.
//  예외 — 레거시(출처 없음) 항목과는 트랙 제목이 하나도 안 겹치면 별개(스텔라 `스파이 명월 OST` / `로켓걸`).
//
// ⚠️ 실패하면 테스트를 고치지 말고 데이터를 볼 것: 같은 발매면 스포티파이 쪽을 지우고 spotifyId를
//    멜론 항목에 옮긴다(그래야 다음 수집이 다시 안 넣는다). 진짜 별개면 아래 ALLOW에 근거와 함께 추가.
//
// 실행: node tests/disco-cross-source-dupes.test.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const groups = require(path.join(ROOT, 'groups.json'));
const artists = require(path.join(ROOT, 'artists.json'));

const ALLOW = new Set([
  // '주체|멜론 제목|상대 제목' — 같은 날·같은 트랙 수지만 실제로 별개인 발매
]);

const ts = d => Date.parse(String(d || '').replace(/\./g, '-'));
const tc = a => a.trackCount || (a.tracks || []).length;
const feat = s => { const m = /feat\.?\s*([^)\]]+)/i.exec(s || ''); return m ? m[1].trim().toLowerCase() : null; };
const latin = s => /^[\x20-\x7e]+$/.test(s);
const nt = s => String(s || '').toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/[^a-z0-9가-힣]/g, '');

const bad = [];
function scan(owner, list) {
  for (const m of list || []) {
    if (m.src !== 'melon') continue;
    for (const s of list) {
      if (s === m || s.src === 'melon') continue;
      if (Math.abs(ts(m.releaseDate) - ts(s.releaseDate)) > 86400000) continue;
      if (!tc(m) || tc(m) !== tc(s)) continue;
      const fm = feat(m.title), fs_ = feat(s.title);
      if (fm && fs_ && fm !== fs_ && latin(fm) && latin(fs_)) continue;
      if (!s.src) { const mt = new Set((m.tracks || []).map(t => nt(t.title))); if (!(s.tracks || []).some(t => mt.has(nt(t.title)))) continue; }
      if (ALLOW.has(`${owner}|${m.title}|${s.title}`)) continue;
      bad.push(`${owner} — ${m.releaseDate} [melon] ${m.title}  ↔  ${s.releaseDate} [${s.src || '레거시'}] ${s.title} (${tc(m)}트랙)`);
    }
  }
}
for (const [k, g] of Object.entries(groups)) scan(k, g.discography);
for (const a of artists) {
  const o = `${a.name?.ko}|${a.group?.ko || ''}`;
  scan(o, a.discography);
  for (const u of a.unitDiscography || []) scan(o + '/unit', u?.albums);
}

if (bad.length) {
  console.error(`❌ 같은 발매가 출처별로 두 장: ${bad.length}건`);
  for (const b of bad.slice(0, 40)) console.error('  ' + b);
  process.exit(1);
}
console.log('✅ 멜론↔스포티파이 같은 발매 중복 없음');
