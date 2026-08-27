// 멤버 카드 영상 컷오프 폴백 (2026-08-27)
// 탈퇴일(left)을 모를 때 예전엔 무조건 차단이라 멤버 카드가 통째로 비었다(실측 110명).
// 실제 원인은 탈퇴일 미기입이 아니라 active 필드가 두 뜻으로 섞여 쓰인 것 — 쥬얼리(2015 해체)
// 하주연은 active:true(개인 활동 계속), 정유진은 active:false(은퇴)인데 쥬얼리에 있던 기간은 같다.
// 이 테스트는 ①~④ 분기와 "같은 계산이 다시 두 벌로 갈라지지 않는가"를 잠근다.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.error('  ✗ ' + msg); } };

// ── _groupEndDate 실동작 ─────────────────────────────────────────
const endSrc = /function _groupEndDate\(ko\)\{[\s\S]*?\n\}/.exec(html);
ok(!!endSrc, '_groupEndDate를 index.html에서 못 찾음');
const overSrc = /function _groupIsOver\(ko\)\{[\s\S]*?\n\}/.exec(html);
ok(!!overSrc, '_groupIsOver를 index.html에서 못 찾음');

let endOf = null;
if (endSrc) {
  const G = {
    full: { disbanded: '2022.01.28' }, yearOnly: { disbanded: '2015' },
    ym: { disbanded: '2019.02' }, ymLeap: { disbanded: '2020.02' },
    boolTrue: { disbanded: true }, none: {}, junk: { disbanded: '알수없음' },
  };
  endOf = new Function('GROUPS', endSrc[0] + '; return _groupEndDate;')(G);
  const cases = {
    full: '2022-01-28',
    yearOnly: '2015-12-31',   // 연도만 → 그 해 마지막 날(그 해 영상을 자를 근거가 없음)
    ym: '2019-02-28',
    ymLeap: '2020-02-29',     // 윤년
    boolTrue: null,           // "해체는 맞는데 날짜를 모름"
    none: null, junk: null, 없는그룹: null,
  };
  for (const [k, v] of Object.entries(cases)) {
    const got = endOf(k);
    ok(got === v, `_groupEndDate(${k}) 기대 ${v} / 실제 ${got}`);
  }
}

// ── ①~④ 분기: _memberVideoCutoff 본문이 순서대로 들어갔는가 ──────
const cutSrc = /function _memberVideoCutoff\(memberKo,ko\)\{[\s\S]*?\n  \}/.exec(html);
ok(!!cutSrc, '_memberVideoCutoff를 못 찾음');
if (cutSrc) {
  const body = cutSrc[0];
  const iLeft = body.indexOf('if(leftHere)return');
  const iEnd = body.indexOf('_groupEndDate(ko)');
  const iOver = body.indexOf('_groupIsOver(ko)');
  const iBlock = body.lastIndexOf('return{active:false,left:null}');
  ok(iLeft > 0, '① left 우선 분기가 없음');
  ok(iEnd > iLeft, '② 해체일 폴백이 ① 뒤에 없음');
  ok(iOver > iEnd, '③ _groupIsOver 폴백이 ② 뒤에 없음');
  ok(iBlock > iOver, '④ 최종 차단이 ③ 뒤에 없음');
  // ④가 사라지면 현역 그룹을 떠난 멤버(엑소 타오 등)에게 탈퇴 이후 최신 영상이 새어 들어간다
  // — 이 컷오프를 처음 만든 원인(수진 버그)의 재발이라 반드시 남아 있어야 한다.
  ok(/return\{active:false,left:null\}/.test(body), '④ 차단 분기가 통째로 사라짐');
}

// ── 같은 계산이 또 두 벌로 갈라지지 않았는가 ─────────────────────
// admin.js의 _disbandCutoffDate는 index.html의 _groupEndDate로 위임만 해야 한다.
ok(/function _disbandCutoffDate\(ko\)\{return _groupEndDate\(ko\);\}/.test(adminJs),
  'admin.js _disbandCutoffDate가 _groupEndDate로 위임하지 않음(로직 재복제 의심)');
