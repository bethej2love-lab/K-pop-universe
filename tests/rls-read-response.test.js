// 실DB를 호출하지 않고 익명/교차 사용자 읽기 검사에 실제 사용되는 경로를 모의 응답으로 실행한다.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {parseExactCount}=require('../tools/rls_read_count.cjs');
const src=fs.readFileSync(path.join(__dirname,'rls.test.js'),'utf8');
const start=src.indexOf('async function readCount('),end=src.indexOf('\nasync function insertProbe(',start);
assert(start>=0&&end>start,'실제 읽기 함수 추출');
let current,calls=[];
const fetchMock=async(url,opts)=>{calls.push({url,opts});return current;};
const readCount=new Function('fetch','SB','H','parseExactCount',src.slice(start,end)+'\nreturn readCount;')(fetchMock,'https://test.invalid/rest/v1',{apikey:'test'},parseExactCount);
const response=(status,range)=>({ok:status>=200&&status<300,status,headers:{get:n=>n==='content-range'?range:null}});
let total=0,failed=0;
async function check(name,fn){total++;try{await fn();}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
(async()=>{
 for(const [range,count] of [['*/0',0],['0-0/1',1],['0-0/1234',1234]])await check('성공한 정확한 건수 '+range,async()=>{current=response(200,range);assert.equal(await readCount('catalog'),count);});
 for(const status of [400,401,403,404,429,500,503])await check('HTTP 오류 '+status+'를 0행으로 보지 않음',async()=>{current=response(status,'*/0');await assert.rejects(()=>readCount('private'));});
 for(const range of [null,'','0-0/*','garbage','*/NaN','*/-1','*/1.5','*/9007199254740992'])await check('정확한 건수 없는 응답 '+range,async()=>{current=response(200,range);await assert.rejects(()=>readCount('private'));});
 await check('HEAD 요청으로 실제 행 본문을 가져오지 않음',async()=>{current=response(200,'*/0');await readCount('private');assert.equal(calls.at(-1).opts.method,'HEAD');});
 await check('교차 사용자도 동일한 상태 검사·정확한 건수 경로 사용',async()=>{current=response(403,null);await assert.rejects(()=>readCount('user_data',{Authorization:'Bearer test-A'},'user_id=eq.test-B'));assert.equal(calls.at(-1).opts.headers.Authorization,'Bearer test-A');assert(calls.at(-1).url.includes('user_id=eq.test-B'));});
 await check('교차 사용자 두 쿼리를 검증 함수로 연결',async()=>{assert(src.includes('readCount(t, asUser(TOKEN_A),'));assert(src.includes('readCount(t, asUser(TOKEN_B),'));assert(!src.includes('const seenByA = parseInt'));assert(!src.includes('const ownedByB = parseInt'));});
 await check('전송 실패 전파',async()=>{const f=new Function('fetch','SB','H','parseExactCount',src.slice(start,end)+'\nreturn readCount;')(async()=>{throw new Error('offline')},'https://test.invalid',{},parseExactCount);await assert.rejects(()=>f('catalog'),/offline/);});
 async function runDriver(crossA,crossB,anonStatus=200){
  const token=id=>'header.'+Buffer.from(JSON.stringify({sub:id})).toString('base64url')+'.signature';
  const A=token('test-user-A'),B=token('test-user-B');let exitCode,posts=0;const logs=[];
  const ctx={__dirname,Buffer,console:{log:x=>logs.push(String(x))},
   process:{env:{KPU_TOKEN_A:A,KPU_TOKEN_B:B},exit:c=>{exitCode=c;}},
   require:n=>n==='fs'?{existsSync:()=>true,readFileSync:()=>".from('user_data')"}:n==='path'?path:{parseExactCount},
   fetch:async(url,opts)=>{
    if(opts.method==='POST'){posts++;return {status:403,json:async()=>({code:'42501'})};}
    const auth=opts.headers.Authorization;
    if(auth==='Bearer '+A)return response(crossA,'*/0');
    if(auth==='Bearer '+B)return response(crossB,'0-0/1');
    return response(anonStatus,'*/0');
   }};
  await vm.runInNewContext(src,ctx);return {exitCode,posts,logs};
 }
 await check('실제 검사 전체: 익명 HTTP500은 실패하고 쓰기 요청도 보내지 않음',async()=>{const r=await runDriver(200,200,500);assert.equal(r.exitCode,1);assert.equal(r.posts,0);});
 await check('실제 검사 전체: A HTTP403은 격리 통과로 보고하지 않음',async()=>{const r=await runDriver(403,200);assert.equal(r.exitCode,1);assert(r.logs.some(x=>x.includes('격리 검사 요청 오류')));});
 await check('실제 검사 전체: B HTTP401도 실패로 종료',async()=>{assert.equal((await runDriver(200,401)).exitCode,1);});
 await check('실제 검사 전체: A0행/B1행·쓰기 차단 정상 응답은 통과',async()=>{assert.equal((await runDriver(200,200)).exitCode,0);});
 console.log(total+'검증 / '+failed+'실패');if(failed)process.exitCode=1;
})();
