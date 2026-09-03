// 데스크톱: 카드가 열린 상태에서 검색/설정을 열면 그게 카드 위로 와야 한다 (2026-09-03 신설)
//
// 왜: 사용자 제보 "카드 열린 상태에서 검색 버튼 누르면 검색창이 뒤로 떠". 원인은 `#search-wrap`이
// 정적 z-index:68인데 카드 패널(memberPanel/sidePanel)은 _bringToFront로 131+에 올라가 있던 것.
// 2026-09-02 z-index 통일에서 카드·조합·곡영상·어드민 모달은 옮겼는데 **데스크톱 검색/설정이 빠졌다.**
//
// ⚠️ 이건 반드시 실제 브라우저로 확인한다 — tests/overlay-front.test.js는 소스 문자열 검사라
//    "_bringToFront를 부르는가"만 보고, **정적 z-index가 그보다 높아 실제로는 가려지는** 상황을 못 잡는다.
//    (오늘의 교훈: 진입 게이트/실효 스타일은 소스 검사로 안 잡힌다.)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/desktop-search-front.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8951;
const CDP_PORT = 9351;
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`✅ ${m}`); };
const bad = m => { fail++; console.log(`❌ ${m}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForCdp(n = 40) {
  for (let i = 0; i < n; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; } catch (e) { await sleep(300); } }
  throw new Error('CDP 준비 실패');
}
function connectCdp(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url); let id = 0; const waiting = new Map();
    ws.addEventListener('open', () => res({
      send: (method, params) => new Promise((r2, j2) => { const i = ++id; waiting.set(i, { r2, j2 }); ws.send(JSON.stringify({ id: i, method, params })); }),
      close: () => ws.close(),
    }));
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && waiting.has(msg.id)) { const { r2, j2 } = waiting.get(msg.id); waiting.delete(msg.id); msg.error ? j2(new Error(msg.error.message)) : r2(msg.result); }
    });
    ws.addEventListener('error', rej);
  });
}
async function ev(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  if (!BROWSER_PATH) { console.log('⏭️  브라우저를 못 찾음 — 스킵'); process.exit(0); }
  server.listen(PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-dsf-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[desktop-search-front] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(6000);
    const ready = await ev(cdp, `(typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&typeof showT!=='undefined'&&!isMob())`);
    if (!ready) { bad('앱 미준비 또는 데스크톱 뷰포트가 아님'); throw new Error('미준비'); }
    ok('앱 로드 + 데스크톱 뷰포트(1440x900)');

    // 실효 z-index를 비교한다(인라인 style이 아니라 computed) — 정적 CSS 값이 이겨서 가려지는 걸 잡으려면
    // 반드시 computed로 봐야 한다.
    const zTop = `(function(){const els=['tt','gc','member-panel','side-panel'].map(i=>document.getElementById(i)).filter(e=>e&&getComputedStyle(e).display!=='none');
      return els.reduce((mx,e)=>Math.max(mx,parseInt(getComputedStyle(e).zIndex)||0),0);})()`;
    const zOf = id => `(function(){const e=document.getElementById('${id}');return e?(parseInt(getComputedStyle(e).zIndex)||0):-1;})()`;

    for (const [label, btnId, panelId] of [['검색', 'tab-search', 'search-wrap'], ['설정', 'tab-settings', 'settings-panel']]) {
      await ev(cdp, `(function(){try{closeCards()}catch(e){};['search-wrap','settings-panel'].forEach(i=>document.getElementById(i).classList.remove('open'));return 1;})()`);
      await sleep(300);
      // 멤버 카드를 하나 연다
      await ev(cdp, `(function(){const a=ARTISTS.find(x=>x.group&&x.group.ko);showT(a,700,400);return 1;})()`);
      await sleep(900);
      const cardZ = await ev(cdp, zTop);
      if (!(cardZ > 0)) { bad(`[${label}] 사전조건 실패 — 카드가 안 열림(z=${cardZ})`); continue; }
      await ev(cdp, `document.getElementById('${btnId}').click()`);
      await sleep(500);
      const openNow = await ev(cdp, `document.getElementById('${panelId}').classList.contains('open')`);
      const panelZ = await ev(cdp, zOf(panelId));
      if (!openNow) { bad(`[${label}] 패널이 안 열림`); continue; }
      if (panelZ > cardZ) ok(`[${label}] 카드(z=${cardZ}) 위로 뜸 (패널 z=${panelZ})`);
      else bad(`[${label}] 카드 뒤로 깔림 — 카드 z=${cardZ}, 패널 z=${panelZ}`);
    }
  } catch (e) {
    bad('예외: ' + e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
