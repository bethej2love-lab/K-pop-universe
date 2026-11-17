// 'MV 소식'에서 시상식·수상소감·제작 뒷이야기 영상 거르기(2026-11-17, 사용자: MMA '올해의 뮤직비디오' 수상소감 영상이 MV 배지로 잡혔다).
// 제목에 '뮤직비디오'가 있다는 이유만으로 MV 소식이 되던 것. 진짜 MV·티저는 그대로 남아야 한다 — 낱말 안의 mma(gamma)·'수상한' 같은 일반어는 오탐 금지.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const a = src.indexOf('const _MV_NOISE_RE='), b = src.indexOf('function _collectWeekNews(){');
assert(a >= 0 && b > a, '_MV_NOISE_RE 블록을 못 찾음');
const ctx = {}; vm.createContext(ctx); vm.runInContext(src.slice(a, b) + '\nthis.noise=_mvNewsNoise;', ctx);
const N = (title, content_formats) => ctx.noise({ title, content_formats: content_formats || [] });
let total = 0, failed = 0; const check = (n, f) => { total++; try { f(); } catch (e) { failed++; console.error('FAIL ' + n + ': ' + e.message); } };
check('시상식·수상소감·행사 영상은 MV 소식이 아니다', () => {
  ['[#MMA2026] IVE (아이브) - 올해의 뮤직비디오 #수상소감 | #IVE #아이브 #멜론뮤직어워드 #20261115',
   '[2026 MAMA AWARDS] 에스파 Best Music Video 수상', '[KGMA 2026] 올해의 뮤직비디오 시상', '제38회 골든디스크 어워즈 베스트 뮤직비디오',
   '2026 가요대전 시상식 현장', 'Melon Music Awards 2026 acceptance speech'].forEach(t => assert(N(t), '거름: ' + t));
});
check('시상식 형식 태그(EV:)가 붙은 영상도 거른다', () => assert(N('아이브 - 올해의 뮤직비디오', ['EV:mma', 'EV:mma:2026'])));
check('MV 제작 뒷이야기(Production Meeting·Making·Behind·Reaction·Commentary)는 MV 소식이 아니다', () => {
  ["JUSTB 저스트비 '난리나(Party Time)' MV Production Meeting", "ATEEZ 'UP' M/V MAKING FILM", 'M/V Behind the scenes', "BTS 'Dynamite' MV Reaction", 'MV 메이킹', '뮤비 비하인드', 'MV Commentary'].forEach(t => assert(N(t), '거름: ' + t));
});
check('진짜 MV·티저·티저 예고는 그대로 둔다', () => {
  ["ENHYPEN (엔하이픈) 'I Want You' Official MV", "Keyveatz (키비츠) - 'HAH!' Official MV", 'H1-KEY(하이키) Unbelievable Official M/V', "TXT 'Angel Bite' Official MV",
   "LIGHTSUM 「夜を歩く君へ」Official Music Video", "GIRLSET 'young & dumb' MV Teaser", "제로베이스원 김지웅 - 잊지못해 DON'T FORGET MV", "[MV] YOON JI HWAN _ Still, I Love You"].forEach(t => assert(!N(t), '남김: ' + t));
});
check('일반 낱말은 오탐하지 않는다(gamma·수상한·sma가 든 낱말·making이 곡명)', () => {
  ["Gamma Ray 'Gamma' Official MV", "수상한 그녀 OST MV", "Asmara Official MV", "Lyrics smart MV", 'Karma MV'].forEach(t => assert(!N(t), '남김: ' + t));
});
console.log(total + ' checks / ' + failed + ' failed'); if (failed) process.exitCode = 1;
