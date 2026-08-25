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
// publishedAt: 탈퇴 게이트(_atmLeftBefore) 검증용 4번째 인자. 안 주면 기존처럼 날짜 없이 파싱.
function test(name, title, selfGko, check, publishedAt) { cases.push({ name, title, selfGko, check, publishedAt }); }

// ── confidence 판정(2026-08-25) ─────────────────────────────────
// 역추론 결과는 전부 'weak'라 검수 큐로 갔는데, 실측해보니 큐 3,051건 중 661건(22%)이 #KEY·#키처럼
// 해시태그로 멤버가 박혀 있었음 — 업로더가 태그로 특정해준 걸 "추측"으로 볼 이유가 없어 strong으로.
// weak는 _extBuildRows에서 needs_review 플래그로 이어지므로, 이 판정이 곧 큐 유입량을 정한다.
test('confidence — 해시태그로 멤버가 명시되면 strong',
  "Oh baby, I'm cravin #KEY #키 #REDY", undefined,
  r => !!r && r.confidence === 'strong');
test('confidence — 평문 이름만 있으면 weak 유지(검수 대상)',
  '[레어탬] EP 5 오늘은 태민이 게임왕 TAEMIN 태민', undefined,
  r => !!r && r.confidence === 'weak');

// ── 탈퇴 게이트(2026-08-25, 사용자 제보 "라이즈 탈퇴한 승한 직캠이 라이즈 카드에 뜬다") ─────
// 제목만으론 절대 구분할 수 없는 종류의 오류 — 2023년 "[MPD직캠] 라이즈 승한 'Talk Saxy'"는 정당하고
// 2026년 "승한 댄스 실력"은 오태깅인데 둘 다 제목엔 승한만 있다. 발행일이 유일한 단서.
// ⚠️ 전제: 탈퇴 이력을 로스터에서 지우지 말고 {active:false,left:"..."}로 남길 것. 승한은 통째로
//    삭제돼 있어서 이 게이트가 작동할 근거 자체가 없었고, 복원하니 이번엔 탈퇴 후 영상까지 라이즈로
//    잡히는 역효과가 났다 — 로스터 복원과 이 게이트는 반드시 세트.
test('탈퇴 게이트 — 탈퇴 후 솔로 활동 영상은 옛 그룹으로 안 잡힘',
  "[안방1열 직캠4K] 승한앤소울 승한 'Glow' (XngHan&Xoul XngHan FanCam)", undefined,
  r => !r || (r.primaryGroup !== '라이즈' && !(r.withGroups || []).includes('라이즈')), '2026-05-13');
test('탈퇴 게이트 — 활동기(탈퇴 전) 영상은 그대로 유지',
  "[MPD직캠] 라이즈 승한 직캠 4K 'Talk Saxy' (RIIZE SEUNGHAN FanCam)", undefined,
  r => !!r && (r.primaryGroup === '라이즈' || (r.withGroups || []).includes('라이즈')), '2023-11-09');
test('탈퇴 게이트 — 발행일을 안 주면 기존 동작 유지(하위호환)',
  "[MPD직캠] 라이즈 승한 직캠 4K 'Talk Saxy' (RIIZE SEUNGHAN FanCam)", undefined,
  r => !!r && (r.primaryGroup === '라이즈' || (r.withGroups || []).includes('라이즈')));

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
// ── 앤팀 &TEAM 리터럴 전용(2026-08-25, 사용자 제보) ─────────────────
// hit()이 특수문자를 공백으로 바꾸는 탓에 '&TEAM'이 그냥 'TEAM'이 돼서 무관한 제목이 대량 매칭됐음
// (실측 3,438건 중 328건). '15&'와 같은 계열이라 _GROUP_TOKEN_LITERAL_ONLY로 처리.
// ⚠️ 실제 제목은 '&TEAM'보다 '#andTEAM'을 훨씬 많이 쓰므로 altNames로 그쪽도 살려야 함 — 세트로 검증.
test('앤팀 — 공식 표기 &TEAM 은 매칭됨(리터럴)', '&TEAM Under the skin MV', undefined,
  r => !!r && (r.primaryGroup === '앤팀' || (r.withGroups || []).includes('앤팀')));
test('앤팀 — 실제로 많이 쓰는 #andTEAM 표기도 매칭됨', 'wolves are coming #MarkonMe #andTEAM', undefined,
  r => !!r && (r.primaryGroup === '앤팀' || (r.withGroups || []).includes('앤팀')));
