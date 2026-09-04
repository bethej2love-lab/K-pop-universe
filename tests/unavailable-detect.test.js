// 삭제·비공개 영상 감지 — 회귀 테스트 (2026-09-04 신설, Fable 아카이브 운영 설계 T8)
//
// 왜 필요한가: 이 로직은 순환 갱신 한 번에 **2만 행을 update**한다. 잘못 짜면 (a) 첫 관측 시각이
// 매번 오늘로 밀려 "언제 사라졌나"가 영원히 오늘이 되거나 (b) 컬럼이 없는 환경에서 update가 통째로
// 실패해 조회수 갱신까지 같이 죽는다. 둘 다 조용히 일어나서 눈으로는 못 잡는다.
//
// 방식: 실제 `_ytRotateViewCountRefresh`를 그대로 돌리되 sb·fetch·API키만 스텁으로 갈아끼워
// **어떤 patch가 만들어지는가**를 본다. 네트워크도 DB도 안 탄다.
// ⚠️ `sb`는 index.html의 top-level `let`이라 window에 없다 — eval로 전역 렉시컬 바인딩에 직접 대입해야
//    스텁이 먹는다(window.sb=… 는 조용히 무시된다. 처음에 그렇게 짰다가 실제 클라이언트가 돌았다).
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/unavailable-detect.test.js
//
// ⚠️⚠️ **CI 스킵 목록에 아직 안 들어가 있다.** `.github/workflows/data-and-tests.yml`의
//      "헤드리스 브라우저가 필요한 것" 목록에 `unavailable-detect.test.js`를 추가해야 한다.
//      Claude가 못 넣은 이유는 workflow 파일이 현재 PAT로 push가 안 되기 때문 — **사람이 직접**
//      한 줄 넣을 것. 안 넣으면 러너에 브라우저가 없어 조용히 스킵되긴 하지만(이 파일은 스킵 시
//      exit 0), 그 목록 주석이 경고하듯 "새 브라우저 테스트를 안 넣어 CI가 빨개진" 전례가 있다.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8971;
const CDP_PORT = 9371;
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = true;
function fail(msg) { pass = false; console.log(`❌ ${msg}`); }
function ok(msg) { console.log(`✅ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let id = 0; const pend = new Map(); const on = new Map();
    ws.addEventListener('open', () => resolve({
      send: (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); }),
      on: (e, cb) => { if (!on.has(e)) on.set(e, []); on.get(e).push(cb); },
      close: () => ws.close(),
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); }
      else if (m.method && on.has(m.method)) on.get(m.method).forEach(cb => cb(m.params));
    });
  });
}

// 스텁 시나리오 4건: A=계속 살아있음 / B=이번에 사라짐 / C=이미 사라져 있었음 / D=되살아남
const SCENARIO = hasCol => `(async function(){
  const ROWS=[{id:'A',unavailable_at:null},{id:'B',unavailable_at:null},
              {id:'C',unavailable_at:'2026-08-01T00:00:00Z'},{id:'D',unavailable_at:'2026-08-02T00:00:00Z'}];
  const ALIVE=new Set(['A','D']);
  const patches={}; let served=false;
  const stub={from:function(){return {
    select:function(){const o={};o.order=function(){return o;};
      o.limit=function(){return Promise.resolve({error:${hasCol} ? null : {message:'column does not exist'}});};
      o.range=function(){ if(served)return Promise.resolve({data:[],error:null}); served=true;
        return Promise.resolve({data:ROWS.map(function(r){return ${hasCol} ? {id:r.id,unavailable_at:r.unavailable_at} : {id:r.id};}),error:null}); };
      return o;},
    update:function(patch){return {eq:function(c,id){patches[id]=patch;return Promise.resolve({error:null});}};},
  };}};
  const origSb=eval('sb'), origFetch=window.fetch, origKey=_ytApiKey, origProg=_ytSetProg;
  let last='';
  eval('sb = stub');
  eval('_ytHasUnavailCol = null');
  window.fetch=async function(){return {ok:true,json:async function(){return {items:[...ALIVE].map(function(id){return {id:id,statistics:{viewCount:'100'}};})};}};};
  eval('_ytApiKey = function(){ return "STUB"; }');
  eval('_ytSetProg = function(t){ last = t; }');
  let err=null;
  try{ await _ytRotateViewCountRefresh(); }catch(e){ err=String((e&&e.message)||e); }
  finally{ eval('sb = origSb'); window.fetch=origFetch; eval('_ytApiKey = origKey'); eval('_ytSetProg = origProg'); }
  return JSON.stringify({patches:patches,msg:last,err:err});
})()`;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 삭제 감지 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-unavail-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--ignore-certificate-errors', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[unavailable] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
      if (!r) return undefined;
      if (r.exceptionDetails) { fail('평가 예외: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)); return undefined; }
      return r.result && r.result.value;
    };
    for (let i = 0; i < 40; i++) { if (await ev("typeof ARTISTS!=='undefined'&&ARTISTS.length>0")) break; await sleep(400); }
    // 어드민 마크업을 먼저 펼쳐야 admin.js가 중간에 안 멈춘다(마크업이 <template> 안에 격리돼 있음)
    await ev("typeof _mountAdminMarkup==='function'?(_mountAdminMarkup(),1):0");
    await ev("new Promise(function(res,rej){var s=document.createElement('script');s.src='admin.js?v=test';s.onload=res;s.onerror=rej;document.body.appendChild(s);})");
    for (let i = 0; i < 40; i++) { if (await ev("typeof _ytRotateViewCountRefresh==='function'")) break; await sleep(400); }
    if (!await ev("typeof _ytRotateViewCountRefresh==='function'")) { fail('admin.js 로드 실패 — _ytRotateViewCountRefresh 없음'); throw new Error('load'); }

    // ── 1. 컬럼이 있을 때 ────────────────────────────────────────────────
    const r1 = JSON.parse(await ev(SCENARIO(true)) || '{}');
    if (r1.err) fail('[컬럼 있음] 실행 중 예외: ' + r1.err);
    else {
      const P = r1.patches || {}, has = id => Object.prototype.hasOwnProperty.call(P[id] || {}, 'unavailable_at');
      if (has('A')) fail('[살아있음] 정상 영상의 표식을 건드림 — ' + JSON.stringify(P.A));
      else ok('[살아있음] 정상 영상은 표식을 안 건드림');
      if (!(has('B') && P.B.unavailable_at)) fail('[신규 삭제] 사라진 영상에 시각이 안 찍힘 — ' + JSON.stringify(P.B));
      else ok('[신규 삭제] 사라진 영상에 시각 기록');
      // 이게 이 테스트의 핵심 — 매번 now()로 밀면 "언제 사라졌나"가 영원히 오늘이 된다
      if (has('C')) fail('[첫 관측 유지] 이미 사라진 영상의 시각을 덮어씀 — ' + JSON.stringify(P.C));
      else ok('[첫 관측 유지] 이미 사라진 영상은 시각을 안 덮어씀');
      if (!(has('D') && P.D.unavailable_at === null)) fail('[되살아남] 표식이 안 지워짐 — ' + JSON.stringify(P.D));
      else ok('[되살아남] 돌아온 영상은 표식 해제');
      if (!/새로 감지 1건/.test(r1.msg || '') || !/되살아남 1건/.test(r1.msg || '')) fail('[요약] 완료 메시지에 건수가 없음 — ' + r1.msg);
      else ok('[요약] 완료 메시지에 감지 1건 · 되살아남 1건');
    }

    // ── 2. 컬럼이 없을 때(마이그레이션 전) ────────────────────────────────
    const r2 = JSON.parse(await ev(SCENARIO(false)) || '{}');
    if (r2.err) fail('[컬럼 없음] 실행 중 예외: ' + r2.err);
    else {
      const P = r2.patches || {};
      const leaked = ['A', 'B', 'C', 'D'].filter(id => Object.prototype.hasOwnProperty.call(P[id] || {}, 'unavailable_at'));
      if (leaked.length) fail('[미마이그레이션] 없는 컬럼을 patch에 넣음(' + leaked.join(',') + ') — 조회수 갱신까지 같이 죽는다');
      else ok('[미마이그레이션] 없는 컬럼을 patch에 안 넣음 — 조회수 갱신은 그대로 동작');
      if (!/삭제 감지 꺼짐/.test(r2.msg || '')) fail('[미마이그레이션] 꺼졌다는 안내가 없음 — ' + r2.msg);
      else ok('[미마이그레이션] "꺼짐 · SQL 실행 필요" 안내');
      if (Object.keys(P).length !== 4) fail('[미마이그레이션] 조회수 갱신 자체가 안 됨(patch ' + Object.keys(P).length + '건)');
      else ok('[미마이그레이션] 조회수 갱신은 4건 그대로 수행');
    }
  } catch (e) {
    fail('테스트 실행 오류: ' + e.message);
  } finally {
    try { process.kill(child.pid); } catch (e) { }
    server.close();
  }
  console.log(pass ? '\n🎉 삭제 감지 테스트 전부 통과' : '\n💥 삭제 감지 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main();
