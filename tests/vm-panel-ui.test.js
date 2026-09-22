// 영상 관리 패널 UI 정교화 (2026-08-27, 사용자 요청 6건)
// ① 숨김 탭에서 옆 상태로 못 옮기던 막다른 골목 → 4상태 대칭 이동
// ② 탭별 "마지막 조회 시점 개수" 배지
// ③ 데스크톱 패널 높이 고정  ④ 목록 스크롤바 상시 표시
// ⑤ 숨김 목록 재판정 스윕(옛 매처가 숨긴 것 되살리기)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

// ── ① 상태 이동 버튼 4종 (2026-08-27 정리) ───────────────────────
// 뜻이 고정된 4개로 통일했다. 예전엔 여기에 ⓐ뜻이 고정된 3개(정상·보류·무관) ⓑ탭마다 뜻이 바뀌는
// vm-apply-btn ⓒ나중에 얹은 vm-move-* 4개가 섞여, 같은 동작 버튼이 두 벌씩 떴다(사용자 제보).
for (const id of ['vm-normal-btn', 'vm-nomem-btn', 'vm-hold-btn', 'vm-hidden-btn']) {
  ok(html.includes(`id="${id}"`), `${id} 버튼이 index.html에 없음`);
  ok(new RegExp(`\\['${id}',`).test(adminJs), `${id}가 _VM_FLAG_BTNS 배선 목록에 없음`);
}
// 되살아나면 안 되는 것들 — 중복의 원인이었던 셋
for (const gone of ['vm-move-normal-btn', 'vm-move-nomem-btn', 'vm-move-hold-btn', 'vm-move-hidden-btn']) {
  ok(!html.includes(`id="${gone}"`), `${gone}이 되살아남 — 상태 버튼이 두 벌이 된다`);
}
ok(!/id="vm-apply-btn"/.test(html),
  'vm-apply-btn이 되살아남 — 탭마다 뜻이 바뀌는 버튼이라 고정 4개와 반드시 겹친다');
for (const dead of ['_vmDefaultFlag', '_vmApplyLabel', '_VM_MOVE_BTNS', '_vmSyncMoveBtns']) {
  ok(!adminJs.includes(dead + '('), `${dead} 잔재가 남아있음`);
}

