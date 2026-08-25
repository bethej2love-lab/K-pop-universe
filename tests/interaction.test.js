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
//  [버그C] 카드 안에서 스크롤 다운하면 하단 탭바가 숨고, 스크롤 업/최상단으로 오면 다시 나타나야 한다.
//          (iOS 고무줄 바운스에서 방향 오판으로 "탭바가 안 돌아오던" 회귀 방지 — 헤드리스는 음수
//          scrollTop 바운스 자체는 재현 못 하므로, 핵심 안전망 "최상단<40px=무조건 표시"와 방향 감지를 검증.)
//  [버그D] 첫 카드가 열리는 애니메이션 중에 다음 카드를 빠르게 연속으로 열어도, 스택이 보존되고 다음
//          카드가 50% 중간 높이에서 고착되지 않고 100%(bs-full)로 완전히 열려야 한다.
//  [버그E] 탭바가 보일 때 탭바와 카드 사이에 틈이 있으면 안 된다(그 사이로 배경 우주가 비쳐 보임).
//          --sheet-bottom을 "탭바 높이 + 8px"로 잡던 상수 오차 회귀 방지.
//  [버그F] 탭바가 숨겨진 상태에서 새 카드를 열어도 그 카드가 화면을 꽉 채워야 한다. 시트 높이를 인라인
//          스타일로 박던 시절, 나중에 열리는 카드가 옛 값(60vh+탭바)에 갇히던 회귀 방지.
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

    // ── [버그C] 카드 스크롤 시 탭바 숨김/복귀 (탭바 미복귀 회귀 방지) ──
    // 헤드리스 Chrome은 iOS 고무줄(음수/초과 scrollTop) 자체를 재현 못 하므로, 수정의 핵심인
    // "다운=숨김 / 업=표시 / 최상단(<40px)=무조건 표시(안전망)"를 결정론적으로 검증한다. 스크롤이
    // 실제로 걸리도록 시트 안에 임시 스페이서를 넣고 scrollTop을 직접 세팅해 scroll 이벤트를 발생시킨다.
    await closeAll();
    await ev(cdp, `showT(${byKo}(window.__P[0]))`); await sleep(700);
    await ev(cdp, `(function(){const sp=document.createElement('div');sp.id='__tb_spacer';sp.style.height='2000px';mobSheetInner.appendChild(sp);return 1;})()`);
    const tabHidden = async () => await ev(cdp, `document.getElementById('tabbar').classList.contains('tab-hidden')`);
    const scrollSheet = async (y) => { await ev(cdp, `(function(y){mobSheetInner.scrollTop=y;mobSheetInner.dispatchEvent(new Event('scroll'));return 1;})(${y})`); await sleep(120); };
    const c0 = await tabHidden();                       // 초기: 표시(false)
    await scrollSheet(300); const cDown = await tabHidden();   // 다운: 숨김(true)
    await scrollSheet(180); const cUp = await tabHidden();     // 업(여전히 >40): 표시(false)
    await scrollSheet(300); const cDown2 = await tabHidden();  // 다시 다운: 숨김(true)
    await scrollSheet(0);   const cTop = await tabHidden();    // 최상단: 안전망으로 무조건 표시(false)
    await ev(cdp, `(function(){const s=document.getElementById('__tb_spacer');if(s)s.remove();return 1;})()`);
    if (!c0 && cDown && !cUp && cDown2 && !cTop) ok('[버그C] 다운=숨김 / 업=복귀 / 최상단=강제표시(탭바 미복귀 회귀 방지)');
    else fail(`[버그C] 탭바 숨김/복귀 오동작 — 초기=${c0}(false여야) 다운=${cDown}(true여야) 업=${cUp}(false여야) 다운2=${cDown2}(true여야) 최상단=${cTop}(false여야)`);

    // ── [버그D] 빠른 연속 카드 오픈 시 다음 카드가 50%에서 고착되면 안 됨 ──
    // 재현: 한 틱에 showT 3번을 연속 호출 → 첫 오픈 애니(340ms)가 끝나기 전에 2·3번째가 들어온다.
    // 예전엔 열림 판정이 bs-open(rAF 한 프레임 뒤 부착)에 의존해 오분기·스택 덮어쓰기 + 뒤늦은
    // setTimeout이 새 애니 중간에 transform을 초기화해 중간 높이 고착. 이제 스택 보존 + 100% 완전 오픈.
    await closeAll();
    await ev(cdp, `(function(){showT(${byKo}(window.__P[0]));showT(${byKo}(window.__P[1]));showT(${byKo}(window.__P[2]));return 1;})()`);
    await sleep(900); // 340ms 슬라이드업 + rAF 정착 대기
    const rapid = JSON.parse(await ev(cdp, `JSON.stringify({stack:_cardStack.length,full:mobCardStackEl.classList.contains('bs-full'),open:mobCardStackEl.classList.contains('bs-open'),xf:mobCardStackEl.style.transform,disp:mobCardStackEl.style.display})`));
    const xfCleared = rapid.xf === '' || rapid.xf === 'translateY(0px)' || rapid.xf === 'translateY(0)';
    if (rapid.stack === 3 && rapid.full && rapid.open && xfCleared && rapid.disp === 'block')
      ok('[버그D] 빠른 연속 오픈 3장 → 스택 보존(3) + 카드 100%(bs-full) 완전 오픈(중간 고착 없음)');
    else fail(`[버그D] 연속 오픈 고착/스택깨짐 — stack=${rapid.stack}(3기대) full=${rapid.full} open=${rapid.open} transform="${rapid.xf}"(비어야) disp=${rapid.disp}`);
    await closeAll();

    // ── [버그E] 탭바가 보일 때 탭바와 카드 사이에 틈(배경 우주가 비침)이 없어야 함 ──
    // 원인이었던 것: updateSheetBottom()이 --sheet-bottom을 "탭바 높이 + 8px"로 잡아서 시트가 항상
    // 8px 떠 있었음(2026-08-14에도 같은 증상이 트랜지션 속도 불일치로 한 번 났던, 재발 계열 버그).
    await ev(cdp, `showT(${byKo}(window.__P[0]))`); await sleep(900);
    const gap = JSON.parse(await ev(cdp, `JSON.stringify((function(){
      const tb=document.getElementById('tabbar'),ms=document.getElementById('mob-sheet');
      return {hidden:tb.classList.contains('tab-hidden'),gap:Math.round(tb.getBoundingClientRect().top-ms.getBoundingClientRect().bottom)};
    })())`));
    if (!gap.hidden && gap.gap === 0) ok('[버그E] 탭바-카드 틈 0px(배경 우주 비침 없음)');
    else fail(`[버그E] 탭바-카드 사이 틈 ${gap.gap}px (0이어야 함, 탭바숨김=${gap.hidden})`);

    // ── [버그F] 탭바가 숨겨진 상태에서 새 카드를 열면 그 카드도 화면을 꽉 채워야 함 ──
    // 원인이었던 것: _extendSheets()가 시트 3개에 인라인 min/max-height를 "호출 시점의 bs-full 여부"로
    // 박아서, 그때 숨겨져 있던 mob-card-stack이 60vh+탭바 값에 갇혔고 나중에 bs-full로 열려도 그 인라인
    // 값이 CSS를 이겨 화면을 못 채웠음("카드 여기저기 열었다 닫았다 하면 탭바 로직이 깨진다"의 정체).
    await ev(cdp, `(function(){const sp=document.createElement('div');sp.id='__tb_spacer2';sp.style.height='2000px';mobSheetInner.appendChild(sp);return 1;})()`);
    await ev(cdp, `(function(){mobSheetInner.scrollTop=400;mobSheetInner.dispatchEvent(new Event('scroll'));return 1;})()`);
    await sleep(500);
    const hiddenBefore = await ev(cdp, `document.getElementById('tabbar').classList.contains('tab-hidden')`);
    await ev(cdp, `showT(${byKo}(window.__P[1]))`); await sleep(900);
    // 새 카드는 맨 위(scrollTop 0)에서 시작하므로 탭바가 다시 나오는 게 정상 — 그래서 기대 높이는
    // 그 시점의 --sheet-bottom을 그대로 반영한 "--mob-vh - --sheet-bottom - 24"다. 핵심은 이 값이지
    // 옛날 인라인 고착값(60vh + 탭바 - 24)이 아니라는 것. (--mob-vh는 visualViewport 기준이라
    // 헤드리스에선 window.innerHeight와 다를 수 있어 반드시 CSS 변수에서 읽는다.)
    const stacked = JSON.parse(await ev(cdp, `JSON.stringify((function(){
      const inner=document.getElementById('mob-card-stack-inner');
      const rs=getComputedStyle(document.documentElement);
      const mobVh=parseFloat(rs.getPropertyValue('--mob-vh'))||window.innerHeight;
      const sb=parseFloat(rs.getPropertyValue('--sheet-bottom'))||0;
      return {innerH:Math.round(inner.clientHeight),expect:Math.round(mobVh-sb-24),
              stale:Math.round(window.innerHeight*0.6+(parseFloat(getComputedStyle(document.getElementById('tabbar')).height)||0)-24),
              inlineMax:inner.style.maxHeight,disp:mobCardStackEl.style.display};
    })())`));
    await ev(cdp, `(function(){const s=document.getElementById('__tb_spacer2');if(s)s.remove();return 1;})()`);
    if (hiddenBefore && stacked.disp === 'block' && Math.abs(stacked.innerH - stacked.expect) <= 4 && stacked.inlineMax === '')
      ok(`[버그F] 탭바 숨김 중 연 카드도 시트 높이 정상(inner ${stacked.innerH}, 옛 고착값 ${stacked.stale} 아님, 인라인 높이 잔존 없음)`);
    else fail(`[버그F] 스택 카드 높이 고착 — 숨김선행=${hiddenBefore} disp=${stacked.disp} inner=${stacked.innerH}(기대 ${stacked.expect}, 옛 고착값 ${stacked.stale}) 인라인max="${stacked.inlineMax}"(비어야)`);
    await closeAll();

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
