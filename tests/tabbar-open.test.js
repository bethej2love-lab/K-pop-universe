// 카드 "열기" 시 탭바 복구 회귀 테스트 (2026-08-28 신설)
//
// 사용자 제보(웹앱 vs 사파리 UI 차이): 홈화면에 설치한 웹앱에서 하단 탭바 가운데 별(탐험) 버튼을 누르면
// 카드는 열리는데 탭바가 사라진 채 안 돌아온다. 사파리에선 멀쩡하다.
//
// 근본 원인: `tab-hidden`을 떼는 코드가 **닫기 경로 4곳**(closeMobSheet / 스택 pop / 연결카드 닫기 /
// 라이트박스 닫기)에만 있었고 **여는 경로엔 하나도 없었다**. openMobSheet는 _lastScroll·_tbAccum만
// 리셋하는데(주석은 "숨김 고착을 막는다"고 돼 있었다) 추적값을 되돌려도 클래스는 안 떨어진다. 탐험
// 버튼은 closeMobSheet 로직을 인라인 복사하면서 복구 두 줄만 빠뜨렸다.
//
// 왜 사파리에선 안 드러났나 — 이 레포에서 "웹앱 vs 사파리" 차이가 반복되는 전형적 구조라 여기 못박는다:
// 유일한 복구 안전망이 스크롤 핸들러의 "최상단 40px면 무조건 표시"인데 **scroll 이벤트가 와야만 돈다**.
// 사파리는 주소창 때문에 세로가 짧아 카드가 거의 항상 스크롤 가능 → 안전망이 즉시 발동해 버그를 덮는다.
// standalone 웹앱은 세로를 100px 가까이 더 쓰므로 짧은 카드가 아예 안 스크롤되고, 그러면 이벤트가 한
// 번도 안 나서 안전망이 영원히 안 돈다. 그래서 이 테스트는 **키 큰 뷰포트(390x1100)** 로 웹앱 조건을
// 재현한다 — display-mode 에뮬레이션으로는 재현되지 않는다(코드에 standalone 분기가 거의 없다).
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/tabbar-open.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8947;
const CDP_PORT = 9347;
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

