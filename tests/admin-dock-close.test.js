// _admDockShow 회귀 — 도킹 패널 하나를 열면 나머지 3개가 닫힌다 (2026-09-01 신설)
// hnn 열린 채 vm 열면 vm이 밑에 깔리던 버그의 고정. admin.js에서 함수만 잘라 mock DOM으로 실행.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const m = src.match(/function _admDockShow\(id\)\{[\s\S]*?\n\}/);
if (!m) { console.error('✗ _admDockShow 함수를 admin.js에서 못 찾음'); process.exit(1); }

const IDS = ['adm-home-overlay', 'hnn-overlay', 'vm-overlay', 'gp-overlay'];
const els = {};
IDS.forEach(id => { const set = new Set(); els[id] = { classList: { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c) } }; });
global.document = { getElementById: id => els[id] || null };
eval(m[0]);
const open = id => els[id].classList.contains('open');

let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

_admDockShow('hnn-overlay');
ck(open('hnn-overlay'), 'hnn 열림');
_admDockShow('vm-overlay');
ck(open('vm-overlay'), 'vm 열림');
ck(!open('hnn-overlay'), 'vm 열면 hnn 닫힘(겹침 버그 고정)');
ck(!open('gp-overlay') && !open('adm-home-overlay'), '나머지(gp·home)도 닫힘');
// 다시 홈 열면 vm도 닫힘
_admDockShow('adm-home-overlay');
ck(open('adm-home-overlay') && !open('vm-overlay'), '홈 열면 vm 닫힘');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 도킹 상호배제 통과');
process.exit(fail ? 1 : 0);
