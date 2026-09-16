// YouTube API 오류 진단 + 재생시간 백필 안전장치 테스트 (2026-09-16 신설)
//
// 배경: "순환 갱신 버튼을 누르니 `YouTube API 오류 403`만 뜬다"(2026-09-16 사용자 제보). 원인 진단이
// 불가능했던 이유는 호출부가 **응답 본문을 읽지 않고 status만 던졌기** 때문이다 —
// `if(!r.ok)throw new Error('YouTube API 오류 '+r.status)`. 쿼터 초과(quotaExceeded)·레이트리밋·키 제한·
// API 미활성이 전부 똑같이 "403"으로 보인다. 같은 이유로 2026-08-06(검색 경로)과 2026-09-15(채널ID 경로)에
// 한 경로씩 고쳤는데 나머지 6군데가 옛 형태로 남아 세 번째로 같은 일이 벌어졌다.
// → 모든 호출을 `_ytApiGet` 하나로 통과시키고, reason을 메시지·콘솔·err.reason에 남긴다.
//
// 실행: node tests/yt-api-error.test.js

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const admin=fs.readFileSync(path.join(__dirname,'..','admin.js'),'utf8');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

let pass=0,fail=0;
const ok=m=>{pass++;console.log(`✅ ${m}`);};
const bad=(m,d)=>{fail++;console.log(`❌ ${m}`);if(d)console.log('   '+d);};
const need=(c,m,d)=>c?ok(m):bad(m,d);

// ⚠️ 본문 시작 `{`를 "첫 번째 {"로 찾으면 안 된다 — `_ytApiGet(url,label,{retries=3}={})`처럼 매개변수에
//    구조분해가 있으면 그 중괄호를 본문으로 착각해서 함수가 중간에 잘린다(실제로 그렇게 깨졌다).
//    괄호 짝을 먼저 맞춘 뒤 그 다음 `{`부터 센다.
function slice(s,re,label){
  const m=re.exec(s);
  if(!m)throw new Error(`선언을 못 찾음: ${label}`);
  let i=s.indexOf('(',m.index),pd=0;
  for(;i<s.length;i++){
    if(s[i]==='(')pd++;
    else if(s[i]===')'){pd--;if(pd===0){i++;break;}}
  }
  i=s.indexOf('{',i);
  let depth=0;
  for(;i<s.length;i++){
    if(s[i]==='{')depth++;
    else if(s[i]==='}'){depth--;if(depth===0){i++;break;}}
  }
  return s.slice(m.index,i);
}
function line(s,re,label){
  const m=re.exec(s);
  if(!m)throw new Error(`선언을 못 찾음: ${label}`);
  const st=s.lastIndexOf('\n',m.index)+1, en=s.indexOf('\n',m.index);
  return s.slice(st,en<0?s.length:en);
}

// ── ① 옛 형태(본문을 안 읽고 status만 던지기)가 한 군데도 남지 않았는가 ────────
// 이게 이 테스트의 핵심 가드다. 새 YouTube 호출을 추가할 때 옛 패턴을 복사해오면 여기서 잡힌다.
const rawThrows=admin.split('\n')
  .map((l,i)=>[i+1,l])
  .filter(([n,l])=>!/^\s*(\/\/|\*)/.test(l)) // 주석(이 패턴을 설명하는 _ytApiGet 주석)은 제외
  .filter(([n,l])=>/if\(!r\.ok\)throw new Error\('YouTube API 오류 '\+r\.status\)/.test(l));
need(rawThrows.length===0,
  '응답 본문을 안 읽고 status만 던지는 옛 형태가 남아있지 않음',
  rawThrows.map(([n,l])=>`admin.js:${n} ${l.trim()}`).join('\n   '));
