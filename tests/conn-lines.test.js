// 연결 카드 3D 연결선 회귀 테스트 (2026-08-28 신설)
//
// 사용자 문제 제기: "이 연결 카드라는 형식 자체가 연결을 보여주는 최선일까?"
// 코드를 읽어보니 원인이 있었다 — `openConnCard`가 `_connSelected=[]`로 시작하는데
// `_updateConnLines3d`가 **선택된 것만** 그려서, **카드를 여는 순간 연결선이 0개**였다. 칩을 하나
// 골라야 비로소 선이 생기니, 이 서비스의 정체성이자 철학 문서가 "발견" 축의 대표로 꼽는 연결선이
// 주인공이 아니라 부산물이 돼 있었다(카드가 주, 우주가 종).
//
// 고친 방식: 카드를 열면 그 사람의 연결 **전체를 은은하게** 그리고, 칩을 고르면 그것만 밝게 하고
// 나머지는 더 죽인다. 카드는 "우주에 뭘 강조할지 고르는 리모컨"이 되고 답은 우주에 남는다.
//
// ⚠️ 성능이 이 변경의 급소다. 인기 멤버는 상대가 수십~수백 명이라 THREE.Line을 하나씩 만들면
//    드로우콜이 그만큼 늘어난다(이 프로젝트의 발열 지표는 fps가 아니라 드로우콜 — PRINCIPLES).
//    그래서 두 층(은은/밝게)을 각각 LineSegments 하나로 합쳐 **총 2개 이하**로 고정했다.
//    이 테스트는 그 상한을 못박는다 — 상대가 몇 명이든 scene에 추가되는 객체는 2개를 넘으면 안 된다.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/conn-lines.test.js

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

