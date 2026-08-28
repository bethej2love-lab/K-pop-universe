// 재생(브라우즈) 모드 스와이프 소유권 회귀 테스트 (2026-08-28 신설)
//
// 사용자 제보: "모바일 재생 모드에서 재생목록을 아래로 스크롤하며 둘러보는데 아예 스와이프 다운이 되면서
// 재생 모드가 꺼지는 경우가 종종 있다."
//
// 근본 원인: 브라우즈 모드의 "당겨서 닫기" 판정이 `_lbScrollEl.scrollTop<=0 && dy>0`를 **touchmove마다**
// 다시 보는데, `dy`는 그 순간의 증분이 아니라 **터치 시작점부터의 누적 이동량**이다. 목록을 위쪽으로
// 되돌려 스크롤하다 맨 위(scrollTop 0)에 닿는 순간 조건이 참이 되고, 그때 dy는 이미 100~200px 쌓여
// 있어서 곧바로 큰 translateY로 튀며 손을 떼면 임계값(90px)을 넘겨 닫혀버린다. 즉 "목록을 훑던 손짓"이
// 도중에 "닫기 제스처"로 승격됐다.
//
// 고친 방식(제스처 소유권): 한 번의 터치 안에서 목록이 실제로 아래로 스크롤됐으면(_lbDidScroll) 그
// 제스처는 끝까지 스크롤이지 닫기가 아니다. 닫기는 "처음부터 맨 위에서 시작한(_lbStartedAtTop) 아래
// 방향 당김"일 때만 인정한다. iOS 고무줄 바운스로 scrollTop이 음수가 되는 건 스크롤로 세지 않는다(>2 기준).
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/lb-swipe-ownership.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8949;
const CDP_PORT = 9349;
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

// 페이지 안에서 터치 시퀀스를 재생한다. steps = [{y, scrollTop}] — scrollTop은 "네이티브 스크롤이
// 그 시점에 어디까지 갔는지"를 흉내낸 값(합성 터치로는 실제 네이티브 스크롤이 안 일어나므로 직접 넣는다).
// 핸들러가 보는 입력(누적 dy + 그때의 scrollTop)은 실기기와 동일해지므로 판정 로직을 그대로 검증한다.
const GESTURE = (startY, steps) => `(function(){
  const up=document.getElementById('yt-lb-uplist');
  const target=up.querySelector('.lb-up-item')||up.firstElementChild||up;
  const mk=(y)=>new Touch({identifier:1,target:target,clientX:180,clientY:y});
  const fire=(type,y,cancelable)=>{
    const t=mk(y);
    target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:cancelable,
      touches:type==='touchend'?[]:[t],targetTouches:type==='touchend'?[]:[t],changedTouches:[t]}));
  };
  fire('touchstart',${startY},true);
  const steps=${JSON.stringify(steps)};
  for(const s of steps){ up.scrollTop=s.scrollTop; fire('touchmove',s.y,true); }
  const last=steps[steps.length-1];
  up.scrollTop=last.scrollTop;
  fire('touchend',last.y,true);
  return JSON.stringify({endScrollTop:up.scrollTop});
})()`;

