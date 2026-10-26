// 긴 스크롤 영역 보조 + 모바일 시트 기하 회귀 테스트 (2026-10-26 사용자 요청 4건)
//  ① 앨범 영상 패널 등 손으로 안 붙인 긴 스크롤 영역에도 맨 위로 버튼(패널 안 오른쪽 아래), 닫히면 같이 사라짐, 자체 버튼 있는 목록엔 겹치지 않음
//  ② 모바일: 3배 이상 긴 영역은 스크롤할 때 끌 수 있는 막대(#kpu-rail), 1.2초 멈추면 숨김 / 데스크톱: 스크롤바가 보이고 잡힘(폭 8px+)
//  ③ 검색 시트(#msheet) 바닥 = 탭바 윗변(웹앱 vp-shift 포함) — "탭바 위쪽 우주 살짝 보임"
//  ④ 차트 목록 창 88vh, 순위 그림 기본 접힘(96px)·크게 보기·접기
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저가 없으면 스킵.
// 실행: node tests/scroll-aids.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');const OUT=require('os').tmpdir();
const PORT=8993,CDP_PORT=9393;
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
    ok('모바일 앱 로드(app.js 분리 후)');
    // 1) 검색 시트 바닥 = 탭바 윗변 (일반 + 웹앱 보정 흉내)
    for(const mode of ['normal','vpshift']){
      const r=JSON.parse(await ev(c,`(async()=>{
        ${mode==='vpshift'?"document.documentElement.classList.add('vp-shift');document.documentElement.style.setProperty('--vp-gap','34px');document.documentElement.style.setProperty('--vp-shift','0px');":''}
        updateSheetBottom();document.getElementById('tab-search').click();await new Promise(r=>setTimeout(r,800));
        const m=document.getElementById('msheet').getBoundingClientRect(),t=document.getElementById('tabbar').getBoundingClientRect();
        const out=JSON.stringify({open:document.getElementById('msheet').classList.contains('open'),mb:m.bottom,tt:t.top,inTop:document.getElementById('msheet-top').getBoundingClientRect().top});
        return out;})()`));
      if(!r.open)bad(`[${mode}] 검색 시트 안 열림`);
      else if(Math.abs(r.mb-r.tt)<=1)ok(`[${mode}] 검색 시트 바닥 ${r.mb.toFixed(0)} = 탭바 윗변 ${r.tt.toFixed(0)} (틈 0)`);
      else bad(`[${mode}] 검색 시트 바닥 ${r.mb} vs 탭바 ${r.tt} — 틈 ${(r.tt-r.mb).toFixed(0)}px`);
      if(mode==='vpshift'){await shot(c,'v_msheet_vpshift.png');}
      await ev(c,`(document.getElementById('msheet-back').click(),document.documentElement.classList.remove('vp-shift'),updateSheetBottom(),1)`);await sleep(500);
    }
    // 2) 목록 창 높이 + 그래프 접기/펼치기
    const fl=JSON.parse(await ev(c,`(async()=>{
      const vids=(await sb.from('yt_channel_videos').select('id,title,group_ko,members,thumb,published_at,view_count').eq('group_ko','아이브').limit(20)).data||[];
      const songs=vids.map((v,i)=>({...v,t:v.title,rank:i+1,groupKo:v.group_ko}));
      _openFeedListOverlay('주간 개인 직캠 TOP 20','sub',songs,{});
      await new Promise(r=>setTimeout(r,600));
      const grid=document.getElementById('feed-list-grid');
      const box=document.createElement('div');box.className='cs-story';grid.insertBefore(box,grid.firstChild);
      const today=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
      const dates=[];for(let i=7;i>=1;i--)dates.push(new Date(Date.now()+9*3600e3-i*864e5).toISOString().slice(0,10));
      const by={};songs.forEach((s,i)=>{by[s.id]={};dates.forEach((d,j)=>{if(j>=i%4)by[s.id][d]=Math.min(20,Math.max(1,((i*7+j*3)%20)+1));});});
      const hist={dates,by};const st=_chartStoryStats(songs,hist);
      window.__cs={box,st,hist};
      _csExpanded=false;
      _renderChartStory(box,st,hist,20,'all',()=>{});
      const p=document.getElementById('feed-list-panel').getBoundingClientRect();
      return JSON.stringify({panelTop:p.top,panelH:p.height,vh:innerHeight,mini:box.getBoundingClientRect().height,svgH:box.querySelector('svg').getAttribute('height'),labels:[...box.querySelectorAll('.cs-line.is-top')].length});})()`));
    if(fl.panelH>=fl.vh*0.86)ok(`목록 창 높이 ${fl.panelH.toFixed(0)}px = 화면의 ${(fl.panelH/fl.vh*100).toFixed(0)}% (위에서 ${fl.panelTop.toFixed(0)}px부터)`);else bad(`목록 창 높이 ${fl.panelH}/${fl.vh}`);
    if(+fl.svgH<=100&&fl.labels<=3)ok(`그래프 기본 접힘: 그림 ${fl.svgH}px, 색·이름 상위 ${fl.labels}개, 그래프+숫자 칸 ${fl.mini.toFixed(0)}px`);else bad(`접힘 상태 이상 ${JSON.stringify(fl)}`);
    await shot(c,'v_chart_mini.png');
    const ex=JSON.parse(await ev(c,`(async()=>{const b=window.__cs.box;b.querySelector('.cs-cap').click();await new Promise(r=>setTimeout(r,300));
      const h1=b.querySelector('svg').getAttribute('height'),t1=b.querySelector('.cs-cap').textContent,ls=(()=>{try{return localStorage.getItem('kpu_cs_exp')}catch(e){return null}})();
      return JSON.stringify({h1,t1,ls,ann:!!b.querySelector('.cs-ann')||'none'});})()`));
    if(+ex.h1>=200&&ex.ls==='1')ok(`'크게 보기' → 펼침(${ex.h1}px), 이 기기에 기억`);else bad(`펼침 실패 ${JSON.stringify(ex)}`);
    await sleep(1400);await shot(c,'v_chart_exp.png');
    const col=JSON.parse(await ev(c,`(async()=>{const b=window.__cs.box;b.querySelector('svg').dispatchEvent(new MouseEvent('click',{bubbles:true}));await new Promise(r=>setTimeout(r,200));
      const still=b.querySelector('svg').getAttribute('height');b.querySelector('.cs-cap').click();await new Promise(r=>setTimeout(r,200));return JSON.stringify({still,after:b.querySelector('svg').getAttribute('height')});})()`));
    if(+col.still>=200&&+col.after<=100)ok('펼친 상태에선 그림 클릭이 선 선택(접히지 않음), 접기 버튼으로 다시 접힘');else bad(`접기 ${JSON.stringify(col)}`);
    // 3) 목록 스크롤 → 모바일 스크롤 막대 + 끌기
    const rail=JSON.parse(await ev(c,`(async()=>{const g=document.getElementById('feed-list-grid');
      for(let i=0;i<60;i++){const d=document.createElement('div');d.style.cssText='grid-column:1/-1;height:120px';d.textContent='filler '+i;g.appendChild(d);}
      g.scrollTop=400;g.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,120));
      const R=document.getElementById('kpu-rail'),th=R.querySelector('.kpu-rail-thumb').getBoundingClientRect();
      return JSON.stringify({on:R.classList.contains('on'),thumb:{x:th.left+th.width/2,y:th.top+th.height/2,h:th.height},gb:g.getBoundingClientRect().right,st:g.scrollTop,sh:g.scrollHeight,ch:g.clientHeight});})()`));
    const nb=await ev(c,`[document.getElementById('gc-totop'),document.getElementById('feed-list-top-btn')].filter(b=>b&&getComputedStyle(b).display!=='none'&&getComputedStyle(b).visibility!=='hidden'&&getComputedStyle(b).opacity!=='0').length`);if(nb<=1)ok('맨 위로 버튼 1개만(목록 자체 버튼)');else bad('맨 위로 버튼 '+nb+'개 겹침');
