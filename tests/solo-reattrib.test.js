// 탈퇴 후 솔로 재귀속(_soloReattribGko) 회귀 테스트 (2026-09-03 신설)
//
// 왜: 그룹을 떠난 뒤의 솔로 활동 영상이 옛 그룹에 붙어 있는 문제(우즈·원호·에반).
//
// ⚠️ **새 필드를 만들지 않는다.** 처음엔 `soloSince`를 추가했다가 같은 날 걷어냈다 — 이 프로젝트엔
//    이미 답이 있었다. 승한이 정확히 그 모양으로 돌아가고 있었고(`group_ko='승한'` 영상 295건):
//      group={ko:'솔로'}, groups=[{ko:'솔로'}, {ko:'라이즈', active:false, left:'2024.10.13'}]
//    그래서 "언제부터 솔로인가"는 별도 필드가 아니라 **그 사람의 그 그룹 탈퇴일**이다.
//
// 이 구조가 겸임과 탈퇴를 이미 구분한다:
//   · 겸임 = groups[] 항목에 left가 없다 (마크 = NCT 127 + NCT DREAM)
//   · 탈퇴 = groups[] 항목에 left가 있다 (승한의 라이즈)
//
// ⚠️ 자동 판정은 불가능하다(실측): "탈퇴+단일소속+생존+이름고유" 181명 자동 스윕이 75건 중 41건을
//    한국어 부사 "바로"(비원에이포)로 잡았고, 강한 근거만 남겨도 미등록 신인 그룹의 동명이인이
//    대부분이었다. 사람이 group.ko를 '솔로'로 바꾸는 것이 곧 확정 행위다.
//
// 실행: node tests/solo-reattrib.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

// 실제 배포 코드를 그대로 실행한다(로직을 베껴 쓰면 조용히 어긋난다).
const mod = { exports: {} };
new Function('module', 'GROUPS', 'ARTISTS',
  sharedSrc + '\nmodule.exports={_soloReattribGko,_ytGroupKoFor,_artistGroups};'
)(mod, GROUPS, ARTISTS);
const { _soloReattribGko } = mod.exports;

let pass = 0, fail = 0;
function t(name, got, expected) {
  if (got === expected) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name}\n   기대=${JSON.stringify(expected)} 실제=${JSON.stringify(got)}`); }
}
const find = n => ARTISTS.find(a => a.name && a.name.ko === n);
const isSoloShape = (a, oldGko) =>
  !!(a && a.group && !GROUPS[a.group.ko] && (a.groups || []).some(g => g && g.ko === oldGko && g.left));

// ── 전제: 데이터가 승한과 같은 모양인가 ───────────────────────────────────
t('전제 — 승한(선례)이 솔로 전향 구조다', isSoloShape(find('승한'), '라이즈'), true);
t('전제 — 우즈가 솔로 전향 구조다', isSoloShape(find('우즈'), '엑스원'), true);
t('전제 — 원호가 솔로 전향 구조다', isSoloShape(find('원호'), '몬스타엑스'), true);
t('전제 — 에반이 솔로 전향 구조다', isSoloShape(find('에반'), '엔하이픈'), true);

// ── 기본 동작 ─────────────────────────────────────────────────────────────
t('탈퇴 이후 단독 출연 → 본인 이름으로', _soloReattribGko('엑스원', ['우즈'], '2023-05-01'), '우즈');
t('탈퇴 이전 영상은 그대로(옛 그룹 콘텐츠가 맞음)', _soloReattribGko('엑스원', ['우즈'], '2019-08-01'), null);
t('경계일 당일은 포함', _soloReattribGko('엑스원', ['우즈'], '2020-01-06'), '우즈');
t('원호도 같은 규칙', _soloReattribGko('몬스타엑스', ['원호'], '2021-09-01'), '원호');
t('선례 승한도 같은 규칙으로 동작', _soloReattribGko('라이즈', ['승한'], '2025-06-01'), '승한');

// ── 안전장치 ──────────────────────────────────────────────────────────────
t('여러 명이 함께 나오면 안 옮김(그룹 콘텐츠일 수 있음)', _soloReattribGko('엑스원', ['우즈', '김요한'], '2023-05-01'), null);
t('멤버가 안 잡힌 영상은 안 옮김', _soloReattribGko('엑스원', [], '2023-05-01'), null);
t('그 사람 소속 이력이 없는 그룹 행은 안 건드림', _soloReattribGko('세븐틴', ['우즈'], '2023-05-01'), null);
t('현재 소속이 실존 그룹인 사람(호시)은 대상 아님', _soloReattribGko('세븐틴', ['호시'], '2023-05-01'), null);
t('발행일이 없으면 판단 보류', _soloReattribGko('엑스원', ['우즈'], ''), null);
t('원래부터 솔로(아이유)는 옛 소속이 없어 옮길 게 없음', _soloReattribGko('솔로', ['아이유'], '2023-05-01'), null);

// ── 겸임과 탈퇴가 구분되는가 ──────────────────────────────────────────────
// 마크는 NCT 127 + NCT DREAM 둘 다 **현재** 소속(left 없음) — 재귀속 대상이 절대 아니다.
t('겸임(마크)은 재귀속 대상이 아님 — NCT 127', _soloReattribGko('엔시티 127', ['마크'], '2025-01-01'), null);
t('겸임(마크)은 재귀속 대상이 아님 — NCT DREAM', _soloReattribGko('엔시티 드림', ['마크'], '2025-01-01'), null);

// ── 명단이 데이터라는 것 자체를 못 박는다 ─────────────────────────────────
// (코드에 이름을 하드코딩하면 동기화와 스윕이 서로 다른 명단을 보게 된다)
const soloList = ARTISTS.filter(a =>
  a.group && a.group.ko && !GROUPS[a.group.ko] && (a.groups || []).some(g => g && GROUPS[g.ko] && g.left)
).map(a => a.name.ko);
t('솔로 전향자 명단이 1명 이상', soloList.length > 0, true);
console.log(`   (참고) 현재 명단: ${soloList.join(', ')}`);
const adminSrc = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
t('admin.js가 이름을 하드코딩하지 않고 구조에서 파생한다', /GROUPS\[cur\]/.test(adminSrc), true);
t('동기화 경로가 _soloReattribGko를 부른다', /_soloReattribGko\(match\.primaryGroup/.test(adminSrc), true);
t('폐기된 soloSince 필드가 코드에 남아있지 않다',
  !/soloSince/.test(adminSrc) && !/soloSince/.test(sharedSrc), true);

console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
