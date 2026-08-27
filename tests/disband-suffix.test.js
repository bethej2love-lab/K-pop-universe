// 그룹 카드 데뷔일 옆 "~ 해체일" 표기 (2026-08-27, 사용자 요청)
// 요구: 데뷔일 뒤에 붙이고 · 클릭 안 되고 · 데뷔일보다 어둡게 · 폰트 크기는 동일하게.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

// ── 렌더 ─────────────────────────────────────────────────────────
ok(/disSuffix\.className='gc-show-suffix gc-disband-suffix';/.test(html),
  '해체일 span이 .gc-show-suffix(폰트 통일 + 클릭 불가) 위에 얹히지 않음');
ok(/disSuffix\.textContent=` ~ \$\{_dis\}`;/.test(html), '"~ 날짜" 형식이 아님');
// 데뷔 칩 바로 뒤, [프로그램명]·(옛이름)보다 앞 — 활동 기간으로 읽혀야 한다
const iChip = html.indexOf("_renderTagChip(document.getElementById('gc-debut')");
const iDis = html.indexOf('gc-disband-suffix');
const iShow = html.indexOf('showSuffix.textContent');
const iAlt = html.indexOf('altSuffix.textContent');
ok(iChip > 0 && iDis > iChip, '해체일이 데뷔 칩보다 앞에 붙음');
ok(iDis < iShow && iDis < iAlt, '해체일이 [프로그램명]/(옛이름)보다 뒤에 붙음 — 기간으로 안 읽힘');

// disbanded:true(날짜 미상)는 붙일 게 없으므로 생략해야 한다
// 백슬래시 이스케이프에 기대면(`/\d/`를 정규식으로 매칭하려다) 오히려 헛통과하기 쉬워서,
// 조건절 텍스트를 그대로 잘라 부분 문자열로 확인한다.
const guard = (() => {
  const i = html.indexOf('const _dis=info.disbanded;');
  return i < 0 ? '' : html.slice(i, i + 220);
})();
ok(guard.includes("typeof _dis==='string'"),
  'disbanded가 true(날짜 미상)인 경우를 걸러내지 않음 — " ~ true"가 찍힌다');
ok(guard.includes('.test(_dis)'),
  '숫자 포함 검사가 없음 — 날짜가 아닌 문자열이 그대로 찍힐 수 있다');

// ── 스타일 ───────────────────────────────────────────────────────
const rule = /\.gc-show-suffix\.gc-disband-suffix\{([^}]*)\}/.exec(css);
ok(!!rule, '.gc-disband-suffix 스타일이 없음');
if (rule) {
  const body = rule[1];
  // 폰트 크기를 다시 지정하면 데뷔일과 어긋난다 — .gc-show-suffix의 11px를 그대로 물려받아야 한다
  ok(!/font-size/.test(body), '해체일에 font-size를 따로 지정함 — 데뷔일과 크기가 어긋날 수 있음');
  ok(/text-shadow:\s*none/.test(body), 'glow를 안 껐음 — 빛나면 현재형으로 읽힌다');
  const col = /color:\s*rgba\(([^)]*)\)/.exec(body);
  ok(!!col, '색 지정이 없음');
  if (col) {
    const alpha = Number(col[1].split(',').pop().trim());
    // 데뷔일 칩(.tag-chip)은 알파 0.80 — 그보다 확실히 낮아야 "어둡게"가 된다
    ok(alpha < 0.6, `해체일 알파가 ${alpha} — 데뷔일(0.80)보다 충분히 어둡지 않음`);
    // 이 프로젝트의 기존 "과거형" 색과 같은 값을 써야 한다(같은 뜻에 톤이 두 개가 되면 안 됨)
    const past = /\.tag-chip\.tag-chip-past\{color:\s*rgba\(([^)]*)\)/.exec(css);
    ok(past && past[1].replace(/\s/g, '') === col[1].replace(/\s/g, ''),
      `.tag-chip-past(${past ? past[1] : '?'})와 다른 색을 씀 — 같은 의미에 톤이 두 개가 됨`);
  }
  // 특이도: .gc-show-suffix(0,1,0)보다 높아야 색이 실제로 덮인다
  ok(/\.gc-show-suffix\.gc-disband-suffix/.test(css), '단일 클래스 선택자라 기본 색에 안 밀리는지 불확실');
}

// ── 데이터 ───────────────────────────────────────────────────────
const dated = Object.entries(GROUPS).filter(([, v]) => v && typeof v.disbanded === 'string' && /\d/.test(v.disbanded));
const boolOnly = Object.entries(GROUPS).filter(([, v]) => v && v.disbanded === true);
ok(dated.length > 30, `해체일이 날짜로 있는 그룹이 ${dated.length}팀뿐 — 데이터가 지워졌는지 확인`);
console.log(`  (표기 대상 ${dated.length}팀 · 날짜 미상이라 생략 ${boolOnly.length}팀${boolOnly.length ? ': ' + boolOnly.map(([k]) => k).join(',') : ''})`);
// 형식이 _groupEndDate가 아는 3종을 벗어나면 " ~ 이상한값"이 그대로 찍힌다
dated.forEach(([ko, v]) => ok(/^\d{4}(\.\d{1,2}){0,2}$/.test(v.disbanded.trim()),
  `${ko}의 disbanded 형식이 이상함: ${JSON.stringify(v.disbanded)}`));

console.log(`disband-suffix: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
