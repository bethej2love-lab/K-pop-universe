// 웹 무대 3~4단계(2026-10-28) — ① 공연·공연장 창이 카드 옆 무대에(어두운 배경 없음)·재생 화면과 차례·창 안 '‹ 뒤로'·폰은 바텀시트
// ② 나침반이 열려 있어도 앨범에서 곡을 누르면 옆 영상 패널로(예전엔 곡 오버레이로 빠졌다), 무대가 좁으면 앨범 창이 나침반 위로 넓어짐. ③ 트로피·인스타 사진 보기도 같은 무대(Esc는 앞 창부터).
// ⚠️ 실DB 브라우저 테스트 — CI 스킵 목록(browser). 실행: node tests/stage-venue-album.test.js  (KPU_SHOT=폴더 → 캡처 저장)
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
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
async function shot(c,name){if(!process.env.KPU_SHOT)return;const r=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.env.KPU_SHOT,name+'.png'),Buffer.from(r.data,'base64'));}
// 가짜 공연(실제 공연장 이름) — 공연 창 → 공연장 칩 → '‹'
const MKEV=`(async()=>{await _ensureVenuesInfo();const vn=Object.keys(_venuesInfo).find(k=>_venuesInfo[k]&&_venuesInfo[k].src==='kopis')||Object.keys(_venuesInfo)[0];
  window.__ev={id:'t-stage',title:'TEST CONCERT',type:'concert',groups:['아이브'],date_start:'2026-12-01',date_end:'2026-12-02',venue:vn,city:'Seoul',country:'KR',poster_url:null,official_url:null};return vn;})()`;