// 해체 판정 로컬 사본 2벌도 전역 _groupIsOver 별칭이어야 한다.
ok(/const _gDisbanded=_groupIsOver;/.test(html), '_gDisbanded가 여전히 자체 구현');
ok(/const _isGrpDisbanded=_groupIsOver;/.test(html), '_isGrpDisbanded가 여전히 자체 구현');
// 로스터 전수검사 리터럴이 다시 생기면(복붙 재발) 실패
const rosterDup = [...html.matchAll(/every\(a=>a\.active===false\)/g)];
ok(rosterDup.length === 1, `로스터 전원비활동 검사가 ${rosterDup.length}곳 — _groupIsOver 하나여야 함`);

// ── TDZ: _groupIsOver/_groupEndDate가 GROUPS 선언 뒤에 있는가 ────
// 즉시 도는 animate()가 읽는 상태를 뒤에 선언해 로딩이 영구 정지한 사고가 있었음(2026-08-26).
const iDecl = html.indexOf('let ARTISTS=[],GROUPS={};');
ok(iDecl > 0 && html.indexOf('function _groupIsOver') > iDecl,
  '_groupIsOver가 GROUPS 선언보다 앞에 있음');

// ── 데이터: 실제 분기 분포 ───────────────────────────────────────
const grps = a => a.groups || [a.group];
const groupIsOver = ko => {
  if ((GROUPS[ko] || {}).disbanded) return true;
  const m = ARTISTS.filter(a => a.group.ko === ko);
  return m.length > 0 && m.every(a => a.active === false);
};
const buckets = { left: 0, end: 0, over: 0, blocked: [] };
ARTISTS.forEach(a => grps(a).forEach(g => {
  const act = g.active !== undefined ? g.active : a.active;
  if (act !== false) return;
  const left = g.left !== undefined ? g.left : a.left;
  if (left) { buckets.left++; return; }
  if (endOf && endOf(g.ko) !== null && GROUPS[g.ko]) { buckets.end++; return; }
  if (groupIsOver(g.ko)) { buckets.over++; return; }
  buckets.blocked.push(`${g.ko}/${a.name.ko}`);
}));
// 회귀 감시: 예전엔 left 없는 비활동 멤버가 **전원**(110명) 차단이었다. 두 자릿수로 되돌아가면
// disbanded 데이터가 지워졌거나 폴백이 깨진 것.
ok(buckets.blocked.length <= 15,
  `차단 유지 멤버가 ${buckets.blocked.length}명 — 폴백이 깨졌거나 disbanded가 지워짐: ${buckets.blocked.slice(0, 8).join(', ')}`);
ok(buckets.end + buckets.over >= 90,
  `폴백으로 살아나는 멤버가 ${buckets.end + buckets.over}명뿐 — 90명 이상이어야 함`);

// 이번에 채운 해체일이 남아 있는가(다른 세션이 지우면 99명이 도로 막힌다)
for (const [ko, d] of Object.entries({
  '쥬얼리': '2015', '스텔라': '2018.02.25', '유니티': '2018.10.12', '유앤비': '2019',
  '헬로비너스': '2019.05.08', '소나무': '2021.09.08', '네이처': '2024.04.27',
})) {
  ok((GROUPS[ko] || {}).disbanded === d, `${ko}의 disbanded가 ${d}가 아님 (${(GROUPS[ko] || {}).disbanded})`);
}
// 걸스데이는 나무위키에 "해체를 선언하지 않은 채"라고 명시 — disbanded를 박으면 안 된다.
// (전 멤버 3명은 left를 채우는 게 맞는 처리)
ok((GROUPS['걸스데이'] || {}).disbanded === undefined,
  '걸스데이에 disbanded가 설정됨 — 공식 해체 선언이 없는 그룹');

// disbanded 값 형태는 _groupEndDate가 아는 3종만 허용
Object.entries(GROUPS).forEach(([ko, v]) => {
  if (!v || v.disbanded === undefined) return;
  const d = v.disbanded;
  const okShape = d === true || (typeof d === 'string' && /^\d{4}(\.\d{1,2}){0,2}$/.test(d.trim()));
  ok(okShape, `${ko}의 disbanded 형태가 이상함: ${JSON.stringify(d)}`);
});

console.log(`member-cutoff: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
