// 모바일 검색 풀스크린 시트 회귀 테스트 (2026-09-02 신설)
//
// 왜: 예전 모바일 검색은 탭바가 검색창으로 변형되고 결과가 탭바 위 **180px 상자**(#mob-sr)에 떴다.
// 항목 하나가 ~30px이라 결과 타입이 5종(그룹·멤버·곡·영상·공연)으로 늘고 섹션 헤더까지 들어가면
// 실제로 보이는 건 3~4개뿐이었고, 서버에서 늦게 도착하는 영상 결과는 맨 아래 붙어 존재조차 몰랐다.
//
// 무엇을 확인하는가:
//  [1] 탭바 검색 버튼 → 풀스크린 시트가 열리고, 입력창에 포커스가 간다
//  [2] 검색 결과가 시트 본문에 그려지고 **화면 높이를 실제로 쓴다**(옛 180px 상자 회귀 방지)
//  [3] 타입 탭이 결과 있는 타입만 생기고, 탭을 누르면 그 타입만 남는다
//  [4] 결과 항목에 data-type이 붙는다(탭 필터가 이걸로 센다 — 없으면 필터가 통째로 무력화)
//  [5] 닫으면 시트가 사라지고 입력이 비워진다
//  [6] 시트가 _FULLSCREEN_OVERLAY_IDS·탐험 패널 capture 제외 목록에 등록돼 있다(소스 검사)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/msheet.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8943;
const CDP_PORT = 9343;
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
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
  throw new Error('CDP 포트가 안 열림');
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
  while (Date.now() - t0 < timeoutMs) { const v = await ev(cdp, expr); if (isReady(v)) return v; await sleep(120); }
  return await ev(cdp, expr);
}

function sourceChecks() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (/_FULLSCREEN_OVERLAY_IDS=\[[\s\S]{0,400}'msheet'/.test(html)) ok('[6] _FULLSCREEN_OVERLAY_IDS에 등록됨(열려 있으면 3D 렌더 스킵)');
  else fail('[6] _FULLSCREEN_OVERLAY_IDS에 msheet 없음 — 시트가 화면을 덮는데 뒤에서 3D를 계속 그린다');
  if (/closest\('#feed-overlay[^)]*#msheet'\)/.test(html)) ok('[6] 탐험 패널 자동닫힘 capture 제외 목록에 등록됨');
  else fail('[6] 탐험 패널 capture 제외 목록에 #msheet 없음 — 시트 안을 눌러도 탐험 패널이 닫힌다');
}

