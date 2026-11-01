// Actual warm + card loader. Synthetic provider/DOM only; never reads or writes production collections.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const code=src.slice(src.indexOf('let _pubCollectionsCache=null;'),src.indexOf('function _renderCollectionRow('));
const boot=src.split('\n').find(l=>l.includes('_warmPubCollections(); // 컬렉션 행도'));
const good=data=>({data,error:null}),bad={data:null,error:{message:'temporary'}};
const pub=(id='pub',extra={})=>({id,name:id,owner_id:'other',items:[{u:'synthetic'}],group_kos:['G'],member_kos:['M'],...extra});
function fixture(plan){
 const calls=[],views=[],programs=[],errors=[],row={style:{},querySelector:()=>({innerHTML:''})};
 const provider={from(table){const spec={table,orders:[]};const q={spec,select(cols){spec.cols=cols;return q;},order(...args){spec.orders.push(args);return q;}};return q;}};
 const ctx={sb:provider,window:{_sbSession:{user:{id:'me'}}},document:{getElementById:()=>row},collections:[],_openGCko:'G',_openTArtist:{name:{ko:'M'}},_colLikesP:null,_colLikeCounts:new Map(),
 _collectionMatchesCard:(c,g,m)=>c.group===g&&(!m||c.member===m),_renderCollectionRow:(id,list)=>views.push({id,list}),_loadProgramRow:(...args)=>programs.push(args),console:{error:(...args)=>errors.push(args)},
 _sbSelectAll:async factory=>{const q=factory();calls.push(q.spec);const n=plan.shift();if(!n)throw new Error('unexpected query');return typeof n==='function'?n():n;}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return{ctx,calls,views,programs,provider,errors,warm:()=>ctx._warmPubCollections(),boot:()=>vm.runInContext(boot,ctx),load:(g='G',m=null,cm=null)=>ctx._loadCollectionRow(g,'row',m,cm),last:()=>views.at(-1)?.list||[]};
}
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('successful startup reused by later card opens',async()=>{const f=fixture([good([pub()])]);await f.boot();await f.load();await f.load();assert.equal(f.last()[0]?.id,'pub');assert.equal(f.calls.length,1);});
 await check('verified empty startup remains cached',async()=>{const f=fixture([good([])]);await f.boot();await f.load();await f.load();assert.equal(f.last().length,0);assert.equal(f.calls.length,1);});
 await check('both startup selects fail then next card recovers',async()=>{const f=fixture([bad,bad,good([pub('recovered')])]);await f.boot();await f.load();assert.equal(f.last()[0]?.id,'recovered');assert.equal(f.calls.length,3);});
 await check('startup rejection then next card recovers',async()=>{const f=fixture([()=>Promise.reject(new Error('offline')),good([pub('recovered')])]);await f.boot();await f.load();assert.equal(f.last()[0]?.id,'recovered');});
 await check('provider absent at startup can recover when ready',async()=>{const f=fixture([good([pub('ready')])]);f.ctx.sb=null;await f.boot();f.ctx.sb=f.provider;await f.load();assert.equal(f.last()[0]?.id,'ready');});
 await check('cold concurrent card opens share one request and latest row renders',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]),a=f.load(),b=f.load();assert.equal(f.calls.length,1);done(good([pub()]));await Promise.all([a,b]);assert.equal(f.views.length,1);assert.equal(f.last()[0].id,'pub');});
 await check('concurrent warm calls share one request',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]),a=f.warm(),b=f.warm();assert.equal(f.calls.length,1);done(good([pub()]));await Promise.all([a,b]);});
 await check('photos-column fallback and stable pagination order retained',async()=>{const f=fixture([bad,good([pub()])]);await f.boot();await f.load();assert.equal(f.last()[0].id,'pub');assert(f.calls[0].cols.endsWith(',photos'));assert(!f.calls[1].cols.endsWith(',photos'));assert.deepEqual(f.calls[0].orders.map(x=>x[0]),['updated_at','id']);});
 await check('same-name different group and other member stay excluded; local duplicate removed',async()=>{const f=fixture([good([pub('mine'),pub('same-name',{group_kos:['otherG']}),pub('other-member',{member_kos:['otherM']}),pub('valid',{owner_id:'me',photos:[{u:'photo'}]})])]);f.ctx.collections=[{id:'mine',name:'mine',group:'G',member:'M',videos:[{u:'local'}]}];await f.boot();await f.load('G','M','M');assert.deepEqual(Array.from(f.last(),x=>x.id),['mine','valid']);assert(f.last()[0].mine);assert(f.last()[1].mine);assert.equal(f.last()[1].kind,'photo');assert.equal(f.last()[1].photos[0].u,'photo');});
 await check('card changed while pending does not paint stale collections',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]);const warm=f.boot(),load=f.load();f.ctx._openGCko='newG';done(good([pub()]));await Promise.all([warm,load]);assert.equal(f.views.length,0);assert.equal(f.programs.length,0);});
 await check('private local collections still render after public failure',async()=>{const f=fixture([bad,bad,bad,bad]);f.ctx.collections=[{id:'local',name:'local',group:'G',videos:[{u:'local'}]}];await f.boot();await f.load();assert.equal(f.last()[0]?.id,'local');assert.equal(f.calls.length,4);});
 await check('unverified null response is retried on next card',async()=>{const f=fixture([{data:null,error:null},good([pub('recovered')])]);await f.boot();await f.load();assert.equal(f.last()[0]?.id,'recovered');});
 await check('cold first-card failure retries on later card',async()=>{const f=fixture([bad,bad,good([pub('later')])]);await f.load();assert.equal(f.last().length,0);await f.load();assert.equal(f.last()[0]?.id,'later');assert.equal(f.calls.length,3);});
 await check('failed refresh preserves a known-good public snapshot',async()=>{const f=fixture([good([pub('old')]),bad,bad,good([pub('new')])]);await f.boot();await f.warm();await f.load();assert.equal(f.last()[0]?.id,'old');await f.warm();await f.load();assert.equal(f.last()[0]?.id,'new');});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
