// "③ 자체 멤버 태깅 재검증" 제거 가드 회귀 테스트 (2026-09-10 신설)
//
// 배경: 이 스윕은 **태그를 붙일 때 쓰는** 매처(_atmResolveMembers)를 그대로 **제거 판정**에 썼다.
// 그 매처는 "그룹명 없이 이름만 있는 제목"을 일부러 약하게 보기 때문에, 제목에 이름이 뻔히 있어도
// 지지하지 않는다. 그대로 지우면 정상 태그가 날아간다 — 상위 5,000행 시뮬레이션에서 바뀌는 38행 중
// 다수가 정상이었다(GD X TAEYANG의 지디, Feat. Felix의 필릭스, 바스타즈 유닛 3명, tripleS MV 23명…).
// 이 프로젝트가 이미 겪은 "성-뗀 가드가 정상 태그 9,000건 삭제" 사고와 같은 계열이라 가드 3개를 걸었다:
//   A) 이름(한글·영문·별칭·성 뗀 변형)이 제목/설명에 문자로도 없을 때만 제거
//   B) 멤버가 전부 빠지는 행은 적용하지 않고 검수 큐로만
//   C) 한 행에서 2명 이상 한꺼번에 빠지면 적용하지 않고 검수 큐로만
//
// ⚠️ 케이스는 전부 실제 DB 행의 제목이다. 가드를 완화하려면 먼저 시뮬레이션을 돌릴 것 —
//    "매처가 지지 안 함"은 오태깅의 증거가 아니다.
//
// 실행: node tests/members-sweep-guard.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');

