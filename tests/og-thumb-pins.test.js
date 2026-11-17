// 정적 프로필 커버 핀(2026-11-17 Codex 검수) — 타인·단체·공항 표지로 잡힌 17명을 본인 직캠으로 고정했고,
// 주간 재생성(build_og_thumbs.mjs)이 핀을 마지막에 얹어도 og_thumbs.json과 핀이 일치해야 한다.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const R = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'));
const pin = R('og_thumbs_pin.json').members, og = R('og_thumbs.json'), m = og.members || og;
// 알려진 잘못된 원본(타인/단체/공항) — 어떤 핀 대상에도 다시 들어오면 안 된다.
const BAD = { '방탄소년단|정국': '-YCex08v-UQ', '방탄소년단|슈가': 'Zv6JKobJyFY', '스트레이키즈|아이엔': 'hmTVGjs1Y3A', '블랙핑크|리사': 'FNhFuWaBNHw', '방탄소년단|알엠': 'cf7Ql5Wgdjg', '방탄소년단|지민': 'WM6V-ZkdbiY', '블랙핑크|로제': '_4FmrGhZhIY', '방탄소년단|진': 'zr_RUOXAqh0', '빅스|엔': 'BQ7slE7idP0', '이븐|이정현': 'YHVB2SG0Db0', '세븐틴|정한': 'FSVWFnQ5mbU', '세븐틴|원우': 'FSVWFnQ5mbU', '온앤오프|이션': '3HRaxmDs5RY', '데일리디렉션|EN KIM': 'B8TPi9tJlX4', '세븐틴|우지': 'hCGu1W3uIwo', '라이즈|소희': 'WU1n12hctB8', '솔로|민규': 'hCGu1W3uIwo' };
let fail = 0;
for (const [k, bad] of Object.entries(BAD)) {
  if (!pin[k]) { console.error('FAIL 핀 없음', k); fail++; continue; }
  if (pin[k].includes(bad)) { console.error('FAIL 핀이 잘못된 원본', k); fail++; }
  if (m[k] !== pin[k]) { console.error('FAIL og_thumbs.json이 핀과 다름', k); fail++; }
}
assert.equal(fail, 0);
console.log('✅ og_thumbs 핀 17명: 핀 존재·잘못된 원본 아님·og_thumbs.json과 일치');
