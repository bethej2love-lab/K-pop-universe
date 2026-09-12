// 매일 루틴 무인 실행기 (헤드리스 · 2026-09-12)
//
// 회사님이 관리자 패널에서 손으로 누르던 "▶ 매일 루틴 실행"을, GitHub Actions가 정해진 시각마다
// 사람 없이 대신 눌러준다. 루틴 로직(동기화 1~3 + 태깅 스윕 2~6)을 서버용으로 다시 옮겨쓰지 않고,
// **실제 배포된 사이트(kpop-universe.kr)를 헤드리스 크롬으로 그대로 띄워** admin.js의 _admRunRoutine을
// 호출한다 → 브라우저에서 누르는 것과 100% 동일, 로직 드리프트 0.
//
// tests/smoke.test.js와 같은 방식 — Playwright/Puppeteer 없이 fetch/WebSocket으로 CDP를 직접 구현한다
// (레포에 npm 의존성을 안 들인다는 관례). Node 22의 전역 fetch/WebSocket 사용.
//
// ── 로그인 ────────────────────────────────────────────────────────────────────
// 앱 UI엔 구글/X OAuth만 있어 헤드리스에서 자동 로그인이 불가능하다. 그래서 관리자 계정에 비밀번호를
// 하나 심어두고(tools/set_admin_password.mjs, 1회) 페이지 컨텍스트에서 sb.auth.signInWithPassword로
// 로그인한다. 로그인 성공 → 새로고침 → 앱이 _isAdmin()을 참으로 보고 admin.js를 자동 로드.
//
// ── 증분 유지(중요) ───────────────────────────────────────────────────────────
// 루틴의 증분 스코프(_admRoutineScopeSince)는 localStorage(kpu_adm_*)를 본다 → 매번 빈 프로필로 열면
// 매 실행이 "전량 스캔"(37만 행)이 된다. 그래서 --user-data-dir 프로필 폴더를 실행 간 유지한다
// (GitHub Actions에서는 actions/cache로 이 폴더를 캐시). 세션도 여기 남아 재로그인 비용도 준다.
//
// 필요한 환경변수:
//   KPU_ADMIN_EMAIL     관리자 이메일 (기본 bethej2love@gmail.com)
//   KPU_ADMIN_PASSWORD  set_admin_password.mjs로 심어둔 비밀번호 (필수)
//   KPU_YT_API_KEY      YouTube Data API 키 — 동기화(1단계)에 필요 (WITH_SYNC=1일 때 필수)
//   SITE_URL            기본 https://kpop-universe.kr
//   PROFILE_DIR         크롬 프로필/체크포인트 보관 폴더 (기본 OS 임시폴더 내 고정 경로)
//   CHROME_PATH         크롬 실행 파일 경로 (없으면 표준 경로들을 탐색)
//   WITH_SYNC           '0'이면 동기화(1~3) 빼고 스윕(2~6)만 (기본 '1' = 전체)
//   ROUTINE_TIMEOUT_MIN 루틴 완료 대기 상한(분, 기본 300)

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const SITE_URL = process.env.SITE_URL || 'https://kpop-universe.kr';
const ADMIN_EMAIL = (process.env.KPU_ADMIN_EMAIL || 'bethej2love@gmail.com').trim();
const ADMIN_PW = process.env.KPU_ADMIN_PASSWORD || '';
const YT_KEY = (process.env.KPU_YT_API_KEY || '').trim();
const WITH_SYNC = process.env.WITH_SYNC !== '0';
const ROUTINE_TIMEOUT_MS = (Number(process.env.ROUTINE_TIMEOUT_MIN) || 300) * 60 * 1000;
const PROFILE_DIR = process.env.PROFILE_DIR || path.join(os.tmpdir(), 'kpu-routine-profile');
const CDP_PORT = 9444;

const BROWSER_PATHS = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function die(msg) { console.error('\n❌ ' + msg); process.exit(1); }

function findBrowser() {
  for (const p of BROWSER_PATHS) { try { if (fs.existsSync(p)) return p; } catch (e) {} }
  return null;
}

