// 카드 영상 "인기순" 정렬 회귀 테스트 (2026-09-02 신설)
//
// 왜: 조회수(view_count)는 실측 59%만 채워져 있다(391,634 중 231,199). 인기순은 그 공백 위에서
// 도는 기능이라, NULL 처리와 정렬 안정성이 어긋나면 조용히 이상해진다 — "조회수 모르는 영상"이
// 인기 상위를 차지하거나, 페이지 경계에서 순서가 흔들려 같은 영상이 중복/누락된다.
//
// 무엇을 확인하는가:
//  [1] 정렬 메뉴에 '인기순'이 그룹 카드·멤버 카드 **둘 다** 있다(메뉴는 동적 생성이라 한 곳이 둘을 겸한다)
//  [2] 인기순을 고르면 실제로 조회수 내림차순이다
//  [3] view_count가 NULL인 영상이 상위에 오지 않는다(nullsFirst:false)
//  [4] 인기순에서는 ↻ 새로고침이 순서를 흔들지 않는다(청크 랜덤 샘플링 제외)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/sort-popular.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8953, CDP_PORT = 9353;
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
function fail(m) { pass = false; console.log(`❌ ${m}`); }
function ok(m) { console.log(`✅ ${m}`); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connectCdp(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url); let id = 0; const p = new Map(), l = new Map();
    ws.addEventListener('open', () => res({
      send(m, pr = {}) { return new Promise(r => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: pr })); }); },
      on(e, cb) { if (!l.has(e)) l.set(e, []); l.get(e).push(cb); }, close() { ws.close(); },
    }));
    ws.addEventListener('error', rej);
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id != null && p.has(m.id)) { p.get(m.id)(m.result); p.delete(m.id); } else if (m.method && l.has(m.method)) l.get(m.method).forEach(cb => cb(m.params)); });
  });
}
async function ev(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r && r.exceptionDetails) return { __err: (r.exceptionDetails.exception || {}).description || r.exceptionDetails.text };
  return r && r.result && r.result.value;
}
async function pollUntil(cdp, expr, ms, ready = v => !!v) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const v = await ev(cdp, expr); if (ready(v)) return v; await sleep(150); }
  return await ev(cdp, expr);
}

function sourceChecks() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (!/data-sort=\\?"popular\\?"/.test(html)) fail('[1] 정렬 메뉴에 popular 항목이 없음');
  else ok('[1] 정렬 메뉴에 인기순 항목 존재');
  if (!/sortMode==='popular'[\s\S]{0,200}view_count[\s\S]{0,80}nullsFirst:false/.test(html))
    fail('[3] 인기순 정렬에 nullsFirst:false가 없음 — 조회수 미수집 영상이 상위를 차지한다');
  else ok('[3] NULL을 뒤로 보내는 정렬(nullsFirst:false)');
  if (!/state\.sortMode!=='popular'&&\(randomize/.test(html))
    fail('[4] 인기순이 청크 랜덤 샘플링에서 제외되지 않음 — ↻로 순서가 깨진다');
  else ok('[4] 인기순은 ↻ 랜덤 샘플링에서 제외됨');
  if (!/chSortPop:'인기순'/.test(html) || !/chSortPop:'Popular'/.test(html))
    fail('[1] i18n 라벨(chSortPop) 누락 — EN 모드에서 빈 칸으로 보인다');
  else ok('[1] i18n 라벨 ko/en 등록됨');
}