// 공통 함수 하나로 처리해야 함 — 버튼마다 로직을 복사하면 한 곳만 고쳐지는 드리프트가 난다.
ok(/async function _vmBulkSetFlag\(newFlag,btnId\)/.test(adminJs), '_vmBulkSetFlag 공통 함수가 없음');
ok(/_VM_FLAG_BTNS\.forEach\(\(\[id,flag\]\)=>document\.getElementById\(id\)\?\.addEventListener/.test(adminJs),
  '4개 버튼이 한 목록에서 배선되지 않음(개별 리스너로 흩어지면 또 갈라진다)');
// 자기 탭 상태로 가는 버튼은 숨겨야 함(제자리 이동은 무의미)
ok(/flag!==tabFlag/.test(adminJs), '현재 탭 자신의 상태 버튼을 숨기는 로직이 없음');
ok((adminJs.match(/_vmSyncFlagBtns\(\)/g) || []).length >= 2,
  '_vmSyncFlagBtns가 정의만 되고 탭 전환에서 안 불림');
// 노출 판정과 목록 잔류 판정이 **같은 표**를 봐야 "버튼은 있는데 눌러도 목록에서 안 빠지는" 게 안 생긴다.
ok(/const staysInList=tabFlag===undefined\|\|newFlag===tabFlag;/.test(adminJs),
  '목록 잔류 판정이 _vmTabFlag()를 안 씀 — 노출 판정과 갈라진다');
ok((adminJs.match(/_vmTabFlag\(\)/g) || []).length >= 2, '_vmTabFlag가 한 곳에서만 쓰임(표가 두 벌일 가능성)');
// 되돌리기 스냅샷 — 예전엔 "선택-무관"만 남기고 보류/정상은 안 남겼다. 셋 다 수백 행을 한 번에
// 바꾸는 같은 성격이라 기준이 갈릴 이유가 없다(이 프로젝트는 undo가 곧 백업).
ok(/await _snapshotBeforeBulk\(`영상 관리 일괄/.test(adminJs),
  '일괄 상태 변경에 스냅샷이 없음 — 되돌리기 불가');

// ── ② 탭 개수 배지 ───────────────────────────────────────────────
ok(/function _vmSetTabCount\(tab,n\)/.test(adminJs), '_vmSetTabCount가 없음');
ok(/\.vm-tab-count\{/.test(css), '.vm-tab-count 스타일이 없음');
// 배지는 목록과 같은 지점에서 갱신돼야 한다(따로 부르면 한쪽만 갱신되는 드리프트)
ok(/_vmSetTabCount\(_vmTab,_vmRows\.length\);[\s\S]{0,120}_vmCache\.set/.test(adminJs),
  '_vmCacheSync 안에서 배지를 갱신하지 않음');
// 캐시 히트 경로에서도 배지가 갱신돼야 하고, 거기서 _vmCacheSync를 부르면 ts가 갱신된다
// ⚠️ vm개선 3(a)에서 TTL 자동만료 자체를 없앴다(세션 동안 캐시 유지, 갱신은 수동 ↻로만) — 그래서
//    캐시 히트 조건은 더 이상 `Date.now()-ts<_VM_CACHE_TTL`이 아니라 `if(_cached){`뿐이다.
//    2026-09-23: 옛 TTL 조건을 찾던 정규식이 매치 자체가 안 돼 항상 실패로 오진하고 있었음 — 정정.
ok(/_vmSetTabCount\(tab,_vmRows\.length\); \/\/ 개수 배지만 갱신/.test(adminJs),
  '캐시 히트 경로에서 배지 갱신이 없음');
const hitBlock = /if\(_cached\)\{[\s\S]*?return;/.exec(adminJs);
ok(hitBlock && !/_vmCacheSync\(\)/.test(hitBlock[0]),
  '캐시 히트 경로에서 _vmCacheSync를 부름 — ts가 갱신돼 "N분 전" 표시·디스크 캐시 갱신 판단이 어긋남');

// ── ③ 패널 높이 고정 / ④ 스크롤바 ────────────────────────────────
ok(/@media\(min-width:769px\)\{#vm-panel\{height:86vh;\}\}/.test(css),
  '데스크톱 패널 높이 고정 규칙이 없음');
ok(/#vm-panel\{width:min\(560px/.test(css) && /max-height:86vh/.test(css),
  '모바일용 max-height가 사라짐 — 짧은 목록에서 빈 공간이 커짐');
ok(/#vm-list\{overflow-y:scroll/.test(css), '#vm-list가 overflow-y:scroll이 아님(스크롤바가 사라짐)');
ok(/#vm-list::-webkit-scrollbar\{width:\d+px;\}/.test(css), '웹킷 스크롤바 폭 지정이 없음');
ok(/#vm-list::-webkit-scrollbar-thumb\{/.test(css), '스크롤바 thumb 스타일이 없음');

// ── ⑤ 숨김 목록 재판정 스윕 ──────────────────────────────────────
ok(html.includes('id="sp-hidden-rejudge-btn"'), '숨김 재판정 버튼이 index.html에 없음');
ok(/async function _ytSweepHiddenRejudge\(\)/.test(adminJs), '_ytSweepHiddenRejudge가 없음');
const sweep = /async function _ytSweepHiddenRejudge\(\)\{[\s\S]*?\n\}/.exec(adminJs);
ok(!!sweep, '스윕 함수 본문을 못 읽음');
if (sweep) {
  const b = sweep[0];
  // 2026-08-20 대량 오숨김 사고 재발 방지 — 안전장치 5종이 전부 있어야 한다.
  ok(/\.eq\('tags_manual',false\)/.test(b), '수동 편집분(tags_manual=true)을 제외하지 않음 — 프로젝트 헌법 위반');
  ok(/\.eq\('content_flag','hidden'\)/.test(b), '숨김 행만 대상으로 하지 않음');
  ok(/if\(!_titleHas\(nu,ng\)\)\{weak\+\+;continue;\}/.test(b), '약한 추론(제목에 literal 없음)을 안 거름');
  ok(/if\(COLLAB\.test\(v\.title\|\|''\)\)\{collab\+\+;continue;\}/.test(b), '콜라보/커버를 안 거름');
  ok(/_snapshotBeforeBulk\('숨김 목록 재판정'/.test(b), '스냅샷 없이 일괄 수정함 — 되돌리기 불가');
  // ⚠️ 무거운 스윕에 native confirm()을 쓰면 즉시 false를 반환해 버튼이 죽는다(확인된 함정) — 그래서
  //    이 프로젝트는 _sweepConfirmSimple(모달 기반 미리보기)을 쓴다. confirm( 리터럴을 찾던 옛 assert가
  //    이미 있는 미리보기 단계를 "없다"고 오진하고 있었음(2026-09-23 정정).
  ok(/if\(!await _sweepConfirmSimple\(/.test(b), 'confirm 미리보기 단계(_sweepConfirmSimple)가 없음');
  ok(/console\.log\(`\[숨김 재판정\]/.test(b), '표본을 콘솔에 안 찍음(사전 확인 불가)');
  ok(/if\(ng===v\.group_ko\)\{same\+\+;continue;\}/.test(b), '판정이 같은 행을 손대고 있음');
  // 무매칭은 '무관'이 아니라 '보류'로 — 매처가 못 잡는 것과 우주 밖인 것은 다르다.
  ok(/content_flag:'보류'|_flagPatch\('보류',/.test(b), '무매칭분을 보류로 안 보냄');
  ok(!/content_flag:'무관'/.test(b), '무매칭분을 무관으로 밀고 있음 — 실존 그룹이 섞여 있어 영영 안 보이게 됨');
  ok(/content_flag:null|_flagPatch\(null,/.test(b), '재배정 시 숨김 해제를 안 함');
  // 기존 오태깅 재배정 버튼과 판정 보조 함수가 갈라지지 않았는지
  // ⚠️ 예전엔 숨김 재판정이 _grpToks/_norm/_titleHas/COLLAB를 로컬에 따로 복제해뒀었다 — 문자열이 그
  //    시점엔 같았지만, 그 뒤 _MISTAG 쪽에 안전장치 3종(스퀴즈매칭·COLLAB 키워드 보강·자체채널 게이트)이
  //    추가되는 동안 로컬 복제본은 갱신되지 않아 조용히 갈라져 있었다(2026-09-23 발견·수정). 문자열
  //    동일성 비교는 "복제 자체가 없어졌는지"를 못 잡으므로, 이제 _MISTAG를 직접 구조분해해 쓰는지로
  //    검증한다 — 갈라질 여지 자체를 없애는 쪽이 드리프트 재발을 막는다.
  ok(/const\{_grpToks,_norm,_titleHas,COLLAB,ownChannel:_ownChannel\}=_MISTAG;/.test(b),
    '숨김 재판정이 _MISTAG를 안 쓰고 판정 보조 함수를 로컬에 복제함(다시 갈라질 위험)');
  ok(/if\(_ownChannel\(v\)\)\{ownCh\+\+;continue;\}/.test(b),
    '숨김 재판정에 자체채널 게이트가 없음 — 재배정 오탐의 대부분(실측 93%)을 걸러내는 안전장치가 빠져있음');
}

console.log(`vm-panel-ui: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
