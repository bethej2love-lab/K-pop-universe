// 어드민 도킹 모드 회귀 테스트 (2026-08-28 신설)
//
// 왜 만들었나: 관리자 홈/검수 센터/영상 관리/그룹 우선순위는 원래 z81 중앙 모달이라 열면 카드
// (#gc:61, #side-panel/#member-panel)를 항상 덮었다 — "열고 확인하고 닫고" 왕복이 검수 작업의
// 실제 병목이었다(admin_improvement_plan P1-3~4). 이걸 z58 좌측 도킹으로 내리면서, 배경(우주)을
// 다시 조작 가능하게 하려고 오버레이 루트를 pointer-events:none으로 투과시켰다.
//
// 그 투과가 이 변경의 급소다. 루트가 히트테스트에서 빠지면서 아래 세 가지가 동시에 성립해야 한다:
//   [A] 패널 위에선 여전히 "모달 안"으로 판정돼야 한다 — window pointerdown/click 가드의
//       closest('[data-modal]')와 호버 툴팁 가드의 elementsFromPoint가 패널을 통해 루트를 찾아야 함.
//       (안 그러면 어드민 패널을 클릭할 때마다 설정 패널이 닫히고 우주가 반응한다)
//   [B] 패널 바깥(우주) 위에선 "모달 밖"으로 판정돼야 한다 — 도킹의 존재 이유가 배경 조작이므로.
//       (전면 백드롭이 그대로 남아 있으면 여기서 걸린다)
//   [C] 배경 클릭이 오버레이 루트에 안 닿아야 한다 — 루트의 `e.target===e.currentTarget` 백드롭
//       닫기 핸들러(admin.js)가 자동 무력화되는 근거. 도킹 패널이 우주 클릭에 닫히면 안 됨.
// 그리고 모바일은 기존 중앙 모달 그대로여야 한다(계획대로 도킹은 데스크톱 전용).
//
// 검증은 CSS 기하 + 실제 이벤트 주입 둘 다. admin.js는 관리자 로그인에만 로드되므로 오버레이는
// classList로 직접 열고, 판정 대상은 "로그인 없이도 항상 살아있는" index.html 쪽 가드로 삼는다.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/admin-dock.test.js

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
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const DOCKED = ['adm-home', 'hnn', 'vm', 'gp'];

