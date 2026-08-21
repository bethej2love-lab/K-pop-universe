// 태깅/매칭 엔진(_m2ParseTitle) 회귀 테스트 (2026-08-21 신설)
//
// 왜 이런 방식인가: 이 프로젝트엔 빌드 스텝이 없고(정적 HTML+JS를 그대로 서빙) _m2ParseTitle은
// admin.js 안에 브라우저 전역(GROUPS/ARTISTS/DOM 등)을 전제로 한 코드 옆에 묶여 있어서 그냥
// require()할 수 없다. 그렇다고 로직을 통째로 손으로 다시 베껴 쓰면 실제 코드와 조용히 어긋날
// 위험이 있으므로(카피 드리프트), 매 실행마다 admin.js/index.html 원본에서 필요한 함수/데이터
// 선언부만 "이름으로" 찾아 그대로 잘라내 Node vm에서 실행한다 — 실제 배포되는 코드 그 자체를 테스트.
//
// 커버 범위: _m2ParseTitle 하나(가장 사고가 많이 났던 매칭 엔진). _extBuildRows/_classifyGuestGroup
// 등 주변 함수는 이번 1차 범위 밖(다음에 필요하면 같은 패턴으로 추가).
// 커버 안 되는 것: name_match_whitelist 같은 DB 로드 동적 화이트리스트(_ATM_DYNAMIC_*)는 빈 Set으로
// 초기화 — 하드코딩된 보호 로직만 검증하고, DB에만 있는 데이터는 이 테스트로 못 잡는다.
//
// 실행: node tests/matching.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const adminSrc = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

// src에서 "declStartRe에 매치되는 줄"부터 중괄호/세미콜론 균형이 맞는 지점까지를 그대로 잘라낸다.
// 정규식 리터럴 안의 중괄호(예: /[\]\)>】]/)까지 카운트에 낄까봐 걱정할 수 있는데, 이 프로젝트
// 함수들은 실제로 괄호류를 문자 클래스 안에 쓸 때도 늘 이스케이프하거나 클래스로 감싸서 단독
// '{'/'}' 문자가 코드 밖(문자열/정규식)에 거의 안 나옴 — 그래도 혹시 몰라 슬라이스 직후 아래에서
// Function 생성자로 실제 파싱해보는 것 자체가 최종 검증(문법 오류 나면 즉시 실패).
function extractByBraces(src, declStartRe, label) {
  const m = declStartRe.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  const start = m.index;
  let i = src.indexOf('{', start);
  if (i === -1) throw new Error(`[harness] 여는 중괄호를 못 찾음: ${label}`);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
function extractStatement(src, declStartRe, label) {
  // const X=...; 형태 — 최상위(중괄호 깊이 0)에서 처음 만나는 ';'까지. 안에 객체/배열 리터럴이
  // 있어도(중괄호/대괄호) depth로 걸러서 진짜 문장 끝 세미콜론만 종료로 인정.
  const m = declStartRe.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  const start = m.index;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`[harness] 문장 끝(;)을 못 찾음: ${label}`);
}

