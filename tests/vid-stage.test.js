// 카드 영상 넓게 보기 = 영상 칸(2026-11-18 사용자 "카드 하나만 열면 옆이 텅 비고 영상까지 스크롤이 너무 많다 — 영상 영역을 카드 왼쪽으로, 기능은 그대로").
// 1440px 웹에서 그룹 카드 → 영상 넓게 보기 아이콘 → 칸 위치·가로/쇼츠 줄 높이·쇼츠 그림 붙음·무한 스크롤·펼침 기억·접기 복귀를 실제 앱으로 본다.
// 실행: node tests/vid-stage.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8998,CDP_PORT=9398;
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
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-vs-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox','--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  try{
    await waitForBrowserCdp(proc,CDP_PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});
    for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,"typeof showGC==='function'&&ARTISTS.length>0&&!!sb"))break;}catch(e){}}
    const r=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));
      const res={};const cont=()=>document.getElementById('gc-ch-vid');const n=()=>cont().querySelectorAll('.gc-ch-grid > .gc-ch-item').length;
      const sz=sel=>{const e=cont().querySelector(sel);if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.width),Math.round(b.height)];};
      try{localStorage.removeItem('kpu_vid_stage');}catch(e){}
      document.querySelectorAll('#ob-tips,.ob-tips').forEach(e=>e.remove());showGC('아이브');
      for(let i=0;i<40&&n()===0;i++)await S(500);
      res.cardItems=n();res.btn=!!document.querySelector('.gc-ch-vs-btn');
      document.querySelector('.gc-ch-vs-btn').click();await S(1500);
      res.inStage=!!cont().closest('#vid-stage');res.center=_stageCenterOpen();
      const v=document.getElementById('vid-stage').getBoundingClientRect(),sp=document.getElementById('side-panel').getBoundingClientRect();
      res.flush=Math.abs(v.right-sp.left)<=2;
      res.wide=sz('.gc-ch-grid > .gc-ch-item:not(.is-short) .gc-ch-thumb');res.short=sz('.gc-ch-grid > .gc-ch-item.is-short .gc-ch-thumb');
      await S(4000);
      const si=cont().querySelector('.gc-ch-grid > .gc-ch-item.is-short img.gc-ch-thumb');res.shortSrc=!!(si&&si.getAttribute('src'));
      const before=n();document.getElementById('vid-stage').scrollTo(0,1e6);for(let i=0;i<16&&n()<=before;i++)await S(500);res.more=n()>before;
      res.pref=localStorage.getItem('kpu_vid_stage');
      document.querySelector('#vid-stage .vs-close').click();await S(800);
      res.back=!!cont().closest('#side-panel');res.centerAfter=_stageCenterOpen();res.cardShort=sz('.gc-ch-grid > .gc-ch-item.is-short .gc-ch-thumb');
      return JSON.stringify(res);})()`));
    const chk=(m,x)=>x?ok(m):bad(m+' '+JSON.stringify(r));
    chk('카드 영상 머리줄에 영상 넓게 보기 아이콘',r.btn&&r.cardItems>0);
    chk('누르면 영상 영역이 카드 왼쪽 칸으로(가운데 점유로 판정)',r.inStage&&r.center);
    chk('칸 오른쪽 끝이 카드 왼쪽 끝에 붙음',r.flush);
    chk('가로 썸네일과 쇼츠 썸네일 높이가 같은 줄 높이',r.wide&&r.short&&Math.abs(r.wide[1]-r.short[1])<=2);
    chk('옮긴 뒤 쇼츠 그림이 실제로 붙음(감시 재설정)',r.shortSrc);
    chk('칸에서 끝까지 내리면 다음 영상을 더 불러옴',r.more);
    chk('펼침 기억',r.pref==='1');
    chk('접으면 카드 안으로 복귀·가운데 비움·쇼츠 원래 세로 비율',r.back&&!r.centerAfter&&r.cardShort&&r.cardShort[1]>r.cardShort[0]*1.5);
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
