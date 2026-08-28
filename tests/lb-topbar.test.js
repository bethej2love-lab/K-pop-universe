// 재생모드(브라우즈) 상단 중앙 바 회귀 테스트 (2026-08-27)
//
// 이 자리는 이미 한 번 죽었던 곳이다 — 2026-08-26에 "재생모드 상단 멤버/그룹 이름 클릭이 안 먹는다"를
// 고쳤는데(부모의 pointer-events:none이 버튼까지 죽이고 있었음), 이번엔 그 옆의 "함께한 멤버" 칩이
// 같은 이유로 안 눌린다는 제보가 왔다. 정적 CSS 검사로는 "부모 none + 자식 auto" 조합의 실제 결과를
// 알 수 없어서, **실제로 눌러보고 하프시트가 열리는지**까지 확인한다.
//
// 무엇을 확인하는가:
//  ① 앵커 줄(멤버 · 그룹)의 두 버튼이 눌리고, 각각 멤버/그룹 카드가 하프시트로 열린다.
//  ② "함께한 멤버" 칩도 눌리고 그 멤버 카드가 열린다(2026-08-27 추가분).
//  ③ 두 줄이 **겹치지 않는다.** 예전엔 height:36px에 두 줄을 욱여넣어 3px 겹쳐 있었고, 위아래 어느
//     쪽을 눌러도 엉뚱한 게 잡혀 "터치가 어렵다"는 체감으로 이어졌다.
//  ④ 앵커 버튼의 세로 탭 영역이 상단바 밴드(36px)만큼 확보돼 있다(예전 17px).
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/lb-topbar.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8961, CDP_PORT = 9361;
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
const ok = m => console.log(`✅ ${m}`);
const fail = m => { pass = false; console.log(`❌ ${m}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 스킵'); process.exit(0); }
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(d); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-lbtop-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[lb-topbar] 헤드리스 브라우저 PID=${child.pid}`);
  try {
    for (let i = 0; i < 40; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); break; } catch (e) { await sleep(300); } }
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await new Promise((resolve, reject) => {
      const ws = new WebSocket(webSocketDebuggerUrl); let id = 0; const pend = new Map();
      ws.addEventListener('open', () => resolve({ send: (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); }) }));
      ws.addEventListener('error', reject);
      ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id != null && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } });
    });
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(9000);
    const ev = async e => (await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))?.result?.value;
    for (let i = 0; i < 50; i++) { if (await ev("typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&typeof openLightbox==='function'")) break; await sleep(500); }

    const open = async ctx => {
      await ev(`(function(){ try{ if(typeof closeLightbox==='function') closeLightbox(); }catch(e){}
        try{ if(typeof _closeLbHalf==='function') _closeLbHalf(); }catch(e){}
        try{ if(typeof closeCards==='function') closeCards(); }catch(e){}
        var pl=[{t:'테스트 영상',u:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',thumb:'',pa:'2024-01-01',with:['윈터(에스파)']}];
        openLightbox(pl[0].u,false,pl,0,${JSON.stringify(ctx)},false,true); return 1;})()`);
      await sleep(2200);
    };
    const halfOpen = () => ev("!!document.getElementById('yt-lightbox')?.classList.contains('lb-half-open')");

    // ── 멤버 컨텍스트: 앵커 두 버튼 + 함께한 멤버 칩 ──────────────────────────
    await open({ groupKo: '에스파', memberKo: '카리나' });
    const geo = JSON.parse(await ev(`(function(){
      var ac=document.getElementById('yt-lb-anchor-chip'), wc=document.getElementById('yt-lb-with-chips');
      var parts=[...ac.querySelectorAll('.lb-anchor-part')].map(function(b){var r=b.getBoundingClientRect();
        return {txt:b.textContent,top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),pe:getComputedStyle(b).pointerEvents};});
      var chips=[...wc.children].map(function(c){var r=c.getBoundingClientRect();
        return {txt:c.textContent,tag:c.tagName,top:Math.round(r.top),h:Math.round(r.height),pe:getComputedStyle(c).pointerEvents};});
      return JSON.stringify({parts:parts,chips:chips});})()`) || '{}');
    console.log('  측정:', JSON.stringify(geo));

    if ((geo.parts || []).length === 2) ok(`앵커 줄에 멤버·그룹 두 버튼 (${geo.parts.map(p => p.txt).join(' / ')})`);
    else fail(`앵커 버튼이 2개가 아님 — ${JSON.stringify(geo.parts)}`);
    if ((geo.parts || []).every(p => p.pe === 'auto')) ok('앵커 버튼 둘 다 클릭 가능(부모 pointer-events:none에서 복구됨)');
    else fail(`앵커 버튼에 pointer-events:none이 남음 — ${JSON.stringify(geo.parts)}`);
    if ((geo.parts || []).every(p => p.h >= 32)) ok(`앵커 버튼 세로 탭 영역 ${geo.parts[0].h}px (예전 17px)`);
    else fail(`앵커 버튼 탭 영역이 좁음 — ${JSON.stringify(geo.parts.map(p => p.h))}`);

    if ((geo.chips || []).length && geo.chips.every(c => c.tag === 'BUTTON' && c.pe === 'auto'))
      ok(`"함께한 멤버" 칩이 버튼이고 클릭 가능 (${geo.chips.map(c => c.txt).join(', ')})`);
    else fail(`함께한 멤버 칩이 안 눌림 — ${JSON.stringify(geo.chips)}`);

    // ③ 두 줄이 겹치지 않는가 (예전 -3px)
    if ((geo.parts || []).length && (geo.chips || []).length) {
      const gap = geo.chips[0].top - Math.max(...geo.parts.map(p => p.bottom));
      if (gap >= 0) ok(`두 줄이 안 겹침 — 간격 ${gap}px (예전 -3px 겹침)`);
      else fail(`두 줄이 ${-gap}px 겹침 — 위아래 탭이 서로 먹는다`);
    }

    // ── 실제로 눌러서 하프시트가 열리는지 ────────────────────────────────────
    const clickAndCheck = async (label, expr) => {
      await ev("try{_closeLbHalf&&_closeLbHalf()}catch(e){}");
      await sleep(400);
      const before = await halfOpen();
      await ev(expr);
      await sleep(1600);
      const after = await halfOpen();
      if (!before && after) ok(`${label} → 카드가 하프시트로 열림`);
      else fail(`${label} → 하프시트가 안 열림 (before=${before}, after=${after})`);
    };
    await clickAndCheck('앵커 멤버(카리나) 클릭', "document.querySelectorAll('#yt-lb-anchor-chip .lb-anchor-part')[0].click()");
    await open({ groupKo: '에스파', memberKo: '카리나' });
    await clickAndCheck('앵커 그룹(에스파) 클릭', "document.querySelectorAll('#yt-lb-anchor-chip .lb-anchor-part')[1].click()");
    await open({ groupKo: '에스파', memberKo: '카리나' });
    await clickAndCheck('함께한 멤버 칩(윈터) 클릭', "document.querySelector('#yt-lb-with-chips .lb-with-chip-btn').click()");

    // ── 그룹만 태깅된 영상(사용자가 실제로 본 화면) ──────────────────────────
    await ev("try{_closeLbHalf&&_closeLbHalf()}catch(e){}");
    await open({ groupKo: '에스파' });
    const g2 = JSON.parse(await ev(`(function(){
      var ac=document.getElementById('yt-lb-anchor-chip'), wc=document.getElementById('yt-lb-with-chips');
      return JSON.stringify({anchor:[...ac.querySelectorAll('.lb-anchor-part')].map(b=>b.textContent),
        chips:[...wc.children].map(c=>({txt:c.textContent,tag:c.tagName,pe:getComputedStyle(c).pointerEvents}))});})()`) || '{}');
    if ((g2.chips || []).length && g2.chips.every(c => c.tag === 'BUTTON' && c.pe === 'auto'))
      ok(`그룹만 태깅된 영상에서도 아래줄 멤버가 눌림 (위 ${JSON.stringify(g2.anchor)} / 아래 ${g2.chips.map(c => c.txt).join(', ')})`);
    else fail(`그룹만 태깅된 영상의 아래줄 멤버가 안 눌림 — ${JSON.stringify(g2)}`);

    // ── 멤버 칩 줄이 영상 위로 넘치지 않는가 (2026-08-28, 사용자 제보) ──────────────────
    // 증상: 세이마이네임(7명)처럼 멤버가 많으면 칩이 두 줄로 접히면서 영상 위를 덮었다.
    // 원인: #yt-lb-member-info에 걸린 max-width:56vw. 이건 원래 **1줄(그룹명)**이 ⌄/⋮ 버튼과
    //       안 부딪히게 하려던 제약인데 아래 칩 줄까지 같이 묶여 있었다 — 390px에서 컨테이너 폭이
    //       195px뿐이라 좌우 98px씩이 놀고 있었다.
    // 대응: 폭 제약은 그룹명 줄에만, 칩 줄은 전체 폭 + 넘치면 줄바꿈이 아니라 가로 스크롤(높이 고정).
    const many = ['히토미', '메이', '카니', '소하', '도희', '준휘', '승주'];
    await ev("try{_closeLbHalf&&_closeLbHalf()}catch(e){}");
    for (const [label, names] of [['7명(제보 사례)', many], ['14명(과밀)', many.concat(many)]]) {
      await ev(`(function(){ try{closeLightbox()}catch(e){}
        var pl=[{t:'[4K] SAY MY NAME Band LIVE',u:'https://www.youtube.com/watch?v=dQw4w9WgXcQ',thumb:'',pa:'2024-10-24',
          with:${JSON.stringify(names.map(n => `${n}(세이마이네임)`))}}];
        openLightbox(pl[0].u,false,pl,0,{groupKo:'세이마이네임'},false,true); return 1;})()`);
      await sleep(2200);
      const m = JSON.parse(await ev(`(function(){
        const wc=document.getElementById('yt-lb-with-chips'), ac=document.getElementById('yt-lb-anchor-chip');
        const mi=document.getElementById('yt-lb-member-info');
        const chips=[...wc.children].map(c=>c.getBoundingClientRect());
        const rows=[...new Set(chips.map(r=>Math.round(r.top)))].length;
        const cs=getComputedStyle(wc);
        // 상단바가 영상 위를 덮는지 — 영상(iframe/썸네일) 상단과 비교
        const vid=document.getElementById('yt-lb-iframe')||document.getElementById('yt-lb-media')||document.getElementById('yt-lb-frame');
        const vTop=vid?Math.round(vid.getBoundingClientRect().top):null;
        const close=document.getElementById('yt-lb-close'), menu=document.getElementById('yt-lb-menu-btn');
        const ar=ac.getBoundingClientRect();
        return JSON.stringify({rows:rows,infoBottom:Math.round(mi.getBoundingClientRect().bottom),vTop:vTop,
          overflowX:cs.overflowX,wrap:cs.flexWrap,mt:cs.marginTop,scrollable:wc.scrollWidth>wc.clientWidth+1,
          anchorL:Math.round(ar.left),anchorR:Math.round(ar.right),
          closeR:close?Math.round(close.getBoundingClientRect().right):null,
          menuL:menu?Math.round(menu.getBoundingClientRect().left):null});})()`) || '{}');
      if (m.rows !== 1) fail(`[칩 넘침/${label}] 칩이 ${m.rows}줄 — 줄바꿈되면 컨테이너가 세로로 자라 영상 위를 덮는다 (wrap=${m.wrap})`);
      else if (m.overflowX !== 'auto' && m.overflowX !== 'scroll') fail(`[칩 넘침/${label}] overflow-x가 ${m.overflowX} — 넘칠 때 잘려 나간다`);
      else if (m.vTop != null && m.infoBottom > m.vTop) fail(`[칩 넘침/${label}] 상단바 바닥(${m.infoBottom})이 영상 상단(${m.vTop})을 넘어 겹친다`);
      else if (m.closeR != null && m.anchorL < m.closeR) fail(`[버튼 충돌/${label}] 그룹명 왼쪽(${m.anchorL})이 닫기 버튼 오른쪽(${m.closeR})과 겹친다`);
      else if (m.menuL != null && m.anchorR > m.menuL) fail(`[버튼 충돌/${label}] 그룹명 오른쪽(${m.anchorR})이 메뉴 버튼 왼쪽(${m.menuL})과 겹친다`);
      else ok(`[칩 ${label}] 1줄 유지 · 상단바 바닥 ${m.infoBottom}${m.vTop != null ? ` ≤ 영상 ${m.vTop}` : ''} · ${m.scrollable ? '가로 스크롤 동작' : '스크롤 불필요(다 들어감)'} · 간격 ${m.mt}`);
    }
  } finally {
    server.close();
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`); else child.kill('SIGKILL'); } catch (e) { }
    for (let i = 0; i < 3; i++) { try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch (e) { await sleep(300); } }
  }
  console.log(pass ? '\n✅ 재생모드 상단바 테스트 통과' : '\n❌ 재생모드 상단바 테스트 실패');
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('[lb-topbar] 실행 실패:', e); process.exit(2); });
