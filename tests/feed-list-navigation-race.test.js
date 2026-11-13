// Actual asynchronous entry points + close function. Only the renderer body after its
// lifecycle entry is replaced by a recorder; local deferred providers, no remote API.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function fn(name){const a=src.indexOf('function '+name+'('),start=src.slice(a-6,a)==='async '?a-6:a;assert(a>=0,name);return src.slice(start,src.indexOf('\n}',a)+2);}
const renderer=fn('_openFeedListOverlay'),renderEntry=renderer.slice(0,renderer.indexOf("  document.getElementById('feed-list-hd-title')"))+'  __record(title,sub,songs,ctx);\n}';
const declarations=(src.match(/^let _(?:feedListIntent|feedListCloseSeq|chartViewSeq)=0;$/gm)||[]).join('\n');
// 창 안 이전 기록(_winEnter·_winClear, 2026-11-12)은 이 검사와 무관 — 빈 함수로(없으면 진입점이 ReferenceError)
const winStubs='function _winEnter(){}\nfunction _winClear(){}\nfunction _winSyncBack(){}';
const code=declarations+'\n'+winStubs+'\n'+['_openProgramCollection','_programFacetView','_openChartList','_openEventPage','_openCollectionFromHash','_closeFeedListOverlay'].map(fn).join('\n')+'\n'+renderEntry;
function fixture(mobile=false){
 const pending=[],views=[],timers=[],classes=new Set(['open']),panel={style:{}},overlay={classList:{contains:x=>classes.has(x),add:x=>classes.add(x),remove:x=>classes.delete(x)}};
 const defer=(kind,id)=>{let resolve,reject;const p=new Promise((a,b)=>{resolve=a;reject=b;});pending.push({kind,id,resolve,reject});return p;};
 const q=()=>{const p=defer('db');for(const k of ['select','or','order','limit','eq','contains','maybeSingle'])p[k]=()=>p;return p;};
 const box={currentLang:'ko',sb:{from:q},_YT_TABLE:'videos',_durCol:()=>'',_isShortV:()=>false,_rowTags:v=>v,_filterBannedVideos:v=>v,_pgFilterVal:v=>v,_PF_FAVHIT:()=>false,_PF_INGROUP:(v,g)=>v.group_ko===g,favGroups:new Set(),favMembers:new Set(),GROUPS:{},
 _CHART_DEFS:{a:{axes:[],ranked:true},b:{axes:[],ranked:false}},_CHART_SEL_DEFAULT:{},_CHART_AXES:{},_chartLabel:id=>'chart '+id,_chartSnapKey:()=>null,_feedRankSub:()=>'',_chartSongs:id=>defer('chart',id),
 _EVENT_SERIES:[{id:'a',ko:'event a'},{id:'b',ko:'event b'}],_eventRows:s=>defer('event',s.id),_evIsStage:()=>true,_evKind:()=> 'stage',_evEdLabel:x=>x,
 collections:[],window:{_sbSession:null},_colVidCountText:n=>String(n),console:{warn(){},error(){}},
 document:{getElementById:id=>id==='feed-list-overlay'?overlay:id==='feed-list-panel'?panel:null},isMob:()=>mobile,_feedListObserver:null,_flStageClose:()=>{},setTimeout:f=>timers.push(f),
 __record:(title,sub,songs,ctx)=>{views.push({title,sub,songs,ctx});classes.add('open');}};
 vm.createContext(box);vm.runInContext(code,box);
 const rows=[{id:'v',title:'song',_ed:'2025',group_ko:'G',view_count:1,published_at:'2025-01-01',category:'live'}];
 const run=(kind,id='a')=>kind==='program'?box._openProgramCollection({label:'program '+id,kw:[id]},{gko:'G'}):kind==='program-facet'?box._programFacetView({label:'facet '+id,tops:[],rows:[],cache:new Map(),mkQ:q,toSongs:x=>x},'all','latest'):kind==='chart'?box._openChartList(id):kind==='event'?box._openEventPage(id):box._openCollectionFromHash(id);
 const finish=(p)=>p.resolve(p.kind==='db'?{data:p.shared?{id:'x',name:'shared',items:rows}:rows}:rows);
 const open=(kind,id)=>{const n=pending.length,p=run(kind,id);if(kind==='shared'&&pending.length>n)pending.at(-1).shared=true;return p;};
 return{pending,views,classes,panel,timers,open,finish,collections:box.collections,close:()=>box._closeFeedListOverlay(),sync:()=>box._openFeedListOverlay('sync','',[])};
}
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const kind of ['program','program-facet','chart','event','shared']){
  await check(kind+': current successful request renders normally',async()=>{const f=fixture(),p=f.open(kind);f.finish(f.pending[0]);await p;assert.equal(f.views.length,1);assert.equal(f.views[0].songs.length,1);});
  await check(kind+': close prevents late reopening',async()=>{const f=fixture(),p=f.open(kind);f.close();f.finish(f.pending[0]);await p;assert.equal(f.views.length,0);assert(!f.classes.has('open'));});
  await check(kind+': synchronous new list wins',async()=>{const f=fixture(),p=f.open(kind);f.sync();f.finish(f.pending[0]);await p;assert.equal(f.views.length,1);assert.equal(f.views[0].title,'sync');});
  for(const newest of ['program','program-facet','chart','event','shared'])await check(kind+' → '+newest+': latest async list owns rendering',async()=>{const f=fixture(),old=f.open(kind),next=f.open(newest,'b');f.finish(f.pending[1]);await next;assert.equal(f.views.length,1);const shown=f.views[0].title;f.finish(f.pending[0]);await old;assert.equal(f.views.length,1);assert.equal(f.views[0].title,shown);});
 }
 await check('old program error does not open an empty fallback over new list',async()=>{const f=fixture(),p=f.open('program');f.sync();f.pending[0].reject(new Error('old'));await p;assert.equal(f.views.length,1);});
 await check('old event error does not open an empty fallback after close',async()=>{const f=fixture(),p=f.open('event');f.close();f.pending[0].reject(new Error('old'));await p;assert.equal(f.views.length,0);});
 await check('current program still opens its normal empty error fallback',async()=>{const f=fixture(),p=f.open('program');f.pending[0].reject(new Error('current'));await p;assert.equal(f.views.length,1);assert.equal(f.views[0].songs.length,0);});
 await check('mobile close animation still completes normally',async()=>{const f=fixture(true);f.close();assert(f.classes.has('open'));f.timers[0]();assert(!f.classes.has('open'));});
 await check('mobile old close timer cannot close a newly rendered list',async()=>{const f=fixture(true);f.close();f.sync();f.timers[0]();assert(f.classes.has('open'));});
 await check('starting a pending query does not prevent old mobile list from closing',async()=>{const f=fixture(true);f.close();const p=f.open('chart');f.timers[0]();assert(!f.classes.has('open'));f.finish(f.pending[0]);await p;assert(f.classes.has('open'));});
 await check('close followed by a new explicit open remains usable',async()=>{const f=fixture();f.close();const p=f.open('chart');f.finish(f.pending[0]);await p;assert.equal(f.views.length,1);assert(f.classes.has('open'));});
 await check('local owned collection still opens without a database request',async()=>{const f=fixture();f.collections.push({id:'local',name:'mine',videos:[]});await f.open('shared','local');assert.equal(f.pending.length,0);assert.equal(f.views.length,1);assert.equal(f.views[0].ctx.mine,true);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