const LB_STATE = `(function(){
  const lb=document.getElementById('yt-lightbox'),w=document.getElementById('yt-lb-wrap');
  return JSON.stringify({open:lb.classList.contains('open'),mode:typeof _lbSessionMode!=='undefined'?_lbSessionMode:'?',
    transform:w.style.transform||'(없음)'});
})()`;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 스와이프 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-lbswipe-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[lb-swipe] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 50; i++) { if (await ev("typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&typeof openLightbox==='function'")) break; await sleep(500); }

    // 재생목록을 길게 줘서 "다음 영상" 목록이 실제로 스크롤 가능하게 만든다
    const openLb = async () => {
      await ev(`(function(){ try{closeLightbox()}catch(e){}
        var pl=[];for(var i=0;i<30;i++)pl.push({t:'테스트 영상 '+i,u:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',thumb:'',pa:'2024-01-01',with:[]});
        openLightbox(pl[0].u,false,pl,0,{groupKo:'에스파',memberKo:'카리나'},false,true); return 1;})()`);
      await sleep(2200);
    };

    await openLb();
    const pre = JSON.parse(await ev(`(function(){const up=document.getElementById('yt-lb-uplist');const lb=document.getElementById('yt-lightbox');
      return JSON.stringify({open:lb.classList.contains('open'),browse:lb.classList.contains('lb-browse'),
        mode:typeof _lbSessionMode!=='undefined'?_lbSessionMode:'?',
        scrollable:Math.max(0,up.scrollHeight-up.clientHeight),items:up.querySelectorAll('.lb-up-item').length});})()`) || '{}');
    if (!pre.open) { fail('라이트박스가 안 열림 — 이후 테스트 불가'); throw new Error('라이트박스 미오픈'); }
    if (pre.mode !== 'browse') { fail(`브라우즈 모드가 아님 (mode=${pre.mode})`); throw new Error('모드 불일치'); }
    if (pre.scrollable < 100) fail(`"다음 영상" 목록이 충분히 안 스크롤됨 (여유 ${pre.scrollable}px, 항목 ${pre.items}개) — 재현 조건 미달`);
    else ok(`브라우즈 모드 + 스크롤 가능한 목록 준비 (여유 ${pre.scrollable}px, 항목 ${pre.items}개)`);

    // ── 1. 버그 재현: 목록을 스크롤하다 맨 위에 닿는 손짓이 "닫기"로 승격되면 안 된다 ──────
    // 손가락은 아래로(y 증가) 움직이고, 그동안 목록은 위로 되감긴다(scrollTop 200 → 0). 맨 위에 닿는
    // 순간 누적 dy는 이미 200px — 예전 코드는 여기서 곧장 pull 모드로 들어가 손을 떼면 닫아버렸다.
    await ev(GESTURE(500, [
      { y: 520, scrollTop: 180 }, { y: 560, scrollTop: 140 }, { y: 620, scrollTop: 80 },
      { y: 700, scrollTop: 0 }, { y: 720, scrollTop: 0 },
    ]));
    await sleep(600);
    const s1 = JSON.parse(await ev(LB_STATE) || '{}');
    if (!s1.open) fail('[스크롤→맨위] 목록을 되감는 손짓만으로 재생 모드가 닫힘 — 사용자 제보 증상 그대로');
    else if (s1.transform !== '(없음)' && s1.transform !== '') fail(`[스크롤→맨위] 닫히진 않았지만 wrap에 transform 잔상이 남음 (${s1.transform})`);
    else ok('[스크롤→맨위] 목록을 되감아 맨 위에 닿아도 재생 모드 유지 + 잔상 없음');

    // ── 2. 같은 제스처를 이어서 더 아래로 끌어도(여전히 같은 터치가 아님) 소유권은 터치마다 초기화 ──
    // 손을 뗐다 다시 "맨 위에서" 당기는 건 정상적인 닫기여야 한다 → 3번에서 확인.

    // ── 3. 회귀 방지: 처음부터 맨 위에서 당기는 정상 닫기는 그대로 동작해야 한다 ────────────
    await ev(`document.getElementById('yt-lb-uplist').scrollTop=0`);
    await sleep(200);
    await ev(GESTURE(300, [
      { y: 330, scrollTop: 0 }, { y: 380, scrollTop: 0 }, { y: 440, scrollTop: 0 }, { y: 470, scrollTop: 0 },
    ]));
    await sleep(700);
    const s3 = JSON.parse(await ev(LB_STATE) || '{}');
    if (s3.open) fail('[맨위에서 당기기] 정상적인 당겨서 닫기가 동작하지 않음 — 소유권 가드가 과하게 막았다');
    else ok('[맨위에서 당기기] 맨 위에서 시작한 아래 당김 → 정상 닫힘 (기존 동작 보존)');

    // ── 4. iOS 고무줄 바운스(scrollTop 음수)를 "스크롤했다"로 오판하면 안 된다 ──────────────
    // 맨 위에서 당기는 도중 scrollTop이 잠깐 음수로 튀어도 닫기 판정은 살아있어야 한다.
    await openLb();
    await ev(`document.getElementById('yt-lb-uplist').scrollTop=0`);
    await sleep(200);
    await ev(GESTURE(300, [
      { y: 330, scrollTop: -2 }, { y: 390, scrollTop: -6 }, { y: 450, scrollTop: -10 }, { y: 480, scrollTop: -12 },
    ]));
    await sleep(700);
    const s4 = JSON.parse(await ev(LB_STATE) || '{}');
    if (s4.open) fail('[바운스] 고무줄로 scrollTop이 음수가 되자 닫기 판정이 죽음 — 음수를 "스크롤"로 오판하고 있다');
    else ok('[바운스] scrollTop 음수(고무줄) 구간에서도 당겨서 닫기 정상');

    // ── 5. 목록을 아래로 훑는(손가락 위로) 평범한 스크롤은 아무 영향 없어야 한다 ─────────────
    await openLb();
    await ev(GESTURE(600, [
      { y: 560, scrollTop: 60 }, { y: 500, scrollTop: 140 }, { y: 430, scrollTop: 230 }, { y: 400, scrollTop: 260 },
    ]));
    await sleep(600);
    const s5 = JSON.parse(await ev(LB_STATE) || '{}');
    if (!s5.open) fail('[아래로 훑기] 평범한 목록 스크롤로 재생 모드가 닫힘');
    else ok('[아래로 훑기] 손가락 위로 = 목록 스크롤, 재생 모드 유지');

    // ── 6. overscroll-behavior:contain — 목록 바운스가 바깥으로 새지 않게 ────────────────
    const ob = await ev(`getComputedStyle(document.getElementById('yt-lb-uplist')).overscrollBehaviorY`);
    if (ob !== 'contain') fail(`[overscroll] 목록에 overscroll-behavior:contain이 없음 (${ob}) — 바운스가 바깥으로 번진다`);
    else ok('[overscroll] 목록 overscroll-behavior:contain 적용됨');

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 재생 모드 스와이프 소유권 테스트 전부 통과' : '\n💥 재생 모드 스와이프 소유권 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