async function waitForCdp(retries = 40) {
  for (let i = 0; i < retries; i++) {
    try { await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json(); return; }
    catch (e) { await sleep(300); }
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
  return new Promise(resolve => { cdp.on('Page.loadEventFired', () => resolve()); setTimeout(resolve, 20000); });
}

// 페이지 컨텍스트에서 식을 평가. awaitPromise=true면 Promise가 풀릴 때까지 기다린다.
async function evalExpr(cdp, expr, awaitPromise = false) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
  if (r && r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('page eval: ' + (d.exception?.description || d.text || 'unknown'));
  }
  return r?.result?.value;
}

async function pollUntil(cdp, expr, timeoutMs, isReady = v => !!v, stepMs = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    let v;
    try { v = await evalExpr(cdp, expr); } catch (e) { v = undefined; }
    if (isReady(v)) return v;
    await sleep(stepMs);
  }
  try { return await evalExpr(cdp, expr); } catch (e) { return undefined; }
}

async function main() {
  if (!ADMIN_PW) die('KPU_ADMIN_PASSWORD 환경변수가 없습니다. tools/set_admin_password.mjs로 관리자 비번을 먼저 심어주세요.');
  if (WITH_SYNC && !YT_KEY) die('KPU_YT_API_KEY 환경변수가 없습니다(동기화 1단계에 필요). 스윕만 돌리려면 WITH_SYNC=0으로 실행하세요.');

  const BROWSER = findBrowser();
  if (!BROWSER) die('크롬/크로미움 실행 파일을 못 찾았습니다. CHROME_PATH 환경변수로 경로를 지정하세요.');

  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  console.log(`[routine] 브라우저=${BROWSER}`);
  console.log(`[routine] 사이트=${SITE_URL} · 프로필=${PROFILE_DIR} · 동기화=${WITH_SYNC ? '포함' : '제외'}`);

  const child = spawn(BROWSER, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${PROFILE_DIR}`,
    'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[routine] 헤드리스 크롬 PID=${child.pid}`);

  const errors = [];
  const perfLines = [];
  let ok = false;
  let summary = '';
  let cdp = null;

  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    cdp = await connectCdp(webSocketDebuggerUrl);

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    // alert/confirm은 자동 수락 — 루틴은 무인 실행이라 다이얼로그에서 멈추면 안 된다
    cdp.on('Page.javascriptDialogOpening', () => cdp.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}));
    cdp.on('Runtime.exceptionThrown', p => errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception'));
    // 동기화 속도 계측 — admin.js가 console.log로 남기는 채널별 소요/느린 top10을 모아 Summary에 붙인다.
    // (어디가 느린지 추측 말고 데이터로 보려는 것, 2026-09-13)
    cdp.on('Runtime.consoleAPICalled', p => {
      const txt = (p.args || []).map(a => (a.value !== undefined ? a.value : (a.description || ''))).join(' ');
      if (/\[YT sync\]|\[루틴\]|\[ext sync\]/.test(txt)) perfLines.push(txt);
    });

    // 1. 사이트 로드 + Supabase 클라이언트 준비 대기
    await cdp.send('Page.navigate', { url: SITE_URL });
    await waitForLoadEvent(cdp);
    // ⚠️ sb는 index.html에서 `let sb=null`로 선언 → window 속성이 아니라 전역 렉시컬 바인딩이라
    //    window.sb는 항상 undefined. 반드시 맨이름 sb로 접근한다(_admRoutineRunning도 let이라 동일).
    const sbReady = await pollUntil(cdp, `(typeof sb!=='undefined' && sb!==null)`, 30000, v => v === true);
    if (!sbReady) throw new Error('Supabase 클라이언트(sb)가 준비되지 않음 — 사이트 로드 실패 의심');

    // 2. 관리자 비번 로그인 (페이지 컨텍스트)
    const loginExpr = `(async()=>{try{`
      + `const r=await sb.auth.signInWithPassword({email:${JSON.stringify(ADMIN_EMAIL)},password:${JSON.stringify(ADMIN_PW)}});`
      + `return{error:r.error?r.error.message:null,email:r.data&&r.data.user?r.data.user.email:null};`
      + `}catch(e){return{error:String(e&&e.message||e),email:null};}})()`;
    const login = await evalExpr(cdp, loginExpr, true);
    if (!login || login.error) {
      throw new Error('관리자 로그인 실패: ' + (login && login.error ? login.error : '알 수 없음') +
        '\n   → Supabase에서 Email 로그인 제공자가 켜져 있고, tools/set_admin_password.mjs로 이 이메일에 비번을 심었는지 확인하세요.');
    }
    if (login.email !== ADMIN_EMAIL) throw new Error(`로그인된 이메일이 관리자와 다름: ${login.email}`);
    console.log(`[routine] 로그인 성공: ${login.email}`);

    // 3. YouTube API 키 주입(localStorage) — 동기화 단계가 여기서 읽는다
    if (YT_KEY) await evalExpr(cdp, `localStorage.setItem('kpu_yt_key', ${JSON.stringify(YT_KEY)})`);

    // 4. 새로고침 → 앱이 세션을 보고 admin.js 자동 로드
    await cdp.send('Page.navigate', { url: SITE_URL });
    await waitForLoadEvent(cdp);
    const adminReady = await pollUntil(cdp,
      `(typeof _admRunRoutine==='function' && typeof _isAdmin==='function' && _isAdmin()===true)`,
      45000, v => v === true);
    if (!adminReady) throw new Error('admin.js가 로드되지 않음(_admRunRoutine 없음) — 관리자 세션/스크립트 로드 실패');
    console.log('[routine] admin.js 로드 확인 — 루틴 시작');

    // 5. 루틴 실행 — 오래 걸리므로 await 없이 발사하고 완료 여부를 폴링한다
    await evalExpr(cdp, `_admRunRoutine(${WITH_SYNC ? 'true' : 'false'})`);
    // 시작 확인(_admRoutineRunning이 true가 될 때까지 잠깐) — let 전역이라 맨이름으로 접근
    const started = await pollUntil(cdp, `_admRoutineRunning===true`, 15000, v => v === true, 300);
    if (!started) {
      const already = await evalExpr(cdp, `_admRoutineRunning`);
      if (already !== false) throw new Error('루틴이 시작되지 않음(_admRoutineRunning 상태 이상)');
    }
    // 완료 대기 — running이 false로 돌아올 때까지
    console.log(`[routine] 진행 중… (최대 ${Math.round(ROUTINE_TIMEOUT_MS / 60000)}분 대기)`);
    const finished = await pollUntil(cdp, `_admRoutineRunning===false`, ROUTINE_TIMEOUT_MS, v => v === true, 3000);
    summary = (await evalExpr(cdp, `document.getElementById('adm-routine-log')?.innerText || ''`)) || '';
    if (!finished) throw new Error('루틴이 시간 안에 끝나지 않음(타임아웃)\n--- 그때까지 로그 ---\n' + summary);

    const failedSteps = (summary.match(/^❌/gm) || []).length;
    ok = failedSteps === 0;
    console.log('\n===== 루틴 결과 =====\n' + summary + '\n=====================');
    if (perfLines.length) console.log('\n----- 동기화 속도 계측 -----\n' + perfLines.join('\n'));
    if (failedSteps) console.error(`[routine] 실패한 단계 ${failedSteps}개`);
  } catch (e) {
    console.error('\n❌ ' + (e && e.message ? e.message : e));
    if (errors.length) console.error('페이지 콘솔 예외:\n  ' + errors.slice(0, 8).join('\n  '));
  } finally {
    try { if (cdp) cdp.close(); } catch (e) {}
    // 이름이 아니라 정확한 PID만 종료(다른 크롬 창 보호) — smoke.test.js와 같은 규칙
    try { if (process.platform === 'win32') execSync(`taskkill /PID ${child.pid} /T /F`); else child.kill('SIGKILL'); } catch (e) {}
  }

  // GitHub Actions 요약 패널에도 남긴다
  if (process.env.GITHUB_STEP_SUMMARY && summary) {
    try {
      const perf = perfLines.length ? `\n\n### 동기화 속도 계측\n\`\`\`\n${perfLines.join('\n')}\n\`\`\`\n` : '';
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
        `## 매일 루틴 ${ok ? '✅ 완료' : '⚠️ 문제 있음'}\n\n\`\`\`\n${summary}\n\`\`\`\n${perf}`);
    } catch (e) {}
  }
  process.exit(ok ? 0 : 1);
}

main().catch(e => die(e && e.message ? e.message : String(e)));
