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
module.exports={_m2ParseTitle,_PROJECT_UNITS,_fancamParseTitle,GROUPS,ARTISTS};
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
const { _m2ParseTitle, _PROJECT_UNITS, _fancamParseTitle } = mod.exports;

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

// 동명이인 영문토큰 애매성 → 검수(ambiguous) (2026-08-26 옵션 A, 사용자 결정)
// "JIHOON"은 투어스 지훈·트레저 지훈·워너원 박지훈 3명의 en과 겹치는데, ko 기반 동명이인 dedup은
// '지훈'(투어스·트레저)만 충돌로 보고 유일 ko인 '박지훈'(워너원)을 confident하게 남겨 오배정했었다.
// 토큰 단위(memberHitTokens)로 "한 토큰이 서로 다른 사람 2명+와 매칭 + 그룹표시 없음"을 잡아 검수로 보낸다.
test('동명이인 영문토큰(JIHOON) + 그룹표시 없음 → ambiguous(검수 큐로)',
  '#JIHOON 첫만남챌린지', undefined,
  r => !!r && r.confidence === 'ambiguous');
test('그룹표시(#TWS) 있으면 정상 확정 — 투어스, 검수 아님',
  'I want to dance #TWS #JIHOON', undefined,
  r => !!r && r.primaryGroup === '투어스' && r.confidence !== 'ambiguous');
test('그룹명(트레저) 명시 → 트레저 정상 확정, 검수 아님',
  '트레저 지훈 직캠', undefined,
  r => !!r && r.primaryGroup === '트레저' && r.confidence !== 'ambiguous');
// 고유 이름(동명이인 아님)은 애매하지 않아야 — 회귀 방지
test('고유 이름은 ambiguous 아님(장원영)',
  '#WONYOUNG 아이브 원영 직캠', undefined,
  r => !!r && r.confidence !== 'ambiguous');

// ── 겸임 멤버를 동명이인으로 오판하던 버그 (2026-08-28, 사용자 제보) ───────────────
// 애매 판정이 "토큰에 걸린 사람들의 **그룹 합집합** 크기 >= 2"였는데, 겸임 멤버는 **혼자서도** 2를
// 넘긴다(엔시티 해찬 = 127+드림, 세이마이네임 히토미 = 세이마이네임+아이즈원). 그래서 동명이인이
// 전혀 아닌데 ambiguous가 되고, _extBuildRows가 동기화 즉시 content_flag:'hidden'을 박아 유저 화면에서
// 사라졌다. 로스터 실측상 오판 대상이 81명(안유진·장원영·사쿠라·은하·김세정·박우진 등)이었다.
// ⚠️ 위 '장원영' 케이스는 제목에 그룹명(아이브)이 있어 역추론 경로를 안 타므로 이 버그를 못 잡았다 —
//    반드시 **그룹 표시가 전혀 없는** 제목으로 검증할 것.
test('겸임 멤버는 동명이인이 아님 — 해찬(엔시티 127+드림), 그룹표시 없어도 ambiguous 아님',
  '해찬 직캠 무대', undefined,
  r => !!r && r.confidence !== 'ambiguous');
test('겸임 멤버는 동명이인이 아님 — 히토미(세이마이네임+아이즈원)',
  '히토미 직캠', undefined,
  r => !!r && r.confidence !== 'ambiguous');
// 반대로 진짜 동명이인(준서 = 알파드라이브원/위아이 겸임 + 다크비 + BAE173, 서로 다른 3명)은
// 그대로 애매여야 한다 — 사람 수 게이트를 넣었다고 진짜 충돌까지 통과시키면 안 됨.
// 다만 이름이 **ko로도** 겹치는 경우는 앞단 ko-dedup이 먼저 통째로 버려서(null) ambiguous 분기까지
// 오지도 않는다 — 준서가 그 예. 즉 "그룹표시 없는 준서"는 애초에 아무 그룹도 안 잡히므로 동기화가
// 숨김을 박을 일이 없다(2026-08-28 실측). ambiguous 층은 ko는 유일한데 en 토큰만 겹치는
// 경우(#JIHOON → 박지훈)를 위한 것이고, 그건 위 JIHOON 케이스가 지킨다.
test('ko까지 겹치는 동명이인(준서 3명)은 ambiguous 이전에 통째로 버려짐(null)',
  '준서 직캠', undefined,
  r => r === null || r === undefined);
