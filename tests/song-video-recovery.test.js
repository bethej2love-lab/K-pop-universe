// Actual song-video loader + deadline helper, controlled queries; no network/DB writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=src.indexOf('function _songTitleAmbiguous('),b=src.indexOf('// 형식 칩',a);assert(a>=0&&b>a);
function fn(name){const start=src.indexOf('function '+name+'(');assert(start>=0,name);return src.slice(start,src.indexOf('\n}',start)+2);}
const timeout=fn('_withTimeout');
const issue=src.includes('function _appendSongVideoLoadIssue(')?fn('_appendSongVideoLoadIssue'):'';
function el(){const classes=new Set();return {style:{},children:[],innerHTML:'',textContent:'',hidden:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},appendChild(e){this.children.push(e);},setAttribute(){},addEventListener(type,cb){this[type]=cb;}};}
const clip={id:'official',title:'TEST song',group_ko:'owner',category:'mv',published_at:'2026-01-01'};
function fixture({responses={},pending=false,keys=true}={}){
 const nodes=new Map(),timers=new Map(),queries=[];let seq=0;
 const node=id=>{if(!nodes.has(id))nodes.set(id,el());return nodes.get(id);};
 const ctx={_YT_TABLE:'yt_channel_videos',_songVidReq:0,_songKeysCol:keys,_songVid:null,_albSong:null,currentLang:'ko',GROUPS:{},ARTISTS:[],
  document:{getElementById:node,createElement:el},_albSongApply(){},_albSongMount(){},_fillSongMeta(){},_renderCreditsInto(){},_bringToFront(){},_renderSongVideoTabs(){},
  _titleNorm:s=>s,_songBase:s=>s,_songStripTail:s=>s,_songNorm:s=>s,_pgFilterVal:s=>s,
  _coverOfQueryKeys:()=>({personKeys:['guest(owner)'],groupKey:null}),_filterBannedVideos:r=>r.filter(x=>!x.content_flag),_songCoverByTitle:()=>false,
  setTimeout:(cb,ms)=>{timers.set(++seq,{cb,ms});return seq;},clearTimeout:id=>timers.delete(id),
  sb:{from(){const q={kind:'title'};for(const name of ['select','or','ilike','order','limit','contains','eq'])q[name]=(...args)=>{
    if(name==='select'&&args[0]==='song_keys')q.kind='probe';
    if(name==='or'&&args[0].startsWith('group_ko.eq.'))q.kind='orig';
    if(name==='eq'&&args[0]==='category')q.kind='mv';
    if(name==='contains')q.kind=args[0]==='song_keys'?'key':'cover';return q;
   };
   q.then=(resolve,reject)=>{
    queries.push(q);const response=responses[q.kind]||{data:[]};
    if(pending){let release;const p=new Promise(r=>release=r);q.release=release;return p.then(resolve,reject);}
    return (response instanceof Error?Promise.reject(response):Promise.resolve(response)).then(resolve,reject);
   };return q;}}};
 vm.createContext(ctx);vm.runInContext(timeout+'\n'+src.slice(a,b)+'\n'+issue,ctx);
 return {ctx,nodes,timers,queries,node,open:()=>ctx._openSongVideos('TEST',{gko:'owner'}),
   timeout(){const all=[...timers.values()];timers.clear();all.forEach(t=>t.cb());},
   release(value={data:[]}){queries.forEach(q=>q.release?.(value));}};
}
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const completionTimer=setTimeout(()=>{console.error('song-video harness did not complete');process.exit(1);},5000);
let total=0,failed=0;async function check(name,task){total++;try{await task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 const error={data:null,error:{code:'XX000',message:'unavailable'}};
 await check('all query errors are not a successful empty result',async()=>{const f=fixture({responses:{orig:error,mv:error,key:error,title:error,cover:error}});await f.open();assert.equal(f.ctx._songVid.loadFailed,true);assert.equal(f.ctx._songVid.orig.length+f.ctx._songVid.cover.length,0);});
 await check('rejected queries are also failures',async()=>{const e=new Error('network'),f=fixture({responses:{orig:e,mv:e,key:e,title:e,cover:e}});await f.open();assert.equal(f.ctx._songVid.loadFailed,true);});
 await check('partial failure preserves valid videos',async()=>{const f=fixture({responses:{mv:error,key:{data:[clip]}}});await f.open();assert(f.ctx._songVid.orig.some(v=>v.id===clip.id));assert.equal(f.ctx._songVid.loadFailed,true);});
 await check('true zero stays a successful empty result',async()=>{const f=fixture();await f.open();assert.equal(!!f.ctx._songVid.loadFailed,false);assert.equal(f.ctx._songVid.orig.length,0);});
 await check('valid rows stay successful',async()=>{const f=fixture({responses:{key:{data:[clip]}}});await f.open();assert.equal(!!f.ctx._songVid.loadFailed,false);assert.equal(f.ctx._songVid.orig[0].id,clip.id);});
 await check('malformed response preserves other valid rows',async()=>{const f=fixture({responses:{mv:{data:{}},key:{data:[clip]}}});await f.open();assert.equal(f.ctx._songVid.loadFailed,true);assert.equal(f.ctx._songVid.orig[0].id,clip.id);});
 await check('pending queries stop loading and ignore late data',async()=>{const f=fixture({pending:true}),p=f.open();await tick();const count=f.timers.size;f.timeout();if(!count)f.release();await p;assert(count>0);const state=f.ctx._songVid;assert.equal(state.loadFailed,true);f.release({data:[clip]});await tick();assert.equal(f.ctx._songVid,state);assert.equal(state.orig.length,0);});
 await check('closing discards pending results',async()=>{const f=fixture({pending:true}),p=f.open();await tick();f.node('gc-track-videos-overlay').classList.remove('open');f.release({data:[clip]});await p;assert.equal(f.ctx._songVid,null);});
 await check('transient key probe error does not disable song keys',async()=>{const f=fixture({keys:null,responses:{probe:error}});await f.open();assert.equal(f.ctx._songKeysCol,null);assert.equal(f.ctx._songVid.loadFailed,true);});
 await check('missing-column probe preserves legacy fallback',async()=>{const f=fixture({keys:null,responses:{probe:{data:null,error:{code:'42703'}}}});await f.open();assert.equal(f.ctx._songKeysCol,false);assert.equal(!!f.ctx._songVid.loadFailed,false);});
 await check('timed-out probe remains retryable',async()=>{const f=fixture({keys:null,pending:true}),p=f.open();await tick();f.timeout();await tick();f.timeout();await p;assert.equal(f.ctx._songKeysCol,null);assert.equal(f.ctx._songVid.loadFailed,true);f.release();await tick();assert.equal(f.ctx._songKeysCol,null);});
 await check('retry can recover the key capability probe',async()=>{const responses={probe:error},f=fixture({keys:null,responses});await f.open();responses.probe={data:[]};await f.ctx._songVid.retry();assert.equal(f.ctx._songKeysCol,true);assert.equal(f.ctx._songVid.loadFailed,false);assert.equal(f.queries.filter(q=>q.kind==='probe').length,2);});
 await check('retry reopens the same song',async()=>{const f=fixture({responses:{mv:error}});await f.open();const old=f.ctx._songVid;await old.retry();assert.equal(f.ctx._songVidReq,2);assert.equal(f.ctx._songVid.gko,'owner');});
 await check('retry after closing cannot reopen a hidden host',async()=>{const f=fixture({responses:{mv:error}});await f.open();const old=f.ctx._songVid;f.node('gc-track-videos-overlay').classList.remove('open');await old.retry();assert.equal(f.ctx._songVidReq,1);});
 await check('current failure notice retries and stale notice does not',()=>{const f=fixture();let calls=0;const st={orig:[],cover:[],retry:()=>calls++};f.ctx._songVid=st;const target=el();f.ctx._appendSongVideoLoadIssue(target,st);assert.match(target.children[0].textContent,/불러오/);const button=target.children[0].children[0];button.click();assert.equal(calls,1);f.ctx._songVid={};button.click();assert.equal(calls,1);});
 await check('partial notice keeps its meaning in English',()=>{const f=fixture();f.ctx.currentLang='en';const target=el(),st={orig:[clip],cover:[],retry(){}};f.ctx._songVid=st;f.ctx._appendSongVideoLoadIssue(target,st);assert.match(target.children[0].textContent,/Some/);assert.equal(target.children[0].children[0].textContent,'Retry');});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>clearTimeout(completionTimer));
