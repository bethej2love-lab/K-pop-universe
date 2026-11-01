// Execute the actual deadline helper with a controlled clock; no real sleeps/network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),a=src.indexOf('function _withTimeout('),b=src.indexOf('\n}',a)+2;assert(a>=0&&b>a);
function fixture(){const timers=new Map();let id=0;const ctx={setTimeout:(cb,ms)=>{timers.set(++id,{cb,ms});return id;},clearTimeout:id=>timers.delete(id)};vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);return {run:ctx._withTimeout,timers,fire(){const [id,t]=timers.entries().next().value;timers.delete(id);t.cb();}};}
const completionTimer=setTimeout(()=>{console.error('timeout harness did not complete');process.exit(1);},5000);
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('fulfilled promise preserves value and clears deadline',async()=>{const f=fixture();assert.equal(await f.run(Promise.resolve('ok'),15000),'ok');assert.equal(f.timers.size,0);});
 await check('rejection preserves error and clears deadline',async()=>{const f=fixture(),error=new Error('same');await assert.rejects(f.run(Promise.reject(error),15000),e=>e===error);assert.equal(f.timers.size,0);});
 await check('factory is called once and releases deadline',async()=>{const f=fixture();let calls=0;assert.equal(await f.run(()=>{calls++;return Promise.resolve(42);},3000),42);assert.equal(calls,1);assert.equal(f.timers.size,0);});
 await check('plain value is preserved',async()=>{const f=fixture();assert.equal(await f.run(7,4000),7);assert.equal(f.timers.size,0);});
 await check('thenable is assimilated and cleaned up',async()=>{const f=fixture();assert.equal(await f.run({then:resolve=>resolve('thenable')},4000),'thenable');assert.equal(f.timers.size,0);});
 await check('deadline duration and custom error stay unchanged',async()=>{const f=fixture(),p=f.run(new Promise(()=>{}),15000,'deadline');assert.equal([...f.timers.values()][0].ms,15000);f.fire();await assert.rejects(p,/deadline/);assert.equal(f.timers.size,0);});
 await check('late success cannot reverse a timeout',async()=>{const f=fixture();let resolve;const p=f.run(new Promise(r=>resolve=r),1000,'expired');f.fire();await assert.rejects(p,/expired/);resolve('late');await Promise.resolve();assert.equal(f.timers.size,0);});
 await check('retry after rejection keeps behavior',async()=>{const f=fixture();let calls=0;const result=await f.run(()=>++calls===1?Promise.reject(new Error('first')):Promise.resolve('second'),1000,'retry',1);assert.equal(result,'second');assert.equal(calls,2);assert.equal(f.timers.size,0);});
 await check('retry after timeout keeps behavior',async()=>{const f=fixture();let calls=0;const p=f.run(()=>++calls===1?new Promise(()=>{}):Promise.resolve('second'),1000,'retry',1);f.fire();assert.equal(await p,'second');assert.equal(calls,2);assert.equal(f.timers.size,0);});
 await check('exhausted retry rejects last error',async()=>{const f=fixture();let calls=0;await assert.rejects(f.run(()=>Promise.reject(new Error('attempt '+(++calls))),1000,'retry',1),/attempt 2/);assert.equal(calls,2);assert.equal(f.timers.size,0);});
 await check('synchronous factory throw is unchanged',()=>{const f=fixture(),error=new Error('sync');assert.throws(()=>f.run(()=>{throw error;},1000),e=>e===error);assert.equal(f.timers.size,0);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(completionTimer));
