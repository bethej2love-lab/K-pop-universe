// YouTube 쿼터 배분 회귀 테스트 (2026-09-17 신설)
//
// 배경: 쿼터(하루 10,000)는 동기화·루틴·백필·수동 버튼이 **같이 쓰는 지갑**이다. 설계상 자동화가
// 9,450을 예약해 쓰고 있어서 남는 550으로는 "조회수 순환 갱신"(2만개=400유닛)을 누르면 그날 상황에
// 따라 터졌다 — 사용자가 버튼을 눌렀는데 50개만 저장되고 quotaExceeded가 난 게 그 상황이다.
//
// 그래서 두 가지를 넣었고, 여기서 그게 되돌아가지 않는지 고정한다:
//   ① 해체 그룹 채널은 하루 1회만 폴링 — 폴링 대상의 14.4%인데 신규 영상 기여는 0.52%였다(실측).
//      약 832유닛/일 확보.
//   ② 그 예산으로 조회수 순환 갱신을 루틴에서 **하루 1배치** 자동 실행(400유닛).
//
// ⚠️ 이 테스트가 지키는 건 "숫자"가 아니라 **구조**다. 배치 크기나 주기를 의도적으로 바꾸는 건
//    자유지만, (a) 해체 필터가 사라지거나 (b) 순환 갱신이 게이트 없이 루틴에 들어가면
//    (=3시간마다 400유닛 × 8 = 3,200/일) 지갑이 조용히 터진다. 그 두 가지를 막는다.
//
// 실행: node tests/yt-quota-budget.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const admin = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let pass = 0, fail = 0;
const need = (c, m, d) => { if (c) { pass++; console.log(`✅ ${m}`); } else { fail++; console.log(`❌ ${m}`); if (d) console.log('   ' + d); } };

// 함수 본문만 떼어낸다(중괄호 균형) — 전역 검색이면 "어딘가에 있긴 함"만 확인돼서 약하다.
function body(decl) {
  const i = admin.indexOf(decl);
  if (i < 0) return '';
  let j = admin.indexOf('{', i), depth = 0;
  for (; j < admin.length; j++) {
    if (admin[j] === '{') depth++;
    else if (admin[j] === '}') { depth--; if (!depth) return admin.slice(i, j + 1); }
  }
  return '';
}

/* ① 해체 채널 폴링 주기 */
const syncAll = body('async function _ytSyncAll()');
need(!!syncAll, '_ytSyncAll 본문을 찾음');
need(/_inclDisbanded\s*\|\|\s*!v\.disbanded/.test(syncAll),
  '_ytSyncAll이 해체 그룹 채널을 게이트 뒤에 둠',
  '이 필터가 빠지면 매 동기화가 해체 채널 32개를 그대로 폴링한다(하루 832유닛)');
need(/last_disbanded_sync/.test(syncAll),
  '해체 채널 폴링 주기를 DB(admin_meta)에 기록',
  'localStorage로 하면 Actions 러너가 매번 새 프로필이라 게이트가 무력해진다');
need(/_DISBANDED_GAP_MS\s*=\s*\d+\s*\*\s*3600\s*\*\s*1000/.test(syncAll),
  '해체 채널 간격이 시간 단위 상수로 선언됨');

/* ② 조회수 순환 갱신의 하루 1회 게이트 */
const daily = body('async function _ytRotateViewCountDaily()');
need(!!daily, '_ytRotateViewCountDaily(루틴용 래퍼)가 있음');
need(/last_viewcount_rotate/.test(daily), '순환 갱신 주기를 DB(admin_meta)에 기록');
need(/_VIEW_ROTATE_GAP_MS/.test(daily) && /return;/.test(daily),
  '간격이 안 지났으면 실제 갱신을 건너뜀');
// 표식을 호출 **전에** 써야 한다 — 뒤에 쓰면 쿼터로 예외가 났을 때 표식이 안 남아 3시간 뒤 또 시도한다.
const setIdx = daily.indexOf("_admMetaSet('last_viewcount_rotate'");
const callIdx = daily.indexOf('_ytRotateViewCountRefresh()');
need(setIdx > 0 && callIdx > 0 && setIdx < callIdx,
  '표식을 실제 갱신 호출보다 먼저 씀(쿼터 실패 시 하루 8번 재시도 방지)',
  `setIdx=${setIdx} callIdx=${callIdx}`);

