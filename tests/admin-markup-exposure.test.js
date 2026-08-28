// 어드민 마크업 노출 회귀 테스트 (2026-08-28 신설)
//
// 사용자 제보: 크롬 시크릿 창(로그아웃)에서 Alt+Shift+R(읽기 모드)을 누르니 어드민 UI 텍스트가
// 그대로 읽혔다 — "출연 멤버 지정", "타 그룹 멤버", "영상 포맷 (관리자)" 등 영상 편집 모달 내용.
//
// 원인: 어드민 마크업 8블록(약 434줄, 한글 약 2,400자)이 index.html에 **그대로 들어있고 CSS
// display:none으로만 가려져** 있었다. 읽기 모드는 렌더링 결과가 아니라 **원본 DOM을 순회**하므로
// display:none을 무시하고 다 읽어간다. (그래서 처음에 innerText로 검증한 건 잘못된 프록시였다 —
// innerText는 CSS를 존중해서 "안 새는 것처럼" 보였다.)
//
// 고친 방식: 각 블록을 <template class="adm-tpl">로 감쌌다. <template>의 내용은 파싱은 되지만
// **문서 트리 밖의 inert fragment**여서 DOM 순회로 도달할 수 없다 → 읽기 모드·스크린리더·검색엔진
// 전부에서 사라진다. 관리자일 때만 _mountAdminMarkup()이 복제해 넣는다.
//
// 검증 지표로 innerText가 아니라 **document.body.textContent** 를 쓴다. textContent는 CSS를 전혀
// 안 보고 DOM 트리만 따라가므로 읽기 모드와 같은 의미론이다:
//   · display:none <div>  → textContent에 **포함됨**(예전 상태 = 노출)
//   · <template>          → textContent에 **불포함**(template의 childNodes는 비어 있음)
// 즉 이 테스트는 회귀가 나면 반드시 실패한다.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/admin-markup-exposure.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8953;
const CDP_PORT = 9353;
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

