// groups-matcher.test.js — 등록된 그룹/멤버가 매처에서 정상 인식되는지 전수 확인 (2026-09-27 신설)
//
// 배경: 그룹·멤버 데이터를 추가할 때마다 매처 인식 여부를 손으로 확인해야 했는데,
// 이를 자동화해서 "추가 후 이 테스트 통과" = "동기화 준비 완료" 기준으로 삼는다.
//
// 실행: node tests/groups-matcher.test.js
// 옵션: --recent YYYY-MM-DD  → 그 날짜 이후 데뷔 그룹만 검사 (예: --recent 2024-01-01)
//       --group 그룹명       → 특정 그룹 하나만 검사 (예: --group 다이몬)
//
// 검사 항목:
//   1. "한국어그룹명 직캠" → 해당 그룹으로 잡혀야 함
//   2. "영문그룹명 fancam" → 해당 그룹으로 잡혀야 함  (단독 잡힘이 어려우면 경고)
//   3. "한국어그룹명 + 멤버명 + 직캠" → 해당 그룹으로 잡혀야 함

'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { _m2ParseTitle } = require(path.join(ROOT, 'tools/matcher_harness.cjs'));
const groups = require(path.join(ROOT, 'groups.json'));
const artists = require(path.join(ROOT, 'artists.json'));

// CLI 옵션
const args = process.argv.slice(2);
const recentIdx = args.indexOf('--recent');
const recentDate = recentIdx >= 0 ? args[recentIdx + 1] : null;
const groupIdx = args.indexOf('--group');
const onlyGroup = groupIdx >= 0 ? args[groupIdx + 1] : null;

// 결과 집계
const failures = [];
const warns = [];
let okCount = 0;

function check(label, input, expectedGroup, isWarnOnly = false) {
  const r = _m2ParseTitle(input, undefined, false);
  if (!r) {
    (isWarnOnly ? warns : failures).push(`${isWarnOnly ? '⚠️ ' : '❌'} [NULL] ${label}: "${input}" → null`);
    return false;
  }
  if (r.primaryGroup !== expectedGroup) {
    (isWarnOnly ? warns : failures).push(`${isWarnOnly ? '⚠️ ' : '❌'} [MISMATCH] ${label}: "${input}" → ${r.primaryGroup} (기대: ${expectedGroup})`);
    return false;
  }
  okCount++;
  return true;
}

// 검사 대상 그룹 필터링
const targetEntries = Object.entries(groups).filter(([ko, data]) => {
  if (typeof data !== 'object' || !data) return false;
  if (onlyGroup && ko !== onlyGroup) return false;
  if (recentDate && data.debut) {
    // debut 포맷: "YYYY.MM.DD"
    const d = data.debut.replace(/\./g, '-');
    if (d < recentDate) return false;
  }
  return true;
});

console.log(`검사 대상: ${targetEntries.length}개 그룹${recentDate ? ` (${recentDate} 이후 데뷔)` : ''}${onlyGroup ? ` [${onlyGroup}만]` : ''}\n`);

for (const [ko, data] of targetEntries) {
  const en = data.en || '';

  // 1. 한국어 그룹명
  check(`${ko}/KO`, `${ko} 직캠`, ko);

  // 2. 영문 그룹명 (null이면 경고만 — 한국어 그룹명이 없는 외국 채널 타이틀은 채널 기반으로만 매칭)
  if (en && en !== ko) {
    check(`${ko}/EN`, `${en} fancam`, ko, /*isWarnOnly=*/true);
  }

  // 3. 멤버별: "그룹명 + 멤버명 + 직캠"
  const members = artists.filter(a => a.group?.ko === ko);
  for (const m of members) {
    const mko = m.name?.ko;
    if (!mko || mko === '솔로') continue;
    check(`${ko}/${mko}`, `${ko} ${mko} 직캠`, ko);
  }
}

// 결과 출력
if (failures.length) {
  console.log('──── 실패 (수정 필요) ────');
  failures.forEach(f => console.log(f));
  console.log('');
}
if (warns.length) {
  console.log('──── 경고 (채널 기반으로만 매칭 — 영문명 단독 인식 불가) ────');
  warns.forEach(w => console.log(w));
  console.log('');
}

const total = okCount + failures.length + warns.length;
console.log(`결과: ✅ ${okCount} 통과  ❌ ${failures.length} 실패  ⚠️  ${warns.length} 경고  (총 ${total}건)`);
process.exit(failures.length > 0 ? 1 : 0);
