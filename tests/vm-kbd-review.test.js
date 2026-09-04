// 키보드 검수 — 회귀 테스트 (2026-09-04 신설, Fable 아카이브 운영 설계 8-1)
//
// 무엇을 지키는가: 이 단축키는 **DB에 쓰는 동작**(1~4 = content_flag 변경)이라, 가드가 하나라도
// 뚫리면 "검색창에 '2'를 쳤는데 영상이 무관 처리되는" 종류의 사고가 된다. 그래서 이동(j/k)보다
// **안 눌려야 할 때 안 눌리는가**가 이 테스트의 본체다.
//
// ⚠️ 헤드리스에서 `input.focus()`는 안 잡힌다(패널이 레이아웃상 안 보여 activeElement가 BODY로 남음).
//    처음에 그렇게 짰다가 "가드가 뚫렸다"고 잘못 판정했다 — 실제로는 이벤트가 INPUT을 거치지도
//    않았다. 그래서 대상 엘리먼트에서 **직접 dispatchEvent**로 target을 만들어 가드를 시험한다.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// ⚠️ 새 브라우저 테스트다 — `.github/workflows/data-and-tests.yml`의 skip(browser) 목록에도 넣을 것.
// 실행: node tests/vm-kbd-review.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8973;
const CDP_PORT = 9373;
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

const PROBE = `(function(){
  const send=(key,el,opt)=>(el||document.body).dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:key,bubbles:true,cancelable:true},opt||{})));
  const idx=()=>_vmFocusIdx;
  const out={};
  out.items=document.querySelectorAll('#vm-list .vm-item').length;
  eval('_vmFocusIdx = -1');
  send('j'); out.j1=idx();
  send('j'); out.j2=idx();
  send('k'); out.k1=idx();
  out.painted=document.querySelectorAll('#vm-list .vm-item.vm-kbd').length;
  const before=idx();
  send('j',document.getElementById('vm-search'));
  send('2',document.getElementById('vm-search'));
  out.guardInput=(idx()===before);
  const ta=document.createElement('textarea');document.body.appendChild(ta);
  send('j',ta); out.guardTextarea=(idx()===before); ta.remove();
  const ce=document.createElement('div');ce.contentEditable='true';document.body.appendChild(ce);
  send('j',ce); out.guardCe=(idx()===before); ce.remove();
  send('j',null,{ctrlKey:true}); out.guardCtrl=(idx()===before);
  document.getElementById('vid-tag-overlay').classList.add('open');
  send('j'); out.guardModal=(idx()===before);
  document.getElementById('vid-tag-overlay').classList.remove('open');
  document.getElementById('vm-overlay').classList.remove('open');
  send('j'); out.guardClosed=(idx()===before);
  document.getElementById('vm-overlay').classList.add('open');
  eval('_vmFocusIdx = -1');
  const chk0=document.querySelectorAll('#vm-list .vm-item input[type=checkbox]:checked').length;
  send('2');
  out.guardNoFocus=(document.querySelectorAll('#vm-list .vm-item input[type=checkbox]:checked').length===chk0 && idx()===-1);
  return JSON.stringify(out);
})()`;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 키보드 검수 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-vmkbd-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--ignore-certificate-errors', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[vm-kbd] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => {
      const r = await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
      if (!r) return undefined;
      if (r.exceptionDetails) { fail('평가 예외: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)); return undefined; }
      return r.result && r.result.value;
    };
    for (let i = 0; i < 40; i++) { if (await ev("typeof ARTISTS!=='undefined'&&ARTISTS.length>0")) break; await sleep(400); }
    await ev("typeof _mountAdminMarkup==='function'?(_mountAdminMarkup(),1):0");
    await ev("new Promise(function(res,rej){var s=document.createElement('script');s.src='admin.js?v=test';s.onload=res;s.onerror=rej;document.body.appendChild(s);})");
    for (let i = 0; i < 40; i++) { if (await ev("typeof _vmApplyTab==='function'")) break; await sleep(400); }
    if (!await ev("typeof _vmApplyTab==='function'")) { fail('admin.js 로드 실패'); throw new Error('load'); }

    await ev("(function(){var ov=document.getElementById('vm-overlay');if(ov)ov.classList.add('open');eval('_vmTab = \"review\"');_vmApplyTab();return 1;})()");
    // 검수 탭은 서버에서 수백 행을 긁어온다 — 목록이 실제로 그려질 때까지 기다린다
    for (let i = 0; i < 60; i++) { if (await ev("document.querySelectorAll('#vm-list .vm-item').length>3")) break; await sleep(700); }

    const r = JSON.parse(await ev(PROBE) || '{}');
    if (!r.items || r.items < 4) { fail(`목록이 안 그려짐(항목 ${r.items}) — 네트워크/DB 문제일 수 있음`); }
    else ok(`목록 ${r.items}건 로드`);

    if (r.j1 !== 0 || r.j2 !== 1 || r.k1 !== 0) fail(`[이동] j/k가 기대대로 안 움직임 (j1=${r.j1} j2=${r.j2} k1=${r.k1})`);
    else ok('[이동] j로 내려가고 k로 올라감');
    if (r.painted !== 1) fail(`[표시] 포커스 하이라이트가 ${r.painted}개 — 정확히 1개여야 함`);
    else ok('[표시] 포커스 행이 정확히 1개만 하이라이트');

    // ── 여기부터가 본체: 안 눌려야 할 때 안 눌리는가 ──
    const guards = [
      ['guardInput', '검색창에 타이핑 중'],
      ['guardTextarea', 'textarea 입력 중'],
      ['guardCe', 'contenteditable 입력 중'],
      ['guardCtrl', 'Ctrl 조합키'],
      ['guardModal', '편집 모달이 위에 열려 있을 때'],
      ['guardClosed', '패널이 닫혀 있을 때'],
      ['guardNoFocus', '포커스 행이 없을 때 숫자키'],
    ];
    guards.forEach(([k, label]) => {
      if (r[k] === true) ok(`[가드] ${label} — 무시됨`);
      else fail(`[가드] ${label}인데 단축키가 먹었다 — DB에 쓰는 동작이라 사고로 이어진다`);
    });
  } catch (e) {
    fail('테스트 실행 오류: ' + e.message);
  } finally {
    try { process.kill(child.pid); } catch (e) { }
    server.close();
  }
  console.log(pass ? '\n🎉 키보드 검수 테스트 전부 통과' : '\n💥 키보드 검수 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main();
