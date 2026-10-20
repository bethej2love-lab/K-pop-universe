// 영상창 뒤로가기 순서 회귀 테스트 (2026-10-20, Codex 모바일 점검 P1)
//
// 예전엔 영상창이 브라우저 기록에 안 남아서, 카드→영상에서 뒤로가기를 누르면 밑의 카드가 먼저 닫히고
// 영상만 남았다(그다음 영상을 닫으면 우주로 떨어짐). 이제 영상창이 기록 한 칸을 갖는다.
//
// 무엇을 확인하는가(모바일 390px):
//  ① 카드→영상→뒤로가기 = 영상만 닫힘, 카드·주소 유지 → 한 번 더 = 카드 닫힘
//  ② 닫기 버튼으로 영상 닫은 뒤 뒤로가기 한 번 = 카드 닫힘(헛누름 없음)
//  ③ 닫자마자 다른 영상 열기 → 뒤로가기 = 영상만 닫힘
//  ④ 카드 없이 우주에서 연 영상 → 뒤로가기 = 영상 닫힘
//  ⑤ 영상창에서 다음 영상으로 3번 넘긴 뒤 뒤로가기 한 번 = 영상 닫힘, 카드 유지(넘길 때마다 기록이 쌓이지 않음)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료(프로세스명 일괄 kill 금지). 브라우저가 없으면 스킵.
// 실행: node tests/lb-history-back.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8977, CDP_PORT = 9377;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-lbh-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[lb-history-back] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(7000);
    if (!(await ev(cdp, `typeof openLightbox==='function'&&typeof showT==='function'&&ARTISTS.length>0`))) { bad('앱 미준비'); throw new Error('미준비'); }
    ok('앱 로드');
    const pickArtist = `ARTISTS.find(a=>a.name&&a.name.ko==='카리나'&&a.group&&a.group.ko==='에스파')||ARTISTS.find(a=>a._worldPos&&a.group&&GROUPS[a.group.ko])`;
    const st = async () => JSON.parse(await ev(cdp, `JSON.stringify({lb:document.getElementById('yt-lightbox').classList.contains('open')&&!document.getElementById('yt-lightbox').classList.contains('lb-closing'),cards:_cardStack.length,hash:decodeURIComponent(location.hash)})`));
    const back = async () => { await ev(cdp, `(history.back(),1)`); await sleep(900); };
    const card = async () => { await ev(cdp, `(showT(${pickArtist}),1)`); await sleep(1200); };
    const lbOpen = async id => { await ev(cdp, `(openLightbox('https://www.youtube.com/watch?v=${id}',false),1)`); await sleep(900); };

    // ①
    await card(); let s0 = await st();
    if (s0.cards > 0 && s0.hash.includes('m=')) ok(`카드 열림 ${s0.hash}`); else bad(`카드 미오픈 ${JSON.stringify(s0)}`);
    await lbOpen('4Hyx7TZ2cXg');
    await back(); let s = await st();
    if (!s.lb && s.cards > 0 && s.hash === s0.hash) ok('① 뒤로가기 = 영상만 닫힘, 카드·주소 유지'); else bad(`① ${JSON.stringify(s)}`);
    await back(); s = await st();
    if (s.cards === 0 && !s.hash) ok('① 한 번 더 = 카드 닫힘'); else bad(`① 두 번째 ${JSON.stringify(s)}`);

    // ②
    await card(); await lbOpen('rQqk4OqDlvk');
    await ev(cdp, `(closeLightbox(),1)`); await sleep(900); s = await st();
    if (!s.lb && s.cards > 0) ok('② 닫기 버튼 = 카드 유지'); else bad(`② 닫기 후 ${JSON.stringify(s)}`);
    await back(); s = await st();
    if (s.cards === 0) ok('② 다음 뒤로가기 한 번에 카드 닫힘(헛누름 없음)'); else bad(`② ${JSON.stringify(s)}`);

    // ③
    await card();
    await ev(cdp, `(openLightbox('https://www.youtube.com/watch?v=4Hyx7TZ2cXg',false),closeLightbox(),openLightbox('https://www.youtube.com/watch?v=rQqk4OqDlvk',false),1)`); await sleep(1200);
    s = await st(); if (s.lb) ok('③ 닫자마자 다시 연 영상창 열림'); else bad('③ 영상창이 안 열림');
    await back(); s = await st();
    if (!s.lb && s.cards > 0) ok('③ 뒤로가기 = 영상만 닫힘'); else bad(`③ ${JSON.stringify(s)}`);
    await back();

    // ④
    await ev(cdp, `(closeCards(),1)`); await sleep(600);
    await lbOpen('4Hyx7TZ2cXg');
    await back(); s = await st();
    if (!s.lb && s.cards === 0) ok('④ 우주에서 연 영상 뒤로가기 = 영상 닫힘'); else bad(`④ ${JSON.stringify(s)}`);

    // ⑤
    await card();
    const pl = JSON.stringify(['4Hyx7TZ2cXg','rQqk4OqDlvk','4Hyx7TZ2cXg','rQqk4OqDlvk'].map(id=>({u:'https://www.youtube.com/watch?v='+id,t:id})));
    await ev(cdp, `(openLightbox('https://www.youtube.com/watch?v=4Hyx7TZ2cXg',false,${pl},0,{}),1)`); await sleep(900);
    for (let i = 0; i < 3; i++) { await ev(cdp, `(_lbGo(1),1)`); await sleep(700); }
    await back(); s = await st();
    if (!s.lb && s.cards > 0) ok('⑤ 3번 넘긴 뒤 뒤로가기 한 번 = 영상 닫힘, 카드 유지'); else bad(`⑤ ${JSON.stringify(s)}`);
  } catch (e) {
    bad('예외: ' + e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
