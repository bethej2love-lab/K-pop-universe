// 영상 자막 기본 끔(2026-11-18 사용자 "자막이 꺼졌다 켜졌다 해, 전체화면 할 때도") — app.js 자막 끄기 블록을 떼어 가짜 환경에서 실행.
// 확인: ①첫 재생에만 모듈 내리기(unloadModule), 그 뒤엔 숨기기(setOption)만 — 내렸다 붙였다 반복(깜빡임) 없음 ②정해진 시각에 계속 보내지 않음
// ③데스크톱에서 사용자가 플레이어를 직접 만지면 더 안 보냄(사용자가 켠 CC 유지) ④폰은 열 때 앱이 틀에 포커스를 줘도 끄기가 동작 ⑤우리 전체화면 전환 땐 숨기기 한 번.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=app.indexOf('let _lbCcOffVid=null'),b=app.indexOf('\n',app.indexOf("document.addEventListener('fullscreenchange',()=>{if(document.getElementById('yt-lb-iframe')",a));
assert(a>0&&b>a,'자막 블록을 못 찾음');
function env(mob){
  const sent=[],timers=[],L={};
  const iframe={contentWindow:{postMessage:m=>sent.push(JSON.parse(m))}};
  const ctx={sent,timers,L,_lbActiveVid:'v1',isMob:()=>mob,Date,JSON,
    setTimeout:(f,ms)=>{timers.push({f,ms});},
    window:{addEventListener:(t,f)=>{L['w:'+t]=f;}},
    document:{activeElement:null,getElementById:id=>id==='yt-lb-iframe'?iframe:null,addEventListener:(t,f)=>{L['d:'+t]=f;}}};
  ctx.iframe=iframe;vm.createContext(ctx);vm.runInContext(app.slice(a,b),ctx);
  ctx.flush=()=>{const t=ctx.timers.splice(0);t.forEach(x=>x.f());};
  return ctx;
}
const fn=x=>x.func+(x.func==='unloadModule'?':'+x.args[0]:'');
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
check('첫 재생: 숨기기+모듈 내리기 한 번, 1.5초 뒤 숨기기만, 그 밖의 예약 없음',()=>{
  const c=env(false);vm.runInContext('_lbCaptionsOffOnce()',c);
  assert.deepEqual(c.sent.map(fn),['setOption','unloadModule:captions','unloadModule:cc']);
  assert.deepEqual(c.timers.map(t=>t.ms),[1500]);c.sent.length=0;c.flush();
  assert.deepEqual(c.sent.map(fn),['setOption']);
  vm.runInContext('_lbCaptionsOffOnce()',c);assert.equal(c.sent.length,1,'같은 틀에서 두 번 안 함');
});
check('유튜브가 모듈을 다시 붙여도(onApiChange 경로) 숨기기만 — 다시 내리지 않음',()=>{
  const c=env(false);vm.runInContext('_lbCaptionsOffOnce()',c);c.sent.length=0;
  vm.runInContext('_lbCcSendNow(_lbActiveVid,false)',c);assert.deepEqual(c.sent.map(fn),['setOption']);
});
check('데스크톱: 플레이어를 직접 만지면 그 뒤엔 아무것도 안 보냄',()=>{
  const c=env(false);vm.runInContext('_lbCaptionsOffOnce()',c);c.sent.length=0;
  c.document.activeElement=c.iframe;c.L['w:blur']();c.flush();c.sent.length=0;
  vm.runInContext('_lbCcSendNow(_lbActiveVid,false)',c);c.L['d:fullscreenchange']();c.flush();
  assert.equal(c.sent.length,0);
});
check('폰: 열 때 틀에 포커스가 가도 끄기는 동작',()=>{
  const c=env(true);c.document.activeElement=c.iframe;c.L['w:blur']();c.flush();
  vm.runInContext('_lbCaptionsOffOnce()',c);assert.ok(c.sent.some(x=>x.func==='setOption'));
});
check('전체화면 전환: 숨기기 한 번(모듈은 안 건드림)',()=>{
  const c=env(false);vm.runInContext('_lbCaptionsOffOnce()',c);c.flush();c.sent.length=0;
  c.L['d:fullscreenchange']();c.flush();assert.deepEqual(c.sent.map(fn),['setOption']);
});
check('다른 영상으로 넘어가면 이전 영상 예약은 안 보냄',()=>{
  const c=env(false);vm.runInContext('_lbCaptionsOffOnce()',c);c.sent.length=0;vm.runInContext("_lbActiveVid='v2'",c);c.flush();
  assert.equal(c.sent.length,0);
});
check('새 틀이 생기면 기록·만짐 표시를 비움(app.js _lbSetIframeSrc)',()=>{assert.match(app,/_lbCcOffVid=null;_lbCcUserTouched=false;/);});
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
