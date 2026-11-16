// 팬채널(주인 멤버 지정)이 다른 멤버를 찍은 영상 — 제목의 촬영 대상이 주인 대신 저장된다 (2026-11-16 Codex 직캠 멤버 오태깅 29건)
// 실행: node tests/ext-fan-owner-members.test.js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const H = require('../tools/matcher_harness.cjs');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
function extract(name) {
  const s = admin.indexOf('function ' + name + '('); assert(s >= 0, name + ' 없음');
  let d = 0, i = admin.indexOf('{', s);
  for (; i < admin.length; i++) { if (admin[i] === '{') d++; else if (admin[i] === '}' && --d === 0) break; }
  return admin.slice(s, i + 1);
}
const box = {}; vm.createContext(box); vm.runInContext(extract('_extPickMembers'), box);
const pick = (o, t, tier) => { box.__o = o; box.__t = t; box.__tier = tier; return Array.from(vm.runInContext('_extPickMembers(__o,__t,__tier)', box)); };
let failures = 0;
const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { failures++; console.error('FAIL ' + n + ': ' + e.message); } };

check('팬채널: 제목에 주인이 아닌 멤버만 있으면 그 멤버', () => assert.deepEqual(pick(['우지'], ['호시'], 'fans'), ['호시']));
check('팬채널: 제목에 주인도 있으면 주인 유지(합동·주인 본인)', () => assert.deepEqual(pick(['우지'], ['우지', '호시'], 'fans'), ['우지']));
check('팬채널: 제목에 멤버가 없으면 주인 유지', () => assert.deepEqual(pick(['우지'], [], 'fans'), ['우지']));
check('idol(본인 채널)은 제목의 다른 멤버가 있어도 주인 유지', () => assert.deepEqual(pick(['정한'], ['호시'], 'idol'), ['정한']));
check('공동운영(주인 여럿)은 건드리지 않는다', () => assert.deepEqual(pick(['정수', '주연'], ['가온'], 'fans'), ['정수', '주연']));
check('주인 없음은 그대로(빈 배열)', () => assert.deepEqual(pick([], ['호시'], 'fans'), []));
// 실제 제목 + 실제 매처로 끝까지(코덱스 증거 29건 중 대표): 주인 멤버를 잘못 둔 채널에서 제목의 촬영 대상이 나온다
const CASES = [
  ['세븐틴', '우지', '180203 캐럿랜드 - 울고 싶지 않아 (intro) (호시 Focus)', ['호시']],
  ['에이티즈', '종호', '[4K] 260717-19 Trouble Maker 성화 민기 직캠🐰🐥 I 2026 ATEEZ FANMEETING', ['성화', '민기']],
  ['투모로우바이투게더', '수빈', "4K 연준 직캠 연준아 생일 축하한다 ' Ghost Girl ' (TXT YEONJUN FanCam)", ['연준']],
  ['엑스디너리 히어로즈', '가온', '240907 불꽃놀이의 밤 (Night of Fireworks) - Xdinary Heroes [주연 Focus]', ['주연']],
  ['엑소', '시우민', "150816 EXO'luXion HK Drop that 첸 CHEN focus.", ['첸']],
  ['엔믹스', '배이', '250712 "Press" NMIXX JIWOO 4K Fancam 엔믹스 지우 직캠', ['지우']],
];
for (const [g, owner, title, want] of CASES) check(`실제 제목: ${owner} 채널의 "${title.slice(0, 28)}…" → ${want.join('·')}`, () => {
  const p = H._m2ParseTitle(title, g, false); const tm = (p && p.membersByGroup && p.membersByGroup[g]) || [];
  assert.deepEqual(pick([owner], tm, 'fans'), want);
});
const REAL_OWNER = [ // 반례: 주인 본인을 찍은 영상은 그대로 주인
  ['세븐틴', '정한', '[직캠] 세븐틴 정한 직캠 (JEONGHAN focus)'],
  ['엔믹스', '지우', '250712 "Press" NMIXX JIWOO 4K Fancam 엔믹스 지우 직캠'],
];
for (const [g, owner, title] of REAL_OWNER) check(`반례: ${owner} 채널의 ${owner} 영상은 주인 유지`, () => {
  const p = H._m2ParseTitle(title, g, false); const tm = (p && p.membersByGroup && p.membersByGroup[g]) || [];
  assert.deepEqual(pick([owner], tm, 'fans'), [owner]);
});
check('_extBuildRows가 주인 멤버 저장 자리에 _extPickMembers를 거친다', () => {
  assert.ok(/owner\?\.mko\?_extPickMembers\(owner\.mko\.split/.test(admin));
});
console.log(failures ? '실패 ' + failures : '🎉 팬채널 주인 멤버 테스트 통과');
process.exit(failures ? 1 : 0);
