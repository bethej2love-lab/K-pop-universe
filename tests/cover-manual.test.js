// 원곡 수동 확정 보존 + 3단계 결정 회귀 하네스 (2026-09-07 신설)
//
// 왜 만들었나: 원곡(cover_of) 파이프라인에 "사람이 고친 게 다음 스윕에 되돌아간다"는 구멍이 있었다.
//  ① "선택-원곡제외"/"선택-원곡지정"이 plain update 하나 — 스냅샷·편집로그·잠금이 전부 없었고,
//     tags_manual=true 행은 보호 트리거에 막혀 조용히 0건 반영됐다.
//  ② 편집 모달엔 cover_of_song 필드 자체가 없어서, 원곡자를 손으로 바꿔도 옛 자동 곡명이 남았다.
//  ③ 스윕이 reason(credit ≈99% ↔ bare ≈6%)과 무관하게 전부 같은 확신으로 저장했다.
// 여기서 고정하는 건 "구조가 그대로 있는가"다 — 판정 자체는 tests/cover-resolve.test.js가 본다.
//
// 실행: node tests/cover-manual.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const admin = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

// 함수 본문을 중괄호 균형으로 잘라낸다(overlay-front.test.js와 같은 방식)
function body(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}
// 이벤트 핸들러 블록(선언 ~ 다음 최상위 document.getElementById 리스너 전까지)
function handler(src, marker, label) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error('[harness] 핸들러를 못 찾음: ' + label);
  const rest = src.slice(i + marker.length);
  const nxt = rest.search(/\ndocument\.getElementById\(/);
  return src.slice(i, i + marker.length + (nxt < 0 ? 3000 : nxt));
}

console.log('\n── 1. 공통 쓰기 경로(_coverManualApply) ──');
(() => {
  const fn = body(admin, /^async function _coverManualApply\(/m, '_coverManualApply');
  ck(/_snapshotBeforeBulk\(/.test(fn), '되돌리기 스냅샷을 뜬다');
  ck(/_tagEditLog\(/.test(fn), '편집 이력(tag_edit_log)을 남긴다 — 학습 루프의 유일한 정답 신호');
  ck(/_coverManualPatch\(\)/.test(fn), 'cover_manual 잠금을 같이 쓴다');
  ck(/tags_manual:false/.test(fn) && /tags_manual:true/.test(fn), 'tags_manual=true 행은 two-step(해제→쓰기→재잠금)으로 트리거 우회');
  ck(/_coverManualColMissing\(/.test(fn), '컬럼 없는 환경(마이그레이션 전) 폴백이 있다');
})();

console.log('\n── 2. 두 버튼이 그 경로를 탄다 ──');
(() => {
  const clear = handler(admin, "document.getElementById('vm-coverclear-btn')?.addEventListener", '원곡제외');
  ck(/_coverManualApply\(/.test(clear), '선택-원곡제외가 _coverManualApply를 쓴다(plain update 회귀 금지)');
  ck(/cover_of_song:null/.test(clear), '원곡자를 지우면 곡명도 같이 비운다(유령 값 방지)');
  const set = handler(admin, "document.getElementById('vm-cs-apply')?.addEventListener", '원곡지정');
  ck(/_coverManualApply\(/.test(set), '선택-원곡지정이 _coverManualApply를 쓴다');
  ck(/cover_of_song=null/.test(set) || /cover_of_song:null/.test(set), '원곡자가 바뀐 행은 옛 자동 곡명을 비운다');
})();

console.log('\n── 3. 스윕이 잠금을 존중한다 ──');
(() => {
  const v2 = body(admin, /^async function _ytSweepCoverV2\(/m, '_ytSweepCoverV2');
  ck(/if\(v\.cover_manual\)/.test(v2), '원곡 v2가 cover_manual 행을 건너뛴다');
  ck(/eq\('tags_manual',false\)|if\(v\.tags_manual\)/.test(v2), '수동편집(tags_manual) 보호도 그대로 — 프로젝트 헌법');
  const cl = body(admin, /^async function _ytSweepCoverCleanup\(/m, '_ytSweepCoverCleanup');
  ck(/if\(v\.cover_manual\)/.test(cl), '원곡 오탐 청소도 cover_manual 행을 건너뛴다');
  ck(/_snapHasCoverManual/.test(admin) && /'cover_manual'\]/.test(admin), '되돌리기 스냅샷 컬럼에 cover_manual 포함(+폴백)');
})();

console.log('\n── 4. 3단계 결정(HIGH 자동 / MEDIUM 큐 / LOW 무시) ──');
(() => {
  const conf = body(admin, /^function _coverConfidence\(/m, '_coverConfidence');
  ck(/'HIGH'/.test(conf) && /'MEDIUM'/.test(conf) && /'LOW'/.test(conf), '세 등급이 모두 존재');
  ck(/reason==='credit'/.test(conf), 'credit은 HIGH');
  ck(/return 'MEDIUM'; \/\/ bare/.test(conf), 'bare(평문 스캔)는 항상 MEDIUM — 실측 정밀도가 가장 낮다');
  const v2 = body(admin, /^async function _ytSweepCoverV2\(/m, '_ytSweepCoverV2');
  ck(/_coverConfidence\(r\)!=='HIGH'/.test(v2), '스윕이 HIGH가 아니면 자동 적용하지 않는다');
  ck(/_tagReviewEnqueueBatch\(/.test(v2), 'MEDIUM은 검수 큐로 적재된다(콘솔 무덤 금지)');
  ck(/_addsCover/.test(v2), '게이트는 "원곡을 새로 붙이는" 패치에만 — with_ 정리까지 큐로 보내지 않는다');
  ck(/cover_candidate:/.test(admin), '검수 큐에 cover_candidate 사유 라벨이 있다');
  ck(/tagq_cover_pick/.test(admin), '큐에서 후보를 눌러 바로 확정할 수 있다(같은 잠금 경로)');
})();

console.log('\n── 5. 모달의 원곡 곡명 필드 ──');
(() => {
  ck(/id="vid-tag-cover-song"/.test(html), '모달에 cover_of_song 입력이 있다');
  ck(/cover_of_song,category,is_short/.test(admin), '모달 열 때 cover_of_song도 읽어온다');
  ck(/_vidTagSongTouched/.test(admin), '사람이 곡명을 건드렸는지 추적한다(안 건드렸으면 옛 자동값 재저장 금지)');
  const save = admin.slice(admin.indexOf("document.getElementById('vid-tag-save')"));
  ck(/updatePayload\.cover_of_song=/.test(save), '단일 저장이 cover_of_song을 반영한다');
  ck(/_vidTagSongTouched&&coverSongVal/.test(save), '일괄 저장은 입력했을 때만 곡명을 덮어쓴다(선택분 전체 삭제 사고 방지)');
})();

console.log('\n── 6. 매일 루틴에 원곡 태깅이 들어있다 ──');
(() => {
  const routine = body(admin, /^async function _admRunRoutine\(/m, '_admRunRoutine');
  ck(/fn:_ytSweepCoverV2/.test(routine), '루틴 5단계로 원곡 태깅 v2가 돈다 — 사람이 🎵 버튼을 눌러야만 붙던 구조 해소');
  const sc = body(admin, /^async function _sweepConfirmSimple\(/m, '_sweepConfirmSimple');
  ck(/_admRoutineRunning/.test(sc), '루틴 중엔 확인 창을 띄우지 않는다(무인 실행이 멈추지 않게)');
})();

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 원곡 수동 확정/3단계 결정 하네스 통과');
process.exit(fail ? 1 : 0);
