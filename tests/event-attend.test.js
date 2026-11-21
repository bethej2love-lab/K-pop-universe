// 행사(시상식·페스티벌) 회차 "다녀왔어요" 테스트 (2026-11-16 사용자 "KGMA 검색해서 다녀왔어요 표시")
// 회차 기록은 콘서트 기록(concertLog)에 id "EV:시리즈:회차"로 같이 남는다 — kpop_events엔 없으니 DB 조회에서 빠져야 하고,
// 제목은 _EVENT_SERIES로 만든다. 실행: node tests/event-attend.test.js
const vm = require('node:vm'), assert = require('node:assert/strict');
const src = require('../tools/index_source.cjs').readIndexSource();
function extract(name) {
  const start = src.indexOf('function ' + name + '('); assert(start >= 0, name + ' 없음');
  let d = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(start, i + 1);
}
const box = {
  _EVENT_SERIES: [{ id: 'kgma', ko: 'KGMA (코리아그랜드뮤직어워즈)' }, { id: 'mma', ko: 'MMA (멜론뮤직어워드)' }],
  _EVENT_UPCOMING: [{ id: 'mma', ed: '2026', start: '2026-11-14', place: '고척스카이돔' }],
  _evEdLabel: e => String(e),
};
vm.createContext(box);
vm.runInContext(['_evLogId', '_isEvLogId', '_evLogParse', '_evLogAsEvent'].map(extract).join('\n'), box);
let fail = 0;
const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { fail++; console.error('FAIL ' + n + ': ' + e.message); } };

check('회차 키는 EV:시리즈:회차', () => assert.equal(vm.runInContext("_evLogId('kgma','2026')", box), 'EV:kgma:2026'));
check('콘서트 id(숫자·uuid)는 행사 키가 아니다', () => {
  assert.equal(vm.runInContext('_isEvLogId(123)', box), false);
  assert.equal(vm.runInContext("_isEvLogId('3f2a-uuid')", box), false);
  assert.equal(vm.runInContext("_isEvLogId('EV:kgma:2026')", box), true);
});
check('도시가 붙은 회차(2026-Japan)도 분해된다', () => {
  const p = vm.runInContext("_evLogParse('EV:mama:2026-Japan')", box);
  assert.equal(p.id, 'mama'); assert.equal(p.ed, '2026-Japan');
});
check('제목은 시리즈 이름에서 괄호 설명을 떼고 회차를 붙인다', () => {
  const ev = vm.runInContext("_evLogAsEvent('EV:kgma:2025')", box);
  assert.equal(ev.title, 'KGMA 2025');
  assert.equal(ev.date_start, '2025'); // 날짜를 모르는 지난 회차는 연도만
});
check('알려진 일정(MMA 2026)은 날짜·장소가 붙는다', () => {
  const ev = vm.runInContext("_evLogAsEvent('EV:mma:2026')", box);
  assert.equal(ev.date_start, '2026-11-14'); assert.equal(ev.venue, '고척스카이돔');
});
check('모르는 시리즈는 null', () => assert.equal(vm.runInContext("_evLogAsEvent('EV:none:2026')", box), null));
check('행사 페이지가 다녀왔어요 정보(ctx.attend)를 넘긴다', () => assert.ok(/_openFeedListOverlay\(s\.ko,sub,songs,\{facets,head,attend:ed\?/.test(src)));
check('마이페이지 목록은 행사 키를 DB 조회에서 뺀다', () => assert.ok(/filter\(x=>!_isEvLogId\(x\)\)/.test(src)));
check('검색에서 공연을 고르면 공연 창을 연다', () => assert.ok(/if\(h\.type==='event'\)\{[\s\S]{0,600}_openConcertSheet\(ev\)/.test(src)));
console.log(fail ? '실패 ' + fail : '🎉 행사 다녀왔어요 테스트 통과');
process.exit(fail ? 1 : 0);
