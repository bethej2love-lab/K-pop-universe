// 실제 추천 함수를 실행해 미검수 후보가 '오디션 동기'로 확정되지 않는지 검증한다.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const src=require('../tools/index_source.cjs').readIndexSource();
const shared=fs.readFileSync(path.join(root,'shared.js'),'utf8');
const ARTISTS=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8'));
const GROUPS=JSON.parse(fs.readFileSync(path.join(root,'groups.json'),'utf8'));
const actualShows=JSON.parse(fs.readFileSync(path.join(root,'shows.json'),'utf8')).shows;
const start=src.indexOf('const _surfPri=');
const end=src.indexOf('\n// ── v2 넘어간 기록',start);
assert(start>=0&&end>start,'추천 함수 경계 확인');
let shows=actualShows,mc=[];
const run=new Function('ARTISTS','GROUPS','_surfWeakData',shared+'\n'+src.slice(start,end)+'\nreturn _surfWeakLinks;')(
 ARTISTS,GROUPS,async()=>({shows,mc}));
const actor=(name,group)=>{
 const a=ARTISTS.find(a=>a.name.ko===name&&a.group.ko===group);
 assert(a,'실제 로스터: '+name+'/'+group);return a;
};
let failures=0;
async function check(name,fn){try{await fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 await check('실제 I-LAND2 방지민에게 I-LAND1 동기를 추천하지 않음',async()=>{
  const r=await run(actor('방지민','이즈나'));
  assert(!r.some(x=>x.rel==='I-LAND 동기'));
 });
 await check('실제 넥스지 유키에게 보이즈플래닛/퀸덤퍼즐 동기를 추천하지 않음',async()=>{
  const r=await run(actor('유키','넥스지'));
  assert(Object.entries(actualShows).some(([k,s])=>/퀸덤\s*퍼즐/.test(k)&&(s.candidates||[]).some(c=>c.name==='유키(넥스지)'&&c.n>=5)));
  assert(!r.some(x=>/(?:보이즈\s*플래닛|퀸덤\s*퍼즐) 동기/.test(x.rel)));
 });
 shows={'검증 프로그램':{contestants:['제이(엔하이픈)','케이(앤팀)'],candidates:[{name:'방지민(이즈나)',n:999}]}};
 await check('확정된 서로 다른 그룹 참가자의 연결 보존',async()=>{
  const r=(await run(actor('제이','엔하이픈'))).filter(x=>x.rel==='검증 프로그램 동기');
  assert.deepEqual(r.map(x=>[x.name,x.group]),[['케이','앤팀']]);
 });
 await check('출현 빈도가 높아도 후보를 참가자로 올리지 않음',async()=>{
  const r=await run(actor('방지민','이즈나'));
  assert(!r.some(x=>x.rel==='검증 프로그램 동기'));
 });
 await check('참가자 필드가 없는 후보 전용 프로그램은 동기 연결 없음',async()=>{
  shows={'후보 전용':{candidates:[{name:'제이(엔하이픈)',n:20},{name:'케이(앤팀)',n:20}]}};
  assert(!(await run(actor('제이','엔하이픈'))).some(x=>x.rel==='후보 전용 동기'));
 });
 await check('참가자/후보 원본 데이터는 보존',async()=>{
  const before=JSON.stringify(shows);await run(actor('제이','엔하이픈'));assert.equal(JSON.stringify(shows),before);
 });
 await check('기존 기간이 겹치는 MC 연결은 보존',async()=>{
  shows={};mc=[{show:'검증 음방',memberKo:'제이',groupKo:'엔하이픈',start:'2024-01-01',end:'2024-06-01'},
   {show:'검증 음방',memberKo:'설윤',groupKo:'엔믹스',start:'2024-05-01',end:'2024-07-01'}];
  assert((await run(actor('제이','엔하이픈'))).some(x=>x.rel==='MC 짝꿍'&&x.name==='설윤'));
 });
 console.log('실패 '+failures);if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
