// Run actual copy helpers and combo click handler with synthetic browser APIs.
// No real clipboard, downloads, native share sheet, or production API calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const helpers=src.slice(src.indexOf('function _fallbackCopy(url'),src.indexOf('// 터치가 주 입력 수단인 기기'));
// 2026-11-10 조합 패널 → Chemistry 통합으로 조합 이미지 공유 버튼(combo-share)을 걷어냈다 — 공용 복사 함수만 검사한다.
const handler='';assert(helpers);
function fixture({clipboard='ok',fallback=true,image=false,native=null,lang='ko',selectThrows=false}={}){
 const toasts=[],writes=[],downloads=[],removed=[];let listener,shares=0,copies=0;
 const body={appendChild:el=>{el.parentNode=body;},removeChild:el=>{removed.push(el);el.parentNode=null;}};
 const document={body,createElement:tag=>({tag,style:{},select(){if(selectThrows)throw new Error('selection blocked');},click(){downloads.push(this.href);},remove(){body.removeChild(this);}}),
  execCommand(){copies++;if(fallback==='throw')throw new Error('copy blocked');return fallback;},
  getElementById:()=>({addEventListener:(_event,fn)=>listener=fn})};
 const navigator={};if(clipboard!=='missing')navigator.clipboard={writeText:async url=>{writes.push(url);if(clipboard==='reject')throw new Error('clipboard blocked');}};
 if(native){navigator.canShare=()=>true;navigator.share=async()=>{shares++;if(native!=='ok'){const err=new Error('share unavailable');err.name=native;throw err;}};}
 const ctx={document,navigator,currentLang:lang,_showShareToast:m=>toasts.push(m),_gaEvent(){},_isTouchPrimary:()=>!!native,
  location:{origin:'https://example.test',pathname:'/'},_comboShareHash:()=>'#combo=fixture',_comboCardDataURL:image?'data:image/png;base64,fixture':null,
  fetch:async()=>({blob:async()=>({})}),File:class File{}};
 vm.createContext(ctx);vm.runInContext(helpers+'\n'+handler,ctx);
 return {ctx,toasts,writes,downloads,removed,copies:()=>copies,shares:()=>shares,click:()=>listener({stopPropagation(){}})};
}
let total=0,failed=0;async function check(name,run){total++;try{await run();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('modern clipboard success',async()=>{const f=fixture();assert.equal(await f.ctx._copyShareLink('fixture'),true);assert.match(f.toasts[0],/복사되었/);assert.equal(f.copies(),0);});
 await check('rejected clipboard uses successful fallback',async()=>{const f=fixture({clipboard:'reject'});assert.equal(await f.ctx._copyShareLink('fixture'),true);assert.equal(f.copies(),1);assert.equal(f.removed.length,1);});
 for(const fallback of [false,'throw'])await check('fallback '+fallback+' reports failure and removes textarea',async()=>{const f=fixture({clipboard:'missing',fallback});assert.equal(await f.ctx._copyShareLink('fixture'),false);assert.match(f.toasts[0],/실패/);assert.equal(f.removed.length,1);});
 await check('selection failure also cleans temporary node',async()=>{const f=fixture({clipboard:'missing',selectThrows:true});assert.equal(await f.ctx._copyShareLink('fixture'),false);assert.match(f.toasts[0],/실패/);assert.equal(f.removed.length,1);});
 await check('English fallback failure is not a success',async()=>{const f=fixture({lang:'en',clipboard:'reject',fallback:false});await f.ctx._copyShareLink('fixture');assert.match(f.toasts[0],/Failed to copy/);});
 await check('quiet result supports combined image feedback',async()=>{const f=fixture();assert.equal(await f.ctx._copyShareLink('fixture',true),true);assert.equal(f.toasts.length,0);});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
