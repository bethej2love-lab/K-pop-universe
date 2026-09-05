// "솔로" 표기 제거 회귀 하네스 (2026-09-05 신설)
//
// '솔로'는 서로 무관한 솔로 아티스트가 공유하는 데이터 placeholder(a.group.ko='솔로')일 뿐,
// 화면에 "솔로"라는 라벨로 절대 노출하지 않는다(사용자: "어디든 '솔로' 텍스트 빼라"). 표시 헬퍼
// _gLabel/_gLabelKo가 '솔로'면 빈 문자열을 반환하는지 고정한다(데이터 키는 그대로 둔다).
//
// 실행: node tests/solo-label.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

function extractBraces(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}

console.log('\n── "솔로" 표기 제거 ──');
// _gLabel 실행: '솔로' 객체는 빈 문자열, 일반 그룹은 이름 그대로
(() => {
  const gLabel = extractBraces(html, /^function _gLabel\(/m, '_gLabel');
  const api = new Function("var currentLang='ko';" + gLabel + '\nreturn {gl:_gLabel};')();
  ck(api.gl({ ko: '솔로', en: 'Solo' }) === '', "_gLabel({ko:'솔로'}) → '' (라벨 안 뜸)");
  ck(api.gl({ ko: '에스파', en: 'aespa' }) === '에스파', '_gLabel(일반 그룹) → 그룹명 그대로(비-솔로 영향 없음)');
  ck(api.gl(null) === '', '_gLabel(null) → 안전하게 ""');
})();
// _gLabelKo는 GROUPS/ARTISTS 의존이 많아 소스로 가드만 고정
const gLabelKo = extractBraces(html, /^function _gLabelKo\(/m, '_gLabelKo');
ck(/ko==='솔로'\)return ''/.test(gLabelKo), "_gLabelKo: ko==='솔로'면 '' 반환 가드 존재");
// 데이터 키는 그대로 — placeholder 자체는 남아야(조회/태그 키)
ck(/const _SOLO_GROUP=\{ko:'솔로'/.test(html), "_SOLO_GROUP placeholder(데이터 키)는 유지 — 표기만 뺀 것");

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ "솔로" 표기 제거 하네스 통과');
process.exit(fail ? 1 : 0);
