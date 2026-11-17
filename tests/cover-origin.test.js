// 커버 원곡 판정(2026-11-17, 사용자 "에잇턴 Love Dive는 아이브 원곡인데 정적 페이지에 티가 안 난다") — 실제 디스코 데이터로.
// 경연 앨범(contest) 수록곡만 쓰고, 컴필레이션(자기 베스트 앨범)은 뺀다: 2PM 'CRUSH'·'FLASHLIGHT'는 2PM 자기 곡인데 다른 그룹 곡명과 같다는 이유로 오인되던 걸 막는다.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'utf8');
const a = src.indexOf('// ── 커버 원곡(2026-11-17'), b = src.indexOf('function grpCard(gko, lang) {');
assert(a >= 0 && b > a, '커버 블록을 못 찾음');
const sh = {}; vm.createContext(sh); vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + ';this.B=_songBase;', sh);
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ctx = { fs, path, ROOT, groups, _CRED_SB: sh.B, SITE: 'https://kpop-universe.kr', console, Map, Set, Array, Object, String, JSON,
  escHtml: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  SONGS: { 아이브: [{ b: 'lovedive' }], 에잇턴: [{ b: 'lovedive' }] },
  songPagePath: (g, s, l) => `${l === 'en' ? 'en/' : ''}g/${g}/s/${s}/`, groupPagePath: (g, l) => `${l === 'en' ? 'en/' : ''}g/${g}/` };
vm.createContext(ctx); vm.runInContext(src.slice(a, b) + '\nthis.run=computeCoverOrigins;this.CO=COVER_ORIGIN;this.CB=COVERED_BY;this.chips=coverChipsHtml;', ctx);
ctx.run();
let total = 0, failed = 0; const check = (n, f) => { total++; try { f(); } catch (e) { failed++; console.error('FAIL ' + n + ': ' + e.message); } };
check('에잇턴 Love Dive의 원곡은 아이브(2022)', () => { const o = ctx.CO.get('에잇턴|lovedive'); assert(o && o.og === '아이브' && o.year === '2022', JSON.stringify(o)); });
check('아이브 Love Dive는 에잇턴이 커버했다고 역방향에 잡힌다', () => { const l = ctx.CB.get('아이브|lovedive'); assert(l && l.some(x => x.g === '에잇턴'), JSON.stringify(l)); });
check('2PM 자기 곡(CRUSH·FLASHLIGHT·EVEREST — 베스트 앨범 수록)은 커버로 오인하지 않는다', () => { ['crush', 'flashlight', 'everest', 'comma'].forEach(b => assert(!ctx.CO.has('2PM|' + b), '오탐: 2PM|' + b)); });
check('자기 그룹에 정규 발매가 있는 곡은 커버가 아니다(원곡 그룹≠자기 그룹)', () => { for (const [k, v] of ctx.CO) assert(v.og !== k.split('|')[0], '자기 자신이 원곡: ' + k); });
check('판정 규모가 상식 범위(경연 앨범 수록곡의 일부 — 10~80개)', () => { assert(ctx.CO.size >= 10 && ctx.CO.size <= 80, '건수 ' + ctx.CO.size); });
check('칩: 에잇턴은 원곡 아이브로, 아이브는 커버 에잇턴으로 곡 페이지 링크', () => {
  const c1 = ctx.chips('에잇턴', { b: 'lovedive' }, 'ko'), c2 = ctx.chips('아이브', { b: 'lovedive' }, 'ko');
  assert(/<b>원곡<\/b><a href="https:\/\/kpop-universe\.kr\/g\/아이브\/s\/lovedive\/">아이브 · LOVE DIVE \(2022\)<\/a>/.test(c1), c1);
  assert(/<b>커버<\/b>/.test(c2) && /g\/에잇턴\/s\/lovedive\//.test(c2), c2);
  assert.equal(ctx.chips('에잇턴', { b: 'nothing' }, 'ko'), '');
  assert(/<b>Original<\/b>/.test(ctx.chips('에잇턴', { b: 'lovedive' }, 'en')) && /en\/g\/아이브\/s\/lovedive/.test(ctx.chips('에잇턴', { b: 'lovedive' }, 'en')));
});
console.log(total + ' checks / ' + failed + ' failed (원곡 판정 ' + ctx.CO.size + '곡)'); if (failed) process.exitCode = 1;
