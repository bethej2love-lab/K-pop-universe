// 직캠 제목의 곡 판정 보강 — 따옴표 안 곡 우선, 따옴표 밖 행사·투어·프로그램명은 곡이 아님 (2026-11-16 Codex 곡 오분류 66+21개 실제 제목)
// 실행: node tests/song-title-refine.test.js
const assert = require('node:assert/strict');
const { refineSongsByTitle } = require('../tools/seo_extra.js');
let failures = 0;
const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { failures++; console.error('FAIL ' + n + ': ' + e.message); } };
// 매처 흉내: 곡 이름이 글에 들어 있으면 그 곡 기본형을 돌려준다(실제 S.f는 정규화·별칭까지 보지만 판정 규칙만 시험하면 된다)
const mk = songs => text => { const T = String(text).toLowerCase(); return Object.entries(songs).filter(([, n]) => T.includes(n)).map(([b]) => b); };
const run = (title, songs) => { const f = mk(songs); return refineSongsByTitle(title, f(title), f); };

check('NCT WISH: 콘서트명 INTO THE WISH 때문에 잡힌 WISH는 빠지고 따옴표 안 Sticky만', () => {
  assert.deepEqual(run("[4K] 260417 재희 'Sticky' FOCUS CAM @INTO THE WISH : OUR WISH ENCORE IN SEOUL", { wish: 'wish', sticky: 'sticky' }), ['sticky']);
  assert.deepEqual(run('【4K】“Ode to Love” 260417 INTO THE WISH : Our WISH Encore Concert SAKUYA FOCUS FANCAM', { wish: 'wish', odetolove: 'ode to love' }), ['odetolove']);
});
check('NEXZ: 컴백쇼명 O-RLY?만 잡히고 따옴표 곡(Simmer)은 목록에 없으면 곡 없음', () => {
  assert.deepEqual(run("[MPD직캠] 넥스지 유키 직캠 4K 'Simmer' (NEXZ YUKI FanCam) | NEXZ COMEBACKSHOW O-RLY?", { orly: 'o-rly' }), []);
});
check('투어명 HELLMATE TOUR 안의 곡명은 곡이 아니다(따옴표 곡 LEGACY가 목록에 없을 때)', () => {
  assert.deepEqual(run("[4K]260531 NEXZ HELLMATE TOUR 'LEGACY' YUKI ユウキ 유키 fancam 직캠", { hellmate: 'hellmate' }), []);
});
check('보존: 따옴표 안에서 곡이 잡히면 그대로(단일 무대)', () => {
  assert.deepEqual(run("[MPD직캠] 아이브 'LOVE DIVE' 직캠 @MCOUNTDOWN", { lovedive: 'love dive' }), ['lovedive']);
  assert.deepEqual(run("250716 ATEEZ IN YOUR FANTASY in Baltimore “Shaboom” SEONGHWA fancam", { infantasy: 'in your fantasy', shaboom: 'shaboom' }), ['shaboom']);
});
check('보존: 투어명과 같은 이름의 곡을 실제로 부른 무대(따옴표 안)', () => {
  assert.deepEqual(run("[직캠] ATEEZ 'IN YOUR FANTASY' 성화 직캠 @MCOUNTDOWN", { infantasy: 'in your fantasy' }), ['infantasy']);
});
check('지명 곡(seoul): in·from·@ 뒤나 Music Awards 앞은 장소 — 곡 아님(2026-11-18 방탄 RM seoul)', () => {
  assert.deepEqual(run("[BANGTAN BOMB] RM's Visit to 2022 BTS EXHIBITION : Proof in Seoul - BTS (방탄소년단)", { seoul: 'seoul' }), []);
  assert.deepEqual(run("[EPISODE] RM 'Live in Seoul' Concert Sketch - BTS (방탄소년단)", { seoul: 'seoul' }), []);
  assert.deepEqual(run('One Bus Ride from Seoul: BTS Spots & K-Drama Sets | Hidden Trip 2 EP.6', { seoul: 'seoul' }), []);
  assert.deepEqual(run('2024 Seoul Music Awards 하이키', { seoul: 'seoul' }), []);
});
check('보존: 지명 곡을 실제로 부른 무대(따옴표·괄호 부제)', () => {
  assert.deepEqual(run("[직캠] 하이키 'Seoul' 휘서 직캠 @MCOUNTDOWN", { seoul: 'seoul' }), ['seoul']);
  assert.deepEqual(run('H1-KEY Seoul (Such a Beautiful) fancam', { seoul: 'seoul' }), ['seoul']);
});
check('따옴표 없는 제목·곡 없음은 건드리지 않는다', () => {
  assert.deepEqual(run('250716 ATEEZ SEONGHWA Shaboom fancam', { shaboom: 'shaboom' }), ['shaboom']);
  assert.deepEqual(refineSongsByTitle('아무 제목', [], () => []), []);
});
check('여러 곡이 잡혔는데 따옴표 안에서는 하나도 안 잡히면 원래대로(합동 무대 보존)', () => {
  assert.deepEqual(run("성한빈 'Killin Me + UNDEAD' @MCOUNTDOWN", { killinme: 'killin me', undead: 'undead' }).sort(), ['killinme', 'undead']);
});
// 곡이 아닌 구조 트랙은 곡 페이지 대상에서 뺀다(2026-11-16 사용자 "성화/s/intro는 노래 제목이 아닌데")
const { STRUCTURAL_TRACKS } = require('../tools/seo_extra.js');
check('구조 트랙(intro·outro·interlude·skit·prologue·epilogue, 한글 포함)은 곡 후보에서 제외', () => {
  for (const b of ['intro', 'outro', 'interlude', 'skit', 'prologue', 'epilogue', '인트로', '아웃트로']) assert.ok(STRUCTURAL_TRACKS.has(b), b);
});
check('실제 곡명일 수 있는 것은 제외하지 않는다(opening·ending·solo·love·me·i)', () => {
  for (const b of ['opening', 'ending', 'solo', 'love', 'me', 'i', 'introperson', 'interludeoasis']) assert.ok(!STRUCTURAL_TRACKS.has(b), b);
});
check('seo_extra 곡 목록 만들기가 그 집합으로 거른다', () => assert.ok(require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'tools', 'seo_extra.js'), 'utf8').includes('.filter(s => !STRUCTURAL_TRACKS.has(s.b))')));
console.log(failures ? '실패 ' + failures : '🎉 곡 제목 보강 테스트 통과');
process.exit(failures ? 1 : 0);
