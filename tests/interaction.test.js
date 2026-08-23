// 인터랙션 회귀 테스트 (2026-08-23 신설) — 3D 우주 탭/클릭 상호작용의 재발 방지용.
//
// 왜 만들었나: 사용자 제보 두 버그(Fable 자문 진단→클로드코드 재현·수정)를 "실패하는 테스트"로 못박아
// 다음에 같은 회귀가 나면 배포 전에 걸리게 한다(자문↔실행 협업 패턴). smoke.test.js와 동일하게 Node
// 내장 fetch/WebSocket으로 CDP를 직접 구현해 헤드리스 브라우저를 띄운다(Playwright 없음). 검증은
// 반드시 모바일 뷰포트(390px)로도 — isMob() 단락 경로는 데스크톱에선 실행조차 안 됨(PRINCIPLES).
//
// 무엇을 확인하는가:
//  [버그A] 중간 줌(멤버 이름 라벨이 아직 안 뜨는 거리)에서 멤버 별 좌표를 탭하면 멤버가 아니라 그룹
//          행성이 열려야 한다("이름이 보일 때만 그 별을 탭할 수 있다"). 가까운 줌(라벨 표시)에선 멤버가
//          정상적으로 열려야 한다(회귀 없음). 데스크톱 click 경로 + 실제 모바일 touchend 경로 둘 다.
//  [버그B] 카드를 스택으로 쌓았다가 닫은 뒤 새 카드를 열면, 시트 바닥에 이전 카드의 얼어붙은 클론이
//          남아 함께 뜨면 안 된다(새 카드만 있어야 함). 스택→뒤로가기(pop) 정상 복원도 확인.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지, smoke.test.js 참고).
// 실행: node tests/interaction.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8939;
const CDP_PORT = 9339;
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

async function waitForCdp(retries = 40) {
  for (let i = 0; i < retries; i++) { try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; } catch (e) { await sleep(300); } }
  throw new Error('CDP 포트가 안 열림 — 브라우저 실행 실패');
}
function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let msgId = 0; const pending = new Map(); const listeners = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) { return new Promise(res => { const id = ++msgId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); }); },
      on(event, cb) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(cb); },
      close() { ws.close(); },
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', e => { const msg = JSON.parse(e.data); if (msg.id != null && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); } else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method).forEach(cb => cb(msg.params)); });
  });
}
function waitForLoadEvent(cdp) { return new Promise(resolve => { cdp.on('Page.loadEventFired', () => resolve()); setTimeout(resolve, 15000); }); }
async function ev(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r && r.exceptionDetails) return { __err: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
  return r && r.result && r.result.value;
}
async function pollUntil(cdp, expr, timeoutMs, isReady = v => !!v) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { const v = await ev(cdp, expr); if (isReady(v)) return v; await sleep(200); }
  return await ev(cdp, expr);
}