let pass = true;
function fail(msg) { pass = false; console.log(`❌ ${msg}`); }
function ok(msg) { console.log(`✅ ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function waitForCdp(retries = 40) {
  for (let i = 0; i < retries; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; } catch (e) { await sleep(300); } }
  throw new Error('CDP 포트가 안 열림 — 브라우저 실행 실패');
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
async function evJson(cdp, expr) {
  const v = await ev(cdp, expr);
  if (v && v.__err) throw new Error(v.__err);
  return JSON.parse(v);
}
async function pollUntil(cdp, expr, timeoutMs, isReady = v => !!v) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { const v = await ev(cdp, expr); if (isReady(v)) return v; await sleep(200); }
  return await ev(cdp, expr);
}

// 열려있는 어드민 오버레이를 전부 닫고 하나만 연다(슬롯 공유 구조라 겹치면 측정이 오염됨)
const openOnly = id => `(function(){${JSON.stringify(DOCKED)}.forEach(function(k){document.getElementById(k+'-overlay').classList.remove('open')});document.getElementById('${id}-overlay').classList.add('open');return 1;})()`;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 도킹 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-admindock-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[admin-dock] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);
    await sleep(3000);

    const ready = await pollUntil(cdp, `(typeof closePanels==='function'&&typeof isMob==='function'&&!isMob()&&!!document.getElementById('vm-overlay'))`, 15000, v => v === true);
    if (!ready) { fail('앱 미준비 또는 데스크톱 뷰포트가 아님(isMob=true)'); throw new Error('앱 미준비'); }
    ok('앱 로드 + 데스크톱 뷰포트(1440x900) 준비');

    // ── 1. 4개 패널이 실제로 좌측에 도킹되는가 (기하 + 스태킹) ───────────────────────
    const GC_Z = await ev(cdp, `(function(){const e=document.getElementById('gc');return +getComputedStyle(e).zIndex||0;})()`);
    for (const id of DOCKED) {
      await ev(cdp, openOnly(id));
      const m = await evJson(cdp, `(function(){
        const ov=document.getElementById('${id}-overlay'),pn=document.getElementById('${id}-panel');
        const cs=getComputedStyle(ov),cp=getComputedStyle(pn),r=pn.getBoundingClientRect();
        return JSON.stringify({z:+cs.zIndex,ovPe:cs.pointerEvents,bg:cs.backgroundColor,pnPe:cp.pointerEvents,
          left:Math.round(r.left),top:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),vh:innerHeight});
      })()`);
      const why = `${id}: z=${m.z} ovPE=${m.ovPe} bg=${m.bg} panel=${m.w}x${m.h}@(${m.left},${m.top})`;
      if (m.z !== 58) fail(`${id} 오버레이 z-index가 58이 아님 (${m.z}) — 카드보다 위로 올라감`);
      else if (m.z >= GC_Z) fail(`${id} z(${m.z})가 카드 #gc z(${GC_Z}) 이상 — 카드를 덮음`);
      else if (m.ovPe !== 'none') fail(`${id} 오버레이 pointer-events가 none이 아님 (${m.ovPe}) — 배경 조작이 막힘`);
      else if (!/rgba\(0, 0, 0, 0\)|transparent/.test(m.bg)) fail(`${id} 백드롭이 안 지워짐 (${m.bg})`);
      else if (m.pnPe !== 'auto') fail(`${id} 패널 pointer-events가 auto가 아님 (${m.pnPe}) — 패널 조작 불가`);
      else if (m.left > 24) fail(`${id} 패널이 좌측 도킹이 아님 (left=${m.left})`);
      else if (m.w > 520) fail(`${id} 패널 폭이 도킹 상한(520)을 넘음 (${m.w})`);
      else if (m.h < m.vh - 100) fail(`${id} 패널이 세로로 안 채워짐 (h=${m.h}, vh=${m.vh})`);
      else ok(`${id} 좌측 도킹 — ${why}`);
    }

    // ── 2. [A] 패널 위 = "모달 안" 판정 ────────────────────────────────────────────
    // 두 가드가 서로 다른 방식이라 둘 다 본다: closest(이벤트 타깃 기준) / elementsFromPoint(호버 기준).
    await ev(cdp, openOnly('vm'));
    const inPanel = await evJson(cdp, `(function(){
      const r=document.getElementById('vm-panel').getBoundingClientRect();
      const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);
      const el=document.elementFromPoint(x,y);
      return JSON.stringify({x:x,y:y,closest:!!(el&&el.closest('[data-modal]')),
        hover:document.elementsFromPoint(x,y).some(e=>e.closest('[data-modal]'))});
    })()`);
    if (!inPanel.closest) fail('[A] 패널 위 클릭이 data-modal로 안 잡힘 — 어드민 클릭마다 closePanels가 돈다');
    else if (!inPanel.hover) fail('[A] 패널 위 호버가 data-modal로 안 잡힘 — 패널 뒤 행성 툴팁이 뜬다');
    else ok('[A] 패널 위 = 모달 안 판정 (closest·elementsFromPoint 둘 다)');

    // ── 3. [B] 패널 바깥(우주) = "모달 밖" 판정 ────────────────────────────────────
    const outPanel = await evJson(cdp, `(function(){
      const r=document.getElementById('vm-panel').getBoundingClientRect();
      const x=Math.round(r.right+(innerWidth-r.right)/2),y=Math.round(innerHeight/2);
      const el=document.elementFromPoint(x,y);
      return JSON.stringify({x:x,y:y,tag:el?(el.id||el.tagName):null,
        closest:!!(el&&el.closest('[data-modal]')),
        hover:document.elementsFromPoint(x,y).some(e=>e.closest('[data-modal]'))});
    })()`);
    if (outPanel.closest || outPanel.hover) fail(`[B] 우주(${outPanel.x},${outPanel.y})가 여전히 모달로 판정됨 — 백드롭이 안 걷혔다 (히트: ${outPanel.tag})`);
    else ok(`[B] 패널 바깥 = 모달 밖 판정 — 배경 호버/클릭 살아있음 (히트: ${outPanel.tag})`);

    // ── 4. [C] 배경 클릭이 오버레이 루트에 안 닿음 (백드롭 닫기 자동 무력화의 근거) ──
    const rootHit = await evJson(cdp, `(function(){
      const r=document.getElementById('vm-panel').getBoundingClientRect();
      const x=Math.round(r.right+(innerWidth-r.right)/2),y=Math.round(innerHeight/2);
      return JSON.stringify({hitsRoot:document.elementsFromPoint(x,y).some(e=>e.id==='vm-overlay')});
    })()`);
    if (rootHit.hitsRoot) fail('[C] 배경 좌표에서 vm-overlay 루트가 히트됨 — 우주를 클릭하면 도킹 패널이 닫힌다');
    else ok('[C] 배경 클릭이 오버레이 루트에 안 닿음 — 도킹 패널이 우주 클릭에 안 닫힘');

    // ── 5. 가드 실동작: 패널 안 클릭은 closePanels를 막고, 배경 클릭은 막지 않는다 ──
    // (판정만 맞고 배선이 끊겨 있으면 의미가 없으므로 실제 이벤트를 주입해 결과를 본다)
    const guard = await evJson(cdp, `(function(){
      const sp=document.getElementById('settings-panel');
      const r=document.getElementById('vm-panel').getBoundingClientRect();
      const fire=(x,y)=>{const el=document.elementFromPoint(x,y);if(!el)return null;
        el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,clientX:x,clientY:y}));return el.id||el.tagName;};
      sp.classList.add('open');
      const t1=fire(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
      const keptOnPanel=sp.classList.contains('open');
      sp.classList.add('open');
      const t2=fire(Math.round(r.right+(innerWidth-r.right)/2),Math.round(innerHeight/2));
      const keptOnUniverse=sp.classList.contains('open');
      sp.classList.remove('open');
      return JSON.stringify({t1:t1,t2:t2,keptOnPanel:keptOnPanel,keptOnUniverse:keptOnUniverse});
    })()`);
    if (!guard.keptOnPanel) fail(`도킹 패널 안(${guard.t1})을 눌렀는데 closePanels가 돌아 설정 패널이 닫힘 — data-modal 가드 끊김`);
    else if (guard.keptOnUniverse) fail(`배경(${guard.t2})을 눌렀는데 closePanels가 안 돔 — 가드가 배경까지 막고 있음(도킹 의미 상실)`);
    else ok(`가드 실동작 — 패널 안(${guard.t1}) 클릭은 통과, 배경(${guard.t2}) 클릭은 정상 닫힘`);

    // ── 6. 이 변경의 목적 그 자체: 도킹을 열어둔 채 진짜 카드가 나란히 열리는가 ────
    // (좌측 슬롯은 탐험 패널·저널 사이드바가 left:0·300px·z66으로 이미 쓰고 있어 처음엔 도킹 패널
    //  왼쪽 300px가 통째로 가려졌다. 그 회귀를 여기서 같이 잡는다 — 겹치면 즉시 실패.)
    await ev(cdp, openOnly('vm'));
    await ev(cdp, `(function(){document.getElementById('feed-overlay').classList.add('open');return 1;})()`);
    await sleep(600);
    const side = await evJson(cdp, `(function(){
      const a=ARTISTS.find(x=>x.group&&x._worldPos);
      if(!a)return JSON.stringify({err:'표시 가능한 아티스트 없음'});
      showT(a,Math.round(innerWidth*0.72),Math.round(innerHeight*0.4));
      return JSON.stringify({ok:1});
    })()`);
    if (side.err) fail(`카드 열기 준비 실패: ${side.err}`);
    await sleep(900);
    const co = await evJson(cdp, `(function(){
      const dock=document.getElementById('vm-panel').getBoundingClientRect();
      const cards=['member-panel','side-panel'].map(id=>document.getElementById(id))
        .filter(e=>e&&e.classList.contains('open'));
      const feed=document.getElementById('feed-overlay').getBoundingClientRect();
      const cz=cards.map(e=>+getComputedStyle(e).zIndex||0);
      const cr=cards.map(e=>{const r=e.getBoundingClientRect();return{id:e.id,left:Math.round(r.left),right:Math.round(r.right),w:Math.round(r.width)};});
      return JSON.stringify({dock:{left:Math.round(dock.left),right:Math.round(dock.right)},
        cards:cr,cz:cz,dockZ:+getComputedStyle(document.getElementById('vm-overlay')).zIndex,
        feedRight:Math.round(feed.right)});
    })()`);
    if (!co.cards.length) fail('도킹 상태에서 카드가 아예 안 열림 — showT 경로가 도킹에 막혔다');
    else {
      const overlap = co.cards.filter(c => c.left < co.dock.right);
      if (overlap.length) fail(`카드가 도킹 패널과 가로로 겹침: ${overlap.map(c => `${c.id}(left=${c.left})`).join(', ')} < dock.right=${co.dock.right}`);
      else if (co.cz.some(z => z <= co.dockZ)) fail(`카드 z(${co.cz.join(',')})가 도킹 z(${co.dockZ}) 이하 — 도킹이 카드를 덮는다`);
      else if (co.feedRight > co.dock.left) fail(`탐험 패널이 안 접힘 (right=${co.feedRight} > dock.left=${co.dock.left}) — 도킹 패널 왼쪽이 가려진다`);
      else ok(`도킹 + 카드 동시 표시 — dock ${co.dock.left}~${co.dock.right}, ${co.cards.map(c => `${c.id} ${c.left}~${c.right}(z${co.cz})`).join(' / ')}, 탐험 패널 접힘(right=${co.feedRight})`);
    }
    await ev(cdp, `(function(){try{closeCards()}catch(e){}document.getElementById('feed-overlay').classList.remove('open');return 1;})()`);
    await sleep(400);

    // ── 7. 홈 복귀 버튼이 3개 도킹 패널 헤더에 모두 있는가 ────────────────────────
    const back = await evJson(cdp, `(function(){
      return JSON.stringify(['vm-hd','hnn-hd','gp-hd'].map(function(h){
        const b=document.querySelector('#'+h+' .adm-back-home');
        return {hd:h,has:!!b,shown:b?getComputedStyle(b).display!=='none':false};
      }));
    })()`);
    const missing = back.filter(b => !b.has || !b.shown);
    if (missing.length) fail(`홈 복귀(🏠) 버튼 누락/숨김: ${missing.map(m => m.hd).join(', ')} — 도킹은 홈과 슬롯을 공유하므로 복귀 경로가 필수`);
    else ok('홈 복귀(🏠) 버튼 — vm/hnn/gp 헤더 3곳 모두 노출');

    // ── 8. 모바일은 기존 중앙 모달 그대로 (도킹은 데스크톱 전용) ──────────────────
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(600);
    const mob = await evJson(cdp, `(function(){
      const ov=document.getElementById('vm-overlay'),cs=getComputedStyle(ov);
      const b=document.querySelector('#vm-hd .adm-back-home');
      return JSON.stringify({z:+cs.zIndex,pe:cs.pointerEvents,bg:cs.backgroundColor,back:b?getComputedStyle(b).display:'없음'});
    })()`);
    if (mob.z !== 81 || mob.pe === 'none') fail(`모바일이 도킹으로 새어나감 (z=${mob.z}, pointer-events=${mob.pe}) — 모바일은 중앙 모달 유지여야 함`);
    else if (mob.bg === 'rgba(0, 0, 0, 0)') fail('모바일 백드롭이 사라짐 — 뒤 배경이 그대로 조작됨');
    else if (mob.back !== 'none') fail(`모바일에서 🏠 버튼이 보임 (${mob.back}) — 도킹 전용 UI라 숨겨야 함`);
    else ok(`모바일(390px) 중앙 모달 유지 — z=${mob.z}, 백드롭 ${mob.bg}, 🏠 숨김`);

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 어드민 도킹 테스트 전부 통과' : '\n💥 어드민 도킹 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
