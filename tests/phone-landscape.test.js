// 폰 가로(844×390 터치) 배치 회귀 테스트 (2026-10-30 사용자 "모바일을 가로로 돌리면 막 겹친다 — 저번에 요청했는데 반영 안 됐다")
//  원인: 화면을 폭으로만 나눠(768 이하=폰, 1024 이상=웹) 폰 가로(폭 844)가 둘 사이에 걸려 PC·폰 배치가 섞였다.
//  ① 폰 판정: isMob()가 참이고 PC 전용 규칙(min-width:769px)이 꺼져 있다 — 탐험 패널이 화면 전체 폭
//  ② 재생 화면(가로 영상): 영상은 왼쪽, 제목은 그 오른쪽 — 둘이 겹치지 않고 둘 다 화면 안
//  ③ 쇼츠: 세로 영상과 제목이 겹치지 않고 제목이 화면 안(예전엔 위로 잘렸다)
//  ④ 세로 화면(390×844)은 예전 그대로 — 제목이 영상 아래
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저가 없으면 스킵.
// 배치 측정은 실제 클릭처럼 제목이 든 목록을 넘긴다. 제목을 DB에서 받기 전의 숨은 빈 요소를 제목 위치로 재지 않는다.
// 실행: node tests/phone-landscape.test.js
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const fullscreenTouch=require('./fixtures/lb_fullscreen_touch.cjs');
const graphicsBootFailure=require('./fixtures/graphics_boot_failure.cjs');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8994,CDP_PORT=9394;
const BROWSER=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const server=http.createServer((req,res)=>{if(fullscreenTouch.serve(req,res,ROOT,PORT))return;const p=decodeURIComponent(req.url.split('?')[0]);const f=path.join(ROOT,p==='/'?'index.html':p);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map();
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}});ws.addEventListener('error',rej);});}
async function ev(c,x){const r=await c.send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const RECT=`(id)=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom};}`;
const overlap=(a,b)=>a&&b&&a.x<b.r-1&&b.x<a.r-1&&a.y<b.b-1&&b.y<a.b-1;
const inView=(a,W,H)=>a&&a.w>0&&a.h>0&&a.x>=-1&&a.y>=-1&&a.r<=W+1&&a.b<=H+1;
async function setup(c,W,H){
  await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true,screenOrientation:W>H?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});
  await c.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'},{name:'hover',value:'none'}]});
  await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});await sleep(8000);
  for(let i=0;i<30&&!(await ev(c,"typeof openLightbox==='function'&&typeof isMob==='function'"));i++)await sleep(400);
}
(async()=>{
  if(!BROWSER){console.log('⏭️  브라우저를 못 찾음 — 스킵');process.exit(0);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-land-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=844,390','about:blank'],{stdio:['ignore','ignore','pipe']});
  try{
    await waitForBrowserCdp(proc,CDP_PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    if(!process.argv.includes('--fullscreen-only'))for(const r of await graphicsBootFailure(c,ev,PORT))r.ok?ok(r.name):bad(r.name+' '+JSON.stringify(r));
    for(const r of await fullscreenTouch.check(c,ev,PORT))r.ok?ok(r.name):bad(r.name+' '+JSON.stringify(r));
    if(process.argv.includes('--fullscreen-only')){c.close();return;}
    // ── 가로 ──
    await setup(c,844,390);
    ok(`가로 — 폰 판정 isMob()=${await ev(c,'isMob()')}`);if(!(await ev(c,'isMob()'))){pass--;bad('가로인데 isMob() 거짓');}
    await ev(c,"document.getElementById('tab-feed')?.click()");await sleep(1500);
    const fo=await ev(c,`(${RECT})('feed-overlay')`);
    if(fo&&fo.w>=830)ok(`탐험 패널 전체 폭(${Math.round(fo.w)}px)`);else bad('탐험 패널이 전체 폭이 아님 '+JSON.stringify(fo));
    await ev(c,"document.getElementById('tab-feed')?.click();typeof _closeFeedOverlay==='function'&&_closeFeedOverlay()");await sleep(600);
    await ev(c,"openLightbox('https://www.youtube.com/watch?v=koED8KSXfeo',false,[{u:'https://www.youtube.com/watch?v=koED8KSXfeo',t:'LAYOUT TEST — 가로 화면의 긴 영상 제목과 재생 영역이 겹치지 않아야 합니다',dur:230}],0)");await sleep(2500);
    let v=await ev(c,`(${RECT})('yt-lb-video-box')`),t=await ev(c,`(${RECT})('yt-lb-title-text')`);
    if(inView(v,844,390)&&inView(t,844,390)&&!overlap(v,t)&&t.x>=v.r)ok('가로 영상: 영상 왼쪽·제목 오른쪽, 겹침 없음');else bad('가로 영상 배치 '+JSON.stringify({v,t}));
    await ev(c,'closeLightbox()');await sleep(800);
    await ev(c,"openLightbox('https://youtube.com/shorts/EJqu6C_HFp0',true,[{u:'https://youtube.com/shorts/EJqu6C_HFp0',t:'LAYOUT TEST — 쇼츠의 긴 제목이 화면 안에 표시되어야 합니다',is_short:true,dur:30}],0)");await sleep(2500);
    v=await ev(c,`(${RECT})('yt-lb-video-box')`);t=await ev(c,`(${RECT})('yt-lb-title-text')`);
    if(inView(v,844,390)&&inView(t,844,390)&&!overlap(v,t))ok('쇼츠: 세로 영상·제목 둘 다 화면 안, 겹침 없음');else bad('쇼츠 배치 '+JSON.stringify({v,t}));
    await ev(c,'closeLightbox()');await sleep(500);
    // ── 세로(예전 그대로) ──
    await setup(c,390,844);
    await ev(c,"openLightbox('https://www.youtube.com/watch?v=koED8KSXfeo',false,[{u:'https://www.youtube.com/watch?v=koED8KSXfeo',t:'LAYOUT TEST — 가로 화면의 긴 영상 제목과 재생 영역이 겹치지 않아야 합니다',dur:230}],0)");await sleep(2500);
    v=await ev(c,`(${RECT})('yt-lb-video-box')`);t=await ev(c,`(${RECT})('yt-lb-title-text')`);
    if(v&&t&&t.y>=v.b-1)ok('세로 영상: 제목이 영상 아래(기존 배치 유지)');else bad('세로 배치가 바뀜 '+JSON.stringify({v,t}));
    // 실제 조합 렌더러만 호출하며 검색 쿼리/운영 데이터 쓰기는 하지 않는다.
    await ev(c,`document.getElementById('combo-overlay').classList.add('open');
      _comboSel=['수빈','연준','범규','태현','휴닝카이','태용','도영','재현','마크','해찬'].map((name,i)=>({name,group:i<5?'투모로우바이투게더':'NCT 127'}));
      _comboRenderChips();_comboRenderSuggest('민');
      document.getElementById('combo-results').textContent='LAYOUT TEST — result area';`);
    for(const [W,H] of [[320,568],[390,844],[844,390],[1280,800]]){
      await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
      await ev(c,`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const measure=await ev(c,`(()=>{
        const sheet=document.getElementById('combo-sheet'),go=document.getElementById('combo-go'),results=document.getElementById('combo-results');
        sheet.scrollTop=0;const overflowing=sheet.scrollHeight>sheet.clientHeight+1;
        go.scrollIntoView({block:'center'});const button=(${RECT})('combo-go');
        results.scrollIntoView({block:'end'});const area=(${RECT})('combo-results'),panel=(${RECT})('combo-sheet');
        return {button,area,panel,overflowing,overflow:getComputedStyle(sheet).overflowY,suggestions:document.getElementById('combo-suggest').children.length};
      })()`);
      if(measure.suggestions>0&&inView(measure.button,W,H)&&inView(measure.area,W,H)&&measure.area.h>=Math.min(120,H*.25)-1&&measure.area.b<=measure.panel.b+1&&(!measure.overflowing||['auto','scroll'].includes(measure.overflow)))ok(`조합 ${W}×${H}: 10명+검색 후보에서도 버튼·결과 접근 가능`);
      else bad(`조합 ${W}×${H} 잘림 `+JSON.stringify(measure));
    }
    // 오류/부분 결과 UI의 실제 렌더러·CSS·재시도 터치. 합성 상태만 쓰며 조회/저장을 호출하지 않는다.
    // 이 아래는 곡 상태의 격리 fixture다. 첫 방문 안내 자체는 mobile-first-visit에서 검증한다.
    await ev(c,`(async()=>{_dismissTips();for(let i=0;i<20&&!document.getElementById('ob-tips').hidden;i++)await new Promise(r=>setTimeout(r,25));_closeComboPanel();window.__songRetryTouches=0;return true;})()`);
    for(const [W,H,lang,partial] of [[320,568,'ko',false],[390,844,'en',true]]){
      await c.send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:2,mobile:true});
      await ev(c,`currentLang=${JSON.stringify(lang)};
        document.getElementById('gc-track-videos-overlay').classList.add('open');_bringToFront(document.getElementById('gc-track-videos-overlay'));
        _songVid={gko:'에스파',orig:${partial?"[{id:'koED8KSXfeo',title:'LAYOUT TEST — retained video',group_ko:'에스파',category:'live'}]":'[]'},cover:[],tab:'all',fmt:'all',sort:'latest',rows:[],member:null,loadFailed:true,retry:()=>window.__songRetryTouches++};
        _renderSongVideoTabs();new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));`);
      const issue=await ev(c,`(()=>{const list=document.getElementById('gc-track-videos-list'),b=list.querySelector('.gc-ch-err-retry');if(!b)return null;const r=b.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,text:list.textContent,rows:list.querySelectorAll('.tvf-item').length,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[id]')?.id,guide:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#ob-tips'),front:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.gc-ch-err-retry')===b};})()`);
      if(issue&&issue.h>=44&&issue.y>=0&&issue.b<=H&&issue.front&&issue.rows===(partial?1:0)&&!(/No matching videos|관련 영상이 없어요/.test(issue.text)))ok(`곡 조회 ${W}px: 오류/부분 결과·44px 재시도 버튼`);else bad('곡 조회 복구 배치 '+JSON.stringify(issue));
      if(issue?.front){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:issue.x+issue.w/2,y:issue.y+issue.h/2}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    }
    if(await ev(c,'window.__songRetryTouches===2'))ok('곡 조회 실패/부분 결과 모두 실제 터치로 재시도 호출');else bad('곡 조회 재시도 터치 누락');
    // 아이콘의 실제 그려진 크기와 별개로, 손가락으로 닫는 영역을 확인한다.
    for(const [id,open,close,overlay] of [['combo-close','_openComboPanel()',"_closeComboPanel()",'combo-overlay'],['gc-track-videos-close',"document.getElementById('gc-track-videos-overlay').classList.add('open');_bringToFront(document.getElementById('gc-track-videos-overlay'))","document.getElementById('gc-track-videos-overlay').classList.remove('open')",'gc-track-videos-overlay']]){
      await ev(c,open+';new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const target=await ev(c,`(()=>{const b=document.getElementById(${JSON.stringify(id)}),r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,w:r.width,h:r.height,coarse:matchMedia('(pointer:coarse)').matches,hits:[[-20,0],[20,0],[0,-20],[0,20]].map(([dx,dy])=>document.elementFromPoint(x+dx,y+dy)?.closest('#'+b.id)===b)};})()`);
      if(target.coarse&&target.hits.every(Boolean))ok(id+' 중심에서20px 네 방향도 닫기 영역');else bad(id+' 좁은 터치 영역 '+JSON.stringify(target));
      if(target.hits[0]){await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:target.x-20,y:target.y}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(200);}
      if(await ev(c,`!document.getElementById(${JSON.stringify(overlay)}).classList.contains('open')`))ok(id+' 아이콘 바깥쪽 터치로도 정상 닫힘');else bad(id+' 가장자리 터치가 닫지 못함');
      await ev(c,close+';true');
    }
    for(const lang of ['en','ko']){
      const metadata=await ev(c,`currentLang=${JSON.stringify(lang)};applyLang();({lang:document.documentElement.lang,english:document.body.classList.contains('lang-en')})`);
      if(metadata.lang===lang&&metadata.english===(lang==='en'))ok(lang+' 화면/문서 언어 일치');else bad('언어 메타데이터 '+JSON.stringify(metadata));
    }
    // 합성 clipboard/execCommand만 사용한다. 실제 클립보드를 읽거나 쓰지 않는다.
    for(const lang of ['ko','en']){
      const copy=await ev(c,`(async()=>{
        const descriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard'),exec=document.execCommand;
        const count=document.querySelectorAll('textarea').length;
        try{
          Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('synthetic denied');}}});document.execCommand=()=>false;
          currentLang=${JSON.stringify(lang)};const copied=await _copyShareLink('https://example.test/synthetic');
          const toast=document.getElementById('share-toast');return {copied,text:toast.textContent,visible:toast.classList.contains('show'),clean:document.querySelectorAll('textarea').length===count};
        }finally{if(descriptor)Object.defineProperty(navigator,'clipboard',descriptor);else delete navigator.clipboard;document.execCommand=exec;}
      })()`);
      if(copy.copied===false&&copy.visible&&copy.clean&&(lang==='ko'?/복사에 실패/.test(copy.text):/Failed to copy/.test(copy.text)))ok(lang+' 복사 차단: 실제 실패 토스트·임시 입력 제거');else bad('복사 결과 '+JSON.stringify(copy));
    }
    c.close();
  }catch(e){bad('예외: '+e.message);}
  finally{try{process.kill(proc.pid);}catch(e){}server.close();console.log(`\n${pass} 통과 / ${fail} 실패`);setTimeout(()=>process.exit(fail?1:0),300);}
})();
