// app.js는 feed-overlay 이전의 동기 script다. 실제 감시 코드를 DOM 파싱 전/후 순서로 실행한다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const start=src.indexOf('const _FW_BLOCKERS='),end=src.indexOf('\nfunction _closeGcDiscogDetail(',start);assert(start>=0&&end>start);
const scriptAt=html.indexOf('<script src="app.js?'),feedAt=html.indexOf('id="feed-overlay"');assert(scriptAt>=0&&feedAt>scriptAt,'실제 DOM 파싱 순서를 검증');
const ids=text=>[...text.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
function fixture(ready='loading',wide=true){
 const nodes=new Map(),watchers=new Map(),events=new Map(),windowEvents=new Map(),observers=[],intervals=[];let viewportWide=wide;
 function node(id){const set=new Set();const el={id,querySelectorAll:()=>[],classList:{contains:k=>set.has(k),toggle(k,on){const before=set.has(k);on=on===undefined?!before:on;if(on)set.add(k);else set.delete(k);if(before!==on)for(const cb of watchers.get(id)||[])queueMicrotask(cb);return on;},add(k){this.toggle(k,true);},remove(k){this.toggle(k,false);}}};return el;}
 const document={readyState:ready,body:node('body'),getElementById:id=>nodes.get(id)||null,addEventListener:(type,cb,opts)=>{events.set(type,{cb,opts});}};
 const addNodes=text=>ids(text).forEach(id=>{if(!nodes.has(id))nodes.set(id,node(id));});
 addNodes(ready==='loading'?html.slice(0,scriptAt):html);
 const box={document,window:{addEventListener:(type,cb)=>windowEvents.set(type,cb)},_stageWide:()=>viewportWide,
 MutationObserver:class{constructor(cb){this.cb=cb;this.seen=[];observers.push(this);}observe(el,opts){this.seen.push({id:el.id,opts});if(!watchers.has(el.id))watchers.set(el.id,[]);watchers.get(el.id).push(this.cb);}},
 setInterval:cb=>intervals.push(cb),requestAnimationFrame:cb=>cb()};
 vm.createContext(box);vm.runInContext(src.slice(start,end),box);
 return {nodes,document,observers,intervals,windowEvents,prepare(){addNodes(html);document.readyState='interactive';const ev=events.get('DOMContentLoaded');if(ev){ev.cb();if(ev.opts?.once)events.delete('DOMContentLoaded');}},resize(on){viewportWide=on;windowEvents.get('resize')();},isWide:()=>document.body.classList.contains('fw-home')};
}
let total=0,failed=0;
async function check(name,fn){total++;try{await fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
const flush=()=>new Promise(resolve=>queueMicrotask(resolve));
(async()=>{
 for(let round=1;round<=3;round++){
  const f=fixture();f.prepare();
  await check('DOM 준비 후 나침반 class 감시 '+round,()=>assert(f.observers.some(o=>o.seen.some(x=>x.id==='feed-overlay'))));
  await check('나침반 열기를 다음 1초 폴링 전에 반영 '+round,async()=>{f.nodes.get('feed-overlay').classList.add('open');await flush();assert(f.isWide());});
  await check('카드 열면 좁힘 '+round,async()=>{f.nodes.get('side-panel').classList.add('open');await flush();assert(!f.isWide());});
  await check('카드 닫으면 다시 넓힘 '+round,async()=>{f.nodes.get('side-panel').classList.remove('open');await flush();assert(f.isWide());});
  await check('나침반 닫힘도 즉시 반영 '+round,async()=>{f.nodes.get('feed-overlay').classList.remove('open');await flush();assert(!f.isWide());});
 }
 await check('이미 DOM 완료된 로딩도 즉시 감시',async()=>{const f=fixture('complete');f.nodes.get('feed-overlay').classList.add('open');await flush();assert(f.isWide());});
 await check('폰에서는 열어도 넓은 폭 적용 안 함',async()=>{const f=fixture('loading',false);f.prepare();f.nodes.get('feed-overlay').classList.add('open');await flush();assert(!f.isWide());});
 await check('리사이즈 기존 규칙 유지',async()=>{const f=fixture('complete');f.nodes.get('feed-overlay').classList.add('open');await flush();assert(f.isWide());f.resize(false);assert(!f.isWide());f.resize(true);assert(f.isWide());});
 await check('DOMContentLoaded 중복 초기화 방지',()=>{const f=fixture();f.prepare();f.prepare();assert.equal(f.observers.length,1);});
 await check('감시는 class만·1초 안전망 하나 유지',()=>{const f=fixture();f.prepare();assert.equal(f.intervals.length,1);for(const o of f.observers)for(const x of o.seen){assert.equal(x.opts.attributes,true);assert.deepEqual(Array.from(x.opts.attributeFilter),['class']);}});
 console.log(total+'검증 / '+failed+'실패');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
