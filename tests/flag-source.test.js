// flag_source / flagged_at 배선 (2026-08-27)
// 숨김 2,822건 중 사람이 숨긴 건 22건(0.8%)뿐이었는데 둘이 같은 칸을 써서 구분이 불가능했다.
// 이 테스트는 "content_flag를 쓰는 자리가 또 헬퍼를 안 거치고 늘어나는 것"을 막는다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

// ── 헬퍼 실동작 ──────────────────────────────────────────────────
const m = /function _flagPatch\(flag,source,extra\)\{[\s\S]*?\n\}/.exec(html);
ok(!!m, '_flagPatch를 index.html에서 못 찾음');
if (m) {
  const _flagPatch = new Function(m[0] + '; return _flagPatch;')();
  const auto = _flagPatch('hidden', 'auto');
  ok(auto.content_flag === 'hidden' && auto.flag_source === 'auto', '자동 숨김의 flag/source가 틀림');
  ok(auto.needs_review === true,
    '⚠️ 자동 숨김에 needs_review가 안 붙음 — 유저 화면에서 사라진 채 어떤 큐에도 안 뜨는 블랙아웃이 재발한다');
  ok(typeof auto.flagged_at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(auto.flagged_at), 'flagged_at이 ISO 문자열이 아님');

  const man = _flagPatch('hidden', 'manual');
  ok(man.flag_source === 'manual', '수동 숨김의 source가 틀림');
  ok(man.needs_review === undefined, '수동 숨김에 needs_review를 강제로 붙임 — 사람이 판단한 건 큐에 넣을 이유가 없음');

  // 플래그 해제(null)면 출처도 같이 지워져야 한다 — 안 그러면 "정상인데 auto가 숨긴 흔적"이 남는다
  const clear = _flagPatch(null, 'manual');
  ok(clear.content_flag === null && clear.flag_source === null && clear.flagged_at === null,
    '플래그 해제 시 flag_source/flagged_at이 안 지워짐(유령 상태)');

  // extra가 기본값을 이길 수 있어야 함(검수를 끝낸 자동분 등)
  const ov = _flagPatch('hidden', 'auto', { needs_review: false });
  ok(ov.needs_review === false, 'extra의 needs_review가 기본값에 안 밀림');
  // 자동이어도 hidden이 아니면 needs_review를 안 붙인다(무관/보류는 카드에서 빠질 뿐 판정이 명확)
  ok(_flagPatch('무관', 'auto').needs_review === undefined, '자동 무관에 needs_review가 붙음');
  ok(_flagPatch('보류', 'auto').needs_review === undefined, '자동 보류에 needs_review가 붙음');
}

// ── 모든 쓰기가 헬퍼를 거치는가 ──────────────────────────────────
// 같은 조건을 N곳에 복붙하다 한 곳만 고쳐지는 게 이 프로젝트의 반복 사고 패턴이라,
// raw로 content_flag를 쓰는 자리가 하나라도 생기면 실패시킨다.
const rawUpdate = [...adminJs.matchAll(/update\(\{[^)]*content_flag:/g)];
ok(rawUpdate.length === 0,
  `_flagPatch를 안 거치고 content_flag를 update하는 곳이 ${rawUpdate.length}곳 남아있음`);
// 헬퍼 호출이 실제로 여러 자리에 퍼져 있는지(치환이 통째로 날아간 회귀 감지)
const calls = (adminJs.match(/_flagPatch\(/g) || []).length;
ok(calls >= 15, `_flagPatch 호출이 ${calls}곳뿐 — 배선이 빠진 자리가 있음`);
// 동기화/백필 insert 경로도 포함돼야 한다(신규 유입분이 출처 없이 들어오면 의미가 없음)
ok(/_shouldJunkFlag\(v\.title,'official'\)\?_flagPatch\('무관','auto'\)/.test(adminJs),
  '공식 채널 동기화 insert가 _flagPatch를 안 씀');
ok(/_shouldJunkFlag\(v\.title,tier\)\?_flagPatch\('무관','auto'\)/.test(adminJs),
  '백필 insert가 _flagPatch를 안 씀');
// ⚠️ 자동 숨김 금지(2026-09-03). hidden의 의도된 용도는 **밴 인물 + 관리자 수동 판단**뿐이다(사용자 확인).
// 예전엔 동기화가 confidence==='ambiguous'인 행에 곧바로 hidden을 박았는데, 실측해보니 hidden 2,377건 중
// 밴 목록에 걸리는 건 31건뿐이고 **2,346건(98.7%)이 이 자동 경로**였다. 그 분포가 곧 한 글자 이름 충돌
// 그대로였다(스트레이키즈 517=한 / 더보이즈 491=뉴 / 세븐틴 262=준 / 스테이씨 202=윤) — 그룹이 잘못
// 배정된 영상이 동시에 숨김까지 당해 "틀린 채로 안 보이는" 상태였다. weak→hidden은 같은 이유로 이미
// 2026-08-25에 폐지됐는데 ambiguous 가지가 남아 있었다. 되살리지 말 것.
ok(!/ambiguous\?_flagPatch\('hidden'/.test(adminJs),
  "동기화가 ambiguous 행을 자동으로 hidden 처리하고 있음 — hidden은 밴 인물/수동 전용");

// ── 스냅샷(되돌리기)에 새 컬럼이 포함됐는가 ──────────────────────
const snap = /const _BULK_SNAP_COLS=\[([^\]]*)\]/.exec(adminJs);
ok(!!snap, '_BULK_SNAP_COLS를 못 찾음');
if (snap) {
  const cols = [...snap[1].matchAll(/'([^']*)'/g)].map(x => x[1]);
  ok(cols.includes('flag_source') && cols.includes('flagged_at'),
    '스냅샷에 flag_source/flagged_at이 없음 — content_flag만 되돌리면 출처가 어긋난 유령 상태가 됨');
}
// 컬럼이 없는 환경에서 스냅샷이 통째로 죽지 않도록 폴백이 있어야 한다(reviewed_at·is_short과 동일 패턴)
ok(/_snapHasFlagSrc/.test(adminJs), 'flag_source 컬럼 부재 폴백(_snapHasFlagSrc)이 없음');
ok(/if\(error&&_snapHasFlagSrc&&\/flag_source\|flagged_at\/\.test/.test(adminJs),
  '스냅샷 select 실패 시 flag_source를 빼고 재시도하는 분기가 없음');

// ── 숨김/무관/보류 탭에서 출처가 보이는가 ────────────────────────
ok(/select\('id,title,group_ko,thumb,content_flag,flag_source,/.test(adminJs),
  '무관/보류/숨김 탭 조회가 flag_source를 안 읽음');
ok(/v\.flag_source==='auto'/.test(adminJs), '자동 판정분 표시 로직이 없음');
ok(/\.vm-flag-btn\.vm-flag-auto::before\{/.test(css), '자동 표시 스타일이 없음');

console.log(`flag-source: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
