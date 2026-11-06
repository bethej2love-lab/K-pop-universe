// 실제 인스타 캡처 핸들러와 배경 카드/재생 키 핸들러를 함께 실행한다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const viewer=src.slice(src.indexOf('function _openIgViewer('),src.indexOf('function _igvGo('));
const capture=viewer.match(/document\.addEventListener\('keydown',e=>\{[\s\S]*?\n    \},true\);/)?.[0];
const start=src.indexOf("window.addEventListener('keydown',e=>{\n  if(document.activeElement");
const bubble=src.slice(start,src.indexOf('\n});',start)+4);
// _igvGo는 2026-11-02부터 여러 줄(미끄러지며 넘기기) — 함수 끝(줄 맨 앞 '}')까지 자른다. 틀 폭 0이면 바로 바꾸는 길을 탄다.
const _g0=src.indexOf('function _igvGo(');const go=_g0<0?null:src.slice(_g0,src.indexOf('\n}\n',_g0)+2);
assert(capture&&start>=0&&bubble&&go,'actual viewer and background handlers found');
function fixture({open=true,index=1,video=false}={}){
  const callbacks={},calls={render:0,member:[],video:[]};
  const box={ov:{classList:{contains:()=>open}},document:{activeElement:{tagName:'BODY'},
    addEventListener:(type,fn)=>callbacks.capture=fn,
    getElementById:id=>id==='yt-lightbox'?{classList:{contains:()=>video}}:{style:{display:'block'},querySelector:()=>({clientWidth:0})}},
    window:{addEventListener:(type,fn)=>callbacks.bubble=fn},isMob:()=>false,_lbSessionMode:'browse',_openTArtist:{},
    _igv:{i:index,pics:['one','two','three']},_igvShow:()=>calls.render++,
    _lbGo:d=>calls.video.push(d),navigateMember:d=>calls.member.push(d),closeLightbox:()=>{},_maybeSuggestNext:()=>{},closeCards:()=>{}};
  vm.createContext(box);vm.runInContext(go+'\n'+capture+'\n'+bubble,box);
  return {box,calls,key(key){let stopped=false,prevented=false;
    const e={key,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true};
    callbacks.capture(e);if(!stopped)callbacks.bubble(e);return {stopped,prevented};}};
}
let total=0,failed=0;
function check(name,fn){total++;try{fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
for(const [key,d] of [['ArrowRight',1],['ArrowLeft',-1]]){
  check(key+' changes the photo',()=>{const f=fixture();f.key(key);assert.equal(f.box._igv.i,1+d);assert.equal(f.calls.render,1);});
  check(key+' does not navigate the background member',()=>{const f=fixture();const e=f.key(key);assert.deepEqual(f.calls.member,[]);assert(e.stopped&&e.prevented);});
  check(key+' does not navigate an underlying video',()=>{const f=fixture({video:true});f.key(key);assert.deepEqual(f.calls.video,[]);});
  check(key+' at the album edge stays in the viewer',()=>{const i=d>0?2:0,f=fixture({index:i});f.key(key);assert.equal(f.box._igv.i,i);assert.equal(f.calls.render,0);assert.deepEqual(f.calls.member,[]);});
}
check('closed viewer preserves member keys',()=>{const f=fixture({open:false});f.key('ArrowRight');assert.deepEqual(f.calls.member,[1]);assert.equal(f.box._igv.i,1);});
check('closed viewer preserves video keys',()=>{const f=fixture({open:false,video:true});f.key('ArrowLeft');assert.deepEqual(f.calls.video,[-1]);});
check('other keys are not captured',()=>{const f=fixture();assert.deepEqual(f.key('Tab'),{stopped:false,prevented:false});assert.equal(f.box._igv.i,1);});
check('editing preserves native caret movement without navigating the photo or background',()=>{const f=fixture();f.box._igv.tagEditor={};const e=f.key('ArrowRight');assert(e.stopped&&!e.prevented);assert.equal(f.box._igv.i,1);assert.deepEqual(f.calls.member,[]);assert.equal(f.calls.render,0);});
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