// 연결선 상태 요약 — 객체 수(=드로우콜)와 각 층의 선분 개수/투명도
const LINES = `(function(){
  return JSON.stringify({
    objs:_connLines3d.length,
    layers:_connLines3d.map(function(l){
      const n=l.geometry&&l.geometry.attributes&&l.geometry.attributes.position
        ? l.geometry.attributes.position.count/2 : 0;
      return {type:l.type,segs:n,opacity:+l.material.opacity.toFixed(2)};
    }),
    selected:_connSelected.length,
    inScene:_connLines3d.filter(function(l){return !!l.parent;}).length
  });})()`;

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 연결선 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-connlines-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[conn-lines] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 50; i++) { if (await ev("typeof openConnCard==='function'&&typeof ARTISTS!=='undefined'&&ARTISTS.length>0")) break; await sleep(400); }

    // 연결이 많은 앵커를 고른다(connections.json 기준 상위) — 없으면 아무 아티스트로 폴백
    const anchor = await ev(`(function(){
      const cands=['김채원','마크','수민','지연','소희'];
      for(const n of cands){const a=ARTISTS.find(x=>x.name&&x.name.ko===n&&x._worldPos);if(a){window.__A=a;return n;}}
      const a=ARTISTS.find(x=>x._worldPos&&x.group);window.__A=a;return a?a.name.ko:null;})()`);
    if (!anchor) { fail('앵커로 쓸 아티스트를 못 찾음'); throw new Error('앵커 없음'); }
    ok(`앵커: ${anchor}`);

    // ── 1. 카드를 여는 순간 연결선이 그려져야 한다(예전엔 0개) ─────────────────────
    await ev(`(function(){try{closeConnCard()}catch(e){}openConnCard(window.__A);return 1;})()`);
    await sleep(1500);
    const open = JSON.parse(await ev(LINES) || '{}');
    const totalSegs = (open.layers || []).reduce((s, l) => s + l.segs, 0);
    if (open.selected !== 0) fail(`[열림] 열자마자 선택된 칩이 ${open.selected}개 — 전제(선택 0)와 다름`);
    else if (!totalSegs) fail('[열림] 카드를 열었는데 연결선이 0개 — 칩을 골라야만 선이 생기는 예전 동작 그대로');
    else ok(`[열림] 선택 0인데도 연결선 ${totalSegs}개가 은은하게(opacity ${open.layers.map(l => l.opacity).join('/')}) 그려짐`);

    // ── 2. 상대가 몇 명이든 scene 객체는 2개 이하(드로우콜 상한) ──────────────────
    if (open.objs > 2) fail(`[드로우콜] scene에 추가된 연결선 객체가 ${open.objs}개 — LineSegments로 합치지 않으면 발열/성능 회귀(선분 ${totalSegs}개)`);
    else if (!(open.layers || []).every(l => l.type === 'LineSegments')) fail(`[드로우콜] LineSegments가 아닌 객체가 섞임 — ${JSON.stringify(open.layers)}`);
    else ok(`[드로우콜] 선분 ${totalSegs}개를 객체 ${open.objs}개로 그림 (전부 LineSegments)`);

    // ── 3. 칩을 고르면 그것만 밝아지고 나머지는 더 죽는다 ─────────────────────────
    const picked = await ev(`(function(){
      const names=(typeof _connAllNames==='function'&&_connAllNames())||[];
      if(!names.length)return null;
      _connSelected=[names[0]];_updateConnLines3d();return names[0];})()`);
    if (!picked) fail('[강조] 상대 이름 캐시가 비어 있음 — _buildConnContent 이후 _updateConnLines3d 재호출이 안 걸렸다');
    else {
      const sel = JSON.parse(await ev(LINES) || '{}');
      const ops = (sel.layers || []).map(l => l.opacity);
      const bright = (sel.layers || []).find(l => l.opacity >= 0.5);
      const dim = (sel.layers || []).find(l => l.opacity < 0.5);
      if (!bright) fail(`[강조] 선택한 상대의 밝은 선이 없음 (opacity ${ops.join('/')})`);
      else if (dim && dim.opacity >= (open.layers[0] || {}).opacity) fail(`[강조] 선택 후에도 나머지가 안 죽음 (${dim.opacity} ≥ 열림 시 ${open.layers[0].opacity})`);
      else if (sel.objs > 2) fail(`[강조] 선택 후 객체가 ${sel.objs}개로 늘어남`);
      else ok(`[강조] "${picked}" 선택 → 밝게 ${bright.segs}개(${bright.opacity}) / 나머지 ${dim ? `${dim.segs}개(${dim.opacity})` : '없음'}`);
    }

    // ── 3.5 대규모(200명) — 드로우콜 상한의 진짜 검증 ─────────────────────────────
    // ⚠️ 헤드리스는 Supabase가 없어 실제 콜라보 이름 캐시가 거의 비어 있다(위 단계는 선분 1~2개로
    //    끝나서 상한을 전혀 검증하지 못한다). 이 프로젝트에서 발열의 지표는 드로우콜이고, 예전 코드는
    //    상대 1명당 THREE.Line 1개를 만들었으므로 **인기 멤버에서만 터지는 회귀**다 — 그래서 실제
    //    아티스트 좌표로 200명짜리 캐시를 주입해 그 경로를 강제로 태운다.
    const big = JSON.parse(await ev(`(function(){
      const pool=ARTISTS.filter(a=>a._worldPos&&a.group&&a!==window.__A).slice(0,200);
      _collabNamesCache=pool.map(a=>a.name.ko+'('+a.group.ko+')');
      _collabCountCacheKey=_connCacheKey(window.__A)+'|api';
      _connSelected=[];_updateConnLines3d();
      const none={objs:_connLines3d.length,segs:_connLines3d.reduce((s,l)=>s+l.geometry.attributes.position.count/2,0)};
      _connSelected=_collabNamesCache.slice(0,5);_updateConnLines3d();
      const some={objs:_connLines3d.length,segs:_connLines3d.reduce((s,l)=>s+l.geometry.attributes.position.count/2,0),
        ops:_connLines3d.map(l=>+l.material.opacity.toFixed(2))};
      return JSON.stringify({pool:pool.length,none:none,some:some});
    })()`) || '{}');
    // 목적은 **드로우콜 상한**이다(선 개수 자체는 아래 3.6의 헤어볼 상한이 따로 본다).
    if (!big.pool) fail('[대규모] 주입할 아티스트 좌표가 없음');
    else if (!big.none.segs) fail('[대규모] 200명을 넣었는데 선이 0개 — 이름 해석(_findArtistByConnName)이 전부 실패');
    else if (big.none.objs > 2 || big.some.objs > 2) fail(`[대규모] 드로우콜 상한 초과 — 선택 없을 때 ${big.none.objs}개 / 선택 5개일 때 ${big.some.objs}개. 상대 1명당 객체 1개를 만드는 예전 방식으로 되돌아갔다`);
    else ok(`[대규모] 상대 ${big.pool}명 → 객체 ${big.none.objs}개(선분 ${big.none.segs}) · 5명 선택 시 ${big.some.objs}개(${big.some.ops.join('/')})`);

    // ── 3.6 헤어볼 방지: 상대가 많아도 선은 상한(30) 이하 ────────────────────────
    // Fable 자문 지적 — 드로우콜을 합쳐도 별 하나에서 직선 수백 개가 뻗으면 시각적으로 못 읽는다.
    // 선은 콜라보 편수 상위 30개까지만, 나머지는 선 대신 별 밝기(_applyConnFocus)로 표현한다.
    const cap = JSON.parse(await ev(`(function(){
      _connSelected=[];_updateConnLines3d();
      const segs=_connLines3d.reduce((s,l)=>s+l.geometry.attributes.position.count/2,0);
      return JSON.stringify({segs:segs,pool:_collabNamesCache.length});})()`) || '{}');
    if (cap.segs > 30) fail(`[헤어볼] 상대 ${cap.pool}명인데 선을 ${cap.segs}개 그림 — 상한 30 초과, 별에서 직선이 뻗어나가 화면이 못 읽게 된다`);
    else if (cap.segs < 30) fail(`[헤어볼] 상대 ${cap.pool}명인데 선이 ${cap.segs}개뿐 — 상한이 과하게 걸렸다`);
    else ok(`[헤어볼] 상대 ${cap.pool}명 → 선은 상위 ${cap.segs}개까지만(나머지는 별 밝기로)`);

    // ── 3.7 선택이 없어도 우주가 반응한다 (콜라보 상대 전부 밝게, 나머지 페이드) ──────
    const focus = JSON.parse(await ev(`(function(){
      _connSelected=[];_applyConnFocus();
      const bright=ARTISTS.filter(a=>a._focusTarget===1).length;
      const dim=ARTISTS.filter(a=>a._focusTarget===FOCUS_DIM).length;
      return JSON.stringify({bright:bright,dim:dim,total:ARTISTS.length});})()`) || '{}');
    if (!focus.dim) fail('[포커스] 선택이 없을 때 페이드된 별이 0개 — 카드를 열어도 우주가 반응하지 않는다(예전 동작)');
    else if (focus.bright < 2) fail(`[포커스] 밝은 별이 ${focus.bright}개뿐 — 콜라보 상대가 안 밝아졌다`);
    else ok(`[포커스] 선택 0인데도 상대 ${focus.bright}명 밝게 / 나머지 ${focus.dim}명 페이드`);

    // ── 3.8 닫으면 포커스가 "카드 열기 전"으로 돌아가야 한다 ────────────────────────
    // ⚠️ 원복 = 페이드가 사라지는 게 아니라 **앵커 그룹만 밝은 상태**(setFocus(anchor.group.ko))다.
    //    멤버 카드는 여전히 열려 있으니 그 그룹 포커스가 원래 상태다. 그래서 "밝은 별 수"로 본다 —
    //    열려 있을 땐 콜라보 상대까지 밝고(수백), 닫으면 앵커 그룹 인원만 밝아야 한다.
    // (예전엔 `_connSelected.length`가 있을 때만 setFocus를 불러서, 선택 없이 열었다 닫으면 콜라보
    //  상대가 밝은 채로 남았다 — 이번에 무조건 호출로 바꾼 부분의 회귀 방지.)
    const restored = JSON.parse(await ev(`(function(){
      closeConnCard();
      return JSON.stringify({bright:ARTISTS.filter(a=>a._focusTarget===1).length});})()`) || '{}');
    if (restored.bright >= focus.bright) fail(`[복원] 카드를 닫았는데 밝은 별이 ${restored.bright}명 — 열려 있을 때(${focus.bright}명)와 같거나 더 많다. 콜라보 상대가 밝은 채로 남았다`);
    else ok(`[복원] 닫으면 앵커 그룹만 밝게 (밝은 별 ${focus.bright} → ${restored.bright})`);
    // 아래 dispose 검사를 위해 다시 연다
    await ev(`(function(){openConnCard(window.__A);_collabNamesCache=ARTISTS.filter(a=>a._worldPos&&a.group&&a!==window.__A).slice(0,200).map(a=>a.name.ko+'('+a.group.ko+')');
      _collabCountCacheKey=_connCacheKey(window.__A)+'|api';_connSelected=[];_updateConnLines3d();return 1;})()`);
    await sleep(400);

    // ── 4. 닫으면 전부 제거 + GPU 버퍼 정리(dispose) ────────────────────────────
    const disposed = await ev(`(function(){
      const objs=_connLines3d.slice();
      let disposeCalls=0;
      objs.forEach(function(o){const g=o.geometry.dispose.bind(o.geometry);o.geometry.dispose=function(){disposeCalls++;return g();};});
      closeConnCard();
      return JSON.stringify({left:_connLines3d.length,
        stillInScene:objs.filter(function(o){return !!o.parent;}).length,
        disposeCalls:disposeCalls,had:objs.length});})()`);
    const d = JSON.parse(disposed || '{}');
    if (d.left !== 0 || d.stillInScene !== 0) fail(`[닫기] 연결선이 남음 (배열 ${d.left}개 / scene ${d.stillInScene}개)`);
    else if (d.had && d.disposeCalls < d.had) fail(`[닫기] geometry.dispose가 ${d.disposeCalls}/${d.had}번만 호출됨 — 열고 닫을 때마다 GPU 버퍼가 쌓인다`);
    else ok(`[닫기] 객체 ${d.had}개 전부 scene 제거 + dispose ${d.disposeCalls}회`);

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 연결선 테스트 전부 통과' : '\n💥 연결선 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
