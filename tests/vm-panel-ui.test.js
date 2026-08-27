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
// 캐시 히트 경로에서도 배지가 갱신돼야 하고, 거기서 _vmCacheSync를 부르면 TTL이 미끄러진다
ok(/_vmSetTabCount\(tab,_vmRows\.length\); \/\/ 개수 배지만 갱신/.test(adminJs),
  '캐시 히트 경로에서 배지 갱신이 없음');
const hitBlock = /if\(_cached&&Date\.now\(\)-_cached\.ts<_VM_CACHE_TTL\)\{[\s\S]*?return;/.exec(adminJs);
ok(hitBlock && !/_vmCacheSync\(\)/.test(hitBlock[0]),
  '캐시 히트 경로에서 _vmCacheSync를 부름 — ts가 갱신돼 재조회가 영영 안 됨');

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
  ok(/if\(!confirm\(/.test(b), 'confirm 미리보기 단계가 없음');
  ok(/console\.log\(`\[숨김 재판정\]/.test(b), '표본을 콘솔에 안 찍음(사전 확인 불가)');
  ok(/if\(ng===v\.group_ko\)\{same\+\+;continue;\}/.test(b), '판정이 같은 행을 손대고 있음');
  // 무매칭은 '무관'이 아니라 '보류'로 — 매처가 못 잡는 것과 우주 밖인 것은 다르다.
  ok(/content_flag:'보류'|_flagPatch\('보류',/.test(b), '무매칭분을 보류로 안 보냄');
  ok(!/content_flag:'무관'/.test(b), '무매칭분을 무관으로 밀고 있음 — 실존 그룹이 섞여 있어 영영 안 보이게 됨');
  ok(/content_flag:null|_flagPatch\(null,/.test(b), '재배정 시 숨김 해제를 안 함');
}
// 기존 오태깅 재배정 버튼과 판정 보조 함수가 갈라지지 않았는지(문자열 동일성으로 확인)
const norm = /const _norm=t=>' '\+\(t\|\|''\)\.toUpperCase\(\)\.replace\(\/\[\^가-힣A-Z0-9\]\/g,' '\)\.replace\(\/\\s\+\/g,' '\)\+' ';/g;
ok((adminJs.match(norm) || []).length === 2, '_norm 구현이 두 스윕에서 서로 다름(판정이 갈라짐)');

console.log(`vm-panel-ui: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
