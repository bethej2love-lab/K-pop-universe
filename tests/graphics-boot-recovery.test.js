// Actual graphics constructor boundary with local DOM/renderer; no API/storage.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8'),a=src.indexOf('function _createUniverseRenderer('),code=src.slice(a,src.indexOf('\n}',a)+2);
class El{constructor(){this.style={};this.children=[];this.events={};this.classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x))};}set innerHTML(v){this.children=[];}appendChild(e){this.children.push(e);}addEventListener(k,cb){this.events[k]=cb;}}
function fixture(mode,lang='ko',{missing=false,stored=null,denied=false}={}){
 const root=new El(),loading=new El();root.classes=new Set(['booting','chrome-wait']);Object.assign(loading.style,{opacity:'0',display:'none'});let creates=0,reloads=0,disposed=0;
 const error=new Error('synthetic graphics unavailable'),renderer={getContext:()=>({isContextLost:()=>mode==='lost'}),dispose:()=>disposed++};
 const ctx={THREE:{WebGLRenderer:function(opts){creates++;assert.equal(opts.antialias,true);assert.equal(opts.alpha,true);if(mode==='throw')throw error;return renderer;}},navigator:{language:lang},localStorage:{getItem:k=>{assert.equal(k,'kpu_lang');if(denied)throw Error('synthetic blocked storage');return stored;}},location:{reload:()=>reloads++},document:{documentElement:root,getElementById:()=>missing?null:loading,createElement:()=>new El()}};
 vm.createContext(ctx);vm.runInContext(code,ctx);return{root,loading,error,renderer,run:()=>ctx._createUniverseRenderer(),creates:()=>creates,reloads:()=>reloads,disposed:()=>disposed};
}
const good=fixture('good');assert.equal(good.run(),good.renderer);assert.equal(good.creates(),1);assert(good.root.classes.has('booting'));assert.equal(good.loading.style.opacity,'0');assert.equal(good.loading.children.length,0);
for(const mode of ['throw','lost'])for(const lang of ['ko-KR','en-US']){
 const f=fixture(mode,lang);assert.throws(f.run,mode==='throw'?e=>e===f.error:/WebGL context unavailable/);assert.equal(f.creates(),1);assert.equal(f.disposed(),mode==='lost'?1:0);assert.equal(f.reloads(),0);
 assert(!f.root.classes.has('booting'));assert(!f.root.classes.has('chrome-wait'));assert.equal(f.loading.style.opacity,'1');assert.equal(f.loading.style.display,'flex');assert.equal(f.loading.style.visibility,'visible');assert(f.loading.classes.has('loading-error'));assert.equal(f.loading.children.length,2);
 assert.match(f.loading.children[0].textContent,lang.startsWith('ko')?/브라우저 앱/:/browser app/);const btn=f.loading.children[1];assert.equal(btn.type,'button');btn.events.click();assert.equal(f.reloads(),1);
}
const absent=fixture('throw','ko',{missing:true});assert.throws(absent.run,e=>e===absent.error);assert.equal(absent.reloads(),0);
for(const [nav,stored,denied,pattern] of [['en','ko',false,/브라우저 앱/],['ko','en',false,/browser app/],['ko',null,true,/브라우저 앱/]]){const f=fixture('throw',nav,{stored,denied});assert.throws(f.run);assert.match(f.loading.children[0].textContent,pattern);assert.equal(f.reloads(),0);}
console.log('Graphics boot: normal path, constructor/lost-context failures, KO/EN, explicit retry and no automatic retry passed');
