// 추천순 첫 화면에서 모음(편집) 영상은 맨 뒤로(2026-11-18 사용자 "모음 영상은 최신이어도 추천순 상위에 둘 필요 없음").
// app.js의 _recOrder·_isCompilationVid를 떼어 가짜 환경에서 실행한다 — 실제 API 호출 없음.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
function fn(name){const a=app.indexOf('function '+name+'(');if(a<0)throw new Error('missing '+name);return app.slice(a,app.indexOf('\n}',a)+2);}
function line(prefix){const a=app.indexOf(prefix);if(a<0)throw new Error('missing '+prefix);return app.slice(a,app.indexOf('\n',a)+1);}
const ctx={myProfile:null,favMembers:new Set(),_scrapCounts:new Map(),_isShortV:()=>false,_vidCatWeight:()=>2,Math,Date,_recNoise:()=>0,_recSeenPen:()=>0};
vm.createContext(ctx);
vm.runInContext(line('const _REC_W=')+line('const _COMPILATION_RE=')+fn('_recOrder')+fn('_isCompilationVid'),ctx);
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
const now=new Date().toISOString();
const old=new Date(Date.now()-400*864e5).toISOString();
const vids=[
  {id:'comp1',title:'2027 수능 응원곡 모음 | 아이브 르세라핌',published_ts:now,view_count:5e6,content_flag:null},
  {id:'comp2',title:'연말 무대 몰아보기',published_ts:now,view_count:9e6,content_flag:'개별출연'},
  {id:'a',title:'IVE 장원영 직캠 REBEL HEART',published_ts:old,view_count:1e4,content_flag:null},
  {id:'b',title:'아이브 인기가요 무대',published_ts:old,view_count:2e4,content_flag:null},
];
for(let i=0;i<20;i++)check('모음은 뒤로 #'+i,()=>{const ids=vm.runInContext('_recOrder',ctx)(vids.slice(),null).map(v=>v.id);assert.deepEqual(ids.slice(2).sort(),['comp1','comp2']);});
check('모음뿐이면 그대로 다 보임',()=>{assert.equal(vm.runInContext('_recOrder',ctx)(vids.slice(0,2),null).length,2);});
const isC=vm.runInContext('_isCompilationVid',ctx);
check('판정',()=>{
  for(const t of ['무대 모음집','라이브 모아보기','LIVE COMPILATION','뮤비집.zip'])assert.equal(isC({title:t}),true,t);
  for(const t of ['REBEL HEART 직캠','수능금지곡 #최예나','메들리 무대','Chain Reaction'])assert.equal(isC({title:t}),false,t);
  assert.equal(isC({title:'아무 제목',content_flag:'개별출연'}),true);
});
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
