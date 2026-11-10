const fs=require('fs'),os=require('os'),path=require('path');const{spawn}=require('child_process');
const {waitForBrowserCdp}=require('C:/Users/user/Documents/GitHub/kpopuniverse/tools/browser_test_runtime.cjs');
const B='C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const PORT=9488;
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map(),h=[];
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),on:f=>h.push(f),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}else h.forEach(f=>f(m));});ws.addEventListener('error',rej);});}
(async()=>{
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'wdm-'));
  const proc=spawn(B,['--headless=new','--no-sandbox',`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,'--window-size=430,2000','about:blank'],{stdio:'ignore'});
  try{
    await waitForBrowserCdp(proc,PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Network.enable');await c.send('Page.enable');await c.send('Runtime.enable');
    const reqs=[];c.on(m=>{if(m.method==='Network.responseReceived'){const u=m.params.response.url;if(/json/.test(m.params.response.mimeType||'')||/api/.test(u))reqs.push({id:m.params.requestId,u});}});
    await c.send('Page.navigate',{url:'https://dm.weverse.io/'});await sleep(12000);
    const rooms=new Map();let lastN=0,still=0;
    const grab=async()=>{for(const r of reqs.splice(0)){if(r.u.indexOf("rooms/recommend")<0)continue;try{const b=await c.send('Network.getResponseBody',{requestId:r.id});JSON.parse(b.body).forEach(x=>rooms.set(x.roomId,{name:x.dmOfficialName,en:x.dmEnOfficialName,community:x.communityName,cid:x.communityId}));}catch(e){}}};
    await grab();
    for(let i=0;i<400;i++){
      await c.send('Runtime.evaluate',{expression:"(()=>{const b=[...document.querySelectorAll('button,[role=button]')].find(e=>/refresh/.test(e.textContent||'')||/refresh/i.test(e.getAttribute('aria-label')||''));if(b){b.click();return 1}return 0})()"});
      await sleep(900);await grab();
      if(rooms.size===lastN)still++;else{still=0;lastN=rooms.size;}
      if(i%25===0)console.log('클릭',i,'수집',rooms.size);
      if(still>=60)break;
    }
    fs.writeFileSync(process.env.TEMP+'/wdm_rooms.json',JSON.stringify([...rooms.values()],null,1));
    console.log('총',rooms.size);
    c.close();
  }finally{try{proc.kill()}catch(e){}}
})().catch(e=>{console.error(e);process.exit(1)});
