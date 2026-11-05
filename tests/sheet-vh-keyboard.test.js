// 꽉 찬 카드 높이 고착 재발 방지(2026-11-05 사용자 캡처 "웹앱 쓰다 보면 카드가 화면 중간부터 뜨고 위로 당겨도 안 펴짐")
// 원인: 꽉 찬 높이(--mob-vh)를 visualViewport.height로 쟀는데 키보드·확대 중엔 작아지고, 웹앱은 resize가 거의 안 나 굳었다.
// 키보드가 올라온 순간 resize → 키보드 내려감(resize 없음, focusout만) 흐름에서 카드가 계속 꽉 차 있어야 한다.
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저가 없으면 스킵.
// 실행: node tests/sheet-vh-keyboard.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');const OUT=require('os').tmpdir();
const PORT=8997,CDP_PORT=9397;
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
  if(!BROWSER){console.log('no browser');process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-se-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--window-size=390,844','about:blank'],{stdio:'ignore'});
  try{
    await waitCdp();
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});await sleep(8000);
    const info=await ev(c,"(async()=>{\n  const S=ms=>new Promise(r=>setTimeout(r,ms));\n  const k=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='건너뛰기');if(k)k.click();\n  const h=()=>{const r=mobSheetEl.getBoundingClientRect();return {top:Math.round(r.top),h:Math.round(r.height),vh:getComputedStyle(document.documentElement).getPropertyValue('--mob-vh').trim(),full:mobSheetEl.classList.contains('bs-full')};};\n  const out={};\n  showGC('코르티스');await S(1500);out.open=h();\n  // 키보드가 올라온 상태 흉내: 보이는 영역 500px, 그 순간 resize\n  const real=Object.getOwnPropertyDescriptor(Window.prototype,'visualViewport')||Object.getOwnPropertyDescriptor(window,'visualViewport');\n  Object.defineProperty(window,'visualViewport',{configurable:true,get:()=>({height:500,scale:1,width:innerWidth,addEventListener(){},removeEventListener(){}})});\n  window.dispatchEvent(new Event('resize'));await S(600);out.kbd=h();\n  // 키보드 내려감: 보이는 영역 원래대로, 하지만 resize는 안 남(웹앱)\n  delete window.visualViewport;\n  document.dispatchEvent(new FocusEvent('focusout'));await S(800);out.afterKbd=h();\n  return JSON.stringify(out);})()");
    const r=JSON.parse(info);console.log(info);
    if(r.open.full&&r.open.top<10)ok('처음 열 때 꽉 참');else bad('처음 열 때 꽉 차지 않음 '+JSON.stringify(r.open));
    if(r.kbd.top<10)ok('키보드 중 resize에도 높이 유지');else bad('키보드 중 높이가 줄어듦 '+JSON.stringify(r.kbd));
    if(r.afterKbd.top<10)ok('키보드 내려간 뒤 꽉 참');else bad('키보드 내려간 뒤 고착 '+JSON.stringify(r.afterKbd));
    c.close();
  }catch(e){bad('예외 '+e.message);}finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`
${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
