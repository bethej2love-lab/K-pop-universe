// 카드 영상 제목·맨 위로 버튼 재발 방지(2026-10-28 사용자 "재발하는 문제는 재발하지 않도록")
//  ① 카드 쇼츠 칸 제목이 블러 배경(.gc-ch-thumb-bg, absolute)에 가리지 않는다 — 제목 가운데 점을 찍으면 제목이 잡혀야 한다.
//     10-27 2줄 제목에서 마스크(쌓임 맥락)를 빼자 배경 밑에 깔려 "첫 글자만 보이고 사라지는" 증상이 재발했다(이전에도 한 번).
//  ② 줄 수를 자르는(-webkit-line-clamp) 글자 칸 전부: 위아래 padding이 0 — padding이 있으면 잘림선이 padding 끝이라
//     다음 줄 윗부분이 찔끔 보인다(10-28 "2줄에 더해 세 번째 줄이 찔끔"). 화면에 보이는 모든 클램프 칸을 훑는다.
//  ③ 맨 위로 버튼: 눌러서 0까지, 터치 기기에선 올리는 동안 관성을 끊는 overflow:hidden이 걸렸다가 끝나면 원래대로 풀린다.
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저가 없으면 스킵.
// 실행: node tests/card-title-visibility.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');const OUT=require('os').tmpdir();
const PORT=8995,CDP_PORT=9395;
const BROWSER=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]);const f=path.join(ROOT,p==='/'?'index.html':p);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
async function waitCdp(){for(let i=0;i<40;i++){try{await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();return;}catch(e){await sleep(300);}}throw new Error('cdp');}
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map();
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}});ws.addEventListener('error',rej);});}
async function ev(c,x){const r=await c.send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function shot(c,name){const r=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(OUT,name),Buffer.from(r.data,'base64'));}
(async()=>{
  if(!BROWSER){console.log("⏭️  브라우저를 못 찾음 — 스킵");process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-vui-'));
  // Linux 헤드리스는 기본 포인터가 none일 수 있다. Playwright와 같은 마우스 입력 기본값을 주고,
  // 모바일 구간은 아래 touch emulation으로 전환한다. CSS 미디어 feature에 pointer를 넣는 것만으로는
  // 실제 입력 장치가 바뀌지 않는다. 애니메이션도 백그라운드 렌더러 절전에 묶이지 않게 한다.
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu',
    '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows',
    '--window-size=390,844','about:blank'],{stdio:'ignore'});
  try{
    await waitCdp();
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    const errs=[];
    // ── 모바일 ──
    await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    await c.send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'},{name:'hover',value:'none'}]});
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});await sleep(8000);
    if(!(await ev(c,`typeof showGC==='function'&&ARTISTS.length>0`)))throw new Error('앱 미준비');
    const r=JSON.parse(await ev(c,`(async()=>{
      const S=ms=>new Promise(r=>setTimeout(r,ms));
      showGC('코르티스');
      const el=mobSheetInner;
      for(let i=0;i<40&&!el.querySelector('.gc-ch-item.is-short .tv-sm-title');i++)await S(300);
      const out={shorts:0,hidden:[],clampPad:[],clampN:0};
      // ① 쇼츠 제목 가림 — 화면 안으로 끌어와 가운데 점 확인
      const titles=[...el.querySelectorAll('.gc-ch-item.is-short .tv-sm-title')].slice(0,6);
      for(const t of titles){
        t.scrollIntoView({block:'center'});await S(120);
        const b=t.getBoundingClientRect();if(b.width<10||b.height<5)continue;
        out.shorts++;
        const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
        if(!hit||!(hit===t||t.contains(hit)))out.hidden.push((t.textContent||'').slice(0,20)+' → '+(hit?hit.className:'null'));
      }
      // ② 클램프 칸 padding
      for(const x of el.querySelectorAll('*')){
        const cs=getComputedStyle(x);const lc=cs.webkitLineClamp;
        if(!lc||lc==='none'||cs.display==='none'||!x.offsetHeight)continue;
        out.clampN++;
        if(parseFloat(cs.paddingTop)>0||parseFloat(cs.paddingBottom)>0)out.clampPad.push(x.className+' pad '+cs.paddingTop+'/'+cs.paddingBottom);
      }
      // ③ 맨 위로
      el.scrollTop=0;await S(200);
      for(let i=0;i<20;i++){el.scrollTop+=200;await S(50);}
      await S(800);el.scrollTop-=40;await S(300);
      out.from=el.scrollTop;out.btn=getComputedStyle(_totopBtn).display;
      const ov0=el.style.overflowY;
      _totopBtn.click();await S(100);
      out.ovDuring=getComputedStyle(el).overflowY;
      await S(1200);
      out.to=el.scrollTop;out.ovAfter=el.style.overflowY===ov0;
      return JSON.stringify(out);})()`));
    if(r.shorts>0&&!r.hidden.length)ok(`쇼츠 제목 ${r.shorts}개 모두 배경 위에 보임`);
    else if(!r.shorts)bad('쇼츠 제목을 못 찾음(카드 영상 미로딩?)');
    else bad('쇼츠 제목이 가려짐: '+r.hidden.join(' | '));
    if(r.clampN>0&&!r.clampPad.length)ok(`줄 자르는 글자 칸 ${r.clampN}개 위아래 padding 0(다음 줄 비침 없음)`);
    else if(!r.clampN)bad('클램프 칸을 못 찾음');
    else bad('클램프 칸에 위아래 padding: '+[...new Set(r.clampPad)].join(' | '));
    if(r.btn==='flex'&&r.from>1000&&r.to===0)ok(`맨 위로: ${r.from}→${r.to}`);else bad(`맨 위로 ${JSON.stringify({btn:r.btn,from:r.from,to:r.to})}`);
    if(r.ovDuring==='hidden'&&r.ovAfter)ok('터치 기기: 올리는 동안 관성 차단(overflow hidden) → 끝나면 원래대로');else bad(`관성 차단 ${r.ovDuring}/${r.ovAfter}`);
  }catch(e){bad('예외 '+e.message);}finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