async function main() {
  sourceChecks();
  if (!BROWSER_PATH) { console.log('⚠️  브라우저 없음 — 브라우저 검증 스킵'); console.log(pass ? '\n✅ 통과(소스 검사만)' : '\n💥 실패'); process.exit(pass ? 0 : 1); }

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-msheet-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[msheet] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);
    await pollUntil(cdp, `typeof ARTISTS!=='undefined'&&ARTISTS.length>0`, 20000);
    await sleep(600);

    // [1] 검색 버튼 → 시트 열림
    await ev(cdp, `document.getElementById('tab-search').click()`);
    const opened = await pollUntil(cdp, `(function(){var e=document.getElementById('msheet');return !!e&&e.classList.contains('open');})()`, 4000);
    if (!opened) fail('[1] 검색 버튼을 눌러도 시트가 안 열림');
    else ok('[1] 검색 버튼 → 풀스크린 시트 열림');
    const focused = await pollUntil(cdp, `document.activeElement&&document.activeElement.id==='msheet-input'`, 2500);
    if (!focused) fail('[1] 입력창에 포커스가 안 감(키보드가 안 올라온다)');
    else ok('[1] 입력창 자동 포커스');

    // 시트가 화면을 실제로 덮는지 — 옛 180px 상자 회귀 방지
    const box = await ev(cdp, `(function(){var e=document.getElementById('msheet');var r=e.getBoundingClientRect();
      var b=document.getElementById('msheet-body').getBoundingClientRect();
      return {h:Math.round(r.height),w:Math.round(r.width),bodyH:Math.round(b.height),vh:window.innerHeight};})()`);
    if (!box || box.h < box.vh * 0.9) fail(`[2] 시트가 화면을 안 덮음 (${box && box.h}px / 뷰포트 ${box && box.vh}px)`);
    else ok(`[2] 시트가 화면 전체 (${box.h}×${box.w}, 본문 ${box.bodyH}px — 옛 상자는 180px였다)`);

    // [2][4] 검색 실행
    await ev(cdp, `(function(){var i=document.getElementById('msheet-input');i.value='아이브';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const n = await pollUntil(cdp, `document.querySelectorAll('#msheet-body .sr-item').length`, 4000, v => v > 0);
    if (!n) fail('[2] 검색 결과가 시트 본문에 안 그려짐');
    else ok(`[2] 결과 ${n}건이 시트 본문에 렌더`);
    const typed = await ev(cdp, `document.querySelectorAll('#msheet-body .sr-item[data-type]').length`);
    if (typed !== n) fail(`[4] data-type 없는 항목이 있음 (${typed}/${n}) — 탭 필터가 무력화된다`);
    else ok(`[4] 결과 ${typed}건 전부 data-type 부여됨`);

    // [3] 타입 탭
    const tabs = await ev(cdp, `[...document.querySelectorAll('.msheet-tab')].map(b=>b.dataset.k)`);
    if (!Array.isArray(tabs) || !tabs.length) fail('[3] 타입 탭이 안 생김');
    else if (tabs[0] !== 'all') fail(`[3] 첫 탭이 '전체'가 아님: ${JSON.stringify(tabs)}`);
    else ok(`[3] 타입 탭 생성: ${tabs.join(' · ')}`);

    // 아티스트 탭을 눌러 그 타입만 남는지
    if (Array.isArray(tabs) && tabs.includes('artist')) {
      await ev(cdp, `[...document.querySelectorAll('.msheet-tab')].find(b=>b.dataset.k==='artist').click()`);
      await sleep(200);
      // ⚠️ el.hidden(속성)이 아니라 **실제로 그려지는지**를 본다. HTML [hidden]은 UA 스타일의
      // display:none이라 저자 스타일(.sr-item{display:flex})에 지므로, 속성만 확인하면 화면엔
      // 그대로 보이는데 테스트는 통과한다(2026-09-02에 실제로 그렇게 통과시켰고 스크린샷으로 발견).
      const vis = await ev(cdp, `(function(){var o={};document.querySelectorAll('#msheet-body .sr-item[data-type]').forEach(function(el){
        if(el.offsetParent===null||getComputedStyle(el).display==='none')return;
        var t=el.dataset.type;o[t]=(o[t]||0)+1;});return o;})()`);
      const keys = Object.keys(vis || {});
      const onlyArtist = keys.length && keys.every(k => k === 'group' || k === 'member');
      if (!onlyArtist) fail(`[3] 아티스트 탭인데 다른 타입이 보임: ${JSON.stringify(vis)}`);
      else ok(`[3] 아티스트 탭 필터 동작 (보이는 것: ${JSON.stringify(vis)})`);
    }

    // [7] 그룹→멤버 확장 + 공백 토큰(2026-09-02)
    // "뉴진스"를 치면 그룹 한 줄만 나오고 멤버는 안 나왔다. 공백 쿼리는 ko.includes("뉴진스 하니")가
    // 거짓이라 그룹 매칭 자체가 실패해 확장도 안 돌았다(영상만 나옴).
    const probe = async (q) => {
      await ev(cdp, `(function(){var i=document.getElementById('msheet-input');i.value=${JSON.stringify(q)};i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await sleep(700);
      return await ev(cdp, `(function(){var o=[];document.querySelectorAll('#msheet-body .sr-item[data-type]').forEach(function(el){
        if(getComputedStyle(el).display==='none')return;
        var n=el.querySelector('.sr-item-name');o.push({t:el.dataset.type,n:(n?n.textContent.trim():'')});});return o;})()`);
    };
    const r1 = await probe('뉴진스');
    const mem1 = (r1 || []).filter(x => x.t === 'member').map(x => x.n);
    if (mem1.length < 3) fail(`[7] 그룹명 검색에 멤버가 안 딸려옴 (멤버 ${mem1.length}명: ${mem1.join(',')})`);
    else ok(`[7] "뉴진스" → 멤버 ${mem1.length}명 확장 (${mem1.slice(0, 5).join(' · ')})`);

    const r2 = await probe('뉴진스 하니');
    const mem2 = (r2 || []).filter(x => x.t === 'member').map(x => x.n);
    if (mem2.length !== 1 || !/하니/.test(mem2[0] || '')) fail(`[7] "뉴진스 하니"가 한 명으로 안 좁혀짐: ${JSON.stringify(mem2)}`);
    else ok(`[7] "뉴진스 하니" → ${mem2[0]} 한 명으로 좁혀짐`);

    // 짧은 쿼리까지 확장하면 결과가 폭발한다 — 확장은 2자 이상 + 정확·접두 매칭에서만 돈다.
    // ⚠️ "그룹이 결과에 뜨는 것" 자체는 정상이다(스텔라 등 이름이 직접 걸린 것). 확인할 건
    //    **그 그룹의 멤버가 통째로 딸려왔는지**뿐이라, 확장된 항목에만 붙는 data-expanded로 센다.
    await ev(cdp, `(function(){var i=document.getElementById('msheet-input');i.value='스';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(700);
    const exp3 = await ev(cdp, `document.querySelectorAll('#msheet-body .sr-item[data-expanded]').length`);
    if (exp3 > 0) fail(`[7] 1글자 쿼리인데 그룹 멤버가 ${exp3}명 딸려옴(결과 폭발)`);
    else ok('[7] 1글자 쿼리는 그룹 확장 안 함(결과 폭발 방지)');

    // [8] 동점 타이브레이커 — 활동 중 > 해체(2026-09-02)
    // "에이"는 가나다순이면 에이스(해체)가 2번째로 올라온다. 활동 중인 그룹이 전부 앞서야 한다.
    // ⚠️ 매칭 등급은 안 건드리므로 "아이즈원"을 정확히 치면 여전히 맨 위다(등급이 동점일 때만 갈린다).
    await ev(cdp, `(function(){var i=document.getElementById('msheet-input');i.value='에이';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(700);
    const order = await ev(cdp, `[...document.querySelectorAll('#msheet-body .sr-item[data-type="group"]')]
      .filter(function(el){return getComputedStyle(el).display!=='none';})
      .map(function(el){var n=el.querySelector('.sr-item-name');return n?n.textContent.trim():'';})`);
    const OVER = ['에이스', '에이프릴'];
    const idxOver = (order || []).findIndex(n => OVER.includes(n));
    const idxLastActive = (order || []).reduce((acc, n, i) => OVER.includes(n) ? acc : i, -1);
    if (idxOver < 0) ok('[8] (해체 그룹이 결과에 없어 순서 검증 생략)');
    else if (idxOver < idxLastActive) fail(`[8] 해체 그룹이 활동 중보다 앞: ${(order || []).join(' · ')}`);
    else ok(`[8] 활동 중 > 해체 정렬 (${(order || []).join(' · ')})`);

    // 정확 매칭은 타이브레이커와 무관하게 여전히 1위여야 한다(등급을 뒤집지 않았다는 확인)
    await ev(cdp, `(function(){var i=document.getElementById('msheet-input');i.value='아이즈원';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(700);
    const first = await ev(cdp, `(function(){var el=document.querySelector('#msheet-body .sr-item[data-type]');
      var n=el&&el.querySelector('.sr-item-name');return n?n.textContent.trim():'';})()`);
    if (!/아이즈원/.test(first || '')) fail(`[8] 해체 그룹이라도 정확 매칭이면 1위여야 함 (1위: "${first}")`);
    else ok('[8] 해체 그룹도 정확 매칭이면 1위 유지(등급은 안 뒤집힘)');

    // [5] 닫기
    await ev(cdp, `(function(){var i=document.getElementById('msheet-input');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(200);
    await ev(cdp, `document.getElementById('msheet-back').click()`);
    await sleep(250);
    const closed = await ev(cdp, `(function(){var e=document.getElementById('msheet');
      return {open:e.classList.contains('open'),val:document.getElementById('msheet-input').value};})()`);
    if (closed.open) fail('[5] 닫기 버튼을 눌러도 시트가 안 닫힘');
    else if (closed.val) fail('[5] 닫았는데 입력값이 남음');
    else ok('[5] 닫기 → 시트 사라지고 입력 초기화');

    cdp.close();
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
  }
  console.log(pass ? '\n✅ 검색 시트 테스트 통과' : '\n💥 검색 시트 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
