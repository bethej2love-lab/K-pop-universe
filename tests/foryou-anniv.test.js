// For You "다가오는 기념일" 회귀 하네스 (2026-09-05 신설)
//
// 즐겨찾기한 그룹 데뷔기념일 + 멤버 생일이 일주일 안(D-7~D-DAY)이면 For You 최상단에 미리 띄운다.
// Date.now가 매번 달라 정확한 D값은 런타임 단언이 어려우므로, 구조 불변식을 문자열로 동결한다
// (누가 즐겨찾기 필터를 빼거나, 창(7일)을 없애거나, 배선을 지우면 배포 전에 실패).
//
// 실행: node tests/foryou-anniv.test.js

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

console.log('\n── For You 다가오는 기념일 ──');
// DOM + 배선
ck(/id="feed-foryou-anniv-section"/.test(html) && /id="feed-foryou-anniv"/.test(html), 'For You에 다가오는-기념일 섹션 DOM 존재');
ck(/_buildFeedForYouAnniv\(\)/.test(html), '_buildFeedForYouAnniv 호출 존재(_buildFeedRec에서)');
// _buildFeedRec가 이 빌더를 부르는지(For You 탭 진입 시 실행 보장)
const rec = extractBraces(html, /^function _buildFeedRec\(/m, '_buildFeedRec');
ck(/_buildFeedForYouAnniv\(\)/.test(rec), '_buildFeedRec가 다가오는-기념일 빌더를 호출');

// 빌더 불변식
const fn = extractBraces(html, /^function _buildFeedForYouAnniv\(/m, '_buildFeedForYouAnniv');
// 2026-09-18: 대상을 **교차**로 넓혔다. 예전엔 데뷔기념일=favGroups만 / 생일=favMembers만이라,
// 그룹 하나만 즐겨찾기한 사람은 이 선반을 1년에 딱 한 번(그 그룹 데뷔일) 봤다(사용자 제보
// "투데이 애니버서리가 안 보인다"). 아래 세 줄이 그 교차를 지킨다 — 좁히면 같은 증상이 돌아온다.
ck(/const annivGkos=new Set\(favGroups\)/.test(fn), '데뷔기념일 대상에 즐겨찾기 그룹 포함');
ck(/favMembers\.forEach\([\s\S]*?annivGkos\.add/.test(fn), '데뷔기념일 대상에 즐겨찾기 **멤버의 소속 그룹**도 포함');
ck(/annivGkos\.forEach/.test(fn), '넓힌 집합을 순회(favGroups.forEach로 되돌리지 말 것)');
ck(/favMembers\.has\(_mFavKey\(a\)\)/.test(fn), '즐겨찾기 멤버 본인은 그대로 포함(동명이인 키)');
ck(/favGroups\.has\(g\.ko\)&&!_isFormerOf\(a,g\.ko\)/.test(fn),
   '생일 대상에 즐겨찾기 **그룹의 멤버**도 포함하되 탈퇴/해체는 제외(_isFormerOf)');
// 고인이 된 멤버 6명은 전원 active:false라 _isFormerOf에 걸린다 — 그룹을 타고 들어오는 경로에서
// 생일 카드가 뜨지 않는다(직접 즐겨찾기한 경우는 본인 선택이라 그대로 둔다).
ck(/!direct&&_artistGroups\(a\)/.test(fn), '그룹 경유 판정은 직접 즐겨찾기가 아닐 때만(중복 카드 방지)');
ck(/_daysUntilBday\(info\.debut\)/.test(fn), '그룹은 데뷔일로 D-계산(_daysUntilBday(info.debut))');
ck(/_daysUntilBday\(a\.bday\)/.test(fn), '멤버는 생일로 D-계산(_daysUntilBday(a.bday))');
ck(/const WITHIN=7/.test(fn) && /d>WITHIN/.test(fn) && /d<0/.test(fn), '창=7일, 0..7 범위 밖은 제외');
ck(/hits\.sort\(\(x,y\)=>x\.d-y\.d\)/.test(fn), '임박순 정렬(D-DAY가 앞)');
ck(/section\.style\.display='none'/.test(fn), '해당 없으면 섹션 숨김(빈 줄 방지)');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ For You 다가오는 기념일 하네스 통과');
process.exit(fail ? 1 : 0);