const R=`(el)=>{const r=el.getBoundingClientRect();return{l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom),w:Math.round(r.width)};}`;
(async()=>{
  if(!BROWSER){console.log("⏭️  브라우저를 못 찾음 — 스킵");process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-sv-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,900','about:blank'],{stdio:'ignore'});
  try{
    await waitCdp();
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    const load=async(w,h,mobile)=>{
      await c.send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile});
      await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});
      for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,`typeof showGC==='function'&&ARTISTS.length>0&&!!sb`))break;}catch(e){}}
      await sleep(1500);
    };
    for(const W of [1400,1920]){
      await load(W,900,false);
      const r=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const R=${R};const res={};
        _obActive=false;try{localStorage.setItem(_OB_KEY,'1');}catch(e){} // 첫 방문 온보딩(자동으로 연 나침반은 다른 걸 건드리면 닫힘) 제외
        const fo=document.getElementById('feed-overlay');if(!fo.classList.contains('open'))_openFeedOverlay();await S(2500);
        showGC('아이브',innerWidth/2,innerHeight*0.4);await S(2500);
        await _ensureGroupDisco('아이브');const L=GROUPS['아이브'].discography||[];const i=L.findIndex(a=>(a.tracks||[]).length>=3&&(a.tracks||[]).some(t=>t.isTitle));
        _gcDiscogList=L;_openGcDiscogDetail(L[i],i);await S(2500);
        const t=L[i].tracks.find(t=>t.isTitle).title;_albTrackClick(t);await S(2500);
        const sheet=document.getElementById('gc-discog-detail-sheet'),vp=document.getElementById('gc-discog-video-panel'),card=document.getElementById('side-panel');
        res.alb={sheet:R(sheet),vp:R(vp),vpShown:!vp.hidden&&getComputedStyle(vp).display!=='none',isSong:vp.classList.contains('is-song'),
          songOverlay:!!document.getElementById('gc-track-videos-overlay')?.classList.contains('open'),card:R(card),fo:R(fo),
          topHit:!!document.elementFromPoint(sheet.getBoundingClientRect().left+40,sheet.getBoundingClientRect().top+120)?.closest('#gc-discog-detail')};
        return JSON.stringify(res);})()`));
      await shot(c,`stage-album-${W}`);
      const r1=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const R=${R};const res={};
        const fo=document.getElementById('feed-overlay'),card=document.getElementById('side-panel');
        _closeGcDiscogDetail();await S(800);
        res.vn=await ${MKEV};
        _openConcertSheet(__ev);await S(1500);
        const ov=document.getElementById('venue-overlay'),vpn=document.getElementById('venue-panel');
        res.c1={open:ov.classList.contains('open'),front:document.body.dataset.stageFront,panel:R(vpn),card:R(card),fo:R(fo),bg:getComputedStyle(ov).backgroundColor,
          title:document.getElementById('venue-panel-title').textContent,back:document.getElementById('venue-panel-back').hidden};
        document.querySelector('#venue-panel .concert-venue-chip')?.click();await S(2500);
        res.c2={title:document.getElementById('venue-panel-title').textContent,back:document.getElementById('venue-panel-back').hidden,items:document.querySelectorAll('#venue-panel-list > *').length};
        return JSON.stringify(res);})()`));
      await shot(c,`stage-venue-${W}`);
      const r2=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const res={};
        document.getElementById('venue-panel-back').click();await S(800);
        res.back={title:document.getElementById('venue-panel-title').textContent,back:document.getElementById('venue-panel-back').hidden};
        for(let k=0;k<20&&!document.querySelector('#side-panel .gc-ch-item');k++)await S(300);(document.querySelector('#side-panel .gc-ch-item')||document.querySelector('#tv .gc-ch-item'))?.click();await S(2500);res.lbOpened=document.getElementById('yt-lightbox').classList.contains('open');
        const lb=document.getElementById('yt-lightbox'),ov=document.getElementById('venue-overlay');
        res.lbFront={fo:document.getElementById('feed-overlay').classList.contains('open'),front:document.body.dataset.stageFront,venueVis:getComputedStyle(ov).visibility};
        _openConcertSheet(__ev);await S(800);
        res.venueFront={front:document.body.dataset.stageFront,lbVis:getComputedStyle(lb).visibility,toLb:getComputedStyle(document.getElementById('venue-to-lb')).display};
        document.getElementById('venue-to-lb').click();await S(500);
        res.toLb={front:document.body.dataset.stageFront,venueVis:getComputedStyle(ov).visibility};
        closeLightbox();await S(1000);
        res.afterLb={fo:document.getElementById('feed-overlay').classList.contains('open'),front:document.body.dataset.stageFront,venueVis:getComputedStyle(ov).visibility,lbOpen:lb.classList.contains('open')};
        document.getElementById('venue-panel-close').click();await S(600);
        res.closed={fo:document.getElementById('feed-overlay').classList.contains('open'),open:ov.classList.contains('open'),left:ov.style.left};
        closeCards();await S(1500);res.wide=document.body.classList.contains('fw-home');await S(1500);res.wide2=document.body.classList.contains('fw-home');res.foOpen=document.getElementById('feed-overlay').classList.contains('open');res.openIds=_FW_BLOCKERS.filter(id=>document.getElementById(id)?.classList.contains('open'));
        return JSON.stringify(res);})()`));
      const a=r.alb;
      if(a.vpShown&&a.isSong&&!a.songOverlay)ok(`[${W}] 나침반 열린 채 앨범 곡 → 옆 영상 패널(곡 오버레이 아님)`);else bad(`[${W}] 앨범 곡 `+JSON.stringify(a));
      if(a.sheet.w>=400&&a.vp.w>=300&&a.vp.r<=a.card.l+1&&a.vp.l>=a.sheet.r-1)ok(`[${W}] 시트 ${a.sheet.w}·패널 ${a.vp.w}, 카드 왼쪽에 나란히(${a.sheet.l}~${a.vp.r})`);else bad(`[${W}] 앨범 자리 `+JSON.stringify(a));
      if(a.topHit)ok(`[${W}] 앨범 창이 나침반보다 위`);else bad(`[${W}] 앨범이 가려짐`);
      const c1=r1.c1;
      if(c1.open&&c1.front==='venue'&&c1.panel.r<=c1.card.l+1&&c1.panel.l>=c1.fo.r-1&&/rgba\(0, 0, 0, 0\)|transparent/.test(c1.bg))ok(`[${W}] 공연 창 = 무대(카드 왼쪽 ${c1.panel.l}~${c1.panel.r}, 배경 없음)`);else bad(`[${W}] 공연 창 `+JSON.stringify(c1));
      if(c1.fo.r-c1.fo.l===440)ok(`[${W}] 공연 창 열면 나침반 440`);else bad(`[${W}] 나침반 폭 ${c1.fo.r-c1.fo.l}`);
      if(c1.back&&r1.c2.title!==c1.title&&!r1.c2.back&&r2.back.title===c1.title&&r2.back.back)ok(`[${W}] 공연 → 공연장('${r1.c2.title}', ${r1.c2.items}줄) → ‹ 뒤로 → 공연`);else bad(`[${W}] 뒤로 `+JSON.stringify([c1.title,c1.back,r1.c2,r2.back]));
      if(r2.lbFront.front==='lb'&&r2.lbFront.venueVis==='hidden')ok(`[${W}] 영상 재생 → 공연 창 뒤로 비킴`);else bad(`[${W}] 재생 차례 `+JSON.stringify([r2.lbOpened,r2.lbFront]));
      if(r2.venueFront.front==='venue'&&r2.venueFront.lbVis==='hidden'&&r2.venueFront.toLb!=='none')ok(`[${W}] 재생 중 공연 창 → 앞, '재생 화면으로' 보임`);else bad(`[${W}] 공연 앞 `+JSON.stringify(r2.venueFront));
      if(r2.toLb.front==='lb'&&r2.toLb.venueVis==='hidden')ok(`[${W}] '재생 화면으로' → 재생 앞`);else bad(`[${W}] toLb `+JSON.stringify(r2.toLb));
      if(!r2.afterLb.lbOpen&&r2.afterLb.front==='venue'&&r2.afterLb.venueVis==='visible')ok(`[${W}] 재생 닫으면 공연 창 다시 앞`);else bad(`[${W}] 재생 닫기 `+JSON.stringify(r2.afterLb));
      if(!r2.closed.open&&!r2.closed.left&&r2.wide)ok(`[${W}] 닫기 → 정리, 카드까지 닫으면 나침반 다시 넓게`);else bad(`[${W}] 닫기 `+JSON.stringify([r2.closed,r2.wide,r2.wide2,r2.foOpen,r2.openIds]));
      // 4단계 — 트로피·인스타 사진 보기도 같은 무대
      const r3=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));const R=${R};const res={};
        const fo=document.getElementById('feed-overlay'),card=document.getElementById('side-panel'),lb=document.getElementById('yt-lightbox');
        showGC('아이브',innerWidth/2,innerHeight*0.4);await S(2500);
        _openTrophyPanel({music_show:[{win_date:'2026-10-01',show:'TEST',song_title:'LUCID DREAM'}]});await S(800);
        const tov=document.getElementById('trophy-overlay');
        res.t1={open:tov.classList.contains('open'),front:document.body.dataset.stageFront,panel:R(document.getElementById('trophy-panel')),card:R(card),fo:R(fo),bg:getComputedStyle(tov).backgroundColor};
        (document.querySelector('#side-panel .gc-ch-item'))?.click();await S(2500);
        res.t2={front:document.body.dataset.stageFront,vis:getComputedStyle(tov).visibility};
        _openTrophyPanel({music_show:[{win_date:'2026-10-01',show:'TEST',song_title:'LUCID DREAM'}]});await S(600);
        res.t3={front:document.body.dataset.stageFront,lbVis:getComputedStyle(lb).visibility,toLb:getComputedStyle(document.getElementById('trophy-to-lb')).display};
        document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await S(600);
        res.t4={trophyOpen:tov.classList.contains('open'),lbOpen:lb.classList.contains('open'),front:document.body.dataset.stageFront};
        _openIgViewer({u:'https://example.invalid/x.jpg',p:'https://www.instagram.com/p/x/',t:new Date().toISOString(),cap:'TEST CAPTION'},'ivestarship',0);await S(900);
        const iov=document.getElementById('igv-overlay');
        res.i1={open:iov.classList.contains('open'),front:document.body.dataset.stageFront,panel:R(document.getElementById('igv-panel')),card:R(card),fo:R(fo),narrow:iov.classList.contains('igv-narrow'),lbVis:getComputedStyle(lb).visibility,toLb:getComputedStyle(iov.querySelector('.sw-to-lb')).display};
        _closeIgViewer();await S(600);
        res.i2={open:iov.classList.contains('open'),front:document.body.dataset.stageFront,lbVis:getComputedStyle(lb).visibility};
        closeLightbox();await S(800);closeCards();await S(1500);
        return JSON.stringify(res);})()`));
      const{t1,t2,t3,t4,i1,i2}=r3;
      if(t1.open&&t1.front==='trophy'&&t1.panel.r<=t1.card.l+1&&t1.panel.l>=t1.fo.r-1&&/rgba\(0, 0, 0, 0\)|transparent/.test(t1.bg))ok(`[${W}] 트로피 창 = 무대(${t1.panel.l}~${t1.panel.r}, 배경 없음)`);else bad(`[${W}] 트로피 `+JSON.stringify(t1));
      if(t2.front==='lb'&&t2.vis==='hidden'&&t3.front==='trophy'&&t3.lbVis==='hidden'&&t3.toLb!=='none')ok(`[${W}] 트로피 ↔ 재생 화면 차례·'재생 화면으로'`);else bad(`[${W}] 트로피 차례 `+JSON.stringify([t2,t3]));
      if(!t4.trophyOpen&&t4.lbOpen&&t4.front==='lb')ok(`[${W}] Esc = 앞에 나온 트로피만 닫고 재생 화면은 유지`);else bad(`[${W}] Esc `+JSON.stringify(t4));
      if(i1.open&&i1.front==='igv'&&i1.panel.r<=i1.card.l+1&&i1.panel.l>=i1.fo.r-1&&i1.lbVis==='hidden'&&i1.toLb!=='none'&&i1.narrow===(i1.card.l-i1.fo.r<900))ok(`[${W}] 인스타 사진 = 무대(${i1.panel.l}~${i1.panel.r}${i1.narrow?', 좁아서 세로로':''})`);else bad(`[${W}] 인스타 `+JSON.stringify(i1));
      if(!i2.open&&i2.front==='lb'&&i2.lbVis==='visible')ok(`[${W}] 인스타 닫으면 재생 화면 다시 앞`);else bad(`[${W}] 인스타 닫기 `+JSON.stringify(i2));
      await shot(c,`stage-trophy-${W}`);
    }
    // 폰: 바텀시트
    await load(390,844,true);
    const m=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));await ${MKEV};
      _openConcertSheet(__ev);await S(1200);const p=document.getElementById('venue-panel').getBoundingClientRect();
      const res={b:Math.round(p.bottom),w:Math.round(p.width),h:innerHeight,rad:getComputedStyle(document.getElementById('venue-panel')).borderBottomLeftRadius};
      document.querySelector('#venue-panel .concert-venue-chip')?.click();await S(2000);res.back=!document.getElementById('venue-panel-back').hidden;
      return JSON.stringify(res);})()`));
    await shot(c,'stage-venue-390');
    const m2=JSON.parse(await ev(c,`(async()=>{_closeVenueOverlay();await new Promise(r=>setTimeout(r,500));return JSON.stringify({closed:!document.getElementById('venue-overlay').classList.contains('open')});})()`));
    if(Math.abs(m.b-m.h)<=1&&m.w===390&&m.rad==='0px')ok(`[390] 공연 창 = 바텀시트(바닥 붙음·폭 꽉)`);else bad('[390] 시트 '+JSON.stringify(m));
    if(m.back&&m2.closed)ok('[390] 공연장으로 이어 열면 ‹, 닫기 정리');else bad('[390] '+JSON.stringify([m,m2]));
    const tm=JSON.parse(await ev(c,`(async()=>{const S=ms=>new Promise(r=>setTimeout(r,ms));
      _openTrophyPanel({music_show:[{win_date:'2026-10-01',show:'TEST',song_title:'LUCID DREAM'}]});await S(900);
      const p=document.getElementById('trophy-panel').getBoundingClientRect();const res={b:Math.round(p.bottom),w:Math.round(p.width),h:innerHeight};
      _closeTrophyOverlay();await S(500);res.closed=!document.getElementById('trophy-overlay').classList.contains('open');return JSON.stringify(res);})()`));
    if(Math.abs(tm.b-tm.h)<=1&&tm.w===390&&tm.closed)ok('[390] 트로피 창 = 바텀시트, 닫기 정리');else bad('[390] 트로피 '+JSON.stringify(tm));
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{proc.kill();}catch(e){}server.close();}
  console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
