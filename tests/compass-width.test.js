// 나침반 웹 홈 폭(2026-10-28 사용자 "폭 바뀌는 경우가 많잖아 카드·라이트박스 등 어떻게 열고 닫냐에 따라… 잘 확인") — 1400px 브라우저에서
// 나침반만 → 넓게(body.fw-home), 카드·재생 화면·목록 창이 하나라도 열리면 440, 닫으면 다시 넓게. 조합(카드+재생→재생만 닫기 등)과
// 폭이 바뀔 때 보던 자리 유지, 나침반 닫으면 해제까지. ⚠️ 실DB 브라우저 테스트 — CI 스킵 목록(browser). 실행: node tests/compass-width.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8999,CDP_PORT=9399;
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
(async()=>{
  if(!BROWSER){console.log("⏭️  브라우저를 못 찾음 — 스킵");process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-cw-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  try{
    await waitForBrowserCdp(proc,CDP_PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});
    for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,`typeof _openProgramCollection==='function'&&ARTISTS.length>0&&!!sb`))break;}catch(e){}}
    const r=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));
      const fo=document.getElementById('feed-overlay');
      const W=()=>({wide:document.body.classList.contains('fw-home'),w:Math.round(fo.getBoundingClientRect().width)});
      const res={};
      if(!fo.classList.contains('open'))_openFeedOverlay();await S(3000);
      res.feedOnly=W();
      showT(ARTISTS.find(a=>a.name.ko==='성현'));await S(1500);res.card=W();
      closeCards();await S(1200);res.cardClosed=W();
      document.querySelector('#feed-overlay .feed-grid .feed-card')?.click();await S(2500);res.lb=W();
      closeLightbox();await S(1200);res.lbClosed=W();
      await _openProgramCollection(_PROGRAM_COLLECTIONS.find(x=>x.key==='itslive'));await S(1500);res.list=W();
      _closeFeedListOverlay();await S(800);res.listClosed=W();
      showT(ARTISTS.find(a=>a.name.ko==='성현'));await S(1500);
      document.querySelector('#tv .gc-ch-item')?.click();await S(2500);res.cardLb=W();
      closeLightbox();await S(1000);res.cardStill=W();
      closeCards();await S(1200);res.allClosed=W();
      // 비동기 선반이 그려지는 중의 이동을 폭 변경 탓으로 재지 않도록 먼저 렌더 큐를 기다린다.
      for(let i=0;i<300&&(_feedBuildRunning||_feedBuildQ.length);i++)await S(100);
      const sc=_feedWideScroller();
      res.feedBusy={running:_feedBuildRunning,queued:_feedBuildQ.length};
      if(sc){sc.scrollTop=1800;await S(600);
        const rr=sc.getBoundingClientRect();const a=document.elementFromPoint(rr.left+60,rr.top+24)?.closest('.feed-card,section,.feed-section,[id^="feed-"]');
        const off0=a?a.getBoundingClientRect().top-rr.top:0;
        showT(ARTISTS.find(x=>x.name.ko==='성현'));await S(1500);
        res.anchorNarrow=a?Math.round(a.getBoundingClientRect().top-sc.getBoundingClientRect().top-off0):null;
        closeCards();await S(1500);
        res.anchorBack=a?Math.round(a.getBoundingClientRect().top-sc.getBoundingClientRect().top-off0):null;}
      _closeFeedOverlay();await S(900);res.feedClosed={wide:document.body.classList.contains('fw-home'),open:fo.classList.contains('open')};
      return JSON.stringify(res);})()`));
    const chk=(name,v,wide)=>{if(v&&v.wide===wide&&(wide?v.w>440:v.w===440))ok(name+' → '+(wide?'넓게 '+v.w:'440'));else bad(name+' '+JSON.stringify(v));};
    chk('나침반만',r.feedOnly,true);
    chk('카드 열기',r.card,false);chk('카드 닫기',r.cardClosed,true);
    chk('영상 재생',r.lb,false);chk('재생 닫기',r.lbClosed,true);
    chk('목록 창 열기',r.list,false);chk('목록 창 닫기',r.listClosed,true);
    chk('카드+재생',r.cardLb,false);chk('재생만 닫기(카드 남음)',r.cardStill,false);chk('카드까지 닫기',r.allClosed,true);
    if(r.anchorNarrow!=null&&Math.abs(r.anchorNarrow)<=4&&Math.abs(r.anchorBack)<=4)ok(`폭이 바뀌어도 보던 자리 유지(좁힘 ${r.anchorNarrow}px · 되넓힘 ${r.anchorBack}px)`);else bad('보던 자리 '+JSON.stringify({narrow:r.anchorNarrow,back:r.anchorBack,busy:r.feedBusy}));
    if(r.feedClosed&&!r.feedClosed.wide&&!r.feedClosed.open)ok('나침반 닫으면 넓은 상태 해제');else bad('닫기 '+JSON.stringify(r.feedClosed));
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
