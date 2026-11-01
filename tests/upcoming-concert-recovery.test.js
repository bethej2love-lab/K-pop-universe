// Real cached loader; scripted responses and clock, no production calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),a=src.indexOf('let _upConcertsP=null,'),b=src.indexOf('// 공연 하나를 작은 창으로',a),code=src.slice(a,b);
function fixture(plan){let clock=1000000,calls=0;class TestDate extends Date{static now(){return clock;}}
 const provider={from(){const q={select:()=>q,gte:()=>q,lte:()=>q,order:()=>q,limit(){calls++;const n=plan.shift();if(!n)throw new Error('unexpected request');return typeof n==='function'?n():Promise.resolve(n);}};return q;}};
 const ctx={Date:TestDate,sb:provider};vm.createContext(ctx);vm.runInContext(code,ctx);return{ctx,provider,load:()=>ctx._loadUpcomingConcerts(),advance:ms=>clock+=ms,calls:()=>calls};
}
const good=data=>({data,error:null}),bad={data:null,error:{message:'temporary'}};
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('successful rows reused during TTL',async()=>{const f=fixture([good([{id:'a'}])]);assert.equal((await f.load())[0].id,'a');await f.load();assert.equal(f.calls(),1);});
 await check('verified empty array cached during TTL',async()=>{const f=fixture([good([])]);assert.equal((await f.load()).length,0);await f.load();assert.equal(f.calls(),1);});
 await check('returned error can recover immediately',async()=>{const f=fixture([bad,good([{id:'a'}])]);assert.equal((await f.load()).length,0);assert.equal((await f.load())[0]?.id,'a');});
 await check('rejected query can recover immediately',async()=>{const f=fixture([()=>Promise.reject(new Error('offline')),good([{id:'a'}])]);assert.equal((await f.load()).length,0);assert.equal((await f.load())[0]?.id,'a');});
 await check('unverified null data can recover immediately',async()=>{const f=fixture([{data:null,error:null},good([{id:'a'}])]);assert.equal((await f.load()).length,0);assert.equal((await f.load())[0]?.id,'a');});
 await check('concurrent subscribers share pending lookup',async()=>{let done;const f=fixture([()=>new Promise(r=>done=r)]),p=f.load(),q=f.load();assert.equal(f.calls(),1);done(good([{id:'a'}]));assert.equal((await p)[0].id,(await q)[0].id);});
 await check('success refreshes after original ten-minute TTL',async()=>{const f=fixture([good([{id:'old'}]),good([{id:'new'}])]);await f.load();f.advance(600001);assert.equal((await f.load())[0].id,'new');assert.equal(f.calls(),2);});
 await check('old expired failure does not discard a newer cache',async()=>{let reject;const f=fixture([()=>new Promise((_r,j)=>reject=j),good([{id:'new'}])]);const old=f.load();f.advance(600001);assert.equal((await f.load())[0].id,'new');reject(new Error('late'));await old;assert.equal((await f.load())[0].id,'new');assert.equal(f.calls(),2);});
 await check('absent provider is not remembered as verified empty',async()=>{const f=fixture([good([{id:'ready'}])]);f.ctx.sb=null;assert.equal((await f.load()).length,0);f.ctx.sb=f.provider;assert.equal((await f.load())[0].id,'ready');});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
