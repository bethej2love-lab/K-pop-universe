// 정적 곡 페이지 → 앱 딥링크(2026-10-30 사용자 "곡 페이지 '직캠·영상 아카이브 보기'를 누르면 그룹 카드만 열린다 — 그 곡 영상 패널까지").
//  ① #g=그룹&song=곡 → 그룹 카드 + 그 곡 영상 패널
//  ② #g=그룹&m=멤버&song=곡(멤버×곡 페이지) → 멤버 카드 + 곡 영상 패널, '멤버 ▾'가 그 멤버로 골라진 상태
//  ③ 빌더의 버튼 주소에 &song= 이 실린다
// ⚠️ 실DB를 읽는 브라우저 테스트. 브라우저가 없으면 스킵. 실행: node tests/deeplink-song.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=8992,CDP_PORT=9392;
const BROWSER=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const b=fs.readFileSync(path.join(ROOT,'build_group_pages.js'),'utf8');
if(/class="cta" href="\$\{SITE\}\/#g=\$\{hashEsc\(gko\)\}[^"]*&song=\$\{hashEsc\(s\.title\)\}/.test(b))ok('빌더 버튼 주소에 &song=');else bad('빌더 버튼 주소에 &song= 없음');
const server=http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]);const f=path.join(ROOT,p==='/'?'index.html':p);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
async function waitCdp(){for(let i=0;i<40;i++){try{await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json();return;}catch(e){await sleep(300);}}throw new Error('cdp');}
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map();
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}});ws.addEventListener('error',rej);});}
async function ev(c,x){const r=await c.send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const STATE=`JSON.stringify((()=>{const ov=document.getElementById('gc-track-videos-overlay');const t=document.getElementById('gc-track-videos-title');
  const pick=document.querySelector('#gc-track-videos-tabs .gc-vid-pick .lbl');
  return {open:!!(ov&&ov.classList.contains('open')),title:t?t.textContent.trim():'',member:pick?pick.textContent:'',items:document.querySelectorAll('#gc-track-videos-list .tv-sm-item,#gc-track-videos-list > *').length,gc:typeof _openGCko!=='undefined'?_openGCko:null,tt:typeof _openTArtist!=='undefined'&&_openTArtist?_openTArtist.name.ko:null};})())`;
(async()=>{
  if(!BROWSER){console.log('⏭️  브라우저를 못 찾음 — 스킵');process.exit(fail?1:0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-dls-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=390,844','about:blank'],{stdio:'ignore'});
  try{
    await waitCdp();
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
    for(const [hash,want] of [['#g=클로즈유어아이즈&song=Drop That!',{title:/Drop That/i}],['#g=코르티스&m=성현&song=ACAI',{title:/ACAI/i,member:'성현'}]]){
      await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html${encodeURI(hash)}`});
      let st={};for(let i=0;i<40;i++){await sleep(500);try{st=JSON.parse(await ev(c,STATE));if(st.open&&st.items>1&&(!want.member||st.member===want.member))break;}catch(e){}}
      if(st.open&&want.title.test(st.title)&&st.items>1&&(!want.member||st.member===want.member))ok(`${hash} → 곡 패널 '${st.title}' 열림·영상 ${st.items}${want.member?` · 멤버 ${st.member}`:''}`);
      else bad(`${hash} → ${JSON.stringify(st)}`);
    }
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{process.kill(proc.pid);}catch(e){}server.close();console.log(`\n${pass} 통과 / ${fail} 실패`);setTimeout(()=>process.exit(fail?1:0),300);}
})();
