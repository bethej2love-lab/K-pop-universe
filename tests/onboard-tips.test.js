// 첫 방문 안내 테스트 (2026-10-20 사용자 — "Who's your bias 안내가 먼저, 행성 툴팁은 그다음" + 툴팁 디자인 개편)
//  ① 최애 찾기(검색창) → ② 행성(실제 행성을 비춤) → ③ 탐험 → ④ 나, 글 상자는 화면 안 · ⑤ 안내 중 카드를 열면 안내 종료
//  PC 1280·폰 390
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저 없으면 스킵. 실행: node tests/onboard-tips.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8990, CDP_PORT = 9390;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-obt-'));
  const proc = spawn(BROWSER_PATH, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  console.log(`[onboard-tips] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');

    for (const [tag, w, h, mobile] of [['pc', 1280, 800, false], ['mob', 390, 844, true]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` }); await sleep(2000);
      await ev(cdp, `(localStorage.clear(),sessionStorage.clear(),location.reload(),1)`); await sleep(9000);
      const st = () => ev(cdp, `(()=>{const e=document.getElementById('ob-tips'),b=document.getElementById('ob-tips-box').getBoundingClientRect(),g=document.getElementById('ob-tips-ring').getBoundingClientRect();
        return{show:!e.hidden&&e.classList.contains('show'),step:_TIPS_STEP,t:_TIPS_STEPS[_TIPS_STEP]&&_TIPS_STEPS[_TIPS_STEP].t,
          box:{l:b.left,t:b.top,r:b.right,b:b.bottom},ring:{x:(g.left+g.right)/2,y:(g.top+g.bottom)/2,w:g.width},vw:innerWidth,vh:innerHeight};})()`);
      const inView = s => s.box.l >= 0 && s.box.t >= 0 && s.box.r <= s.vw && s.box.b <= s.vh;
      const near = async (s, id) => ev(cdp, `(()=>{const ids=${JSON.stringify(id)};for(const i of ids){const el=document.getElementById(i);if(!el)continue;const r=el.getBoundingClientRect();if(r.width>0&&Math.abs((r.left+r.right)/2-${'${x}'})<4&&Math.abs((r.top+r.bottom)/2-${'${y}'})<4)return i;}return null;})()`.replace('${x}', s.ring.x).replace('${y}', s.ring.y));
      let s = await st();
      // ① 첫 단계 = 최애 찾기(검색창을 가리킴)
      const t1 = s.show && s.step === 0 && s.t === 'search' ? await near(s, ['ob-top-search', 'dh-search-btn', 'tab-search']) : null;
      if (t1 && inView(s)) ok(`[${tag}] ① 첫 안내 = 최애 찾기, 검색창(${t1})을 비춤`); else bad(`[${tag}] ① ${JSON.stringify(s)} target=${t1}`);
      // ② 둘러볼게요 → 행성 단계, 실제 행성을 비춤
      await ev(cdp, `(document.getElementById('ob-tips-prev').click(),1)`); await sleep(900); s = await st();
      const pl = await ev(cdp, `(()=>{if(!_tipPlanet)return null;const p=_tipPlanet.mesh.position.clone().project(camera);return{x:(p.x+1)/2*innerWidth,y:(1-p.y)/2*innerHeight,ko:_tipPlanet.ko};})()`);
      if (s.step === 1 && s.t === 'planet' && pl && Math.abs(pl.x - s.ring.x) < 6 && Math.abs(pl.y - s.ring.y) < 6 && inView(s)) ok(`[${tag}] ② 둘째 = 행성(${pl.ko})을 비춤, 글은 화면 안`); else bad(`[${tag}] ② ${JSON.stringify(s)} pl=${JSON.stringify(pl)}`);
      // ③ 탐험 → ④ 나
      await ev(cdp, `(document.getElementById('ob-tips-next').click(),1)`); await sleep(900); s = await st();
      const t3 = await near(s, ['tab-feed', 'dh-feed-btn']);
      await ev(cdp, `(document.getElementById('ob-tips-next').click(),1)`); await sleep(900); const s4 = await st();
      const t4 = await near(s4, ['tab-profile', 'dh-profile-btn']);
      if (t3 && t4 && inView(s) && inView(s4)) ok(`[${tag}] ③④ 탐험(${t3})·나(${t4}) 순서`); else bad(`[${tag}] ③④ ${t3} ${t4} ${JSON.stringify(s4)}`);
      // ⑤ 안내 중 행성을 눌러 카드가 열리면 안내 끝
      await ev(cdp, `(_prevTip(),_prevTip(),1)`); await sleep(900);
      await ev(cdp, `(showGC(_tipPlanet.ko,innerWidth/2,innerHeight*.4),1)`); await sleep(2500);
      const done = await ev(cdp, `({show:document.getElementById('ob-tips').classList.contains('show'),done:localStorage.getItem('kpu_tips_v1')})`);
      if (!done.show && done.done === '1') ok(`[${tag}] ⑤ 안내 중 카드를 열면 안내 종료·다시 안 뜸`); else bad(`[${tag}] ⑤ ${JSON.stringify(done)}`);
    }
  } catch (e) { bad('예외: ' + e.message); } finally { try { proc.kill(); } catch (e) {} server.close(); }
  console.log(`
${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
