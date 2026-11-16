// 보관함 선택 모드 + 일괄 태깅 + 직전 태그(2026-11-16) — 실제 화면, 인메모리 태그 API, 운영 DB 쓰기 없음.
const fs=require('fs'),path=require('path'),http=require('http'),os=require('os');const{spawn}=require('child_process');
const ROOT=path.join(__dirname,'..');
const {waitForBrowserCdp}=require('../tools/browser_test_runtime.cjs');
const PORT=8999,CDP_PORT=9399;
const BROWSER=process.env.KPU_BROWSER_PATH||['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/usr/bin/google-chrome','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]);const f=path.join(ROOT,p==='/'?'index.html':p);
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
function conn(url){return new Promise((res,rej)=>{const ws=new WebSocket(url);let id=0;const w=new Map();
  ws.addEventListener('open',()=>res({send:(m,p)=>new Promise((a,b)=>{const i=++id;w.set(i,{a,b});ws.send(JSON.stringify({id:i,method:m,params:p}));}),close:()=>ws.close()}));
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&w.has(m.id)){const{a,b}=w.get(m.id);w.delete(m.id);m.error?b(new Error(m.error.message)):a(m.result);}});ws.addEventListener('error',rej);});}
async function ev(c,x){const r=await c.send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function waitFor(c,expression){const end=Date.now()+5000;while(Date.now()<end){if(await ev(c,expression))return;await sleep(50);}throw new Error('Viewer state did not settle: '+expression+' '+JSON.stringify(await ev(c,"({i:_igv?.i,anim:_igv?.anim,editing:!!_igv?.tagEditor,img:document.getElementById('igv-img')?.currentSrc})")));}
async function open(c,hash){
  await c.send('Page.navigate',{url:'about:blank'});await sleep(300);
  await c.send('Page.navigate',{url:`http://127.0.0.1:${PORT}/index.html${hash}`});
  for(let i=0;i<60;i++){await sleep(500);try{if(await ev(c,`typeof showT==='function'&&ARTISTS.length>0`))break;}catch(e){}}
}
(async()=>{
 if(!BROWSER){console.log('No browser available');process.exit(1);}
 server.listen(PORT);const prof=fs.mkdtempSync(path.join(os.tmpdir(),'kpu-ig-tags-'));
 const proc=spawn(BROWSER,['--headless=new','--no-sandbox',`--remote-debugging-port=${CDP_PORT}`,`--user-data-dir=${prof}`,'--no-first-run','--disable-gpu','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--window-size=1400,900','about:blank'],{stdio:['ignore','ignore','pipe']});
 const assert=require('node:assert/strict');const out=process.env.KPU_BROWSER_ARTIFACT_DIR||path.join(ROOT,'audit-materials/instagram-tags-2026-11-06');fs.mkdirSync(out,{recursive:true});
 try{
  await waitForBrowserCdp(proc,CDP_PORT);const tab=await(await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`,{method:'PUT'})).json(),c=await conn(tab.webSocketDebuggerUrl);await c.send('Page.enable');await c.send('Runtime.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.__igErrors=[];addEventListener('error',e=>__igErrors.push(e.message));addEventListener('unhandledrejection',e=>__igErrors.push(String(e.reason)));"});
  await open(c,'');
  for(let i=0;i<60;i++){if(await ev(c,"!!sb&&typeof _openIgViewer==='function'"))break;await sleep(250);}
  const admin=fs.readFileSync(path.join(ROOT,'admin.js'),'utf8'),p=admin.indexOf('function _vidTagExactMatch('),picker=admin.slice(p,admin.indexOf("document.getElementById('vid-tag-with-search')",p));
  await ev(c,`(0,eval)(${JSON.stringify(picker+'\n'+admin.slice(admin.indexOf('function _igTagPostTargets(')))});`);
  const vg=admin.indexOf('function _renderVidTagMemberCheckboxes(');await ev(c,`window._vidTagRenderedGko=null;(0,eval)(${JSON.stringify(admin.slice(vg,admin.indexOf("document.getElementById('vid-tag-members-all')",vg)))});const oldMembers=document.createElement('div');oldMembers.id='vid-tag-members';oldMembers.hidden=true;document.body.appendChild(oldMembers);_renderVidTagMemberCheckboxes('코르티스',{savedMembers:new Set(['성현'])});`);assert.equal(await ev(c,"document.querySelectorAll('#vid-tag-members input').length"),5);assert.equal(await ev(c,"document.querySelector('#vid-tag-members input:checked').value"),'성현');await ev(c,"document.getElementById('vid-tag-members').remove()");ok('Existing video-tag checkboxes retain names and saved selections');
  await ev(c,`(()=>{
   window.__igRows=[];window.__igWrites=[];window.__igFail=false;
   const original=sb.from.bind(sb);sb.from=function(table){if(table!=='ig_photo_tags')return original(table);let op='select',payload=null,filters=[],single=false;const q={select(){return q;},order(){return q;},range(){return q;},maybeSingle(){single=true;return q;},eq(k,v){filters.push([k,v]);return q;},insert(v){op='insert';payload=v;return q;},update(v){op='update';payload=v;return q;},delete(){op='delete';return q;},then(resolve,reject){return Promise.resolve().then(()=>{if(window.__igFail&&op!=='select'){window.__igFail=false;return{data:null,error:{message:'test offline'}};}const matches=r=>filters.every(([k,v])=>r[k]===v);let data=window.__igRows.filter(matches);if(op!=='select')window.__igWrites.push({op,payload,filters});if(op==='insert'){if(__igRows.some(r=>r.post_key===payload.post_key&&r.photo_key===payload.photo_key))return{data:null,error:{code:'23505'}};data=[structuredClone(payload)];__igRows.push(data[0]);}if(op==='update'){for(const r of data)Object.assign(r,payload);}if(op==='delete')window.__igRows=__igRows.filter(r=>!matches(r));return{data:structuredClone(single?(data[0]||null):data),error:null};}).then(resolve,reject);}};return q;};
   const originalRpc=sb.rpc.bind(sb);sb.rpc=async function(name,p){if(name!=='ig_photo_tags_apply_post')return originalRpc(name,p);window.__igBulkCalls=(window.__igBulkCalls||0)+1;if(window.__igFail){window.__igFail=false;return{data:null,error:{message:'test offline'}};}const rows=structuredClone(window.__igRows);for(const photo of p.p_photos){const i=rows.findIndex(r=>r.post_key===p.p_post_key&&r.photo_key===photo.photo_key),r=rows[i];if((r?.revision??null)!==photo.expected_revision)return{data:null,error:{code:'40001',message:'tag revision conflict'}};if(!p.p_artist_ids.length){if(i>=0)rows.splice(i,1);}else{const record={post_key:p.p_post_key,photo_key:photo.photo_key,handle:p.p_handle,media_id:photo.media_id,image_key:photo.image_key,artist_ids:p.p_artist_ids,revision:(r?.revision||0)+1};if(i>=0)rows[i]=record;else rows.push(record);}}window.__igRows=rows;return{data:structuredClone(rows.filter(r=>r.post_key===p.p_post_key)),error:null};};
   window.__igHandle=_igHandle(GROUPS['코르티스'].links.instagram);window.__igMember=ARTISTS.find(a=>a.group.ko==='코르티스'&&a.name.ko==='성현');
   window.__igFixture={p:'https://www.instagram.com/p/IgPhotoTagFixture/',t:new Date().toISOString(),ty:'CAROUSEL_ALBUM',cap:'Photo caption',u:location.origin+'/tests/fixtures/ig-photo-a.svg',c:[location.origin+'/tests/fixtures/ig-photo-a.svg',location.origin+'/tests/fixtures/ig-photo-b.svg']};__igFixture.mi=__igFixture.c.map((u,i)=>({u,id:String(123450+i),ty:'IMAGE'}));
   _isAdmin=()=>false;_openIgViewer(__igFixture,__igHandle,0);
  })()`);

  // 보관함 데이터 스텁(ig_accounts·ig_media) — 게시물 3개(사진 2 + 영상 1)
  await ev(c,`(()=>{
    const o=sb.from.bind(sb);
    sb.from=function(t){
      if(t==='ig_accounts'){const q={select(){return q},eq(){return q},maybeSingle(){return Promise.resolve({data:{media_count:3,bf_done:true},error:null})},then(a,b){return Promise.resolve({data:null,error:null}).then(a,b)}};return q;}
      if(t==='ig_media'){const q={select(){return q},eq(){return q},order(){return q},range(){return Promise.resolve({data:window.__igArchRows,error:null})},then(a,b){return Promise.resolve({count:3,data:null,error:null}).then(a,b)}};return q;}
      return o(t);
    };
    const A=__igFixture.c[0],B=__igFixture.c[1]||__igFixture.c[0];
    const mk=(k,ty)=>({post_key:k,media_id:null,t:new Date().toISOString(),ty:ty,p:'https://www.instagram.com/p/'+k+'/',u:A,c:ty==='VIDEO'?null:[A,B],mi:null,n:ty==='VIDEO'?1:2,cap:'c',lk:1,cm:0,v:null});
    window.__igArchRows=[mk('ArchPostA','CAROUSEL_ALBUM'),mk('ArchPostB','CAROUSEL_ALBUM'),mk('ArchVideoC','VIDEO')];
    _isAdmin=()=>true;try{_closeIgViewer();}catch(e){}
    try{localStorage.removeItem('kpu_ig_last_tag');}catch(e){}
  })()`);
  await ev(c,"_openIgArchive(__igHandle,'CORTIS')");
  await waitFor(c,"document.querySelectorAll('#iga-grid .iga-tile').length===3");
  assert(await ev(c,"!!document.getElementById('iga-sel')&&!document.getElementById('iga-sel').hidden"));ok('Admin sees the Select button in the archive header');

  // 관리자가 아니면 버튼이 숨겨진다
  await ev(c,"_isAdmin=()=>false;_openIgArchive(__igHandle,'CORTIS')");await waitFor(c,"document.querySelectorAll('#iga-grid .iga-tile').length===3");
  assert(await ev(c,"document.getElementById('iga-sel').hidden"));ok('Non-admin does not see the Select button');
  await ev(c,"_isAdmin=()=>true;_openIgArchive(__igHandle,'CORTIS')");await waitFor(c,"document.querySelectorAll('#iga-grid .iga-tile').length===3");

  // 선택 모드: 사진 2개 선택, 영상은 선택 안 됨
  await ev(c,"document.getElementById('iga-sel').click()");assert(await ev(c,"_iga.sel instanceof Map&&document.getElementById('iga-overlay').classList.contains('iga-selecting')"));
  await ev(c,"document.querySelectorAll('#iga-grid .iga-tile')[0].click();document.querySelectorAll('#iga-grid .iga-tile')[1].click();document.querySelectorAll('#iga-grid .iga-tile')[2].click()");
  assert.equal(await ev(c,"_iga.sel.size"),2);assert.equal(await ev(c,"document.querySelectorAll('#iga-grid .iga-tile.iga-sel').length"),2);
  assert(await ev(c,"!document.getElementById('igv-overlay')?.classList.contains('open')"));ok('Select mode toggles tiles without opening the viewer; the video is not selectable');
  assert(await ev(c,"!document.getElementById('iga-selbar').hidden&&document.getElementById('iga-selbar').textContent.includes('2')"));ok('Selection bar shows the count');
  if(process.env.KPU_SHOT)fs.writeFileSync(path.join(process.env.KPU_SHOT,'iga-select.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));

  // 일괄 편집기: 그룹 전체 → 저장 → 게시물 2개에 RPC 2번
  await ev(c,"window.__igBulkCalls=0;document.querySelector('#iga-selbar [data-act=tag]').click()");
  await waitFor(c,"!!document.getElementById('igbt-overlay')");
  assert(await ev(c,"document.querySelector('#igbt-panel .igv-edit-heading span').textContent.includes('2')"));ok('Bulk editor opens for the selected posts');
  await ev(c,"document.querySelector('#igbt-panel .igv-edit-all').click()");
  if(process.env.KPU_SHOT)fs.writeFileSync(path.join(process.env.KPU_SHOT,'igbt-modal.png'),Buffer.from((await c.send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await ev(c,"document.querySelector('#igbt-panel [data-action=clear]').click()");
  assert(await ev(c,"document.querySelector('#igbt-panel [data-action=save]').disabled"));ok('Save is disabled until members are picked');
  await ev(c,"document.querySelector('#igbt-panel .igv-edit-all').click()");
  assert.equal(await ev(c,"document.querySelectorAll('#igbt-panel .igv-edit-selected .igv-member-chip').length"),5);
  await ev(c,"document.querySelector('#igbt-panel [data-action=save]').click()");
  await waitFor(c,"!document.getElementById('igbt-overlay')");
  assert.equal(await ev(c,"window.__igBulkCalls"),2);ok('Saving tags every photo post once (2 apply_post calls)');
  assert(await ev(c,"_iga.sel===null&&document.getElementById('iga-selbar').hidden"));ok('Selection mode ends after saving');
  const last=await ev(c,"JSON.parse(localStorage.getItem('kpu_ig_last_tag')||'null')");
  assert.equal(last.scope,'post');assert.equal(last.ids.length,5);ok('The last tag set is remembered');

  // 직전 태그 버튼: 다음 일괄 편집기에서 한 번에 불러온다
  await ev(c,"document.getElementById('iga-sel').click();document.querySelectorAll('#iga-grid .iga-tile')[0].click();document.querySelector('#iga-selbar [data-act=tag]').click()");
  await waitFor(c,"!!document.getElementById('igbt-overlay')");
  assert(await ev(c,"(()=>{const b=document.querySelector('#igbt-panel .igv-edit-last');return !!b&&!b.hidden&&b.textContent.includes('직전')})()"));
  await ev(c,"document.querySelector('#igbt-panel .igv-edit-last').click()");
  assert.equal(await ev(c,"document.querySelectorAll('#igbt-panel .igv-edit-selected .igv-member-chip').length"),5);ok('Last-tag button refills the same members in one tap');
  await ev(c,"document.querySelector('#igbt-panel [data-action=cancel]').click()");assert(await ev(c,"!document.getElementById('igbt-overlay')"));

  // 단일 편집기: 직전 태그 한 번에 저장(사진 한 장)
  await ev(c,"_closeIgArchive();_isAdmin=()=>true;_openIgViewer(__igFixture,__igHandle,0)");await sleep(300);
  await ev(c,"document.querySelector('#igv-tag-edit').click()");await waitFor(c,"!!_igv.tagEditor");
  assert(await ev(c,"!!document.querySelector('#igv-tag-editor .igv-edit-last')"));ok('Single-photo editor offers the last tags');
  await ev(c,"document.querySelector('#igv-tag-editor .igv-edit-last').click()");
  await waitFor(c,"!_igv.tagEditor||!_igv.tagEditor.saving");await sleep(200);
  assert(await ev(c,"__igRows.some(r=>r.artist_ids&&r.artist_ids.length===5)"));ok('Tapping the last-tag button saves it immediately');
  const errors=await ev(c,'__igErrors');assert.deepEqual(errors,[]);ok('No page errors');
  c.close();
 }catch(e){bad(e.stack||e.message);}
 finally{proc.kill();server.close();}
 console.log(`${pass} passed / ${fail} failed`);process.exit(fail?1:0);
})();
