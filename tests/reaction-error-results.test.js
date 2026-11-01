// Actual reaction read/write functions; synthetic Supabase only, no production writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=src.indexOf('let _reactionLoadSeq='),end=src.indexOf('\nfunction _renderReactions(){',start);assert(start>0&&end>start);
const url='https://example.test/video',emoji='🥹',key=url+'\x00'+emoji;
function fixture({on=false,count=4,result={error:null},readCounts={data:[{emoji,cnt:7}],error:null},readMine={data:[{emoji}],error:null},reject=false,session=true}={}){
 const mine=new Set(on?[key]:[]),counts=new Map([[key,count],['other\x00🥹',9]]),calls=[],logs=[];let renders=0;
 const ctx={window:{_sbSession:session?{user:{id:'synthetic'}}:null},document:{getElementById:()=>({classList:{remove(){}}})},
  _myReactions:mine,_reactionCounts:counts,_lbCurVideoUrl:url,_renderReactions:()=>renders++,console:{error:(...a)=>logs.push(a)},
  sb:{from(table){let op='read';const q={select(){return q;},eq(...args){calls.push(['eq',...args]);return q;},delete(){op='delete';calls.push(['delete',table]);return q;},upsert(row,options){op='upsert';calls.push(['upsert',table,row,options]);return q;},
   then(resolve,rejectFn){if(reject)return Promise.reject(new Error('synthetic network failure')).then(resolve,rejectFn);return Promise.resolve(op==='read'?(table==='video_reaction_counts'?readCounts:readMine):result).then(resolve,rejectFn);}};return q;}}};
 vm.createContext(ctx);vm.runInContext(src.slice(start,end),ctx);
 return {ctx,counts,calls,logs,renders:()=>renders,mine:()=>ctx._myReactions};
}
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const on of [false,true]){
  await check('returned write error restores '+(on?'selected':'unselected')+' state',async()=>{const f=fixture({on,result:{error:{message:'denied'}}});await f.ctx._toggleReaction(url,emoji);assert.equal(f.mine().has(key),on);assert.equal(f.counts.get(key),4);assert.equal(f.logs.length,1);});
  await check('rejected write restores '+on,async()=>{const f=fixture({on,reject:true});await f.ctx._toggleReaction(url,emoji);assert.equal(f.mine().has(key),on);assert.equal(f.counts.get(key),4);});
  await check('successful write retains optimistic '+!on,async()=>{const f=fixture({on});await f.ctx._toggleReaction(url,emoji);assert.equal(f.mine().has(key),!on);assert.equal(f.counts.get(key),on?3:5);assert.equal(f.logs.length,0);assert.equal(f.counts.get('other\x00🥹'),9);});
 }
 await check('failed read preserves known counts and own selection',async()=>{const f=fixture({on:true,readMine:{data:null,error:{message:'unavailable'}}});await f.ctx._loadReactions(url);assert(f.mine().has(key));assert.equal(f.counts.get(key),4);assert.equal(f.logs.length,1);});
 await check('count failure does not mix partial snapshot',async()=>{const f=fixture({on:true,readCounts:{data:null,error:{message:'unavailable'}},readMine:{data:[],error:null}});await f.ctx._loadReactions(url);assert(f.mine().has(key));assert.equal(f.counts.get(key),4);});
 await check('malformed result preserves last state',async()=>{const f=fixture({on:true,readMine:{data:null,error:null}});await f.ctx._loadReactions(url);assert(f.mine().has(key));assert.equal(f.counts.get(key),4);});
 await check('success updates actual snapshot',async()=>{const f=fixture();await f.ctx._loadReactions(url);assert(f.mine().has(key));assert.equal(f.counts.get(key),7);assert.equal(f.counts.get('other\x00🥹'),9);});
 await check('valid empty snapshot clears this video cached counts',async()=>{const f=fixture({on:true,readCounts:{data:[],error:null},readMine:{data:[],error:null}});await f.ctx._loadReactions(url);assert(!f.mine().has(key));assert.equal(f.counts.get(key)||0,0);assert.equal(f.counts.get('other\x00🥹'),9);});
 await check('another current video discards previous response',async()=>{const f=fixture({on:true});f.ctx._lbCurVideoUrl='other';await f.ctx._loadReactions(url);assert(f.mine().has(key));assert.equal(f.counts.get(key),4);});
 await check('no session causes no write or optimistic change',async()=>{const f=fixture({session:false});await f.ctx._toggleReaction(url,emoji);assert.equal(f.calls.length,0);assert.equal(f.counts.get(key),4);});
 await check('delete still filters user/video/emoji',async()=>{const f=fixture({on:true});await f.ctx._toggleReaction(url,emoji);for(const pair of [['user_id','synthetic'],['video_url',url],['emoji',emoji]])assert(f.calls.some(c=>c[0]==='eq'&&c[1]===pair[0]&&c[2]===pair[1]));});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
