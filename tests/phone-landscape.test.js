// 폰 가로(844×390 터치) 배치 회귀 테스트 (2026-10-30 사용자 "모바일을 가로로 돌리면 막 겹친다 — 저번에 요청했는데 반영 안 됐다")
//  원인: 화면을 폭으로만 나눠(768 이하=폰, 1024 이상=웹) 폰 가로(폭 844)가 둘 사이에 걸려 PC·폰 배치가 섞였다.
//  ① 폰 판정: isMob()가 참이고 PC 전용 규칙(min-width:769px)이 꺼져 있다 — 탐험 패널이 화면 전체 폭
//  ② 재생 화면(가로 영상): 영상은 왼쪽, 제목은 그 오른쪽 — 둘이 겹치지 않고 둘 다 화면 안
//  ③ 쇼츠: 세로 영상과 제목이 겹치지 않고 제목이 화면 안(예전엔 위로 잘렸다)
//  ④ 세로 화면(390×844)은 예전 그대로 — 제목이 영상 아래
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저가 없으면 스킵.
// 배치 측정은 실제 클릭처럼 제목이 든 목록을 넘긴다. 제목을 DB에서 받기 전의 숨은 빈 요소를 제목 위치로 재지 않는다.
// 실행: node tests/phone-landscape.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8994,CDP_PORT=9394;
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
const RECT=`(id)=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom};}`;
const overlap=(a,b)=>a&&b&&a.x<b.r-1&&b.x<a.r-1&&a.y<b.b-1&&b.y<a.b-1;
const inView=(a,W,H)=>a&&a.w>0&&a.h>0&&a.x>=-1&&a.y>=-1&&a.r<=W+1&&a.b<=H+1;
async function setup(c,W,H){
  await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true,screenOrientation:W>H?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'},{name:'hover',value:'none'}]});
  await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});await sleep(8000);
  for(let i=0;i<30&&!(await ev(c,"typeof openLightbox==='function'&&typeof isMob==='function'"));i++)await sleep(400);
}
(async()=>{
  if(!BROWSER){console.log('⏭️  브라우저를 못 찾음 — 스킵');process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-land-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=844,390','about:blank'],{stdio:['ignore','ignore','pipe']});
  try{
    await waitForBrowserCdp(proc,CDP_PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    // ── 가로 ──
    await setup(c,844,390);
    ok(`가로 — 폰 판정 isMob()=${await ev(c,'isMob()')}`);if(!(await ev(c,'isMob()'))){pass--;bad('가로인데 isMob() 거짓');}
    await ev(c,"document.getElementById('tab-feed')?.click()");await sleep(1500);
    const fo=await ev(c,`(${RECT})('feed-overlay')`);
    if(fo&&fo.w>=830)ok(`탐험 패널 전체 폭(${Math.round(fo.w)}px)`);else bad('탐험 패널이 전체 폭이 아님 '+JSON.stringify(fo));
    await ev(c,"document.getElementById('tab-feed')?.click();typeof _closeFeedOverlay==='function'&&_closeFeedOverlay()");await sleep(600);
    await ev(c,"openLightbox('https://www.youtube.com/watch?v=koED8KSXfeo',false,[{u:'https://www.youtube.com/watch?v=koED8KSXfeo',t:'LAYOUT TEST — 가로 화면의 긴 영상 제목과 재생 영역이 겹치지 않아야 합니다',dur:230}],0)");await sleep(2500);
    let v=await ev(c,`(${RECT})('yt-lb-video-box')`),t=await ev(c,`(${RECT})('yt-lb-title-text')`);
    if(inView(v,844,390)&&inView(t,844,390)&&!overlap(v,t)&&t.x>=v.r)ok('가로 영상: 영상 왼쪽·제목 오른쪽, 겹침 없음');else bad('가로 영상 배치 '+JSON.stringify({v,t}));
    await ev(c,'closeLightbox()');await sleep(800);
    await ev(c,"openLightbox('https://youtube.com/shorts/EJqu6C_HFp0',true,[{u:'https://youtube.com/shorts/EJqu6C_HFp0',t:'LAYOUT TEST — 쇼츠의 긴 제목이 화면 안에 표시되어야 합니다',is_short:true,dur:30}],0)");await sleep(2500);
    v=await ev(c,`(${RECT})('yt-lb-video-box')`);t=await ev(c,`(${RECT})('yt-lb-title-text')`);
    if(inView(v,844,390)&&inView(t,844,390)&&!overlap(v,t))ok('쇼츠: 세로 영상·제목 둘 다 화면 안, 겹침 없음');else bad('쇼츠 배치 '+JSON.stringify({v,t}));
    await ev(c,'closeLightbox()');await sleep(500);
    // ── 세로(예전 그대로) ──
    await setup(c,390,844);
    await ev(c,"openLightbox('https://www.youtube.com/watch?v=koED8KSXfeo',false,[{u:'https://www.youtube.com/watch?v=koED8KSXfeo',t:'LAYOUT TEST — 가로 화면의 긴 영상 제목과 재생 영역이 겹치지 않아야 합니다',dur:230}],0)");await sleep(2500);
    v=await ev(c,`(${RECT})('yt-lb-video-box')`);t=await ev(c,`(${RECT})('yt-lb-title-text')`);
    if(v&&t&&t.y>=v.b-1)ok('세로 영상: 제목이 영상 아래(기존 배치 유지)');else bad('세로 배치가 바뀜 '+JSON.stringify({v,t}));
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{process.kill(proc.pid);}catch(e){}server.close();console.log(`\n${pass} 통과 / ${fail} 실패`);setTimeout(()=>process.exit(fail?1:0),300);}
})();
