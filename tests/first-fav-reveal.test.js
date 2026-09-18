// 첫 즐겨찾기 우주 연출 — 실제로 3D 씬이 반응하고, 그게 **화면에 보이는지** (2026-09-18 신설)
//
// 왜: 하트를 눌러도 반응이 전부 카드 안(DOM)에서만 끝났다 — 파티클·♥비행·탭 펄스. applyFavHighlight는
// favMode를 켰을 때만 도니까 3D 씬은 1픽셀도 안 변했고, 그래서 앱을 처음 본 사람에겐 "예쁜 별 화면"과
// "즐겨찾기"가 끝까지 남남이었다(2026-09-18 제보). 축하 문구 대신 **일어난 일을 보여주는** 연출을 넣었다.
//
// ⚠️ 이 테스트가 존재하는 진짜 이유는 아래 두 개다. 둘 다 소스 검사로는 절대 못 잡는다.
//   ① **모바일 렌더 정지**: animate()는 모바일에서 `mob-sheet.bs-open`이면 **flyState 처리 전에 return**
//      한다(발열 대응). 즉 카드가 열려 있으면 렌더도 카메라 비행도 멈춘다 — 처음엔 시트를 60%로만
//      내렸는데, 뒤에 보이는 우주가 '얼어붙은 정지화면'이라 연출이 통째로 안 보였다. 그래서 모바일에선
//      카드를 실제로 닫는다. 이 테스트는 **카메라가 실제로 그 행성 앞까지 갔는지**(거리)로 그걸 잡는다.
//   ② **화면 밖 연출**: 링 시작 반경을 radius*9로 잡았더니 카메라 거리(radius*9)와 같아 링이 화면보다
//      커서, "모이는 과정"이 전부 화면 밖이었다. 행성의 화면 좌표와 링 반경을 같이 재서 잡는다.
//
// ⚠️ scene.children 개수 증감으로 재지 말 것 — 카드 열림/라벨 등 무관한 추가가 섞여 오탐·누락이 둘 다 났다.
//    _favGatherGlow를 감싸서 **그 호출이 직접 추가한 객체**만 추적한다.
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/first-fav-reveal.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8958;
const CDP_PORT = 9358;
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

// _favGatherGlow가 직접 씬에 넣은 스프라이트만 추적. window 노출은 함수 선언이라 가능(let/const는 안 됨).
const SPY = `(function(){window.__reveal=[];window.__sprites=[];
  const r=window._firstFavReveal;window._firstFavReveal=function(...a){window.__reveal.push(a[0]);return r.apply(this,a);};
  const g=window._favGatherGlow;window._favGatherGlow=function(bm){
    const before=new Set(scene.children);const out=g.call(this,bm);
    scene.children.forEach(o=>{if(!before.has(o))window.__sprites.push(o);});return out;};return 1;})()`;
// 행성의 화면 좌표 + 카메라 거리(setViewOffset까지 반영된 projectionMatrix를 쓴다)
const PROBE = `(function(){const bm=bubbleMeshes.find(b=>b.ko===window.__ko);
  const v=bm.mesh.position.clone().project(camera);
  const sp=window.__sprites[0]||null;
  return {x:Math.round((v.x*0.5+0.5)*innerWidth),y:Math.round((-v.y*0.5+0.5)*innerHeight),
    dist:+camera.position.distanceTo(bm.mesh.position).toFixed(1),rad:+bm.radius.toFixed(2),
    ringR:sp?+(sp.scale.x).toFixed(2):null,vw:innerWidth,vh:innerHeight};})()`;

