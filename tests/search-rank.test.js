// 검색 결과 정렬 회귀 테스트 (2026-09-08 신설)
//
// 사용자 제보: "'82'를 검색하면 곡 정보보다 그룹 82major가 위에 떠야 맞는 것 같다. 그룹>멤버>곡>영상
// 순으로 표기되면 좋지 않을까?"
//
// 원인: 타입별 감점을 score에 섞어 넣고 있었다(그룹 +0.5 / 멤버 +0 / 곡 +1.2). 감점 폭(0.7)이 매칭
// 등급 한 칸(정확0→접두1)보다 작아서 **"곡 정확일치"가 "그룹 접두일치"를 이기는** 구간이 생겼다.
//   82메이저: 접두일치 1 + 0.5 = 1.5   /   곡 "82"(82메이저 본인 곡): 정확일치 0 + 1.2 = 1.2  ← 곡 승
//
// 고친 방식: **1순위 매칭 등급 → 2순위 타입(그룹>멤버>곡>영상)**. 타입은 동점만 가른다. 곡은 등급 +1
// 핸디캡을 받아서 엔티티가 "한 등급 위까지만" 이긴다.
//
// ⚠️ 이 테스트의 핵심은 **타입을 1순위로 고정하면 안 된다**는 반대 방향까지 같이 못박는 것이다.
//    전수 실측(2~12자 곡 제목 11,246개): 엔티티 접두일치 충돌 149건은 고정으로 고쳐지지만, 엔티티가
//    **부분일치만** 인 충돌 96건은 고정하면 망가진다 — "OMG"에 범규(투바투)가 뉴진스 곡보다 위로,
//    "Star"에 씨스타가, "Her"에 투모로우바이투게더가 올라온다. 그래서 아래 [반대 방향] 케이스가 있다.
//    이걸 지우고 타입 고정으로 되돌리지 말 것.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/search-rank.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 8963;
const CDP_PORT = 9363;
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = true;
const fail = m => { pass = false; console.log(`❌ ${m}`); };
const ok = m => console.log(`✅ ${m}`);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let id = 0; const pend = new Map();
    ws.addEventListener('open', () => resolve({
      send: (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); }),
      close: () => ws.close(),
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
  });
}

// 데스크톱 검색 결과의 항목을 화면 순서 그대로 읽는다(섹션 헤더 제외 — .sr-item만).
const READ = q => `(function(){
  doSearch(${JSON.stringify(q)});
  return JSON.stringify([...document.querySelectorAll('#search-results .sr-item')].map(function(el){
    var n=el.querySelector('.sr-item-name'), v=el.querySelector('.sr-vtitle');
    return {type:el.dataset.type||'', expanded:el.dataset.expanded==='1',
      name:((v||n||el).textContent||'').replace(/^[♪▶📍🎬🔗]\\s*/,'').trim()};
  }));})()`;

