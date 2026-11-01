// Actual search functions, controlled response order; no browser/network/database writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function region(from,to){const a=src.indexOf(from),b=src.indexOf(to,a+from.length);assert(a>=0&&b>a,from);return src.slice(a,b);}
const remote=region('function _searchRemote(','function _trendingSearchHits(');
const more=region('async function _srLoadMoreVideos(','function _logSearchClick(');
const search=region('function doSearch(q){','function _wireListKeyboardNav(');
const close=region('function closeMobSearchSheet(){','const _MS_TAB_OF_TYPE=');
const invalid=src.includes('function _invalidateRemoteSearch(){')?region('function _invalidateRemoteSearch(){','function _searchRemote('):'';
function defer(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(){
 const timers=new Map(),requests=[],rendered=[],items=[];let seq=0;
 const body={innerHTML:'',style:{},classList:{remove(){}}},sheet={classList:{remove(){}},setAttribute(){}};
 const box={_remoteSearchToken:0,_remoteSearchTimer:null,_srVidMore:null,_curSearchQ:'old',_SR_VID_FIRST:6,_SR_VID_STEP:20,
   _obSearchMode:false,_msEl:sheet,_msInput:{value:'old'},_msBody:body,_msTabs:{innerHTML:''},_msTab:'all',currentLang:'ko',
   document:{getElementById:id=>id==='msheet-body'?body:{classList:{remove(){},contains:()=>false}}},
   isMob:()=>false,_msIsOpen:()=>true,_srResetLimits(){},_resolveRecentSearches:()=>[],_trendingSearchHits:()=>[],_msSyncTabs(){},
   GROUPS:{},bubbleMeshes:[],_ensureVenuesInfo:async()=>({}),_srVidHit:v=>({id:v.id}),
   _appendSearchSections:(out,res)=>rendered.push({ids:out.video.map(v=>v.id),res}),
   _makeSearchItem:hit=>({hit,classList:{add(){}}}),
   setTimeout:fn=>{timers.set(++seq,fn);return seq},clearTimeout:id=>timers.delete(id),
   _srVidPage:(...args)=>{const d=defer();requests.push({args,...d});return d.promise;},
   sb:{from(){const q={select:()=>q,ilike:()=>q,order:()=>q,limit:()=>Promise.resolve({data:[]})};return q;}}};
 vm.createContext(box);vm.runInContext(invalid+'\n'+remote+'\n'+more+'\n'+search+'\n'+close,box);
 return {box,requests,rendered,items,timers,run(){const [id,fn]=timers.entries().next().value;timers.delete(id);return fn();},
   start(q,hint=null){box._searchRemote(q,{q},false,false,hint);},
   state(){return box._srVidMore;},
   button(){return {isConnected:true,disabled:false,textContent:'더보기',removed:false,remove(){this.removed=true;},parentNode:{insertBefore:item=>items.push(item.hit.id)}};}};
}
const rows=q=>Array.from({length:6},(_,i)=>({id:q+i}));
let total=0,failed=0;
async function check(name,fn){total++;try{await fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('late old response cannot replace new pagination',async()=>{
   const f=fixture();f.start('old');const old=f.run();f.start('new');const latest=f.run();
   f.requests[1].resolve({data:rows('new')});await latest;const state=f.state();
   f.requests[0].resolve({data:rows('old')});await old;assert.equal(f.state(),state);assert.equal(f.state().q,'new');assert.equal(f.rendered.length,1);
 });
 await check('late member fallback cannot replace new pagination',async()=>{
   const f=fixture();f.start('old',{kind:'member',gko:'group'});const old=f.run();f.requests[0].resolve({data:[]});
   for(let i=0;i<5;i++)await Promise.resolve();assert.equal(f.requests.length,2);
   f.start('new');const latest=f.run();f.requests[2].resolve({data:rows('new')});await latest;
   f.requests[1].resolve({data:rows('fallback')});await old;assert.equal(f.state().q,'new');assert.equal(f.rendered.length,1);
 });
 for(const [name,response] of [['error',{data:null,error:{message:'unavailable'}}],['malformed',{data:{}}]]){
   await check('initial '+name+' is not a successful empty member search',async()=>{
     const f=fixture();f.start('member',{kind:'member',gko:'group'});const pending=f.run();f.requests[0].resolve(response);
     for(let i=0;i<8;i++)await Promise.resolve();if(f.requests[1])f.requests[1].resolve({data:rows('wrong-group')});
     await pending;assert.equal(f.requests.length,1);assert.equal(f.state(),null);assert.equal(f.rendered[0].ids.length,0);
   });
 }
 for(const [name,action] of [['clear',f=>f.box.doSearch('')],['close',f=>f.box.closeMobSearchSheet()]]){
   await check(name+' cancels queued remote search',async()=>{const f=fixture();f.start('old');action(f);assert.equal(f.timers.size,0);assert.equal(f.state(),null);});
   await check(name+' ignores in-flight results',async()=>{const f=fixture();f.start('old');const pending=f.run();action(f);f.requests[0].resolve({data:rows('old')});await pending;assert.equal(f.rendered.length,0);assert.equal(f.state(),null);});
 }
 function paging(){const f=fixture();f.box._srVidMore={q:'new',like:'%new%',hint:null,fallbackGroup:false,offset:6,ids:new Set(['existing']),done:false,loading:false,res:{}};return f;}
 for(const [name,response] of [['server error',{data:[],error:{message:'unavailable'}}],['no data',{data:null}],['malformed data',{data:{}}]]){
   await check(name+' keeps pagination retryable',async()=>{const f=paging(),b=f.button();const pending=f.box._srLoadMoreVideos(b);f.requests[0].resolve(response);await pending;assert.equal(f.state().offset,6);assert.equal(f.state().done,false);assert.equal(f.state().loading,false);assert.equal(b.disabled,false);assert.equal(b.removed,false);assert.equal(b.textContent,'다시 시도');});
 }
 await check('successful empty page completes pagination',async()=>{const f=paging(),b=f.button(),pending=f.box._srLoadMoreVideos(b);f.requests[0].resolve({data:[]});await pending;assert.equal(f.state().done,true);assert.equal(b.removed,true);});
 await check('successful page deduplicates and advances offset',async()=>{const f=paging(),b=f.button(),pending=f.box._srLoadMoreVideos(b);f.requests[0].resolve({data:[{id:'existing'},{id:'fresh'}]});await pending;assert.deepEqual(f.items,['fresh']);assert.equal(f.state().offset,8);});
 await check('failed page retries the same offset',async()=>{const f=paging(),b=f.button();let pending=f.box._srLoadMoreVideos(b);f.requests[0].resolve({data:null,error:{}});await pending;pending=f.box._srLoadMoreVideos(b);assert.equal(f.requests[1]?.args[4],6);f.requests[1].resolve({data:[{id:'retry'}]});await pending;assert.deepEqual(f.items,['retry']);});
 await check('stale page cannot append to a new search',async()=>{const f=paging(),b=f.button(),pending=f.box._srLoadMoreVideos(b);f.box._srVidMore={q:'other'};f.requests[0].resolve({data:[{id:'old'}]});await pending;assert.deepEqual(f.items,[]);assert.equal(f.state().q,'other');});
 await check('English retry label',async()=>{const f=paging(),b=f.button();f.box.currentLang='en';const pending=f.box._srLoadMoreVideos(b);f.requests[0].resolve({data:null,error:{}});await pending;assert.equal(b.textContent,'Retry');});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