async function main() {
  sourceChecks();
  if (!BROWSER_PATH) { console.log('⚠️  브라우저 없음 — 브라우저 검증 스킵'); console.log(pass ? '\n✅ 통과(소스 검사만)' : '\n💥 실패'); process.exit(pass ? 0 : 1); }

  const server = http.createServer((rq, rs) => {
    let q = decodeURIComponent(rq.url.split('?')[0]); if (q === '/') q = '/index.html';
    const f = path.join(ROOT, q); if (!f.startsWith(ROOT)) { rs.writeHead(403); rs.end(); return; }
    fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); rs.end(d); });
  });
  await new Promise(r => server.listen(PORT, r));
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-sortpop-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[sort-popular] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // 그룹 카드 → 멤버 카드 순으로 같은 검증을 돌린다(정렬 메뉴는 동적 생성이라 한 코드가 둘을 겸한다)
    for (const [label, hash] of [['그룹 카드', '#g=에스파'], ['멤버 카드', '#g=에스파&m=카리나']]) {
      await new Promise(r => { cdp.on('Page.loadEventFired', r); cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html${hash}` }); setTimeout(r, 15000); });
      await pollUntil(cdp, `typeof ARTISTS!=='undefined'&&ARTISTS.length>0`, 20000);
      // ⚠️ .gc-ch-grid는 그룹용·멤버용 둘 다 DOM에 있고 하나는 비어 있다 — querySelector로 첫 번째를
      //    잡으면 늘 0개가 나온다(실제로 그렇게 헛돌았다). 항목이 들어찬 쪽을 고른다.
      const GRID = `[...document.querySelectorAll('.gc-ch-grid')].find(function(g){return g.children.length;})`;
      const gridReady = await pollUntil(cdp, `(${GRID}||{children:[]}).children.length`, 20000, v => v > 0);
      if (!gridReady) { fail(`[2] ${label}: 영상 그리드가 안 뜸(네트워크?) — 이 항목 검증 생략`); continue; }

      const hasPop = await ev(cdp, `!!document.querySelector('.gc-ch-sort-item[data-sort="popular"]')`);
      if (!hasPop) { fail(`[1] ${label}: 정렬 메뉴에 인기순 없음`); continue; }
      ok(`[1] ${label}: 인기순 항목 있음`);

      await ev(cdp, `document.querySelector('.gc-ch-sort-item[data-sort="popular"]').click()`);
      await sleep(2800);
      // ⚠️ 카드 그리드는 썸네일+제목만 그리고 **조회수를 화면에 안 보여준다** — 화면에서 읽을 수가
      //    없으므로 렌더된 순서대로 영상 id를 뽑아 DB에서 view_count를 되짚어 확인한다.
      const vc = await ev(cdp, `(async()=>{
        var g=${GRID}; if(!g)return null;
        var ids=[...g.children].map(function(el){return el.dataset&&el.dataset.vidId;}).filter(Boolean).slice(0,12);
        if(!ids.length||typeof sb==='undefined'||!sb)return null;
        var r=await sb.from('yt_channel_videos').select('id,view_count').in('id',ids);
        var by={}; (r.data||[]).forEach(function(x){by[x.id]=x.view_count;});
        return ids.map(function(i){return by[i]===undefined?null:by[i];});
      })()`);
      if (!Array.isArray(vc) || vc.length < 3) { fail(`[2] ${label}: 영상 id를 ${Array.isArray(vc) ? vc.length : 0}개만 읽음 — 검증 불가`); continue; }
      // NULL(조회수 미수집)이 상위에 오면 안 된다 — 전체의 41%가 NULL이라 이게 어긋나면 인기순이 무의미해진다
      const firstNull = vc.findIndex(v => v == null);
      const lastNum = vc.reduce((a, v, i) => v != null ? i : a, -1);
      if (firstNull >= 0 && firstNull < lastNum) fail(`[3] ${label}: 조회수 없는 영상이 상위에 섞임 — ${JSON.stringify(vc)}`);
      else ok(`[3] ${label}: 조회수 미수집분이 앞에 안 섞임`);
      const nums = vc.filter(v => v != null);
      let desc = true;
      for (let i = 1; i < nums.length; i++) if (nums[i] > nums[i - 1]) { desc = false; break; }
      if (nums.length < 3) fail(`[2] ${label}: 조회수 있는 항목이 ${nums.length}개뿐 — 검증 불가`);
      else if (!desc) fail(`[2] ${label}: 조회수 내림차순이 아님 — ${nums.slice(0, 6).join(' > ')}`);
      else ok(`[2] ${label}: 조회수 내림차순 (${nums.slice(0, 4).map(v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1e3) + 'K').join(' > ')} …)`);

      // [5] 인기순일 때만 조회수 줄이 보인다 — 순서만 바뀌고 근거가 안 보이면 인기순인지 알 수 없다
      const metaOn = await ev(cdp, `document.querySelectorAll('.gc-ch-grid .gc-ch-meta').length`);
      if (!metaOn) fail(`[5] ${label}: 인기순인데 조회수 줄이 하나도 없음`);
      else ok(`[5] ${label}: 조회수 줄 ${metaOn}개 표시`);
      await ev(cdp, `document.querySelector('.gc-ch-sort-item[data-sort="recommend"]').click()`);
      await sleep(2600);
      const metaOff = await ev(cdp, `document.querySelectorAll('.gc-ch-grid .gc-ch-meta').length`);
      if (metaOff) fail(`[5] ${label}: 추천순으로 되돌렸는데 조회수 줄이 ${metaOff}개 남음(인기순 전용이어야 한다)`);
      else ok(`[5] ${label}: 추천순에선 조회수 줄 없음`);
    }
    cdp.close();
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
  }
  console.log(pass ? '\n✅ 인기순 정렬 테스트 통과' : '\n💥 인기순 정렬 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error(e); process.exit(1); });