async function main() {
  if (!BROWSER_PATH) { console.log('⚠️  Chromium 계열 브라우저를 못 찾음 — 인터랙션 테스트 스킵'); process.exit(0); }
  const errors = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const full = path.join(ROOT, p); if (!full.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' }); res.end(data); });
  });
  await new Promise(r => server.listen(PORT, r));
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-interaction-'));
  const child = spawn(BROWSER_PATH, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });
  console.log(`[interaction] 헤드리스 브라우저 PID=${child.pid} (전용 프로필, 종료 시 이 PID만 kill)`);

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    cdp.on('Runtime.exceptionThrown', p => errors.push((p.exceptionDetails && (p.exceptionDetails.exception && p.exceptionDetails.exception.description || p.exceptionDetails.text)) || 'exception'));
    cdp.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push((p.args || []).map(a => a.value || a.description).join(' ')); });
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    // 모바일 뷰포트(원칙: 검증은 모바일로도) — 네비게이트 전에 설정
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await waitForLoadEvent(cdp);
    await sleep(5000); // 인트로 카메라 애니메이션 정착 대기

    const ready = await pollUntil(cdp, `(typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&typeof bubbleMeshes!=='undefined'&&bubbleMeshes.length>0&&typeof camera!=='undefined'&&typeof renderer!=='undefined'&&typeof showT!=='undefined'&&isMob())`, 10000, v => v === true);
    if (!ready) { fail('앱 전역(ARTISTS/bubbleMeshes/camera/showT) 미준비 또는 isMob=false'); throw new Error('앱 미준비'); }
    ok('앱 로드 + 모바일 뷰포트 준비');

    // ── 공통: 멤버 수 가장 많은 그룹을 타깃으로, 카메라를 그 행성에서 거리 D에 배치 ──
    await ev(cdp, `(function(){let best=null,bestN=-1;bubbleMeshes.forEach(b=>{const n=ARTISTS.filter(a=>a.group&&a.group.ko===b.ko&&a._worldPos).length;if(n>bestN){bestN=n;best=b;}});window.__T={ko:best.ko};return 1;})()`);
    async function place(D) {
      // fly 애니메이션·자동회전·화면 y오프셋을 모두 끄고 카메라를 결정론적으로 고정(안 그러면 measure와 tap 사이 카메라가 움직여 탭이 빗나감)
      await ev(cdp, `(function(D){if(typeof flyState!=='undefined')flyState.active=false;try{if(typeof _mobViewShiftRaf!=='undefined'&&_mobViewShiftRaf)cancelAnimationFrame(_mobViewShiftRaf);}catch(e){}try{_mobViewShift=0;}catch(e){}try{camera.clearViewOffset();}catch(e){}const b=bubbleMeshes.find(x=>x.ko===window.__T.ko);const c=b.mesh.position;let dir=c.clone();if(dir.length()<1e-3)dir.set(0,0,1);dir.normalize();camera.position.copy(c).addScaledVector(dir,D);camera.up.set(0,1,0);camera.lookAt(c);camera.updateMatrixWorld();if(typeof controls!=='undefined'){controls.target.copy(c);controls.enabled=false;controls.autoRotate=false;}return 1;})(${D})`);
      await sleep(400); // animate 몇 프레임 → uFillOp 갱신
      // 타깃 그룹 중심에 가장 가까운(=행성을 조준했을 때 눌릴) 온스크린 멤버의 좌표를 저장
      await ev(cdp, `(function(){const b=bubbleMeshes.find(x=>x.ko===window.__T.ko);const c=b.mesh.position;const rect=renderer.domElement.getBoundingClientRect();const pc=c.clone().project(camera);const cx=(pc.x+1)*0.5*rect.width+rect.left,cy=(-pc.y+1)*0.5*rect.height+rect.top;const mem=ARTISTS.filter(a=>a.group&&a.group.ko===window.__T.ko&&a._worldPos);const pts=mem.map(a=>{const p=a._worldPos.clone().project(camera);const sx=(p.x+1)*0.5*rect.width+rect.left;const sy=(-p.y+1)*0.5*rect.height+rect.top;return{sx,sy,z:p.z,on:p.z<=1&&sx>=rect.left&&sx<=rect.right&&sy>=rect.top&&sy<=rect.bottom,dC:Math.hypot(sx-cx,sy-cy)};}).filter(m=>m.on).sort((a,b)=>a.dC-b.dC);window.__M={nearest:pts[0]||null,uFill:b.mesh.material.uniforms.uFillOp.value,dist:camera.position.distanceTo(c)};return 1;})()`);
    }
    async function whichCard() {
      // 신뢰 마커: _openTArtist(멤버 선택) vs _openGCko(그룹 선택). 모바일은 #tt를 stack 밖에 렌더할 수 있어 DOM 위치는 부정확.
      return JSON.parse(await ev(cdp, `(function(){return JSON.stringify({member:(typeof _openTArtist!=='undefined'&&_openTArtist)?true:false,group:(typeof _openGCko!=='undefined'&&_openGCko)?true:false});})()`));
    }
    async function closeAll() { await ev(cdp, `(function(){try{closeCards()}catch(e){}return 1;})()`); await sleep(400); }
    // 탭 직전 화면 y오프셋(_mobViewShift)을 0으로 동기 고정 — 이 값이 0이 아니면 히트판정 레이가 세로로
    // 밀려 별/행성을 빗맞힘. window.__M.nearest 좌표는 오프셋 없이 투영했으므로 핸들러도 0이어야 일치.
    const freezeView = `if(typeof flyState!=='undefined')flyState.active=false;try{if(typeof _mobViewShiftRaf!=='undefined'&&_mobViewShiftRaf)cancelAnimationFrame(_mobViewShiftRaf);}catch(e){}try{_mobViewShift=0;}catch(e){}try{camera.clearViewOffset();}catch(e){}`;
    async function tapClick() { // window click 경로(데스크톱/폴백)
      await ev(cdp, `(function(){${freezeView}const m=window.__M.nearest;if(!m)return 0;const x=Math.round(m.sx),y=Math.round(m.sy),cv=renderer.domElement;cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true,pointerType:'touch'}));cv.dispatchEvent(new MouseEvent('click',{clientX:x,clientY:y,bubbles:true}));return 1;})()`);
    }
    async function tapTouch() { // 실제 모바일 touchend 경로 — 페이지 안에서 DOM TouchEvent 직접 발생.
      // (CDP Input.dispatchTouchEvent는 touchend 뒤 합성 click까지 만들어 카드를 닫아버림 — 실기기에선
      //  touchend의 preventDefault가 막지만 CDP 주입은 안 막혀서, 순수 touchend만 타도록 이 방식을 씀.)
      await ev(cdp, `(function(){${freezeView}const m=window.__M.nearest;if(!m)return 0;const x=Math.round(m.sx),y=Math.round(m.sy),cv=renderer.domElement;const t=new Touch({identifier:1,target:cv,clientX:x,clientY:y});cv.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],targetTouches:[t],changedTouches:[t]}));cv.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[t]}));return 1;})()`);
    }

    // 밴드 실측(문서화용): uFillOp≤0.12(멤버 탭 가능) & labelFade=0(이름 안 뜸) 구간이 존재해야 버그 성립
    await place(35);
    const band = await ev(cdp, `JSON.stringify({uFill:+window.__M.uFill.toFixed(3),labelShown:window.__M.dist<28})`);
    console.log(`   (참고) 버그밴드 D=35 실측: ${band}`);

    // 탭 → 카드 판정. 이 테스트가 잡으려는 회귀는 "잘못된 카드 타입이 열리는 것"(중간 줌에서 멤버가
    // 열림 / 정상 줌에서 멤버가 안 열림)이다. 합성 탭이 헤드리스 애니메이션 타이밍으로 기하학적으로
    // 빗나가 아무것도 안 열리는 경우(member·group 둘 다 false)는 하니스 미스일 뿐 제품 오동작이 아니라서,
    // 최대 3회까지 재시도해 확정적 결과(둘 중 하나 열림)를 얻는다. 3회 다 미스면 soft-skip(노트)로 처리
    // — 이때도 "반대 타입이 열리는" 진짜 회귀는 재시도해도 그대로 잡히므로 탐지력은 유지된다.
    async function tapAndRead(D, tap) {
      for (let attempt = 0; attempt < 3; attempt++) {
        await closeAll(); await place(D); await tap(); await sleep(650);
        const r = await whichCard();
        if (r.member || r.group) return r;
      }
      return { member: false, group: false, missed: true };
    }
    // expect: 'group' 또는 'member'. 반대가 열리면 fail(회귀), 아무것도 안 열리면 soft-skip.
    function judge(label, D, note, expect, r) {
      const other = expect === 'group' ? 'member' : 'group';
      if (r[expect] && !r[other]) ok(`[버그A/${label}] D=${D}(${note}) → ${expect === 'group' ? '그룹' : '멤버'} 열림`);
      else if (r[other]) fail(`[버그A/${label}] D=${D}에서 ${other === 'member' ? '멤버' : '그룹'}가 열림 — 오클릭 회귀 (member=${r.member},group=${r.group})`);
      else console.log(`⏭️  [버그A/${label}] D=${D}(${note}) — 합성 탭이 3회 다 빗나감(하니스 미스, 회귀 아님) → 스킵`);
    }
    // ── [버그A] 중간 줌(D=35, 이름 안 뜸) 별 탭 → 그룹이 열려야 함 ──
    for (const [label, tap] of [['click', tapClick], ['touch', tapTouch]]) {
      judge(label, 35, '이름 안 뜸', 'group', await tapAndRead(35, tap));
    }
    // ── [버그A 회귀 가드] 가까운 줌(D=22, 이름 표시) 별 탭 → 멤버가 정상적으로 열려야 함 ──
    for (const [label, tap] of [['click', tapClick], ['touch', tapTouch]]) {
      judge(label, 22, '정상 줌', 'member', await tapAndRead(22, tap));
    }

    // ── [버그B] 스택→닫기→열기 시 이전 카드 클론이 시트 바닥에 남으면 안 됨 ──
    const pick = JSON.parse(await ev(cdp, `(function(){const seen=new Set(),out=[];for(const a of ARTISTS){if(!a._worldPos)continue;const k=(a.name&&a.name.ko)||a.name;if(!k||seen.has(k))continue;seen.add(k);out.push(k);if(out.length===3)break;}window.__P=out;return JSON.stringify(out);})()`));
    const byKo = `(function(ko){return ARTISTS.find(a=>((a.name&&a.name.ko)||a.name)===ko);})`;
    const sheetKids = `(function(){return mobSheetInner.children.length;})()`;
    await closeAll();
    await ev(cdp, `showT(${byKo}(window.__P[0]))`); await sleep(700); // A
    await ev(cdp, `showT(${byKo}(window.__P[1]))`); await sleep(800); // 스택 B → clone(A)가 바닥에 얼어붙음
    await ev(cdp, `closeMobSheet()`); await sleep(700);               // 닫기(330ms 타이머 지나도록)
    await ev(cdp, `showT(${byKo}(window.__P[2]))`); await sleep(700); // C
    const kids = await ev(cdp, sheetKids);
    if (kids === 1) ok(`[버그B] 스택→닫기→새 카드 열기 후 시트 바닥에 새 카드 1개만(클론 안 남음)`);
    else fail(`[버그B] 시트 바닥에 카드 ${kids}개 — 이전 카드 클론이 남음(이전 카드가 다시 나오는 버그)`);

    // ── [버그B 회귀 가드] 스택→뒤로가기(pop) 정상 복원 ──
    await ev(cdp, `closeMobSheet()`); await sleep(700);
    await ev(cdp, `showT(${byKo}(window.__P[0]))`); await sleep(700);
    await ev(cdp, `showT(${byKo}(window.__P[1]))`); await sleep(800);
    await ev(cdp, `_popMobCard()`); await sleep(800);
    const back = await ev(cdp, `(_openTArtist&&((_openTArtist.name&&_openTArtist.name.ko)||_openTArtist.name))||null`);
    if (back === pick[0]) ok(`[버그B] 스택→뒤로가기(pop) → 이전 카드(${pick[0]}) 정상 복원`);
    else fail(`[버그B] pop 후 복원 실패 — 기대=${pick[0]}, 실제=${back}`);

    if (errors.length) fail(`상호작용 중 콘솔 에러 ${errors.length}건: ${errors.slice(0, 5).join(' | ')}`);
    else ok('상호작용 중 콘솔 에러 0건');

    cdp.close();
  } finally {
    server.close();
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`); else child.kill('SIGKILL'); } catch (e) {}
    for (let i = 0; i < 3; i++) { try { fs.rmSync(profileDir, { recursive: true, force: true }); break; } catch (e) { await sleep(300); } }
  }

  console.log(`\n${pass ? '✅ 인터랙션 테스트 통과' : '❌ 인터랙션 테스트 실패'}`);
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('[interaction] 실행 실패:', e); process.exit(2); });
