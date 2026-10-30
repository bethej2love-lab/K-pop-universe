// 형식에서 시작하기(2026-10-28 사용자 "누가·곡·형식 — 형식에서 시작해 즐겨찾기 아티스트를 한꺼번에 '누가'에 넣고 훑기").
// 검색에서 연 프로그램 모아보기에 누가 고르기(전체·★ 즐겨찾기·많이 나온 그룹)·정렬 버튼(최신순·조회수순)이 붙고, 즐겨찾기로 좁혀지는지.
// 2026-10-30: 물방울 칩 → 카드·곡 화면과 같은 '👥 전체 ▾' 고르기 버튼(시트·검색)과 '최신순' 버튼, 나머지 축은 밑줄 탭.
// ⚠️ 실DB를 읽는 브라우저 테스트 — CI 스킵 목록(browser)에 등록. 브라우저가 없으면 스킵.
// 실행: node tests/program-facets.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const TEST_LANG=process.env.KPU_TEST_LANG==='en'?'en':'ko';
const labels=TEST_LANG==='ko'?{all:'전체',fav:'★ 즐겨찾기',latest:'최신순',popular:'조회수순'}:{all:'All',fav:'★ Favorites',latest:'Newest',popular:'Most viewed'};
const PORT=8998,CDP_PORT=9398;
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
(async()=>{
  if(!BROWSER){console.log("⏭️  브라우저를 못 찾음 — 스킵");process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-pf-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,900','about:blank'],{stdio:'ignore'});
  try{
    await waitCdp();
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    // 라벨·즐겨찾기 선택의 언어는 명시한다. 러너 기본 언어에 기대지 않는다.
    await c.send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.setItem('kpu_lang',${JSON.stringify(TEST_LANG)});}catch(e){}`});
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});
    for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,`typeof _openProgramCollection==='function'&&ARTISTS.length>0&&!!sb`))break;}catch(e){}}
    const r=JSON.parse(await ev(c,`(async()=>{
      const S=ms=>new Promise(r=>setTimeout(r,ms));
      favGroups.clear();favMembers.clear();favGroups.add('르세라핌'); // 이 세션에서만(저장 안 함)
      await _openProgramCollection(_PROGRAM_COLLECTIONS.find(x=>x.key==='itslive'));await S(800);
      const rows=()=>[...document.querySelectorAll('#feed-list-facets .fl-tabs')].map(r=>[...r.querySelectorAll('.gc-ch-filter')].map(b=>b.textContent));
      const pickBtn=()=>document.querySelector('#feed-list-facets .fl-bar .gc-vid-pick');
      const sortBtn=()=>document.querySelector('#feed-list-facets .fl-bar .tvf-sort');
      const pickItems=async()=>{pickBtn().click();await S(400);const it=[...document.querySelectorAll('#vid-song-sheet-ov .vss-item .t')].map(x=>x.textContent);return {it,search:!!document.querySelector('#vid-song-sheet-ov .vss-search')};};
      const pickFav=async()=>{const b=[...document.querySelectorAll('#vid-song-sheet-ov .vss-item')].find(x=>x.querySelector('.t').textContent===(currentLang==='ko'?'★ 즐겨찾기':'★ Favorites'));b&&b.click();await S(800);};
      const sub=()=>document.getElementById('feed-list-sub').textContent;
      const out={pickLbl:pickBtn()?.querySelector('.lbl').textContent,sort0:sortBtn()?.textContent,all:sub(),pillRows:rows().length};
      Object.assign(out,{sheet:await pickItems()});
      await pickFav();
      out.fav=sub();out.favActive=pickBtn()?.querySelector('.lbl').textContent;out.favX=pickBtn()?.classList.contains('on');
      sortBtn().click();await S(800);
      out.sortActive=sortBtn()?.textContent;
      out.vcSearch=_matchPrograms('보이스캠','보이스캠','').map(x=>x.key);
      // 웹 무대(1400px) — 어두운 배경 없이 무대에, 재생 화면과 차례(2026-10-28)
      {const ov=document.getElementById('feed-list-overlay');
       out.stage={front:document.body.dataset.stageFront,bg:getComputedStyle(ov).backgroundColor,pe:getComputedStyle(ov).pointerEvents};
       document.querySelector('#feed-list-grid .gc-ch-item')?.click();await S(2000);
       out.stage.afterPlay=[document.body.dataset.stageFront,getComputedStyle(ov).visibility];
       closeLightbox();await S(900);
       out.stage.afterClose=[document.body.dataset.stageFront,getComputedStyle(ov).visibility];}
      // 시상식 창도 같은 '누가' 줄 — MMA 2025 + 즐겨찾기 에스파
      favGroups.clear();favGroups.add('에스파');
      await _openEventPage('mma','2025');await S(800);
      out.evRows=rows();out.evPick=!!pickBtn();
      await pickItems();await pickFav();
      out.evFavSub=sub();
      out.evFavTitles=[...document.querySelectorAll('#feed-list-grid > *')].map(x=>x.textContent||'').slice(0,10);
      return JSON.stringify(out);})()`));
    const n=s=>+String(s).replace(/[^0-9]/g,'');
    const it=(r.sheet||{}).it||[];
    if(r.pickLbl===labels.all&&r.pillRows===0&&it[0]===labels.fav&&it.length>20)ok('누가 고르기: "전체 ▾" → 시트 ★ 즐겨찾기·그룹 '+(it.length-1)+'개(상위 20 제한 없음)'+(r.sheet.search?' + 검색창':''));else bad('누가 고르기 '+JSON.stringify({l:r.pickLbl,p:r.pillRows,it:it.slice(0,5),n:it.length}));
    if(r.sort0===labels.latest)ok('정렬 버튼: 최신순');else bad('정렬 버튼 '+r.sort0);
    if(n(r.all)>500)ok('전체 '+r.all+' (예전 최신 500개 제한 풀림)');else bad('전체 '+r.all);
    if(r.favActive===labels.fav&&r.favX&&n(r.fav)>0&&n(r.fav)<n(r.all))ok('★ 즐겨찾기(르세라핌)로 좁힘: '+r.fav);else bad('즐겨찾기 '+JSON.stringify(r));
    if(r.sortActive===labels.popular)ok('조회수순 전환');else bad('정렬 '+r.sortActive);
    const st=r.stage||{};
    if(st.front==='list'&&/rgba\(0, 0, 0, 0\)|transparent/.test(st.bg)&&st.pe==='none')ok('웹 무대: 목록 창이 앞·어두운 배경 없음·뒤 화면 클릭 통과');else bad('웹 무대 '+JSON.stringify(st));
    if(st.afterPlay&&st.afterPlay[0]==='lb'&&st.afterPlay[1]==='hidden')ok('영상 누르면 재생 화면이 앞, 목록은 뒤로(닫지 않음)');else bad('재생 차례 '+JSON.stringify(st.afterPlay));
    if(st.afterClose&&st.afterClose[0]==='list'&&st.afterClose[1]==='visible')ok('재생 화면 닫으면 목록이 다시 앞');else bad('닫은 뒤 차례 '+JSON.stringify(st.afterClose));
    if(r.evRows&&r.evRows.length===2&&r.evPick)ok('시상식 창(MMA 2025): 연도·무대/직캠/전체 밑줄 탭 2줄 + 누가 고르기');else bad('시상식 줄 '+JSON.stringify({rows:r.evRows,pick:r.evPick}));
    if(n(r.evFavSub)>0&&r.evFavTitles.length&&r.evFavTitles.every(t=>/aespa|에스파/i.test(t)))ok('시상식 ★ 즐겨찾기(에스파): '+r.evFavSub);else bad('시상식 즐겨찾기 '+JSON.stringify({sub:r.evFavSub,t:r.evFavTitles}));
    if(r.vcSearch.includes('voicecam'))ok('검색 "보이스캠" → 보이스캠 모아보기');else bad('보이스캠 검색 '+r.vcSearch);
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
