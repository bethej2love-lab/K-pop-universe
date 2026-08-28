// "연결" 버튼 로딩 표시 회귀 테스트 (2026-08-28 신설)
//
// 사용자 제보: 연결 버튼을 누르면 로딩 스피너가 "연결" 텍스트 **위에 겹쳐** 보인다.
//
// 원인: CSS는 원래부터 `.conn-btn-loading{color:transparent}`로 글자를 숨기려 했는데, 기본 규칙
// `.tt-conn-btn`에 `transition: … color .18s …`가 걸려 있어 글자가 0.18초에 걸쳐 서서히 사라진다.
// 그런데 JS는 클래스를 붙인 직후(rAF 두 번 뒤) openConnCard를 호출해 **메인 스레드를 통째로 막는다**.
// 그러면 트랜지션은 시작만 하고 진행을 못 하므로, 글자가 거의 그대로 남은 채 그 위에 스피너만 얹힌
// 상태로 몇 초간 얼어붙는다. 로딩 표시는 부드럽게 바뀔 이유가 없어 즉시 전환(transition:none)으로 고쳤다.
//
// 검증 방식: 로딩 클래스를 붙인 뒤 **두 프레임 지나서** computed color를 읽는다. 트랜지션이 살아
// 있으면 그때는 아직 보간 중(≈원래 색)이고, 없으면 이미 transparent다.
// ⚠️ 클래스 추가 **직후**에 읽으면 트랜지션 유무와 무관하게 "목표값"이 나와서 아무것도 구분 못 한다 —
//    처음에 그렇게 짰다가 수정 전 코드도 통과해버렸다. 프레임을 넘겨야 한다.
// (실제 클릭으로 재현하면 메인 스레드가 막혀 그 사이 상태를 샘플링할 수 없어서 이 방식을 쓴다.)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/conn-btn-loading.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8957;
const CDP_PORT = 9357;
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
    const ws = new WebSocket(url); let id = 0; const pend = new Map();
    ws.addEventListener('open', () => resolve({ send: (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); }), close: () => ws.close() }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  });
}

