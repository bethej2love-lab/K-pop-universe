// Actual event loader + scripted query results. No network/production writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const code=src.slice(src.indexOf('const _evCache=new Map();'),src.indexOf('const _evEdLabel='));
const row=(id,extra={})=>({id,title:'fixture',content_formats:['EV:mma','EV:mma:2025'],...extra});
function fixture(plan){
 const calls=[];const ctx={_YT_TABLE:'fixture',_eventTags:()=>['EV:mma','EV:mma:2025'],_filterBannedVideos:rs=>rs.filter(r=>r.content_flag!=='무관'),
  sb:{from(){let key='tags';const q={select:()=>q,contains:()=>q,ilike(_c,k){key=k;return q;},limit(){calls.push(key);const next=plan.shift();if(!next)throw new Error('unexpected query '+key);return typeof next==='function'?next():Promise.resolve(next);}};return q;}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return{load:(s={id:'mma'})=>ctx._eventRows(s),calls};
}
const good=data=>({data,error:null}),error=()=>({data:null,error:{message:'temporary fixture failure'}});
let total=0,failed=0;async function check(name,fn){total++;try{await fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('successful rows are reused',async()=>{const f=fixture([good([row('a')])]);assert.equal((await f.load())[0]._ed,'2025');assert.equal((await f.load())[0].id,'a');assert.equal(f.calls.length,1);});
 await check('successful empty result remains a valid cache entry',async()=>{const f=fixture([good([])]);assert.equal((await f.load()).length,0);await f.load();assert.equal(f.calls.length,1);});
 await check('returned primary error can recover on reopen',async()=>{const f=fixture([error(),good([row('recovered')])]);assert.equal((await f.load()).length,0);assert.equal((await f.load())[0]?.id,'recovered');await f.load();assert.equal(f.calls.length,2);});
 await check('rejected primary query can recover',async()=>{const f=fixture([()=>Promise.reject(new Error('offline')),good([row('recovered')])]);await assert.rejects(f.load(),/offline/);assert.equal((await f.load())[0].id,'recovered');});
 await check('concurrent opens share the in-flight lookup',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]);const p=f.load(),q=f.load();assert.equal(f.calls.length,1);done(good([row('shared')]));assert.equal((await p)[0].id,(await q)[0].id);});
 await check('successful fallback deduplicates and caches',async()=>{const f=fixture([good([row('a')]),good([row('a'),row('b')])]);const s={id:'mma',kw:['mma']};assert.deepEqual(Array.from(await f.load(s),x=>x.id),['a','b']);await f.load(s);assert.equal(f.calls.length,2);});
 await check('returned keyword error keeps usable tags but retries',async()=>{const f=fixture([good([row('a')]),error(),good([row('a')]),good([row('b')])]);const s={id:'mma',kw:['mma']};assert.deepEqual(Array.from(await f.load(s),x=>x.id),['a']);assert.deepEqual(Array.from(await f.load(s),x=>x.id),['a','b']);assert.equal(f.calls.length,4);});
 await check('one rejected keyword keeps the other results and retries',async()=>{const f=fixture([good([]),()=>Promise.reject(new Error('offline')),good([row('b')]),good([row('a')]),good([]),good([row('b')])]);const s={id:'mma',kw:['one','two']};assert.deepEqual(Array.from(await f.load(s),x=>x.id),['b']);assert.deepEqual(Array.from(await f.load(s),x=>x.id),['a','b']);assert.equal(f.calls.length,6);});
 await check('failed tags with good fallback stay usable and retryable',async()=>{const f=fixture([error(),good([row('b')]),good([row('a')]),good([row('b')])]);const s={id:'mma',kw:['mma']};assert.deepEqual(Array.from(await f.load(s),x=>x.id),['b']);assert.deepEqual(Array.from(await f.load(s),x=>x.id),['a','b']);});
 await check('null data without an error is not cached as verified empty',async()=>{const f=fixture([{data:null,error:null},good([row('a')])]);assert.equal((await f.load()).length,0);assert.equal((await f.load())[0]?.id,'a');});
 await check('large tag pool skips keyword queries',async()=>{const f=fixture([good(Array.from({length:60},(_,i)=>row(String(i))))]);assert.equal((await f.load({id:'mma',kw:['unused']})).length,60);assert.equal(f.calls.length,1);});
 await check('existing banned/other/edition filtering is retained',async()=>{const f=fixture([good([row('keep'),row('ban',{content_flag:'무관'}),row('other',{content_flag:'기타'})])]);assert.deepEqual(Array.from(await f.load(),x=>x.id),['keep']);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
