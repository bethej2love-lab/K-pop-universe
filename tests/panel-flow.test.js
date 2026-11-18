// 웹 패널 흐름(2026-11-18 사용자 "패널 이것저것 열면서 닫히면 안 되는 게 닫힌다든지") — 흐름 점검에서 찾은 세 가지가 다시 깨지지 않게:
// 맨 앞 무대 패널(앨범·업데이트 소식·링크 모음)부터 ESC로 닫히고 카드는 남는다 / 영상 칸은 카드보다 먼저 접힌다 / 멤버 탐색에서 멤버를 골라도 탐색은 남는다.
// 실행: node tests/panel-flow.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8997,CDP_PORT=9397;
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
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-pf-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox','--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  try{
    await waitForBrowserCdp(proc,CDP_PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});
    for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,"typeof showGC==='function'&&ARTISTS.length>0&&!!sb"))break;}catch(e){}}
    const r=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const on=id=>{const e=document.getElementById(id);return !!(e&&(e.classList.contains('open')||e.classList.contains('vs-on')));};
      const esc=()=>_closeTopOverlay();const res={};
      try{localStorage.removeItem('kpu_vid_stage');}catch(e){}document.querySelectorAll('#ob-tips,.ob-tips').forEach(e=>e.remove());
      showGC('아이브');for(let i=0;i<40&&!document.querySelector('#gc-discog-strip .gc-discog-item');i++)await S(500);
      // ① 앨범이 맨 앞이면 ESC는 앨범만
      document.querySelector('#gc-discog-strip .gc-discog-item')?.click();await S(1500);res.albOpen=on('gc-discog-detail');
      esc();await S(600);res.albAfter=on('gc-discog-detail');res.cardAfterAlb=on('side-panel');
      // ② 업데이트 소식 위에 링크 모음 — ESC는 맨 앞부터 하나씩, 카드는 남는다
      _openUpdates();for(let i=0;i<20&&!on('upd-overlay');i++)await S(250);_openKpopLinks();for(let i=0;i<20&&!(on('kpop-links-overlay')&&document.body.dataset.stageFront==='links');i++)await S(250);await S(300);
      esc();await S(500);res.e1={links:on('kpop-links-overlay'),upd:on('upd-overlay'),card:on('side-panel')};
      esc();await S(500);res.e2={upd:on('upd-overlay'),card:on('side-panel')};
      // ③ 영상 칸은 카드보다 먼저 접힌다
      for(let i=0;i<30&&!document.querySelector('#gc-ch-vid .gc-ch-vs-btn');i++)await S(500);
      document.querySelector('#gc-ch-vid .gc-ch-vs-btn')?.click();await S(1200);res.vsOpen=on('vid-stage');
      esc();await S(500);res.vsAfter=on('vid-stage');res.cardAfterVs=on('side-panel');
      // ④ 멤버 탐색에서 멤버를 고르면 웹에선 탐색이 가운데에 남는다
      _openMemberExplorer();for(let i=0;i<20&&![...document.querySelectorAll('#mx-overlay button')].some(b=>/년생/.test(b.textContent));i++)await S(500);
      [...document.querySelectorAll('#mx-overlay button')].find(b=>/년생/.test(b.textContent))?.click();await S(2500);
      res.mxStays=on('mx-overlay');res.memberCard=on('member-panel');
      try{localStorage.removeItem('kpu_vid_stage');}catch(e){}
      return JSON.stringify(res);})()`));
    const chk=(m,x)=>x?ok(m):bad(m+' '+JSON.stringify(r));
    chk('앨범이 맨 앞이면 ESC는 앨범만 닫고 카드는 남김',r.albOpen&&!r.albAfter&&r.cardAfterAlb);
    chk('업데이트 소식 위 링크 모음 — ESC 1번은 링크 모음만',r.e1&&!r.e1.links&&r.e1.upd&&r.e1.card);
    chk('ESC 2번은 업데이트 소식만(카드 남음)',r.e2&&!r.e2.upd&&r.e2.card);
    chk('영상 칸은 카드보다 먼저 접힘',r.vsOpen&&!r.vsAfter&&r.cardAfterVs);
    chk('멤버 탐색에서 멤버를 고르면 탐색은 가운데에 남고 멤버 카드가 열림',r.mxStays&&r.memberCard);
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
