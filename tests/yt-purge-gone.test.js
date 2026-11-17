// 삭제·비공개 30일 경과 영상 데이터 삭제(admin.js _ytPurgeGoneApiData) — YouTube API 감사 III.E.4a(2026-11-17).
// 실측: 표시 후 순환이 못 돌아온 140건 중 23건은 실제론 재생 가능한 오표시 → 지우기 직전에 API로 재확인해 살아 있으면 표시만 푼다.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const a = src.indexOf('async function _ytPurgeGoneApiData(){'), b = src.indexOf('async function _ytRotateViewCountDaily(){'); assert(a > 0 && b > a, '함수를 못 찾음');
function run({ rows, alive = [], key = 'K', apiFail = false, deleteError = false, headCountError = false }) {
  const log = [], warns = [], fetches = []; let store = rows.map(r => ({ ...r }));
  const sb = { from(t) {
    const q = { t, op: 'select', f: {}, patch: null };
    const api = {
      select(c, o) { q.opts = o || {}; return api; }, lt(c, v) { q.f.lt = v; return api; }, limit(n) { q.f.limit = n; return api; },
      delete() { q.op = 'delete'; return api; }, update(p) { q.op = 'update'; q.patch = p; return api; }, in(c, ids) { q.f.in = ids; return api; },
      then(res) {
        log.push(q.op + ':' + t);
        if (q.op === 'delete') { if (t === '_yt' && deleteError) return res({ error: { message: 'rls' } }); if (t === '_yt') store = store.filter(r => !q.f.in.includes(r.id)); return res({ error: null }); }
        if (q.op === 'update') { store.forEach(r => { if (q.f.in.includes(r.id)) Object.assign(r, q.patch); }); return res({ error: null }); }
        const hit = store.filter(r => r.unavailable_at && r.unavailable_at < q.f.lt);
        if (q.opts.head) return res(headCountError ? { error: { message: 'x' } } : { count: hit.length, error: null });
        return res({ data: hit.slice(0, q.f.limit).map(r => ({ id: r.id })), error: null });
      } };
    return api;
  } };
  const ctx = { sb, _YT_TABLE: '_yt', _ytUnavailSupported: async () => true, _ytApiKey: () => key, encodeURIComponent, Set, Array, Date, Math,
    fetch: async u => { fetches.push(String(u)); if (apiFail) return { ok: false, json: async () => ({}) }; const ids = new URL(u).searchParams.get('id').split(','); return { ok: true, json: async () => ({ items: ids.filter(i => alive.includes(i)).map(id => ({ id })) }) }; },
    console: { log() {}, warn: m => warns.push(m) } };
  vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
  return { ctx, log, warns, fetches, get store() { return store; } };
}
const day = 86400000, iso = d => new Date(Date.now() - d * day).toISOString();
(async () => {
  // 1) 30일 넘은 것만, 재확인 후 진짜 사라진 것만 삭제 — 마일스톤(FK 자식) 먼저
  const t1 = run({ rows: [{ id: 'old1', unavailable_at: iso(45) }, { id: 'old2', unavailable_at: iso(31) }, { id: 'new1', unavailable_at: iso(5) }, { id: 'live', unavailable_at: null }] });
  assert.equal(await t1.ctx._ytPurgeGoneApiData(), 2); assert.deepEqual(t1.store.map(r => r.id).sort(), ['live', 'new1']);
  assert.deepEqual(t1.log.filter(x => x.startsWith('delete')), ['delete:yt_view_milestones', 'delete:_yt'], '자식 먼저');
  assert(t1.fetches[0].includes('googleapis.com/youtube/v3/videos') && t1.fetches[0].includes('old1'), '삭제 전에 API로 재확인');
  // 2) 실제론 살아 있는 건 지우지 않고 표시만 푼다
  const t2 = run({ rows: [{ id: 'gone', unavailable_at: iso(40) }, { id: 'back', unavailable_at: iso(40) }], alive: ['back'] });
  assert.equal(await t2.ctx._ytPurgeGoneApiData(), 1);
  assert.deepEqual(t2.store.map(r => [r.id, r.unavailable_at]), [['back', null]], '되살아난 건 남기고 unavailable_at 해제');
  // 3) API 오류면 아무것도 지우지 않는다 / 키가 없어도
  const t3 = run({ rows: [{ id: 'x', unavailable_at: iso(60) }], apiFail: true }); assert.equal(await t3.ctx._ytPurgeGoneApiData(), 0); assert.equal(t3.store.length, 1); assert(t3.warns.some(w => /재확인 API 호출 실패/.test(w)));
  const t4 = run({ rows: [{ id: 'x', unavailable_at: iso(60) }], key: '' }); assert.equal(await t4.ctx._ytPurgeGoneApiData(), 0); assert.equal(t4.store.length, 1); assert.equal(t4.fetches.length, 0);
  // 4) 1,000건 초과(대량 오표시 의심)면 멈춤 / 삭제 오류도 안전 중단 / 조회 오류·대상 없음
  const many = Array.from({ length: 1001 }, (_, i) => ({ id: 'g' + i, unavailable_at: iso(40) }));
  const t5 = run({ rows: many }); assert.equal(await t5.ctx._ytPurgeGoneApiData(), 0); assert.equal(t5.store.length, 1001); assert(t5.warns.some(w => /1,000건/.test(w)));
  const t6 = run({ rows: [{ id: 'x', unavailable_at: iso(60) }], deleteError: true }); assert.equal(await t6.ctx._ytPurgeGoneApiData(), 0); assert(t6.warns.some(w => /영상 삭제 실패/.test(w)));
  assert.equal(await run({ rows: [], headCountError: true }).ctx._ytPurgeGoneApiData(), 0);
  assert.equal(await run({ rows: [{ id: 'k', unavailable_at: iso(1) }] }).ctx._ytPurgeGoneApiData(), 0);
  // 5) 순환 간격(하루 최대 2회)·일일 래퍼 연결
  assert(/const _VIEW_ROTATE_GAP_MS=11\*3600\*1000;/.test(src)); assert(/_ytPurgeGoneApiData\(\)\.catch/.test(src) && /await _ytLogOldestApiAge\(\);/.test(src));
  console.log('✅ 삭제 영상 데이터 정리: 30일 기준·API 재확인·되살아난 건 해제·자식 먼저·오류/키없음/1,000건 초과 안전 중단, 순환 간격 11시간');
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
