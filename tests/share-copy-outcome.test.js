// Run actual copy helpers and combo click handler with synthetic browser APIs.
// No real clipboard, downloads, native share sheet, or production API calls.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const helpers=src.slice(src.indexOf('function _fallbackCopy(url'),src.indexOf('// 터치가 주 입력 수단인 기기'));
const start=src.indexOf("document.getElementById('combo-share')?.addEventListener");
const handler=src.slice(start,src.indexOf('\n\n// ══ 발자국',start));assert(start>0&&helpers);
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
 await check('image path reports actual copy failure',async()=>{const f=fixture({image:true,clipboard:'reject',fallback:false});await f.click();assert.equal(f.downloads.length,1);assert.equal(f.toasts.length,1);assert.match(f.toasts[0],/복사 실패/);assert.doesNotMatch(f.toasts[0],/복사됨/);});
 await check('image with unsupported clipboard uses fallback',async()=>{const f=fixture({image:true,clipboard:'missing'});await f.click();assert.equal(f.downloads.length,1);assert.equal(f.copies(),1);assert.match(f.toasts[0],/복사됨/);});
 await check('English combined failure',async()=>{const f=fixture({image:true,clipboard:'reject',fallback:false,lang:'en'});await f.click();assert.match(f.toasts[0],/copy failed/i);});
 await check('native cancel does not copy or download',async()=>{const f=fixture({image:true,native:'AbortError'});await f.click();assert.equal(f.shares(),1);assert.equal(f.writes.length,0);assert.equal(f.downloads.length,0);assert.equal(f.toasts.length,0);});
 await check('native success does not copy or download',async()=>{const f=fixture({image:true,native:'ok'});await f.click();assert.equal(f.shares(),1);assert.equal(f.writes.length,0);assert.equal(f.downloads.length,0);});
 await check('native failure retains link fallback',async()=>{const f=fixture({image:true,native:'NotAllowedError'});await f.click();assert.equal(f.writes.length,1);assert.equal(f.downloads.length,0);assert.match(f.toasts[0],/복사됨/);});
 await check('link-only failure keeps visible URL fallback',async()=>{const f=fixture({clipboard:'reject',fallback:false});await f.click();assert.equal(f.toasts.at(-1),'https://example.test/#combo=fixture');});
 console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
