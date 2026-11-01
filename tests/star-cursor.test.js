const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8988,CDP_PORT=9388;
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
// 실제 제품 CSS를 격리한 문서: 운영 API/로그인/반응 쓰기 없이 커서·스크롤 입력을 검사한다.
(async()=>{
 if(!BROWSER)throw new Error('Chromium required');
 server.listen(PORT);const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-cursor-'));
 const proc=spawn(BROWSER,['--headless=new','--no-sandbox','--blink-settings=primaryPointerType=4,availablePointerTypes=4,primaryHoverType=2,availableHoverTypes=2',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--window-size=1400,900','about:blank'],{stdio:['ignore','ignore','pipe']});let c;
 try{
 await waitForBrowserCdp(proc,CDP_PORT);const page=await(await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();c=await conn(page.webSocketDebuggerUrl);
 await c.send('Page.enable');await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/kpop_universe.css`});
 // Linux headless에는 물리 마우스가 없으므로 실행 플래그로 fine/hover 장치를 명시한다.
 // setEmulatedMedia(pointer)는 이 장치 설정을 대신하지 못한다.
 await ev(c,`new Promise(resolve=>{document.open();document.write('<html><head></head><body></body></html>');document.close();const l=document.createElement('link');l.rel='stylesheet';l.href='/kpop_universe.css';l.onload=resolve;document.head.append(l);})`);
 const result=await ev(c,`(()=>{
 const make=(tag,attrs={},parent=document.body)=>{const e=document.createElement(tag);Object.assign(e,attrs);parent.append(e);return e;};
 const cursor=e=>getComputedStyle(e).cursor;const r={fine:matchMedia('(pointer:fine)').matches,scroll:[]};
 const box=make('div');r.base=cursor(box);
 const b=make('button');b.textContent='click';const span=make('span',{textContent:'nested'},b);r.button=cursor(b);r.child=cursor(span);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');b.append(svg);r.svg=cursor(svg);
 r.link=cursor(make('a',{href:'#'}));r.label=cursor(make('div',{className:'member-name-label'}));
 const inline=make('div');inline.style.cursor='var(--kpu-cursor-pointer,pointer)';r.dynamic=cursor(inline);r.dynamicChild=cursor(make('span',{},inline));
 r.input=cursor(make('input',{type:'text'}));r.textarea=cursor(make('textarea'));
 r.grab=cursor(make('div',{className:'hscroll-drag'}));r.grabbing=cursor(make('div',{className:'hscroll-drag drag-scrolling'}));
 b.disabled=true;r.disabled=cursor(b);r.disabledChild=cursor(span);
 for(const name of ['feed-pane','fav-list','collection-list','concert-log-list','scrap-list','vm-list','mob-sheet-inner','generic']){
 const e=make('div');if(name==='feed-pane')e.className=name;else e.id=name;
 e.style.cssText='position:fixed;z-index:999999;left:20px;top:20px;width:300px;min-width:0;height:240px;max-height:240px;overflow:scroll;padding:0;border:0;display:block;';
 make('div',{style:'width:800px;height:1800px'},e);
 const s=getComputedStyle(e);const row={name,width:s.scrollbarWidth,color:s.scrollbarColor,gutter:e.offsetWidth-e.clientWidth,parts:{}};
 for(const part of ['','-track','-track-piece','-thumb','-corner','-button'])row.parts[part||'bar']=getComputedStyle(e,'::-webkit-scrollbar'+part).cursor;
 r.scroll.push(row);if(name!=='feed-pane')e.remove();
 }
 const rail=make('div',{className:'feed-strip'});r.hidden=getComputedStyle(rail).scrollbarWidth;
 return r;})()`);
 const check=(name,yes)=>yes?ok(name):bad(name);
 const pink=x=>/url\(/.test(x)&&/FFB0D0/i.test(x);const white=x=>/url\(/.test(x)&&/white/.test(x);
 check('fine pointer',result.fine);check('white background star',white(result.base));
 for(const k of ['button','child','svg','link','label','dynamic','dynamicChild'])check(k+' pink star',pink(result[k]));
 for(const k of ['disabled','disabledChild'])check(k+' white star',white(result[k]));
 check('input and textarea keep I-beam',result.input==='text'&&result.textarea==='text');
 check('drag cursors preserved',result.grab==='grab'&&result.grabbing==='grabbing');
 for(const row of result.scroll){check(row.name+' uses custom scrollbar',row.width==='auto'&&row.color==='auto'&&row.gutter>0);check(row.name+' all scrollbar parts pink',Object.values(row.parts).every(pink));}
 check('hidden horizontal rail stays hidden',result.hidden==='none');
 // scrollTop 대입으로 성공을 만들지 않고 실제 트랙 클릭·손잡이 드래그 입력을 보낸다.
 const geo=await ev(c,`(()=>{const e=document.querySelector('.feed-pane');e.scrollTop=0;const r=e.getBoundingClientRect();return{x:r.right-(e.offsetWidth-e.clientWidth)/2,y:r.top,h:e.clientHeight,sh:e.scrollHeight};})()`);
 
 const mouse=(type,x,y,buttons=0)=>c.send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'&&!buttons?'none':'left',buttons,clickCount:type==='mouseMoved'?0:1});
 await mouse('mouseMoved',geo.x,geo.y+geo.h*.8);await mouse('mousePressed',geo.x,geo.y+geo.h*.8,1);await mouse('mouseReleased',geo.x,geo.y+geo.h*.8);await sleep(300);
 check('compass track click scrolls',await ev(c,`document.querySelector('.feed-pane').scrollTop>0`));
 await ev(c,`(()=>{const e=document.querySelector('.feed-pane');e.replaceWith(e.cloneNode(true));document.querySelector('.feed-pane').scrollTop=0;})()`);await sleep(400);await mouse('mouseMoved',geo.x,geo.y+12);await mouse('mousePressed',geo.x,geo.y+12,1);await sleep(80);for(let y=24;y<=150;y+=14){await mouse('mouseMoved',geo.x,geo.y+y,1);await sleep(20);}await mouse('mouseReleased',geo.x,geo.y+150);await sleep(100);
 check('compass thumb drag scrolls',await ev(c,`document.querySelector('.feed-pane').scrollTop>200`));
 await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const coarse=await ev(c,`({base:getComputedStyle(document.body).cursor,width:getComputedStyle(document.querySelector('.feed-pane')).scrollbarWidth})`);
 check('touch has no forced SVG cursor',!coarse.base.includes('svg'));check('touch scrollbar mode preserved',coarse.width==='thin');
 console.log(JSON.stringify({scrollbars:result.scroll.map(({parts,...x})=>x),coarse}));
 }catch(e){bad(e.stack);}finally{c?.close();proc.kill();server.close();}
 console.log(pass+' pass / '+fail+' fail');process.exitCode=fail?1:0;
})();
