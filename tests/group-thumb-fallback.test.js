// 앱 원형 프로필 마지막 폴백(_fetchGroupThumbs): 예능·출처 없는 '기타' 영상은 제외(2026-11-17 Codex 검수).
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const m = /const _groupThumbOk=[^\n]+;/.exec(src); assert(m, '_groupThumbOk 정의를 못 찾음');
const ok = vm.runInNewContext('(()=>{' + m[0] + ';return _groupThumbOk})()');
// 실제 사례(DB 행): 크나큰 김현종←나혼자산다(variety), 슈퍼노바←박보검 챌린지(other·출처없음), 티아라←옛 단체 무대(other·출처없음) 제외.
assert.equal(ok({ category: 'variety', source_handle: null }), false, '예능 제외');
assert.equal(ok({ category: 'other', source_handle: null }), false, '출처 없는 기타 제외');
assert.equal(ok({ category: 'other', source_handle: '크랙시' }), true, '자체 채널 기타는 유지');
assert.equal(ok({ category: 'live', source_handle: null }), true, '라이브 유지');
assert.equal(ok({ category: 'mv', source_handle: null }), true, 'MV 유지');
// _fetchGroupThumbs가 실제로 이 필터를 쓴다
const f0 = src.indexOf('function _fetchGroupThumbs('); const body = src.slice(f0, f0 + 1800);
assert(/_groupThumbOk\(v\)/.test(body) && /category,source_handle/.test(body), '_fetchGroupThumbs가 필터·컬럼을 써야 함');
console.log('✅ 그룹 폴백 썸네일: 예능·출처 없는 기타 제외, 자체 채널·라이브·MV 유지');
