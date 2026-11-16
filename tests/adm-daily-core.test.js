// 관리자 Daily 핵심 세 줄 (2026-11-16 Codex 개편안 + 사용자 승인) — 앱 방문자 / 첫날 저장한 신규(분자/분모) / 신규 7일 내 재방문(관찰 끝난 집단)
// 실행: node tests/adm-daily-core.test.js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', '2026-11-16_app_core_metrics.sql'), 'utf8');
function extract(name) {
  const s = admin.indexOf('function ' + name + '('); assert(s >= 0, name + ' 없음');
  let d = 0, i = admin.indexOf('{', s);
  for (; i < admin.length; i++) { if (admin[i] === '{') d++; else if (admin[i] === '}' && --d === 0) break; }
  return admin.slice(s, i + 1);
}
const box = {}; vm.createContext(box); vm.runInContext(extract('_admCoreLines') + '\n' + extract('_admCoreHtml'), box);
let failures = 0;
const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { failures++; console.error('FAIL ' + n + ': ' + e.message); } };
// 11-16 실측과 같은 모양(운영 DB get_app_core 결과)
const CORE = { v: { w: { visitors: 62, new: 60, saved: 3, played: 25 }, wp: { visitors: 63, new: 63, saved: 2, played: 24 } }, ret: { c1: { cohort: 63, returned: 0 }, c0: { cohort: 36, returned: 1 } }, settled30: 0, stale_h: 7.8 };
const lines = c => { box.__c = c; return vm.runInContext('_admCoreLines(__c)', box); };

check('세 줄: 방문자·첫날 저장·7일 재방문 순서', () => assert.deepEqual(Array.from(lines(CORE).lines, x => x.key), ['visitors', 'saved', 'ret']));
check('방문자 = 숫자, 신규는 보조 줄', () => { const v = lines(CORE).lines[0]; assert.equal(v.cur, 62); assert.equal(v.prev, 63); assert.equal(v.sub, '신규 60명'); });
check('첫날 저장은 분자/분모와 %를 같이(3/60=5%, 직전 2/63=3%) + 첫날 재생은 보조', () => {
  const s = lines(CORE).lines[1]; assert.deepEqual({ ...s.cur }, { a: 3, b: 60, pct: 5 }); assert.deepEqual({ ...s.prev }, { a: 2, b: 63, pct: 3 }); assert.equal(s.sub, '첫날 재생 25/60');
});
check('7일 재방문은 관찰이 끝난 집단만(7~14일 전 가입 0/63, 그 앞 1/36)', () => {
  const r = lines(CORE).lines[2]; assert.deepEqual({ ...r.cur }, { a: 0, b: 63, pct: 0 }); assert.deepEqual({ ...r.prev }, { a: 1, b: 36, pct: 3 }); assert.equal(r.sub, '7~14일 전 가입자');
});
check('분모 0이면 %는 null(0으로 나누지 않음)', () => { const c = JSON.parse(JSON.stringify(CORE)); c.v.w.new = 0; c.ret.c1.cohort = 0; const L = lines(c).lines; assert.equal(L[1].cur.pct, null); assert.equal(L[2].cur.pct, null); });
check('수집이 12시간 넘게 멈추면 상태 한 줄, 아니면 없음(평소엔 숨김)', () => {
  assert.equal(lines(CORE).stale, null);
  const c = { ...CORE, stale_h: 30 }; assert.ok(/30시간/.test(lines(c).stale));
});
check('데이터가 없으면 null(예전 화면으로 되돌림)', () => { assert.equal(lines(null), null); assert.equal(lines({}), null); });
check('HTML: 세 줄 + 상태 + 접힌 자세히 재료(30일 정착·정적→앱)', () => {
  box.__c = CORE; box.__t = { w: { seo_land: 40, seo_to_app: 5 }, wp: { seo_land: 38, seo_to_app: 4 } };
  const h = vm.runInContext('_admCoreHtml(__c,__t)', box);
  assert.ok(h.main.includes('앱 방문자') && h.main.includes('첫날 저장한 신규') && h.main.includes('신규 7일 내 재방문'));
  assert.ok(h.main.includes('3/60 (5%)') && h.main.includes('0/63 (0%)'));
  assert.equal(h.status, '');
  assert.ok(h.extra.includes('30일 정착') && h.extra.includes('40 → 5'));
});
check('팝업 렌더: 핵심이 있으면 head + 세 줄 + 접힌 자세히, 자세히 안 클릭은 팝업을 닫지 않는다', () => {
  assert.ok(admin.includes('const coreH=_admCoreHtml(core,t)'));
  assert.ok(admin.includes('<details id="adm-digest-more"'));
  assert.ok(admin.includes("ev.target.closest('#adm-digest-more'))return"));
  assert.ok(admin.includes('_admDigestRender(m,day,await trendP,await coreP)') && admin.includes("sb.rpc('get_app_core')"));
});
check('SQL: 관리자 전용·봇 제외·저장 정의·재방문은 다른 날(KST)·집단은 7일 이상 관찰', () => {
  assert.ok(sql.includes("raise exception 'admin only'"));
  assert.ok(/headless\|bot\|crawl/.test(sql));
  assert.ok(sql.includes("'save_collection','save_scrap'") && sql.includes("k = 'add'"));
  assert.ok(sql.includes("at time zone 'Asia/Seoul'") && sql.includes("interval '7 days'"));
  assert.ok(sql.includes("('c1', now() - interval '14 days', now() - interval '7 days')"));
});
console.log(failures ? '실패 ' + failures : '🎉 Daily 핵심 지표 테스트 통과');
process.exit(failures ? 1 : 0);