(async () => {
  if (!BROWSER_PATH) { console.log('⏭️  브라우저를 못 찾음 — 스킵'); process.exit(0); }
  server.listen(PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-ffr-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[first-fav-reveal] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);

  async function boot(opt = {}) {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    const w = opt.mobile ? 390 : 1440, h = opt.mobile ? 844 : 900;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!opt.mobile });
    if (opt.reduceMotion) await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const seed = Object.assign({ kpu_visit_count: '9' }, opt.seed || {});
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.clear();${Object.entries(seed).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}}catch(e){}`,
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 80; i++) { if (await ev(cdp, `(typeof bubbleMeshes!=='undefined'&&bubbleMeshes.length>0)`)) break; await sleep(500); }
    if (!await ev(cdp, `(typeof bubbleMeshes!=='undefined'&&bubbleMeshes.length>0)`)) throw new Error('앱 미준비');
    await sleep(opt.mobile ? 5500 : 4000);
    await ev(cdp, SPY);
    return cdp;
  }
  // 제품과 같은 경로로 카드를 연다(행성 탭 = flyToBubble + showGC). flyToBubble을 빼면 카메라가 개요
  // 위치에 머물러 268개 행성 더미 속에서 연출이 묻히는데, 그건 테스트 탓이지 제품 탓이 아니다.
  const OPEN = i => `(function(){const bm=bubbleMeshes[${i}];window.__ko=bm.ko;
    flyToBubble(bm.mesh.position,bm.radius);showGC(bm.ko,innerWidth/2,innerHeight*0.4);return bm.ko;})()`;

  try {
    await waitForCdp();

    // ── ① 데스크톱: 첫 하트 → 링이 생기고, 보이고, 사라진다 ──
    {
      const cdp = await boot();
      const ko = await ev(cdp, OPEN(0));
      await sleep(2200);
      await ev(cdp, `document.getElementById('gc-fav').click()`);
      await sleep(1450); // 700(지연) + 520(비행과 겹침) 뒤 = 링 진행 중
      const mid = await ev(cdp, `({reveal:window.__reveal,n:window.__sprites.length,
        inScene:window.__sprites.filter(s=>scene.children.includes(s)).length,
        op:window.__sprites.map(s=>+s.material.opacity.toFixed(3))})`);
      (mid.reveal.length === 1 && mid.reveal[0] === ko) ? ok(`첫 하트에 _firstFavReveal("${ko}") 1회`) : bad(`호출 이상: ${JSON.stringify(mid.reveal)}`);
      mid.n === 1 ? ok('링 1장만 생성 — 하트 비·컨페티 없음') : bad(`링이 ${mid.n}장 (1장이어야 함)`);
      (mid.inScene === 1 && mid.op[0] > 0.02) ? ok(`연출 중 씬에 살아있고 실제로 보임(opacity=${mid.op[0]})`) : bad(`안 보임(inScene=${mid.inScene}, opacity=${mid.op[0]})`);

      const p = await ev(cdp, PROBE);
      const onScreen = p.x >= 0 && p.x <= p.vw && p.y >= 0 && p.y <= p.vh;
      const panel = await ev(cdp, `(function(){const r=document.getElementById('side-panel').getBoundingClientRect();return {left:Math.round(r.left)};})()`);
      onScreen ? ok(`행성이 화면 안 (${p.x},${p.y})`) : bad(`행성이 화면 밖 (${p.x},${p.y})`);
      p.x < panel.left ? ok('오른쪽 카드 패널에 가려지지 않음') : bad(`패널(left=${panel.left}) 뒤에 있음`);
      // ②의 재발 가드: 링이 화면보다 크면 "모이는 과정"이 전부 화면 밖이다
      p.ringR < p.dist ? ok(`링 반경(${p.ringR})이 카메라 거리(${p.dist})보다 작음 — 화면 안에 들어옴`)
                       : bad(`링 반경 ${p.ringR} ≥ 카메라 거리 ${p.dist} — 연출이 화면 밖으로 나간다`);

      await sleep(1600);
      (await ev(cdp, `window.__sprites.filter(s=>scene.children.includes(s)).length`)) === 0
        ? ok('끝나면 씬에서 제거됨(누수 없음)') : bad('링이 씬에 남음');
      (await ev(cdp, `!!localStorage.getItem('kpu_first_fav_revealed')`)) ? ok('1회용 플래그 기록됨') : bad('플래그 미기록');

      // 두 번째 즐겨찾기 — 아무 일도 없어야 한다
      await ev(cdp, `(function(){try{closeCards()}catch(e){}return 1;})()`);
      await sleep(700);
      await ev(cdp, OPEN(1));
      await sleep(1600);
      await ev(cdp, `document.getElementById('gc-fav').click()`);
      await sleep(1800);
      const a = await ev(cdp, `({reveal:window.__reveal.length,n:window.__sprites.length,fav:favGroups.size})`);
      a.fav === 2 ? ok('두 번째 즐겨찾기가 실제로 추가됨') : bad(`두 번째가 안 담김(${a.fav}개)`);
      (a.reveal === 1 && a.n === 1) ? ok('두 번째엔 연출 없음') : bad(`두 번째에도 연출(reveal ${a.reveal}, 링 ${a.n})`);
      cdp.close();
    }

    // ── ② 멤버 하트 → 그 멤버가 속한 **행성**이 대답 ──
    {
      const cdp = await boot();
      const t = await ev(cdp, `(function(){const x=ARTISTS.find(y=>y.group&&bubbleMeshes.some(b=>b.ko===y.group.ko));
        window.__ko=x.group.ko;const bm=bubbleMeshes.find(b=>b.ko===x.group.ko);
        flyToBubble(bm.mesh.position,bm.radius);showT(x,innerWidth/2,innerHeight*0.4);return x.group.ko;})()`);
      await sleep(2200);
      await ev(cdp, `document.getElementById('tt-fav').click()`);
      await sleep(1450);
      const r = await ev(cdp, `({reveal:window.__reveal,n:window.__sprites.length,fav:favMembers.size})`);
      r.fav === 1 ? ok('멤버 즐겨찾기 추가됨') : bad(`멤버가 안 담김(${r.fav})`);
      (r.reveal.length === 1 && r.reveal[0] === t) ? ok(`멤버 하트인데 **그룹 행성**("${t}")이 대답 — 별 하나만 깜빡이면 어디서 난 일인지 안 읽힌다`)
                                                   : bad(`대상 이상: ${JSON.stringify(r.reveal)}`);
      r.n === 1 ? ok('링 1장') : bad(`링 ${r.n}장`);
      cdp.close();
    }

    // ── ③ 모바일: 카드가 닫히고 렌더가 재개되어 카메라가 실제로 행성 앞까지 간다 ──
    //    (이게 이 테스트의 핵심 — animate()의 조기 return 함정)
    {
      const cdp = await boot({ mobile: true });
      const ko = await ev(cdp, OPEN(0));
      await sleep(2400);
      const pre = await ev(cdp, `({open:mobSheetEl.classList.contains('bs-open'),mob:isMob()})`);
      (pre.mob && pre.open) ? ok('사전조건: 모바일 + 카드 시트 열림') : bad(`사전조건 실패 ${JSON.stringify(pre)}`);
      await ev(cdp, `document.getElementById('gc-fav').click()`);
      await sleep(2000); // 700 + 340(시트 닫힘) + 비행·링
      const post = await ev(cdp, `({open:mobSheetEl.classList.contains('bs-open'),n:window.__sprites.length})`);
      !post.open ? ok('카드가 닫힘 — 렌더가 재개되어야 연출이 보인다')
                 : bad('카드가 열린 채 — animate()가 flyState 전에 return해 우주가 얼어붙는다');
      post.n === 1 ? ok('링 1장 생성') : bad(`링 ${post.n}장`);
      const p = await ev(cdp, PROBE);
      // flyToBubble은 모바일에서 radius*9까지 데려온다. 렌더가 멈춰 있으면 거리가 그대로 남는다(옛 버그: 429).
      (p.dist < p.rad * 12) ? ok(`카메라가 행성 앞까지 감 (거리 ${p.dist}, 반경 ${p.rad})`)
                            : bad(`카메라가 안 움직임 (거리 ${p.dist}) — 렌더 정지 함정 재발`);
      const onScreen = p.x >= 0 && p.x <= p.vw && p.y >= 0 && p.y <= p.vh;
      onScreen ? ok(`행성이 화면 안 (${p.x},${p.y} / ${p.vw}x${p.vh})`) : bad(`행성이 화면 밖 (${p.x},${p.y})`);
      p.ringR < p.dist ? ok(`링 반경(${p.ringR}) < 카메라 거리(${p.dist})`) : bad(`링이 화면 밖으로 나감(${p.ringR} ≥ ${p.dist})`);
      cdp.close();
    }

    // ── ④ 하이라이트(favMode) 켜짐 → 궤도 연출과 겹치지 않게 생략, 플래그도 안 태움 ──
    {
      const cdp = await boot({ seed: { kpu_profile: JSON.stringify({ nickname: '검증용', color: [155, 210, 255] }) } });
      await ev(cdp, `(function(){_toggleFavMode();return 1;})()`);
      await sleep(1200);
      await ev(cdp, OPEN(0));
      await sleep(1600);
      await ev(cdp, `document.getElementById('gc-fav').click()`);
      await sleep(1800);
      const r = await ev(cdp, `({favMode,n:window.__sprites.length,flag:!!localStorage.getItem('kpu_first_fav_revealed')})`);
      r.favMode === true ? ok('사전조건: favMode 켜짐') : bad('favMode가 안 켜짐');
      r.n === 0 ? ok('연출 생략됨') : bad(`연출이 겹쳐 뜸(${r.n}장)`);
      r.flag === false ? ok('1회용 플래그를 안 태움 — 하이라이트 끈 상태에서 나중에 볼 수 있어야 한다') : bad('플래그를 먼저 태워버림');
      cdp.close();
    }

    // ── ⑤ 모션 줄이기 → 통째로 생략, 플래그도 안 태움 ──
    {
      const cdp = await boot({ reduceMotion: true });
      (await ev(cdp, `_reduceMotion===true`)) ? ok('_reduceMotion true') : bad('_reduceMotion이 안 잡힘');
      await ev(cdp, OPEN(0));
      await sleep(1600);
      await ev(cdp, `document.getElementById('gc-fav').click()`);
      await sleep(1800);
      const r = await ev(cdp, `({n:window.__sprites.length,flag:!!localStorage.getItem('kpu_first_fav_revealed')})`);
      r.n === 0 ? ok('연출 없음') : bad(`모션 줄이기인데 연출이 뜸(${r.n}장)`);
      r.flag === false ? ok('1회용 플래그를 안 태움') : bad('플래그를 태워버림');
      cdp.close();
    }
  } catch (e) {
    bad(`예외: ${e.message}`);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과`);
  process.exit(fail ? 1 : 0);
})();