const pieces = [];
pieces.push(extractStatement(adminSrc, /^const _WONKOK_BRACKETS\s*=/m, '_WONKOK_BRACKETS'));
pieces.push(extractByBraces(adminSrc, /^function _isBeOriginal\(/m, '_isBeOriginal'));
pieces.push(extractByBraces(adminSrc, /^function _wonkokStripClause\(/m, '_wonkokStripClause'));
pieces.push(extractStatement(adminSrc, /^const _ATM_KOREAN_SURNAMES\s*=/m, '_ATM_KOREAN_SURNAMES'));
pieces.push(extractByBraces(adminSrc, /^function _atmEscRe\(/m, '_atmEscRe'));
pieces.push(extractStatement(adminSrc, /^const _ATM_HASHTAG_ONLY_NAMES\s*=/m, '_ATM_HASHTAG_ONLY_NAMES'));
pieces.push(extractByBraces(adminSrc, /^function _atmStripSurname\(/m, '_atmStripSurname'));
pieces.push(extractByBraces(adminSrc, /^function _isHashtagOnlyName\(/m, '_isHashtagOnlyName'));
pieces.push(extractStatement(adminSrc, /^const _m2VariantsCache\s*=/m, '_m2VariantsCache'));
pieces.push(extractByBraces(adminSrc, /^function _m2NameVariants\(/m, '_m2NameVariants'));
pieces.push(extractStatement(adminSrc, /^const _GROUP_TITLE_CONFLICT_EXCLUDE\s*=/m, '_GROUP_TITLE_CONFLICT_EXCLUDE'));
pieces.push(extractStatement(adminSrc, /^const _GROUP_AMBIGUOUS_IF_COMATCHED\s*=/m, '_GROUP_AMBIGUOUS_IF_COMATCHED'));
pieces.push(extractByBraces(adminSrc, /^function _m2ParseTitle\(/m, '_m2ParseTitle'));

pieces.push(extractByBraces(htmlSrc, /^function _artistGroups\(/m, '_artistGroups'));
pieces.push(extractStatement(htmlSrc, /^const _UNIT_HASHTAG_ONLY_TOKENS\s*=/m, '_UNIT_HASHTAG_ONLY_TOKENS'));
pieces.push(extractStatement(htmlSrc, /^const _PROJECT_UNITS\s*=/m, '_PROJECT_UNITS'));

const harnessSrc = `
const GROUPS=${JSON.stringify(GROUPS)};
const ARTISTS=${JSON.stringify(ARTISTS)};
// DB에서 런타임에 채워지는 동적 화이트리스트 — 테스트에선 빈 Set(하드코딩된 보호만 검증, 위 주석 참고)
const _ATM_DYNAMIC_HASHTAG_NAMES=new Set();
const _ATM_DYNAMIC_AMBIGUOUS_COMATCH=new Set();
const _ATM_DYNAMIC_LITERAL_ONLY=new Set();
const _STRICT_SYNC_GROUPS=new Set(Object.entries(GROUPS).filter(([,v])=>v&&v.strictSync).map(([ko])=>ko));
${pieces.join('\n')}
module.exports={_m2ParseTitle,_PROJECT_UNITS,GROUPS,ARTISTS};
`;

let mod;
try {
  const fn = new Function('module', 'exports', 'require', harnessSrc);
  mod = { exports: {} };
  fn(mod, mod.exports, require);
} catch (e) {
  console.error('[harness] 소스 슬라이스 조립/실행 실패 — admin.js/index.html이 리팩터링돼서 이 추출 로직을 갱신해야 할 수 있음:');
  console.error(e);
  process.exit(2);
}
const { _m2ParseTitle, _PROJECT_UNITS } = mod.exports;

// ── 테스트 케이스 ──────────────────────────────────────────────
// 각 케이스는 실제 사고/수정 이력(CHANGELOG 2026-07~08) 기반. check(result)가 true를 반환해야 통과.
const cases = [];
function test(name, title, selfGko, check) { cases.push({ name, title, selfGko, check }); }

test(
  '트리플에스 AAA — 해시태그 없이 평문이면 안 걸림',
  '아이브 IVE AAA 비하인드 풀버전', undefined,
  r => !r || !r.membersByGroup['트리플에스']
);
test(
  '트리플에스 AAA — #AAA 해시태그면 걸림',
  '#AAA 챌린지 모음', undefined,
  r => !!(r && r.membersByGroup['트리플에스'] && r.membersByGroup['트리플에스'].length)
);
test(
  'Aria 유닛 완전 제거 확인(트리거 자체가 없어야 함)',
  null, null,
  () => !Object.values(_PROJECT_UNITS).some(u => u.names.some(n => /^aria$|^아리아$/i.test(n)))
);
test(
  '15& 리터럴 전용 — "15주년"처럼 숫자만 있으면 피프틴앤드 안 걸림',
  '데뷔 15주년 기념 라이브', undefined,
  r => !r || !(r.primaryGroup === '피프틴앤드' || (r.withGroups || []).includes('피프틴앤드'))
);
test(
  '15& 리터럴 전용 — "15&" 그대로 있으면 걸림',
  '15& 신곡 무대 직캠', undefined,
  r => !!(r && (r.primaryGroup === '피프틴앤드' || (r.withGroups || []).includes('피프틴앤드')))
);
test(
  '여자친구(strictSync) — 외부채널 제목에 그룹명이 있어도 title-matching에서 제외',
  '여자친구 신곡 커버 챌린지', undefined,
  r => !r || !(r.primaryGroup === '여자친구' || (r.withGroups || []).includes('여자친구'))
);
test(
  '단일음절 이름("키") — 평문 문장 속 단어로는 샤이니 안 걸림',
  '이번 라운드 키 포인트는 팀워크입니다', undefined,
  r => !r || !r.membersByGroup['샤이니']
);
test(
  '단일음절 이름("키") — #키 해시태그면 걸림',
  '오늘의 무대 #키 직캠', undefined,
  r => !!(r && r.membersByGroup['샤이니'] && r.membersByGroup['샤이니'].includes('키'))
);
test(
  '단일음절 이름("온") — 영어 문장 속 On은 올아워즈로 안 잡힘(크래비티 채널)',
  'On a street in Spain 비하인드', '크래비티',
  r => !r || !r.membersByGroup['올아워즈']
);
test(
  '지유 동명이인 — selfGko 없이 "지유"만 있으면 모호해서 버림(null)',
  '지유 직캠 모음', undefined,
  r => r === null
);
test(
  '지유 동명이인 — selfGko="드림캐쳐"면 드림캐쳐 지유만 인정',
  '지유 직캠', '드림캐쳐',
  r => !!(r && r.primaryGroup === '드림캐쳐' && (r.membersByGroup['드림캐쳐'] || []).includes('지유'))
);
test(
  '마크 겸임(부소속) — 엔시티 드림 언급 시 부소속인 마크도 로스터에서 잡힘',
  '엔시티 드림 마크 무대 직캠', undefined,
  r => !!(r && (r.membersByGroup['엔시티 드림'] || []).includes('마크'))
);

// 참고용(단정하지 않음) — 이번 회귀 스위트 작성 중 새로 발견한 실제 잠재 이슈:
// "마크"는 엔시티(겸임)와 GOT7(마크 투안) 양쪽에 실존하는 동명이인인데, 그룹명 없이 "마크"만
// 있는 제목은 동명이인 충돌 로직상 두 사람 모두 후보가 되어 결과가 어떻게 나오는지 검증이 안 돼있음
// (엔시티 마크 본인의 겸임 소속 인정 로직과, 이 동명이인 충돌 로직이 상호작용하는 지점이라 별도 검토
// 필요 — 이번 세션에서 새로 발견, 아직 실제 오염 사례로 확인된 건 아님). 단정적 assert 없이 결과만 출력.
(function reportMarkAmbiguity() {
  const r = _m2ParseTitle('마크 직캠 모음', undefined, false);
  console.log('[참고] "마크" bare 매칭 결과(동명이인 잠재 이슈, assert 없음):', JSON.stringify(r));
})();

// ── 실행 ──────────────────────────────────────────────
let pass = 0, fail = 0;
cases.forEach(({ name, title, selfGko, check }) => {
  let result, ok, err = null;
  try {
    result = title === null ? undefined : _m2ParseTitle(title, selfGko, false);
    ok = check(result);
  } catch (e) { ok = false; err = e; }
  if (ok) { pass++; console.log(`✅ ${name}`); }
  else {
    fail++;
    console.log(`❌ ${name}`);
    if (title !== null) console.log(`   title="${title}" selfGko=${selfGko || '(none)'}`);
    console.log(`   result=${JSON.stringify(result)}`);
    if (err) console.log(`   error=${err.message}`);
  }
});
console.log(`\n${pass}/${cases.length} 통과${fail ? `, ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
