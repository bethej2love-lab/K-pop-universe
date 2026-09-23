// 외부 채널 동기화 — held(미지 그룹) 행이 group_ko:null로 INSERT되어 배치 전체가 죽던 사고 (2026-09-23)
//
// _extBuildRows가 "] 뒤 미지 그룹"(match.hold) 행에 group_ko:null을 넣고 있었는데, yt_channel_videos.
// group_ko는 NOT NULL 컬럼이라 이 INSERT 자체가 매번 예외 없이 실패했다. 배치 insert가 한 행이라도
// 실패하면 전체가 롤백되고, 실패한 채널은 체크포인트도 못 전진해 그 시점에 held 영상을 하나라도 물면
// 그 채널이 영구 정지했다(인기가요·쇼음악중심이 각각 9/13·9/12에서 멈춰있던 원인, 사용자가 GitHub
// Actions 로그의 "null value in column group_ko" 에러 다발을 제보해 발견).
//
// _extBuildRows는 admin.js 내부의 다른 많은 헬퍼(_m2ParseTitle·_coverResolve·_normalizeMemberTags 등)에
// 의존해 tools/matcher_harness.cjs처럼 통째로 슬라이스해 실행하기엔 무겁다 — 그래서 실행 대신 소스
// 패턴으로 "null을 다시 넣는 회귀"를 잠근다(이 프로젝트의 다른 다수 테스트와 같은 방식).
const fs = require('fs');
const path = require('path');
const adminJs = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

ok(!/held\?null:/.test(adminJs),
  'held 행에 group_ko:null을 다시 넣고 있음 — NOT NULL 위반으로 배치 전체가 죽는 사고 재발');
ok(/held\?handle:/.test(adminJs),
  'held 행이 채널 handle을 group_ko로 안 씀(non-null 보장 + 검수 조회 가능해야 함)');
// 채널 handle은 항상 넘어오는 값이어야 한다 — 정의부를 뺀 실제 호출부 전부 ch.handle로 끝나는지 확인
// (중첩 괄호 때문에 정규식으로 인자 목록 전체를 안전하게 못 잘라내므로, "그 줄에 ch.handle)"이
// 있는가"로 느슨하게 확인 — 이 정도로도 인자를 통째로 빼먹는 실수는 잡힌다).
const callLines = adminJs.split('\n').filter(l => l.includes('_extBuildRows(') && !l.includes('function _extBuildRows('));
ok(callLines.length >= 3, `_extBuildRows 실제 호출부가 3곳 이상이어야 함(현재 ${callLines.length}) — 새 호출부가 생겼으면 handle 전달 확인 필요`);
ok(callLines.every(l => /ch\.handle\)/.test(l)),
  '_extBuildRows 호출부 중 ch.handle을 안 넘기는 곳이 있음 — held 행의 group_ko가 undefined가 될 수 있음');

console.log(`\next-sync-held-groupko: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