// 오탐 방지 — 고유토큰(쯔위)으로 그룹이 확정되면, 같은 제목의 동명이인(나연, 이미 dropped)은 무관
test('오탐방지 — 고유이름(쯔위)이 그룹 확정 시 함께 있는 동명이인(나연) 때문에 검수로 안 감',
  '쯔위 최애는 나연? 다음 주에는 누가 할래?', undefined,
  r => !!r && r.confidence !== 'ambiguous');

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
// ⚠️ 이 자리에 있던 '여자친구(strictSync) — 제목에 그룹명이 있어도 제외' 케이스는 2026-08-27에
// **의도적으로 뒤집었다**. 22팀 전수 A/B 시뮬에서 여자친구는 오탈취보다 손실이 훨씬 컸고(표본에서
// 오배정 98건 + 앞으로 안 버려질 제목 729건, 오탈취 사례는 컴필레이션 정도), strictSync에서 뺐다.
// 뒤집힌 기대값은 아래 "strictSync 해제" 묶음에 있다. 되돌리려면 groups.json의 strictSync와 그
// 묶음을 같이 손볼 것.
test(
  '여자친구 — strictSync 해제 후 제목의 그룹명이 정상 매칭됨(2026-08-27 방향 전환)',
  '여자친구 신곡 커버 챌린지', undefined,
  r => !!r && r.primaryGroup === '여자친구'
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

// 일반명사형 그룹명 게이트(아이콘=icon·위너=winner, 2026-09-02) — 근거 없는 로드워드/영단어만 차단, 멤버/해시태그/고유표기는 유지
test('위너 — 로드워드 "위너" 단독은 그룹 아님', '올해의 위너는 누구? 시상식 하이라이트', undefined,
  r => !r || (r.primaryGroup !== '위너' && !(r.withGroups || []).includes('위너')));
test('위너 — 영어 "the Winner is?"도 아님', 'And the Winner is? Best Award clip', undefined,
  r => !r || (r.primaryGroup !== '위너' && !(r.withGroups || []).includes('위너')));
test('위너 — 멤버(강승윤) 있으면 유지', '위너 강승윤 직캠', undefined,
  r => !!r && (r.primaryGroup === '위너' || (r.withGroups || []).includes('위너')));
test('위너 — 해시태그 #WINNER면 유지', 'Comeback stage #WINNER', undefined,
  r => !!r && (r.primaryGroup === '위너' || (r.withGroups || []).includes('위너')));
test('위너 — 올대문자 WINNER 고유표기면 유지', 'WINNER - I LOVE U @ Music Bank', undefined,
  r => !!r && (r.primaryGroup === '위너' || (r.withGroups || []).includes('위너')));
test('위너 — 자체 채널이면 근거 약해도 유지(selfGko 면제)', '위너 브이로그 촬영 현장 EP.1', '위너',
  r => !!r && r.primaryGroup === '위너');
test('아이콘 — 로드워드 "아이콘" 단독은 그룹 아님', '2024 올해의 아이콘 시상 무대', undefined,
  r => !r || (r.primaryGroup !== '아이콘' && !(r.withGroups || []).includes('아이콘')));
test('아이콘 — 고유표기 iKON이면 유지', 'iKON - Killing Me stage', undefined,
  r => !!r && (r.primaryGroup === '아이콘' || (r.withGroups || []).includes('아이콘')));

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

// ── 활동명이 유명인과 겹칠 때: 본명 등록 + matchAliases (2026-08-25, 다이아 전 멤버 추가) ─────
// 다이아 前 멤버 "제니"(본명 이소율)를 name.ko="제니"로 넣으면, 같은 이름의 블랙핑크 제니와
// 동명이인 dedup에 걸려 **"그룹명 없이 제니만 있는 제목"의 역추론이 양쪽 다 버려진다** —
// 즉 이 사람을 추가하는 것만으로 블랙핑크 쪽 태깅이 죽는다. 그래서 본명으로 등록하고 활동명은
// matchAliases에 둔다(matchAliases는 그룹이 확정된 뒤 멤버 추출에만 쓰여 역추론엔 안 들어감).
test('별칭 — 그룹명이 있으면 활동명(제니)으로도 다이아 이소율이 잡힌다',
  "[MPD직캠] 다이아 제니 직캠 'Will you go out with me' (DIA JENNY FanCam)", undefined,
  r => !!r && (r.membersByGroup['다이아'] || []).includes('이소율'));
test('별칭 — 그룹명 없이 "제니"만 있으면 블랙핑크 역추론이 그대로 살아있다(동명이인 회귀 방지)',
  '제니 무대 모음', undefined,
  r => !!r && r.primaryGroup === '블랙핑크' && (r.membersByGroup['블랙핑크'] || []).includes('제니'));
test('탈퇴 게이트 — 다이아 탈퇴(2019.07.06) 이후 영상엔 이소율이 안 붙음',
  '다이아 제니 근황', undefined,
  r => !r || !(r.membersByGroup['다이아'] || []).includes('이소율'), '2021-03-01');
// 흔한단어 given-name 게이트 — 유사랑(이즈나)의 성 뗀 변형 "사랑"이 평문 "사랑"(=love)에 역추론되면 안 됨.
// 실측: group_ko=이즈나 오염 385건(대부분 이즈나 데뷔 전 영상)이 이 경로에서 나왔음(2026-08-25).
test('흔한단어 given-name — "사랑"만 있는 제목이 이즈나로 역추론되지 않는다',
  '김보경_사랑 끝 (End Of Love)', undefined,
  r => !r || (r.primaryGroup !== '이즈나' && !(r.membersByGroup['이즈나'] || []).includes('유사랑')));
test('흔한단어 given-name — 해시태그 #유사랑이 있으면 정상 매칭된다(정당한 언급은 유지)',
  '이즈나 직캠 #유사랑', undefined,
  r => !!r && (r.membersByGroup['이즈나'] || []).includes('유사랑'));
// M&N 유닛 토큰 — '&'가 정규화로 'M N'이 돼 "A.M.N Showcase"에 걸려 미료/나르샤로 새던 것 차단.
test('유닛 토큰 M&N — "A.M.N Showcase"가 브라운아이드걸스 미료/나르샤로 안 잡힌다',
  '[Fancam] Stellar : Minhee - Crying, A.M.N Showcase @ DMC Festival', undefined,
  r => !r || !((r.membersByGroup['브라운아이드걸스'] || []).includes('미료') || (r.membersByGroup['브라운아이드걸스'] || []).includes('나르샤')));
// 이름↔그룹명 충돌(스텔라) — strictSync 그룹이어도 역추론에선 해시태그만. "Stella Jang" 등이 하츠투하츠로 안 감.
test('이름==그룹명 — "스텔라장 Stella Jang"이 하츠투하츠 스텔라로 안 잡힌다',
  '스텔라장 Stella Jang - I GO [세로라이브] LIVE', undefined,
  r => !r || !(r.membersByGroup['하츠투하츠'] || []).includes('스텔라'));
test('이름==그룹명 — 제목에 그룹명이 있으면 정상: "하츠투하츠 스텔라 직캠"은 그대로 잡힌다',
  '[입덕직캠] 하츠투하츠 스텔라 직캠 4K', undefined,
  r => !!r && (r.membersByGroup['하츠투하츠'] || []).includes('스텔라'));
// 영문 가사 그룹명(세이마이네임=Say My Name) — 영문 구절은 해시태그일 때만, 한글은 평문 유지.
test('그룹 영문가사명 — "When You Say My Name" 가사가 세이마이네임으로 안 잡힌다',
  'When You Say My Name : YEWON', undefined,
  r => !r || r.primaryGroup !== '세이마이네임');
test('그룹 영문가사명 — 한글 "세이마이네임 히토미"는 그대로 잡힌다',
  '[페이스캠4K] 세이마이네임 히토미 WaveWay (SAY MY NAME HITOMI FaceCam)', undefined,
  r => !!r && r.primaryGroup === '세이마이네임');
// 스텔라(Stellar) strictSync 해제 — 한글 '스텔라'는 그룹으로 복구, 단 '하츠투하츠' 있으면 멤버.
test('스텔라 그룹 복구 — "스텔라 - 찔려"가 그룹 스텔라로 잡힌다',
  '[HOT] Stellar - Sting, 스텔라 - 찔려 Show Music core 2016', undefined,
  r => !!r && r.primaryGroup === '스텔라');
test('스텔라 충돌 — "하츠투하츠 스텔라"는 그룹 스텔라가 아니라 하츠투하츠',
  '[입덕직캠] 하츠투하츠 스텔라 직캠 4K', undefined,
  r => !!r && r.primaryGroup === '하츠투하츠');
// 이름 재사용 날짜 게이트 — 그룹 Stellar(해체 2018) ↔ 하츠투하츠 멤버 스텔라(2025). 날짜로 구분.
test('스텔라 날짜게이트 — 2025년 "하츠투하츠 스텔라"는 하츠투하츠(그룹 스텔라 아님)',
  '[입덕직캠] 하츠투하츠 스텔라 직캠 4K', undefined,
  r => !!r && r.primaryGroup === '하츠투하츠', '2025-06-01');
test('스텔라 날짜게이트 — 2025년 "유하 스텔라 이안"이 그룹 스텔라로 안 편입',
  "혜리's club ep77 유하 스텔라 이안", undefined,
  r => !r || r.primaryGroup !== '스텔라', '2025-08-01');
test('스텔라 날짜게이트 — 2016년 "스텔라 - 찔려"는 여전히 그룹 스텔라',
  '[HOT] Stellar - Sting, 스텔라 - 찔려 Show Music core', undefined,
  r => !!r && r.primaryGroup === '스텔라', '2016-02-01');

// ── strictSync 2차 정리(2026-08-27): 22팀 → 7팀 ────────────────────────────────
// 22팀 전수를 실제 매처 A/B 시뮬로 재검토한 결과, 판별선이 "해체/규모"가 아니라 "그룹명이 한국어
// 일반명사·프로그램명·곡명과 겹치는가"였다. 아래는 그 판정을 고정하는 회귀 테스트 —
// **푼 14팀은 제 이름으로 잡혀야 하고, 남긴 7팀은 계속 안 잡혀야 한다.** 목록을 다시 손대면
// 여기가 먼저 빨개진다. 케이스 제목은 전부 DB 실제 행에서 가져온 것.
//
// (1) 푼 그룹 — 예전엔 제목에 그룹명이 뻔히 있어도 멤버 이름 역추론에 밀려 남의 그룹으로 갔다.
test('strictSync 해제 — "로켓펀치 - CHIQUITA"가 베이비몬스터(치키타=멤버명)로 안 감',
  'Rocket Punch(로켓펀치) - CHIQUITA @인기가요 inkigayo 20220327', undefined,
  r => !!r && r.primaryGroup === '로켓펀치');
test('strictSync 해제 — "씨아이엑스 배진영 직캠"이 워너원(전 소속)으로 안 감',
  "[예능연구소] 씨아이엑스 배진영 직캠 'Cinema' (CIX BAEJINYOUNG FanCam)", undefined,
  r => !!r && r.primaryGroup === '씨아이엑스');
test('strictSync 해제 — "에이프릴 양예나 직캠"이 아이즈원(예나 동명이인)으로 안 감',
  "[예능연구소] 에이프릴 양예나 직캠 'Now or Never' (APRIL YANG YENA FanCam)", undefined,
  r => !!r && r.primaryGroup === '에이프릴');
test('strictSync 해제 — "미래소년 이준혁 직캠"이 세븐틴(준)으로 안 감',
  "[안방1열 직캠4K] 미래소년 이준혁 'Drip N' Drop' (MIRAE LEE JUN HYUK FanCam)", undefined,
  r => !!r && r.primaryGroup === '미래소년');
test('strictSync 해제 — "위클리 지한 페이스캠"이 스트레이키즈(한)로 안 감',
  "[페이스캠4K] 위클리 지한 'Check It Out' (Weeekly JI HAN FaceCam)", undefined,
  r => !!r && r.primaryGroup === '위클리');
test('strictSync 해제 — "여자친구 은하"가 비비지(겸임)로 안 감',
  '[STAGE MIX] 여자친구(GFRIEND) – 너 그리고 나 (NAVILLERA) | 쇼! 음악중심', undefined,
  r => !!r && r.primaryGroup === '여자친구');
//
// (2) 남긴 7팀 — 그룹명이 프로그램명/코너명/앨범명/곡명과 겹쳐서 풀면 대량 오탈취가 난다.
//     (괄호 숫자는 2026-08-27 시뮬에서 측정한 "해제 시 오탈취" 규모)
test('strictSync 유지 — "[더 시즌즈-이영지의 레인보우]"가 그룹 레인보우로 안 감 (826건)',
  "[세로] 이영지 - If I Ain't Got You [더 시즌즈-이영지의 레인보우] | KBS", undefined,
  r => !r || r.primaryGroup !== '레인보우');
test('strictSync 유지 — "랩배틀"이 그룹 배틀로 안 감 (427건)',
  '주간아이돌 - 142회 에이핑크 랩배틀/Weekly Idol A_PINK Rap Battle', undefined,
  r => !r || r.primaryGroup !== '배틀');
test('strictSync 유지 — "[하이라이트]" 코너명이 그룹 하이라이트로 안 감 (331건)',
  '[하이라이트] TAEYANG - 나의 마음에 (Seed) [더 시즌즈-성시경의 고막남친] | KBS', undefined,
  r => !r || r.primaryGroup !== '하이라이트');
test('strictSync 유지 — "IVE SECRET" 앨범명이 그룹 시크릿으로 안 감 (261건)',
  "IVE THE 4th EP 〈 IVE SECRET 〉 'XOXZ' COMING SOON", undefined,
  r => !r || r.primaryGroup !== '시크릿');
test('strictSync 유지 — "Sugar Rush Ride"(TXT 곡명)가 그룹 슈가로 안 감 (182건)',
  "[MPD직캠] TXT 휴닝카이 직캠 4K 'Sugar Rush Ride'", undefined,
  r => !r || r.primaryGroup !== '슈가');
//
// (3) 에이스(A.C.E) 중간안 — strictSync는 풀되 **한글 '에이스'만** 해시태그 전용
//     (_GROUP_TOKEN_HASHTAG_ONLY). 영문 'A.C.E'는 정규화하면 ' A C E '라는 고유 시퀀스라 안전.
test('에이스 중간안 — 영문 A.C.E 표기는 그룹으로 잡힘',
  'A.C.E, My Girl (에이스, My Girl) [THE SHOW 240305]', undefined,
  r => !!r && r.primaryGroup === '에이스');
test('에이스 중간안 — 해시태그 #에이스도 잡힘',
  '#ACE #에이스 #박준희 선배님과 함께 맘껏 더 call me crazy', undefined,
  r => !!r && r.primaryGroup === '에이스');
test('에이스 중간안 — 평문 "에이스 형사"는 그룹으로 안 잡힘',
  "(ENG CC) '가석방 심사관 이한신' 에이스 형사 권유리의 폴꾸 | 권유리, Kwon Yuri", undefined,
  r => !r || r.primaryGroup !== '에이스');
test('에이스 중간안 — 평문 "1 vs 1 에이스 랩 배틀"도 그룹으로 안 잡힘',
  '[#힙팝프린세스/6회] 권도희 vs 최가윤 | 1 vs 1 에이스 랩 배틀 한국 | Mnet 251120', undefined,
  r => !r || r.primaryGroup !== '에이스');

// ── 체리블렛 현 멤버 7명 추가(2026-08-27) — 동명이인 밀집 그룹 ──────────────────
// 배경: artists.json에 전 멤버 3명(미래·코코로·린린)만 있고 **현 멤버 7명이 통째로 빠져 있었다**
// (사용자 제보). 그런데 이 7명 중 5명이 동명이인이다 — 유주(여자친구·하입프린세스), 지원(프로미스나인·
// 시그니처), 메이(리센느·세이마이네임), 보라(씨스타), 채린(아이칠린). 추가 전/후로 실제 매처를 DB 제목
// 4,352건에 돌려 비교했더니 바뀐 건 2건뿐이었고(아래 [알려진 한계] 참고), 나머지는 전부 정상이었다.
// 이 묶음은 그 판정을 고정한다 — 그룹명이 있으면 정확히 갈리고, 없으면 dedup이 통째로 버린다.
test('체리블렛 유주 — 여자친구/하입프린세스 유주로 안 샘',
  "[페이스캠4K] 체리블렛 유주 'Love So Sweet' (Cherry Bullet YU JU FaceCam)", undefined,
  r => !!r && r.primaryGroup === '체리블렛' && (r.membersByGroup['체리블렛'] || []).includes('유주'));
test('여자친구 유주 — 체리블렛으로 안 샘(반대 방향)',
  '여자친구 유주 직캠 밤', undefined,
  r => !!r && r.primaryGroup === '여자친구');
test('체리블렛 지원 — 프로미스나인/시그니처 지원으로 안 샘',
  '[쇼챔직캠 4K] Cherry Bullet JIWON - P.O.W! (체리블렛 지원 - 파우)', undefined,
  r => !!r && r.primaryGroup === '체리블렛' && (r.membersByGroup['체리블렛'] || []).includes('지원'));
test('씨스타 보라 — 체리블렛으로 안 샘',
  '[MPD직캠] 씨스타 보라 직캠', undefined,
  r => !!r && r.primaryGroup === '씨스타');
test('아이칠린 채린 — 체리블렛으로 안 샘',
  '아이칠린 채린 직캠', undefined,
  r => !!r && r.primaryGroup === '아이칠린');
// 그룹 표시가 없으면 동명이인 dedup이 통째로 버려야 한다(오배정 0). 유일 이름은 그대로 잡힌다.
test('동명이인 이름은 그룹표시 없으면 아무 그룹도 안 잡음(지원 3명)',
  '#지원 챌린지', undefined,
  r => !r || r.primaryGroup === null);
test('동명이인 이름은 그룹표시 없으면 아무 그룹도 안 잡음(메이 3명)',
  '#메이 챌린지', undefined,
  r => !r || r.primaryGroup === null);
test('레미(체리블렛 해체→솔로) — 활동기 챌린지는 그룹표시 없어도 체리블렛으로(era 구분)',
  '#레미 #REMI 챌린지', undefined,
  r => !!r && r.primaryGroup === '체리블렛', '2022-06-01');
// 감사 스캐너(tools/name_collision_audit.mjs)가 "미래(체리블렛)가 그룹명 미래소년에 통째로 들어있다 ·
// 보호 없음"으로 경고하지만, 실제로는 hit()의 토큰 경계 검사가 막는다(스캐너가 보수적으로 잡는 오탐).
// strictSync를 푼 뒤 미래소년 영상이 늘어나므로 여기서 확인해둔다.
test('미래소년 영상에 체리블렛 미래가 안 낌(토큰 경계)',
  '[안방1열 직캠4K] 미래소년 이준혁 Drip N Drop (MIRAE LEE JUN HYUK FanCam)', undefined,
  r => !!r && r.primaryGroup === '미래소년' && !r.membersByGroup['체리블렛']);
// [알려진 한계] 그룹명이 하나도 없는 제목에서 primaryGroup은 artists.json 등장 순서로 갈린다
// (역추론 경로의 result[0]). 그래서 "이승협 직캠 'Superstar (Feat. 해윤)'"이 체리블렛 추가 후
// 엔플라잉→체리블렛으로 뒤집힌다. 다만 confidence가 weak라 검수 큐로 가고, 이미 저장된 행은
// _ytSweepMistagReclassify가 "엔진 그룹이 제목에 literal로 있어야 재배정"이라 안 건드린다.
// 이 케이스는 **현재 동작을 기록해두는 것**이지 바람직한 값이 아니다 — feat 절 안의 인물을 primary에서
// 강등하는 개선을 하면 이 기대값이 엔플라잉으로 바뀌어야 맞다.
test('[알려진 한계] 그룹명 없는 feat 제목은 순서 의존 — 대신 weak로 검수 큐행',
  "[예능연구소 4K] 이승협 직캠 'Superstar (Feat. 해윤)' (J.DON FanCam)", undefined,
  r => !!r && r.confidence === 'weak' && (r.withGroups || []).concat([r.primaryGroup]).includes('엔플라잉'));

// ── 음악방송 직캠 구조 파서(_fancamParseTitle, 2026-08-29) ─────────────────
// tools/fancam_pattern_probe.js(전 로스터×실제 곡명 15만 제목 시뮬)로 찾은 실제 사고 유형. 구조가 잡힌
// 제목은 곡명 구간을 비우고 primary를 출연자 구간 순서로 정하므로 아래가 전부 고정돼야 한다.
test('직캠 — 곡명 \'Treasure\'가 그룹 트레저로 primary를 뺏지 않음(에이티즈 산)',
  "[MPD직캠] 에이티즈 산 직캠 4K 'Treasure' (ATEEZ SAN FanCam) | @MCOUNTDOWN_2018.11.1", undefined,
  r => !!r && r.primaryGroup === '에이티즈' && r.withGroups.length === 0 && (r.membersByGroup['에이티즈']||[]).join() === '산', '2018-11-01');
test('직캠 — 곡명 \'After School\'이 애프터스쿨로 안 감(위클리 먼데이)',
  "[MPD직캠] 위클리 먼데이 직캠 4K 'After School' (Weeekly MONDAY FanCam)", undefined,
  r => !!r && r.primaryGroup === '위클리' && r.withGroups.length === 0 && (r.membersByGroup['위클리']||[]).join() === '먼데이', '2021-03-25');
// ⚠️ 위 'After School' 케이스는 2026-08-29부터 있었는데도 실사고를 못 막았다 — 대괄호를 [MPD직캠]으로
// 썼기 때문이다. _FANCAM_SHOW_PATTERNS가 인식하는 태그라 구조 파싱이 성공했고, 곡명 배제 로직만 검증됐다.
// 실제 오염은 **인식 자체가 안 되는 태그**([페이스캠4K])에서 났다(2026-09-03 실측: 위클리 지한 영상의
// group_ko가 애프터스쿨로 오배정). 곡명·멤버 판정이 같아도 대괄호 표기가 다르면 별개 경로임을 잊지 말 것.
// ⚠️ 아래 4개 중 실제로 수정에 의존하는 건 첫 번째(페이스캠+곡명충돌)뿐이다 — 나머지는 제목에 정답
// 그룹명이 그대로 있어 구조 인식이 없어도 통과한다(음성 대조로 확인). 진입 게이트 자체의 회귀 가드는
// 파일 맨 아래 GATE_CASES가 맡는다. 여기 케이스만 보고 "덮였다"고 판단하지 말 것.
test('직캠 진입게이트 — [페이스캠4K](한글 표기)도 구조 인식: 곡명 \'After School\'이 애프터스쿨로 안 감',
  "[페이스캠4K] 위클리 지한 'After School' (Weeekly JI HAN FaceCam)│@SBS Inkigayo 220220", undefined,
  r => !!r && r.primaryGroup === '위클리' && r.withGroups.length === 0 && (r.membersByGroup['위클리']||[]).join() === '지한', '2022-02-20');
test('직캠 진입게이트 — [UNFILTERED CAM]도 구조 인식(제로베이스원 한유진)',
  "[UNFILTERED CAM] ZEROBASEONE HAN YU JIN(한유진) 'In Bloom' 4K | BE ORIGINAL", undefined,
  r => !!r && r.primaryGroup === '제로베이스원' && (r.membersByGroup['제로베이스원']||[]).join() === '한유진', '2023-07-20');
test('직캠 진입게이트 — [원픽캠 4K](한글 표기)도 구조 인식(고스트나인 이진우)',
  '[원픽캠 4K] 고스트나인 이진우 - 밤샜다 (GHOST9 LEE JIN WOO - Up All Night) l #쇼챔피언 l EP.397', undefined,
  r => !!r && r.primaryGroup === '고스트나인' && (r.membersByGroup['고스트나인']||[]).join() === '이진우', '2021-06-01');
test('직캠 — 그룹명에 든 X가 콜라보 기호로 안 읽힘(오메가엑스 한겸, 원픽캠)',
  "[원픽캠 4K] OMEGA X Han Gyeom - WHAT'S GOIN' ON (오메가엑스 한겸 - 왓츠 고잉 온) l #쇼챔피언 l EP.408", undefined,
  r => !!r && r.primaryGroup === '오메가엑스' && (r.membersByGroup['오메가엑스']||[]).join() === '한겸', '2021-08-01');
// 미러 괄호(2026-09-03): `[브랜드] ARTIST - SONG (아티스트 - 곡명)`은 2020년대 직캠의 지배적 포맷이고,
// 괄호 안 대시 뒤도 곡명이다. 바깥 곡명만 비우면 괄호 안 곡명 토큰이 매칭에 들어간다 —
// "아이 온 (유)"가 유아이(드림노트)로 잡혀 with_groups에 드림노트가 붙던 실사고.
// ⚠️ 이 배제는 직캠 구조가 인식된 제목에만 걸린다. 괄호에 진짜 출연진이 오는 제목((Feat - iKON …))은
//    파서가 null을 주므로 영향 없음 — 그걸 확인 안 하고 "제목 전체 괄호"로 재봤다가 오판한 적 있음.
// ⚠️ publishedAt을 일부러 안 넘긴다 — 실제 이 영상은 2021년이고 원호는 몬스타엑스를 2019.10.31에
//    떠났으므로, 날짜를 주면 탈퇴 게이트(_atmLeftBefore)가 몬스타엑스를 빼서 null(보류)이 된다.
//    그건 그것대로 맞는 동작이라(2021년 솔로 무대) 여기서 검증할 대상이 아니다. 이 케이스가 겨누는 건
//    "괄호 안 곡명이 남의 멤버로 읽히는가" 하나뿐이라, 탈퇴 게이트를 끄고 그것만 격리한다.
// ⚠️ 2026-09-03에 원호가 솔로 전향 구조(group.ko='솔로' + groups[]에 몬스타엑스 left)로 바뀌면서
//    primaryGroup이 '몬스타엑스'→'원호'가 됐다. 그게 의도한 결과다(솔로 무대는 본인 것). 이 케이스가
//    겨누는 건 그게 아니라 **괄호 안 곡명("아이 온 유")이 남의 멤버로 읽히는가** 하나뿐이라,
//    primaryGroup을 못 박지 않고 드림노트가 안 붙는지만 본다 — 데이터 구조가 또 바뀌어도 안 깨지게.
test('직캠 미러괄호 — 괄호 안 한글 곡명이 멤버로 안 읽힘(원호, 드림노트 유아이 오탐)',
  '[원픽캠 4K] WONHO - Eye On You (원호 - 아이 온 유) l Show Champion l EP.425', undefined,
  r => !!r && !r.withGroups.includes('드림노트') && !(r.membersByGroup['드림노트']||[]).length);
// ── 일반명사형 그룹명 게이트: 위너(2026-09-03) ─────────────────────────────
// 게이트가 둘(_GROUP_WEAK_EN_AS_GUEST / _COMMON_NOUN_GROUP_OK)이라 기준이 어긋나 한글 '위너'가
// 통째로 막혀 있던 걸 되돌린 건. 영문 winner 배제 쪽은 desc-evidence.test.js가 맡는다.
// ⚠️ 두 케이스의 성격이 다르다 — 둘 다 초록이라고 같은 걸 지킨다고 읽지 말 것(오늘의 교훈):
//   · "인정" 쪽만 이 수정에 의존한다(되돌리면 빨간불).
//   · "위너원" 쪽은 **게이트가 아니라 토큰 단위 매칭**이 지킨다("위너원" ≠ "위너"). 그래서 게이트를
//     어떻게 바꾸든 초록이다. 그럼 왜 두냐 — 매처가 부분문자열 매칭으로 바뀌는 날 이게 울리라고.
//     (참고: '위너'는 '워너원'의 부분문자열이 아니다. 저 5건은 업로더가 위너원이라 잘못 쓴 오타다.)
test('위너 — "Wanna One(위너원)" 오타 제목이 그룹 위너로 안 읽힘(토큰 단위 매칭이 지킴)',
  '[8회/세로직캠/4K] 보컬 유닛 | #진현주 #JIN HYEONJU ♬Beautiful - Wanna One(위너원) #유닛 스테이션', undefined,
  r => !!r && ![r.primaryGroup, ...(r.withGroups||[])].includes('위너'));
test('위너 — 한글 "위너"가 있으면 인정(아이브 콜라보)',
  '아이브 X 위너 스페셜 무대 #아이브', undefined,
  r => !!r && [r.primaryGroup, ...(r.withGroups||[])].includes('위너'));
// ── 유닛 트리거 흔한단어 충돌(2026-09-03, 콜라보 태그 전수 스캔으로 발견) ──────
// 스캔 결과 "제목에 이름이 하나도 없는데 태그가 몰린" 상위 두 건이 전부 유닛 트리거 오매칭이었다.
//   · 'GOOD BOY'(지디×태양 유닛곡)가 **평문 매칭으로 열려 있어** TXT "Good Boy Gone Bad" 94건 오염
//   · 'Glow'(트리플에스 유닛)는 해시태그 전용이었는데도, 트렌드지가 자기 곡 "GLOW"에 정식으로
//     #GLOW를 달아서 그 가드를 그냥 통과 → 4명 × 36건 = 144건 오염
// 그래서 가드가 두 단계다: ①흔한 단어는 해시태그로만(_UNIT_HASHTAG_ONLY_TOKENS)
//                        ②해시태그마저 못 믿을 단어는 **소속 그룹 동반 필수**(_UNIT_NEED_PARENT_TOKENS)
test('유닛 — "Good Boy Gone Bad"(TXT)에 지디·태양이 안 붙음',
  'Good Boy Gone Bad - TOMORROW X TOGETHER [뮤직뱅크/Music Bank] | KBS 220624 방송', undefined,
  r => !!r && ![r.primaryGroup, ...(r.withGroups||[])].includes('빅뱅'), '2022-06-24');
test('유닛 — 해시태그로 명시된 GOOD BOY는 정상 인정(지디×태양)',
  '[MPD직캠] 지디 X 태양 직캠 #GOODBOY #빅뱅', undefined,
  r => !!r && [r.primaryGroup, ...(r.withGroups||[])].includes('빅뱅'), '2014-12-01');
test('유닛 — 트렌드지 곡 #GLOW 해시태그에 트리플에스가 안 붙음(그룹 동반 필수)',
  '프렌드지 고마워 #TRENDZ #GLOW #GLOWchallenge', undefined,
  r => !!r && ![r.primaryGroup, ...(r.withGroups||[])].includes('트리플에스'), '2023-05-01');
test('유닛 — 소속 그룹이 같이 있으면 Glow 유닛 정상 인정',
  '[MPD직캠] 트리플에스 Glow 무대 #GLOW #tripleS', undefined,
  r => !!r && [r.primaryGroup, ...(r.withGroups||[])].includes('트리플에스'), '2023-05-01');
// ── 동명이인 tie-break: 영상 시점에 불가능한 후보 걷어내기(2026-09-03) ──────────
// 현아 실사고: 나인뮤지스 현아(그룹 2019.02.24 해체)와 솔로 현아(전 포미닛/원더걸스, HyunA)가 같은
// 이름이라, 2021년 HyunA 솔로 무대 80건이 전부 나인뮤지스로 붙어 있었다. 날짜만 보면 나인뮤지스는
// 불가능하다 — 그 그룹은 이미 해체됐다. 후보를 줄여 한 명만 남으면 애초에 충돌이 아니다.
// ⚠️ 전부 불가능하거나 둘 다 가능하면 기존 dedup(둘 다 버림)을 그대로 탄다 — 확신 없이 고르지 않는다.
test('동명이인 — 해체된 그룹 후보는 영상 시점에 불가능(2021년 현아 = 솔로 HyunA)',
  '현아 - 굿 걸 (HyunA - GOOD GIRL), MBC 210220 방송', undefined,
  r => !!r && r.primaryGroup === '현아', '2021-02-20');
test('동명이인 — 해체 전 영상은 그 그룹이 맞음(2013년 나인뮤지스 현아)',
  '나인뮤지스 현아 무대', undefined,
  r => !!r && r.primaryGroup === '나인뮤지스', '2013-05-01');
test('동명이인 — 그룹 문맥이 있으면 그대로(포미닛 현아)',
  '포미닛 현아 직캠', undefined,
  r => !!r && r.primaryGroup === '포미닛' && (r.membersByGroup['포미닛']||[]).join() === '현아', '2014-05-01');
test('동명이인 — 둘 다 가능한 시점이면 확신 없이 고르지 않음(애매 → 무매칭)',
  '현아 무대', undefined,
  r => !r || r.primaryGroup === null || r.primaryGroup === undefined, '2013-05-01');
// ── 나인투식스 = 동키즈 유닛(2026-09-03) ──────────────────────────────────────
// ⚠️ 이 케이스는 **유닛 등록에 의존하지 않는다** — 등록 전에도 현재 매처가 이미 동키즈 민규·주원으로
//    맞게 잡는다(음성 대조로 확인). DB의 `group_ko='온리원오프'` 60건은 옛 매처가 남긴 재고다.
//    그래도 두는 이유는 "이 제목은 동키즈 유닛 콘텐츠"라는 기대를 고정해두기 위해서다 —
//    "나인투식스"의 '나인'이 온리원오프 멤버명과 겹치므로 앞으로 매칭이 바뀌면 여기서 먼저 울린다.
test('유닛 — "나인투식스"는 동키즈 민규·주원으로(온리원오프 아님)',
  "[최초공개] 나인투식스(NINE to SIX) - Don't Call Me l Show Champion l EP.477", undefined,
  r => !!r && r.primaryGroup === '동키즈' && (r.membersByGroup['동키즈']||[]).slice().sort().join() === ['민규','주원'].sort().join(), '2023-06-01');
// 카드 전지우: 영상 제목은 활동명 '지우'만 쓰는데 등록명이 '전지우'라 엔믹스 지우로 붙던 것(실측 25건).
// 별칭은 **그룹이 확정된 맥락에서만** 쓰이므로(matchAliases 주석 참고) 3명이나 되는 '지우' 동명이인
// (하츠투하츠·엔믹스·카드)끼리 서로를 끌어오지 않는다.
test('별칭 — "카드 지우"는 전지우(카드)로',
  '카드 지우 직캠', undefined,
  r => !!r && r.primaryGroup === '카드' && (r.membersByGroup['카드']||[]).join() === '전지우', '2023-05-01');
test('별칭 — "엔믹스 지우"는 그대로 엔믹스 지우(과잉 흡수 아님)',
  '엔믹스 지우 무대', undefined,
  r => !!r && r.primaryGroup === '엔믹스' && (r.membersByGroup['엔믹스']||[]).join() === '지우', '2023-05-01');
test('직캠 — 곡명 \'Key of Secret\'의 "키"가 멤버로 안 붙음(샤이니 단체)',
  "[안방1열 풀캠4K] 샤이니 'Key of Secret' 풀캠 (SHINee Full Cam)", undefined,
  r => !!r && r.primaryGroup === '샤이니' && (r.membersByGroup['샤이니']||[]).length === 0, '2015-05-24');
test('직캠 — 그룹명 뒤 멤버명이 다른 그룹명과 같아도 멤버로(다이아 유니스 ≠ 그룹 유니스)',
  "[쇼챔직캠 4K] 다이아 유니스 - Woowa (DIA EUNICE) l Show Champion l EP.311 l 190327", undefined,
  r => !!r && r.primaryGroup === '다이아' && r.withGroups.length === 0 && (r.membersByGroup['다이아']||[]).join() === '유니스', '2019-03-27');
test('직캠 — 단일음절 멤버(방탄소년단 뷔)도 그룹명 바로 뒤면 멤버로',
  "[뮤직뱅크 직캠] 방탄소년단 뷔 'Dynamite' (BTS V FanCam) | @MusicBank 200904", undefined,
  r => !!r && r.primaryGroup === '방탄소년단' && (r.membersByGroup['방탄소년단']||[]).join() === '뷔', '2020-09-04');
test('직캠 — 단일음절 멤버(더보이즈 큐) 영문 괄호(THE BOYZ Q)로도',
  "[안방1열 직캠4K] 더보이즈 큐 'THRILL RIDE' (THE BOYZ Q FanCam) @SBS Inkigayo 210808", undefined,
  r => !!r && (r.membersByGroup['더보이즈']||[]).join() === '큐', '2021-08-08');
test('직캠 — 영문 접미 일치는 최장 우선(나우즈 SIYOON → 시윤만, 윤 아님)',
  "[MPD직캠] 나우즈 시윤 직캠 4K 'Us' (NOWZ SIYOON FanCam)", undefined,
  r => !!r && (r.membersByGroup['나우즈']||[]).join() === '시윤', '2025-06-01');
test('직캠 — strictSync 그룹도 출연자 구간 선두면 인정(시크릿 효성)',
  "[뮤뱅 원픽캠 4K] 시크릿 효성 'Madonna' (SECRET HYOSUNG FanCam) | @MusicBank 120817", undefined,
  r => !!r && r.primaryGroup === '시크릿' && (r.membersByGroup['시크릿']||[]).join() === '전효성', '2012-08-17');
test('직캠 — strictSync god 개인직캠이 성 뗀 이름 역추론(호영→베리베리)으로 안 샘',
  "[뮤뱅 원픽캠 4K] god 손호영 '보통날' (god SON HOYOUNG FanCam)", undefined,
  r => !!r && r.primaryGroup === 'god' && r.withGroups.length === 0, '2026-08-01');
test('직캠 — 곡명 구간의 \'SECRET\'은 strictSync 시크릿을 안 깨움(아이브)',
  "[MPD직캠] 아이브 직캠 4K 'SECRET' | @MCOUNTDOWN", undefined,
  r => !!r && r.primaryGroup === '아이브' && r.withGroups.length === 0, '2026-08-01');
test('직캠 — 선두 토큰이 멤버 등록명과 같으면(슈가) strictSync 우회 안 함',
  "[직캠] 슈가 (SUGA) 'Daechwita' 페스티벌 직캠", undefined,
  r => !r || r.primaryGroup !== '슈가', '2020-06-01');
test('직캠 — 유닛명이 정규화 후 그룹명과 같으면("마마무+"→"마마무") 리터럴일 때만 유닛 확장',
  "[MPD직캠] 마마무 직캠 4K 'HIP' (MAMAMOO FanCam)", undefined,
  r => !!r && (r.membersByGroup['마마무']||[]).length === 0, '2019-11-01');
test('직캠 — "마마무+" 리터럴이면 유닛 확장(솔라·문별)',
  "[MPD직캠] 마마무+ 직캠 4K 'Chico malo' (MAMAMOO+ FanCam)", undefined,
  r => !!r && (r.membersByGroup['마마무']||[]).slice().sort().join() === '문별,솔라', '2024-03-01');
test('직캠 — 콜라보 무대(아이브 X 르세라핌)는 출연자 구간 순서대로 primary/with',
  "[MPD직캠] 아이브 X 르세라핌 직캠 4K 'Spicy' | @MCOUNTDOWN_2024", undefined,
  r => !!r && r.primaryGroup === '아이브' && r.withGroups.join() === '르세라핌', '2024-01-01');
test("it's Live — 그룹(EN) - 곡명 구조",
  "[it's Live] 아이브(IVE) - After LIKE", undefined,
  r => !!r && r.primaryGroup === '아이브' && r.withGroups.length === 0, '2022-09-01');
test('킬링보이스 — 그룹(EN)의 킬링보이스… – 곡 목록은 매칭에서 제외',
  "아이브(IVE)의 킬링보이스를 라이브로! – I AM, LOVE DIVE, After LIKE, Baddie | 딩고뮤직 | Dingo Music", undefined,
  r => !!r && r.primaryGroup === '아이브' && r.withGroups.length === 0 && (r.membersByGroup['아이브']||[]).length === 0, '2023-01-01');
test('직캠 구조 아님(자유 형식)은 기존 경로 그대로 — 하츠투하츠 스텔라',
  "[안방1열 직캠4K] 하츠투하츠 스텔라 'The Chase' (Hearts2Hearts STELLA FanCam)", undefined,
  r => !!r && r.primaryGroup === '하츠투하츠' && (r.membersByGroup['하츠투하츠']||[]).join() === '스텔라', '2025-03-01');

// 온리원오프 'Love'·'나인'/'Nine' — 영단어/흔한말과 겹치는 등록명은 역추론 제외(그룹명 동반 시에만, 2026-08-30)
test("역추론 제외 — 평문 'LOVE'(S.E.S. 커버)는 온리원오프로 안 샌다",
  "원영 (유원미) - LOVE (원곡 : S.E.S.) [2022 KBS 가요대축제] | KBS 221216 방송", undefined,
  r => !r || (r.primaryGroup !== '온리원오프' && !(r.withGroups||[]).includes('온리원오프') && !(r.membersByGroup||{})['온리원오프']), '2022-12-16');
test("역추론 제외 — 'NINE to SIX'의 Nine/나인은 온리원오프로 안 샌다",
  "[쇼챔직캠 4K] NINE to SIX - Don't Call Me (나인투식스 - 돈콜미) l Show Champion", undefined,
  r => !r || (r.primaryGroup !== '온리원오프' && !(r.withGroups||[]).includes('온리원오프') && !(r.membersByGroup||{})['온리원오프']), '2024-01-01');
test("역추론 제외 — 그룹명(OnlyOneOf) 확정되면 온리원오프는 정상 유지",
  "[Special] OnlyOneOf Nine 'AUTOMATIC' (Chancellor Cover)", undefined,
  r => !!r && r.primaryGroup === '온리원오프', '2024-01-01');

// 데뷔 이전 역추론 차단(2026-09-01) — 그룹이 존재하기도 전에 나온 영상을 순전히 멤버 이름만으로 그
// 그룹으로 역추론하는 건 대개 동명이인(옛 가수·배우)이다. _atmLeftBefore(탈퇴 상한)의 데뷔 하한 대칭 짝.
test('데뷔 이전 역추론 차단 — 현빈(배우) 2016 영상은 올아워즈(데뷔 2024)로 안 감',
  "송중기 X 현빈 X 공유 X 소지섭이 내 남자친구라면?! [코스모 크리에디터]", undefined,
  r => !r || (r.primaryGroup !== '올아워즈' && !(r.withGroups||[]).includes('올아워즈') && !(r.membersByGroup||{})['올아워즈']), '2016-05-01');
test('데뷔 이전 역추론 차단 — 옛 가수 채연 2010 영상은 트리플에스(데뷔 2023)로 안 감',
  "Chae Yeon - Look Look Look, 채연 - 봐 봐 봐, Music Core 20100724", undefined,
  r => !r || (r.primaryGroup !== '트리플에스' && !(r.withGroups||[]).includes('트리플에스') && !(r.membersByGroup||{})['트리플에스']), '2010-07-24');
// 데뷔 1년 전까지는 유예 — 데뷔 직전 프로모/서바이벌은 안 끊긴다(대칭 짝의 안전 여유 확인)
test('데뷔 직전(유예 내)은 유지 — 하츠투하츠 스텔라 데뷔직전 직캠',
  "[안방1열 직캠4K] 하츠투하츠 스텔라 'The Chase' (Hearts2Hearts STELLA FanCam)", undefined,
  r => !!r && r.primaryGroup === '하츠투하츠', '2025-01-01');

// ── feat./ft. 강등 ────────────────────────────────────
// feat 뒤 아티스트는 그 곡의 게스트지 영상의 주인공이 아니다 — 근거가 feat 구간 안에만 있는 그룹은
// primaryGroup 후보에서 뒤로 민다(2026-09-02, 사용자 제보: 마시로 직캠이 group_ko='아이콘'으로 저장됨).
// 실측 표본 3,893건 전후 비교에서 메인그룹 변경 76건 전부가 개선, 매칭 손실 0건이었다.
const P = (g, ...w) => r => !!r && r.primaryGroup === g && w.every(x => (r.withGroups || []).includes(x));
test('feat 강등 — 마시로 직캠의 메인은 메이딘이지 feat 아이콘(바비)이 아니다',
  "[MPD직캠] 마시로 직캠 4K 'HOTLINE (feat. BOBBY)' (MASHIRO FanCam) | @MCOUNTDOWN_2026.8.20", undefined,
  P('메이딘'), '2026-08-20');
test('feat 강등 — 대시 구조에서도(아이콘은 with로)',
  'MASHIRO - HOTLINE (feat. BOBBY)', undefined, P('메이딘', '아이콘'), '2026-08-20');
test('feat 강등 — feat 절이 제목 앞에 와도 메인은 뒤쪽 주인공',
  'HOTLINE (Feat. BOBBY) - 마시로 (MASHIRO) [뮤직뱅크/Music Bank] | KBS 260821 방송', undefined,
  P('메이딘', '아이콘'), '2026-08-21');
test('feat 강등 — 지코 SPOT!의 메인은 블락비지 feat 블랙핑크(제니)가 아니다',
  '[가로] 지코 (ZICO) - SPOT! (Feat. JENNIE) [더 시즌즈-지코의 아티스트] | KBS 240426 방송', undefined,
  P('블락비', '블랙핑크'), '2024-04-26');
test('feat 강등 — 그룹명 리터럴 경로에서도(있지 ← feat 스트레이키즈 창빈)',
  'ITZY Album Recording Behind | GOLD, Imaginary Friend, VAY (Feat. 창빈 of Stray Kids)', undefined,
  P('있지', '스트레이키즈'), '2025-01-01');
test('feat 강등 — 주인공이 DB에 없으면 feat 대상이 그대로 메인(사용자 결정)',
  'Some Unknown Rapper - Song (feat. 제니)', undefined, P('블랙핑크'), '2024-01-01');
test('feat 무관 — feat이 없는 콜라보 제목은 기존 순서 그대로',
  '[니얌니얌] 여자친구 예린 & 에이핑크 오하영 | Ep.7', undefined, P('여자친구', '에이핑크'), '2019-01-01');
test('본인 영문표기 괄호는 타 소속 신호가 아님 — "마시로 (MASHIRO)"로 역추론이 죽지 않는다',
  '마시로 (MASHIRO) - HOTLINE (feat. BOBBY) | 뮤직뱅크', undefined, P('메이딘'), '2026-08-21');

// ── 흔한단어 멤버명 평문 오탐 차단(2026-09-03, 실데이터 감사) ─────────────
// 이런(에버글로우 E:U 김이런)·온다(에버글로우)·바로(비원에이포 BARO)는 흔한 어휘라 그룹 신호 없는
// 평문에서 대량 오매칭됐다("바로 이런 것"·"비가 온다"·"바로 시작"). _ATM_HASHTAG_ONLY_NAMES로 게이트 —
// 그룹이 같이 있으면(종현과 동일) 그대로 인정되므로 진짜 콘텐츠는 안 잃는다.
test('흔한단어 차단 — "바로 이런 것"은 어떤 그룹으로도 안 감',
  '성공한 사람의 인테리어란 바로 이런 것! #전참시', undefined,
  r => !r || (!r.primaryGroup && !(r.withGroups || []).length));
test('흔한단어 차단 — "비가 온다"는 에버글로우로 안 감',
  '오늘도 비가 온다', undefined,
  r => !r || (r.primaryGroup !== '에버글로우' && !(r.withGroups || []).includes('에버글로우')));
test('흔한단어 차단 — "바로 시작"은 비원에이포로 안 감',
  '바로 시작합니다 브이로그', undefined,
  r => !r || (r.primaryGroup !== '비원에이포' && !(r.withGroups || []).includes('비원에이포')));
test('흔한단어 유지 — 그룹이 같이 있으면 에버글로우 이런·온다 인정',
  '에버글로우 이런 온다 직캠 4K', undefined,
  r => !!r && r.primaryGroup === '에버글로우' && ['이런', '온다'].every(m => (r.membersByGroup['에버글로우'] || []).includes(m)));
test('흔한단어 유지 — 비원에이포 바로 직캠은 인정',
  '[MPD직캠] 비원에이포 바로 직캠', undefined,
  r => !!r && (r.membersByGroup['비원에이포'] || []).includes('바로'));
test('흔한단어 유지 — #바로 해시태그는 비원에이포로 인정',
  '#바로 #비원에이포 무대', undefined,
  r => !!r && (r.primaryGroup === '비원에이포' || (r.withGroups || []).includes('비원에이포')));

// ── 직캠 "] 뒤 미지 그룹" → 보류(2026-09-03 사용자 요청) ─────────────────────────
// [브랜드] 그룹 멤버 - 곡 에서 그룹명이 우리 DB에 없으면 그 뒤 멤버는 동명이인 위험 → 태그 말고 보류.
// 아는 그룹·솔로는 그대로. 유예-안쪽 데뷔게이트가 못 잡는 동명이인 오태깅을 잡는다.
test('미지그룹 보류 — 핫이슈(우리에 없음) 예원 직캠을 피프티피프티로 안 끌고 보류',
  "[안방1열 직캠4K] 핫이슈 예원 'ICONS' (HOT ISSUE YEWON FanCam)", undefined,
  r => !!r && r.hold === true && !r.primaryGroup);
test('미지그룹 보류 아님 — 아는 그룹(아이오아이) 직캠은 그대로 태깅',
  "[MPD직캠] 아이오아이 정채연 직캠 4K 'Whatta Man'", undefined,
  r => !!r && !r.hold && r.primaryGroup === '아이오아이', '2016-08-01');
test('미지그룹 보류 아님 — 솔로(전소미) 직캠은 선두가 곧 멤버라 보류 안 함',
  "[안방1열 직캠4K] 전소미 'XOXO' (JEON SOMI FanCam)", undefined,
  r => !!r && !r.hold, '2021-06-01');

// ── 솔로 등록된 옛멤버의 era(활동기) 구분(2026-09-03 사용자 요청) ─────────────────
// 솔로 등록된 사람도 **그룹 활동기(데뷔~탈퇴/해체) 안**의 영상이면 솔로가 아니라 그 그룹으로 배정하고
// members엔 본인을 넣는다(→ 그룹 카드·본인 멤버 카드 양쪽에 노출). 활동기 밖(탈퇴 후)은 솔로로.
// 승한: 라이즈 탈퇴(2024.10.13) 후 솔로 등록된 실제 케이스. ⚠️ 날짜 없으면 era 확정 못 하므로 솔로 유지.
test('era 구분 — 라이즈 활동기(탈퇴 전) 승한 직캠은 라이즈로(멤버=승한)',
  '승한 직캠 4K', undefined,
  r => !!r && r.primaryGroup === '라이즈' && (r.membersByGroup['라이즈'] || []).includes('승한'), '2024-01-01');
test('era 구분 — 탈퇴 후 승한 직캠은 솔로(본인)로',
  '승한 직캠 4K', undefined,
  r => !!r && r.primaryGroup === '승한', '2025-06-01');

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

// 동명이인 성-뗀 충돌 가드(걸스데이 혜리 ↔ 장혜리)의 회귀는 desc-evidence.test.js로 옮겼다.
// 여기선 소스 문자열을 정규식으로 훑는 방식이었는데, 그 검사는 "한글 경로에 가드 문구가 있다"만 보고
// **영문 경로(#HYERI)가 통째로 뚫린 것은 못 잡아** 통과 상태로 292건이 남아 있었다(2026-09-02).
// _atmMatchesMember는 이 파일 하네스가 안 싣는 함수라(여긴 _m2ParseTitle 전용), 실동작 검증은
// 공용 하네스(tools/m2_harness.js)를 쓰는 desc-evidence.test.js가 제자리다.

// ── 직캠 진입게이트 직접 검증(_FANCAM_SHOW_PATTERNS, 2026-09-03) ─────────────
// 왜 결과가 아니라 파서를 직접 보는가: 위 end-to-end 케이스들은 **수정 없이도 통과할 수 있다.** 제목에
// 정답 그룹명이 그대로 있고 곡명 충돌이 없으면 구조 인식이 실패해도 기존 경로가 어차피 정답을 낸다.
// 실제로 [UNFILTERED CAM]·[원픽캠]·[OMEGA X] 케이스는 패턴을 되돌려도 4개 중 3개가 초록불이었다
// (2026-09-03 음성 대조로 확인). 그래서 "이 대괄호가 구조로 인식되는가"를 직접 못 박는다 —
// 인식이 곧 곡명 배제(songSpan)이고, 그게 안 되면 곡명이 그룹명으로 읽히는 사고가 다시 난다.
const GATE_CASES = [
  ["[페이스캠4K] 위클리 지한 'After School' (Weeekly JI HAN FaceCam)│@SBS Inkigayo 220220", '페이스캠(한글)', 'After School'],
  ["[UNFILTERED CAM] ZEROBASEONE HAN YU JIN(한유진) 'In Bloom' 4K | BE ORIGINAL", 'UNFILTERED CAM', 'In Bloom'],
  ['[원픽캠 4K] 고스트나인 이진우 - 밤샜다 (GHOST9 LEE JIN WOO - Up All Night) l #쇼챔피언 l EP.397', '원픽캠(한글)', '밤샜다'],
  ["[얼빡직캠 4K] 제로베이스원 한유진 'ICONIK' (ZEROBASEONE HAN YUJIN Facecam) @뮤직뱅크 250905", '직캠(기존 회귀 가드)', 'ICONIK'],
];
GATE_CASES.forEach(([title, label, expectSong]) => {
  const fc = _fancamParseTitle(title);
  const ok = !!fc && !!fc.songSpan && (fc.songSeg || '').trim() === expectSong;
  if (ok) { pass++; console.log(`✅ 진입게이트 — [${label}] 구조 인식 + 곡명 '${expectSong}' 구간 확보`); }
  else {
    fail++;
    console.log(`❌ 진입게이트 — [${label}] 구조 인식 실패 → 곡명이 안 지워져 그룹명으로 읽힐 수 있음`);
    console.log(`   title="${title}"`);
    console.log(`   _fancamParseTitle=${JSON.stringify(fc)}`);
  }
});

console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
