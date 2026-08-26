// 콜라보 오태깅 재검증 — 판정 일원화 + 제거 안전장치 회귀 테스트 (2026-08-26)
//
// 이 테스트가 있는 이유(사용자 제보: "3. 콜라보 오태깅 재검증이 잘 매칭되어있는 것까지 제거하는 것 같다"):
//
// ① **미리보기와 실제 스윕이 각자 같은 판정을 복붙**해두고 있었고, 미리보기 쪽에만
//    promote/consolidate(태그를 되살리는 경로)가 빠져 있었다. 게다가 tags_manual=true 행을
//    세기만 하고 **목록에서 안 걸러내서**, 콘솔의 "제거될 상위30"이 사실상 보호되는 태그로 도배됐다.
//    실측: 미리보기 "제거 예정" 381건 중 380건이 수동 편집 행 → 실제로 바뀌는 건 1건.
//    → 판정을 _collabRejudge 하나로 합쳤다. 다시 갈라지면 이 테스트가 잡는다.
//
// ② 구조적 결함 — **태그는 강한 매처로 붙이고 제거는 약한 매처(_m2ParseTitle)로 판단**한다.
//    _m2ParseTitle은 설명란을 아예 안 보고 사실상 한국어 평문 위주라, 강한 매처(또는 사람 손)만
//    찾을 수 있는 태그가 재검증 때마다 삭제 후보가 된다. 실측(전체 17,184건): 삭제 후보 태그 515건 중
//    **281건(55%)이 제목에 눈으로 보였다**(해시태그 59 · 평문 183 · 영문표기 39).
//    → "이름과 그룹이 **둘 다** 텍스트에 보이면 제거하지 않는다"는 안전장치를 넣었다.
//    이름만으로 인정하면 동명이인 오태깅(드림캐쳐 지유 영상의 "지유(키키)")을 못 걷어내므로
//    반드시 그룹 근거까지 요구한다.
//
// 실행: node tests/collab-sweep.test.js

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── ① 판정 일원화 ──────────────────────────────────────────────────────────────
need(/function _collabRejudge\(v\)\{/.test(src), '공용 판정 함수 _collabRejudge 존재');

const fnBody = name => {
  const i = src.indexOf(name);
  if (i < 0) return '';
  let d = 0, s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return '';
};
const preview = fnBody('async function _ytSweepDetectPreview');
const sweep = fnBody('async function _ytSweepAmbiguousCollabMistag');
need(preview.length > 0 && sweep.length > 0, '미리보기/실제 스윕 함수 파싱됨');
need(preview.includes('_collabRejudge('), '미리보기가 공용 판정을 씀');
need(sweep.includes('_collabRejudge('), '실제 스윕이 공용 판정을 씀');
// 판정 로직을 각자 다시 갖고 있으면 안 됨 — 이게 갈라짐의 원인이었다
need(!preview.includes('_classifyGuestGroup('), '미리보기가 판정 로직을 자체 보유하지 않음');
need(!sweep.includes('_classifyGuestGroup('), '실제 스윕이 판정 로직을 자체 보유하지 않음');
need(!preview.includes('_m2ParseTitle('), '미리보기가 _m2ParseTitle을 직접 호출하지 않음');
need(!sweep.includes('_m2ParseTitle('), '실제 스윕이 _m2ParseTitle을 직접 호출하지 않음');

// ── ② 제거 안전장치 ────────────────────────────────────────────────────────────
need(/function _collabMemberEvidenced\(text,tag\)\{/.test(src), '멤버 태그 근거 검사 함수 존재');
need(/function _collabGroupEvidenced\(text,gko\)\{/.test(src), '그룹 근거 검사 함수 존재');
const rejudge = fnBody('function _collabRejudge');
need(rejudge.includes('_collabMemberEvidenced(ev,m)'), '멤버 태그 유지 판정에 근거 검사가 연결됨');
need(rejudge.includes('_collabGroupEvidenced(ev,g)'), '그룹 태그 유지 판정에 근거 검사가 연결됨');
// 이름만 보고 유지하면 동명이인 오태깅을 못 걷어낸다 — 그룹 근거를 반드시 먼저 요구해야 함
const memEv = fnBody('function _collabMemberEvidenced');
need(/if\(!_collabGroupEvidenced\(text,gko\)\)return false;/.test(memEv), '멤버 근거는 그룹 근거를 전제로 함(동명이인 방어)');
need(memEv.includes('_isHashtagOnlyName(ko)') && memEv.includes('ko.length===1'),
  '흔한단어·한 글자 이름은 해시태그로만 인정(기존 정책 재사용)');

// ── ②-2 재판정 근거를 태깅 매처와 동등하게: 별칭·altName·겸임(2026-08-26) ─────────────────
// 태깅은 altNames·matchAliases·겸임(_artistGroups)으로 붙이는데 재판정 근거는 name.ko/en만 봤음 →
// 별칭/옛이름 근거 태그가 재검증마다 오삭제 후보였음(실측 202개). 근거 검사를 태깅과 대칭으로 올림.
const grpEv = fnBody('function _collabGroupEvidenced');
need(grpEv.includes('altNames'), '그룹 근거가 altNames(브브걸↔브레이브걸스·슈퍼노바↔초신성 등)도 인정');
need(memEv.includes('matchAliases'), '멤버 근거가 matchAliases(황민현↔민현·JIN↔진 등)도 인정');
need(memEv.includes('_artistGroups('), '멤버 조회가 _artistGroups로 겸임 멤버(민현(워너원) 등)도 찾음');

// ── ③ 설명란까지 근거로 봄 ─────────────────────────────────────────────────────
need(/function _collabEvidenceText\(v\)\{return`\$\{v\.title\|\|''\}\\n\$\{v\.description\|\|''\}`;\}/.test(src.replace(/\\n/g, '\\n')) || src.includes("_collabEvidenceText(v){return`${v.title||''}"),
  '근거 텍스트에 설명란(description)이 포함됨');
const selects = (src.match(/\.select\('id,title,description,group_ko,with_members,with_groups,tags_manual,published_at'\)/g) || []).length;
need(selects === 2, `두 스윕 모두 description을 조회함 (현재 ${selects}곳)`);

// ── ④ 수동 편집 보호 ───────────────────────────────────────────────────────────
need(sweep.includes('if(v.tags_manual)'), '실제 스윕이 tags_manual 행을 건너뜀');
need(preview.includes('if(v.tags_manual)'), '미리보기가 tags_manual 행을 분리 집계함');
need(/실제로 바뀔 행/.test(preview), '미리보기 문구가 "실제로 바뀔 행"을 앞세움(보호분과 섞지 않음)');

console.log(pass ? '\n✅ 콜라보 스윕 테스트 통과' : '\n❌ 콜라보 스윕 테스트 실패');
process.exit(pass ? 0 : 1);
