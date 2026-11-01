// Actual event controller with deferred rows, no production reads or writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),a=src.indexOf('async function _openEventPage('),code=(src.match(/^let _feedListIntent=0;$/m)?.[0]||'')+'\n'+src.slice(a,src.indexOf('\n}',a)+2);
function fixture(){
 const pending=[],views=[],rows=[];for(const ed of ['2025','2024'])for(const g of ['A','B'])for(const category of ['live','fan'])rows.push({id:ed+g+category,_ed:ed,group_ko:g,category,title:g+' song',view_count:1});
 const box={currentLang:'ko',_EVENT_SERIES:[{id:'ev',ko:'event'}],_eventRows:()=>new Promise(resolve=>pending.push(resolve)),favGroups:new Set(['A']),favMembers:new Set(),GROUPS:{},_PF_FAVHIT:v=>v.group_ko==='A',_PF_INGROUP:(v,g)=>v.group_ko===g,_evIsStage:v=>v.category==='live',_evKind:v=>v.category==='live'?'stage':'fancam',_isShortV:()=>false,_rowTags:v=>v,_evEdLabel:x=>x,_openFeedListOverlay:(title,sub,songs,ctx)=>views.push({songs,facets:ctx.facets})};
 vm.createContext(box);vm.runInContext(code,box);
 const run=(...x)=>box._openEventPage('ev',...x),finish=async(p,i)=>{pending[i||0](rows);await p;};
 return{rows,pending,views,run,finish,async start(){await finish(run('2025','stage','all'));return views[0].facets;}};
}
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 const pairs=[['ed','2024','who','A'],['who','A','ed','2024'],['view','fancam','who','A'],['who','A','view','fancam'],['ed','2024','view','fancam'],['view','fancam','ed','2024']];
 for(const [k1,v1,k2,v2] of pairs)await check(k1+' then '+k2+' preserves both latest choices',async()=>{const f=fixture(),facets=await f.start(),old=facets.find(x=>x.key===k1).onPick(v1),next=facets.find(x=>x.key===k2).onPick(v2);await f.finish(next,2);await f.finish(old,1);const final=f.views.at(-1);assert.equal(final.facets.find(x=>x.key===k1).sel,v1);assert.equal(final.facets.find(x=>x.key===k2).sel,v2);assert.equal(f.views.length,2);});
 await check('latest normalized defaults remain available to later callbacks',async()=>{const f=fixture(),p=f.run();await f.finish(p);const pick=f.views[0].facets.find(x=>x.key==='who').onPick('A');await f.finish(pick,1);assert.equal(f.views.at(-1).facets.find(x=>x.key==='ed').sel,'2025');});
 await check('new direct entry starts from its own requested values',async()=>{const f=fixture(),facets=await f.start(),p=facets.find(x=>x.key==='who').onPick('A');await f.finish(p,1);const q=f.run('2024');await f.finish(q,2);assert.equal(f.views.at(-1).facets.find(x=>x.key==='who').sel,'all');assert.equal(f.views.at(-1).facets.find(x=>x.key==='view').sel,'stage');});
 await check('missing group selection still normalizes to all',async()=>{const f=fixture(),p=f.run('2024','stage','missing');await f.finish(p);assert.equal(f.views[0].facets.find(x=>x.key==='who').sel,'all');});
 await check('empty result retains existing empty fallback',async()=>{const f=fixture(),p=f.run();f.pending[0]([]);await p;assert.equal(f.views[0].songs.length,0);assert.equal(f.views[0].facets.length,0);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
