// 배포 전 스모크 테스트 (2026-08-21 신설, 우선순위 3)
//
// 왜 만들었나: Fable 자문("일류 IT 기업 개발자가 봤다면") 지적 중 "스테이징 없이 직배포, 검증은
// 배포 후 육안"에 동의해서 만듦 — 이 세션엔 Playwright 같은 별도 도구가 없어서, Node 24 내장
// fetch/WebSocket으로 Chrome DevTools Protocol(CDP)을 직접 구현해 헤드리스 브라우저를 띄운다
// (과거 세션에서도 같은 방식을 쓴 선례가 있음 — 무한스크롤 버그 재현 시도). Playwright 없이도
// "로딩화면에서 멈춤" 급의 치명적 회귀는 이걸로 배포 전에 걸러낼 수 있다.
//
// 무엇을 확인하는가: (1) 로컬 서버로 index.html을 실제로 서빙해서 로드, (2) 콘솔 에러/처리 안 된
// 예외 0건, (3) 3D 씬 초기화(캔버스 존재+WebGL 컨텍스트), (4) 로딩 오버레이가 실제로 사라짐(무한
// 로딩 아님), (5) 나침반 탐험 패널을 열어보고 카드가 실제로 뜨는지, (6) 그 상호작용 동안에도 새
// 콘솔 에러가 안 생기는지.
// ⚠️ 주의: msedge.exe를 절대 프로세스 이름으로 일괄 kill하지 말 것(사용자 실제 브라우저 창까지
// 꺼지는 사고가 과거에 있었음, [[feedback_dont_kill_edge]]) — 이 스크립트가 직접 spawn한 PID만
// 정확히 taskkill한다.
//
// 실행: node tests/smoke.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8934;
const CDP_PORT = 9333;
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  // macOS / Linux 후보 — 맥에서도 스모크(특히 모바일 뷰포트)를 돌릴 수 있게(2026-08-22)
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = EDGE_CANDIDATES.find(p => fs.existsSync(p));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let errors = [];
let pass = true;
function fail(msg) { pass = false; console.log(`❌ ${msg}`); }
function ok(msg) { console.log(`✅ ${msg}`); }

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음(msedge/chrome) — 스모크 테스트 스킵'); process.exit(0); }

  // 1. 로컬 정적 서버(이 폴더 전체를 그대로 서빙 — GitHub Pages와 동일하게 상대경로 fetch가 되게)
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p);
    if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, r));

  // 2. 헤드리스 브라우저 — 전용 프로필/포트라 사용자의 실제 Edge 창과 완전히 격리됨
  // 매번 새 임시 폴더 — 고정 경로를 재사용하면 지난 실행의 localStorage(온보딩 힌트 등)가 남아서
  // "이전 방문자처럼 보이는" 상태로 열리게 되고, 그 상태에 따라 UI 동작이 달라져 실행마다 결과가
  // 들쭉날쭉해짐(2026-08-21, 실제로 겪음 — 두 번째 실행부터 계속 "탐험 패널이 안 열림"으로 실패했는데
  // 원인은 shared.js 리팩터링이 아니라 이 프로필 재사용이었음, 새 프로필로는 항상 통과 확인).
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-smoke-'));
  const child = spawn(BROWSER_PATH, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    // 헤드리스에서 소프트웨어 WebGL 허용 — 최신 Chrome/Edge는 --disable-gpu 시 SwiftShader WebGL을
    // 기본 차단해서 3D 씬(THREE.WebGLRenderer)이 "Error creating WebGL context"로 죽음. 명시로 켠다
    // (2026-08-22 맥에서 스모크 돌릴 때 발견 — 이게 없으면 씬 초기화 실패로 전 항목 오탐).
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[smoke] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 taskkill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);

    cdp.on('Runtime.exceptionThrown', p => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'unknown exception'));
    cdp.on('Console.messageAdded', p => { if (p.message.level === 'error') errors.push(p.message.text); });
    cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push((p.args || []).map(a => a.value || a.description).join(' ')); });

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Console.enable');
    await cdp.send('Log.enable');
    cdp.on('Log.entryAdded', p => { if (p.entry.level === 'error') errors.push(p.entry.text); });

    // 3. 실제 로드
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);
    await sleep(4000); // 초기 fetch(GROUPS/ARTISTS)·Three.js 씬 구성 시간 확보

    // 고정 대기 대신 폴링 — SwiftShader 등 느린 헤드리스에선 씬 구성이 4초를 넘겨 로딩이 아직 떠있을 수
    // 있어 오탐이 났음(2026-08-22 맥). 사라질 때까지(최대 8초 더) 폴링해 환경 속도와 무관하게 판정한다.
    const loadingGone = await pollUntil(cdp, `(function(){const el=document.getElementById('loading-screen')||document.querySelector('.loading-screen,#loading');return !el||getComputedStyle(el).display==='none'||el.style.display==='none';})()`, 8000, v => v === true);
    if (!loadingGone) fail('로딩 오버레이가 안 사라짐(무한 로딩 의심)'); else ok('로딩 오버레이 정상 해제(또는 애초에 없음)');

    const hasCanvas = await evalExpr(cdp, `!!document.querySelector('canvas')`);
    if (!hasCanvas) fail('canvas 엘리먼트가 없음 — 3D 씬 초기화 실패 의심'); else ok('3D 캔버스 존재 확인');

    const title = await evalExpr(cdp, `document.title`);
    if (!title) fail('document.title이 비어있음'); else ok(`페이지 타이틀: "${title}"`);

    if (errors.length) fail(`초기 로드 중 콘솔 에러 ${errors.length}건: ${errors.slice(0, 5).join(' | ')}`);
    else ok('초기 로드 콘솔 에러 0건');

    // 4. 상호작용 — 나침반 탐험 패널 열기. Charts 카드는 Supabase 응답을 기다려야 해서(네트워크 속도
    // 편차 큼) 고정 sleep 대신 조건이 실제로 참이 될 때까지 폴링 — 느린 환경에서의 타이밍 오탐 방지.
    const errBefore = errors.length;
    await evalExpr(cdp, `document.getElementById('tab-feed')?.click()`);
    const feedOpen = await pollUntil(cdp, `document.getElementById('feed-overlay')?.classList.contains('open')`, 5000);
    if (!feedOpen) fail('탐험 패널이 안 열림(#feed-overlay.open 없음)'); else ok('탐험 패널 열기 성공');
    const chartCardCount = await pollUntil(cdp, `document.querySelectorAll('#feed-chart .feed-card').length`, 8000, v => v > 0);
    if (chartCardCount) ok(`Charts 섹션 카드 ${chartCardCount}개 렌더 확인`);
    else fail('Charts 섹션에 카드가 하나도 안 뜸(8초 대기)');
    if (errors.length > errBefore) fail(`탐험 패널 여는 동안 새 콘솔 에러 ${errors.length - errBefore}건: ${errors.slice(errBefore, errBefore + 5).join(' | ')}`);
    else ok('탐험 패널 여는 동안 새 콘솔 에러 0건');

    // 5. 모바일 뷰포트 재검증(신규 유저) — isMob()으로 단락되는 최상위 즉시실행 코드는 데스크톱 뷰포트에선
    // 실행조차 안 돼서 크래시가 안 잡힌다(2026-08-22 모바일 전용 TDZ 크래시: 데스크톱 스모크·육안 다 통과했는데
    // 모바일 신규유저 전원이 로딩화면 영구정지했음). 뷰포트를 390으로 좁히고 localStorage를 비워(=신규 유저)
    // 다시 로드해, 모바일에서만 타는 즉시실행 경로가 안전한지 확인한다.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await evalExpr(cdp, `try{localStorage.clear()}catch(e){}`);
    const errBeforeMobile = errors.length;
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);
    await sleep(4000);
    const mobLoadingGone = await pollUntil(cdp, `(function(){const el=document.getElementById('loading-screen')||document.querySelector('.loading-screen,#loading');return !el||getComputedStyle(el).display==='none'||el.style.display==='none';})()`, 8000, v => v === true);
    if (!mobLoadingGone) fail('모바일(390px) 뷰포트에서 로딩이 안 사라짐 — 모바일 전용 크래시/무한로딩 의심'); else ok('모바일(390px) 뷰포트 로딩 정상 해제');
    const mobCanvas = await evalExpr(cdp, `!!document.querySelector('canvas')`);
    if (!mobCanvas) fail('모바일 뷰포트에서 canvas 없음 — 씬 초기화 실패'); else ok('모바일 뷰포트 3D 캔버스 존재');
    if (errors.length > errBeforeMobile) fail(`모바일 뷰포트 로드 중 콘솔 에러 ${errors.length - errBeforeMobile}건: ${errors.slice(errBeforeMobile, errBeforeMobile + 5).join(' | ')}`);
    else ok('모바일 뷰포트 로드 콘솔 에러 0건');

    cdp.close();
  } finally {
    server.close();
    // ⚠️ 프로세스 이름이 아니라 정확한 PID만 종료 — msedge 일괄 kill 금지(위 주석 참고).
    // Windows는 taskkill(자식 트리 포함), macOS/Linux는 SIGKILL로 이 spawn PID만 종료(taskkill이 없어
    // 예전엔 맥에서 오펀 브라우저가 남았음, 2026-08-22 크로스플랫폼화).
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`); else child.kill('SIGKILL'); } catch (e) { /* 이미 종료됐으면 무시 */ }
    // 프로세스 종료 직후엔 Chromium 잠금 파일(SingletonLock 등)이 OS에서 아직 안 풀려있을 수 있어
    // 삭제가 한 번에 안 될 수 있음 — 짧게 재시도. 그래도 실패하면 다음 실행 전용 폴더라 무해하게 남음.
    for (let i = 0; i < 3; i++) {
      try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch (e) { await sleep(300); }
    }
  }

  console.log(`\n${pass ? '✅ 스모크 테스트 통과' : '❌ 스모크 테스트 실패'}`);
  process.exit(pass ? 0 : 1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; } catch (e) { await sleep(300); }
  }
  throw new Error('CDP 포트가 안 열림 — 브라우저 실행 실패');
}
function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let msgId = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        return new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
      },
      on(event, cb) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(cb); },
      close() { ws.close(); },
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => {
      const msg = JSON.parse(e.data);
      if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
      else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method).forEach(cb => cb(msg.params));
    });
  });
}
function waitForLoadEvent(cdp) {
  return new Promise(resolve => { cdp.on('Page.loadEventFired', () => resolve()); setTimeout(resolve, 15000); });
}
async function evalExpr(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
  return r?.result?.value;
}
async function pollUntil(cdp, expr, timeoutMs, isReady = v => !!v) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalExpr(cdp, expr);
    if (isReady(v)) return v;
    await sleep(200);
  }
  return await evalExpr(cdp, expr); // 마지막 값 그대로 반환(실패 메시지에 쓰기 위함)
}

main().catch(e => { console.error('[smoke] 실행 실패:', e); process.exit(2); });
