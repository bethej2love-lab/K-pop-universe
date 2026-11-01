// Real Escape routing and cancellation functions, without auth/data operations.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function fn(name){const a=src.indexOf('function '+name+'(');assert(a>=0,name);const line=src.slice(a,src.indexOf('\n',a));if(line.endsWith('}'))return line;return src.slice(a,src.indexOf('\n}',a)+2);}
const top=fn('_closeTopOverlay');
const helper=src.includes('function _closeTopCancelableSurface(')?fn('_closeTopCancelableSurface'):'';
const start=src.indexOf("window.addEventListener('keydown',e=>{\n  if(e.key!=='Escape')return;");
assert(start>=0,'actual global Escape handler');const handler=src.slice(start,src.indexOf('\n},true);',start)+10);
const closers=['_closeGenericConfirm','_closeGenericPrompt','_closeUnfavConfirm','_closeLinkConfirm','_closeLogoutConfirm','_closeComboPanel','closeMobSearchSheet'].map(fn).join('\n');
function node(id,open=false,z=100){const classes=new Set(open?['open']:[]);return{id,style:{zIndex:String(z)},classList:{contains:c=>classes.has(c),remove:c=>classes.delete(c)},querySelector:()=>null,setAttribute(){}};}
function fixture(id,{input=false,higher=null}={}){
 const nodes=new Map(),calls={cards:0,video:0,viewer:0,combo:0,picker:0},resolved=[];let onKey;
 for(const name of ['search-wrap','settings-panel','journal-sidebar','yt-lightbox','side-panel','member-panel'])nodes.set(name,node(name,false));
 const modal=node(id,true,200);nodes.set(id,modal);const card=node('side-panel',true,132);nodes.set('side-panel',card);
 if(higher)nodes.set(higher,node(higher,true,300));
 const box={document:{activeElement:{tagName:input?'INPUT':'BUTTON'},getElementById:n=>nodes.get(n)||null,
   querySelectorAll:()=>[...nodes.values()].filter(n=>n.classList.contains('open'))},window:{addEventListener:(type,fn)=>onKey=fn},
   getComputedStyle:e=>({zIndex:e.style.zIndex,display:'block',visibility:'visible'}),
   _genericConfirmResolve:v=>resolved.push(v),_genericPromptResolve:v=>resolved.push(v),_genericPromptToggle:null,_genericPromptToggleVal:null,
   _unfavConfirmResolve:v=>resolved.push(v),_linkConfirmResolve:v=>resolved.push(v),_logoutConfirmResolve:v=>resolved.push(v),
   _comboInvalidateResults:()=>calls.combo++,_fpUpdateVis(){},_invalidateRemoteSearch(){},_msEl:modal,_msInput:{value:''},_msBody:{innerHTML:''},_msTabs:{innerHTML:''},_msTab:'all',_curSearchQ:'',
   _closeIgViewer(){calls.viewer++;nodes.get('igv-overlay').classList.remove('open');},_closeCollabExt(){},_closeLbHalf(){},_closeGcDiscogDetail(){},
   _SW_CLOSERS:{},_closeColPicker(){calls.picker++;nodes.get('col-picker').classList.remove('open');},
   closeLightbox(){calls.video++;nodes.get('yt-lightbox').classList.remove('open');},
   _connAnchor:null,closeConnCard(){},closePanels(){},isMob:()=>false,memberPanelEl:nodes.get('member-panel'),sidePanelEl:card,
   _openGCko:'에스파',_openTArtist:null,_maybeSuggestNext(){},closeCards:()=>calls.cards++};
 box.document.body={dataset:{}};vm.createContext(box);vm.runInContext(closers+'\n'+helper+'\n'+top+'\n'+handler,box);
 return{nodes,modal,calls,resolved,key(extra={}){let prevented=false,stopped=false;onKey({key:'Escape',preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true,...extra});return {prevented,stopped};}};
}
let total=0,failed=0;function check(name,task){total++;try{task();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
for(const [id,result] of [['generic-confirm-overlay',false],['generic-prompt-overlay',null],['unfav-confirm-overlay',false],['link-confirm-overlay',false],['logout-confirm-overlay',false]]){
 check(id+' cancels without closing the background',()=>{const f=fixture(id),e=f.key();assert(!f.modal.classList.contains('open'));assert.deepEqual(f.resolved,[result]);assert.equal(f.calls.cards,0);assert(e.prevented&&e.stopped);});
}
for(const id of ['combo-overlay','msheet'])check(id+' closes while preserving the card',()=>{const f=fixture(id);f.key();assert(!f.modal.classList.contains('open'));assert.equal(f.calls.cards,0);});
check('prompt input can cancel',()=>{const f=fixture('generic-prompt-overlay',{input:true});f.key();assert.deepEqual(f.resolved,[null]);assert.equal(f.calls.cards,0);});
check('legacy input still owns Escape',()=>{const f=fixture('settings-panel',{input:true});f.key();assert(f.modal.classList.contains('open'));assert.equal(f.calls.cards,0);});
check('IME composition keeps the dialog open',()=>{const f=fixture('generic-confirm-overlay');const e=f.key({isComposing:true});assert(f.modal.classList.contains('open'));assert.deepEqual(f.resolved,[]);assert(!e.prevented);});
check('IME keyCode 229 keeps the dialog open',()=>{const f=fixture('generic-confirm-overlay');f.key({keyCode:229});assert(f.modal.classList.contains('open'));assert.equal(f.calls.cards,0);});
check('higher viewer closes before an underlying dialog',()=>{const f=fixture('generic-confirm-overlay',{higher:'igv-overlay'});f.key();assert(f.modal.classList.contains('open'));assert.equal(f.calls.viewer,1);assert.deepEqual(f.resolved,[]);});
check('higher video closes before the combo',()=>{const f=fixture('combo-overlay',{higher:'yt-lightbox'});f.key();assert(f.modal.classList.contains('open'));assert.equal(f.calls.video,1);assert.equal(f.calls.combo,0);});
check('higher collection picker keeps the dialog below it',()=>{const f=fixture('generic-confirm-overlay',{higher:'col-picker'});f.key();assert(f.modal.classList.contains('open'));assert.equal(f.calls.picker,1);});
check('other keys leave the dialog intact',()=>{const f=fixture('generic-confirm-overlay');f.key({key:'Enter'});assert(f.modal.classList.contains('open'));assert.deepEqual(f.resolved,[]);});
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
