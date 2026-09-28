// 오태깅 순위표(tools/mistag_rank.mjs) 첫 실행에서 나온 4건 회귀 (2026-09-28)
// 막을 것과 살릴 것을 짝으로 — 실제 매처로 돌린다.
const path = require('path');
const { _m2ParseTitle } = require(path.join(__dirname, '..', 'tools', 'matcher_harness.cjs'));
let pass = true;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };
const all = (t, g, d) => { const r = _m2ParseTitle(t, g, false, d); return r ? Object.entries(r.membersByGroup || {}).flatMap(([gk, ms]) => ms.map(m => `${m}(${gk})`)) : []; };

// ① 한 글자 영문명 — "#K-pop"의 #K는 앤팀 케이가 아니다
need(!all('[Radio’Clock] KOREAPEDIA #K-pop songs with the season', undefined, '2026-09-10').includes('케이(앤팀)'), '#K-pop → 케이 아님');
need(all('#K #앤팀 케이 직캠', undefined, '2026-01-01').includes('케이(앤팀)'), '#K 단독 해시태그는 케이');
// ② 곡 제목은 유닛 이름이 아니다 — "Good Boy" 챌린지에 지디·태양이 붙지 않는다
need(!all('#GoodBoy with #SOYEON #아이들 #andTEAM #앤팀', undefined, '2026-09-10').some(x => /지디|태양/.test(x)), '#GoodBoy 챌린지 → 지디·태양 아님');
need(all('GD X TAEYANG - GOOD BOY 0615 SBS Inkigayo', undefined, '2014-12-01').includes('지디(빅뱅)'), '진짜 GD X TAEYANG 무대는 그대로');
need(all('GDXTAEYANG SPECIAL EDITION GOOD BOY TEASER', undefined, '2014-11-01').includes('태양(빅뱅)'), '띄어쓰기 없는 GDXTAEYANG도 인정');
// ③ "'곡' (유닛)"은 원곡 표기 — 출연 아님
need(!all('P1Harmony THEO&KEEHO&JIUNG - ‘Twinkle’ (태티서) LIVE CLIP', '피원하모니', '2026-09-10').some(x => /소녀시대/.test(x)), "'Twinkle' (태티서) 커버 → 태티서 게스트 아님");
need(all('태티서 TTS Twinkle 무대', undefined, '2012-05-01').includes('태연(소녀시대)'), '진짜 태티서 무대는 그대로');
// ④ 동명 신인 그룹 — 드림캐쳐가 제목에 없으면 유닛 유아유가 아니다
need(!all('UAU (유아유) ‘GENE’ | Simply K-Pop EP.14', undefined, '2026-07-10').some(x => /드림캐쳐/.test(x)), '신인 UAU → 드림캐쳐 아님');
need(all('드림캐쳐 유아유 UAU 무대', undefined, '2024-01-01').includes('수아(드림캐쳐)'), '드림캐쳐 유아유는 그대로');

console.log(pass ? '\n✅ 순위표 발견 4건 회귀 통과' : '\n💥 순위표 발견 4건 회귀 실패');
process.exit(pass ? 0 : 1);
