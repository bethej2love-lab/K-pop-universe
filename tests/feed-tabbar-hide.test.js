// 탐험(나침반) 패널의 탭바 스크롤 자동숨김 (2026-09-18 신설, 사용자 요청)
//
// 카드 시트가 하던 "아래로 스크롤하면 탭바 숨김 / 위로 올리면 복귀"를 탐험 패널에도 적용했다.
// ⚠️ 구현은 _wireSheetTabbarHide를 **재사용**한다 — 그 함수엔 iOS 고무줄 구간 방향 반전, 탭바가 숨을 때
//    브라우저가 스크롤을 당기는 양 상쇄(clampShift), 방향 전환 시 누적 리셋, 최상단 40px 안전망까지
//    네 번의 버그 수정이 녹아 있다. 두 번째 구현을 만들면 그 넷을 처음부터 다시 밟게 된다.
//
// 이 테스트가 지키는 것:
//  ① 전체 열림에서만 동작하고 **peek(반 열림)에선 안 한다** — peek는 "이거 볼래? 아님 말고" 수준의 가벼운
//     제안 상태라 높이가 짧고, 거기서 탭바까지 사라지면 "닫혔나?"로 읽힌다(사용자 확인).
//  ② 탭바가 숨으면 #feed-body 아래 여백과 .gc-totop 위치가 **같이** 따라온다 — 안 따라오면 빈칸만 남아
//     숨긴 의미가 없고, 버튼은 허공에 뜬다.
//  ③ 탐험 패널 위에 카드가 열리면 **카드가** 탭바를 쥔다(_activeSheetScroller 중재) — 안 그러면 두
//     컨테이너가 탭바를 숨겼다 켰다 하며 싸운다.
//  ④ 열고/닫을 때 탭바 상태를 진입 시점에 **못박는다**. 스크롤 핸들러의 최상단 안전망에 기대면 안 된다 —
//     목록이 짧아 스크롤이 아예 안 되면 scroll 이벤트가 한 번도 안 와서 안전망이 영영 안 돈다
//     (사파리는 주소창 때문에 세로가 짧아 거의 항상 스크롤돼 이 버그를 덮고, 홈화면 웹앱에서만 터진다).
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/feed-tabbar-hide.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8959;
const CDP_PORT = 9359;
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
    ws.addEventListener('message', e => {
      const msg = JSON.parse(e.data);
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

// 실측 상태 묶음. --sheet-bottom / padding / totop을 같이 봐야 "따라오는 것들"까지 검증된다.
const STATE = `(function(){
  const tb=document.getElementById('tabbar'),fb=document.getElementById('feed-body'),fo=document.getElementById('feed-overlay');
  const tt=document.querySelector('.gc-totop');
  return {hidden:tb.classList.contains('tab-hidden'),
    pad:parseFloat(getComputedStyle(fb).paddingBottom)||0,
    totop:tt?(parseFloat(getComputedStyle(tt).bottom)||0):null,
    sheetBottom:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-bottom'))||0,
    scrollable:fb.scrollHeight-fb.clientHeight, top:Math.round(fb.scrollTop),
    peek:fo.classList.contains('peek'), open:fo.classList.contains('open'),
    activeIsFeed:_activeSheetScroller()===fb};})()`;
// 손가락처럼 여러 번 나눠서 굴린다 — 한 번에 점프하면 델타 누적(_TB_HIDE_DELTA=28) 판정을 못 탄다.
const scrollBy = async (cdp, from, step, n) => {
  for (let i = 1; i <= n; i++) { await ev(cdp, `(function(){document.getElementById('feed-body').scrollTop=${from + step * i};return 1;})()`); await sleep(90); }
  await sleep(700);
};

(async () => {
  if (!BROWSER_PATH) { console.log('⏭️  브라우저를 못 찾음 — 스킵'); process.exit(0); }
  server.listen(PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-ftb-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[feed-tabbar-hide] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.clear();localStorage.setItem('kpu_visit_count','9');}catch(e){}` });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 80; i++) { if (await ev(cdp, `(typeof bubbleMeshes!=='undefined'&&bubbleMeshes.length>0)`)) break; await sleep(500); }
    await sleep(5500);
    if (!await ev(cdp, `isMob()`)) { bad('모바일 뷰포트가 아님'); throw new Error('viewport'); }

    // ⚠️ 부팅 직후엔 온보딩이 패널을 **peek**으로 자동으로 열어둔다(_showOnboardHint) — 그 상태로 재면
    //    "전체 열림" 경로를 한 번도 안 밟는다(이 테스트를 처음 짰을 때 실제로 그랬다). 닫았다 다시 연다.
    await ev(cdp, `(function(){if(document.getElementById('feed-overlay').classList.contains('open'))_closeFeedOverlay();return 1;})()`);
    await sleep(600);
    await ev(cdp, `(function(){_openFeedOverlay();return 1;})()`);
    await sleep(9000);
    await ev(cdp, `(function(){document.getElementById('feed-overlay').classList.remove('peek');return 1;})()`);
    await sleep(500);

    const open = await ev(cdp, STATE);
    (open.open && !open.peek) ? ok('사전조건: 탐험 패널 전체 열림') : bad(`사전조건 실패 ${JSON.stringify(open)}`);
    open.scrollable > 400 ? ok(`스크롤 가능(${open.scrollable}px)`) : bad(`콘텐츠가 짧아 스크롤 불가(${open.scrollable}px) — 판정 불가`);
    open.activeIsFeed ? ok('_activeSheetScroller가 feed-body를 가리킴') : bad('중재자가 feed-body를 안 잡음 — 스크롤해도 탭바에 손대지 않는다');
    !open.hidden ? ok('④ 열린 직후 탭바 보임(진입 시점 못박기)') : bad('④ 열자마자 탭바가 숨어 있음');

    // ── ① 아래로 스크롤 → 숨김 + ② 따라오는 것들 ──
    await ev(cdp, `(function(){document.getElementById('feed-body').scrollTop=0;return 1;})()`); await sleep(400);
    await scrollBy(cdp, 0, 40, 8);
    const down = await ev(cdp, STATE);
    down.hidden ? ok('① 아래로 스크롤하면 탭바 숨김') : bad('① 아래로 스크롤해도 탭바가 그대로');
    down.sheetBottom === 0 ? ok('--sheet-bottom이 0으로') : bad(`--sheet-bottom이 ${down.sheetBottom}`);
    (down.pad < open.pad - 20) ? ok(`② #feed-body 아래 여백이 같이 줄어듦 (${open.pad}→${down.pad}px)`)
                               : bad(`② 여백이 그대로(${down.pad}px) — 탭바만 숨고 빈칸이 남는다`);
    (down.totop != null && down.totop < open.totop - 20) ? ok(`② 맨 위로 버튼도 내려옴 (${open.totop}→${down.totop}px)`)
                                                        : bad(`② 버튼이 허공에 뜸(${down.totop}px)`);
    // 홈 인디케이터 제스처 영역 침범 방지 — 안전영역 하한(max())이 살아 있는지
    (down.totop != null && down.totop >= 5) ? ok(`버튼이 화면 밑변에 붙지 않음(${down.totop}px)`) : bad(`버튼이 너무 아래(${down.totop}px)`);

    // ── 위로 스크롤 → 복귀 ──
    await scrollBy(cdp, 320, -40, 6);
    const up = await ev(cdp, STATE);
    !up.hidden ? ok('① 위로 스크롤하면 탭바 복귀') : bad('① 위로 올려도 탭바가 안 돌아옴');
    (up.pad === open.pad && up.totop === open.totop) ? ok('② 여백·버튼도 원복') : bad(`② 원복 안 됨(pad ${up.pad}, totop ${up.totop})`);

    // ── ① peek에선 자동숨김 안 함 ──
    await ev(cdp, `(function(){document.getElementById('feed-overlay').classList.add('peek');return 1;})()`);
    await sleep(400);
    const pk = await ev(cdp, STATE);
    !pk.activeIsFeed ? ok('① peek에선 중재자가 feed-body를 안 잡음') : bad('① peek인데 자동숨김 대상이 됨');
    await scrollBy(cdp, 400, 40, 8);
    const pkDown = await ev(cdp, STATE);
    !pkDown.hidden ? ok('① peek에서 아래로 스크롤해도 탭바 유지') : bad('① peek에서 탭바가 숨음 — "닫혔나?"로 읽힌다');
    await ev(cdp, `(function(){document.getElementById('feed-overlay').classList.remove('peek');return 1;})()`);
    await sleep(400);

    // ── ③ 탐험 패널 위에 카드가 열리면 카드가 탭바를 쥔다 ──
    await ev(cdp, `(function(){const bm=bubbleMeshes[0];showGC(bm.ko,195,400);return 1;})()`);
    await sleep(1600);
    const arb = await ev(cdp, `(function(){const fb=document.getElementById('feed-body');
      return {feed:_activeSheetScroller()===fb,card:_activeSheetScroller()===mobSheetInner};})()`);
    (arb.card && !arb.feed) ? ok('③ 카드가 위에 열리면 카드가 탭바를 쥠(서로 안 싸움)')
                            : bad(`③ 중재 실패 ${JSON.stringify(arb)}`);
    await ev(cdp, `(function(){closeCards();return 1;})()`);
    await sleep(900);

    // ── ④ 스크롤 내린 채 닫아도 탭바가 남지 않는다 ──
    await ev(cdp, `(function(){_openFeedOverlay();document.getElementById('feed-overlay').classList.remove('peek');return 1;})()`);
    await sleep(2500);
    await scrollBy(cdp, 0, 40, 8);
    const beforeClose = await ev(cdp, STATE);
    beforeClose.hidden ? ok('닫기 직전 탭바가 숨은 상태를 만듦') : bad('사전조건: 탭바가 안 숨음');
    await ev(cdp, `(function(){_closeFeedOverlay();return 1;})()`);
    await sleep(700);
    const closed = await ev(cdp, STATE);
    !closed.hidden ? ok('④ 내린 채 닫아도 탭바가 돌아옴(우주에 탭바 없이 남지 않음)') : bad('④ 닫았는데 탭바가 사라진 채 남음');
    closed.sheetBottom > 0 ? ok('--sheet-bottom도 복구') : bad('--sheet-bottom이 0인 채 남음');
  } catch (e) {
    bad(`예외: ${e.message}`);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
