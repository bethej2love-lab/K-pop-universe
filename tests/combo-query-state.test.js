// 조합 고르기 창 → Chemistry(2026-11-10 통합). 예전 이 테스트는 조합 패널이 직접 결과를 그리던 시절의 오류/늦은 응답 처리를 봤다.
// 이제 '보기'는 Chemistry를 열고(오류·늦은 응답은 _openChem의 _chemReq가 맡음), 짝 조회(_comboFetchRows)는 Chemistry 관계도용이다.
// 실제 함수를 통제된 응답으로 실행한다. 운영 DB/브라우저 네트워크를 사용하지 않는다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
function part(a,b){const s=src.indexOf(a),e=src.indexOf(b,s);assert(s>=0&&e>s,a);return src.slice(s,e);}
const code=part('async function _comboSearch(){','// ── 조합 그림(');
const P=(name,group)=>({name,group});
function fixture(sel,resp){
  const calls={chem:[],closed:0};
  const box={_comboSel:sel,_CHEM_MAX:4,_YT_TABLE:'videos',_pgFilterVal:JSON.stringify,_filterBannedVideos:x=>x,_durCol:()=>'',
    _chemHas:(v,p)=>(v.group_ko===p.group&&(v.members||[]).includes(p.name))||(v.with_members||[]).includes(p.name+'('+p.group+')'),
    _closeComboPanel:()=>{calls.closed++;},_openChem:p=>calls.chem.push(p),
    _withTimeout:(f,ms)=>{assert.equal(ms,15000);return f();},
    sb:{from(){const q={select(){return q;},or(){return q;},order(){return q;},limit(){return typeof resp==='function'?resp():Promise.resolve(resp);}};return q;}}};
  vm.createContext(box);vm.runInContext(code,box);return{box,calls};
}
let total=0,failed=0;async function check(name,fn){total++;try{await fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
  await check('1명이면 아무것도 안 함',async()=>{const f=fixture([P('카리나','에스파')]);await f.box._comboSearch();assert.equal(f.calls.chem.length,0);assert.equal(f.calls.closed,0);});
  await check('2명 → 고르기 창 닫고 Chemistry',async()=>{const f=fixture([P('카리나','에스파'),P('윈터','에스파')]);await f.box._comboSearch();assert.equal(f.calls.closed,1);assert.equal(f.calls.chem[0].length,2);});
  await check('5명 골라도 Chemistry는 최대 4명',async()=>{const f=fixture(['a','b','c','d','e'].map(n=>P(n,'g')));await f.box._comboSearch();assert.equal(f.calls.chem[0].length,4);});
  const sel=[P('카리나','에스파'),P('윈터','에스파'),P('닝닝','에스파')];
  await check('짝 조회: 2명 이상 엮인 영상만, who 채움',async()=>{const f=fixture(sel,{error:null,data:[
    {id:'all',group_ko:'에스파',members:['카리나','윈터','닝닝'],with_members:[]},
    {id:'two',group_ko:'에스파',members:['카리나','윈터'],with_members:[]},
    {id:'one',group_ko:'에스파',members:['카리나'],with_members:[]}]});
    const rows=await f.box._comboFetchRows(sel);assert.equal(JSON.stringify(rows.map(r=>[r.v.id,r.who.length])),JSON.stringify([['all',3],['two',2]]));});
  for(const [kind,resp] of [['서버 오류',{error:{message:'x'},data:null}],['형식 오류',{error:null,data:{}}],['네트워크',()=>Promise.reject(new Error('offline'))]])
    await check('짝 조회 '+kind+'는 빈 결과가 아니라 실패로',async()=>{const f=fixture(sel,resp);await assert.rejects(f.box._comboFetchRows(sel));});
  console.log(`${total}검증 / ${failed}실패`);if(failed)process.exit(1);
})();
