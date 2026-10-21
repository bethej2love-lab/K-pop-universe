const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const {routineLogResult} = require('../tools/routine_log_result.cjs');
function documentFor(rows) { return {getElementById: () => ({children: rows.map(textContent => ({textContent})), innerText: rows.join('')})}; }
const rows = ['✅ 4. 동명이인 정리\n   완료!', '❌ 5. 원곡 태깅 v2\n   조회 실패: canceling statement due to statement timeout', '✅ 6. 음방 수집\n   완료!'];
const doc = documentFor(rows);
assert.equal((doc.getElementById().innerText.match(/^❌/gm) || []).length, 0, '기존 false-green 모양 재현');
const result = routineLogResult(doc);
assert.equal(result.failedSteps, 1);
assert(result.hasLog && result.summary.includes('\n❌ 5.'));
assert.equal(routineLogResult(documentFor(['✅ 1. 완료\n   5개 일시 실패(다음에 재시도)'])).failedSteps, 0);
assert.equal(routineLogResult(documentFor(['❌ 1. 실패', '❌ 2. 실패'])).failedSteps, 2);
assert.equal(routineLogResult(documentFor(['■ 사용자가 중단함'])).failedSteps, 1);
assert.equal(routineLogResult(documentFor([])).hasLog, false);
assert.equal(routineLogResult({getElementById: () => null}).hasLog, false);
// 실제 러너가 쓰는 직렬화 경로도 검증(외부 closure 참조 금지).
assert.equal(vm.runInNewContext(`(${routineLogResult.toString()})(document)`, {document: doc}).failedSteps, 1);
const runner = fs.readFileSync(path.join(__dirname, '../tools/run_daily_routine.cjs'), 'utf8');
assert.equal((runner.match(/routineLogResult\.toString\(\)/g) || []).length, 2, '일일·청소 양쪽 진입점');
assert(!runner.includes('summary.match(/^❌/gm)'), 'CSS 의존 판정 복귀 금지');
console.log('PASS routine log: glued rows, failures, retry text, stop, missing log and both runner paths');
