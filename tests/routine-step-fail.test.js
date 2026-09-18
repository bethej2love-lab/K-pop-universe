// 루틴 단계가 조용히 실패하면 ❌로 올라오는가 (2026-09-18 신설)
//
// 왜: 루틴 루프는 단계 함수가 `return`으로 끝나면 **진행 문구가 뭐든 ✅**로 기록했고, 러너
// (tools/run_daily_routine.cjs)는 로그의 `^❌` 줄 수로만 성공을 판정한다. 그래서 음방 1위 수집이
// "0건 저장됨"을 띄운 채 7일간 매 3시간마다 아무것도 안 넣고 워크플로는 계속 초록이었다.
// 루틴 8단계를 전수로 훑으니 같은 모양(`_ytSetProg(…); return;`)이 31곳인데, 그중 절반은
// **정상 종료**(…없어요 / 오염 없음 / 취소됨 / 건너뜀)라 개별 함수를 다 고치는 것보다 루프에서
// 진행 문구로 가르는 쪽이 싸고 되돌리기도 쉽다. 그 판별 규칙(_STEP_FAIL_RE)이 이 테스트의 대상.
//
// ⚠️ 이 규칙은 **양쪽으로** 틀릴 수 있다:
//   · 너무 좁으면 → 조용한 실패가 다시 초록으로 지나간다(원래 사고).
//   · 너무 넓으면 → 성공 문구의 "N개 일시 실패(다음에 재시도)" 때문에 멀쩡한 단계가 매번 빨간불이
//     되고, 그러면 사람이 빨간불을 무시하기 시작해서 결국 같은 곳으로 돌아온다.
// 그래서 실패/정상 문구를 **양쪽 다** 고정해둔다. 새 단계를 추가하며 문구를 만들면 여기 추가할 것.
//
// 실행: node tests/routine-step-fail.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const admin = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`✅ ${m}`); };
const bad = m => { fail++; console.log(`❌ ${m}`); };

// 규칙을 admin.js에서 그대로 꺼내 쓴다 — 테스트가 자기만의 사본을 들고 있으면 드리프트한다.
const m = admin.match(/const _STEP_FAIL_RE=(\/(?:[^/\\\n]|\\.)+\/[a-z]*);/);
if (!m) { console.log('❌ admin.js에서 _STEP_FAIL_RE를 못 찾음 — 이름이 바뀌었으면 이 테스트도 같이 고칠 것'); process.exit(1); }
let RE;
try { RE = eval(m[1]); } catch (e) { console.log('❌ _STEP_FAIL_RE 파싱 실패: ' + e.message); process.exit(1); }
ok(`_STEP_FAIL_RE 로드: ${m[1]}`);

// 루프가 실제로 이 규칙을 쓰고, 결과에 따라 ❌/✅를 가르는지
/const _failed=_STEP_FAIL_RE\.test\(prog\)/.test(admin)
  ? ok('루틴 루프가 진행 문구를 규칙으로 판정함')
  : bad('루프가 _STEP_FAIL_RE를 안 씀 — 판정이 다시 "return이면 성공"으로 돌아갔다');
/\$\{_failed\?'❌':'✅'\}/.test(admin)
  ? ok('판정 결과가 로그 머리글자(❌/✅)에 반영됨 — 러너는 이 글자로만 성공을 센다')
  : bad('판정해놓고 로그에 안 쓰면 러너는 여전히 전부 성공으로 읽는다');

// ── 실패로 잡혀야 하는 문구(루틴 단계 함수들에서 실제로 쓰는 것) ──
const MUST_FAIL = [
  '조회 실패: relation "x" does not exist',
  '조회수 갱신 실패: canceling statement due to statement timeout',
  '기존 기록 조회 실패: 57014',
  '대상 조회 실패: fetch failed',
  '⛔ 오늘 쿼터를 다 썼어요',
  'Supabase 연결 없음',
  'API 키를 먼저 입력해주세요',
];
// ── 정상 종료라 절대 빨간불이 되면 안 되는 문구 ──
// (마지막 세 줄이 핵심 함정 — 성공 문구 안에 '실패'라는 단어가 그대로 들어간다)
const MUST_PASS = [
  '검사할 영상이 없어요',
  '검사 완료 — 1200개 중 오염 없음',
  '겸임 중복 — 정리할 것 없음 (조회 800)',
  '동명이인 자체가 없어요',
  '검사 완료 — 900개 중 새로 붙일 포맷 없음',
  '조회수 갱신: 최근 영상 없음',
  '조회수 갱신: 반영할 값 없음',
  '조회수 순환 갱신 건너뜀 — 마지막 실행 3시간 전 (하루 1회)',
  '취소됨 — 미리보기만 (신규 21건, 목록 콘솔).',
  '조회수 갱신 완료 — 1800개 · 12개 일시 실패(다음에 재시도)',
  '전체 조회수 갱신 완료 — 20000개 · 30개 일시 실패(다음에 재시도) (live 카테고리 · API 400회 사용)',
  '완료! 음악방송 1위 21건 추가 (실패 1건 — msg · 어느 행인지는 콘솔).',
];
let miss = 0, over = 0;
MUST_FAIL.forEach(t => { if (!RE.test(t)) { miss++; console.log(`   · 못 잡음: ${t}`); } });
MUST_PASS.forEach(t => { if (RE.test(t)) { over++; console.log(`   · 오판: ${t}`); } });
miss === 0 ? ok(`조용한 실패 ${MUST_FAIL.length}종을 전부 잡음`) : bad(`실패 문구 ${miss}종을 놓침 — 그 단계는 다시 초록으로 지나간다`);
over === 0 ? ok(`정상 종료 ${MUST_PASS.length}종을 하나도 오판하지 않음`) : bad(`정상 문구 ${over}종을 실패로 오판 — 빨간불이 흔해지면 아무도 안 본다`);

// 넣을 게 있는데 0건 저장된 경우는 규칙이 아니라 **throw**로 올린다(정규식 대상이 아님).
/넣을 게 \$\{payload\.length\}건 있는데 0건 저장됨/.test(admin) && /throw new Error\(m\);/.test(admin)
  ? ok('음방 1위: 넣을 게 있는데 0건이면 throw (규칙과 별개의 확실한 경로)')
  : bad('음방 1위의 0건 저장 경로가 throw를 잃었다 — 초록불로 돌아간다');

console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과`);
process.exit(fail ? 1 : 0);