// 실제로 도달 가능한 상태를 그대로 재현: 긴 카드에서 아래로 스크롤해 탭바가 숨은 상태.
// (키 큰 뷰포트에선 카드가 짧아 스크롤로는 못 만드는 경우가 있어, 핸들러가 하는 것과 똑같이 세팅한다)
const HIDE_TABBAR = `(function(){document.getElementById('tabbar').classList.add('tab-hidden');_extendSheets();return document.getElementById('tabbar').classList.contains('tab-hidden');})()`;
const TB_STATE = `(function(){const tb=document.getElementById('tabbar');const r=tb.getBoundingClientRect();
  return JSON.stringify({hidden:tb.classList.contains('tab-hidden'),opacity:+getComputedStyle(tb).opacity,
    top:Math.round(r.top),vh:innerHeight,onScreen:r.top<innerHeight-4});})()`;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 탭바 테스트 스킵'); process.exit(0); }
  const errors = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-tabbar-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[tabbar-open] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown', p => errors.push((p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text)) || 'exception'));
    cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push((p.args || []).map(a => a.value || a.description).join(' ')); });
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    // 웹앱(홈화면 설치) 조건 재현 — 브라우저 크롬이 없어 세로를 더 길게 쓴다(390x1100).
    // display-mode:standalone 에뮬레이션도 같이 걸지만, 코드에 standalone 분기가 사실상 없으므로
    // 실제 차이를 만드는 건 "키 큰 뷰포트 → 카드가 안 스크롤됨 → scroll 이벤트 없음" 쪽이다.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1100, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: 'standalone' }] });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);
    await sleep(5000);

    const ready = await pollUntil(cdp, `(typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&typeof showT!=='undefined'&&typeof openMobSheet==='function'&&typeof _extendSheets==='function'&&isMob())`, 12000, v => v === true);
    if (!ready) { fail('앱 미준비 또는 모바일 뷰포트가 아님'); throw new Error('앱 미준비'); }
    ok('앱 로드 + 웹앱 조건 뷰포트(390x1100, display-mode:standalone) 준비');

    const openCard = async (idx) => {
      await ev(cdp, `(function(){const list=ARTISTS.filter(a=>a.group&&a._worldPos);const a=list[${idx}%list.length];
        _navHistoryActive=true;showT(a,innerWidth/2,innerHeight*0.4,false,null,false);_navHistoryActive=false;
        openMobSheet(document.getElementById('tt'));return 1;})()`);
      await sleep(700);
    };
    const openGroupCard = async (idx) => {
      await ev(cdp, `(function(){const b=bubbleMeshes[${idx}%bubbleMeshes.length];
        showGC(b.ko,innerWidth/2,innerHeight*0.4);return 1;})()`);
      await sleep(700);
    };
    const closeAll = async () => { await ev(cdp, `(function(){try{closeMobSheet()}catch(e){}try{closeConnCard()}catch(e){}return 1;})()`); await sleep(600); };

    // ── 1. 카드 열기 = 탭바 복구. 멤버(showT)와 그룹(showGC) 경로를 반드시 따로 본다 ────────
    // ⚠️ showT는 내부에서 closeConnCard()를 부르고 그 안에 탭바 복구가 들어있어서 **우연히** 복구된다.
    //    showGC엔 그 호출이 없다 — 그래서 이 버그는 그룹 카드에서만 드러났고, 멤버 카드로만 테스트하면
    //    수정 전에도 통과해버린다(실제로 처음 작성했을 때 그렇게 새어나갔다). 부수효과에 기대지 말 것.
    for (const [label, open] of [['멤버(showT)', openCard], ['그룹(showGC)', openGroupCard]]) {
      await closeAll();
      await open(0);
      const hid = await ev(cdp, HIDE_TABBAR);
      if (hid !== true) { fail(`[${label}] 사전 조건 실패 — 탭바 숨김 상태를 못 만듦`); continue; }
      await open(1);
      const s = await evJson(cdp, TB_STATE);
      if (s.hidden) fail(`[${label}] 새 카드를 열었는데 탭바가 숨김 고착 (opacity=${s.opacity}, top=${s.top}/${s.vh})`);
      else if (!s.onScreen || s.opacity < 0.9) fail(`[${label}] 클래스는 떨어졌는데 화면엔 안 보임 (opacity=${s.opacity}, top=${s.top}/${s.vh})`);
      else ok(`[${label}] 숨김 상태에서 새 카드 열기 → 탭바 복귀 (top=${s.top}/${s.vh})`);
    }
    await closeAll();
    await openCard(0);

    // ── 2. 탐험(별) 버튼: 사용자가 실제로 제보한 경로 ────────────────────────────────
    await ev(cdp, HIDE_TABBAR);
    await ev(cdp, `document.getElementById('tab-explore').click()`);
    await sleep(400); // 핸들러의 모바일 분기는 동기 — fly 애니메이션을 기다릴 필요 없음
    const s2 = await evJson(cdp, TB_STATE);
    if (s2.hidden) fail(`[탐험 버튼] 별 버튼을 눌렀는데 탭바가 사라진 채 유지됨 (opacity=${s2.opacity}) — 사용자 제보 증상 그대로`);
    else ok(`[탐험 버튼] 숨김 상태에서 별 버튼 → 탭바 복귀 (top=${s2.top}/${s2.vh})`);
    await sleep(2200); // fly 완료 + 카드 오픈까지 지켜보고 다시 확인(뒤늦게 다시 숨지 않아야 함)
    const s2b = await evJson(cdp, TB_STATE);
    if (s2b.hidden) fail('[탐험 버튼] 비행/카드 오픈이 끝난 뒤 탭바가 다시 숨음');
    else ok('[탐험 버튼] 비행+카드 오픈 완료 후에도 탭바 유지');

    // ── 3. 연결 카드 ─────────────────────────────────────────────────────────────
    await closeAll();
    await openCard(2);
    await ev(cdp, HIDE_TABBAR);
    const connOpened = await ev(cdp, `(function(){const a=ARTISTS.filter(x=>x.group&&x._worldPos)[2];
      if(typeof openConnCard!=='function')return 'no-fn';openConnCard(a);return 1;})()`);
    await sleep(800);
    if (connOpened === 'no-fn') fail('[연결 카드] openConnCard가 없음');
    else {
      const s3 = await evJson(cdp, `(function(){const tb=document.getElementById('tabbar');const r=tb.getBoundingClientRect();
        return JSON.stringify({hidden:tb.classList.contains('tab-hidden'),last:document.getElementById('conn-sheet-inner')._lastScroll,
          top:Math.round(r.top),vh:innerHeight,opacity:+getComputedStyle(tb).opacity});})()`);
      if (s3.hidden) fail(`[연결 카드] 연결 카드를 열었는데 탭바가 숨김 고착 (opacity=${s3.opacity})`);
      else if (s3.last !== 0) fail(`[연결 카드] 스크롤 추적값이 이전 카드 잔상 그대로 (_lastScroll=${s3.last}) — 첫 스크롤 방향이 반대로 읽힌다`);
      else ok(`[연결 카드] 탭바 복귀 + 스크롤 추적값 리셋 (_lastScroll=0)`);
    }

    // ── 4. 스크롤 불가 카드에서의 보강(ResizeObserver 경로) ────────────────────────
    // 탭바가 숨은 뒤 내용이 짧아져 스크롤이 불가능해지면 scroll 이벤트가 다신 안 온다 → 그래도 복구돼야 함.
    await closeAll();
    await openCard(3);
    const forced = await evJson(cdp, `(function(){
      const el=_activeSheetScroller();
      if(!el)return JSON.stringify({err:'활성 스크롤러 없음'});
      document.getElementById('tabbar').classList.add('tab-hidden');_extendSheets();
      const card=el.querySelector('#tt,#gc');
      if(!card)return JSON.stringify({err:'카드 엘리먼트 없음'});
      card.dataset._prevH=card.style.height||'';
      card.style.height='40px';card.style.overflow='hidden'; // 내용이 짧아져 더는 스크롤 불가
      return JSON.stringify({ok:1});
    })()`);
    if (forced.err) fail(`[스크롤 불가] 준비 실패 — ${forced.err}`);
    else {
      await sleep(700); // ResizeObserver 콜백 + 시트 트랜지션
      const s4 = await evJson(cdp, `(function(){const tb=document.getElementById('tabbar');const el=_activeSheetScroller();
        return JSON.stringify({hidden:tb.classList.contains('tab-hidden'),
          scrollable:el?Math.max(0,el.scrollHeight-el.clientHeight):-1});})()`);
      if (s4.hidden) fail(`[스크롤 불가] 스크롤이 불가능해졌는데(여유=${s4.scrollable}px) 탭바가 안 돌아옴 — scroll 이벤트에만 의존하는 안전망의 사각지대`);
      else ok(`[스크롤 불가] 내용이 짧아져 스크롤 불가(여유=${s4.scrollable}px)가 되자 탭바 자동 복귀`);
      await ev(cdp, `(function(){const c=document.querySelector('#tt,#gc');if(c){c.style.height=c.dataset._prevH||'';c.style.overflow='';}return 1;})()`);
    }

    // ── 5. 회귀 방지: 스크롤 방향에 따른 숨김/표시는 그대로 살아있어야 한다 ──────────
    // (사용자가 "사파리처럼 웹앱에서도 되게" 요청한 동작 자체 — 위 수정으로 죽지 않았는지 확인)
    await closeAll();
    await openCard(4);
    const dir = await evJson(cdp, `(function(){
      const el=_activeSheetScroller();
      if(!el)return JSON.stringify({err:'활성 스크롤러 없음'});
      const card=el.querySelector('#tt,#gc');
      if(card)card.style.minHeight=(el.clientHeight*3)+'px'; // 확실히 스크롤 가능하게
      return JSON.stringify({ok:1,max:Math.max(0,el.scrollHeight-el.clientHeight)});
    })()`);
    if (dir.err) fail(`[스크롤 방향] 준비 실패 — ${dir.err}`);
    else {
      const step = async (to) => { await ev(cdp, `(function(){const el=_activeSheetScroller();el.scrollTop=${to};el.dispatchEvent(new Event('scroll'));return 1;})()`); await sleep(250); };
      await step(200); await step(400); // 아래로 (누적 > _TB_HIDE_DELTA)
      const down = await evJson(cdp, TB_STATE);
      await step(300); await step(120); // 위로 (누적 < -_TB_SHOW_DELTA)
      const up = await evJson(cdp, TB_STATE);
      if (!down.hidden) fail('[스크롤 방향] 아래로 스크롤했는데 탭바가 안 숨음');
      else if (up.hidden) fail('[스크롤 방향] 위로 스크롤했는데 탭바가 안 돌아옴');
      else ok('[스크롤 방향] 다운=숨김 / 업=표시 정상 (사파리와 동일 동작)');
    }

    const newErrors = errors.filter(e => !/favicon|404|Failed to load resource/i.test(e));
    if (newErrors.length) fail(`콘솔 에러 ${newErrors.length}건: ${newErrors.slice(0, 3).join(' | ')}`);
    else ok('탭바 시나리오 중 콘솔 에러 0건');

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 탭바 열기 복구 테스트 전부 통과' : '\n💥 탭바 열기 복구 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
