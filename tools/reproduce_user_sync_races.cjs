// Read-only production audit: executes the real client functions against synthetic providers.
// Optional KPU_PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite uses a new in-memory DB.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function fn(name){const a=src.indexOf('function '+name+'(');if(a<0)throw new Error('Missing '+name);const b=src.indexOf('\n}',a)+2;return (src.slice(a-6,a)==='async '?'async ':'')+src.slice(a,b);}
const declStart=src.indexOf('let _sbPushTimers='),declEnd=src.indexOf('function _sbPushColumn(',declStart);
if(declStart<0||declEnd<declStart)throw new Error('Missing sync state declarations');
const sync=src.slice(declStart,declEnd)+'\n'+fn('_sbPushColumn')+'\n'+fn('_sbFlushColumn');
const noop=()=>{},completionTimer=setTimeout(()=>{console.error('diagnostic did not complete');process.exit(1);},15000);
let db;
(async()=>{
 const memory=new Map([['synthetic-a',[]],['synthetic-b',['untouched']]]);
 if(process.env.KPU_PGLITE_MODULE){const{PGlite}=require(process.env.KPU_PGLITE_MODULE);db=new PGlite();await db.exec('create table user_data(user_id text primary key, fav_groups jsonb not null)');await db.query('insert into user_data values ($1,$2::jsonb),($3,$4::jsonb)',['synthetic-a','[]','synthetic-b','["untouched"]']);}
 const write=async(uid,value)=>{memory.set(uid,value);if(db)await db.query('update user_data set fav_groups=$1::jsonb where user_id=$2',[JSON.stringify(value),uid]);};
 const read=async uid=>db?(await db.query('select fav_groups from user_data where user_id=$1',[uid])).rows[0].fav_groups:memory.get(uid);
 const requests=[],window={_sbSession:{user:{id:'synthetic-a'}}};
 const ctx={window,console,setTimeout:()=>1,clearTimeout:noop,sb:{from(table){if(table!=='user_data')throw new Error('Unexpected table');return {update(payload){return {eq(field,uid){if(field!=='user_id')throw new Error('Missing ownership filter');return new Promise(resolve=>requests.push({uid,value:payload.fav_groups,commit:async()=>{await write(uid,payload.fav_groups);resolve({error:null});}}));}};}};}}};
 vm.createContext(ctx);vm.runInContext(sync,ctx);
 ctx._sbPushColumn('fav_groups',['old']);const first=ctx._sbFlushColumn('fav_groups');
 ctx._sbPushColumn('fav_groups',['latest']);const second=ctx._sbFlushColumn('fav_groups');
 for(let i=0;i<20;i++)await Promise.resolve();
 const concurrent=requests.length;
 if(concurrent===2){await requests[1].commit();await requests[0].commit();}
 else if(concurrent===1){await requests[0].commit();for(let i=0;i<20&&requests.length<2;i++)await Promise.resolve();if(!requests[1])throw new Error('Expected second write after first');await requests[1].commit();}
 else throw new Error('Unexpected write scheduling');
 await Promise.all([first,second]);
 const finalValue=await read('synthetic-a');
 // Separate scenario: a local edit occurs while the startup pull is waiting.
 let finishPull;const storage=new Map();
 const pullCtx={window,console,setTimeout:()=>1,clearTimeout:noop,_onFavsChanged:noop,
   favGroups:new Set(['before']),localStorage:{setItem:(k,v)=>storage.set(k,v)},
   sb:{from(){return {select(){return {eq(){return {maybeSingle:()=>new Promise(resolve=>finishPull=resolve)};}};}};}}};
 for(const key of ['FAV_KEY_G','FAV_KEY_M','FAV_KEY_C','FAV_ORDER_KEY','FAV_DATE_KEY','FAV_HISTORY_KEY','SCRAP_KEY','COLLECTION_KEY','PROFILE_KEY','CONCERT_LOG_KEY'])pullCtx[key]='synthetic.'+key;
 vm.createContext(pullCtx);vm.runInContext(sync+'\n'+fn('_pullServerToLocal'),pullCtx);
 const pulling=pullCtx._pullServerToLocal('synthetic-a');
 pullCtx.favGroups=new Set(['latest']);pullCtx._sbPushColumn('fav_groups',['latest']);
 finishPull({data:{fav_groups:['old']},error:null});await pulling;
 const finalLocal=[...pullCtx.favGroups];
 console.log(JSON.stringify({mode:db?'pglite-memory':'synthetic-provider',requestsStartedBeforeFirstCompleted:concurrent,completionOrder:concurrent===2?['latest','old']:['old','latest'],finalServer:finalValue,expectedLatest:['latest'],staleWriteReproduced:JSON.stringify(finalValue)!=='["latest"]',otherUserUnchanged:JSON.stringify(await read('synthetic-b'))==='["untouched"]',localAfterDelayedPull:finalLocal,localEditOverwritten:JSON.stringify(finalLocal)!=='["latest"]',productionWrites:false},null,2));
 console.log('Diagnostic evidence only; this is not a passing product regression or a deployed fix.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{clearTimeout(completionTimer);if(db)await db.close();});
