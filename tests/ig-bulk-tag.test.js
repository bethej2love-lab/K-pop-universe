// 인스타 태그 "직전 태그 그대로" + 보관함 일괄 태깅 테스트 (2026-11-16 사용자 "방금 한 그대로 저장되는 기능이나 선택해서 한 번에 태깅")
// 실행: node tests/ig-bulk-tag.test.js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const app = require('../tools/index_source.cjs').readIndexSource();
const admin = fs.readFileSync(path.join(root, 'admin.js'), 'utf8');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(root, 'artists.json'), 'utf8'));
function extract(src, name) {
  const start = src.indexOf('function ' + name + '('); assert(start >= 0, name + ' 없음');
  let d = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(start, i + 1);
}
let failures = 0;
const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { failures++; console.error('FAIL ' + n + ': ' + e.message); } };

// ── 직전 태그(admin.js) ──
const store = new Map();
const box = {
  ARTISTS, currentLang: 'ko', _dispName: a => a.name.ko,
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
};
vm.createContext(box);
vm.runInContext("const _IG_LAST_TAG_KEY='kpu_ig_last_tag';\n" + ['_igLastTagRead', '_igLastTagWrite', '_igLastTagLabel'].map(n => extract(admin, n)).join('\n'), box);
const ids = ARTISTS.filter(a => a.group && a.group.ko === '코르티스').map(a => a.id);
assert(ids.length >= 4, '코르티스 멤버 필요');
const run = code => vm.runInContext(code, box);

check('저장하면 다음에 그대로 읽힌다(멤버·범위)', () => {
  store.clear(); box.__ids = ids.slice(0, 3);
  run("_igLastTagWrite(__ids,'post')");
  const r = run('_igLastTagRead()');
  assert.deepEqual(Array.from(r.ids), ids.slice(0, 3)); assert.equal(r.scope, 'post');
});
check('범위가 이상하면 photo로', () => { store.clear(); box.__ids = ids.slice(0, 1); run("_igLastTagWrite(__ids,'weird')"); assert.equal(run('_igLastTagRead()').scope, 'photo'); });
check('빈 선택은 기록하지 않는다(해제가 직전 태그를 지우지 않음)', () => {
  store.clear(); box.__ids = ids.slice(0, 2); run("_igLastTagWrite(__ids,'photo')");
  box.__none = []; run("_igLastTagWrite(__none,'photo')");
  assert.deepEqual(Array.from(run('_igLastTagRead()').ids), ids.slice(0, 2));
});
check('사라진 멤버 ID는 걸러내고, 다 사라지면 null', () => {
  store.clear(); store.set('kpu_ig_last_tag', JSON.stringify({ ids: [ids[0], 'gone-id'], scope: 'photo' }));
  assert.deepEqual(Array.from(run('_igLastTagRead()').ids), [ids[0]]);
  store.set('kpu_ig_last_tag', JSON.stringify({ ids: ['gone-1', 'gone-2'], scope: 'photo' }));
  assert.equal(run('_igLastTagRead()'), null);
});
check('깨진 저장값은 null(예외 없음)', () => { store.set('kpu_ig_last_tag', '{not json'); assert.equal(run('_igLastTagRead()'), null); });
check('라벨은 3명까지 이름, 나머지는 "외 N"', () => {
  box.__l = { ids: ids.slice(0, 5), scope: 'photo' };
  const t = run('_igLastTagLabel(__l)');
  assert.ok(t.startsWith('↺ 직전 태그 · ')); assert.ok(/외 2$/.test(t), t);
});

// ── 보관함 선택 모드(app.js) ──
const ctx = { _iga: { sel: new Map(), h: 'cortis' }, _showShareToast: m => { ctx.__toast = m; }, _igaSelBar: () => { ctx.__bars = (ctx.__bars || 0) + 1; }, currentLang: 'ko' };
vm.createContext(ctx);
vm.runInContext("const _IGA_SEL_MAX=40;\n" + extract(app, '_igaToggleRow'), ctx);
const tile = () => ({ classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, has(c) { return this._s.has(c); } } });
ctx.__mk = tile;
check('선택 모드가 아니면 토글하지 않고 false(뷰어가 열린다)', () => { ctx._iga.sel = null; assert.equal(vm.runInContext("_igaToggleRow({post_key:'a',ty:'IMAGE'},__mk())", ctx), false); ctx._iga.sel = new Map(); });
check('탭하면 선택, 다시 탭하면 해제', () => {
  ctx.__t = tile(); ctx.__r = { post_key: 'p1', ty: 'IMAGE' };
  assert.equal(vm.runInContext('_igaToggleRow(__r,__t)', ctx), true); assert.equal(ctx._iga.sel.size, 1); assert.ok(ctx.__t.classList.has('iga-sel'));
  vm.runInContext('_igaToggleRow(__r,__t)', ctx); assert.equal(ctx._iga.sel.size, 0); assert.ok(!ctx.__t.classList.has('iga-sel'));
});
check('영상 게시물은 선택되지 않고 안내가 뜬다', () => {
  ctx.__t = tile(); ctx.__r = { post_key: 'v1', ty: 'VIDEO' };
  assert.equal(vm.runInContext('_igaToggleRow(__r,__t)', ctx), true); assert.equal(ctx._iga.sel.size, 0); assert.ok(/영상/.test(ctx.__toast));
});
check('한 번에 40개까지만', () => {
  ctx._iga.sel = new Map();
  for (let i = 0; i < 40; i++) { ctx.__t = tile(); ctx.__r = { post_key: 'x' + i, ty: 'IMAGE' }; vm.runInContext('_igaToggleRow(__r,__t)', ctx); }
  assert.equal(ctx._iga.sel.size, 40);
  ctx.__t = tile(); ctx.__r = { post_key: 'x41', ty: 'IMAGE' }; vm.runInContext('_igaToggleRow(__r,__t)', ctx);
  assert.equal(ctx._iga.sel.size, 40); assert.ok(!ctx.__t.classList.has('iga-sel')); assert.ok(/40/.test(ctx.__toast));
});

// ── 연결 확인(소스) ──
check('보관함 타일 클릭이 선택 모드를 먼저 본다', () => assert.ok(/_iga&&_iga\.sel&&b\.closest&&b\.closest\('#iga-grid'\)&&_igaToggleRow\(r,b\)/.test(app)));
check('일괄 저장은 게시물마다 apply_post RPC를 부르고 멤버가 없으면 저장하지 못한다', () => {
  const body = extract(admin, '_igBulkTagOpen');
  assert.ok(/ig_photo_tags_apply_post/.test(body)); assert.ok(/btn\.save\.disabled=!ids\.size/.test(body)); assert.ok(/slice\(0,40\)/.test(body));
  assert.ok(/_igLastTagWrite\(picked,'post'\)/.test(body));
});
check('단일 편집기가 저장 성공 때 직전 태그를 기억한다(한 장·게시물 전체)', () => {
  assert.ok(/_igLastTagWrite\(ids,'post'\)/.test(admin)); assert.ok(/_igLastTagWrite\(ids,'photo'\)/.test(admin));
});
check('관리자가 아니면 선택 버튼을 숨긴다', () => assert.ok(/if\(_isAdmin\(\)\)\{\s*if\(!sb2\)/.test(app) || /_isAdmin\(\)\)\{\n/.test(app)));
console.log(failures ? '실패 ' + failures : '🎉 인스타 일괄 태깅 테스트 통과');
process.exit(failures ? 1 : 0);
