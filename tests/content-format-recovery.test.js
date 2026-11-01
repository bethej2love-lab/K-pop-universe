// Actual RPC loader + menu closure, scripted provider/DOM only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=src.indexOf('  async function _loadAvailableFormats('),loader=src.slice(a,src.indexOf('\n  }',a)+4);
const b=src.indexOf('    let _fmtReq=null;'),menu=src.slice(b,src.indexOf('\n    _loadCoverOfSection(',b));
const good=data=>({data,error:null}),bad={data:null,error:{message:'temporary'}};
function fixture(plan,{cache=new Map(),member='M'}={}){
 const calls=[],styles={toggle:{style:{display:'none'}},divider:{style:{display:'none'}}},state={ko:'G',memberKo:member,formats:[]};
 const provider={rpc(name,args){calls.push({name,args});const n=plan.shift();if(!n)throw new Error('unexpected query');return typeof n==='function'?n():Promise.resolve(n);}};
 let renders=0;
 const ctx={renderFilterTabs:()=>renders++,ko:'G',memberKo:member,state,sb:provider,_fmtCache:cache,cont:{querySelector:s=>s.includes('view-toggle')?styles.toggle:styles.divider}};
 vm.createContext(ctx);vm.runInContext(loader+'\n'+menu+'\nglobalThis.ensure=_ensureFormats;',ctx);
 return{ctx,state,styles,calls,cache,provider,renderCount:()=>renders,run:()=>ctx.ensure()};
}
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('successful formats render and retain RPC keys',async()=>{const f=fixture([good(['live',null,'','dance'])]);await f.run();assert.deepEqual(Array.from(f.state.formats),['live','dance']);assert.equal(f.styles.toggle.style.display,'');assert.equal(f.calls[0].name,'get_content_formats');assert.equal(f.calls[0].args.p_group_ko,'G');assert.equal(f.calls[0].args.p_member_ko,'M');});
 await check('verified empty stays cached without showing a toggle',async()=>{const f=fixture([good([])]);await f.run();await f.run();assert.equal(f.calls.length,1);assert.equal(f.styles.toggle.style.display,'none');});
 await check('returned error can recover on next menu open',async()=>{const f=fixture([bad,good(['live'])]);await f.run();await f.run();assert.equal(f.state.formats[0],'live');assert.equal(f.calls.length,2);});
 await check('rejected RPC is handled and next menu open recovers',async()=>{const f=fixture([()=>Promise.reject(new Error('offline')),good(['live'])]);await f.run();await f.run();assert.equal(f.state.formats[0],'live');});
 await check('null data is not permanently cached as empty',async()=>{const f=fixture([{data:null,error:null},good(['live'])]);await f.run();await f.run();assert.equal(f.state.formats[0],'live');});
 await check('malformed result is handled without a poisoned local promise',async()=>{const f=fixture([good({bad:true}),good(['live'])]);await f.run();await f.run();assert.equal(f.state.formats[0],'live');});
 await check('provider missing then ready recovers',async()=>{const f=fixture([good(['live'])]);f.ctx.sb=null;await f.run();f.ctx.sb=f.provider;await f.run();assert.equal(f.state.formats[0],'live');assert.equal(f.calls.length,1);});
 await check('concurrent opens share one in-flight RPC',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]),p=f.run(),q=f.run();assert.equal(f.calls.length,1);done(good(['live']));await Promise.all([p,q]);assert.equal(f.state.formats[0],'live');});
 await check('failed result cannot poison a newly built card menu',async()=>{const f=fixture([bad]);await f.run();const next=fixture([good(['live'])],{cache:f.cache});await next.run();assert.equal(next.state.formats[0],'live');assert.equal(next.calls.length,1);});
 await check('successful global cache reused by newly built menu',async()=>{const f=fixture([good(['live'])]);await f.run();const next=fixture([],{cache:f.cache});await next.run();assert.equal(next.state.formats[0],'live');assert.equal(next.calls.length,0);});
 await check('member identity is part of cache key; group-only sends null',async()=>{const f=fixture([good(['live'])]);await f.run();const next=fixture([good(['dance'])],{cache:f.cache,member:null});await next.run();assert.equal(next.state.formats[0],'dance');assert.equal(next.calls[0].args.p_member_ko,null);});
 await check('late result does not paint another group card',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]),p=f.run();f.state.ko='newG';done(good(['live']));await p;assert.equal(f.state.formats.length,0);assert.equal(f.styles.toggle.style.display,'none');assert.equal(f.cache.get('G␟M')[0],'live');});
 await check('late result does not paint another member card',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]),p=f.run();f.state.memberKo='newM';done(good(['live']));await p;assert.equal(f.state.formats.length,0);assert.equal(f.styles.toggle.style.display,'none');});
 await check('failures retry only with new explicit opens',async()=>{const f=fixture([bad,bad,good(['live'])]);await f.run();await Promise.resolve();assert.equal(f.calls.length,1);await f.run();assert.equal(f.calls.length,2);await f.run();assert.equal(f.calls.length,3);assert.equal(f.state.formats[0],'live');});
 await check('active format view refreshes tabs when recovered',async()=>{const f=fixture([bad,good(['live'])]);f.state.viewMode='format';await f.run();assert.equal(f.renderCount(),0);await f.run();assert.equal(f.renderCount(),1);assert.equal(f.state.formats[0],'live');await f.run();assert.equal(f.renderCount(),1);});
 await check('first successful active-format open refreshes tabs once',async()=>{const f=fixture([good(['live'])]);f.state.viewMode='format';await f.run();assert.equal(f.renderCount(),1);});
 await check('render defects are not swallowed as lookup failures',async()=>{const f=fixture([good(['live'])]);f.state.viewMode='format';f.ctx.renderFilterTabs=()=>{throw new Error('render defect');};await assert.rejects(f.run(),/render defect/);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
