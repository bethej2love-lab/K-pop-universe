// 매칭 엔진 하네스 — admin.js/index.html의 실코드를 이름으로 잘라내 Node에서 실행한다.
//
// 원래 tests/matching.test.js 안에 있던 것을 모듈로 뺐다(2026-09-15). 태깅 정확도 감사
// (tools/tagging_audit.cjs)도 같은 매처를 돌려야 하는데, 하네스를 복붙하면 두 벌이 조용히
// 어긋난다 — 이 파일이 카피 드리프트를 막는 단일 출처다.
// ⚠️ _m2ParseTitle이 새 최상위 함수를 부르게 되면 아래 pieces 목록에도 반드시 추가할 것
//    (안 하면 "... is not defined"로 전 케이스가 실패한다).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const adminSrc = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
// _artistGroups/_ytGroupKoFor/_UNIT_HASHTAG_ONLY_TOKENS/_PROJECT_UNITS는 2026-08-21 "파일 분리 0단계"로
// shared.js에 모여있어서 더는 index.html을 슬라이스할 필요가 없음 — 파일 하나를 그대로 통째로 실행.
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
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
// 로테이션 유닛(NCT U) 판정 헬퍼 — _m2ParseTitle이 유닛 확장에서 호출한다(2026-08-25 신설).
// ⚠️ 이 하네스는 "이름으로 잘라오기" 방식이라, _m2ParseTitle이 새 최상위 함수를 부르게 되면
// 여기에도 반드시 추가해야 함(안 하면 "... is not defined"로 전 케이스가 실패한다).
pieces.push(extractByBraces(adminSrc, /^function _unitMemberNamedInTitle\(/m, '_unitMemberNamedInTitle'));
pieces.push(extractByBraces(adminSrc, /^function _atmLeftBefore\(/m, '_atmLeftBefore')); // 탈퇴 게이트(2026-08-25)
pieces.push(extractByBraces(adminSrc, /^function _atmStripCommonNounCtx\(/m, '_atmStripCommonNounCtx')); // 하루 등 흔한단어 일반명사 문맥 제거(2026-08-29) — _m2ParseTitle이 전처리에서 부름
// 음악방송 직캠 구조 파서(2026-08-29) — _m2ParseTitle이 매칭 전에 호출한다
pieces.push(extractByBraces(adminSrc, /^function _fancamShowPatterns\(/m, '_fancamShowPatterns'));
pieces.push(extractStatement(adminSrc, /^const _FANCAM_SHOW_PATTERNS\s*=/m, '_FANCAM_SHOW_PATTERNS'));
pieces.push(extractStatement(adminSrc, /^const _FANCAM_FILLER_RE\s*=/m, '_FANCAM_FILLER_RE'));
pieces.push(extractByBraces(adminSrc, /^function _fancamNormTok\(/m, '_fancamNormTok'));
pieces.push(extractByBraces(adminSrc, /^function _fancamParseTitle\(/m, '_fancamParseTitle'));
// 데뷔 이전 게이트(2026-08-31) — _m2ParseTitle이 두 출구(literal 매칭·역추론)에서 부른다
pieces.push(extractStatement(adminSrc, /^const _M2_DEBUT_GRACE_YEARS\s*=/m, '_M2_DEBUT_GRACE_YEARS'));
pieces.push(extractByBraces(adminSrc, /^function _m2DebutBlocks\(/m, '_m2DebutBlocks'));
// 동명이인 tie-break(2026-09-03) — _m2ParseTitle이 "영상 시점에 이미 해체된 그룹의 후보는 그 사람일 수
// 없다"를 판단할 때 부른다. 계산 본체 _groupEndDate는 index.html에 있고(멤버 카드 컷오프와 공유),
// admin.js의 _disbandCutoffDate가 그걸 그대로 감싼다 — 두 벌로 복제하지 않으려고 이렇게 돼 있으므로
// 하네스도 양쪽에서 각각 잘라온다.
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
pieces.push(extractByBraces(indexSrc, /^function _groupEndDate\(/m, '_groupEndDate'));
pieces.push(extractByBraces(adminSrc, /^function _disbandCutoffDate\(/m, '_disbandCutoffDate'));
pieces.push(extractByBraces(adminSrc, /^function _m2ParseTitle\(/m, '_m2ParseTitle'));

const harnessSrc = `
const GROUPS=${JSON.stringify(GROUPS)};
const ARTISTS=${JSON.stringify(ARTISTS)};
${sharedSrc}
// DB에서 런타임에 채워지는 동적 화이트리스트 — 테스트에선 빈 Set(하드코딩된 보호만 검증, 위 주석 참고)
const _ATM_DYNAMIC_HASHTAG_NAMES=new Set();
const _ATM_DYNAMIC_AMBIGUOUS_COMATCH=new Set();
const _ATM_DYNAMIC_LITERAL_ONLY=new Set();
const _STRICT_SYNC_GROUPS=new Set(Object.entries(GROUPS).filter(([,v])=>v&&v.strictSync).map(([ko])=>ko));
${pieces.join('\n')}
module.exports={_m2ParseTitle,_PROJECT_UNITS,_fancamParseTitle,_m2NameVariants,_atmStripSurname,_isHashtagOnlyName,GROUPS,ARTISTS};
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

module.exports = mod.exports; // { _m2ParseTitle, _PROJECT_UNITS, _fancamParseTitle, GROUPS, ARTISTS }
