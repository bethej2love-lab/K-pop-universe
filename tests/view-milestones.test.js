// 조회수 마일스톤 감지 로직 회귀 테스트 (2026-09-23 신설, 2026-09-23 shared.js 이전 반영)
// _vmCrossedTiers 등은 admin.js(수집)·index.html(트로피 표시) 양쪽이 봐야 해서 shared.js로 옮겼다 —
// 다른 헬퍼 의존이 없어 그대로 슬라이스해서 실행한다.
const fs = require('fs');
const path = require('path');
const sharedSrc = fs.readFileSync(path.join(__dirname, '..', 'shared.js'), 'utf8');

function extractStatement(src, declStartRe, label) {
  const m = declStartRe.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  const start = m.index;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`[harness] 문장 끝(;)을 못 찾음: ${label}`);
}
function extractByBraces(src, declStartRe, label) {
  const m = declStartRe.exec(src);
  if (!m) throw new Error(`[harness] 선언을 못 찾음: ${label}`);
  const start = m.index;
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

const pieces = [
  extractStatement(sharedSrc, /^const _VM_TIERS\s*=/m, '_VM_TIERS'),
  extractStatement(sharedSrc, /^const _VM_TROPHY_MIN\s*=/m, '_VM_TROPHY_MIN'),
  extractByBraces(sharedSrc, /^function _vmCrossedTiers\(/m, '_vmCrossedTiers'),
  extractByBraces(sharedSrc, /^function _fmtViewMilestone\(/m, '_fmtViewMilestone'),
].join('\n');
// _fmtViewMilestone은 index.html 전역 currentLang을 본다 — 하네스에선 let으로 직접 흉내낸다.
const fn = new Function(`let currentLang='ko';\n${pieces}\nreturn {_VM_TIERS,_VM_TROPHY_MIN,_vmCrossedTiers,_fmtViewMilestone,setLang:v=>{currentLang=v;}};`);
const { _VM_TIERS, _VM_TROPHY_MIN, _vmCrossedTiers, _fmtViewMilestone, setLang } = fn();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

ok(_VM_TIERS[0] === 100000, '최저 티어가 10만이어야 함(작은 그룹도 의미 있는 지표)');
ok(_VM_TROPHY_MIN === 10000000 && _VM_TIERS.includes(_VM_TROPHY_MIN),
  '트로피 최소 티어가 티어 목록 안에 있어야 함');

ok(JSON.stringify(_vmCrossedTiers(null, 50000)) === '[]', '처음(baseline 없음) + 최저 티어 미만 → 크로싱 없음');
ok(JSON.stringify(_vmCrossedTiers(null, 100000)) === '[100000]', '처음이라도 이미 10만 이상이면 그 티어부터 기록');
ok(JSON.stringify(_vmCrossedTiers(1000000, 1200000)) === '[]', '이미 100만 넘은 건 120만이어도 새 크로싱 아님(다음 티어 300만 전)');
ok(JSON.stringify(_vmCrossedTiers(100000, 3500000)) === '[500000,1000000,3000000]',
  '순환 갱신 간격이 길어 여러 단계를 한 번에 건너뛰면 전부 기록해야 함(중간 단계 누락 방지)');
ok(JSON.stringify(_vmCrossedTiers(1000000000, 2000000000)) === '[]', '최고 티어(10억) 이상은 더 넘을 티어가 없음');
ok(JSON.stringify(_vmCrossedTiers(null, NaN)) === '[]', 'view_count를 못 읽은 경우(NaN) 크로싱 없음(오탐 방지)');

// _fmtViewMilestone — 스트림 마일스톤용 _fmtStreamMilestone(억/B 단위 전제)은 1억 미만 티어에서
// "0.1억"처럼 어색해지는 게 따로 만든 이유. 10만~5000만 구간이 "만" 단위로 안 어색한지 확인.
setLang('ko');
ok(_fmtViewMilestone(100000) === '10만+', '10만 → "10만+"(0.001억처럼 어색해지면 안 됨)');
ok(_fmtViewMilestone(10000000) === '1000만+', '1000만은 "0.1억+"가 아니라 "1000만+"이어야 함');
ok(_fmtViewMilestone(100000000) === '1억+', '1억부터는 억 단위로 전환');
setLang('en');
ok(_fmtViewMilestone(100000) === '100K+', '영문 10만 → "100K+"');
ok(_fmtViewMilestone(10000000) === '10M+', '영문 1000만 → "10M+"');
ok(_fmtViewMilestone(1000000000) === '1B+', '영문 10억 → "1B+"');

console.log(`\nview-milestones: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
