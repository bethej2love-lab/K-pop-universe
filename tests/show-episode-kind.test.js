// 음방 회차 분류(shared.js _msKind) — 2026-11-04 Codex 검수102·113차 회귀 방지. 실제 제목(DB 원문)으로 고정한다.
// 회차에서 빼야 하는 것(MC 컷 모음·인생극장·직캠 모음집·직캠보고서 비하인드·MC TALK·MC석·수상소감)과
// 그대로 둬야 하는 무대·직캠(곡 이름이 TALK/Highlight인 무대, MC 고별 무대 직캠, 1위 앵콜)을 같이 본다.
// + app.js _openShowEp가 늦은 응답으로 닫힌/바뀐 목록을 다시 열지 않는지(목록 창 번호 확인) 원문 검사. 실행: node tests/show-episode-kind.test.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.join(__dirname,'..');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(ROOT,'shared.js'),'utf8')+';this._msKind=_msKind;',ctx);
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const cases=[
  // 빼야 하는 것(null)
  ['10월 4주 차 ＜윤영준 & 리안＞ 쇼챔 MC 컷 모음📁 | Show Champion | EP.615',null],
  ['[캔디샵] 인생극장 Yes or No 2편 l EP.4  #CandyShop #캔디샵 #쇼챔피언 #올더케이팝',null],
  ['[#최애ZIP캠📂] Stray Kids 필릭스 최애직캠 모음집 | CASE 143부터 This & That까지 | 쇼! 음악중심',null],
  ['[#직캠보고서🔍] #IVE #아이브 🚨긴급 속보🚨 음중의 평화를 지키기 위해, 히어로 아이브 출동! 👊 음중 사전녹화 비하인드⏯️',null],
  ['[MC TALK] MC째리뽀 ❤︎xikers 민재&FLARE U 립우❤︎ [THE SHOW] 260901 방송',null],
  ['[엠카운트다운] ✨MC 박건욱 X Special MC 성한빈✨ MC석 직캠 4K (PARK GUN WOOK X Special MC SUNG HAN MC Fan Cam) 260903',null],
  ['[쇼챔 1위] 8월 5주 챔피언송 ＜ENHYPEN (엔하이픈) - Bloody Paradise＞ 수상소감 Full ver.',null],
  // 그대로 둬야 하는 것
  ['[덕질캡처용♥CLEAN] CLOSE YOUR EYES (클로즈 유어 아이즈) - Open Your Eyes  l Show Champion l EP.614 l 261014','stage'],
  ["'최초 공개' ALLDAY PROJECT - TALK #엠카운트다운 EP.947 | Mnet 261001 방송",'stage'],
  ['[SPECIAL STAGE] ENHYPEN(엔하이픈) - Highlight l Show Champion l EP.611 l 260909','stage'],
  ['[#최애직캠] MC GYUVIN X DOHOON GYUVIN (엠씨 규빈 X 도훈 규빈) 굿바이 직캠 FanCam | 쇼! 음악중심 | MBC260822','fancam'],
  ['[쇼챔 1위] 9월 1주 챔피언송 ＜ ALPHA DRIVE ONE (알파드라이브원)- BORN DIRE ＞ 앵콜 Full ver.','encore'],
  ["[MPD직캠] 알파드라이브원 리오 직캠 4K 'Talk to me' (ALPHA DRIVE ONE LEO FanCam) | @MCOUNTDOWN_2026.10.22",'fancam'],
  ['[쇼챔원픽캠 4K] ENHYPEN(엔하이픈) 정원 - Highlight | Show Champion | EP.611 | 260909','fancam'],
  ["[안방1열 풀캠4K] 엠씨엔디 'Devil Youth Club' (MCND FullCam) @SBS Inkigayo 260913",'fullcam'],
  ["[페이스캠4K] 올데이 프로젝트 영서 'TALK' (ALLDAY PROJECT YOUNGSEO FaceCam) @SBS Inkigayo 261004",'facecam'],
];
for(const [t,want] of cases){const got=ctx._msKind(t);(got===want?ok:bad)(`${want===null?'제외':want} ← ${t.slice(0,60)}${got===want?'':' (실제 '+got+')'}`);}
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const fn=app.slice(app.indexOf('async function _openShowEp('),app.indexOf('async function _openShowEp(')+6000);
if(/const myIntent=_feedListIntent;/.test(fn)&&/const stale=myIntent!==_feedListIntent;/.test(fn)&&/if\(stale\)return;/.test(fn))ok('_openShowEp: 늦은 응답은 목록 창 번호가 같을 때만 그린다(104차)');else bad('_openShowEp 목록 창 번호 확인 없음');
if(/title_norm\.ilike\.\*\$\{x\}\*/.test(fn)&&/30\*864e5/.test(fn))ok('_openShowEp: 제목에 방송 날짜가 적힌 늦은 업로드를 30일까지 더 받는다(103차)');else bad('_openShowEp 늦은 업로드 보완 조회 없음');
console.log(`\n${pass} 통과 / ${fail} 실패`);if(fail)process.exitCode=1;
