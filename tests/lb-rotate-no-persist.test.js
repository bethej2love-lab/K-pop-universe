// 회전 버튼 선택이 다음에 열 때까지 남지 않는지 (2026-10-20)
//
// 예전엔 회전(세로/가로 전환) 버튼을 누르면 그 영상 ID를 localStorage(kpu_lb_portrait_vids)에 영구 저장했다.
// 가로 영상에서 한 번 잘못 눌리면 그 뒤로 열 때마다 세로 틀(9:16)에 갇혀 영상이 크게 잘려 보였다
// (사용자 제보 — 코르티스 성현 가요대제전 직캠, 모바일 브라우즈 모드).
//
// 무엇을 확인하는가(모바일 390px):
//  ① 옛 저장분이 남아 있어도 가로 영상은 가로 틀로 열린다(저장분은 지워진다).
//  ② 회전 버튼은 지금 영상에는 그대로 먹는다(세로 틀).
//  ③ 닫고 다시 열면 가로 틀로 돌아온다.
//  ④ 진짜 쇼츠는 여전히 세로 틀.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료(프로세스명 일괄 kill 금지). 브라우저가 없으면 스킵.
// 실행: node tests/lb-rotate-no-persist.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8973, CDP_PORT = 9373;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-lbr-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', '--no-sandbox', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[lb-rotate-no-persist] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    const VID = '4Hyx7TZ2cXg'; // 제보 영상(가로 직캠)
    // 옛 버전이 남긴 저장분을 심어두고 다시 연다
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(2500);
    await ev(cdp, `(localStorage.setItem('kpu_lb_portrait_vids',JSON.stringify(['${VID}'])),1)`);
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(6000);
    if (!(await ev(cdp, `typeof openLightbox==='function'`))) { bad('앱 미준비'); throw new Error('미준비'); }
    ok('앱 로드');
    const st = `JSON.stringify({box:document.getElementById('yt-lb-video-box').classList.contains('is-shorts'),
      lb:document.getElementById('yt-lightbox').classList.contains('lb-shorts'),
      stored:localStorage.getItem('kpu_lb_portrait_vids')})`;
    const open = async (u, sh) => { await ev(cdp, `(openLightbox('${u}',${sh}),1)`); await sleep(700); return JSON.parse(await ev(cdp, st)); };
    const close = async () => { await ev(cdp, `(closeLightbox(),1)`); await sleep(500); };

    let s = await open(`https://www.youtube.com/watch?v=${VID}`, false);
    if (!s.box && !s.lb) ok('① 옛 저장분이 있어도 가로 틀로 열림'); else bad(`① 세로 틀로 열림 ${JSON.stringify(s)}`);
    if (s.stored === null) ok('① 옛 저장분 삭제됨'); else bad(`① 저장분 남음 ${s.stored}`);

    await ev(cdp, `(document.getElementById('yt-lb-rotate').click(),1)`); await sleep(400);
    s = JSON.parse(await ev(cdp, st));
    if (s.box) ok('② 회전 버튼은 지금 영상에 적용'); else bad('② 회전 버튼이 안 먹음');
    if (s.stored === null) ok('② 회전해도 저장 안 함'); else bad(`② 저장됨 ${s.stored}`);
    await close();

    s = await open(`https://www.youtube.com/watch?v=${VID}`, false);
    if (!s.box && !s.lb) ok('③ 다시 열면 가로 틀'); else bad(`③ 세로 틀이 남음 ${JSON.stringify(s)}`);
    await close();

    s = await open('https://youtube.com/shorts/aaaaaaaaaa3', true);
    if (s.box) ok('④ 쇼츠는 세로 틀'); else bad('④ 쇼츠가 가로 틀');
  } catch (e) {
    bad('예외: ' + e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
