// Actual client functions with deferred synthetic queries; never writes production reactions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=src.includes('let _reactionLoadSeq=')?src.indexOf('let _reactionLoadSeq='):src.indexOf('async function _loadReactions(videoUrl){');
const code=src.slice(start,src.indexOf('\nfunction _renderReactions(){',start));
const A='video-A',B='video-B',emoji='🥹',key=(v=A,e=emoji)=>v+'\x00'+e;
const tick=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture({on=false}={}){
 const requests=[],logs=[],persisted=new Map();let renders=0;
 const ctx={window:{_sbSession:{user:{id:'user-A'}}},document:{getElementById:()=>({classList:{remove(){}}})},console:{error:(...a)=>logs.push(a)},
  _myReactions:new Set(on?[key()]:[]),_reactionCounts:new Map([[key(),4]]),_lbCurVideoUrl:A,_renderReactions:()=>renders++,
  sb:{from(table){const filters={};let kind=table==='video_reaction_counts'?'counts':'mine',payload;
    const q={select(){return q;},eq(k,v){filters[k]=v;return q;},delete(){kind='off';return q;},upsert(row){kind='on';payload=row;return q;},then(resolve,reject){return new Promise((done,fail)=>requests.push({kind,filters,payload,done,fail,settled:false})).then(resolve,reject);}};return q;}}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const finish=(r,value)=>{assert(r&&!r.settled,'missing/settled request');r.settled=true;if(r.kind==='on'||r.kind==='off'){if(!value?.error){const uid=r.payload?.user_id||r.filters.user_id,v=r.payload?.video_url||r.filters.video_url,e=r.payload?.emoji||r.filters.emoji;persisted.set(uid+'|'+key(v,e),r.kind==='on');}}r.done(value||{error:null});};
 const reads=()=>requests.filter(r=>['counts','mine'].includes(r.kind));const writes=()=>requests.filter(r=>['on','off'].includes(r.kind));
 const finishRead=(pair,on,count=4)=>{finish(pair.find(r=>r.kind==='counts'),{data:count?[{emoji,cnt:count}]:[],error:null});finish(pair.find(r=>r.kind==='mine'),{data:on?[{emoji}]:[],error:null});};
 return {ctx,requests,logs,persisted,finish,finishRead,reads,writes,on:()=>ctx._myReactions.has(key()),count:()=>ctx._reactionCounts.get(key())||0,renderCount:()=>renders};
}
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('on then off serializes writes and retains last choice',async()=>{const f=fixture(),p=f.ctx._toggleReaction(A,emoji),q=f.ctx._toggleReaction(A,emoji);await tick();assert.equal(f.writes().length,1);assert(!f.on());f.finish(f.writes()[0]);await tick();assert.equal(f.writes().length,2);assert.equal(f.writes()[1].kind,'off');f.finish(f.writes()[1]);await Promise.all([p,q]);assert(!f.on());assert.equal(f.count(),4);assert.equal(f.persisted.get('user-A|'+key()),false);});
 await check('three rapid clicks coalesce to the final on choice',async()=>{const f=fixture(),ps=[f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji)];await tick();assert.equal(f.writes().length,1);f.finish(f.writes()[0]);await Promise.all(ps);assert(f.on());assert.equal(f.count(),5);assert.equal(f.writes().length,1);});
 await check('different emoji requests remain independent',async()=>{const f=fixture(),ps=[f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,'🫠')];await tick();assert.equal(f.writes().length,2);for(const r of f.writes())f.finish(r);await Promise.all(ps);assert(f.ctx._myReactions.has(key(A,'🫠')));assert(f.on());});
 await check('latest same-video read wins',async()=>{const f=fixture(),p=f.ctx._loadReactions(A);await tick();const old=f.reads().slice();const q=f.ctx._loadReactions(A);await tick();f.finishRead(f.reads().filter(r=>!old.includes(r)),true,9);await q;f.finishRead(old,false,2);await p;assert(f.on());assert.equal(f.count(),9);});
 await check('A to B to A cannot accept the first A response',async()=>{const f=fixture(),p=f.ctx._loadReactions(A);await tick();const first=f.reads().slice();f.ctx._lbCurVideoUrl=B;const middle=f.ctx._loadReactions(B);await tick();const second=f.reads().filter(r=>!first.includes(r));f.ctx._lbCurVideoUrl=A;const last=f.ctx._loadReactions(A);await tick();f.finishRead(f.reads().filter(r=>!first.includes(r)&&!second.includes(r)),true,8);await last;f.finishRead(second,false,3);await middle;f.finishRead(first,false,1);await p;assert(f.on());assert.equal(f.count(),8);});
 await check('a read started before a click cannot overwrite its acknowledged result',async()=>{const f=fixture(),reading=f.ctx._loadReactions(A);await tick();const old=f.reads().slice();const writing=f.ctx._toggleReaction(A,emoji);await tick();f.finish(f.writes()[0]);await writing;f.finishRead(old,false,4);await reading;assert(f.on());assert.equal(f.count(),5);});
 await check('pending local write is preserved when reopening that video',async()=>{const f=fixture(),writing=f.ctx._toggleReaction(A,emoji);await tick();const reading=f.ctx._loadReactions(A);await tick();assert.equal(f.reads().length,0);f.finish(f.writes()[0]);await Promise.all([writing,reading]);assert(f.on());assert.equal(f.count(),5);});
 await check('reading another video keeps pending ownership for the first',async()=>{const f=fixture(),writing=f.ctx._toggleReaction(A,emoji);await tick();f.ctx._lbCurVideoUrl=B;const reading=f.ctx._loadReactions(B);await tick();f.finishRead(f.reads(),false,4);await reading;assert(f.on());f.finish(f.writes()[0]);await writing;assert(f.on());});
 await check('failed old intent cannot undo a newer on choice',async()=>{const f=fixture(),ps=[f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji)];await tick();assert.equal(f.writes().length,1);f.finish(f.writes()[0],{error:{message:'synthetic failure'}});await tick();assert(f.on());assert.equal(f.writes().length,2);f.finish(f.writes()[1]);await Promise.all(ps);assert(f.on());assert.equal(f.count(),5);});
 await check('new off intent is sent even after uncertain on failure',async()=>{const f=fixture(),ps=[f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji)];await tick();assert.equal(f.writes().length,1);f.finish(f.writes()[0],{error:{message:'uncertain delivery'}});await tick();assert.equal(f.writes().length,2);assert.equal(f.writes()[1].kind,'off');f.finish(f.writes()[1]);await Promise.all(ps);assert(!f.on());});
 await check('failed latest delete restores the last confirmed on state',async()=>{const f=fixture(),ps=[f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji)];await tick();assert.equal(f.writes().length,1);f.finish(f.writes()[0]);await tick();f.finish(f.writes()[1],{error:{message:'denied'}});await Promise.all(ps);assert(f.on());assert.equal(f.count(),5);});
 await check('single rejected write restores prior state without retry loop',async()=>{const f=fixture(),p=f.ctx._toggleReaction(A,emoji);await tick();const r=f.writes()[0];r.settled=true;r.fail(new Error('offline'));await p;assert(!f.on());assert.equal(f.count(),4);assert.equal(f.writes().length,1);});
 await check('old account completion does not affect new account or send its queued intent',async()=>{const f=fixture(),ps=[f.ctx._toggleReaction(A,emoji),f.ctx._toggleReaction(A,emoji)];await tick();assert.equal(f.writes().length,1);f.ctx.window._sbSession={user:{id:'user-B'}};const reading=f.ctx._loadReactions(A);await tick();f.finishRead(f.reads(),false,4);await reading;f.finish(f.writes()[0]);await Promise.all(ps);assert(!f.on());assert.equal(f.count(),4);assert.equal(f.writes().length,1);});
 await check('read response from an old account is ignored',async()=>{const f=fixture(),p=f.ctx._loadReactions(A);await tick();f.ctx.window._sbSession={user:{id:'user-B'}};f.finishRead(f.reads(),true,20);await p;assert(!f.on());assert.equal(f.count(),4);});
 await check('malformed own-reaction row never partially replaces counts',async()=>{const f=fixture({on:true}),p=f.ctx._loadReactions(A);await tick();f.finish(f.reads().find(r=>r.kind==='counts'),{data:[{emoji,cnt:99}],error:null});f.finish(f.reads().find(r=>r.kind==='mine'),{data:[null],error:null});await p;assert(f.on());assert.equal(f.count(),4);});
 await check('click queued by rollback render starts a fresh request',async()=>{
  const f=fixture();let armed=false,next;
  f.ctx._renderReactions=()=>{if(armed){armed=false;Promise.resolve().then(()=>{next=f.ctx._toggleReaction(A,emoji);});}};
  const first=f.ctx._toggleReaction(A,emoji);await tick();armed=true;
  f.finish(f.writes()[0],{error:{message:'denied'}});await first;await tick();
  assert.equal(f.writes().length,2,'new input must not attach to a finished runner');
  f.finish(f.writes()[1]);await next;assert(f.on());assert.equal(f.count(),5);
 });
 await check('old account-A failure cannot roll back a new A session after A/B/A',async()=>{
  const f=fixture(),old=f.ctx._toggleReaction(A,emoji);await tick();
  f.ctx.window._sbSession={user:{id:'user-B'}};const read=f.ctx._loadReactions(A);await tick();f.finishRead(f.reads(),false,4);await read;
  f.ctx.window._sbSession={user:{id:'user-A'}};const fresh=f.ctx._toggleReaction(A,emoji);await tick();assert.equal(f.writes().length,2);
  f.finish(f.writes()[0],{error:{message:'old A failure'}});await old;assert(f.on(),'new session intent must survive old failure');
  f.finish(f.writes()[1]);await fresh;assert(f.on());assert.equal(f.count(),5);
 });
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