if(rail.on)ok(`스크롤하자 막대 표시(손잡이 ${rail.thumb.h.toFixed(0)}px)`);else bad('막대 안 뜸 '+JSON.stringify(rail));
    // 손가락으로 손잡이를 아래로 300px 끌기
    const tp=(type,y)=>c.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:rail.thumb.x,y}]});
    await tp('touchStart',rail.thumb.y);for(let k=1;k<=10;k++){await tp('touchMove',rail.thumb.y+k*30);await sleep(16);}
    const mid=await ev(c,`document.getElementById('feed-list-grid').scrollTop`);
    await shot(c,'v_rail_drag.png');
    await tp('touchEnd',0);
    if(mid>rail.st+1000)ok(`손잡이 끌기 → 목록이 ${rail.st}→${Math.round(mid)}로 빠르게 이동`);else bad(`끌기 효과 없음 ${rail.st}→${mid}`);
    await sleep(1600);
    if(!(await ev(c,`document.getElementById('kpu-rail').classList.contains('on')`)))ok('멈추고 1.2초 뒤 막대 숨김');else bad('막대가 안 사라짐');
    const lo=await ev(c,`document.getElementById('feed-overlay')?.classList.contains('open')||document.getElementById('feed-list-overlay')?.classList.contains('open')||'?'`);
    // ── 데스크톱 ──
    await c.send('Emulation.setTouchEmulationEnabled',{enabled:false});
    await c.send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'fine'},{name:'hover',value:'hover'}]});
    await c.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});await sleep(8000);
    ok('데스크톱 앱 로드');
    console.log('  데스크톱 입력/화면 조건 '+JSON.stringify(await ev(c,`({fine:matchMedia('(pointer:fine)').matches,coarse:matchMedia('(pointer:coarse)').matches,hover:matchMedia('(hover:hover)').matches,touch:navigator.maxTouchPoints,visibility:document.visibilityState})`)));
    await ev(c,`(showGC('아이브',innerWidth/2,innerHeight*0.4),1)`);await sleep(3500);
    const alb=await ev(c,`(async()=>{await _ensureGroupDisco('아이브');const L=GROUPS['아이브'].discography||[];const i=L.findIndex(a=>(a.tracks||[]).length>=3);_gcDiscogList=L;_openGcDiscogDetail(L[i],i);return L[i]&&L[i].title;})()`);
    await sleep(5000);
    const vp=JSON.parse(await ev(c,`(()=>{const p=document.getElementById('gc-discog-video-panel');const r=p.getBoundingClientRect();return JSON.stringify({hidden:p.hidden,sh:p.scrollHeight,ch:p.clientHeight,n:p.querySelectorAll('.adv-item').length,r:{t:r.top,b:r.bottom,l:r.left,rt:r.right}});})()`));
    if(vp.hidden||vp.sh<=vp.ch*1.6){console.log(`  (앨범 영상 패널이 짧거나 영상을 못 받음 — 건너뜀: ${alb})`);}
    else{
      await ev(c,`(()=>{const p=document.getElementById('gc-discog-video-panel');p.scrollTop=600;p.dispatchEvent(new Event('scroll'));})()`);await sleep(300);
      const tb=JSON.parse(await ev(c,`(()=>{const b=document.getElementById('gc-totop'),r=b.getBoundingClientRect();return JSON.stringify({d:getComputedStyle(b).display,r:{t:r.top,b:r.bottom,l:r.left,rt:r.right}});})()`));
      const inside=tb.r.l>=vp.r.l&&tb.r.rt<=vp.r.rt&&tb.r.b<=vp.r.b&&tb.r.t>=vp.r.t;
      if(tb.d==='flex'&&inside)ok(`앨범 영상 패널(${alb}, 영상 ${vp.n}개) 스크롤 → 맨 위로 버튼이 패널 안 오른쪽 아래에`);else bad(`앨범 패널 버튼 ${JSON.stringify(tb)} 패널 ${JSON.stringify(vp.r)}`);
      await shot(c,'v_album_totop.png');
      const sw=await ev(c,`(()=>{const p=document.getElementById('gc-discog-video-panel');return p.offsetWidth-p.clientWidth;})()`);
      if(sw>=8)ok(`데스크톱 스크롤바 표시(폭 ${sw}px, 끌 수 있음)`);else bad(`데스크톱 스크롤바 폭 ${sw}px `+JSON.stringify(await ev(c,`(()=>{const p=document.getElementById('gc-discog-video-panel'),s=getComputedStyle(p);return {standard:s.scrollbarWidth,pseudo:getComputedStyle(p,'::-webkit-scrollbar').width,border:s.borderLeftWidth};})()`)));
      await ev(c,`(document.getElementById('gc-totop').click(),1)`);
      // 완료 조건은 그대로 맨 위(<2px). 느린 CI의 rAF가 600ms 안에 끝난다고 가정하지 않는다.
      let top0;const topDeadline=Date.now()+3000;
      do{await sleep(100);top0=await ev(c,`document.getElementById('gc-discog-video-panel').scrollTop`);}while(top0>=2&&Date.now()<topDeadline);
      if(top0<2)ok('버튼 누르면 패널 맨 위로');else bad('맨 위로 안 감 '+top0+' '+JSON.stringify(await ev(c,`({target:_totopScrollTarget?.id,visibility:document.visibilityState,button:getComputedStyle(_totopBtn).display})`)));
      await ev(c,`(()=>{const p=document.getElementById('gc-discog-video-panel');p.scrollTop=600;p.dispatchEvent(new Event('scroll'));})()`);await sleep(300);
      await ev(c,`(_closeGcDiscogDetail(),1)`);
      // 같은 숨김 감시도 CI가 정확히 900ms 안에 실행한다고 가정하지 않는다. 숨김 조건은 유지.
      let d2;const hideDeadline=Date.now()+3000;
      do{await sleep(100);d2=await ev(c,`getComputedStyle(document.getElementById('gc-totop')).display`);}while(d2!=='none'&&Date.now()<hideDeadline);
      if(d2==='none')ok('앨범 창을 닫으면 버튼도 사라짐(0.4초 점검)');else bad('닫은 뒤 버튼 남음 '+JSON.stringify(await ev(c,`({target:_totopScrollTarget?.id,watch:!!_totopWatch,albumOpen:document.getElementById('gc-discog-detail').classList.contains('open'),panelHidden:document.getElementById('gc-discog-video-panel').hidden})`)));
    }
    // 기존 카드 버튼 회귀: 그룹 카드(side-panel) 스크롤
    const sp=JSON.parse(await ev(c,`(async()=>{const p=document.getElementById('side-panel');p.scrollTop=500;p.dispatchEvent(new Event('scroll'));await new Promise(r=>setTimeout(r,200));const b=document.getElementById('gc-totop');return JSON.stringify({d:getComputedStyle(b).display,st:p.scrollTop});})()`));
    if(sp.st<100)console.log('  (그룹 카드가 짧아 회귀 확인 생략)');else if(sp.d==='flex')ok('기존 그룹 카드 맨 위로 버튼 그대로');else bad('그룹 카드 버튼 안 뜸');
    console.log(`\n${pass}/${pass+fail}`);
    c.close();
  }catch(e){console.log('ERR',e.message);fail++;}
  finally{try{process.kill(proc.pid);}catch(e){}server.close();process.exit(fail?1:0);}
})();
