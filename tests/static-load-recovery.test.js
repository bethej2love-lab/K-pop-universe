// Actual lazy loaders with scripted local-file responses; no network calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const disco=src.slice(src.indexOf('const _discoProm={};'),src.indexOf('function _artistByNameGroup('));
function fn(name){const a=src.indexOf('function '+name+'('),b=src.indexOf('\n}',a)+2;assert(a>=0&&b>a);return src.slice(src.slice(a-6,a)==='async '?a-6:a,b);}
const code=disco+'\n'+fn('_loadAcData')+'\n'+fn('_ensureVenuesInfo');
const good={group:{g:[{title:'fixture'}],m:{Member:{d:[{title:'member'}],u:[]}}},member:{d:[{title:'solo'}],u:[]},tracks:{groups:{},members:{}},credits:{fixture:{aid:'1'}},venues:{venues:{Hall:{capacity:123}}}};
function fixture(kind,responses){
 let calls=0;const group={},member={id:'solo-fixture',name:{ko:'Solo'},group:{ko:'Solo'}};
 const ctx={GROUPS:{Fixture:group},ARTISTS:[{name:{ko:'Member'},group:{ko:'Fixture'}}],_TI:null,_TIProm:null,_acData:null,_acDataP:null,_venuesInfo:null,_venuesInfoP:null,
  _discoFileKey:x=>x,_soloDiscoKey:a=>a.id,fetch:async()=>{calls++;const r=responses.shift();if(r==='network')throw new Error('network');if(r==='json')return {ok:true,json:async()=>{throw new Error('invalid JSON');}};if(r==='http')return {ok:false,status:503,json:async()=>({error:'temporarily unavailable'})};if(r==='404')return {ok:false,status:404};return {ok:true,json:async()=>r};}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const run=()=>kind==='group'?ctx._ensureGroupDisco('Fixture'):kind==='member'?ctx._ensureMemberDisco(member):kind==='tracks'?ctx._ensureTracksIndex():kind==='credits'?ctx._loadAcData():ctx._ensureVenuesInfo();
 const value=()=>kind==='group'?group.discography:kind==='member'?member.discography:kind==='tracks'?ctx._TI:kind==='credits'?ctx._acData:ctx._venuesInfo;
 return {ctx,group,member,run,value,calls:()=>calls};
}
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const kind of Object.keys(good)){
  for(const fault of ['network','http','json'])await check(kind+' retries after '+fault,async()=>{const f=fixture(kind,[fault,good[kind]]);await f.run();await f.run();assert.equal(f.calls(),2);assert(f.value());assert.notDeepEqual(JSON.parse(JSON.stringify(f.value())),{});});
  await check(kind+' caches successful data',async()=>{const f=fixture(kind,[good[kind]]);await f.run();await f.run();assert.equal(f.calls(),1);});
 }
 for(const kind of Object.keys(good))await check(kind+' coalesces concurrent requests',async()=>{const f=fixture(kind,[good[kind]]);await Promise.all([f.run(),f.run()]);assert.equal(f.calls(),1);});
 for(const kind of ['group','member'])await check(kind+' retains actual missing-file empty result',async()=>{const f=fixture(kind,['404']);await f.run();assert.deepEqual(JSON.parse(JSON.stringify(f.value())),[]);await f.run();assert.equal(f.calls(),1);});
 for(const [kind,data] of [['group',{g:[],m:{}}],['member',{d:[],u:[]}],['tracks',{groups:{},members:{}}],['credits',{}],['venues',{venues:{}}]])await check(kind+' caches valid empty data',async()=>{const f=fixture(kind,[data]);await f.run();assert(f.value());await f.run();assert.equal(f.calls(),1);});
 for(const kind of Object.keys(good))await check(kind+' invalid JSON root remains retryable',async()=>{const f=fixture(kind,[null,good[kind]]);await f.run();await f.run();assert.equal(f.calls(),2);assert(f.value());});
 const searchLine=src.split('\n').find(s=>s.includes('if(!_songIndex && _SLIM_MODE && !_TI) _ensureTracksIndex().then('));assert(searchLine);
 for(const [name,response,current,expected] of [['failed load','network','same',0],['successful load',good.tracks,'same',1],['changed query',good.tracks,'new',0]])await check('search callback '+name,async()=>{
  const f=fixture('tracks',[response]);let builds=0,searches=0;Object.assign(f.ctx,{_songIndex:null,_SLIM_MODE:true,_curSearchQ:current,q:'same',_buildSongIndex:()=>{builds++;return [];},doSearch:()=>searches++});
  await vm.runInContext(searchLine,f.ctx);assert.equal(builds,expected);assert.equal(searches,expected);if(!expected)assert.equal(f.ctx._songIndex,null);
 });
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
