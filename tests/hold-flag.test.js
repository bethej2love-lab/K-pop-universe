// 카드 편집 모달·일괄바의 '보류' 플래그 회귀 테스트 (2026-08-27)
//
// 사용자 요청: "카드 내 연필 버튼 편집 창에 무관·숨김처럼 보류도 만들어주고, 선택/전체 선택했을
// 경우에도 '보류' 추가해줘." (영상 관리 패널엔 이미 '보류' 탭과 '선택-보류'가 있었는데, 카드 쪽
// 편집 모달과 admin-bulk-bar에만 없었다.)
//
// ⚠️ 이 테스트의 핵심은 **보류를 거르는 세 곳이 서로 어긋나지 않게** 못 박는 것이다.
//    카드 그리드 쿼리(buildBaseQuery)는 서버에서 무관·보류·hidden을 함께 빼는데(count까지 맞추려고
//    서버에서 건다), 클라이언트 안전망(_filterBannedVideos)과 편집 직후 재확인(patchItem)에는
//    '보류'가 빠져 있었다. 평소엔 서버가 걸러줘서 안 드러나지만, 방금 보류로 바꾼 행을 재조회 없이
//    화면에서 걷어내는 경로에선 이 둘이 유일한 기준이라 그대로 남았다.
//    → 첫 구현 때 나(클로드)는 _filterBannedVideos만 보고 "보류는 카드에 남는다"고 잘못 판단해
//      일괄 보류가 DOM을 안 지우게 만들었고, 사용자가 "보류 처리해도 카드에서 제외되어야 하는데"라고
//      바로잡았다. 세 곳을 같은 목록으로 맞추고, 그 일치를 여기서 검사한다.
//
// 실행: node tests/hold-flag.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'kpop_universe.css'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── 편집 모달(연필 버튼) ──────────────────────────────────────────────────────
need(/id="vid-tag-flag-hold-btn"[^>]*class="vid-tag-flag-toggle vid-tag-flag-hold"/.test(html),
  '편집 모달에 보류 버튼(무관·숨김과 같은 토글 클래스)');
need(/\.vid-tag-flag-hold\.active\{/.test(css), '보류 버튼 선택 상태 색이 정의됨');
// 무관(주황)·숨김(빨강)과 색이 겹치면 급하게 누를 때 헷갈린다 — 셋이 서로 다른 색인지 확인
const colorOf = cls => (css.match(new RegExp(`\\.${cls}\\.active\\{background:rgba\\(([^)]+)\\)`)) || [])[1];
const [cN, cH, cX] = ['vid-tag-flag-nomem', 'vid-tag-flag-hold', 'vid-tag-flag-hidden'].map(colorOf);
need(cN && cH && cX && cN !== cH && cH !== cX, `무관/보류/숨김 색이 서로 다름 — ${cN} / ${cH} / ${cX}`);

need(/holdBtn\.classList\.toggle\('active',_vidTagFlagChoice==='보류'\)/.test(admin),
  '_vidTagApplyFlagUI가 보류 선택 상태를 반영');
need(/getElementById\('vid-tag-flag-hold-btn'\)\?\.addEventListener\('click',e=>\{e\.stopPropagation\(\);_vidTagSetFlagChoice\('보류'\);\}\)/.test(admin),
  '보류 버튼 클릭이 _vidTagSetFlagChoice(단일 선택 토글)로 연결됨');
need(/_vidTagFlagChoice=null; \/\/ null \| '기타' \| '외부인' \| '개별출연' \| '무관' \| '보류' \| 'hidden'/.test(admin),
  '플래그 타입 주석에 보류가 반영됨');

// ── 일괄바(선택/전체 선택) ────────────────────────────────────────────────────
need(/<button id="admin-bulk-hold-btn">보류<\/button>/.test(html), '일괄바에 보류 버튼');
const holdHandler = (() => {
  const i = admin.indexOf(`getElementById('admin-bulk-hold-btn')`);
  if (i < 0) return '';
  let j = admin.indexOf('{', i), d = 0;
  for (let k = j; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}') { d--; if (!d) return admin.slice(i, k + 1); } }
  return '';
})();
need(holdHandler.length > 0, '일괄 보류 핸들러 파싱됨');
need(/content_flag:'보류'/.test(holdHandler), '  · content_flag를 보류로 저장');
need(/selectedItems\.forEach\(el=>el\.remove\(\)\)/.test(holdHandler),
  '  · 처리한 항목을 목록에서 즉시 제거 — 보류도 카드에서 빠지는 플래그라 무관/숨김과 같은 동작이어야 한다');
need(/_adminBulkExitFn\?\.\(\)/.test(holdHandler), '  · 처리 후 선택 모드 종료(무관/숨김과 동일)');

// ── 보류를 거르는 세 곳이 일치하는가 (이번 오판의 재발 방지) ─────────────────
// ① 카드 그리드 서버 쿼리  ② 클라이언트 안전망  ③ 편집 직후 재확인
need(/q=q\.or\('content_flag\.is\.null,content_flag\.neq\.무관'\)\.or\('content_flag\.is\.null,content_flag\.neq\.보류'\)/.test(html),
  '① 카드 그리드 쿼리가 서버에서 무관·보류를 함께 제외');
need(/function _filterBannedVideos\(list,ko\)\{[^\n]*content_flag!=='hidden'&&v\.content_flag!=='무관'&&v\.content_flag!=='보류'/.test(html),
  '② 클라이언트 안전망(_filterBannedVideos)도 hidden·무관·보류 셋 다 거름');
need(/if\(flag==='hidden'\|\|flag==='무관'\|\|flag==='보류'\)stillQualifies=false;/.test(html),
  '③ 편집 직후 재확인(patchItem)도 셋 다 목록에서 뺌');

// ── 일괄바가 좁은 화면에서 잘리지 않는가 ─────────────────────────────────────
// 버튼이 하나 늘면서 드러난 문제 — 실측 390px에서 바 폭이 475px(최악 679px)로 양쪽이 잘렸다.
need(/#admin-bulk-bar,#user-bulk-bar\{[\s\S]*?flex-wrap:wrap/.test(css), '일괄바가 좁은 화면에서 줄바꿈');
need(/#admin-bulk-bar,#user-bulk-bar\{[\s\S]*?max-width:calc\(100vw - 20px\)/.test(css), '  · 화면 폭을 넘지 않게 제한');
need(/#admin-bulk-bar,#user-bulk-bar\{[\s\S]*?left:10px;right:10px;transform:none/.test(css),
  '  · left/right를 양쪽으로 잡음 — left:50%만 두고 wrap하면 가용 폭이 50vw로 잡혀 오히려 5줄로 쪼그라든다(실측)');

console.log(pass ? '\n✅ 보류 플래그 테스트 통과' : '\n❌ 보류 플래그 테스트 실패');
process.exit(pass ? 0 : 1);
