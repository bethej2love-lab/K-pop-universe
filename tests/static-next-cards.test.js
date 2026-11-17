// 정적 '이어서 보기' 카드(그룹·앨범·케미) — 2026-11-17 "앱 로딩이 느려 이탈, 있는 정적 페이지끼리 잇기(새 페이지 금지)".
// build_group_pages.js의 실제 함수를 잘라 가짜 데이터로 돌려, 모든 연결이 정적 주소(앱 딥링크 #g= 없음)이고 카드 구성이 맞는지 본다.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'build_group_pages.js'), 'utf8');
const a = src.indexOf("// ── 정적 '이어서 보기' 카드"), b = src.indexOf('function buildGroupPages() {');
assert(a >= 0 && b > a, '도우미 블록을 못 찾음');
const SITE = 'https://kpop-universe.kr';
const mk = (ko, en, id) => ({ id, name: { ko, en }, group: { ko: '그룹A' } });
const A1 = mk('가', 'Ga', 'a1'), A2 = mk('나', 'Na', 'a2'), A3 = mk('다', 'Da', 'a3');
const vids = n => Array.from({ length: n }, (_, i) => ({ id: 'v' + n + '_' + i, view_count: 1000 - i }));
const ctx = {
  SITE, _CRED_SB: t => String(t).toLowerCase().replace(/[^a-z0-9가-힣]/g, ''),
  groups: { 그룹A: { en: 'GroupA' } },
  SONGS: { 그룹A: [{ b: 's1', title: '곡하나', vids: vids(5) }, { b: 's2', title: 'Song2', bilingualTitle: '곡둘(Song2)', vids: vids(9) }, { b: 's3', title: 'S3', vids: vids(2) }] },
  FANCAM_HUB: new Map([[A1, vids(7)], [A2, vids(3)]]),
  membersOf: () => [A1, A2, A3],
  memberFancamPagePath: (x, l) => `${l === 'en' ? 'en/' : ''}g/그룹A/${x.name.ko}/fancams/`,
  songPagePath: (g, s, l) => `${l === 'en' ? 'en/' : ''}g/${g}/s/${s}/`,
  groupPagePath: (g, l) => `${l === 'en' ? 'en/' : ''}g/${g}/`,
  albumPagePath: (g, slug, l) => `${l === 'en' ? 'en/' : ''}g/${g}/a/${slug}/`,
  chemPagePath: (g, x, y, l) => `${l === 'en' ? 'en/' : ''}chem/${g}/${x.name.ko}-${y.name.ko}/`,
  albumsFor: () => [{ slug: 'old', al: { title: 'Old', releaseDate: '2020-01-01', cover: 'c1', tracks: [{}, {}] } }, { slug: 'new', al: { title: 'New <b>', releaseDate: '2024-05-05', cover: 'c2', tracks: [{}, {}, {}] } }],
  JSON, String, Set, Map, Array, Object,
};
vm.createContext(ctx); vm.runInContext(src.slice(a, b), ctx);
const parse = html => { const m = /<script type="application\/json" id="kpu-next">([\s\S]*?)<\/script>/.exec(html); assert(m, 'kpu-next 스크립트 없음: ' + html.slice(0, 80)); return JSON.parse(m[1]); };
let total = 0, failed = 0; const check = (n, f) => { total++; try { f(); } catch (e) { failed++; console.error('FAIL ' + n + ': ' + e.message); } };
check('그룹 페이지: 곡·멤버 직캠·앨범 카드, 최대 5개, 전부 정적 주소', () => {
  const j = parse(ctx.groupNextJson('그룹A', 'ko')); assert(j.length >= 4 && j.length <= 5);
  assert(j.every(x => x.h.startsWith(SITE + '/') && !/#g=|#chem=|\/\?/.test(x.h)), '앱 딥링크가 섞임: ' + j.map(x => x.h).join(' '));
  assert.equal(j[0].k, '곡별 직캠·무대'); assert.equal(j[0].t, '곡둘(Song2)', '영상 많은 곡이 먼저(이중 표기 제목)');
  assert(j.some(x => x.k === '멤버 직캠' && /fancams\/$/.test(x.h)) && j.some(x => x.k === '앨범' && /\/a\/new\/$/.test(x.h)), '멤버 직캠·최신 앨범 카드');
  assert(!j.some(x => x.t === '다'), '직캠이 없는 멤버는 카드에서 뺀다');
});
check('영문 페이지는 /en/ 정적 주소와 영어 라벨', () => { const j = parse(ctx.groupNextJson('그룹A', 'en')); assert(j.every(x => x.h.startsWith(SITE + '/en/'))); assert(j.some(x => x.k === 'Member fancams' && x.t === 'Ga')); });
check('앨범 페이지: 타이틀곡·그룹·이웃 앨범 카드', () => {
  const list = ctx.albumsFor(); const al = { ...list[1].al, titleTrack: 'Song2', tracks: [{ title: 'Song2', isTitle: true }] };
  const j = parse(ctx.albumNextJson('그룹A', al, 'new', 1, list, new Set(['song2']), 'ko'));
  assert.equal(j[0].k, '타이틀곡'); assert(/\/s\/song2\/$/.test(j[0].h)); assert(j.some(x => x.k === '그룹')); assert(j.some(x => x.k === '앨범' && /\/a\/old\/$/.test(x.h)));
  assert(j.every(x => x.h.startsWith(SITE + '/') && !/#g=/.test(x.h)));
});
check('앨범 페이지: 곡 페이지가 없는 타이틀곡은 카드를 만들지 않는다(없는 페이지 링크 금지)', () => {
  const list = ctx.albumsFor(); const j = parse(ctx.albumNextJson('그룹A', { ...list[1].al, titleTrack: '없는곡', tracks: [] }, 'new', 1, list, new Set(['x']), 'ko')); assert(!j.some(x => x.k === '타이틀곡'));
});
check('케미 페이지: 두 멤버 직캠·그룹·다른 조합(자기 자신 제외)', () => {
  const me = { g: '그룹A', a: A1, b: A2, n: 4, v: vids(2) }, other = { g: '그룹A', a: A1, b: A3, n: 9, v: vids(2) };
  const j = parse(ctx.chemNextJson(me, 'ko', new Map([[A1, [me, other]], [A2, [me]]])));
  assert(j.filter(x => x.k === '멤버 직캠').length === 2 && j.some(x => x.k === '그룹') && j.some(x => x.k === '다른 조합' && /가-다|가·다|가 × 다/.test(x.t + x.h)));
  assert(!j.some(x => x.t === '가 × 나'), '자기 자신 조합은 뺀다'); assert(j.every(x => !/#chem=/.test(x.h)));
});
check('JSON 출력에 </script>를 닫을 수 있는 < 가 없다', () => { const h = ctx.groupNextJson('그룹A', 'ko'); const inner = /id="kpu-next">([\s\S]*?)<\/script>/.exec(h)[1]; assert(!inner.includes('<')); assert(inner.includes(String.fromCharCode(92) + 'u003c'), '앨범 제목 <b>가 이스케이프돼야 한다'); });
check('데이터가 없는 그룹은 빈 문자열(스크립트 없음)', () => { assert.equal(ctx.groupNextJson('없는그룹', 'ko'), ''); });
console.log(total + ' checks / ' + failed + ' failed'); if (failed) process.exitCode = 1;
