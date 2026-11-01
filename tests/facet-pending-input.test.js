// Actual list facet renderer and click callbacks; tiny DOM + deferred actions, no production API.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),a=src.indexOf('function _renderFeedListFacet('),code=src.slice(a,src.indexOf('\nfunction _openFeedListOverlay(',a));
class El{
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.style={};this.attrs={};this.classes=new Set();this.offsetLeft=0;this.clientWidth=300;this.textContent='';this.classList={add:(...a)=>a.forEach(x=>this.classes.add(x)),remove:(...a)=>a.forEach(x=>this.classes.delete(x)),contains:x=>this.classes.has(x)};}
 set className(v){this.classes=new Set(v.split(/\s+/).filter(Boolean));}get className(){return [...this.classes].join(' ');}
 set innerHTML(v){this.children=[];this.html=v;}get innerHTML(){return this.html||'';}
 appendChild(e){this.children.push(e);e.parentElement=this;return e;}setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,f){this.events[k]=f;}click(){this.events.click?.({stopPropagation(){}});}
 querySelectorAll(s){const keys=s.split('.').filter(Boolean),all=[];const walk=e=>e.children.forEach(c=>{if(keys.every(k=>c.classes.has(k)))all.push(c);walk(c);});walk(this);return all;}
 querySelector(s){if(s==='.lbl')return this.label||(this.label=new El('span'));return this.querySelectorAll(s)[0]||null;}
}
const tick=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function fixture({panel=true}={}){
 const root=new El(),pn=panel?new El():null,pending=[],picks=[];
 const ctx={currentLang:'ko',document:{getElementById:id=>id==='feed-list-facets'?root:id==='feed-list-panel'?pn:null,createElement:t=>new El(t)},_enableDragScroll(){},_openPickSheet:(_t,_e,items,cb)=>picks.push({items,cb})};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const action=v=>new Promise((resolve,reject)=>pending.push({v,resolve,reject}));
 const sort=()=>({ui:'sort',sel:'latest',options:[{v:'latest',ko:'최신순'},{v:'popular',ko:'인기순'},{v:'oldest',ko:'오래된순'}],onPick:action});
 return{root,pn,pending,picks,action,sort,render:facets=>ctx._renderFeedListFacet({facets}),buttons:s=>root.querySelectorAll(s),busy:()=>!!pn?.classList.contains('fl-loading')};
}
let total=0,failed=0;async function check(name,f){total++;try{await f();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('rapid sort clicks advance through each displayed value',async()=>{const f=fixture();f.render([f.sort()]);const b=f.buttons('.tvf-sort')[0];b.click();b.click();b.click();await tick();assert.deepEqual(f.pending.map(x=>x.v),['popular','oldest','latest']);assert.equal(b.textContent,'최신순');});
 await check('single sort click preserves existing behavior',async()=>{const f=fixture();f.render([f.sort()]);f.buttons('.tvf-sort')[0].click();await tick();assert.equal(f.pending[0].v,'popular');assert(f.busy());f.pending[0].resolve();await tick();assert(!f.busy());});
 await check('older completion keeps latest pending loader visible',async()=>{const f=fixture();f.render([f.sort()]);const b=f.buttons('.tvf-sort')[0];b.click();b.click();await tick();f.pending[0].resolve();await tick();assert(f.busy());f.pending[1].resolve();await tick();assert(!f.busy());});
 await check('latest completion clears loading despite an older ignored request',async()=>{const f=fixture();f.render([f.sort()]);const b=f.buttons('.tvf-sort')[0];b.click();b.click();await tick();f.pending[1].resolve();await tick();assert(!f.busy());f.pending[0].resolve();await tick();assert(!f.busy());});
 await check('older rejection does not clear latest pending loading',async()=>{const f=fixture();f.render([f.sort()]);const b=f.buttons('.tvf-sort')[0];b.click();b.click();await tick();f.pending[0].reject(new Error('old'));await tick();assert(f.busy());f.pending[1].resolve();await tick();assert(!f.busy());});
 await check('new unfiltered list clears loading from the prior list',async()=>{const f=fixture();f.render([f.sort()]);f.buttons('.tvf-sort')[0].click();await tick();assert(f.busy());f.render([]);assert(!f.busy());f.pending[0].resolve();await tick();assert(!f.busy());});
 await check('old finalizer cannot clear a new list loading state',async()=>{const f=fixture();f.render([f.sort()]);f.buttons('.tvf-sort')[0].click();await tick();f.render([f.sort()]);f.buttons('.tvf-sort')[0].click();await tick();f.pending[0].resolve();await tick();assert(f.busy());f.pending[1].resolve();await tick();assert(!f.busy());});
 await check('missing panel still runs the action',async()=>{const f=fixture({panel:false});f.render([f.sort()]);f.buttons('.tvf-sort')[0].click();await tick();assert.equal(f.pending[0].v,'popular');f.pending[0].resolve();await tick();});
 await check('tab can return to original choice before response arrives',async()=>{const f=fixture();f.render([{sel:'all',options:[{v:'all',ko:'전체'},{v:'live',ko:'라이브'}],onPick:f.action}]);const bs=f.buttons('.gc-ch-filter');bs[1].click();bs[0].click();await tick();assert.deepEqual(f.pending.map(x=>x.v),['live','all']);assert(bs[0].classList.contains('active'));assert(!bs[1].classList.contains('active'));});
 await check('clicking the already displayed tab does not query again',async()=>{const f=fixture();f.render([{sel:'all',options:[{v:'all',ko:'전체'},{v:'live',ko:'라이브'}],onPick:f.action}]);const bs=f.buttons('.gc-ch-filter');bs[0].click();await tick();assert.equal(f.pending.length,0);bs[1].click();bs[1].click();await tick();assert.equal(f.pending.length,1);});
 await check('pick-sheet selection retains existing callback and loading behavior',async()=>{const f=fixture();f.render([{ui:'pick',sel:'all',options:[{v:'all',ko:'전체'},{v:'G',ko:'그룹'}],onPick:f.action}]);f.buttons('.gc-vid-pick')[0].click();assert.equal(f.picks.length,1);assert.equal((await f.picks[0].items)[0].key,'G');f.picks[0].cb('G');await tick();assert.equal(f.pending[0].v,'G');assert(f.busy());f.pending[0].resolve();await tick();assert(!f.busy());});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
