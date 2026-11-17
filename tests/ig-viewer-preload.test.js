// 인스타 사진 뷰어 미리 받기·로딩 대기(2026-11-17 사용자 "옆으로 사진 느리게 넘어가고 번쩍거린다").
// 실제 app.js의 _igvPre/_igvPreload/_igvGo를 잘라 가짜 Image·타이머로 돌린다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const cut=(name,endMarker)=>{const a=src.indexOf('function '+name+'(');assert(a>=0,name+' 없음');return src.slice(a,src.indexOf(endMarker,a)+endMarker.length);};
const code=cut('_igvPre','\n}\n')+'\n'+cut('_igvPreload','\n')+'\n'+cut('_igvGo','\n}\n');
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
function env(pics,i,{w=300,loaded=new Set()}={}){
  const made=[],timers=[],events=[];
  class Img{constructor(){this.listeners={};this.complete=false;this.naturalWidth=0;made.push(this);}
    set src(v){this._src=v;if(loaded.has(v)){this.complete=true;this.naturalWidth=100;}}get src(){return this._src;}
    decode(){return Promise.resolve();}
    addEventListener(t,f){(this.listeners[t]||(this.listeners[t]=[])).push(f);}
    fire(t){this.complete=true;this.naturalWidth=100;(this.listeners[t]||[]).forEach(f=>f());}}
  const nodes={};const q=sel=>nodes[sel]||(nodes[sel]={style:{},clientWidth:w,classList:{toggle(){}},decode:()=>Promise.resolve(),set src(v){this._s=v;},get src(){return this._s;}});
  const ov={querySelector:q};
  const box={Image:Img,document:{getElementById:()=>ov},setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},Promise,
    _igv:{i,pics,anim:false,tagEditor:null},_igvPos:(dx,a)=>events.push(['pos',dx,a]),_igvShow:()=>events.push(['show'])};
  vm.createContext(box);vm.runInContext(code,box);
  return {box,made,timers,events};
}
const pics=['a','b','c','d','e','f'];
check('열자마자 앞 3장·뒤 1장을 미리 받는다(범위 밖은 안 받는다)',()=>{const e=env(pics,0);e.box._igvPreload();assert.deepEqual(e.made.map(x=>x.src),['b','c','d']);});
check('가운데에서는 앞 3장+뒤 1장',()=>{const e=env(pics,2);e.box._igvPreload();assert.deepEqual(e.made.map(x=>x.src).sort(),['b','d','e','f']);});
check('같은 장은 두 번 받지 않는다',()=>{const e=env(pics,0);e.box._igvPreload();e.box._igvPreload();assert.equal(e.made.length,3);});
check('범위 밖 번호는 null',()=>{const e=env(pics,0);assert.equal(e.box._igvPre(-1),null);assert.equal(e.box._igvPre(99),null);});
check('이미 받은 사진이면 기다리지 않고 바로 미끄러진다',async()=>{const e=env(pics,0,{loaded:new Set(['b'])});e.box._igvGo(1);await Promise.resolve();await Promise.resolve();assert(e.events.some(x=>x[0]==='pos'&&x[1]===-300&&x[2]===true),JSON.stringify(e.events));});
check('안 받은 사진이면 받아질 때까지 미끄러지지 않고, 받아지면 미끄러진다',()=>{
  const e=env(pics,0);e.box._igvGo(1);
  return Promise.resolve().then(()=>Promise.resolve()).then(()=>{
    assert(!e.events.some(x=>x[0]==='pos'),'받기 전에 미끄러짐 '+JSON.stringify(e.events));
    assert.equal(e.box._igv.anim,true,'대기 중 중복 넘기기를 막아야 한다');
    e.made.find(m=>m.src==='b').fire('load');
  }).then(()=>Promise.resolve()).then(()=>{assert(e.events.some(x=>x[0]==='pos'&&x[2]===true),'받은 뒤 미끄러짐 '+JSON.stringify(e.events));});
});
check('로딩이 안 끝나도 1.5초 뒤에는 넘어간다(무한 대기 없음)',()=>{
  const e=env(pics,0);e.box._igvGo(1);
  return Promise.resolve().then(()=>{const t=e.timers.find(x=>x.ms===1500);assert(t,'1.5초 타이머 없음');t.f();}).then(()=>Promise.resolve()).then(()=>{assert(e.events.some(x=>x[0]==='pos'),'타임아웃 뒤 미끄러짐 없음');});
});
check('끝 장에서 더 넘기면 아무 일 없다',()=>{const e=env(pics,5);e.box._igvGo(1);assert.equal(e.events.length,0);});
// check()가 비동기 결과를 못 잡으니 약간 기다렸다 요약
setTimeout(()=>{console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;},50);