// 모든 YouTube 호출이 공용 문을 지나는가 — fetch를 직접 때리는 곳이 없어야 한다.
const directFetch=admin.split('\n')
  .map((l,i)=>[i+1,l])
  .filter(([n,l])=>/fetch\(`https:\/\/www\.googleapis\.com\/youtube/.test(l));
need(directFetch.length===0,
  'YouTube 호출이 전부 _ytApiGet을 지남(직접 fetch 없음)',
  directFetch.map(([n,l])=>`admin.js:${n}`).join(', '));
const apiGetCalls=(admin.match(/_ytApiGet\(/g)||[]).length-1; // 정의 1회 제외
need(apiGetCalls>=8,`_ytApiGet 호출부 ${apiGetCalls}곳(옛 복제 8군데를 전부 대체)`);

// ── ② _ytApiGet이 실제로 사유를 뽑아 던지는가(가짜 fetch로 실행) ───────────────
const ctx={console:{error(){},warn(){},log(){},info(){}},_ytSetProg(){},setTimeout:(f,ms)=>f()};
ctx.globalThis=ctx;
vm.createContext(ctx);
vm.runInContext(line(admin,/^const _YT_TRANSIENT=/m,'_YT_TRANSIENT'),ctx);
vm.runInContext(line(admin,/^const _ytQuotaReason=/m,'_ytQuotaReason'),ctx);
vm.runInContext(slice(admin,/async function _ytApiGet\(/,'_ytApiGet'),ctx);

const mkRes=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
async function run(){
  // 정상
  ctx.fetch=async()=>mkRes(200,{items:[{id:'a'}]});
  const good=await ctx._ytApiGet('u','테스트');
  need(good.items[0].id==='a','정상 응답은 파싱해서 그대로 반환');

  // 쿼터 초과 — 사유·힌트·isQuota 플래그
  ctx.fetch=async()=>mkRes(403,{error:{code:403,message:'The request cannot be completed because you have exceeded your quota.',
    errors:[{reason:'quotaExceeded'}]}});
  let e=null;
  try{await ctx._ytApiGet('u','순환 갱신');}catch(x){e=x;}
  need(!!e,'쿼터 초과는 throw');
  need(/quotaExceeded/.test(e.message),'메시지에 reason이 그대로 들어감(403만 보이지 않음)',e&&e.message);
  need(/쿼터/.test(e.message)&&/리셋/.test(e.message),'사람이 읽을 안내(쿼터·리셋 시각)가 붙음',e&&e.message);
  need(e.reason==='quotaExceeded'&&e.isQuota===true&&e.status===403,
    'err.reason/isQuota/status로 호출부가 분기 가능',`reason=${e&&e.reason} isQuota=${e&&e.isQuota}`);

  // 키 제한 — 쿼터와 다른 안내가 나와야 한다(이 둘을 섞으면 엉뚱한 곳을 고치게 된다)
  ctx.fetch=async()=>mkRes(403,{error:{errors:[{reason:'accessNotConfigured'}],message:'API not enabled'}});
  e=null;try{await ctx._ytApiGet('u','테스트');}catch(x){e=x;}
  need(e&&!e.isQuota&&/API 키|미활성/.test(e.message),'키 제한/미활성은 쿼터와 다른 안내',e&&e.message);

  // 일시 오류는 재시도하고, 재시도 중에 풀리면 성공으로 돌아온다
  let n=0;
  ctx.fetch=async()=>{n++;return n<3?mkRes(403,{error:{errors:[{reason:'rateLimitExceeded'}]}}):mkRes(200,{items:[]});};
  const r2=await ctx._ytApiGet('u','테스트');
  need(n===3&&Array.isArray(r2.items),'레이트리밋은 백오프 재시도 후 회복',`시도 ${n}회`);
  // 쿼터는 재시도하지 않는다 — 어차피 안 풀리고 남은 쿼터만 더 태운다
  n=0;
  ctx.fetch=async()=>{n++;return mkRes(403,{error:{errors:[{reason:'quotaExceeded'}]}});};
  try{await ctx._ytApiGet('u','테스트');}catch(x){}
  need(n===1,'쿼터 초과는 재시도하지 않음(남은 쿼터를 더 태우지 않게)',`시도 ${n}회`);
  // 검색 백필은 의도적으로 재시도를 끈 경로다(2026-08-06 결정) — 공용화가 그걸 되살리지 않았는지
  need(/_ytApiGet\(url,`백필\(\$\{ch\.name\}\)`,\{retries:0\}\)/.test(admin),
    '검색 백필은 retries:0 유지(429 재시도가 효과 없다는 2026-08-06 결정 보존)');
}

// ── ③ 쿼터가 끝나면 루프를 멈추는가(삼키고 계속 돌면 "완료 N개"로 보인다) ──────
need(/if\(e\.isQuota\)\{_ytSetProg\('⛔ '\+e\.message\);return;\}/.test(admin),
  '정기 조회수 갱신: 쿼터 초과면 남은 청크를 계속 때리지 않고 중단');
need(/e\.isQuota\?'⛔ ':'YouTube API 오류: '/.test(admin),
  '전체 조회수 갱신: 쿼터 초과를 구분해 표시');
need(/e\.isQuota[\s\S]{0,200}이 지점부터 이어집니다/.test(admin),
  '순환 갱신: 쿼터면 "다시 누르면 이어서"가 아니라 리셋 안내(헛수고 방지)');

// ── ④ 재생시간 전용 백필의 안전장치 ────────────────────────────────────────────
const fill=slice(admin,/async function _ytBackfillDurations\(/,'_ytBackfillDurations');
need(/\.is\('duration_sec',null\)|duration_sec\.is\.null/.test(fill),
  '백필은 아직 안 채워진 행만 대상으로 함(이미 찬 행에 쿼터를 안 씀)');
// ⚠️ 정렬을 붙이면 후보가 줄어든 막판에 57014 타임아웃이 난다(이 프로젝트의 알려진 함정)
need(!/\.order\(/.test(fill),'백필 쿼리에 ORDER BY가 없음(후보가 적을 때 나는 57014 타임아웃 회피)');
need(!/\.range\(/.test(fill),'offset 페이지네이션도 안 씀(정렬 없는 offset은 중복·누락이 생긴다)');
need(/unavailable_at/.test(fill),
  '응답에 안 잡힌 id(삭제·비공개)는 unavailable_at으로 표식해 다음부터 건너뜀(무한 반복 방지)');
need(!/val:-1/.test(fill),'duration_sec에 -1 같은 가짜 값을 박지 않음(정상 영상 오분류 방지)');
need(/e\.isQuota\?'⛔ '/.test(fill),'백필도 쿼터 초과를 구분해 표시');
need(/parseInt\(document\.getElementById\('sp-yt-durfill-budget'\)/.test(admin),
  '이번 회차에 쓸 호출 수를 어드민이 정할 수 있음(하루 쿼터를 동기화와 나눠 쓰므로)');
need(/id="sp-yt-durfill-btn"/.test(src)&&/id="sp-yt-durfill-budget"/.test(src),'백필 버튼·예산 입력 UI 존재');
need(/_admExecBind\('sp-yt-durfill-btn'/.test(admin),'백필 버튼이 실제로 바인딩됨');

// ── ⑤ duration_sec=0은 "0초 영상"이 아니라 "길이 미상"이다 ─────────────────────
// 진행 중 라이브는 유튜브가 "P0D"를 주고, 파싱하면 0이 된다('0'은 JS에서 truthy라 null이 아니다).
// 그걸 숫자로 믿으면 0<=90이라 정상 영상이 전부 쇼츠 클립으로 오분류된다.
const c2={};vm.createContext(c2);
vm.runInContext(slice(admin,/function _ytParseDurationSec\(/,'_ytParseDurationSec'),c2);
need(c2._ytParseDurationSec('P0D')===0,'진행 중 라이브("P0D")는 0으로 파싱됨(null이 아님)',
  String(c2._ytParseDurationSec('P0D')));
need(c2._ytParseDurationSec('PT3M28S')===208,'정상 길이 파싱',String(c2._ytParseDurationSec('PT3M28S')));
vm.runInContext(line(src,/^const _SHORT_CLIP_SEC=/m,'_SHORT_CLIP_SEC'),c2);
c2._isShortV=v=>!!(v&&v.is_short);
vm.runInContext(slice(src,/function _isShortClip\(/,'_isShortClip'),c2);
need(c2._isShortClip({duration_sec:46})===true,'46초는 쇼츠 클립');
need(c2._isShortClip({duration_sec:166})===false,'2분46초 직캠은 쇼츠 클립 아님');
need(c2._isShortClip({duration_sec:0,is_short:false})===false,
  '길이 0(미상)은 숫자로 믿지 않고 세로 여부로 폴백 — 가로 영상은 쇼츠 아님');
need(c2._isShortClip({duration_sec:0,is_short:true})===true,'길이 0 + 세로면 예전대로 쇼츠');

run().then(()=>{
  console.log(`\n${pass}/${pass+fail} 통과${fail?`, ${fail}개 실패`:''}`);
  process.exit(fail?1:0);
});
