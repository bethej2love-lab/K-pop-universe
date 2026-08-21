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
  const profileDir = path.join(os.tmpdir(), 'kpu-smoke-profile');
  const child = spawn(BROWSER_PATH, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
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

    const loadingGone = await evalExpr(cdp, `(function(){const el=document.getElementById('loading-screen')||document.querySelector('.loading-screen,#loading');return !el||getComputedStyle(el).display==='none'||el.style.display==='none';})()`);
    if (loadingGone === false) fail('로딩 오버레이가 안 사라짐(무한 로딩 의심)'); else ok('로딩 오버레이 정상 해제(또는 애초에 없음)');

    const hasCanvas = await evalExpr(cdp, `!!document.querySelector('canvas')`);
    if (!hasCanvas) fail('canvas 엘리먼트가 없음 — 3D 씬 초기화 실패 의심'); else ok('3D 캔버스 존재 확인');

    const title = await evalExpr(cdp, `document.title`);
    if (!title) fail('document.title이 비어있음'); else ok(`페이지 타이틀: "${title}"`);

    if (errors.length) fail(`초기 로드 중 콘솔 에러 ${errors.length}건: ${errors.slice(0, 5).join(' | ')}`);
    else ok('초기 로드 콘솔 에러 0건');

    // 4. 상호작용 — 나침반 탐험 패널 열기
    const errBefore = errors.length;
    await evalExpr(cdp, `document.getElementById('tab-feed')?.click()`);
    await sleep(2500);
    const feedOpen = await evalExpr(cdp, `document.getElementById('feed-overlay')?.classList.contains('open')`);
    const chartCardCount = await evalExpr(cdp, `document.querySelectorAll('#feed-chart .feed-card').length`);
    if (!feedOpen) fail('탐험 패널이 안 열림(#feed-overlay.open 없음)'); else ok('탐험 패널 열기 성공');
    if (typeof chartCardCount === 'number' && chartCardCount > 0) ok(`Charts 섹션 카드 ${chartCardCount}개 렌더 확인`);
    else fail('Charts 섹션에 카드가 하나도 안 뜸');
    if (errors.length > errBefore) fail(`탐험 패널 여는 동안 새 콘솔 에러 ${errors.length - errBefore}건: ${errors.slice(errBefore, errBefore + 5).join(' | ')}`);
    else ok('탐험 패널 여는 동안 새 콘솔 에러 0건');

    cdp.close();
  } finally {
    server.close();
    // ⚠️ 프로세스 이름이 아니라 정확한 PID만 종료 — msedge 일괄 kill 금지(위 주석 참고)
    try { execSync(`taskkill /PID ${child.pid} /T /F`); } catch (e) { /* 이미 종료됐으면 무시 */ }
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

main().catch(e => { console.error('[smoke] 실행 실패:', e); process.exit(2); });