/* ③ 루틴이 원본이 아니라 래퍼를 부른다 */
const routine = body('async function _admRunRoutine(withSync,opts)');
need(/fn:_ytRotateViewCountDaily/.test(routine),
  '루틴 단계가 래퍼(_ytRotateViewCountDaily)를 부름');
need(!/fn:_ytRotateViewCountRefresh\b/.test(routine),
  '루틴이 게이트 없는 원본(_ytRotateViewCountRefresh)을 직접 부르지 않음',
  '직접 부르면 3시간마다 400유닛 × 8 = 3,200유닛/일');
// 8단계는 스윕 블록(=full 모드) 안에 있어야 한다 — 매시간 sync 모드에서 돌면 안 된다.
const sweepBlock = routine.slice(routine.indexOf('if(!_syncOnly){'));
need(sweepBlock.includes('fn:_ytRotateViewCountDaily'),
  '순환 갱신이 full 루틴(3시간마다)에만 있고 매시간 동기화엔 없음');

/* ③-2 정책: 저장한 제목의 30일 갱신 (YouTube 개발자 정책 III.E.4) */
// 조회수 같은 통계는 감사 승인 시 36개월까지 예외가 되지만 **영상 제목은 예외가 없다** —
// derived-metrics 정책이 "video titles ... still must follow the 30-day policy"라고 못박는다.
// 이 순환 갱신이 전체 테이블을 훑는 유일한 경로라, 여기서 snippet을 빼면 제목이 영영 안 갱신된다.
const rotate = body('async function _ytRotateViewCountRefresh()');
need(/_parts\s*=\s*'snippet,statistics'/.test(rotate),
  '순환 갱신이 snippet(제목)을 같이 받음 — 30일 갱신 정책',
  'videos.list는 part를 더 얹어도 호출당 1유닛이라 추가 비용이 0이다');
need(/patch\.title=nt;patch\.title_norm=_titleNorm\(nt\)/.test(rotate),
  '제목이 바뀌면 title_norm(파생 컬럼)도 같이 갱신',
  'title만 바꾸면 검색이 옛 제목으로만 걸리는 불일치가 생긴다');
need(/nt!==prevTitle\.get\(id\)/.test(rotate),
  '바뀐 제목만 기록(47만 건에 매번 쓰지 않음)');
// 한 바퀴가 30일 안에 끝나는가 — 배치 × 30일이 전체 행 수를 덮어야 한다.
const batch = Number(/VIEW_COUNT_ROTATE_BATCH\s*=\s*(\d+)/.exec(admin)?.[1] || 0);
const TOTAL_ROWS = 471192;   // 2026-09-17 실측
need(batch * 30 >= TOTAL_ROWS,
  `하루 ${batch.toLocaleString()}개 × 30일 = ${(batch * 30).toLocaleString()} ≥ 전체 ${TOTAL_ROWS.toLocaleString()}행 (한 바퀴 약 ${Math.ceil(TOTAL_ROWS / batch)}일)`,
  '배치를 줄이면 한 바퀴가 30일을 넘어 저장 데이터 갱신 정책을 벗어난다');

/* ④ 예산 산술 — 실측값이 주석과 어긋나지 않는지 */
const withYt = Object.values(groups).filter(g => g && g.links && g.links.youtube);
const disbanded = withYt.filter(g => g.disbanded).length;
need(withYt.length > 100, `폴링 대상 채널 ${withYt.length}개`);
need(disbanded > 0, `그중 해체 그룹 ${disbanded}개 — 하루 1회로 낮춰 약 ${disbanded * 26}유닛/일 확보`);
need(/VIEW_COUNT_ROTATE_BATCH\s*=\s*(\d+)/.test(admin) && Number(RegExp.$1) / 50 <= 600,
  `순환 배치가 600콜 이하 (${Math.ceil(Number(RegExp.$1) / 50)}콜 = ${Math.ceil(Number(RegExp.$1) / 50)}유닛)`,
  '배치를 키우면 확보한 예산(약 832)을 넘어 다시 지갑이 터진다');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
