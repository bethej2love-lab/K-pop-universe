// 안내 버튼이 실제 window 배경 포인터/클릭 핸들러로 새지 않는지 실제 마크업+핸들러를 실행한다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),src=fs.readFileSync(path.join(root,'app.js'),'utf8');
const tipTag=html.match(/<div\b[^>]*\bid="ob-tips"[^>]*>/)?.[0];assert(tipTag,'첫 방문 안내 컨테이너 존재');
const modal=/\bdata-modal(?:\s|=|>)/.test(tipTag);
const pointer=src.split('\n').find(l=>l.startsWith("window.addEventListener('pointerdown',e=>{if(e.target.closest('[data-modal]'))"));assert(pointer,'실제 배경 pointerdown 경계');
const clickStart=src.indexOf("window.addEventListener('click',e=>{\n  if(e.target.closest('[data-modal]'))return;");
const clickEnd=src.indexOf('\n\n  // 내 별 클릭',clickStart);assert(clickStart>=0&&clickEnd>clickStart);
function fixture(inTips){const callbacks={},counts={close:0,raycast:0};const box={window:{addEventListener:(name,cb)=>callbacks[name]=cb},
 _mdx:120,_mdy:300,_mobViewShift:0,_mouse:{},camera:{},isMob:()=>true,
 mobSheetEl:{contains:()=>false},mobCardStackEl:{contains:()=>false},connSheetEl:{contains:()=>false},
 renderer:{domElement:{getBoundingClientRect:()=>({left:0,right:390,top:0,bottom:844,width:390,height:844})}},
 raycaster:{setFromCamera:()=>counts.raycast++},closePanels:()=>counts.close++,_feedEngaged:false,_dismissOnboardHint:()=>{}};
 vm.createContext(box);vm.runInContext(pointer+'\n'+src.slice(clickStart,clickEnd)+'\n});',box);
 return{counts,fire(){const e={clientX:120,clientY:300,target:{closest:selector=>inTips&&modal&&selector==='[data-modal]'?{}:null}};callbacks.pointerdown(e);callbacks.click(e);}};}
let total=0,failed=0;function check(name,fn){total++;try{fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
for(const button of ['ob-tips-next','ob-tips-prev','ob-tips-skip'])check(button+' 위 터치가 배경을 열거나 닫지 않음',()=>{assert(html.includes('id="'+button+'"'));const f=fixture(true);f.fire();assert.equal(f.counts.close,0);assert.equal(f.counts.raycast,0);});
check('우주 자체 터치는 기존 탐색 동작 유지',()=>{const f=fixture(false);f.fire();assert.equal(f.counts.close,1);assert.equal(f.counts.raycast,1);});
console.log(total+'검증 / '+failed+'실패');if(failed)process.exitCode=1;
