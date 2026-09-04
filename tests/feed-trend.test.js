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
//      · 섹션이 Charts 바로 밑에 있고 제목이 Trend인가
//      · 데이터가 없으면 선반이 숨겨지는가(빈 제목만 덜렁 남으면 안 됨)
//      · 2열 그리드로 그려지는가 · 전체폭 승격이 동작하는가(쇼츠 포함)
//
// ⚠️ 2026-09-04 계약 갱신 — 이 테스트는 8/30 구조 변경을 따라오지 못해 3건이 계속 빨갛게 떠 있었다.
//    바뀐 것:
//      · Trend가 **가로 스트립 → 2열 그리드**(.feed-grid)가 됐다. 그래서 "카드 폭이 Charts(158px 고정)와
//        같은가"와 "가로 드래그 스크롤이 걸리는가"는 **더 이상 성립할 수 없는 계약**이다 — 코드가 아니라
//        테스트가 낡은 것이었다. 각각 "2열 그리드인가"와 "전체폭 승격이 되는가"로 바꿨다.
//      · 그 사이에 📊 Charts 섹션이 새로 생겨(2026-08-21) Trend는 기념일이 아니라 **Charts 바로 밑**이다.
//    ⚠️ 이 테스트는 CI 스킵 목록(.github/workflows/data-and-tests.yml)에 있다(브라우저 필요). 그래서
//       빨간 채로 몇 주를 갔다 — PRINCIPLES의 "감지는 되는데 아무도 안 보는" 실패 모드 그대로다.
//       구조를 바꿀 땐 이 파일도 같이 손볼 것.
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

    // ── 1. 선반이 Charts 바로 밑에 있고 제목이 Trend인가 ─────────────────────────
    // 원래 요청은 "기념일 밑"이었지만 그 사이 📊 Charts 섹션이 생겨(2026-08-21 랭킹류 분리) 기념일과
    // Trend 사이에 들어왔다. 지금 지켜야 할 계약은 "기념일 → Charts → Trend" 순서다.
    const layout = JSON.parse(await ev(`(function(){
      const secs=[...document.querySelectorAll('#feed-body .feed-section')];
      const titles=secs.map(s=>(s.querySelector('.feed-section-ttl')||{}).textContent||'');
      const iAnniv=secs.findIndex(s=>s.id==='feed-anniv-section');
      const iChart=secs.findIndex(s=>s.querySelector('#feed-chart'));
      const iTrend=secs.findIndex(s=>s.id==='feed-trend-section');
      return JSON.stringify({titles:titles.map(t=>t.trim()),iAnniv:iAnniv,iChart:iChart,iTrend:iTrend});})()`) || '{}');
    if (layout.iTrend < 0) fail('[배치] #feed-trend-section이 없음');
    else if (layout.iChart < 0) fail('[배치] Charts 섹션(#feed-chart)이 없음');
    else if (!(layout.iAnniv < layout.iChart)) fail(`[배치] 기념일이 Charts보다 뒤 (anniv=${layout.iAnniv}, chart=${layout.iChart}) — 순서: ${layout.titles.join(' / ')}`);
    else if (layout.iTrend !== layout.iChart + 1) fail(`[배치] Trend가 Charts 바로 밑이 아님 (chart=${layout.iChart}, trend=${layout.iTrend}) — 순서: ${layout.titles.join(' / ')}`);
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

    // ── 3. 2열 그리드로 그려지는가 (2026-08-30 가로 스트립 → 그리드) ───────────────
    // 예전 계약은 "카드 폭이 Charts와 동일(158px)"이었는데, Trend가 그리드가 되면서 카드가 컨테이너
    // 폭에 따라 늘어나는 1fr이 됐다. 고정폭 스트립인 Charts와 같을 수가 없다 — 지금 지켜야 할 건
    // "2열이고, 반폭 카드 둘이 한 행에 들어간다"이다.
    const grid = JSON.parse(await ev(`(function(){
      const sec=document.getElementById('feed-trend-section'),strip=document.getElementById('feed-trend');
      sec.style.display='';strip.innerHTML='';
      for(let i=0;i<4;i++)_appendFeedCard(strip,'📈','테스트 영상 제목 '+i,'세이마이네임 · 2일 전',function(){},'');
      const cs=getComputedStyle(strip);
      const cards=[...strip.querySelectorAll('.feed-card')];
      const w=Math.round(strip.getBoundingClientRect().width);
      const c0=cards[0]?Math.round(cards[0].getBoundingClientRect().width):0;
      const tops=cards.map(c=>Math.round(c.getBoundingClientRect().top));
      return JSON.stringify({cls:strip.className,display:cs.display,
        cols:cs.gridTemplateColumns.split(' ').filter(Boolean).length,
        stripW:w,cardW:c0,sameRow:tops[0]===tops[1]});})()`) || '{}');
    if (!/feed-grid/.test(grid.cls || '')) fail(`[그리드] #feed-trend에 .feed-grid가 없음 — class="${grid.cls}"`);
    else if (grid.display !== 'grid') fail(`[그리드] display가 ${grid.display} (grid여야 함)`);
    else if (grid.cols !== 2) fail(`[그리드] 열이 ${grid.cols}개 — 2열이어야 함`);
    else if (!grid.sameRow) fail('[그리드] 첫 두 카드가 같은 행에 없음(2열 배치가 안 됨)');
    else if (!(grid.cardW > grid.stripW * 0.3 && grid.cardW < grid.stripW * 0.7)) fail(`[그리드] 카드 폭 ${grid.cardW}px가 컨테이너 ${grid.stripW}px의 절반 근처가 아님`);
    else ok(`[그리드] 2열 · 카드 ${grid.cardW}px / 컨테이너 ${grid.stripW}px`);

    // ── 4. 전체폭 승격이 동작하는가 — 가로 + **쇼츠**(2026-09-04 신설) ──────────────
    // 원래 이 자리는 가로 드래그 스크롤 검사였는데 그리드가 되면서 성립하지 않는다. 대신 이 선반의
    // 리듬을 만드는 계약을 본다: _packRows가 (1) 가로를 확률적으로 전체폭으로 올리고 (2) 쇼츠도
    // shortWideProb로 올릴 수 있어야 한다. ⚠️ (2)는 오래 없었던 기능이다 — 승격 조건이 "가로일 때만"
    // 이라 큰 쇼츠가 구조적으로 하나도 안 나왔다. 확률이라 실렌더로 보면 불안정하니 확률을 1로 고정해
    // 결정적으로 검사한다.
    const promo = JSON.parse(await ev(`(function(){
      const items=[];for(let i=0;i<10;i++)items.push({i:i,short:i%2===0});
      const isShort=x=>x.short;
      const wideShort=_packRows(items,isShort,{wideProb:0,minGap:0,shortWideProb:1}).filter(r=>r.wide&&r.short).length;
      const wideNorm=_packRows(items,isShort,{wideProb:1,minGap:0,shortWideProb:0}).filter(r=>r.wide&&!r.short).length;
      const noShortWide=_packRows(items,isShort,{wideProb:1,minGap:0}).filter(r=>r.wide&&r.items.every(isShort)).length;
      const kept=_packRows(items,isShort,{wideProb:0.3,minGap:2}).flatMap(r=>r.items).length;
      return JSON.stringify({wideShort:wideShort,wideNorm:wideNorm,noShortWide:noShortWide,kept:kept});})()`) || '{}');
    if (!(promo.wideNorm > 0)) fail('[전체폭] 가로 영상이 전체폭으로 안 올라감');
    else if (!(promo.wideShort > 0)) fail('[전체폭] shortWideProb=1인데 큰 쇼츠가 0개 — 쇼츠 전체폭 승격이 죽었다');
    else if (promo.noShortWide !== 0) fail(`[전체폭] shortWideProb를 안 줬는데 쇼츠가 전체폭이 됨(${promo.noShortWide}개) — 기본값이 새고 있다`);
    else if (promo.kept !== 10) fail(`[전체폭] 패킹 중 항목 유실 — 10개 중 ${promo.kept}개만 남음`);
    else ok(`[전체폭] 가로 ${promo.wideNorm} · 쇼츠 ${promo.wideShort} · 기본값에선 쇼츠 승격 0 · 유실 없음`);

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
