// 통합 차트 순위 기록(rank_snapshots) — 매일 1번(chart-snapshots.yml). 2026-11-05 차트 통합과 함께 신설.
//
// 왜 브라우저로 앱을 띄워 계산하나: 예전 기록(solo_cam·monthly_stage)은 Vercel 크론이 **자기 코드로** 차트를 다시 계산했고,
// 화면 코드만 바뀌면 둘이 어긋나 멀쩡한 영상이 NEW로 찍혔다(2026-09-18 실측 — 월간 30자리 중 15개). 여기선 앱의 _chartSongs를
// 그대로 불러서 화면과 **같은 함수, 같은 결과**를 기록한다. 대조 테스트가 필요 없게 구조로 막는다.
//
// 기록 범위: 차트 3개(직캠·퍼포먼스·MV) × 기간 4개(1주·1달·1년·역대) × 성별 3개(전체·보이그룹·걸그룹), 세대는 '전체'만.
// 이름 = `${id}:${era}:${gender}`(앱 _chartSnapKey와 같다). 날짜 = 한국 날짜. 그날 것을 지우고 다시 넣어 재실행해도 안전.
// 40일 지난 통합 기록은 지운다(그림은 최근 14일·변동 배지는 7일 전까지만 본다 — 테이블이 끝없이 커지지 않게).
//
// 실행: SUPABASE_SERVICE_ROLE=... node tools/snapshot_charts.cjs   (DRY=1이면 계산만 하고 안 씀)
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const{waitForBrowserCdp}=require('./browser_test_runtime.cjs');
const ROOT=path.join(__dirname,'..');
const PORT=8998,CDP_PORT=9398;
const SB_URL=process.env.SUPABASE_URL||'https://dukgguehegnembimqvkm.supabase.co';
const KEY=process.env.SUPABASE_SERVICE_ROLE;
const DRY=process.env.DRY==='1';
if(!KEY&&!DRY){console.error('SUPABASE_SERVICE_ROLE 없음 — DRY=1로만 실행 가능');process.exit(1);}
const BROWSER=[process.env.KPU_BROWSER_PATH,'/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean).find(p=>fs.existsSync(p));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]);const f=path.join(ROOT,p==='/'?'index.html':p);
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map();
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}});ws.addEventListener('error',rej);});}
async function ev(c,x){const r=await c.send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true,timeout:600000});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const CHARTS=['soloCam','stage','mv'],ERAS=['w','m','y','all'],GENDERS=['all','m','f'];
const kstToday=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
async function sb(method,pathq,body,prefer){
  const r=await fetch(`${SB_URL}/rest/v1/${pathq}`,{method,headers:{apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error(`${method} ${pathq.slice(0,60)} → ${r.status} ${(await r.text()).slice(0,300)}`);
}
(async()=>{
  if(!BROWSER){console.error('브라우저를 못 찾음');process.exit(1);}
  server.listen(PORT);
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-snap-'));
  const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--window-size=1280,900','about:blank'],{stdio:['ignore','ignore','pipe']});
  let code=0;
  try{
    await waitForBrowserCdp(proc,CDP_PORT);
    const{webSocketDebuggerUrl}=await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json();
    const c=await conn(webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
    await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html`});
    let ready=false;for(let i=0;i<90&&!ready;i++){await sleep(1000);try{ready=await ev(c,`typeof _chartSongs==='function'&&typeof _chartSnapKey==='function'&&!!sb&&typeof GROUPS==='object'&&Object.keys(GROUPS).length>50`);}catch(e){}}
    if(!ready)throw new Error('앱이 90초 안에 준비되지 않음');
    // 차례로 계산 — 한꺼번에 던지면 DB에 무거운 정렬 조회 36개가 몰린다
    const out=JSON.parse(await ev(c,`(async()=>{
      const res={};
      for(const id of ${JSON.stringify(CHARTS)})for(const era of ${JSON.stringify(ERAS)})for(const gender of ${JSON.stringify(GENDERS)}){
        const sel={..._CHART_SEL_DEFAULT,era,gender,gen:'all'};
        const key=_chartSnapKey(id,sel);
        try{const s=await _chartSongs(id,sel);res[key]=s.map(x=>x._apiId).filter(Boolean);}catch(e){res[key]={error:String(e&&e.message||e)}}
      }
      return JSON.stringify(res);})()`));
    c.close();
    const today=kstToday(),rows=[],bad=[];
    for(const[key,ids]of Object.entries(out)){
      if(!Array.isArray(ids)){bad.push(`${key}: ${ids.error}`);continue;}
      // 긴 기간(1년·역대)이 0개면 조회가 조용히 실패한 것이다(_chartSongs는 오류를 빈 배열로 돌려준다) — 0건 저장을 초록불로 묻지 않는다
      if(!ids.length&&/:(y|all):/.test(key)){bad.push(`${key}: 0개`);continue;}
      [...new Set(ids)].slice(0,100).forEach((v,i)=>rows.push({chart_type:key,snapshot_date:today,video_id:v,rank:i+1}));
      console.log(`${key.padEnd(18)} ${ids.length}개`);
    }
    console.log(`합계 ${rows.length}행 · 날짜 ${today}${bad.length?` · ⚠️ 실패 ${bad.length}: ${bad.join(' / ')}`:''}`);
    if(DRY){console.log('DRY — 기록 안 함');}
    else{
      const keys=[...new Set(rows.map(r=>r.chart_type))];
      if(keys.length){
        // 그날 것 지우고 다시(같은 날 재실행 때 빠진 영상이 남지 않게) — 이번에 계산된 이름만
        await sb('DELETE',`rank_snapshots?snapshot_date=eq.${today}&chart_type=in.(${keys.map(k=>`"${k}"`).join(',')})`);
        for(let i=0;i<rows.length;i+=1000)await sb('POST','rank_snapshots?on_conflict=chart_type,snapshot_date,video_id',rows.slice(i,i+1000),'resolution=merge-duplicates,return=minimal');
      }
      const cut=new Date(Date.parse(today)-40*864e5).toISOString().slice(0,10);
      await sb('DELETE',`rank_snapshots?chart_type=like.*:*&snapshot_date=lt.${cut}`);
      console.log(`기록 완료 ${rows.length}행 · ${cut} 이전 통합 기록 정리`);
    }
    if(bad.length)code=1;
  }catch(e){console.error('실패:',e.message);code=1;}
  finally{try{proc.kill();}catch(e){}server.close();}
  process.exit(code);
})();
