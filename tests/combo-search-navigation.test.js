// 조합 배너를 누른 뒤 검색을 다시 열어도 본문이 display:none으로 남지 않는지 실제 열기/닫기/배너 함수를 실행.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const slice=(a,b)=>{const s=src.indexOf(a),e=src.indexOf(b,s);assert(s>=0&&e>s);return src.slice(s,e);};
const functions=slice('function openMobSearchSheet(){','// ── 데스크톱 검색')+'\n'+slice('function _appendComboEntry(res){',"document.getElementById('combo-close')");
function node(id){const set=new Set();return{id,style:{display:''},children:[],value:'',innerHTML:'',hidden:false,classList:{contains:x=>set.has(x),add:x=>set.add(x),remove:x=>set.delete(x)},appendChild(el){this.children.push(el);},addEventListener(type,fn){this[type]=fn;},setAttribute(){},focus(){}};}
function fixture(mode){const body=node('msheet-body'),overlay=node('msheet'),tabbar=node('tabbar'),desktop=node('search-results');overlay.classList.add('open');if(mode==='legacy')tabbar.classList.add('search-mode');
 const nodes={'msheet-body':body,msheet:overlay,tabbar,'settings-panel':node('settings-panel'),'search-input':node('search-input'),'tab-search':node('tab-search')};let combos=0,legacyClosed=0;
 const box={document:{createElement:()=>node(''),getElementById:id=>nodes[id]||null},currentLang:'ko',_msEl:overlay,_msInput:node('msheet-input'),_msClear:node('msheet-clear'),_msTabs:node('msheet-tabs'),_msBody:body,_msTab:'all',_curSearchQ:'',_bringToFront(){},_showTabbar(){},setTimeout(){},doSearch(){body.innerHTML='검색 결과';},_openComboPanel(){combos++;},exitMobSearch(){legacyClosed++;tabbar.classList.remove('search-mode');}};
 vm.createContext(box);vm.runInContext(functions,box);const res=mode==='sheet'?body:desktop;box._appendComboEntry(res);res.children.at(-1).click({stopPropagation(){}});
 return{box,res,body,overlay,combos:()=>combos,legacyClosed:()=>legacyClosed};}
let total=0,failed=0;function check(name,fn){total++;try{fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
check('전체 검색에서 조합으로 이동하면 검색창 닫음',()=>{const f=fixture('sheet');assert.equal(f.combos(),1);assert(!f.overlay.classList.contains('open'));});
check('조합 진입이 검색 본문을 영구 숨기지 않음',()=>{const f=fixture('sheet');assert.notEqual(f.body.style.display,'none');});
check('검색 다시 열기에서 본문 복원·내용 표시',()=>{const f=fixture('sheet');f.box.openMobSearchSheet();assert(f.overlay.classList.contains('open'));assert.notEqual(f.body.style.display,'none');assert.equal(f.body.innerHTML,'검색 결과');});
check('데스크톱 드롭다운은 이전처럼 닫힘',()=>{const f=fixture('desktop');assert.equal(f.res.style.display,'none');assert.equal(f.combos(),1);});
check('구형 모바일 탭 검색 닫기 보존',()=>{const f=fixture('legacy');assert.equal(f.legacyClosed(),1);assert.equal(f.combos(),1);});
console.log(total+'검증 / '+failed+'실패');if(failed)process.exitCode=1;
