// 태그 편집 모달이 "영상의 실제 소속(group_ko)"에 고정되는지 회귀 테스트 (2026-08-27)
//
// 사고: 사용자가 조승연(우즈) 영상을 수동 편집해 "엑스원-우즈"를 골라 저장했는데 반영이 안 됐다.
//
// 원인 — 모달이 영상의 실제 group_ko를 **읽지 않았다**:
//   ① 모달을 열 때 DB에서 members/with_members/content_flag 등은 읽어오는데 `group_ko`는 select에
//      없었다. 그래서 "소속 그룹" 칸과 멤버 체크박스 목록이 **지금 보던 카드의 그룹(ko)** 으로 그려졌다.
//   ② 저장 시 `groupKoInput !== ko` 로 비교해서, 칸에 카드 그룹이 그대로 있으면 group_ko를 아예 안 썼다.
//   → 화면엔 '엑스원'이라 떠 있는데 행의 group_ko는 '이즈나' 그대로. members[]는 "그 행의 group_ko
//      그룹 안에서 누가 나오는가"라는 뜻이고 멤버 카드 조건이 and(group_ko.eq.그룹, members.cs.{이름})
//      이라, 저장된 태그가 **어느 카드에서도 조회되지 않았다.**
//
// 실측 피해: members에 이름은 있는데 그 행 group_ko가 그 사람 소속이 아닌 "고아 태그" 1,155개
//            (수동 저장 51개). 상위: 아이유 353 · 이영지 151 · 김재중 128 · 보아 87 … 우즈 7.
//            솔로/솔로전환 아티스트가 상위를 차지하는 건 카드 키(_ytGroupKoFor)와 태깅 키(group.ko)가
//            갈리는 데다 외부 채널에서 엉뚱한 group_ko로 들어오는 일이 잦기 때문.
//
// 실행: node tests/tag-modal-gko.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── ① 모달이 실제 group_ko를 읽는가 ──────────────────────────────────────────
const modalSelect = (admin.match(/\.select\('([^']*tags_manual[^']*content_formats)'\)\.eq\('id',v\.id\)/) || [])[1] || '';
need(modalSelect.length > 0, '모달의 단일 영상 조회 select를 찾음');
need(modalSelect.split(',').map(s => s.trim()).includes('group_ko'),
  `  · select에 group_ko 포함(이게 빠져서 사고가 났다) — ${modalSelect.slice(0, 60)}…`);

// ── ② 응답이 오면 실제 소속으로 폼을 다시 맞추는가 ───────────────────────────
need(/const realGko=data\.group_ko\|\|ko;/.test(admin), '응답의 group_ko를 실제 소속으로 채택');
need(/_vidTagTarget\.realGko=realGko;/.test(admin), '  · 저장 로직이 쓸 수 있게 _vidTagTarget에 보관');
need(/_renderVidTagMemberCheckboxes\(realGko,\{savedMembers\}\)/.test(admin),
  '  · 멤버 체크박스를 **실제 소속** 로스터로 다시 그림(체크한 이름이 해석될 그룹과 일치해야 함)');
need(/gkoField\.value=realGko;/.test(admin), '  · "소속 그룹" 칸도 실제 값으로 교체');
// 응답이 오는 사이 관리자가 칸을 직접 만졌으면 덮어쓰면 안 된다(기존 레이스 방어와 같은 원칙)
need(/const untouched=_vidTagRenderedGko===ko&&gkoField&&gkoField\.value===ko;/.test(admin),
  '  · 응답 대기 중 관리자가 그룹 칸을 만졌으면 그 선택을 존중(덮어쓰지 않음)');
need(/id="vid-tag-gko-notice"/.test(html), '카드 그룹과 다를 때 띄울 안내 영역이 있음');
need(/notice\.style\.display='';/.test(admin) && /실제 소속은/.test(admin),
  '  · 다를 때만 안내를 띄움(무엇이 실제 소속인지 명시)');

// ── ③ 저장 시 비교 기준이 '카드 그룹'이 아니라 '실제 소속'인가 ───────────────
need(/const _curGko=_vidTagTarget\.realGko\|\|ko;/.test(admin), '저장 시 비교 기준을 실제 소속으로 잡음');
need(/if\(groupKoInput&&groupKoInput!==_curGko\)\{/.test(admin),
  '  · group_ko 갱신 여부를 _curGko와 비교(예전엔 ko와 비교해서 판정이 뒤집혔다)');
need(!/if\(groupKoInput&&groupKoInput!==ko\)\{/.test(admin),
  '  · 옛 비교(ko 기준)가 남아있지 않음');

// ── ④ 고아 태그를 사람이 볼 수 있는 화면이 있는가 ────────────────────────────
// 정정 방법이 영상마다 다르다(group_ko 재배정 vs with_members로 이동) → 자동 처리 대신 목록으로 본다.
need(/data-tab="orphan"/.test(html), '영상 관리 패널에 "고아 멤버태그" 탭');
need(/_vmTab==='orphan'/.test(admin), '  · 검수형 탭(검색창 숨김)으로 분류됨');
const orphanBranch = (() => {
  const i = admin.indexOf("if(tab==='orphan'){");
  if (i < 0) return '';
  let j = admin.indexOf('{', i), d = 0;
  for (let k = j; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}') { d--; if (!d) return admin.slice(i, k + 1); } }
  return '';
})();
need(orphanBranch.length > 0, '  · 조회 분기 존재');
need(/_artistGroups\(a\)\.some\(g=>g\.ko===gko\)/.test(orphanBranch),
  '  · 판정에 _artistGroups 사용(겸임 그룹까지 소속으로 인정 — 안 그러면 겸임 멤버가 전부 고아로 오탐)');
need(/_known\(m\)/.test(orphanBranch),
  '  · 미등록 이름은 제외(그건 "이름이 로스터에 없다"는 별개 문제)');
need(/tags_manual/.test(orphanBranch), '  · 수동 저장분을 위로 정렬(사람이 직접 넣은 게 더 시급)');
need(/_vmCacheSync\(\)/.test(orphanBranch), '  · 다른 탭들과 같이 결과 캐시에 반영');
need(/v\._orphans\|\|\[\]\)\.includes\(m\)\?`⚠️\$\{m\}`:m/.test(admin),
  '목록에서 어느 이름이 고아인지 표시(⚠️) — 목록만 보고 정정 방법을 판단해야 하므로');

console.log(pass ? '\n✅ 태그 모달 group_ko 테스트 통과' : '\n❌ 태그 모달 group_ko 테스트 실패');
process.exit(pass ? 0 : 1);
