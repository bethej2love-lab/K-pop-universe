// 데스크톱 닫기 층 회귀 테스트 (2026-10-20 사용자 — "라이트박스만 꺼져야 하는데 카드까지 꺼진다")
//  ① 카드+영상에서 영상 닫기(›) = 영상만, 카드·주소 유지  ② ESC = 영상만(데스크톱은 iframe에 포커스 안 줌)
//  ③ 그룹+멤버 카드에서 ESC = 위의 멤버 카드만  ④ 카드 넓게 보기(⇤)가 카드를 닫지 않음(예전엔 관리자 스크립트에만 동작 코드)
//  ⑤ 멤버+연결 카드 위에 영상을 열어도 멤버 카드 유지  ⑥ 탐험 패널 데스크톱 닫기 버튼  ⑦ 검색창 빈 상태 ESC = 닫힘
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저 없으면 스킵. 실행: node tests/desktop-close-layers.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8987, CDP_PORT = 9387;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-dcl-'));
  const proc = spawn(BROWSER_PATH, ['--headless=new', '--no-sandbox', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  console.log(`[desktop-close-layers] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(8000);
    if (!(await ev(cdp, `typeof showGC==='function'&&ARTISTS.length>0`))) { bad('앱 미준비'); throw new Error('미준비'); }
    const open = async () => (await ev(cdp, `[...document.querySelectorAll('.open')].filter(e=>e.id&&e.getBoundingClientRect().width>0).map(e=>e.id).join(' ')`)).split(' ');
    const has = (o, id) => o.includes(id);
    const esc = async () => { for (const type of ['keyDown', 'keyUp']) await cdp.send('Input.dispatchKeyEvent', { type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await sleep(900); };
    const reset = async () => { await ev(cdp, `(function(){try{closeLightbox()}catch(e){};try{closeConnCard()}catch(e){};try{closeCards()}catch(e){};history.replaceState(null,'',location.pathname);return 1})()`); await sleep(900); };
    const LB = `openLightbox('https://www.youtube.com/watch?v=4Hyx7TZ2cXg',false,null,0,{groupKo:'에스파'})`;
    const KA = `ARTISTS.find(a=>a.name&&a.name.ko==='카리나'&&a.group&&a.group.ko==='에스파')`;
    // ①
    await ev(cdp, `(showGC('에스파'),1)`); await sleep(2500); await ev(cdp, `(${LB},1)`); await sleep(1500);
    await ev(cdp, `(document.getElementById('yt-lb-close').click(),1)`); await sleep(900);
    let o = await open(); const h = await ev(cdp, 'decodeURIComponent(location.hash)');
    if (!has(o, 'yt-lightbox') && has(o, 'side-panel') && h.includes('에스파')) ok('① 영상 닫기 = 영상만, 카드·주소 유지'); else bad(`① ${o} ${h}`);
    // ②
    await ev(cdp, `(${LB},1)`); await sleep(1500); await esc(); o = await open();
    if (!has(o, 'yt-lightbox') && has(o, 'side-panel')) ok('② ESC = 영상만'); else bad(`② ${o}`);
    // ③
    await ev(cdp, `(showT(${KA}),1)`); await sleep(2500); o = await open();
    if (has(o, 'member-panel')) { await esc(); o = await open(); if (!has(o, 'member-panel') && has(o, 'side-panel')) ok('③ 그룹+멤버에서 ESC = 멤버 카드만'); else bad(`③ ${o}`); } else bad(`③ 사전조건 멤버 패널 없음 ${o}`);
    // ④
    await ev(cdp, `(document.getElementById('sp-wide-btn').click(),1)`); await sleep(900); o = await open();
    const wide = await ev(cdp, `document.body.classList.contains('card-wide')`);
    if (has(o, 'side-panel') && wide) ok('④ 넓게 보기 = 카드 유지·넓어짐'); else bad(`④ ${o} wide=${wide}`);
    await ev(cdp, `(document.getElementById('sp-wide-btn').click(),1)`); await sleep(500);
    await reset();
    // ⑤
    await ev(cdp, `(showT(${KA}),1)`); await sleep(3000); await ev(cdp, `(document.getElementById('tt-conn-btn').click(),1)`); await sleep(3000);
    await ev(cdp, `(${LB},1)`); await sleep(1500); o = await open();
    if (has(o, 'side-panel') && has(o, 'conn-panel') && has(o, 'yt-lightbox')) ok('⑤ 멤버+연결 카드 위 영상 = 멤버 카드 유지'); else bad(`⑤ ${o}`);
    await reset();
    // ⑥
    await ev(cdp, `(document.getElementById('dh-feed-btn').click(),1)`); await sleep(2500);
    const fc = await ev(cdp, `(()=>{const r=document.getElementById('feed-close').getBoundingClientRect();return r.width>0&&r.right<=440;})()`);
    await ev(cdp, `(document.getElementById('feed-close').click(),1)`); await sleep(900); o = await open();
    if (fc && !has(o, 'feed-overlay')) ok('⑥ 탐험 패널 닫기 버튼 보이고 동작'); else bad(`⑥ 버튼=${fc} ${o}`);
    // ⑦
    await ev(cdp, `(document.getElementById('dh-search-btn').click(),1)`); await sleep(900);
    await ev(cdp, `(document.getElementById('search-input').focus(),1)`); await esc(); o = await open();
    if (!has(o, 'search-wrap')) ok('⑦ 빈 검색창 ESC = 닫힘'); else bad(`⑦ ${o}`);
  } catch (e) { bad('예외: ' + e.message); } finally { try { proc.kill(); } catch (e) {} server.close(); }
  console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