const TRANSPARENT = /rgba\(0,\s*0,\s*0,\s*0\)|transparent/;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 연결 버튼 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-connbtn-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[conn-btn] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(8000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 40; i++) { if (await ev("typeof ARTISTS!=='undefined'")) break; await sleep(400); }

    // 실제 버튼은 카드가 닫혀 있으면 박스가 0×0이라 측정이 무의미하다. CSS 계약만 보면 되므로
    // 같은 클래스를 단 버튼을 body에 하나 띄워서 잰다(선택자가 전부 class 기반이라 동일하게 적용됨).
    await ev(`(function(){
      document.getElementById('__cb_probe')?.remove();
      const b=document.createElement('button');
      b.id='__cb_probe';b.className='tt-conn-btn conn-btn-visible';b.textContent='연결';
      b.style.position='fixed';b.style.left='20px';b.style.top='20px';b.style.display='inline-flex';
      document.body.appendChild(b);return 1;})()`);
    await sleep(300);

    // ── 1. 로딩 클래스를 붙이면 **다음 프레임**엔 이미 글자가 사라져 있어야 한다 ────────
    // ⚠️ 클래스 추가 직후 getComputedStyle을 읽으면 트랜지션 유무와 무관하게 "목표값"이 나와서
    //    아무것도 구분 못 한다(이 함정에 한 번 빠져 수정 전 코드도 통과했다). 트랜지션은 다음
    //    프레임부터 옛 값에서 보간되므로, 두 프레임 뒤에 재야 "서서히 사라지는 중"이 드러난다.
    const r = JSON.parse(await ev(`(async function(){
      const b=document.getElementById('__cb_probe');
      if(!b)return JSON.stringify({err:'프로브 버튼 생성 실패'});
      b.classList.remove('conn-btn-loading');
      const before=getComputedStyle(b).color;
      const dur=getComputedStyle(b).transitionDuration;
      b.classList.add('conn-btn-loading');
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const nextFrame=getComputedStyle(b).color; // 트랜지션이 살아 있으면 아직 거의 원래 색
      return JSON.stringify({before:before,nextFrame:nextFrame,dur:dur,
        loadDur:getComputedStyle(b).transitionDuration});
    })()`) || '{}');
    if (r.err) { fail(r.err); throw new Error(r.err); }
    if (!TRANSPARENT.test(r.nextFrame)) fail(`[즉시 숨김] 로딩 시작 두 프레임 뒤에도 글자색이 ${r.nextFrame} — 트랜지션(평상시 ${r.dur}) 때문에 서서히 사라지는 중이라, 메인 스레드가 막히면 글자가 남은 채 스피너가 그 위에 겹친다`);
    else ok(`[즉시 숨김] 로딩 시작 즉시 글자 사라짐 (${r.before} → ${r.nextFrame}, 로딩 중 transition=${r.loadDur})`);

    // ── 2. 스피너가 실제로 그려지고, 버튼 중앙에 있어야 한다 ────────────────────────
    const sp = JSON.parse(await ev(`(function(){
      const b=document.getElementById('__cb_probe');
      const cs=getComputedStyle(b,'::after');
      const rect=b.getBoundingClientRect();
      return JSON.stringify({content:cs.content,w:cs.width,h:cs.height,anim:cs.animationName,
        pos:cs.position,btnW:Math.round(rect.width),btnH:Math.round(rect.height)});
    })()`) || '{}');
    if (sp.content === 'none') fail('[스피너] ::after가 안 그려짐 — 로딩 표시가 아예 없다');
    else if (!/spin/i.test(sp.anim || '')) fail(`[스피너] 회전 애니메이션이 없음 (animation-name=${sp.anim})`);
    else if (sp.pos !== 'absolute') fail(`[스피너] position이 absolute가 아님(${sp.pos}) — 버튼 크기를 밀어 레이아웃이 튄다`);
    else ok(`[스피너] ${sp.w}×${sp.h} 회전 애니메이션(${sp.anim}) — 버튼 ${sp.btnW}×${sp.btnH} 안에 절대배치`);

    // ── 3. 투명 처리가 로딩 클래스에만 묶여 있어야 한다(평상시엔 글자가 보임) ──────────
    // ⚠️ "클래스를 떼고 400ms 기다렸다 재기"로는 못 잰다 — 헤드리스는 화면이 없어 트랜지션이 t=0에
    //    멈춰 있어서(그래서 위 1번이 좋은 판별자가 된다) 되돌아오는 애니메이션이 영원히 진행되지 않는다.
    //    대신 로딩 클래스를 한 번도 안 단 새 버튼의 기준색을 봐서 "투명은 로딩 전용"임을 확인한다.
    const back = JSON.parse(await ev(`(function(){
      const b=document.getElementById('__cb_probe');
      b.classList.remove('conn-btn-loading');
      const durAfter=getComputedStyle(b).transitionDuration; // transition:none이 눌러붙지 않았는지
      const f=document.createElement('button');
      f.className='tt-conn-btn conn-btn-visible';f.textContent='연결';
      f.style.position='fixed';f.style.left='20px';f.style.top='60px';f.style.display='inline-flex';
      document.body.appendChild(f);
      const fresh=getComputedStyle(f).color;
      f.remove();
      return JSON.stringify({fresh:fresh,durAfter:durAfter});
    })()`) || '{}');
    if (TRANSPARENT.test(back.fresh)) fail(`[평상시] 로딩이 아닌데도 글자가 투명(${back.fresh}) — 버튼이 항상 빈 알약으로 보인다`);
    else if (back.durAfter === '0s') fail(`[복원] 로딩 해제 후에도 transition이 0s로 눌러붙음 — 등장/호버 전환이 뚝뚝 끊긴다`);
    else ok(`[평상시] 글자 정상 표시(${back.fresh}) · 로딩 해제 시 transition 복귀(${back.durAfter})`);

    // ── 4. 로딩 중엔 다시 못 누르게 막혀 있어야 한다(중복 실행 방지) ─────────────────
    const pe = await ev(`(function(){const b=document.getElementById('__cb_probe');
      b.classList.add('conn-btn-loading');const v=getComputedStyle(b).pointerEvents;
      b.classList.remove('conn-btn-loading');return v;})()`);
    if (pe !== 'none') fail(`[중복 방지] 로딩 중 pointer-events가 ${pe} — 연타로 무거운 렌더가 중첩된다`);
    else ok('[중복 방지] 로딩 중 pointer-events:none');

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 연결 버튼 로딩 표시 테스트 전부 통과' : '\n💥 연결 버튼 로딩 표시 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
