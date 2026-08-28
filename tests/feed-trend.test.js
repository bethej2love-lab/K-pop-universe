// 탐험 패널 "Trend" 선반 회귀 테스트 (2026-08-25 신설)
//
// 사용자 요청: "Today's Anniversary 밑에 Trend 카테고리를 만들어 최근 7일 업로드 영상을 랜덤하게.
// 지금 Discovery의 Trend 하나로는 최신 영상이 충분히 안 보인다. 가로 스크롤, 썸네일은 Charts와 같은 크기."
//
// Discovery의 기존 Trend 카드와 목적이 다르다: 그건 category='live' **조회수 상위**를 한 장으로 접어
// 두는 카드(눌러야 목록)고, 이 선반은 **업로드일 기준 최근 7일**을 개별 영상으로 바로 펼친다.
//
// ⚠️ 헤드리스엔 Supabase가 없어 실제 조회 경로(_buildFeedTrend의 쿼리)는 못 탄다. 그래서 여기서는
//    **데이터와 무관하게 성립해야 하는 계약**만 검증한다:
//      · 섹션이 기념일 바로 밑에 있고 제목이 Trend인가
//      · 데이터가 없으면 선반이 숨겨지는가(빈 제목만 덜렁 남으면 안 됨)
//      · 카드 폭이 Charts와 **같은가**(사용자 요구가 "차트와 동일 크기")
//      · 가로 드래그/휠 스크롤이 바인딩되는가 — ⚠️ 이 레포의 고질 함정: 메인 <script>가 #feed-body보다
//        먼저 끝나서 최상단 바인딩은 조용히 무시된다(실제로 여기 있던 #feed-anniv 휠 핸들러가 그 이유로
//        죽은 코드였다). 지연 바인딩이 실제로 걸리는지 본다.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/feed-trend.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8963;
const CDP_PORT = 9363;
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

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — Trend 선반 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-feedtrend-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[feed-trend] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  const errors = [];
  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    cdp.send('Runtime.enable');
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
    for (let i = 0; i < 40; i++) { if (await ev("typeof _buildFeedTrend==='function'")) break; await sleep(400); }

    // 탐험 패널을 실제로 연다(선반 렌더는 패널 오픈 시점에 돈다)
    await ev(`document.getElementById('tab-feed')?.click()`);
    await sleep(3500);

    // ── 1. 선반이 기념일 바로 밑에 있고 제목이 Trend인가 ─────────────────────────
    const layout = JSON.parse(await ev(`(function(){
      const secs=[...document.querySelectorAll('#feed-body .feed-section')];
      const titles=secs.map(s=>(s.querySelector('.feed-section-ttl')||{}).textContent||'');
      const iAnniv=secs.findIndex(s=>s.id==='feed-anniv-section');
      const iTrend=secs.findIndex(s=>s.id==='feed-trend-section');
      return JSON.stringify({titles:titles.map(t=>t.trim()),iAnniv:iAnniv,iTrend:iTrend});})()`) || '{}');
    if (layout.iTrend < 0) fail('[배치] #feed-trend-section이 없음');
    else if (layout.iTrend !== layout.iAnniv + 1) fail(`[배치] Trend가 기념일 바로 밑이 아님 (anniv=${layout.iAnniv}, trend=${layout.iTrend}) — 순서: ${layout.titles.join(' / ')}`);
    else if (!/Trend/.test(layout.titles[layout.iTrend])) fail(`[배치] 제목이 Trend가 아님 — "${layout.titles[layout.iTrend]}"`);
    else ok(`[배치] ${layout.titles.join(' / ')}`);

    // ── 2. 데이터가 없으면 선반이 숨겨져야 한다(빈 제목만 남으면 안 됨) ────────────
    // 헤드리스엔 Supabase가 없어 쿼리가 실패한다 = "데이터 0건" 상황과 같다.
    const empty = await ev(`(function(){const s=document.getElementById('feed-trend-section');
      return JSON.stringify({display:getComputedStyle(s).display,children:document.getElementById('feed-trend').children.length});})()`);
    const e1 = JSON.parse(empty || '{}');
    if (e1.children === 0 && e1.display !== 'none') fail(`[빈 상태] 항목이 0개인데 섹션이 보임(display=${e1.display}) — 제목만 덜렁 남는다`);
    else ok(`[빈 상태] 데이터 없으면 섹션 숨김 (display=${e1.display}, 항목 ${e1.children}개)`);

    // ── 3. 카드 폭이 Charts와 같은가 (사용자 요구: "차트 쪽 썸네일 크기와 동일") ────
    const width = JSON.parse(await ev(`(function(){
      const sec=document.getElementById('feed-trend-section'),strip=document.getElementById('feed-trend');
      sec.style.display='';
      _appendFeedCard(strip,'📈','테스트 영상 제목','세이마이네임 · 2일 전',function(){},'');
      const t=document.querySelector('#feed-trend>.feed-card');
      const c=document.querySelector('#feed-chart>.feed-card');
      const g=el=>el?{w:Math.round(el.getBoundingClientRect().width),
        title:getComputedStyle(el.querySelector('.feed-card-title')).fontSize,
        radius:getComputedStyle(el).borderRadius}:null;
      return JSON.stringify({trend:g(t),chart:g(c)});})()`) || '{}');
    if (!width.trend) fail('[크기] Trend 카드가 안 그려짐');
    else if (!width.chart) fail(`[크기] 비교할 Charts 카드가 없음 — Trend는 ${width.trend.w}px`);
    else if (width.trend.w !== width.chart.w) fail(`[크기] Trend ${width.trend.w}px ≠ Charts ${width.chart.w}px`);
    else if (width.trend.title !== width.chart.title) fail(`[크기] 제목 글자 크기가 다름 (${width.trend.title} vs ${width.chart.title})`);
    else ok(`[크기] Charts와 동일 — 폭 ${width.trend.w}px, 제목 ${width.trend.title}, 라운드 ${width.trend.radius}`);

    // ── 4. 가로 스크롤 바인딩(이 레포 고질 함정: 최상단 바인딩은 조용히 무시된다) ────
    const scroll = JSON.parse(await ev(`(function(){
      const strip=document.getElementById('feed-trend');
      for(let i=0;i<12;i++)_appendFeedCard(strip,'📈','아주 긴 테스트 영상 제목 '+i,'그룹 · 1일 전',function(){},'');
      return JSON.stringify({dragBound:!!strip._dragScrollBound,
        overflowX:getComputedStyle(strip).overflowX,
        scrollable:strip.scrollWidth>strip.clientWidth,
        sw:strip.scrollWidth,cw:strip.clientWidth});})()`) || '{}');
    if (!scroll.dragBound) fail('[스크롤] _enableDragScroll이 안 걸림 — 데스크톱에서 드래그·휠로 못 넘긴다(최상단 바인딩은 #feed-body보다 먼저 실행돼 무시된다)');
    else if (scroll.overflowX !== 'auto' && scroll.overflowX !== 'scroll') fail(`[스크롤] overflow-x가 ${scroll.overflowX}`);
    else if (!scroll.scrollable) fail(`[스크롤] 카드 13개인데 가로로 안 넘침 (${scroll.sw} ≤ ${scroll.cw})`);
    else ok(`[스크롤] 드래그 바인딩 + 가로 넘침 ${scroll.sw}px > ${scroll.cw}px`);

    // ── 5. 기준값(최근 7일)이 요청대로인가 ─────────────────────────────────────
    const days = await ev(`typeof _FEED_TREND_DAYS!=='undefined'?_FEED_TREND_DAYS:null`);
    if (days !== 7) fail(`[기준] 최근 N일이 ${days} — 요청은 7일`);
    else ok('[기준] 최근 7일 업로드 기준');

    const real = errors.filter(e => !/favicon|404|Failed to load resource|supabase|fetch/i.test(e));
    if (real.length) fail(`콘솔 예외 ${real.length}건: ${real.slice(0, 2).join(' | ')}`);
    else ok('선반 렌더 중 예외 0건');

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 Trend 선반 테스트 전부 통과' : '\n💥 Trend 선반 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
