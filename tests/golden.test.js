// LEARNING_LOOP P2 — 골든셋 회귀 테스트 (2026-09-27)
//
// 사람이 승인한 매칭 케이스들을 golden.json에 고정해두고, 매번 현재 매처로 재검한다.
// 목적: 수동 편집 → 로직 수정 → "다음에 같은 오류 반복 금지" 사이클의 마지막 단계.
//
// 케이스 추가 방법:
//   tests/golden.json에 항목 추가 후 "node tests/golden.test.js" 통과 확인.
//
// golden.json 형식:
// [
//   {
//     "id": "고유ID(선택)",
//     "title": "영상 제목",
//     "selfGko": null,
//     "strict": false,
//     "published_at": null,
//     "expected": {
//       "primaryGroup": "그룹명",
//       "confidence": "strong",     // 생략 가능
//       "members": ["멤버1"]         // 생략 가능 — primaryGroup 멤버만 검증
//     }
//   }
// ]
//
// 실행: node tests/golden.test.js

const fs = require('fs');
const path = require('path');
const mod = { exports: require('../tools/matcher_harness.cjs') };
const { _m2ParseTitle } = mod.exports;

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden.json'), 'utf8'));

if (!cases.length) {
  console.log('golden.json이 비어 있습니다 — 승인된 케이스를 추가하세요.');
  process.exit(0);
}

let pass = 0, fail = 0;
for (const c of cases) {
  const r = _m2ParseTitle(c.title, c.selfGko || undefined, c.strict || false, c.published_at || undefined);
  const exp = c.expected || {};
  const errors = [];

  if ('primaryGroup' in exp) {
    const got = r?.primaryGroup ?? null;
    if (String(got) !== String(exp.primaryGroup ?? null)) errors.push(`primaryGroup: 기대 ${exp.primaryGroup} ← 매처 ${got}`);
  }
  if ('confidence' in exp && exp.confidence) {
    const got = r?.confidence ?? 'none';
    if (got !== exp.confidence) errors.push(`confidence: 기대 ${exp.confidence} ← 매처 ${got}`);
  }
  if (exp.members) {
    const gko = exp.primaryGroup || r?.primaryGroup;
    const got = (r?.membersByGroup?.[gko]) ?? [];
    const want = exp.members;
    const missing = want.filter(m => !got.includes(m));
    const extra = got.filter(m => !want.includes(m));
    if (missing.length || extra.length) {
      errors.push(`members: 기대 [${want.join(',')}] ← 매처 [${got.join(',')}]${missing.length ? ` (누락:${missing.join(',')})` : ''}${extra.length ? ` (추가:${extra.join(',')})` : ''}`);
    }
  }

  const label = c.id ? `[${c.id}] ${c.title}` : c.title;
  if (errors.length) {
    fail++;
    console.log(`❌ ${label}`);
    errors.forEach(e => console.log(`   ${e}`));
    if (r?.trace?.length) {
      const tr = r.trace.map(t => `${t.rule}(${t.token})→${t.effect}`).join(', ');
      console.log(`   trace: ${tr}`);
    }
  } else {
    pass++;
    console.log(`✅ ${label.slice(0, 80)}`);
  }
}

console.log(`\n${pass}/${pass + fail} 통과`);
if (fail) process.exit(1);
