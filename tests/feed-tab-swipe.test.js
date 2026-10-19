// 모바일 나침반 For You ↔ 발견 스와이프의 최소 계약 검사.
// 브라우저가 없는 CI에서도 제스처 방향·예외 대상이 지워지는 회귀를 잡는다.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
function fail(message) { pass = false; console.log(`❌ ${message}`); }
function ok(message) { console.log(`✅ ${message}`); }

const start = html.indexOf('function _wireFeedTabSwipe(body){');
const end = html.indexOf('\n// 모바일: 카드', start);
const source = start >= 0 && end > start ? html.slice(start, end) : '';
if (!source) {
  fail('모바일 피드 탭 스와이프 함수가 없음');
} else {
  /!isMob\(\)/.test(source) ? ok('모바일에서만 동작') : fail('데스크톱에서도 스와이프를 가로챌 수 있음');
  /\.hscroll-drag/.test(source) ? ok('가로 카드 선반은 제외') : fail('가로 카드 선반 스크롤과 충돌할 수 있음');
  /Math\.abs\(dx\)<56/.test(source) && /Math\.abs\(dx\)<=Math\.abs\(dy\)\*1\.25/.test(source)
    ? ok('짧은·세로 움직임은 탭 전환으로 오해하지 않음') : fail('스와이프 방향/거리 문턱이 없음');
  /dx<0&&isRec\)_feedSwitchTab\('disc'\)/.test(source)
    ? ok('For You에서 왼쪽 스와이프 → 발견') : fail('For You → 발견 방향이 없음');
  /dx>0&&!isRec\)_feedSwitchTab\('rec'\)/.test(source)
    ? ok('발견에서 오른쪽 스와이프 → For You') : fail('발견 → For You 방향이 없음');
}

if (!/_wireFeedTabSwipe\(document\.getElementById\('feed-body'\)\)/.test(html)) fail('피드를 열 때 스와이프가 연결되지 않음');
else ok('피드 첫 열기 때 스와이프 연결');

if (!pass) process.exit(1);
console.log('\n✅ 모바일 피드 탭 스와이프 계약 통과');
