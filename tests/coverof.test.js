// "다른 아티스트의 커버" 섹션 — 무소속 솔로 회귀 테스트 (2026-08-27)
//
// 왜 만들었나: 같은 버그를 두 번 놓쳤다. 사용자가 "아이유 커버 탭에 다른 아티스트의 커버가 안 뜬다"고
// 제보 → 2026-08-26에 고쳤다고 기록 → 다음 날 "여전히 안 나온다"고 재제보. 원인은 8/26 수정이
// **멤버 카드 분기만** 고쳤고, 정작 아이유·보아 같은 무소속 솔로는 그 분기를 안 타기 때문이었다:
//   showT() → `_hasRealGroup`이 false → `_ttChVidCtl.build(_ytGroupKoFor(a))` = **memberKo 없이** 호출
//   → _loadCoverOfSection이 "그룹 카드"로 판단해 cover_of_groups만 조회
//   → 그런데 커버 태깅은 사람 단위라 cover_of_members에 "아이유(솔로)"로 저장돼 있음 → 0건.
// 실측(2026-08-27): 아이유 "아이유(솔로)" 61건 / "아이유(아이유)" 1건 / cover_of_groups "아이유" 0건.
// 비·보아·이영지·싸이·승한도 전부 같은 이유로 안 보이고 있었다.
//
// 두 번 놓친 진짜 이유는 **조회 키 계산이 두 곳에 흩어져 있었던 것**이라, 이제 `_coverOfQueryKeys`
// 하나로 모았고 이 테스트가 그 계약을 고정한다. 문자열 검사가 아니라 **실제 브라우저에서 카드를 열어**
// 섹션이 그려지는지까지 본다(문자열만 봤다면 8/26 수정도 "통과"했을 것이다).
//
// ⚠️ msedge를 프로세스 이름으로 일괄 kill하지 말 것 — 이 스크립트가 spawn한 PID만 정확히 종료한다.
// ⚠️ 실 Supabase를 읽는다(anon). 네트워크가 막힌 환경에선 스킵된다.
//
// 실행: node tests/coverof.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8941;
const CDP_PORT = 9341;
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = EDGE_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = true;
const ok = m => console.log(`✅ ${m}`);
const fail = m => { pass = false; console.log(`❌ ${m}`); };

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 스킵'); process.exit(0); }

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p);
    if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise(r => server.listen(PORT, r));

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-coverof-'));
  const child = spawn(BROWSER_PATH, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[coverof] 헤드리스 브라우저 PID=${child.pid}`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);

    const ready = await pollUntil(cdp, `typeof ARTISTS!=='undefined' && ARTISTS.length>0 && typeof showT==='function' && !!sb`, 20000);
    if (!ready) { fail('앱 초기화가 안 됨(ARTISTS/showT/sb 미준비) — 나머지 검사 불가'); return; }
    ok('앱 초기화 완료');

    // ── 1) 키 계약: 무소속 솔로는 memberKo 없이도 사람 키가 나와야 한다 ──────────────
    const keys = await evalExpr(cdp, `JSON.stringify(_coverOfQueryKeys('아이유',null))`);
    const k = JSON.parse(keys || '{}');
    if ((k.personKeys || []).includes('아이유(솔로)') && (k.personKeys || []).includes('아이유(아이유)'))
      ok(`_coverOfQueryKeys('아이유',null).personKeys = ${JSON.stringify(k.personKeys)}`);
    else fail(`무소속 솔로 사람 키 누락 — ${keys}`);
    if (k.groupKey === '아이유') ok('솔로 카드도 cover_of_groups를 같이 본다');
    else fail(`groupKey가 '아이유'가 아님 — ${k.groupKey}`);

    // 멤버 카드는 예전 동작 그대로여야(그룹 커버는 그룹 카드 몫) — 회귀 방지
    const km = JSON.parse(await evalExpr(cdp, `JSON.stringify(_coverOfQueryKeys('에스파','카리나'))`) || '{}');
    if (km.groupKey === null && (km.personKeys || []).includes('카리나(에스파)')) ok('멤버 카드(카리나)는 사람 키만 — 기존 동작 유지');
    else fail(`멤버 카드 키가 바뀜 — ${JSON.stringify(km)}`);

    // 그룹 카드도 예전 동작 그대로
    const kg = JSON.parse(await evalExpr(cdp, `JSON.stringify(_coverOfQueryKeys('에스파',null))`) || '{}');
    if ((kg.personKeys || []).length === 0 && kg.groupKey === '에스파') ok('그룹 카드(에스파)는 cover_of_groups만 — 기존 동작 유지');
    else fail(`그룹 카드 키가 바뀜 — ${JSON.stringify(kg)}`);

    // ── 2) 실제로 카드를 열어 섹션이 그려지는지 ─────────────────────────────────────
    // showT()는 솔로면 _ttChVidCtl.build(_ytGroupKoFor(a))로 memberKo 없이 부른다 — 사고가 난 바로 그 경로.
    await evalExpr(cdp, `showT(ARTISTS.find(a=>a.name.ko==='아이유'))`);
    const thumbs = await pollUntil(cdp,
      `(function(){const w=document.querySelector('#tv .tv-cover-of-wrap');return w?w.querySelectorAll('.tv-mix-grid > *').length:0;})()`,
      20000, v => v > 0);
    if (thumbs > 0) ok(`아이유 카드 — "다른 아티스트의 커버" 썸네일 ${thumbs}개 렌더됨`);
    else fail('아이유 카드에 커버 섹션이 여전히 비어 있음(수정 전 증상 그대로)');

    const hd = await evalExpr(cdp, `document.querySelector('#tv .tv-cover-of-hd')?.textContent||''`);
    if (/다른 아티스트의 커버|Covers by Other/.test(hd)) ok(`섹션 제목 확인: "${hd}"`);
    else fail(`섹션 제목이 없음 — "${hd}"`);

    // ── 3) Cover 탭이 실제로 노출되는지(비=Rain은 본인 커버 0건이라 예전엔 탭째로 숨겨졌다) ──
    // 탭 알약은 .gc-ch-filter + textContent 라벨(별도 data 속성 없음) — 실제로 눌러서 섹션이
    // 보이게 되는지까지 확인한다. 섹션은 Cover 탭일 때만 display되므로 이게 최종 사용자 경로다.
    const CLICK_COVER = `(function(){const b=[...document.querySelectorAll('#tv .gc-ch-filter')].find(x=>x.textContent.trim()==='Cover');if(!b)return 'no-tab';b.click();return 'clicked';})()`;
    const WRAP_VISIBLE = `(function(){const w=document.querySelector('#tv .tv-cover-of-wrap');return !!w&&w.style.display!=='none'&&w.querySelectorAll('.tv-mix-grid > *').length>0;})()`;
    const iuClick = await pollUntil(cdp, CLICK_COVER, 8000, v => v === 'clicked');
    if (iuClick !== 'clicked') fail('아이유 카드에 Cover 탭이 없음(탭 노출 판정에서 숨겨짐)');
    else if (await pollUntil(cdp, WRAP_VISIBLE, 8000)) ok('아이유 — Cover 탭 클릭 시 커버 섹션이 실제로 보임');
    else fail('아이유 — Cover 탭을 눌러도 커버 섹션이 안 보임');

    // 비(Rain): 등록된 유튜브 채널이 없어서 예전엔 카드 영상 섹션 자체가 통째로 스킵됐다
    // (showT의 `sb&&(_hasRealGroup||a.links.youtube)` 조건). 채널이 없어도 외부 채널 태깅분과
    // cover_of는 DB에 있으므로 조건을 sb만으로 완화했고, 그 회귀를 여기서 잡는다.
    await evalExpr(cdp, `showT(ARTISTS.find(a=>a.name.ko==='비'))`);
    const rainThumbs = await pollUntil(cdp,
      `(function(){const w=document.querySelector('#tv .tv-cover-of-wrap');return w?w.querySelectorAll('.tv-mix-grid > *').length:0;})()`,
      20000, v => v > 0);
    if (rainThumbs > 0) ok(`비(Rain) 카드 — 커버 섹션 썸네일 ${rainThumbs}개(등록 채널 없어도 도달 가능)`);
    else fail('비(Rain) 카드 커버 섹션이 비어 있음 — 채널 없는 솔로가 DB 경로를 못 타는 회귀 의심');

    const rainClick = await pollUntil(cdp, CLICK_COVER, 8000, v => v === 'clicked');
    if (rainClick !== 'clicked') fail('비 카드에 Cover 탭이 없음 — 탭 노출 판정이 cover_of를 안 보는 회귀 의심');
    else if (await pollUntil(cdp, WRAP_VISIBLE, 8000)) ok('비 — Cover 탭 클릭 시 커버 섹션이 실제로 보임(본인 채널 커버 0건인데도)');
    else fail('비 — Cover 탭을 눌러도 커버 섹션이 안 보임');

  } finally {
    server.close();
    // ⚠️ 프로세스 이름이 아니라 정확한 PID만 종료 — msedge 일괄 kill 금지.
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`); else child.kill('SIGKILL'); } catch (e) { /* 이미 종료 */ }
    for (let i = 0; i < 3; i++) {
      try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch (e) { await sleep(300); }
    }
  }

  console.log(`\n${pass ? '✅ 커버 섹션 테스트 통과' : '❌ 커버 섹션 테스트 실패'}`);
  process.exit(pass ? 0 : 1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitForCdp(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; } catch (e) { await sleep(300); }
  }
  throw new Error('CDP 포트가 안 열림 — 브라우저 실행 실패');
}
function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let msgId = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        return new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
      },
      on(event, cb) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(cb); },
      close() { ws.close(); },
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => {
      const msg = JSON.parse(e.data);
      if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
      else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method).forEach(cb => cb(msg.params));
    });
  });
}
function waitForLoadEvent(cdp) {
  return new Promise(resolve => { cdp.on('Page.loadEventFired', () => resolve()); setTimeout(resolve, 15000); });
}
async function evalExpr(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: false });
  return r?.result?.value;
}
async function pollUntil(cdp, expr, timeoutMs, isReady = v => !!v) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const v = await evalExpr(cdp, expr);
    if (isReady(v)) return v;
    await sleep(200);
  }
  return await evalExpr(cdp, expr);
}

main().catch(e => { console.error('[coverof] 실행 실패:', e); process.exit(2); });
