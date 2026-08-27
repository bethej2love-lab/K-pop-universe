// PWA(홈 화면 추가) 상단 세이프에어리어 회귀 테스트 (2026-08-27)
//
// 사고: 웹앱으로 열면 카드의 '이전'(뒤로가기) 버튼이 화면 왼쪽 꼭대기에 혼자 붙어서 누를 수 없었다.
//
// 원인: 시트가 화면을 꽉 채울 때(bs-full) 시트엔 상단 세이프에어리어만큼 padding-top이 붙는데,
//       이 버튼들은 `position:absolute; top:0`이었다. absolute의 top:0은 **padding box가 아니라
//       border edge 기준**이라, 손잡이(#mob-sheet-handle, 일반 흐름)는 노치 아래로 밀려나는데
//       버튼만 노치 밑에 그대로 남는다. 브라우저에선 env(safe-area-inset-top)이 0이라 둘이 나란해
//       보이고, **PWA에서만** 드러났다. '영상으로 돌아가기' 버튼도 같은 top:0이라 같이 깨져 있었다.
//
// ⚠️ 이 버그가 왜 테스트로 못 잡히고 있었나: env()는 헤드리스/데스크톱에서 항상 0이라 노치 상황을
//    재현할 방법이 없었다. 그래서 값의 출처를 `--safe-top` 변수 하나로 묶었고(kpop_universe.css),
//    이 테스트는 그 변수만 덮어써서 노치가 있는 기기를 그대로 흉내낸다.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/pwa-safearea.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8958, CDP_PORT = 9358;
const SAFE_TOP = 47; // 아이폰 노치 계열의 대표값
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
const ok = m => console.log(`✅ ${m}`);
const fail = m => { pass = false; console.log(`❌ ${m}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 스킵'); process.exit(0); }

  // ── 정적 검사: 값의 출처가 하나로 묶여 있는가 ──────────────────────────────
  const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');
  const has = (re, m) => re.test(css) ? ok(m) : fail(m);
  has(/:root\{--safe-top:env\(safe-area-inset-top,0px\);\}/, '--safe-top이 env(safe-area-inset-top)로 정의됨');
  has(/#mob-sheet\.bs-full\{[^}]*padding-top:var\(--safe-top\)/, '#mob-sheet.bs-full의 padding-top이 --safe-top');
  has(/#mob-card-stack\.bs-full\{[^}]*padding-top:var\(--safe-top\)/, '#mob-card-stack.bs-full의 padding-top이 --safe-top');
  has(/#mob-sheet\.bs-full>\.sheet-back-btn[\s\S]{0,220}?top:var\(--safe-top\)/, '뒤로가기/영상복귀 버튼의 top도 같은 --safe-top');
  // env()를 이 네 곳에서 직접 쓰면 또 갈라진다
  const strayEnv = (css.match(/\.bs-full[^{]*\{[^}]*env\(safe-area-inset-top/g) || []).length;
  strayEnv === 0 ? ok('bs-full 규칙들이 env()를 직접 쓰지 않음(전부 --safe-top 경유)')
    : fail(`bs-full 규칙에 env() 직접 사용 ${strayEnv}곳 — 값 출처가 갈라짐`);

  // ── 동적 검사: --safe-top을 덮어써 노치 기기를 재현 ────────────────────────
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(d); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-safe-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[pwa-safearea] 헤드리스 브라우저 PID=${child.pid}`);
  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await new Promise((resolve, reject) => {
      const ws = new WebSocket(webSocketDebuggerUrl); let id = 0; const pend = new Map();
      ws.addEventListener('open', () => resolve({ send: (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); }) }));
      ws.addEventListener('error', reject);
      ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
    });
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 50; i++) { if (await ev("typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&typeof showT==='function'")) break; await sleep(500); }

    // 노치 재현 + 카드를 꽉 찬 상태로 띄우고 뒤로가기 버튼을 강제 노출(스택 없이도 위치 검증 가능하게)
    await ev(`document.documentElement.style.setProperty('--safe-top','${SAFE_TOP}px')`);
    await ev("showT(ARTISTS.find(a=>a.name.ko==='카리나'))");
    await sleep(5000);
    await ev(`(function(){
      var s=document.getElementById('mob-sheet'); if(s)s.classList.add('bs-full');
      var b=document.getElementById('mob-sheet-back'); if(b)b.classList.add('on');
      var t=document.getElementById('mob-sheet-tovid'); if(t)t.style.display='flex';
      return 1;})()`);
    await sleep(500);

    const geo = JSON.parse(await ev(`(function(){
      var s=document.getElementById('mob-sheet'), b=document.getElementById('mob-sheet-back'),
          h=document.getElementById('mob-sheet-handle'), t=document.getElementById('mob-sheet-tovid');
      var sr=s.getBoundingClientRect(), br=b.getBoundingClientRect(), hr=h.getBoundingClientRect(), tr=t.getBoundingClientRect();
      return JSON.stringify({
        sheetTop:Math.round(sr.top), pad:Math.round(parseFloat(getComputedStyle(s).paddingTop)),
        backTop:Math.round(br.top), backH:Math.round(br.height), backW:Math.round(br.width),
        handleTop:Math.round(hr.top), tovidTop:Math.round(tr.top)
      });})()`) || '{}');
    console.log('  측정:', JSON.stringify(geo));

    if (geo.pad === SAFE_TOP) ok(`시트가 상단 세이프에어리어만큼 padding 확보 (${geo.pad}px)`);
    else fail(`시트 padding-top이 ${geo.pad}px (기대 ${SAFE_TOP})`);

    // 핵심: 버튼이 노치 영역 아래에 있는가 = 시트 상단 + 세이프에어리어 이상
    const need = geo.sheetTop + SAFE_TOP;
    if (geo.backTop >= need) ok(`'이전' 버튼이 노치 아래에 있음 (top ${geo.backTop} ≥ ${need})`);
    else fail(`'이전' 버튼이 노치 밑에 깔림 — top ${geo.backTop} < ${need} (수정 전 증상)`);
    if (geo.tovidTop >= need) ok(`'영상으로 돌아가기' 버튼도 노치 아래에 있음 (top ${geo.tovidTop})`);
    else fail(`'영상으로 돌아가기' 버튼이 노치 밑에 깔림 — top ${geo.tovidTop} < ${need}`);

    // 손잡이 줄과 같은 줄에 있어야 한다(원래 디자인 — 버튼만 따로 노는 게 이번 사고였다)
    if (Math.abs(geo.backTop - geo.handleTop) <= 14) ok(`버튼이 손잡이 줄과 같은 줄 (차이 ${Math.abs(geo.backTop - geo.handleTop)}px)`);
    else fail(`버튼이 손잡이와 따로 놈 — 버튼 ${geo.backTop} vs 손잡이 ${geo.handleTop}`);

    // 터치 타깃(애플 HIG 최소 44)도 같이 못 박는다 — Fable이 의심했던 지점
    if (geo.backW >= 44 && geo.backH >= 44) ok(`터치 타깃 ${geo.backW}×${geo.backH} (최소 44 충족)`);
    else fail(`터치 타깃이 작음 — ${geo.backW}×${geo.backH}`);
  } finally {
    server.close();
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`); else child.kill('SIGKILL'); } catch (e) { }
    for (let i = 0; i < 3; i++) { try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch (e) { await sleep(300); } }
  }
  console.log(pass ? '\n✅ PWA 세이프에어리어 테스트 통과' : '\n❌ PWA 세이프에어리어 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('[pwa-safearea] 실행 실패:', e); process.exit(2); });
