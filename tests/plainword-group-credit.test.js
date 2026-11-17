// 일상어 그룹명(크나큰=형용사)·콜론 없는 원곡 크레딧(| 원곡 X |) — 2026-11-17 Codex 검수: 나혼자산다·놀면뭐하니 클립이 크나큰으로, 라디오 향수 커버가 크나큰 이동원으로 태깅.
const assert = require('assert'), M = require('../tools/m2_harness').load();
let total = 0, failed = 0;
const check = (n, fn) => { total++; try { fn(); } catch (e) { failed++; console.error('FAIL ' + n + ': ' + e.message); } };
const parse = t => M._m2ParseTitle(t, undefined, false, '2024-05-01');
// 1) 형용사 용법은 그룹 근거가 아니다
for (const t of ['[#나혼자산다] 바프를 위한 고강도 아쿠아로빅으로 크나큰 정신적 타격을 입은 현무😵‍💫 | #전현무', '제시를 화나게 한💢 재석의 크나큰 오해😰 [뚜루깔깔] #놀뭐 #shorts'])
  check('형용사 용법 → 그룹 없음 ' + t.slice(0, 20), () => assert.equal(parse(t), null));
// 2) 진짜 그룹 용법은 유지
for (const t of ['[막방아이돌 EP.05 | 크나큰] 서함이의 박살건배', 'KNK, KNOCK (크나큰, KNOCK) | BOF 3stage DAY1 2016', '[IDOL RADIO]큰 사람이 좋다~♥ 크나큰 입장~!!', '크나큰 컴백 쇼케이스', '크나큰 정신적 타격 KNK 컴백 무대', '[아이돌학개론] EP. 크나큰(KNK)'])
  check('그룹 용법 유지 ' + t.slice(0, 20), () => assert.equal(parse(t)?.primaryGroup, '크나큰'));
// 3) 콜론 없는 원곡 크레딧 구간 — 원곡자(이동원)는 출연이 아니다
for (const t of ['[LIVE] 유채훈(YOU CHAEHOON) - 향수 | 원곡 이동원, 박인수 | 정엽의 LP카페', '[LIVE] 손태진(Son Tae Jin), 에녹(Enoch) - 향수 | 원곡 이동원, 박인수 | 최영주의 아침편지'])
  check('원곡 구간 제거 ' + t.slice(0, 20), () => assert.equal(parse(t), null));
check('원곡 구간 제거 — 다른 곡도 그대로 작동', () => assert.equal(parse("빌리의 '불장난' | 원곡 블랙핑크 | STATION Z")?.primaryGroup, '빌리'));
// 4) 문장 속 '원곡'은 건드리지 않는다
check('문장 속 원곡', () => assert.equal(parse('[LIVE] 마마무 - 하늘 땅 | 원곡 그대로 커버')?.primaryGroup, '마마무'));
check('구분선 뒤 원곡 + 진짜 출연자', () => assert.equal(parse('[MPD직캠] 크나큰 동원 직캠 | 원곡 BTS | M2')?.primaryGroup, '크나큰'));
console.log(`${total}검사 / ${failed}실패`); if (failed) process.exitCode = 1;
