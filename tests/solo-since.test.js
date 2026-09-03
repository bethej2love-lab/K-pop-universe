// 탈퇴 후 솔로 재귀속(_soloReattribGko) 회귀 테스트 (2026-09-03 신설)
//
// 왜: 그룹을 떠난 뒤의 솔로 활동 영상이 옛 그룹에 붙어 있는 문제(우즈·원호·에반). artists.json의
// `soloSince`가 명단이고, 이 헬퍼가 "그 날짜 이후 + 그 사람 단독 → group_ko는 본인 이름"을 판정한다.
//
// ⚠️ 자동 판정(탈퇴하면 솔로로 간주)은 **불가능하다는 걸 실측으로 확인했다**(2026-09-03):
//    "탈퇴+단일소속+생존+이름고유" 181명 자동 스윕이 75건 중 41건을 "바로"(비원에이포, 한국어 부사
//    "지금 바로 댓글로")로 잡았고, 강한 근거만 남겨도 미등록 신인 그룹의 동명이인이 대부분이었다.
//    그래서 `soloSince`는 **사람이 확정해 넣는 값**이고, 이 테스트는 그 전제 위에서 판정 로직만 본다.
//
// 실행: node tests/solo-since.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const sharedSrc = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');

// 실제 배포 코드를 그대로 실행한다(로직을 베껴 쓰면 조용히 어긋난다).
const mod = { exports: {} };
new Function('module', 'GROUPS', 'ARTISTS',
  sharedSrc + '\nmodule.exports={_soloReattribGko,_ytGroupKoFor};'
)(mod, GROUPS, ARTISTS);
const { _soloReattribGko } = mod.exports;

let pass = 0, fail = 0;
function t(name, got, expected) {
  const okv = got === expected;
  if (okv) { pass++; console.log(`✅ ${name}`); }
  else { fail++; console.log(`❌ ${name}\n   기대=${JSON.stringify(expected)} 실제=${JSON.stringify(got)}`); }
}

const find = n => ARTISTS.find(a => a.name && a.name.ko === n);
const 우즈 = find('우즈'), 원호 = find('원호');

// ── 전제 ──────────────────────────────────────────────────────────────────
t('전제 — 우즈에 soloSince가 있다', !!(우즈 && 우즈.soloSince), true);
t('전제 — 원호에 soloSince가 있다', !!(원호 && 원호.soloSince), true);

// ── 기본 동작 ─────────────────────────────────────────────────────────────
t('탈퇴 이후 단독 출연 → 본인 이름으로', _soloReattribGko('엑스원', ['우즈'], '2023-05-01'), '우즈');
t('탈퇴 이전 영상은 그대로(옛 그룹 콘텐츠가 맞음)', _soloReattribGko('엑스원', ['우즈'], '2019-08-01'), null);
t('경계일 당일은 포함', _soloReattribGko('엑스원', ['우즈'], 우즈.soloSince), '우즈');
t('원호도 같은 규칙', _soloReattribGko('몬스타엑스', ['원호'], '2021-09-01'), '원호');

// ── 안전장치 ──────────────────────────────────────────────────────────────
t('여러 명이 함께 나오면 안 옮김(그룹 콘텐츠일 수 있음)', _soloReattribGko('엑스원', ['우즈', '김요한'], '2023-05-01'), null);
t('멤버가 안 잡힌 영상은 안 옮김', _soloReattribGko('엑스원', [], '2023-05-01'), null);
t('그 사람 소속이 아닌 그룹 행은 안 건드림', _soloReattribGko('세븐틴', ['우즈'], '2023-05-01'), null);
t('soloSince 없는 사람은 대상 아님', _soloReattribGko('세븐틴', ['호시'], '2023-05-01'), null);
t('발행일이 없으면 판단 보류', _soloReattribGko('엑스원', ['우즈'], ''), null);
t('이미 본인 이름이 키인 솔로(아이유)는 대상 아님', _soloReattribGko('솔로', ['아이유'], '2023-05-01'), null);

// ── 명단이 데이터라는 것 자체를 못 박는다 ─────────────────────────────────
// (코드에 이름을 하드코딩하면 동기화와 스윕이 서로 다른 명단을 보게 된다)
const soloList = ARTISTS.filter(a => a.soloSince).map(a => a.name.ko);
t('soloSince 보유자가 1명 이상', soloList.length > 0, true);
console.log(`   (참고) 현재 명단: ${soloList.join(', ')}`);
const adminSrc = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
t('admin.js가 명단을 하드코딩하지 않고 soloSince를 읽는다', /a\.soloSince/.test(adminSrc), true);
t('동기화 경로가 _soloReattribGko를 부른다', /_soloReattribGko\(match\.primaryGroup/.test(adminSrc), true);

console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
