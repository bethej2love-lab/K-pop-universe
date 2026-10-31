// 저장 이력 없는 폰 첫 방문: 안내의 실제 터치→검색→조합→검색 재진입→의도한 그룹→뒤로가기.
// 320/360/390/430px 배너 geometry. Linux Chrome 터치 에뮬레이션이며 실기기/iOS Safari 검증이 아니다.
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8991,CDP_PORT=9391;
const BROWSER=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]);const f=path.join(ROOT,p==='/'?'index.html':p);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map();
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}});ws.addEventListener('error',rej);});}
async function ev(c,x){const r=await c.send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}

const ARTIFACTS=process.env.KPU_BROWSER_ARTIFACT_DIR||path.join(os.tmpdir(),'kpu-first-visit-artifacts');
async function wait(c,expression,label,ms=15000){const until=Date.now()+ms;while(Date.now()<until){try{if(await ev(c,expression))return;}catch(_){}await sleep(200);}throw new Error(label+' 대기 초과');}
async function tap(c,selector){const p=await ev(c,`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('터치 대상 없음');const r=el.getBoundingClientRect();if(r.width<1||r.height<1)throw new Error('터치 대상 숨김');return{x:r.left+r.width/2,y:r.top+r.height/2};})()`);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
async function shot(c,name){fs.mkdirSync(ARTIFACTS,{recursive:true});const s=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(ARTIFACTS,name+'.png'),Buffer.from(s.data,'base64'));}
(async()=>{
 if(!BROWSER){console.log('⏭️ 브라우저 없음');process.exit(0);}server.listen(PORT);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-first-'));
 const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${profile}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=390,844','about:blank'],{stdio:['ignore','ignore','pipe']});let c;
 try{
  await waitForBrowserCdp(proc,CDP_PORT);const{webSocketDebuggerUrl}=await(await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();c=await conn(webSocketDebuggerUrl);
  await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');await c.send('Network.setCacheDisabled',{cacheDisabled:true});await c.send('Network.setBypassServiceWorker',{bypass:true});
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/`});
  await wait(c,`document.getElementById('ob-tips')?.classList.contains('show')&&document.getElementById('ob-tips-next')?.offsetWidth>0`,'첫 방문 안내',40000);
  await ev(c,`window.__firstVisitRaycasts=0;const _testRay=raycaster.setFromCamera.bind(raycaster);raycaster.setFromCamera=(...args)=>{window.__firstVisitRaycasts++;return _testRay(...args)};true`);
  await tap(c,'#ob-tips-next');await wait(c,`document.getElementById('msheet').classList.contains('open')&&document.getElementById('ob-tips').hidden`,'찾아보기 검색 전환');
  const opened=await ev(c,`({rays:window.__firstVisitRaycasts,group:_openGCko||null,member:_openTArtist?.name?.ko||null})`);
  if(opened.rays===0&&!opened.group&&!opened.member)ok('찾아보기 실제 터치가 배경 행성/무관한 카드를 열지 않음');else bad('찾아보기 배경 반응 '+JSON.stringify(opened));
  await shot(c,'first-search-390');
  for(const width of [320,360,390,430]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);
   const m=await ev(c,`(()=>{const el=document.querySelector('#msheet-body .combo-entry'),p=el.parentElement,b=el.getBoundingClientRect(),r=p.getBoundingClientRect();return{width:innerWidth,banner:b.width,left:b.left-r.left,right:r.right-b.right,overflow:p.scrollWidth-p.clientWidth};})()`);
   if(Math.abs(m.left-16)<=1&&Math.abs(m.right-16)<=1&&m.overflow<=1)ok('배너 '+width+'px 좌우16px·가로 넘침 없음');else bad('배너 폭 '+JSON.stringify(m));
  }
  await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);
  await tap(c,'#msheet-body .combo-entry');await wait(c,`document.getElementById('combo-overlay').classList.contains('open')`,'조합 열기');
  if(await ev(c,`!document.getElementById('msheet').classList.contains('open')`))ok('조합 진입 때 검색창 정상 종료');else bad('조합 밑 검색창이 열린 채 남음');
  await tap(c,'#combo-close');await tap(c,'#tab-search');
  await wait(c,`document.getElementById('msheet').classList.contains('open')&&document.querySelector('#msheet-body .combo-entry')`,'검색 다시 열기');
  const visible=await ev(c,`getComputedStyle(document.getElementById('msheet-body')).display!=='none'&&document.querySelector('#msheet-body .combo-entry').offsetWidth>0`);
  if(visible)ok('조합 닫기→검색 재진입 본문 표시');else bad('조합 뒤 검색이 빈 화면');
  await ev(c,`(()=>{const el=document.getElementById('msheet-input');el.value='에스파';el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await wait(c,`document.querySelector('#msheet-body .sr-item[data-type="group"]')?.textContent.includes('에스파')`,'그룹 검색 결과');
  await tap(c,'#msheet-body .sr-item[data-type="group"]');await wait(c,`_openGCko==='에스파'`,'선택한 그룹 카드');ok('에스파 검색 결과 터치→에스파 카드');
  const history=await c.send('Page.getNavigationHistory');if(history.currentIndex>0){await c.send('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex-1].id});await wait(c,`!_openGCko&&!_openTArtist`,'그룹 카드 뒤로가기');ok('브라우저 뒤로가기→선택 카드 닫힘');}else bad('그룹 카드에 뒤로가기 기록 없음');
  await shot(c,'after-browser-back');
 }catch(e){bad(e.message);if(c)try{await shot(c,'failure');}catch(_){}}
 finally{c?.close();try{proc.kill();}catch(_){}server.close();console.log(pass+' 통과 / '+fail+' 실패');process.exit(fail?1:0);}
})();
