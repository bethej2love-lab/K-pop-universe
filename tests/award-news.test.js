// 이번 주 시상식 소식(2026-11-17): events.json 형식 + 앱 코드 연결(소스 검사). 실제 화면 확인은 tests/award-news-e2e.test.js.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('✅ '+m);}else{fail++;console.log('❌ '+m);}};
const ev=JSON.parse(fs.readFileSync(path.join(ROOT,'awards','events.json'),'utf8'));
ok(Array.isArray(ev.events)&&ev.events.length>=3,'events.json 회차 3개 이상');
ok(fs.statSync(path.join(ROOT,'awards','events.json')).size<20000,'events.json은 작다(앱이 매번 받는 파일, <20KB)');
ok(ev.events.every(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.start)&&/^\d{4}-\d{2}-\d{2}$/.test(e.end)&&e.start<=e.end),'모든 회차 날짜가 YYYY-MM-DD이고 start<=end');
ok(ev.events.every(e=>Array.isArray(e.kw)&&e.kw.length&&e.kw.every(k=>k.length>=5)),'영상 검색 키워드는 5자 이상(짧으면 오검색)');
const mma=ev.events.find(e=>e.id==='mma'&&e.edition==='2026');
ok(mma&&mma.top.length>=4&&mma.kw.includes('mma2026')&&fs.existsSync(path.join(ROOT,'awards','mma-2026.json')),'MMA 2026: 대상 요약·키워드·상세 파일');
ok(ev.events.every(e=>fs.existsSync(path.join(ROOT,'awards',e.id+'-'+e.edition+'.json'))),'events.json의 모든 회차에 상세 파일이 있다');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
ok(/function _renderNewsList\(list,items,awards\)/.test(app)&&/_appendNewsItems\(list,awards\.map/.test(app),'소식 목록이 시상식을 맨 앞에 붙인다');
ok(/_collectAwardNews\(\)/.test(app)&&/_renderNewsList\(list,items,awards\)/.test(app),'오늘의 소식 빌더가 시상식을 넘긴다');
ok(/_openAwardEv\(award\)/.test(app)&&/_awardFillDetail\(det,award\)/.test(app),'소식 줄에 수상 목록·무대 영상 버튼');
ok(!/\.order\('view_count'/.test(app.slice(app.indexOf('async function _openAwardEv'),app.indexOf('async function _openAwardEv')+3500)),'무대 영상 조회에 ORDER BY를 쓰지 않는다(정렬은 앱에서 — 타임아웃 방지)');
console.log(pass+' 통과 / '+fail+' 실패');process.exit(fail?1:0);