// 첫 등장 순서대로의 타입 목록(중복 제거) — "섹션이 어떤 순서로 쌓였나"
const typeOrder = rows => rows.reduce((a, r) => (a[a.length - 1] === r.type ? a : a.concat(r.type)), []);
const idxOfType = (rows, t) => rows.findIndex(r => r.type === t);
const idxOfName = (rows, n) => rows.findIndex(r => r.name.toLowerCase() === n.toLowerCase());

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 검색 정렬 테스트 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-searchrank-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[search-rank] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 50; i++) { if (await ev("typeof doSearch==='function'&&typeof ARTISTS!=='undefined'&&ARTISTS.length>0")) break; await sleep(400); }

    // 곡은 tracks_index를 비동기로 받은 뒤에야 결과에 들어간다(슬림 모드) — 먼저 확실히 로드시킨다.
    await ev(`(function(){ if(typeof _ensureTracksIndex==='function')return _ensureTracksIndex(); })()`);
    for (let i = 0; i < 40; i++) { if (await ev("typeof _TI!=='undefined'&&!!_TI")) break; await sleep(300); }
    await ev(`doSearch('82');`); await sleep(600); // 인덱스 빌드 트리거

    const read = async q => { const s = await ev(READ(q)); await sleep(250); return JSON.parse(s || '[]'); };

    // ── 1+2. 사용자 제보 케이스 "82" — 그룹>멤버>곡이 한 번에 나오는 유일한 쿼리 ──────
    // 82메이저(그룹 접두일치) · 그 멤버들(그룹 확장) · 곡 "82"(정확일치, 심지어 82메이저 본인 곡).
    // 고치기 전엔 곡 "82"(0+1.2=1.2)가 그룹(1+0.5=1.5)보다 위였다.
    {
      const rows = await read('82');
      const seq = rows.slice(0, 9).map(r => r.type + ':' + r.name).join(' > ');
      if (!rows.length) { fail('[82] 결과 없음'); }
      else {
        if (rows[0].name !== '82MAJOR' && rows[0].name !== '82메이저') fail(`[82] 첫 결과가 82메이저가 아님 — ${rows[0].type}:${rows[0].name}`);
        const order = typeOrder(rows).filter(t => ['group', 'member', 'song'].includes(t));
        const want = ['group', 'member', 'song'].filter(t => order.includes(t));
        if (order.length < 3) fail(`[82] 그룹·멤버·곡이 다 안 나옴 — ${order.join('>')} · ${seq}`);
        else if (JSON.stringify(order) !== JSON.stringify(want)) fail(`[82] 타입 순서가 그룹>멤버>곡이 아님 — ${order.join('>')} · ${seq}`);
        else ok(`[82] ${seq}`);
        // 그룹으로 딸려온 멤버(_expanded)는 그룹과 **같은 등급**이라 곡보다 위여야 한다(예전 +0.9로는 아래였다)
        const exp = rows.filter(r => r.type === 'member' && r.expanded).length;
        const lastExp = rows.reduce((a, r, i) => (r.type === 'member' && r.expanded ? i : a), -1);
        const firstSong = idxOfType(rows, 'song');
        if (!exp) fail('[82] 그룹 확장 멤버가 0명 — _expandFrom 경로가 죽었다');
        else if (firstSong >= 0 && lastExp > firstSong) fail(`[82] 확장 멤버가 곡보다 아래 — ${seq}`);
        else ok(`[82] 확장 멤버 ${exp}명이 그룹 뒤·곡 앞에`);
      }
    }

    // ── 3. [반대 방향] 타입을 1순위로 고정하면 망가지는 케이스 ─────────────────────
    // 엔티티가 **부분일치만** 일 때는 정확일치 곡이 위여야 한다. 아래가 깨졌다면 누군가
    // "그룹>멤버>곡"을 동점 타이브레이커가 아니라 1순위 정렬로 바꿔놓은 것이다.
    for (const [q, note] of [['OMG', '범규(부분일치)보다 곡 OMG'], ['Star', '씨스타(부분일치)보다 곡 Star']]) {
      const rows = await read(q);
      const s = idxOfType(rows, 'song');
      const ent = rows.findIndex(r => (r.type === 'group' || r.type === 'member') && r.name.toLowerCase() !== q.toLowerCase());
      if (s < 0) { console.log(`⚠️  [${q}] 곡 결과가 없어 판정 생략`); continue; }
      if (ent >= 0 && ent < s) fail(`[반대방향 ${q}] 부분일치 엔티티가 정확일치 곡보다 위 — ${rows.slice(0, 4).map(r => r.type + ':' + r.name).join(' > ')} (${note})`);
      else ok(`[반대방향 ${q}] ${rows.slice(0, 4).map(r => r.type + ':' + r.name).join(' > ')}`);
    }

    // ── 3.5 프로그램 컬렉션도 같은 등급 규칙을 따른다 ─────────────────────────────
    // "라디오스타"를 제대로 치면 최상단, "Star"만 치면(영문명 부분일치) 정확일치 곡보다 아래.
    {
      const rows = await read('라디오스타');
      if (!rows.length) fail('[라디오스타] 결과 없음');
      else if (rows[0].type !== 'program') fail(`[라디오스타] 첫 결과가 ${rows[0].type}:${rows[0].name} — 프로그램 모아보기여야 함`);
      else ok(`[라디오스타] 첫 결과 ${rows[0].type}:${rows[0].name}`);
    }
    {
      const rows = await read('Star');
      const p = idxOfType(rows, 'program'), s = idxOfType(rows, 'song');
      if (p >= 0 && s >= 0 && p < s) fail(`[Star] 부분일치 프로그램이 정확일치 곡보다 위 — ${rows.slice(0, 3).map(r => r.type + ':' + r.name).join(' > ')}`);
      else ok(`[Star] ${rows.slice(0, 3).map(r => r.type + ':' + r.name).join(' > ')}`);
    }

    // ── 4. 이름 정확일치는 여전히 최상단(회귀 방지) ────────────────────────────────
    for (const [q, want] of [['카리나', 'member'], ['뉴진스', 'group']]) {
      const rows = await read(q);
      if (!rows.length) { fail(`[${q}] 결과 없음`); continue; }
      if (rows[0].type !== want) fail(`[${q}] 첫 결과 타입이 ${rows[0].type}(${rows[0].name}) — ${want}여야 함`);
      else ok(`[${q}] 첫 결과 ${rows[0].type}:${rows[0].name}`);
    }

    // ── 5. 짧은 쿼리에서 그룹이 감점으로 밀려나지 않는다(2026-08-21 "뉴" 회귀) ────────
    // ⚠️ 여기서 "그룹이 화면 맨 위"를 기대하면 안 된다 — 뉴이스트 멤버 "뉴"가 **정확일치**라 멤버
    //    섹션이 먼저 오는 게 맞고, `_renderSearchHits`는 점수가 가장 좋은 타입부터 섹션을 쌓는다
    //    (같은 타입은 한 섹션에 모이므로 등급 1짜리 멤버도 그 섹션에 딸려 올라간다). 이건 의도된 설계다.
    //    잠글 것은 "그룹이 타입 감점 때문에 뒤로 밀리지 않는가" — 그룹 섹션의 선두에 있어야 한다.
    {
      const rows = await read('뉴');
      const groups = rows.filter(r => r.type === 'group').map(r => r.name);
      const i = groups.indexOf('뉴진스');
      if (!groups.length) fail(`[뉴] 그룹 결과가 없음 — ${rows.slice(0, 6).map(r => r.name).join(' · ')}`);
      else if (i < 0) fail(`[뉴] 뉴진스가 그룹 결과에 없음 — ${groups.slice(0, 6).join(' · ')}`);
      else if (i > 2) fail(`[뉴] 뉴진스가 그룹 중 ${i + 1}번째로 밀림 — ${groups.slice(0, 6).join(' · ')}`);
      else ok(`[뉴] 그룹 ${groups.slice(0, 4).join(' · ')} (뉴진스 ${i + 1}번째)`);
      // 곡이 그룹보다 위로 올라오면 그건 진짜 회귀다(등급 1 그룹 vs 등급 1+ 곡)
      const g = idxOfType(rows, 'group'), s = idxOfType(rows, 'song');
      if (s >= 0 && g >= 0 && s < g) fail(`[뉴] 곡 섹션이 그룹 섹션보다 위 — ${typeOrder(rows).join('>')}`);
      else ok(`[뉴] 섹션 순서 ${typeOrder(rows).join('>')}`);
    }

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 검색 정렬 테스트 전부 통과' : '\n💥 검색 정렬 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