// 각 어드민 블록에서 하나씩 뽑은 대표 문구 — 하나라도 익명 DOM에 잡히면 그 블록이 새고 있다는 뜻
const PROBES = [
  ['sp-yt-sec', '유저들이 보낸 피드백 목록을 확인해요'],
  ['sp-yt-sec', '공식 채널 전체 + 외부 채널의 새 영상을 가져와요'],
  ['vid-tag-overlay', '선택 없음 = 그룹 전체 영상'],
  ['vid-tag-overlay', '원곡자 지정'],
  ['vm-overlay', '제목·그룹 검색'],
  ['hnn-overlay', '검수 센터'],
  ['adm-home-overlay', '관리자 홈'],
  ['gp-overlay', '그룹 우선순위'],
];
const ADMIN_IDS = ['sp-yt-sec', 'vm-overlay', 'adm-home-overlay', 'hnn-overlay', 'gp-overlay', 'vid-tag-overlay', 'fbv-overlay', 'vm-coverset-overlay'];

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
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 노출 테스트 스킵'); process.exit(0); }
  const servedJs = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (/\.js$/.test(p)) servedJs.push(p);
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-expose-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[expose] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 40; i++) { if (await ev("typeof _isAdmin==='function'")) break; await sleep(400); }

    // ── 0. 익명 방문자인지 확인 (로그인 안 된 상태여야 이 테스트가 의미 있음) ──────────────
    const isAdmin = await ev('_isAdmin()');
    if (isAdmin !== false) { fail(`익명 상태가 아님 (_isAdmin=${isAdmin}) — 테스트 전제 불충족`); throw new Error('전제 불충족'); }
    ok('익명 방문자 상태 확인 (_isAdmin=false)');

    // ── 1. 읽기 모드가 읽는 것 = DOM 순회 텍스트. 어드민 문구가 하나도 없어야 한다 ───────────
    // ⚠️ <script>/<style>/<noscript>는 제외한다. 이들도 DOM 트리에 있어서 body.textContent엔 잡히지만
    //    읽기 모드·스크린리더는 렌더링 텍스트가 아닌 이들을 전부 걷어낸다. 실제로 그냥 textContent로
    //    쟀더니 인라인 스크립트 안의 JS 문자열('검수 센터' 등)이 3건 걸려 과탐지가 났다.
    await ev(`window.__admText=(function(){
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(n){
        return /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.parentElement&&n.parentElement.tagName)
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;}});
      let s='',n;while(n=w.nextNode())s+=n.nodeValue+'\\n';return s;})()`);
    const leaked = [];
    for (const [block, phrase] of PROBES) {
      const hit = await ev(`window.__admText.includes(${JSON.stringify(phrase)})`);
      if (hit) leaked.push(`${block}: "${phrase}"`);
    }
    if (leaked.length) fail(`[읽기모드 노출] DOM 순회 텍스트에 어드민 문구 ${leaked.length}건 — ${leaked.join(' / ')}`);
    else ok(`[읽기모드 노출] 어드민 대표 문구 ${PROBES.length}개 전부 DOM 순회 텍스트에서 사라짐`);

    // ── 2. 어드민 요소가 애초에 DOM에 존재하지 않아야 한다 ─────────────────────────────
    const present = [];
    for (const id of ADMIN_IDS) if (await ev(`!!document.getElementById(${JSON.stringify(id)})`)) present.push(id);
    if (present.length) fail(`[DOM 존재] 익명인데 어드민 요소가 DOM에 있음: ${present.join(', ')}`);
    else ok(`[DOM 존재] 어드민 블록 ${ADMIN_IDS.length}개 전부 익명 DOM에 없음`);

    // ── 3. <template>으로 보관돼 있는지(= 마크업이 지워진 게 아니라 감싸진 것) ──────────────
    const tplCount = await ev(`document.querySelectorAll('template.adm-tpl').length`);
    if (tplCount !== ADMIN_IDS.length) fail(`[보관] adm-tpl 템플릿이 ${tplCount}개 — ${ADMIN_IDS.length}개여야 함(블록 누락/중복 의심)`);
    else ok(`[보관] adm-tpl 템플릿 ${tplCount}개 확인`);

    // ── 4. admin.js는 익명에게 전송조차 되지 않아야 한다 ────────────────────────────────
    const jsFiles = [...new Set(servedJs)];
    if (jsFiles.some(f => /admin\.js/.test(f))) fail(`[전송] 익명에게 admin.js가 전송됨 — ${jsFiles.join(', ')}`);
    else ok(`[전송] 익명이 받은 JS: ${jsFiles.join(', ')} (admin.js 없음)`);

    // ── 5. 시크릿/키가 문서에 없어야 한다 (Supabase 공개키는 정상) ──────────────────────
    const secrets = await ev(`(function(){
      const h=document.documentElement.outerHTML;
      const bad=[];
      if(/sb_secret_/.test(h))bad.push('sb_secret_');
      if(/service_role/.test(h))bad.push('service_role');
      if(/\\bAIza[A-Za-z0-9_-]{30,}/.test(h))bad.push('Google/YouTube API key');
      if(/\\bghp_[A-Za-z0-9]{20,}/.test(h))bad.push('GitHub token');
      return JSON.stringify(bad);
    })()`);
    const bad = JSON.parse(secrets || '[]');
    if (bad.length) fail(`[시크릿] 문서에 비밀값 흔적: ${bad.join(', ')}`);
    else ok('[시크릿] sb_secret_/service_role/API 키/토큰 흔적 0건');

    // ── 6. 관리자에겐 정상적으로 복원돼야 한다(주입 후 구조·위치까지) ────────────────────
    const after = await ev(`(function(){
      _mountAdminMarkup();
      const sec=document.getElementById('sp-yt-sec');
      const missing=${JSON.stringify(ADMIN_IDS)}.filter(id=>!document.getElementById(id));
      return JSON.stringify({missing:missing,
        secInPanel:!!(sec&&sec.closest('#settings-panel')),
        vmInBody:!!(document.getElementById('vm-overlay')?.parentElement===document.body),
        text:(document.body.textContent||'').includes('원곡자 지정')});
    })()`);
    const a = JSON.parse(after || '{}');
    if (a.missing && a.missing.length) fail(`[관리자 복원] 주입 후에도 없는 블록: ${a.missing.join(', ')}`);
    else if (!a.secInPanel) fail('[관리자 복원] sp-yt-sec이 #settings-panel 안에 안 들어감 — 설정 패널에서 안 보인다');
    else if (!a.vmInBody) fail('[관리자 복원] vm-overlay가 body 직속이 아님 — 오버레이 스태킹이 깨질 수 있음');
    else if (!a.text) fail('[관리자 복원] 주입은 됐는데 텍스트가 DOM에 안 잡힘');
    else ok('[관리자 복원] 8블록 전부 주입 + sp-yt-sec은 설정 패널 안 / 오버레이는 body 직속');

    // ── 7. 두 번 호출해도 중복 주입되면 안 된다 ─────────────────────────────────────
    const dup = await ev(`(function(){_mountAdminMarkup();_mountAdminMarkup();
      return document.querySelectorAll('#vm-overlay').length;})()`);
    if (dup !== 1) fail(`[멱등성] _mountAdminMarkup 반복 호출로 #vm-overlay가 ${dup}개 — id 중복`);
    else ok('[멱등성] 반복 호출해도 1회만 주입됨');

    cdp.close();
  } catch (e) {
    fail(`실행 중 예외: ${e.message}`);
  } finally {
    try { process.kill(child.pid); } catch (e) {}
    server.close();
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (e) {}
  }

  console.log(pass ? '\n🎉 어드민 마크업 노출 테스트 전부 통과' : '\n💥 어드민 마크업 노출 테스트 실패');
  process.exit(pass ? 0 : 1);
}

main();
