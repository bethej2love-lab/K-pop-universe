// 조회수 마일스톤 감지 로직 회귀 테스트 (2026-09-23 신설)
// _vmCrossedTiers는 admin.js 상단부(다른 헬퍼 의존 없음)라 그대로 슬라이스해서 실행한다.
const fs = require('fs');
const path = require('path');
const adminSrc = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');

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
  extractStatement(adminSrc, /^const _VM_TIERS\s*=/m, '_VM_TIERS'),
  extractStatement(adminSrc, /^const _VM_TROPHY_MIN\s*=/m, '_VM_TROPHY_MIN'),
  extractByBraces(adminSrc, /^function _vmCrossedTiers\(/m, '_vmCrossedTiers'),
].join('\n');
const fn = new Function(`${pieces}\nreturn {_VM_TIERS,_VM_TROPHY_MIN,_vmCrossedTiers};`);
const { _VM_TIERS, _VM_TROPHY_MIN, _vmCrossedTiers } = fn();

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

console.log(`\nview-milestones: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
