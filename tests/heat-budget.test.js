// 발열 예산 테스트 (2026-09-28) — 화면별로 "안 보이는 일"을 하고 있지 않은지 실측한다.
//
// 발열은 이 앱에서 계속 재발한다(8/13 3D·8/28 영상·8/31 차트목록·9/22 스피너·9/28 탐험 패널). 매번 원인은
// 같은 부류였다: **화면에 안 보이는데 계속 돌아가는 것** — 가려진 3D 렌더, opacity:0 스피너, 화면 밖 카드
// 200여 개의 무한 셔머. 기능 테스트는 전부 초록인데 폰만 뜨거워서, 사용자가 실기기에서 느끼고 나서야 알았다.
// 이 테스트는 그 부류를 숫자로 고정한다 — 새 기능이 무한 애니나 가려진 렌더를 다시 들여오면 여기서 빨개진다.
// 기준·근거·화면별 최근 실측은 PERFORMANCE.md "화면별 추적표". 새 화면(오버레이)을 만들면 여기 한 칸 추가할 것.
//
// ⚠️ 헤드리스는 GPU 없이 소프트웨어로 그려서 CPU%·fps는 의미가 없다. 보는 건 **렌더 호출 수**와
//    **돌고 있는 CSS 애니메이션 수**(document.getAnimations)뿐 — 둘 다 기기와 무관한 "하고 있는 일의 양"이다.
// ⚠️ 브라우저 필요 → CI skip 목록(data-and-tests.yml)에 들어 있다. 로컬에서 발열 관련 수정 뒤 돌릴 것.
// 실행: node tests/heat-budget.test.js
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

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 발열 예산 테스트 스킵'); process.exit(pass ? 0 : 1); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-heat-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--ignore-certificate-errors', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[heat-budget] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  const errors = [];
  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    cdp.send('Runtime.enable');
    // 선반 실패는 console.warn으로만 남는다(예외를 삼키되 흔적은 남기는 방침) — 그 경고를 잡아야
    // "조용히 빈 선반"을 테스트가 알아챈다.
    cdp.on('Runtime.consoleAPICalled', p => {
      if (p.type === 'warning' || p.type === 'error') {
        errors.push((p.args || []).map(a => a.value || a.description || '').join(' '));
      }
    });
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
      if (!r) return undefined;
      if (r.exceptionDetails) { errors.push((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return undefined; }
      return r.result && r.result.value;
    };
    for (let i = 0; i < 40; i++) { if (await ev("typeof _openFeedOverlay==='function'")) break; await sleep(400); }

    // 탐험 패널을 실제로 연다(선반 렌더는 패널 오픈 시점에 돈다)
    await ev(`document.getElementById('tab-feed')?.click()`);
    await sleep(3500);

    await sleep(3000);
    await cdp.send("Performance.enable");
    await ev(`(function(){if(window.__wr)return;window.__rc=0;const o=renderer.render.bind(renderer);renderer.render=function(){window.__rc++;return o.apply(null,arguments)};window.__wr=1;})()`);
    async function measure(label,during){
      const m0=Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m=>[m.name,m.value]));
      const r0=await ev("window.__rc");const T=6000;const t0=Date.now();
      if(during)await during(T);else await sleep(T);
      const m1=Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(m=>[m.name,m.value]));
      const r1=await ev("window.__rc");const s=(Date.now()-t0)/1000;
      const info=JSON.parse(await ev(`JSON.stringify({anims:document.getAnimations().filter(a=>a.playState==="running").length,animEls:[...new Set(document.getAnimations().filter(a=>a.playState==="running").map(a=>(a.effect&&a.effect.target&&(a.effect.target.id||a.effect.target.className||a.effect.target.tagName))+"").map(x=>x.slice(0,40)))].slice(0,8),bf:[...document.querySelectorAll("*")].filter(e=>{const c=getComputedStyle(e);return (c.backdropFilter&&c.backdropFilter!=="none")&&e.offsetParent!==null}).map(e=>e.id||e.className.toString().slice(0,30)).slice(0,10),canvasVis:renderer.domElement.style.visibility||"visible",cls:document.getElementById("feed-overlay").className})`));
      const row={label,render:(r1-r0)/s,recalc:(m1.RecalcStyleCount-m0.RecalcStyleCount)/s,anims:info.anims,animEls:info.animEls,blur:info.bf,cls:info.cls};console.log(JSON.stringify(row));return row;
    }
    await ev(`(function(){const o=document.getElementById("feed-overlay");o.classList.remove("open","peek");})()`);await sleep(1500);
    const H=await measure("home");
    await ev(`_openFeedOverlay()`);await sleep(3000);
    await ev(`document.getElementById("feed-overlay").classList.add("peek")`);await sleep(1500);
    const P=await measure("feed peek");
    await ev(`document.getElementById("feed-overlay").classList.remove("peek")`);await sleep(1500);
    const F=await measure("feed full");
    const FS=await measure("full+scroll",async T=>{const n=T/100;for(let i=0;i<n;i++){await ev(`(function(){const b=document.getElementById("feed-body");b.scrollTop+=${i%40<20?60:-60};})()`);await sleep(100);}});

    // ── 예산 판정 ── 기준과 근거는 PERFORMANCE.md "화면별 추적표"
    if(!/open/.test(F.cls)||/peek/.test(F.cls))fail(`[준비] 탐험 패널 전체 열림 상태를 못 만듦(${F.cls})`);
    else {
      F.render===0?ok("[탐험 전체] 3D 렌더 0 — 화면을 다 덮으면 뒤 우주를 안 그림"):fail(`[탐험 전체] 3D 렌더 ${F.render.toFixed(1)}/s — 다 덮였는데 그리고 있음`);
      F.anims<=6?ok(`[탐험 전체] 도는 애니 ${F.anims}개(≤6)`):fail(`[탐험 전체] 도는 애니 ${F.anims}개 > 6 — ${JSON.stringify(F.animEls)}`);
      FS.anims<=12?ok(`[탐험 전체+스크롤] 도는 애니 ${FS.anims}개(≤12)`):fail(`[탐험 전체+스크롤] 도는 애니 ${FS.anims}개 > 12 — ${JSON.stringify(FS.animEls)}`);
    }
    P.anims<=12?ok(`[탐험 peek] 도는 애니 ${P.anims}개(≤12)`):fail(`[탐험 peek] 도는 애니 ${P.anims}개 > 12 — ${JSON.stringify(P.animEls)} (화면 밖 요소가 무한 애니를 돌리는지 볼 것)`);
    H.anims<=6?ok(`[홈] 도는 애니 ${H.anims}개(≤6)`):fail(`[홈] 도는 애니 ${H.anims}개 > 6 — ${JSON.stringify(H.animEls)}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 발열 예산 테스트 통과' : '\n💥 발열 예산 테스트 실패');
  process.exit(0);
}

main();
