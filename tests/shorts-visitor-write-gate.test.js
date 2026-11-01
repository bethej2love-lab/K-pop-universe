// Execute actual probe continuation blocks / page settlement, including local
// redraw. Synthetic DB and probe responses only; no production requests.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function balanced(start,open){let depth=0;for(let i=open;i<src.length;i++){if(src[i]==='{')depth++;if(src[i]==='}'&&!--depth)return src.slice(start,i+1);}throw Error('Unclosed block');}
function probeBlock(name){const a=src.indexOf('async function '+name+'('),start=src.indexOf('    if(uncertain.length){',a);assert(a>=0&&start>a,name);return balanced(start,src.indexOf('{',start));}
const member=probeBlock('_enrichMemberVideosFromApi'),conn=probeBlock('_fetchApiCollabData');
const a=src.indexOf('  async function settlePage('),settle=balanced(a,src.indexOf('}){',a)+2);
const ad=src.indexOf('function _isAdmin('),admin=(src.match(/^const ADMIN_EMAIL=.*$/m)?.[0]||'')+'\n'+balanced(ad,src.indexOf('{',ad));
function fixture(role,{empty=false,stale=false,db=true}={}){
 const writes=[],logs=[],rows=[{id:'short',is_short:false},{id:'long',is_short:true}],email=src.match(/^const ADMIN_EMAIL='([^']+)'/m)[1];let renders=0;
 const user=role==='guest'?null:{email:role==='member'?'someone@example.test':email,is_anonymous:role==='anonymous'};
 const box={window:{_sbSession:user?{user}:null},console:{error:(...x)=>logs.push(x)},_YT_TABLE:'videos',uncertain:rows,
  _probeShortsBatch:async()=>{if(empty)return{promoted:[],demoted:[]};rows[0].is_short=true;rows[1].is_short=false;return{promoted:['short'],demoted:['long']};},render:()=>renders++,
  sb:db?{from:table=>({update:patch=>({in:(field,ids)=>{writes.push({table,patch,field,ids});return Promise.resolve({error:null});}})})}:null,
  state:{gen:stale?2:1,filter:'all'},document:{body:{classList:{contains:()=>false}}},_groupGcVids:()=>({renderList:rows,endPos:0,endCat:null}),renderItems:()=>{renders++;return{nodes:[]};},resolveTrailing(){}};
 vm.createContext(box);vm.runInContext(admin,box);
 const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
 return{writes,rows,logs,renders:()=>renders,async run(kind){if(kind==='page'){vm.runInContext(settle,box);await box.settlePage({myGen:1,grid:{},pageItems:rows,featured:null,pageStartPos:0,pageStartCat:null,pageNodes:[],pendingProbe:rows,hasMore:false});}else await vm.runInContext('(async()=>{'+(kind==='member'?member:conn)+'})()',box);await tick();}};
}
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const kind of ['member','connection','page'])for(const role of ['guest','anonymous','member','admin'])await check(kind+' '+role+': persist only as admin, retain local correction',async()=>{const f=fixture(role);await f.run(kind);assert.equal(f.rows[0].is_short,true);assert.equal(f.rows[1].is_short,false);assert.equal(f.writes.length,role==='admin'?(kind==='page'?2:1):0);if(kind!=='connection')assert.equal(f.renders(),1);for(const w of f.writes){assert.equal(w.table,'videos');assert.equal(w.field,'id');assert.deepEqual(Object.keys(w.patch),['is_short']);assert.equal(w.ids[0],w.patch.is_short?'short':'long');}});
 for(const kind of ['member','connection','page'])await check(kind+': unchanged classification does not write or redraw',async()=>{const f=fixture('admin',{empty:true});await f.run(kind);assert.equal(f.writes.length,0);assert.equal(f.renders(),0);});
 await check('stale visitor page is not persisted or redrawn',async()=>{const f=fixture('member',{stale:true});await f.run('page');assert.equal(f.writes.length,0);assert.equal(f.renders(),0);});
 await check('admin keeps existing background persistence for stale page',async()=>{const f=fixture('admin',{stale:true});await f.run('page');assert.equal(f.writes.length,2);assert.equal(f.renders(),0);});
 await check('missing DB on page still retains local regrouping',async()=>{const f=fixture('guest',{db:false});await f.run('page');assert.equal(f.writes.length,0);assert.equal(f.renders(),1);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
