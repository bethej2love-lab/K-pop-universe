// 탐험 패널 "Trend" 선반 회귀 테스트 (2026-08-25 신설)
//
// 사용자 요청: "Today's Anniversary 밑에 Trend 카테고리를 만들어 최근 7일 업로드 영상을 랜덤하게.
// 지금 Discovery의 Trend 하나로는 최신 영상이 충분히 안 보인다. 가로 스크롤, 썸네일은 Charts와 같은 크기."
//
// Discovery의 기존 Trend 카드와 목적이 다르다: 그건 category='live' **조회수 상위**를 한 장으로 접어
// 두는 카드(눌러야 목록)고, 이 선반은 **업로드일 기준 최근 7일**을 개별 영상으로 바로 펼친다.
//
// ⚠️ 2026-08-28 정정: "헤드리스엔 Supabase가 없다"는 전제는 틀렸다 — --ignore-certificate-errors 를
//    주면 회사망 TLS 가로채기를 넘어 실제 조회가 된다. 그 전제 때문에 "선반이 실제로 채워지는가"를
//    검증하지 않았고, _buildFeedTrend가 통째로 실패해도 전부 통과했다(검사 6번 참고). 아래는
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
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — Trend 선반 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-feedtrend-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--ignore-certificate-errors', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[feed-trend] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

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

    // ── 2. 항목이 0개면 섹션이 숨겨져야 한다(빈 제목만 덜렁 남으면 안 됨) ──────────
    // 네트워크가 되면 여긴 대개 채워진 상태로 지나간다. "비었을 때 숨는가"만 보는 검사이고,
    // "채워지는가"는 아래 6번이 본다(둘을 한 검사로 합치면 어느 쪽도 제대로 못 본다).
    const empty = await ev(`(function(){const s=document.getElementById('feed-trend-section');
      return JSON.stringify({display:getComputedStyle(s).display,children:document.getElementById('feed-trend').children.length});})()`);
    const e1 = JSON.parse(empty || '{}');
    if (e1.children === 0 && e1.display !== 'none') fail(`[빈 상태] 항목이 0개인데 섹션이 보임(display=${e1.display}) — 제목만 덜렁 남는다`);
    else ok(`[빈 상태] 0개면 숨김 규칙 성립 (display=${e1.display}, 항목 ${e1.children}개)`);

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

    // ── 6. 진짜 데이터로 선반이 **채워지는가** ──────────────────────────────────
    // ⚠️ 이 검사가 없어서 실제 버그를 놓쳤다(2026-08-28). 위 1~5는 "빈 상태도 정상"으로 통과하므로,
    //    _buildFeedTrend 안에서 예외가 나 선반이 통째로 안 떠도 전부 초록이었다(vidUrl 지역 정의
    //    누락 → ReferenceError → catch가 삼킴). 헤드리스에도 Supabase가 없다는 전제가 틀렸다 —
    //    --ignore-certificate-errors 를 주면 실제 조회가 된다.
    const probe = JSON.parse(await ev(`(async function(){
      try{
        var since=new Date(Date.now()-_FEED_TREND_DAYS*86400000).toISOString().slice(0,10);
        var r=await sb.from(_YT_TABLE).select('id').gte('published_at',since).limit(5);
        return JSON.stringify({rows:r.data?r.data.length:0,err:r.error?r.error.message:null});
      }catch(e){return JSON.stringify({rows:0,err:String(e&&e.message||e)});}
    })()`) || '{}');
    if (!probe.rows) {
      console.log(`⚠️  최근 ${await ev('_FEED_TREND_DAYS')}일 영상을 못 받아옴(${probe.err || '0건'}) — 실렌더 검사 스킵`);
    } else {
      const filled = JSON.parse(await ev(`(async function(){
        var strip=document.getElementById('feed-trend'),sec=document.getElementById('feed-trend-section');
        strip.innerHTML='';sec.style.display='none';
        await _buildFeedTrend();
        var first=strip.querySelector('.feed-card');
        return JSON.stringify({cards:strip.children.length,display:getComputedStyle(sec).display,
          sub:first?(first.querySelector('.feed-card-sub')||{}).textContent||'':''});
      })()`) || '{}');
      if (!filled.cards) fail(`[실렌더] DB에 최근 ${probe.rows}건 이상 있는데 선반이 비었다 — _buildFeedTrend 안에서 예외가 났고 catch가 삼켰을 가능성이 높다(콘솔 경고 확인)`);
      else if (filled.display === 'none') fail(`[실렌더] 카드는 ${filled.cards}개 붙었는데 섹션이 여전히 숨김 — display 해제가 안 됨`);
      else ok(`[실렌더] 실제 데이터로 ${filled.cards}장 렌더 (예: "${filled.sub}")`);
    }

    // supabase/fetch를 통째로 무시하면 위 같은 삼킨 예외를 영영 못 본다 — 선반 실패 경고만은 잡는다.
    const shelfWarn = errors.filter(e => /Trend 선반 실패/.test(e));
    if (shelfWarn.length) fail(`[실렌더] 선반이 예외로 실패: ${shelfWarn[0]}`);
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
