// 멤버 카드 디스코그래피에 소속 그룹 앨범 같이 보기(2026-11-19 사용자 — "소속 그룹 있는 멤버가 솔로 없으면 디스코그라피가 너무 빈다.
// 솔로 4개 미만이면 그룹 것까지 기본 표시, 4개 이상이면 솔로만, 둘 다 선택할 수 있게").
// app.js _renderDiscography를 떼어 가짜 화면(DOM)에서 실행한다 — 실제 데이터·네트워크 없음. 실행: node tests/member-discog-group.test.js
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const fn=n=>{const a=app.indexOf('function '+n+'(');if(a<0)throw new Error('missing '+n);return app.slice(a,app.indexOf('\n}',a)+2);};
// ── 아주 작은 가짜 DOM ──
function El(id){const e={id,style:{},children:[],dataset:{},_cls:new Set(),_h:{},attrs:{},textContent:'',offsetWidth:40,offsetLeft:0,isConnected:true,
  classList:{add:(...c)=>c.forEach(x=>e._cls.add(x)),remove:(...c)=>c.forEach(x=>e._cls.delete(x)),toggle:(c,on)=>{(on===undefined?!e._cls.has(c):on)?e._cls.add(c):e._cls.delete(c);},contains:c=>e._cls.has(c)},
  appendChild:c=>{e.children.push(c);return c;},remove:()=>{},addEventListener:(t,f)=>{e._h[t]=f;},setAttribute:(k,v)=>{e.attrs[k]=v;},
  querySelector:()=>El('q'),querySelectorAll:()=>[]};
  Object.defineProperty(e,'innerHTML',{set(){e.children=[];},get(){return '';}});
  Object.defineProperty(e,'className',{set(v){e._cls=new Set(String(v).split(/\s+/).filter(Boolean));},get(){return [...e._cls].join(' ');}});
  return e;}
function world(){
  const els=new Map();const get=id=>{if(!els.has(id))els.set(id,El(id));return els.get(id);};
  let opened=null;
  const ctx={document:{getElementById:get,createElement:()=>El(''),addEventListener:()=>{}},requestAnimationFrame:()=>{},currentLang:'ko',
    GROUPS:{'리센느':{en:'RESCENE'}},_openTArtist:{name:{ko:'미나미'},group:{ko:'리센느'}},_openGCko:null,_gcDiscogList:null,
    _loadGcDiscogTrackTrophies:()=>{},_isJpRelease:a=>!!a.jp,_discogBucket:t=>/정규/.test(t)?'정규':/미니|EP/.test(t)?'미니(EP)':/싱글/.test(t)?'싱글':'기타',
    _DISCOG_BUCKETS:['정규','미니(EP)','싱글'],_discogBucketLabel:v=>v,_discogStackOn:()=>false,_discogAlbumTypeLabel:a=>a.type,_discogRegionTag:()=>'',
    _appendDiscogArtists:()=>{},_enableDragScroll:()=>{},_gLabelKo:k=>k,_openGcDiscogDetail:(a,i)=>{opened={a,i};},console};
  vm.createContext(ctx);vm.runInContext(fn('_renderDiscography')+'\nthis.R=_renderDiscography;',ctx);
  return {ctx,get,shown:()=>get('tt-discog-strip').children.map(c=>c.children[2].textContent),row:()=>get('tt-discog-row').style.display,chip:()=>get('tt-discog-grp-btn'),opened:()=>opened};
}
const A=(title,type,date,x)=>Object.assign({title,type,releaseDate:date,isMain:true,cover:'c'},x||{});
const grp=[A('SCENEDROME','미니 2집','2025.02.01'),A('Glow Up','미니 3집','2025.08.01'),A('YoYo','싱글','2024.05.01'),A('그룹 OST','OST','2025.03.01',{isMain:false}),A('피처링곡','싱글','2025.04.01',{feat:true}),A('일본판','싱글','2025.05.01',{jp:true})];
const opts={groupKo:'리센느',groupAlbums:grp};
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
check('솔로가 OST 1장뿐(4개 미만) → 그룹 대표 앨범이 기본으로 같이, 최신순. 그룹 OST·피처링·일본판은 안 섞임',()=>{
  const w=world();w.ctx.R('tt',[A('메리 베리 러브 OST Part 2','OST','2026.11.18',{isMain:false})],opts);
  assert.deepEqual(w.shown(),['메리 베리 러브 OST Part 2','Glow Up','SCENEDROME','YoYo']);
  assert.equal(w.chip().style.display,'');assert.ok(w.chip().classList.contains('active'));assert.equal(w.chip().textContent,'+ 리센느');
});
check('칩을 누르면 솔로만 ↔ 다시 누르면 그룹 포함',()=>{
  const w=world();w.ctx.R('tt',[A('메리 베리 러브 OST Part 2','OST','2026.11.18',{isMain:false})],opts);
  w.chip().onclick({stopPropagation(){}});assert.deepEqual(w.shown(),['메리 베리 러브 OST Part 2']);assert.ok(!w.chip().classList.contains('active'));
  w.chip().onclick({stopPropagation(){}});assert.equal(w.shown().length,4);
});
check('솔로 4장 이상 → 기본은 솔로만, 칩은 꺼진 채로 보이고 누르면 그룹 포함',()=>{
  const w=world();const solo=[1,2,3,4].map(i=>A('솔로'+i,'싱글','2026.0'+i+'.01'));w.ctx.R('tt',solo,opts);
  assert.equal(w.shown().length,4);assert.ok(w.shown().every(t=>/^솔로/.test(t)));
  assert.equal(w.chip().style.display,'');assert.ok(!w.chip().classList.contains('active'));
  w.chip().onclick({stopPropagation(){}});assert.equal(w.shown().length,7);
});
check('솔로가 아예 없음 → 섹션이 숨지 않고 그룹 앨범만, 끌 게 없어 칩은 안 보임',()=>{
  const w=world();w.ctx.R('tt',undefined,opts);
  assert.equal(w.row(),'');assert.deepEqual(w.shown(),['Glow Up','SCENEDROME','YoYo']);assert.equal(w.chip().style.display,'none');
});
check('그룹 정보가 없으면(솔로 가수·탈퇴 멤버) 예전 그대로 — 솔로 없으면 섹션 숨김, 칩 없음',()=>{
  const w=world();w.ctx.R('tt',[],null);assert.equal(w.row(),'none');
  const w2=world();w2.ctx.R('tt',[A('솔로1','싱글','2026.01.01')],null);assert.deepEqual(w2.shown(),['솔로1']);assert.equal(w2.chip().style.display,'none');
});
check('섞인 목록은 앨범 창이 주인을 가릴 표시(_mixGko)를 달고 열린다',()=>{
  const w=world();w.ctx.R('tt',[A('메리 베리 러브 OST Part 2','OST','2026.11.18',{isMain:false})],opts);
  w.get('tt-discog-strip').children[1]._h.click({stopPropagation(){}});
  assert.equal(w.ctx._gcDiscogList._mixGko,'리센느');assert.ok(w.ctx._gcDiscogList._mixSet.has(w.opened().a));
  assert.match(app,/_gcDiscogList\._mixSet\.has\(a\)\?\{gko:_gcDiscogList\._mixGko,artist:null\}:null/);
});
check('멤버 카드 호출부: 현재 멤버만 그룹 앨범을 넘김(탈퇴 멤버 제외)',()=>assert.match(app,/!\(typeof _isFormerOf==='function'&&_isFormerOf\(a,a\.group\.ko\)\)\?a\.group\.ko:null/));
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
