// 인스타 사진 뷰어 미리 받기·로딩 대기(2026-11-17 사용자 "옆으로 사진 느리게 넘어가고 번쩍거린다").
// 실제 app.js의 _igvPre/_igvPreload/_igvGo를 잘라 가짜 Image·타이머로 돌린다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const cut=(name,endMarker)=>{const a=src.indexOf('function '+name+'(');assert(a>=0,name+' 없음');return src.slice(a,src.indexOf(endMarker,a)+endMarker.length);};
const code=cut('_igvPre','\n}\n')+'\n'+cut('_igvPreload','\n}\n')+'\n'+cut('_igvGo','\n}\n')+'\n'+cut('_igvSettle','\n}\n');
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
function env(pics,i,{w=300,loaded=new Set()}={}){
  const made=[],timers=[],events=[],idle=[];
  class Img{constructor(){this.listeners={};this.complete=false;this.naturalWidth=0;made.push(this);}
    set src(v){this._src=v;if(loaded.has(v)){this.complete=true;this.naturalWidth=100;}}get src(){return this._src;}
    decode(){return Promise.resolve();}
    addEventListener(t,f){(this.listeners[t]||(this.listeners[t]=[])).push(f);}
    fire(t){this.complete=true;this.naturalWidth=100;(this.listeners[t]||[]).forEach(f=>f());}}
  const nodes={};const q=sel=>nodes[sel]||(nodes[sel]={style:{},clientWidth:w,classList:{toggle(){}},decode:()=>Promise.resolve(),set src(v){this._s=v;},get src(){return this._s;}});
  const ov={querySelector:q};
  const box={window:{requestIdleCallback:f=>{idle.push(f);}},Image:Img,document:{getElementById:()=>ov},setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout:()=>{},Promise,
    _igv:{i,pics,anim:false,tagEditor:null},_igvPos:(dx,a)=>events.push(['pos',dx,a]),_igvShow:()=>events.push(['show'])};
  vm.createContext(box);vm.runInContext(code,box);
  return {box,made,timers,events,idle};
}
const pics=['a','b','c','d','e','f'];
check('열자마자 앞 4장·뒤 1장을 미리 받는다(범위 밖은 안 받는다)',()=>{const e=env(pics,0);e.box._igvPreload();assert.deepEqual(e.made.map(x=>x.src),['b','c','d','e']);});
check('가운데에서는 앞 4장+뒤 1장',()=>{const e=env(pics,2);e.box._igvPreload();assert.deepEqual(e.made.map(x=>x.src).sort(),['b','d','e','f']);});
check('같은 장은 두 번 받지 않는다',()=>{const e=env(pics,0);e.box._igvPreload();e.box._igvPreload();assert.equal(e.made.length,4);});
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
check('7장 넘는 게시물은 한가할 때 나머지도 전부 받는다',()=>{const p=['a','b','c','d','e','f','g','h','i','j'];const e=env(p,0);e.box._igvPreload();assert.deepEqual(e.made.map(x=>x.src),['b','c','d','e']);assert.equal(e.idle.length,1);e.idle[0]();assert.deepEqual([...new Set(e.made.map(x=>x.src))].sort(),['a','b','c','d','e','f','g','h','i','j']);});
check('연달아 넘기면 진행 중인 미끄러짐을 바로 끝내고 다음으로(인스타처럼)',()=>{
  const e=env(pics,0,{loaded:new Set(['b','c'])});e.box._igvGo(1);
  return Promise.resolve().then(()=>Promise.resolve()).then(()=>{
    assert.equal(e.box._igv.i,0);assert.equal(e.box._igv.anim,true);
    e.box._igvGo(1); // 첫 미끄러짐 중에 또 넘김
    assert.equal(e.box._igv.i,1,'첫 넘기기가 즉시 끝나야 한다');
  }).then(()=>Promise.resolve()).then(()=>{assert.equal(e.events.filter(x=>x[0]==='pos'&&x[2]===true).length,2,'미끄러짐이 두 번 시작돼야 한다 '+JSON.stringify(e.events));});
});
// check()가 비동기 결과를 못 잡으니 약간 기다렸다 요약
setTimeout(()=>{console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;},50);

// 모바일에서 인스타 뷰어가 열려 있으면 3D 우주 렌더를 멈춘다(2026-11-17 사용자 "사진 넘기기 아직 느리다") — 헤드리스 실측: 옛 코드 뷰어 열림 중 프레임 6/2초, 새 코드 0, 닫으면 복귀.
// 소스 검사: animate()의 모바일 스킵 조건에 igv-overlay가 있어야 한다(데스크톱은 무대 옆 패널이라 제외).
{
  const a0 = src.indexOf('function animate(){'), body = src.slice(a0, a0 + 9000);
  const okSrc = /if\(isMob\(\)&&document\.getElementById\('igv-overlay'\)\?\.classList\.contains\('open'\)\)return;/.test(body);
  setTimeout(() => { if (okSrc) console.log('✅ animate(): 모바일에서 igv-overlay가 열려 있으면 3D 렌더를 건너뛴다'); else { console.error('FAIL animate()에 igv-overlay 스킵이 없음'); process.exitCode = 1; } }, 60);
}
