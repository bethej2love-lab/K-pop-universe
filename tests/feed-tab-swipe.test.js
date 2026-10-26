// 모바일 나침반 For You ↔ 발견 스와이프의 최소 계약 검사.
// 브라우저가 없는 CI에서도 제스처 방향·예외 대상이 지워지는 회귀를 잡는다.
// 2026-10-23 X식 가로 페이징: 손을 뗀 뒤 넘기던 것 → 가로로 정해지는 순간부터 두 화면·밑줄이 손가락을 따라온다.

const fs = require('fs');
const path = require('path');

const html = require('../tools/index_source.cjs').readIndexSource();
const css = fs.readFileSync(path.join(__dirname, '..', 'kpop_universe.css'), 'utf8');
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
  source.includes("axis=Math.abs(dx)>Math.abs(dy)*1.25?'x':'y'") && source.includes('Math.abs(dx)<8&&Math.abs(dy)<8')
    ? ok('짧은·세로 움직임은 탭 전환으로 오해하지 않음(처음 8px로 방향 한 번 결정)') : fail('스와이프 방향/거리 문턱이 없음');
  source.includes('_feedTabPos(curP(dx),false)') && source.includes('passive:false')
    ? ok('가로로 끄는 동안 두 화면·인디케이터가 손가락을 따라감') : fail('끄는 동안 실시간으로 안 따라감(손 뗀 뒤 전환)');
  source.includes('target=v<0?1:0') && source.includes('curP(dx)>0.5?1:0')
    ? ok('손 떼면 튕김 방향 또는 절반 기준으로 넘어감/제자리') : fail('놓았을 때 판정이 없음');
  source.includes("_feedSwitchTab(target?'disc':'rec')")
    ? ok('넘어가면 탭 전환 함수로(밑줄·지연 로드 공통)') : fail('탭 전환 경로가 없음');
}

/<i id="feed-tab-ind"/.test(html) && /#feed-tab-ind\{/.test(css)
  ? ok('밑줄 인디케이터가 하나(두 탭 사이를 미끄러짐)') : fail('미끄러지는 인디케이터가 없음');
/_feedTabPos\(rec\?0:1,!silent\)/.test(html)
  ? ok('탭 클릭도 같은 위치 함수로 애니메이션') : fail('탭 클릭 경로가 인디케이터를 안 움직임');

if (!/_wireFeedTabSwipe\(document\.getElementById\('feed-body'\)\)/.test(html)) fail('피드를 열 때 스와이프가 연결되지 않음');
else ok('피드 첫 열기 때 스와이프 연결');

if (!pass) process.exit(1);
console.log('\n✅ 모바일 피드 탭 스와이프 계약 통과');
