// 인트로 리빌 회귀 테스트 (2026-09-02 신설)
//
// 왜 만들었나: 리빌 연출이 "제대로 안 나온다"는 제보가 두 번 반복됐는데, 두 번 다 원인이
// **연출이 여러 개 겹쳐 서로를 지운 것**이었다. 2026-09-01엔 veil opacity 페이드(800ms)가
// mask-image 아이리스(1050ms)를 덮어, 아이리스가 53%만 열린 시점에 veil이 이미 투명해져
// "원이 열리는" 게 안 보였다. 눈으로만 보면 "뭔가 밋밋하다"로만 느껴져 원인을 못 짚는다.
//
// 그래서 확인하는 것: 리빌 메커니즘이 **하나뿐인지**를 구조로 못박는다.
//   [1] 캔버스에 clip-path가 실제로 걸리고 원이 커진다(0% → 75%)
//   [2] 끝나면 인라인 clip-path가 걷힌다(남으면 이후 매 프레임 합성 비용)
//   [3] veil/ring DOM이 아예 없다(다시 생기면 겹침 사고 재발)
//   [4] 후속 타이밍이 REVEAL 상수 기준 상대값이다(리빌 길이를 바꿔도 안 어긋나게)
//   [5] 행성이 전부 제 크기로 정착한다(scale 0.001로 남아 안 보이는 사고 방지)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/reveal.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8941;
const CDP_PORT = 9341;
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = true;
function fail(msg) { pass = false; console.log(`❌ ${msg}`); }
function ok(msg) { console.log(`✅ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForCdp(retries = 40) {
  for (let i = 0; i < retries; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; } catch (e) { await sleep(300); } }
  throw new Error('CDP 포트가 안 열림 — 브라우저 실행 실패');
}
function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let msgId = 0; const pending = new Map(); const listeners = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) { return new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); }); },
      on(event, cb) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(cb); },
      close() { ws.close(); },
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); } else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method).forEach(cb => cb(msg.params)); });
  });
}
function waitForLoadEvent(cdp) { return new Promise(resolve => { cdp.on('Page.loadEventFired', () => resolve()); setTimeout(resolve, 15000); }); }
async function ev(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r && r.exceptionDetails) return { __err: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
  return r && r.result && r.result.value;
}
async function pollUntil(cdp, expr, timeoutMs, isReady = v => !!v) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { const v = await ev(cdp, expr); if (isReady(v)) return v; await sleep(60); }
  return await ev(cdp, expr);
}

// ── 소스 레벨 검사 (브라우저 없이도 도는 부분) ─────────────────────────────
function sourceChecks() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');

  if (/id=["']loading-veil["']|id=["']loading-ring["']/.test(html)) fail('[3] veil/ring DOM이 다시 생김 — 리빌 연출이 또 겹칠 수 있다');
  else ok('[3] veil/ring DOM 없음');

  if (/#loading-veil|#loading-ring/.test(css)) fail('[3] veil/ring CSS가 남아있음');
  else ok('[3] veil/ring CSS 없음');

  if (!/const REVEAL=\{/.test(html)) fail('[4] REVEAL 타임라인 상수가 없음');
  else ok('[4] REVEAL 타임라인 상수 존재');

  // 후속 타이밍이 상대값인지 — 예전 하드코딩(1200/2600/2400)으로 되돌아가면 잡는다
  const rel = /_lblFarStartAt=performance\.now\(\)\+REVEAL\.clip/.test(html)
    && /_obTimer=setTimeout\(_showOnboardHint,REVEAL\.clip/.test(html);
  if (!rel) fail('[4] 후속 타이밍이 REVEAL 상수 기준 상대값이 아님(리빌 길이를 바꾸면 어긋난다)');
  else ok('[4] 후속 타이밍이 REVEAL 기준 상대값');

  if (!/if\(_reduceMotion\)\{ _revealSettle\(\); return; \}/.test(html)) fail('[reduce] _revealUniverse에 _reduceMotion 가드 없음');
  else ok('[reduce] _reduceMotion 가드 있음');

  if (/revealdbg/.test(html)) fail('임시 진단 코드(?revealdbg)가 남아있음');
  else ok('임시 진단 코드 제거됨');
}

async function main() {
  sourceChecks();
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 브라우저 검증 스킵'); console.log(pass ? '\n✅ 리빌 테스트 통과(소스 검사만)' : '\n💥 리빌 테스트 실패'); process.exit(pass ? 0 : 1); }

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-reveal-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[reveal] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    // 데스크톱 뷰포트 — 이번 버그가 데스크톱에서만 눈에 띄었던 건이라 그쪽으로 본다
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // 리빌 시작 순간의 clip-path를 놓치지 않으려면 사전에 샘플러를 심어야 한다 —
    // Page.addScriptToEvaluateOnNewDocument로 문서 실행 전에 rAF 샘플러를 건다.
    // ⚠️ 인라인 style.clipPath는 시작값(0%)과 목표값(75%)만 들고 있다 — 그것만 보면 트랜지션이 실제로
    // 도는지 알 수 없다(값이 두 개만 잡힌다). 진행 중인 보간값은 getComputedStyle에서만 보인다.
    // ⚠️ 값 폴링(rAF든 setInterval이든)으로는 이걸 못 잡는다. 헤드리스는 swiftshader 소프트웨어
    // 렌더라 행성 268개를 그리는 동안 메인스레드가 점유돼 샘플러 콜백이 밀리고, 트랜지션이 끝나면
    // 인라인 clip-path가 걷혀 computedStyle이 none이 된다 — 결국 샘플링 창을 통째로 놓쳐서 실행마다
    // 결과가 달라졌다(0개 / 2개를 오감).
    // transitionrun·transitionend는 브라우저가 트랜지션을 **실제로 시작·완료했을 때만** 쏘므로
    // 프레임 속도와 무관하게 결정적이다. 값 샘플은 보조로만 남긴다.
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__clipEvents=[];window.__clipSamples=[];
        ['transitionrun','transitionend','transitioncancel'].forEach(function(t){
          document.addEventListener(t,function(e){
            if(e.propertyName&&String(e.propertyName).indexOf('clip')>=0)
              window.__clipEvents.push(t+':'+e.propertyName);
          },true);
        });
        setInterval(function(){var c=document.querySelector('canvas');
          if(c){var v=getComputedStyle(c).clipPath||'';
            var m=/circle\\(([0-9.]+)/.exec(v); if(m)window.__clipSamples.push(parseFloat(m[1]));}},16);`
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);

    // 로딩 텍스트가 사라질 때까지 → 그 다음 트랜지션이 **끝날 때까지** 기다린다.
    // ⚠️ 텍스트는 REVEAL.text(250ms)에 사라지는데 클립은 REVEAL.clip(800ms)이라, 텍스트만 보고
    // 검사하면 트랜지션 도중에 재는 셈이 된다(실제로 "시작만 하고 안 끝남"으로 계속 실패했다).
    await pollUntil(cdp, `(function(){var l=document.getElementById('loading');return !!l&&getComputedStyle(l).display==='none';})()`, 20000);
    await pollUntil(cdp, `(window.__clipEvents||[]).some(function(e){return e.indexOf('transitionend')===0;})`, 15000);

    const events = await ev(cdp, 'window.__clipEvents||[]');
    const evs = Array.isArray(events) ? events : [];
    const samples = await ev(cdp, 'window.__clipSamples||[]');
    const nums = (Array.isArray(samples) ? samples : []).filter(n => typeof n === 'number' && !isNaN(n));
    const uniq = [...new Set(nums)];
    const ran = evs.some(e => e.startsWith('transitionrun'));
    const ended = evs.some(e => e.startsWith('transitionend'));
    const cancelled = evs.some(e => e.startsWith('transitioncancel'));
    if (!ran) fail(`[1] clip-path 트랜지션이 시작조차 안 함 (잡힌 이벤트: ${JSON.stringify(evs)})`);
    else if (cancelled && !ended) fail(`[1] clip-path 트랜지션이 중간에 취소됨 — 다른 연출이 덮어썼을 수 있다 (${JSON.stringify(evs)})`);
    else if (!ended) fail(`[1] clip-path 트랜지션이 시작만 하고 안 끝남 (${JSON.stringify(evs)})`);
    else ok(`[1] clip-path 트랜지션 시작→완료 확인${uniq.length ? ` (값 샘플: ${uniq.map(v => v.toFixed(0) + '%').join(' → ')})` : ''}`);

    // 끝난 뒤 인라인 clip-path가 걷혔는지
    await sleep(400);
    const leftover = await ev(cdp, `(function(){var c=document.querySelector('canvas');return c?(c.style.clipPath||c.style.webkitClipPath||''):'(no canvas)';})()`);
    if (leftover && leftover !== '' && leftover !== '(no canvas)') fail(`[2] 리빌 후 인라인 clip-path가 남음: "${leftover}"`);
    else ok('[2] 리빌 후 인라인 clip-path 걷힘');

    // 행성이 제 크기로 정착했는지 (0.001로 남으면 우주가 텅 빈 것처럼 보인다)
    const settled = await ev(cdp, `(function(){
      if(typeof bubbleMeshes==='undefined'||!bubbleMeshes.length)return {n:0};
      var tiny=bubbleMeshes.filter(function(b){return b.mesh.scale.x<0.01;}).length;
      return {n:bubbleMeshes.length,tiny:tiny};})()`);
    if (!settled || !settled.n) fail('[5] bubbleMeshes를 못 읽음(우주 빌드 실패?)');
    else if (settled.tiny > 0) fail(`[5] 행성 ${settled.tiny}/${settled.n}개가 축소된 채 남음`);
    else ok(`[5] 행성 ${settled.n}개 전부 제 크기로 정착`);

    // veil/ring이 런타임에도 없는지
    const veil = await ev(cdp, `!!document.getElementById('loading-veil')||!!document.getElementById('loading-ring')`);
    if (veil) fail('[3] 런타임에 veil/ring이 존재함');
    else ok('[3] 런타임에도 veil/ring 없음');

    cdp.close();
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
  }
  console.log(pass ? '\n✅ 리빌 테스트 통과' : '\n💥 리빌 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