function extractByBraces(re, label) {
  const m = re.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  let i = src.indexOf('{', m.index), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
function extractStatement(re, label) {
  const m = re.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  let depth = 0;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(m.index, i + 1);
  }
  throw new Error(`[harness] 문장 끝(;)을 못 찾음: ${label}`);
}
const { _sweepNormHay, _sweepPlanMemberFix } = new Function([
  extractStatement(/^const _ATM_KOREAN_SURNAMES\s*=/m, '_ATM_KOREAN_SURNAMES'),
  extractByBraces(/^function _atmStripSurname\(/m, '_atmStripSurname'),
  extractByBraces(/^function _sweepNormHay\(/m, '_sweepNormHay'),
  extractByBraces(/^function _sweepMemberNameTokens\(/m, '_sweepMemberNameTokens'),
  extractByBraces(/^function _sweepNameAppears\(/m, '_sweepNameAppears'),
  extractByBraces(/^function _sweepPlanMemberFix\(/m, '_sweepPlanMemberFix'),
  'return {_sweepNormHay, _sweepPlanMemberFix};',
].join('\n'))();

// artists.json에서 실제 로스터 엔트리를 만들어 쓴다(별칭 누락 같은 데이터 문제까지 같이 잡히게).
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const groupsOf = a => (a.groups && a.groups.length ? a.groups : [a.group]).filter(Boolean);
const rosterFor = gko => ARTISTS.filter(a => groupsOf(a).some(g => g.ko === gko)).map(a => {
  const e = groupsOf(a).find(g => g.ko === gko) || {};
  return { ko: a.name.ko, en: a.name.en, left: (e.left !== undefined ? e.left : a.left), aliases: a.matchAliases };
});

let fail = 0;
function plan(gko, title, desc, curM, valid) {
  return _sweepPlanMemberFix(curM, new Set(valid), rosterFor(gko), _sweepNormHay(title, desc));
}
function check(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fail++; console.log(`  ✗ ${label}\n     기대 ${JSON.stringify(want)}\n     실제 ${JSON.stringify(got)}`); }
}

console.log('1) 가드 A — 제목에 이름이 있으면(별칭·영문 포함) 매처가 몰라도 남긴다');
{
  // 매처가 태양만 지지하는 상황을 재현. 지디는 제목에 "GD"로만 있다 → matchAliases가 있어야 살아남는다.
  const p = plan('빅뱅', "GD X TAEYANG - 'GOOD BOY' DANCE PRACTICE VIDEO", null, ['지디', '태양'], ['태양']);
  check('GD 별칭으로 지디 유지', { apply: p.apply, removed: p.removed, reason: p.reason }, { apply: false, removed: [], reason: 'no-change' });
}
{
  const p = plan('쥬얼리', '서인영 VS 이지현 결혼 배틀', null, ['서인영', '이지현'], []);
  check('제목에 실명이 그대로 있으면 유지', { apply: p.apply, removed: p.removed }, { apply: false, removed: [] });
}
{
  // 영문 표기로만 등장하는 경우 — "Felix"(필릭스)는 트와이스 로스터가 아니라 이름 그대로 대조된다.
  const p = plan('스트레이키즈', 'NAYEON "NO PROBLEM (Feat. Felix of Stray Kids)" Band Live Clip', null, ['필릭스'], []);
  check('영문명으로 등장하면 유지', { apply: p.apply, removed: p.removed }, { apply: false, removed: [] });
}
{
  // 설명란에만 있어도 근거로 인정한다(제목만 보면 근거가 없어 보이는 정상 행 방어).
  const p = plan('아이브', '엔딩 요정 모음', '오늘의 주인공: 안유진 #IVE', ['안유진'], []);
  check('설명란 근거 인정', { apply: p.apply, removed: p.removed }, { apply: false, removed: [] });
}

console.log('2) 가드 B — 전부 빠지는 행은 적용하지 않는다(검수 큐로만)');
{
  const p = plan('블락비', '바스타즈(BASTARZ) - 품행제로(Zero For Conduct) @인기가요 Inkigayo 20150419', null, ['비범', '유권', '피오'], []);
  check('유닛 영상 전멸 방지', { apply: p.apply, reason: p.reason, n: p.removed.length }, { apply: false, reason: 'would-wipe', n: 3 });
}

console.log('3) 가드 C — 2명 이상 한꺼번에 빠지면 적용하지 않는다');
{
  const p = plan('르세라핌', 'LE SSERAFIM - Perfect Night (Live Performance) | Vevo', null,
    ['사쿠라', '허윤진', '카즈하', '홍은채'], ['사쿠라', '카즈하']);
  check('그룹 무대에서 일부만 임의 제거 방지', { apply: p.apply, reason: p.reason, removed: p.removed }, { apply: false, reason: 'bulk-removal', removed: ['허윤진', '홍은채'] });
}

console.log('4) 진짜 유령 한 명은 지운다 — 가드가 아무것도 못 지우게 만들면 안 됨');
{
  // 실제 사례: "GO LIVE IN LIFE"의 "IN"이 아이엔으로 잡혀 있던 행. 제목·설명 어디에도 아이엔 표기가 없다.
  const p = plan('스트레이키즈', "[Beyond LIVE - Stray Kids 'Unlock : GO LIVE IN LIFE'] Moving Poster Bang Chan Ver.", null,
    ['방찬', '아이엔'], ['방찬']);
  check('단독 유령 제거', { apply: p.apply, reason: p.reason, removed: p.removed, newM: p.newM }, { apply: true, reason: 'single-ghost', removed: ['아이엔'], newM: ['방찬'] });
}
{
  const p = plan('키스오브라이프', "[K-Fancam] 키스오브라이프 나띠 직캠 'Igloo' (KISS OF LIFE NATTY Fancam) @뮤직뱅크(Music Bank) 241101", null,
    ['나띠', '쥴리'], ['나띠']);
  check('직캠에 섞인 단독 유령 제거', { apply: p.apply, removed: p.removed }, { apply: true, removed: ['쥴리'] });
}

console.log('5) 바뀔 게 없으면 아무것도 안 한다');
{
  const p = plan('아이브', '[페이스캠4K] 아이브 안유진', null, ['안유진'], ['안유진']);
  check('변화 없음', { apply: p.apply, reason: p.reason }, { apply: false, reason: 'no-change' });
}

console.log(fail ? `\n❌ 실패 ${fail}건` : '\n✅ 전부 통과 (10건)');
process.exit(fail ? 1 : 0);
