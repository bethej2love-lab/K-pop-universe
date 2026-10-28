// 영상 목록 공유(2026-10-28 사용자 "성현 직캠 모음 링크를 공유하고 싶다") — ⋮ "이 목록 공유"가 만든 링크를 열면
// 받는 쪽 카드가 같은 탭·곡·검색·정렬로 열리는지 왕복으로 확인한다(_vidShareHash → _openFromHash → _takeVidPreset).
//  ① 멤버 카드(코르티스 성현)에서 쇼츠 탭·조회수순·첫 곡을 고른 뒤 공유 링크를 받아 둔다(실제 공유 대신 가로챔)
//  ② 새로 그 링크를 열면 같은 탭이 켜져 있고, 정렬 ✓·곡 버튼·목록 영상이 모두 그 곡/쇼츠인지
//  ③ 검색어(vq)만 실은 그룹 카드 링크 — 검색창이 열려 그 값이 들어가 있는지
//  ④ 허용 목록 밖 값(vf=evil)은 무시하고 기본 탭으로 연다
// ⚠️ 실DB를 읽는 브라우저 테스트 — CI 스킵 목록(browser)에 등록. 브라우저가 없으면 스킵.
// 실행: node tests/vid-list-share.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const PORT=8996,CDP_PORT=9396;
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
async function open(c,hash){
  await c.send('Page.navigate',{url:'about:blank'});await sleep(300);
  await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html${hash}`});
  for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,`typeof showT==='function'&&ARTISTS.length>0`))break;}catch(e){}}
}
// 목록이 다 그려질 때까지(첫 영상 + 로딩 끝)
const WAIT_GRID=sel=>`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));for(let i=0;i<60;i++){const g=document.querySelector('${sel} .gc-ch-grid');if(g&&g.querySelector('.gc-ch-item'))break;await S(300);}await S(1500);return true;})()`;
(async()=>{
  if(!BROWSER){console.log("⏭️  브라우저를 못 찾음 — 스킵");process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-vls-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu',
    '--disable-background-timer-throttling','--disable-renderer-backgrounding','--window-size=1400,900','about:blank'],{stdio:'ignore'});
  try{
    await waitCdp();
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    // ① 보내는 쪽
    await open(c,'#g=코르티스&m=성현');
    await ev(c,WAIT_GRID('#tv'));
    const sent=JSON.parse(await ev(c,`(async()=>{
      const S=ms=>new Promise(r=>setTimeout(r,ms));const cont=document.getElementById('tv');
      const songs=await _vidSongList('코르티스','성현',null);const song=(songs||[]).find(s=>s.n>=3)||songs[0];
      cont.querySelector('.gc-ch-filter[data-val="short"]')?.click();await S(800);
      cont.querySelector('.gc-ch-sort-item[data-sort="popular"]')?.click();await S(800);
      // 곡 고르기는 시트를 거치므로 시트 콜백과 같은 결과를 state에 직접 — 곡 버튼을 눌러 시트를 연 뒤 그 항목을 누른다
      cont.querySelector('.gc-vid-pick')?.click();
      let item=null;for(let i=0;i<30&&!item;i++){await S(200);item=[...document.querySelectorAll('#vid-song-sheet-ov button')].find(x=>(x.textContent||'').trim().startsWith(song.label));}
      if(item)item.click();await S(1500);
      let url=null;const orig=window._shareCurrentView;window._shareCurrentView=(u,t,k)=>{url={u,t,k};};
      cont.querySelector('.gc-ch-share-item')?.click();window._shareCurrentView=orig;
      return JSON.stringify({song,url,hasItem:!!item});
    })()`));
    if(sent.url&&/&vf=short/.test(sent.url.u)&&/&vs=popular/.test(sent.url.u))ok('공유 링크에 탭·정렬이 실림: '+decodeURIComponent(sent.url.u.replace(/^https?:\/\/[^/]+\//,'')));else bad('공유 링크 '+JSON.stringify(sent.url));
    if(sent.hasItem&&sent.url&&sent.url.u.includes('&vk='))ok('곡 키도 실림 ('+sent.song.label+')');else bad('곡 시트 항목/곡 키 '+JSON.stringify(sent));
    if(sent.url&&sent.url.k==='list'&&/성현/.test(sent.url.t))ok('공유 제목: '+sent.url.t);else bad('공유 제목/종류 '+JSON.stringify(sent.url));
    // ② 받는 쪽
    if(sent.url){
      await open(c,sent.url.u.slice(sent.url.u.indexOf('#')));
      await ev(c,WAIT_GRID('#tv'));
      const got=JSON.parse(await ev(c,`(()=>{const cont=document.getElementById('tv');
        const act=cont.querySelector('.gc-ch-filter.active')?.dataset.val;
        const sort=cont.querySelector('.gc-ch-sort-item[data-sort].active')?.dataset.sort;
        const pick=cont.querySelector('.gc-vid-pick');
        const items=[...cont.querySelectorAll('.gc-ch-grid .gc-ch-item')];
        return JSON.stringify({act,sort,pickOn:pick?.classList.contains('on'),pickTxt:pick?.textContent,n:items.length,shorts:items.filter(x=>x.classList.contains('is-short')).length});})()`));
      if(got.act==='short')ok('받는 쪽 탭 = 쇼츠');else bad('받는 쪽 탭 '+got.act);
      if(got.sort==='popular')ok('받는 쪽 정렬 = 조회수순');else bad('받는 쪽 정렬 '+got.sort);
      if(got.pickOn&&got.pickTxt.includes(sent.song.label))ok('받는 쪽 곡 버튼 = '+got.pickTxt);else bad('받는 쪽 곡 버튼 '+JSON.stringify(got));
      if(got.n>0&&got.shorts===got.n)ok(`받는 쪽 목록 ${got.n}개 모두 쇼츠`);else bad('받는 쪽 목록 '+JSON.stringify(got));
    }
    // ③ 그룹 카드 + 검색어
    await open(c,'#g=코르티스&vf=all&vq=REDRED');
    await ev(c,WAIT_GRID('#gc-ch-vid'));
    const q=JSON.parse(await ev(c,`(()=>{const cont=document.getElementById('gc-ch-vid');const inp=cont.querySelector('.gc-ch-search');
      const titles=[...cont.querySelectorAll('.gc-ch-grid .gc-ch-item')].map(x=>x.textContent);
      return JSON.stringify({v:inp?.value,shown:cont.querySelector('.gc-ch-search-wrap')?.style.display!=='none',n:titles.length,hit:titles.filter(t=>/redred|레드레드/i.test(t)).length});})()`));
    if(q.v==='REDRED'&&q.shown)ok('검색창 열림 + 검색어 REDRED');else bad('검색창 '+JSON.stringify(q));
    if(q.n>0&&q.hit>=Math.ceil(q.n*0.8))ok(`검색 결과 ${q.n}개 중 ${q.hit}개 제목에 REDRED`);else bad('검색 결과 '+JSON.stringify(q));
    // ④ 허용 목록 밖 값
    await open(c,'#g=코르티스&m=성현&vf=evil&vs=drop');
    await ev(c,WAIT_GRID('#tv'));
    const ev4=JSON.parse(await ev(c,`JSON.stringify({act:document.querySelector('#tv .gc-ch-filter.active')?.dataset.val,sort:document.querySelector('#tv .gc-ch-sort-item[data-sort].active')?.dataset.sort})`));
    if(ev4.act!=='evil'&&ev4.sort==='recommend')ok('이상한 값은 무시: 탭 '+ev4.act+' · 정렬 '+ev4.sort);else bad('허용 목록 '+JSON.stringify(ev4));
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