test('앤팀 — 한글 "앤팀"도 매칭됨', '앤팀 콘서트 비하인드', undefined,
  r => !!r && (r.primaryGroup === '앤팀' || (r.withGroups || []).includes('앤팀')));
test('앤팀 — bare "Team"은 매칭 안 됨(오염 원인)', 'Team 5JANGNAM - Officially Missing You', undefined,
  r => !r || (r.primaryGroup !== '앤팀' && !(r.withGroups || []).includes('앤팀')));
test('앤팀 — "Team A vs B"도 매칭 안 됨', 'Hoodie Girls Team A vs B', undefined,
  r => !r || (r.primaryGroup !== '앤팀' && !(r.withGroups || []).includes('앤팀')));

// ── "솔로" placeholder 누출(2026-08-25 실측으로 발견) ──────────────────
// 무소속 솔로(아이유·승한 등)는 artists.json에서 group.ko가 "솔로"인데, 이건 여러 명이 공유하는
// 가짜 값이라 group_ko로 쓰면 안 됨(_isValidVidGroupKo도 무효 처리). 그런데 역추론 경로가 이걸
// 그대로 반환해서 group_ko='솔로' 영상이 633건 쌓여 어느 카드에도 안 걸리는 미아가 돼 있었음.
test('솔로 placeholder — 무소속 솔로는 "솔로"가 아니라 본인 이름으로 잡혀야', '승한앤소울 승한 \'Glow\' FanCam', undefined,
  r => !!r && r.primaryGroup === '승한');
test('솔로 placeholder — 어떤 경우에도 "솔로"가 그룹으로 나오면 안 됨', '카리나의 아이유 \'그 사람\' 커버', undefined,
  r => !r || (r.primaryGroup !== '솔로' && !(r.withGroups || []).includes('솔로') && !Object.keys(r.membersByGroup || {}).includes('솔로')));

// ── NCT U(로테이션 유닛) ─────────────────────────────────────────
// 다른 유닛(부석순·유아유 등)은 유닛명이 뜨면 그 멤버 전원이 참여한 게 맞지만, NCT U의 members는
// "NCT U로 활동한 적 있는 사람 21명 풀"이라 전원 확장하면 참여도 안 한 멤버가 붙는다.
// 실제로 2026-08-25 실측에서 767건이 이렇게 오염돼 있었음(지성321·마크114·정우113·재현113·도영106).
// shared.js의 rotating:true 로 "제목에 이름이 따로 언급된 멤버만" 인정하도록 바꾼 것의 회귀 방지.
test(
  'NCT U 로테이션 — 윈윈 직캠에 다른 NCT 멤버가 안 붙음',
  "[페이스캠4K] 엔시티 유 윈윈 '90's Love' (NCT U WINWIN FaceCam)", undefined,
  r => !r || !(r.membersByGroup['엔시티 드림'] || []).includes('지성')
);
test(
  'NCT U 로테이션 — 제목에 언급된 멤버(윈윈)는 정상 인정',
  "[페이스캠4K] 엔시티 유 윈윈 '90's Love' (NCT U WINWIN FaceCam)", undefined,
  r => !!r && (r.membersByGroup['웨이션브이'] || []).includes('윈윈')
);
test(
  'NCT U 로테이션 — 유닛명만 있고 개별 이름이 없으면 멤버 0명',
  "NCT U 엔시티 유 'Make A Wish (Birthday Song)' MV", undefined,
  r => !r || Object.values(r.membersByGroup || {}).every(list => !list || !list.length)
);
test(
  'NCT U 로테이션 — 영문 해시태그(#JISUNG)로 명시되면 인정',
  'NCT U 비하인드 #JISUNG', undefined,
  r => !!r && (r.membersByGroup['엔시티 드림'] || []).includes('지성')
);
test(
  '고정 유닛(부석순)은 전원 확장 유지 — rotating 도입 회귀 방지',
  '부석순 BSS 세븐틴 직캠', undefined,
  r => !!r && (r.membersByGroup['세븐틴'] || []).length === 3
);

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
cases.forEach(({ name, title, selfGko, check, publishedAt }) => {
  let result, ok, err = null;
  try {
    result = title === null ? undefined : _m2ParseTitle(title, selfGko, false, publishedAt);
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
