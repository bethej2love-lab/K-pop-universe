// Actual logout function with synthetic Auth/storage; never signs out a real session.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),a=src.indexOf('async function _handleLogout(){'),b=src.indexOf('\n}',a)+2;assert(a>=0&&b>a);
const keys=['FAV_KEY_G','FAV_KEY_M','FAV_KEY_C','FAV_DATE_KEY','FAV_HISTORY_KEY','SCRAP_KEY','PROFILE_KEY','CONCERT_LOG_KEY','SB_LAST_UID_KEY'];
function fixture({confirm=true,error=null,reject=false,lang='ko',client=true}={}){
 const storage=new Map(keys.map(k=>[k,'synthetic saved state']));storage.set('language','ko');let auth=0,reloads=0;const toasts=[],logs=[];
 const ctx={currentLang:lang,console:{error:(...args)=>logs.push(args)},_confirmLogout:async()=>confirm,_showShareToast:msg=>toasts.push(msg),
   sb:client?{auth:{signOut:async()=>{auth++;if(reject)throw new Error('network unavailable');return {error};}}}:null,
   localStorage:{removeItem:k=>storage.delete(k)},location:{reload:()=>reloads++}};
 for(const key of keys)ctx[key]=key;vm.createContext(ctx);vm.runInContext(src.slice(a,b),ctx);
 return {ctx,storage,toasts,logs,auth:()=>auth,reloads:()=>reloads};
}
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const [name,options] of [['returned Auth error',{error:{message:'unavailable'}}],['rejected request',{reject:true}]]){
   await check(name+' keeps local records and current page',async()=>{const f=fixture(options);await f.ctx._handleLogout();assert.equal(f.auth(),1);assert.equal(f.reloads(),0);for(const key of keys)assert(f.storage.has(key));assert.equal(f.toasts.length,1);assert.match(f.toasts[0],/로그아웃/);});
 }
 await check('failure notice uses English when selected',async()=>{const f=fixture({lang:'en',error:{message:'unavailable'}});await f.ctx._handleLogout();assert.match(f.toasts[0]||'',/log out/i);assert.equal(f.reloads(),0);});
 await check('cancel does not sign out or clear records',async()=>{const f=fixture({confirm:false});await f.ctx._handleLogout();assert.equal(f.auth(),0);assert.equal(f.reloads(),0);assert.equal(f.storage.size,keys.length+1);assert.equal(f.toasts.length,0);});
 await check('success retains existing clear-and-reload behavior',async()=>{const f=fixture();await f.ctx._handleLogout();assert.equal(f.auth(),1);assert.equal(f.reloads(),1);for(const key of keys)assert(!f.storage.has(key));assert.equal(f.storage.get('language'),'ko');assert.equal(f.toasts.length,0);});
 await check('absent client does nothing',async()=>{const f=fixture({client:false});await f.ctx._handleLogout();assert.equal(f.auth(),0);assert.equal(f.storage.size,keys.length+1);assert.equal(f.reloads(),0);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
