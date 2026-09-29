// "함께한" 그룹 접기 전수 테스트 (2026-09-29)
//
// 사용자 제보: 빅톤 전원이 함께한 영상이 "빅톤"이 아니라 멤버 6명 이름으로 나열됐다. 원인은 멤버를 **주 소속**으로
// 묶던 것 — 해체 그룹은 주 소속이 전부 '솔로'로, 이적·겸임 멤버는 다른 그룹으로 바뀌어 있어서 그룹명으로 안 접혔다.
// 옛 로직으로 재현하면 283개 그룹 중 **69개**(여자친구·아이즈원·워너원·엔시티 127 …)가 전원 태깅돼도 안 접혔다.
//
// 이 테스트는 표본이 아니라 **groups.json 전 그룹**을 돈다: "그 그룹 비교 로스터 전원을 이름(그룹)으로 태깅하면
// 전원 같은 그룹으로 묶이고, 전원 출연으로 판정되는가". 데이터에 해체·이적·겸임이 새로 생겨도 여기서 먼저 걸린다.
// 실행: node tests/with-group-collapse.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const shared = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

const a = src.indexOf('function _withGroupOf(');
const b = src.indexOf('function _makeWithLine(');
if (a < 0 || b < 0) { console.log('❌ _withGroupOf/_withIsFullGroup 블록을 못 찾음'); process.exit(1); }
const agSrc = (shared.match(/function _artistGroups\([^)]*\)\{[^\n]*\}/) || [])[0];
if (!agSrc) { console.log('❌ shared.js _artistGroups를 못 찾음'); process.exit(1); }
const H = new Function('GROUPS', 'ARTISTS', agSrc + '\n' + src.slice(a, b) +
  '\nreturn {_withGroupOf,_withCompareRoster,_withIsFullGroup};')(GROUPS, ARTISTS);

let pass = true, n = 0;
const bad = [];
for (const g of Object.keys(GROUPS)) {
  const r = H._withCompareRoster(g);
  if (r.length < 2) continue;
  n++;
  const grouped = r.map(t => H._withGroupOf(`${t.name.ko}(${g})`, t, '__anchor__'));
  const wrong = r.filter((t, i) => grouped[i] !== g);
  if (wrong.length) { bad.push(`${g}: ${wrong.map(t => t.name.ko + '→' + H._withGroupOf(`${t.name.ko}(${g})`, t, '__anchor__')).join(', ')}`); continue; }
  if (!H._withIsFullGroup(g, r)) bad.push(`${g}: 전원 태깅인데 전원 출연 판정 실패`);
  // 한 명 빠지면 전원이 아니어야 한다(과잉 접기 방지)
  if (H._withIsFullGroup(g, r.slice(1))) bad.push(`${g}: 한 명 빠졌는데도 전원 판정`);
}
if (bad.length) { pass = false; bad.slice(0, 30).forEach(x => console.log('❌ ' + x)); }
// 대표 사례 고정
const vicR = H._withCompareRoster('빅톤').map(t => t.name.ko).sort();
const vicOk = vicR.length >= 6 && H._withIsFullGroup('빅톤', H._withCompareRoster('빅톤'));
console.log(`${vicOk ? '✅' : '❌'} 빅톤(해체) 비교 로스터 ${vicR.length}명 · 전원 판정 ${vicOk}`);
if (!vicOk) pass = false;
console.log(pass ? `\n🎉 함께한 그룹 접기 전수 테스트 통과 (${n}개 그룹)` : `\n❌ 함께한 그룹 접기 전수 테스트 실패 (${bad.length}/${n})`);
process.exit(pass ? 0 : 1);
