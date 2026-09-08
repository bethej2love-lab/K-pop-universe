// Discover "오늘의 기념일" 생일 카드 dim 판정 회귀 하네스 (2026-09-08 신설)
//
// 사용자 제보: "오늘 슈가 이하린 생일이라 Discover에 보이는데, 비활동 그룹이니까 흐리게 보여야
// 맞는 거 아닌가? 지금 전혀 안 흐림."
//
// 원인: 그룹 데뷔 항목은 `_groupIsOver`로 흐려지는데 **멤버 생일 항목은 `a.active===false`만** 봤다.
// 이하린은 `active:true` / `group.ko:'솔로'` / groups=[솔로, 슈가(active:false)]라 어디에도 안 걸린다.
//
// ⚠️ 이 테스트의 핵심은 "흐려지게 만들었다"가 아니라 **"어떻게 흐리면 안 되는지"** 를 못박는 것이다.
//    "소속 그룹이 전부 해체면 흐리게"로 바꾸면 375명이 흐려지고 거기에 청하·강다니엘·효린·권은비·
//    최예나·CL·현아·선미·산다라박·강타가 전부 들어간다(2026-09-08 실측). 데뷔연도로 좁혀도
//    (2010년 이전) CL·현아·선미·강타가 남는다. `active`는 "이 그룹 멤버인가"와 "개인이 아직
//    활동하는가"가 섞인 필드라 데이터만으로는 은퇴와 "해체 후 솔로로 활발"을 가를 수 없다.
//    그래서 판정 근거를 **실제 영상 활동**(최근 2년)으로 두고, 그 앞에 두 겹의 안전 게이트를 뒀다.
//    누가 이 게이트를 지우고 플래그만 보는 규칙으로 되돌리면 여기서 실패해야 한다.
//
// 실행: node tests/anniv-dim.test.js

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

console.log('\n── Discover 오늘의 기념일 · 생일 카드 dim ──');

// ── 1. 배선: 생일 항목이 활동 판정을 거치는가 ────────────────────────────────
const build = extractBraces(html, /^function _buildFeedAnniversaries\(/m, '_buildFeedAnniversaries');
ck(/if\(a\.active===false\)item\.classList\.add\('anniv-inactive'\)/.test(build),
  '기존 판정 유지: a.active===false면 즉시 dim');
ck(/_annivIsDormant\(a\)[\s\S]{0,120}anniv-inactive/.test(build),
  '생일 카드가 _annivIsDormant 결과로도 dim된다 (이게 이번 수정의 본체)');
ck(/_isGrpDisbanded\(ko\)\)item\.classList\.add\('anniv-inactive'\)/.test(build),
  '그룹 데뷔 항목은 기존대로 _isGrpDisbanded로 dim (같이 깨지지 않았는지)');

// ── 2. 게이트 ①: 활동 중인 그룹이 하나라도 있으면 판정 자체를 안 한다 ──────────
const over = extractBraces(html, /^function _annivAllGroupsOver\(/m, '_annivAllGroupsOver');
ck(/filter\(g=>g&&GROUPS\[g\.ko\]\)/.test(over),
  'GROUPS에 실재하는 그룹만 본다 (group.ko==="솔로" 같은 placeholder는 그룹으로 안 셈)');
ck(/if\(!gs\.length\)return false/.test(over),
  '⚠️ 실제 그룹이 하나도 없으면 false — 아이유·보아처럼 애초에 무소속인 사람을 흐리게 하지 않는다');
ck(/every\(g=>!_activeInGroup\(a,g\.ko\)\|\|_groupIsOver\(g\.ko\)\)/.test(over),
  '모든 소속이 (그 그룹에서 비활동 || 그룹 해체)일 때만 true — 하나라도 현역이면 false');

// ── 3. 게이트 ②: 실제 영상 활동으로 최종 판정 ────────────────────────────────
const dormant = extractBraces(html, /^async function _annivIsDormant\(/m, '_annivIsDormant');
ck(/if\(!sb\|\|!a\|\|!a\.name\|\|!_annivAllGroupsOver\(a\)\)return false/.test(dormant),
  '⚠️ _annivAllGroupsOver가 false면 DB 조회조차 안 하고 false — 현역 그룹 멤버는 절대 안 흐려진다');
ck(/_ANNIV_DORMANT_DAYS/.test(dormant) && /const _ANNIV_DORMANT_DAYS=730/.test(html),
  '휴면 기준은 상수 하나로(730일=2년)');
ck(/\.in\('group_ko',keys\)/.test(dormant) && /\.contains\('members',\[a\.name\.ko\]\)/.test(dormant),
  '⚠️ group_ko로 좁힌 뒤 members로 조회 — 안 좁히면 동명이인 영상이 섞여 "활동중"으로 오판한다');
ck(/_ytGroupKoFor\(a\)/.test(dormant),
  '솔로 재귀속분(group_ko=본인 이름)도 조회 키에 포함 — 빼면 솔로 활동이 통째로 안 보인다');
ck(/if\(error\)return false/.test(dormant),
  '⚠️ 조회 실패는 false(=밝게) — 잘못 흐리게 하느니 안 흐리게');
ck(/return \(count\|\|0\)===0/.test(dormant),
  '최근 2년 영상이 0건일 때만 휴면으로 본다');
ck(/_annivDormantCache/.test(dormant),
  '아티스트별 캐시(피드 재진입 때마다 재조회하지 않게)');

// ── 4. 되돌아가면 안 되는 규칙 ───────────────────────────────────────────────
// 플래그만으로 dim하는 규칙(그룹 해체 여부만 보고 멤버를 흐리게)이 다시 들어오면 여기서 잡는다.
ck(!/_groupIsOver\([^)]*\)\)item\.classList\.add\('anniv-inactive'\)[\s\S]{0,40}bdayHits/.test(build)
  && !/a\.groups[\s\S]{0,80}every[\s\S]{0,80}anniv-inactive/.test(build),
  '⚠️ 생일 카드를 "그룹 해체 여부"만으로 직접 dim하지 않는다 (청하·CL·선미 375명 오탐 방지)');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 생일 카드 dim 하네스 통과');
process.exit(fail ? 1 : 0);
