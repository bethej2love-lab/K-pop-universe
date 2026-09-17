// 내 우주 카드 진입 게이트 — 막다른 길이 없어야 한다 (2026-09-18 신설)
//
// 왜: 앱을 처음 본 사람이 제일 먼저 누른 게 "✦ 내 우주 카드 만들기"였다(2026-09-18 제보).
// 그 버튼은 FAVORITES 리스트 **아래** 점선 슬롯이라 #col-create-btn("+ 새 컬렉션")과 CSS가
// 한 글자도 다르지 않았고 — 즉 "여기서 만들어 넣으세요"로 읽혔다. 우주 카드는 만드는 게 아니라
// 이미 모아둔 걸 내보내는 기능이므로 섹션 헤더의 공유 아이콘으로 강등했다.
//
// 그리고 눌러봐야 **두 겹의 막다른 길**이 있었다:
//   ① favMode(Highlight)가 꺼져 있으면 → "먼저 즐겨찾기 하이라이트(♥)를 켜주세요"로 끝.
//      하이라이트는 카드가 쓰는 궤도 배치를 만드는 내부 준비 단계일 뿐 유저가 할 일이 아니다.
//   ② 프로필(닉네임)이 없으면 → _enterMyUniverseMode가 `if(!myStarSprite)return`으로 통째로
//      빠져나가 궤도가 0개 → 카드는 영원히 "정렬 중이에요, 잠시 후 다시 시도해주세요".
//      ②는 신규 유저가 100% 밟는 경로인데 화면엔 "잠시 후"라고만 떠서 버그로도 안 보였다.
//
// ⚠️ 이건 반드시 실제 브라우저로 확인한다. 소스 문자열 검사로는 ②를 절대 못 잡는다 —
//    "하이라이트를 켜준다"는 코드가 멀쩡히 있어도 그 다음 단계가 조용히 0개를 만들기 때문.
//    (실제로 ①만 고치고 통과시켰다가 헤드리스에서 "정렬 중"에 걸려 ②를 발견했다.)
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/uc-card-gate.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8957;
const CDP_PORT = 9357;
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
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
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

// ⚠️ favMode·GROUPS·myProfile은 전부 최상위 let/const라 window에 안 붙는다 — evaluate 안에서
//    맨이름으로 참조할 것(`window.favMode`는 항상 undefined라 테스트가 조용히 통과해버린다).
const APP_READY = `(typeof GROUPS!=='undefined'&&Object.keys(GROUPS).length>0&&typeof renderFavList==='function')`;

(async () => {
  if (!BROWSER_PATH) { console.log('⏭️  브라우저를 못 찾음 — 스킵'); process.exit(0); }
  server.listen(PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-ucg-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[uc-card-gate] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);

  // 케이스마다 localStorage를 다르게 심어야 해서 탭을 새로 연다(컨텍스트 재사용 금지 —
  // favGroups/myProfile은 부팅 시점에 한 번만 읽히므로 나중에 바꿔도 앱은 모른다).
  async function boot(seed) {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.clear();${Object.entries(seed).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}}catch(e){}`,
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 60; i++) { if (await ev(cdp, APP_READY)) break; await sleep(500); }
    if (!await ev(cdp, APP_READY)) throw new Error('앱 미준비');
    await sleep(2500);
    return cdp;
  }
  // 신규 유저 취급을 안 받도록 방문 횟수만 올려둔다(온보딩 자동 오버레이가 클릭을 가로채는 것 방지)
  const BASE = { kpu_visit_count: '9' };
  const VIS = `(function(){const b=document.getElementById('uc-card-btn');return !!b&&getComputedStyle(b).display!=='none';})()`;

  try {
    await waitForCdp();

    // ── ① 즐겨찾기 0 — 버튼 자체가 없어야 한다(누를 막다른 길이 존재하지 않게) ──
    {
      const cdp = await boot({ ...BASE });
      const shape = await ev(cdp, `(function(){const b=document.getElementById('uc-card-btn');return b?{
        inHd:!!b.closest('.fav-hd-right'),cls:b.className,svg:!!b.querySelector('svg'),
        text:b.textContent.trim(),title:b.getAttribute('title')||''}:null;})()`);
      if (!shape) bad('#uc-card-btn이 없음');
      else {
        shape.inHd ? ok('FAVORITES 헤더(.fav-hd-right) 안에 있음 — 리스트 아래 점선 슬롯이 아님')
                   : bad('리스트 아래로 돌아감 — #col-create-btn("새로 만들기")과 다시 헷갈린다');
        shape.cls === 'share-btn' ? ok('기존 .share-btn 컴포넌트 재사용')
                                  : bad(`.share-btn이 아님(class="${shape.cls}")`);
        // data-i18n이 남아 있으면 applyLang이 textContent로 SVG를 통째로 날린다(언어 토글 시 아이콘 실종).
        (shape.svg && shape.text === '') ? ok('아이콘만 — applyLang이 SVG를 덮어쓰지 않음')
                                         : bad(`아이콘이 텍스트로 덮였음(text="${shape.text}")`);
        shape.title ? ok(`툴팁 유지: "${shape.title}"`) : bad('툴팁(title) 없음 — 아이콘만 남으면 뜻을 알 길이 없다');
      }
      (await ev(cdp, VIS)) === false ? ok('즐겨찾기 0이면 숨김')
                                     : bad('즐겨찾기 0인데 버튼이 보임 — 눌러도 만들 게 없다');
      cdp.close();
    }

    // ── ② 즐겨찾기는 있는데 프로필(별)이 없음 = 신규 유저가 실제로 밟는 경로 ──
    {
      const gko = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')))[0];
      const cdp = await boot({ ...BASE, kpu_fav_groups: JSON.stringify([gko]) });
      if (await ev(cdp, `!myProfile||!myProfile.nickname`)) ok('사전조건: 닉네임 없음');
      else bad('사전조건 실패 — 닉네임이 있으면 이 케이스가 아니다');
      (await ev(cdp, VIS)) ? ok('즐겨찾기가 생기면 아이콘이 나타남') : bad('즐겨찾기가 있는데 숨겨짐');
      await ev(cdp, `document.getElementById('uc-card-btn').click()`);
      await sleep(700);
      const r = await ev(cdp, `({card:document.getElementById('uc-card-overlay').classList.contains('open'),
        star:document.getElementById('welcome-choice-overlay').classList.contains('open')})`);
      !r.card ? ok('카드 오버레이가 아예 안 열림 — "정렬 중이에요"에 갇히던 경로 제거')
              : bad('카드 오버레이가 열림 — 별이 없으면 궤도가 0개라 영원히 못 끝난다');
      r.star ? ok('대신 실제로 필요한 "별 만들기" 화면으로 넘어감')
             : bad('아무 데도 안 감 — 눌러도 반응이 없는 버튼이 됐다');
      cdp.close();
    }

    // ── ③ 프로필 있음 + 즐겨찾기 1개 + Highlight 꺼짐 → 끝까지 카드가 나와야 한다 ──
    {
      const gko = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')))[0];
      const cdp = await boot({
        ...BASE, kpu_fav_groups: JSON.stringify([gko]),
        kpu_profile: JSON.stringify({ nickname: '검증용', color: [155, 210, 255] }),
      });
      const pre = await ev(cdp, `({favMode,active:_myUniverseActive})`);
      (pre.favMode === false && pre.active === false)
        ? ok('사전조건: Highlight 꺼짐 — 예전이라면 "먼저 ♥를 켜주세요"로 끝났을 상태')
        : bad(`사전조건 실패(favMode=${pre.favMode}, active=${pre.active})`);
      await ev(cdp, `document.getElementById('uc-card-btn').click()`);
      // 궤도 정렬(MY_UNIVERSE_ENTER_MS=750)은 animate 루프에서 진행 → 이미지가 뜰 때까지 기다린다
      for (let i = 0; i < 40; i++) {
        if (await ev(cdp, `document.getElementById('uc-card-img').classList.contains('loaded')`)) break;
        await sleep(500);
      }
      const post = await ev(cdp, `({status:document.getElementById('uc-card-status').textContent,
        loaded:document.getElementById('uc-card-img').classList.contains('loaded'),
        w:document.getElementById('uc-card-img').naturalWidth,
        h:document.getElementById('uc-card-img').naturalHeight,
        shareOn:!document.getElementById('uc-card-share').disabled,favMode})`);
      /켜주세요|Turn on/.test(post.status) ? bad(`"하이라이트를 켜주세요" 막다른 길이 되살아남: "${post.status}"`)
                                          : ok('"하이라이트를 켜주세요"로 끝나지 않음');
      (post.loaded && post.w > 0) ? ok(`카드 이미지가 실제로 생성됨 (${post.w}x${post.h})`)
                                  : bad(`카드가 안 나옴 — 남은 상태문구: "${post.status}"`);
      post.shareOn ? ok('저장/공유 버튼 활성화됨') : bad('이미지는 떴는데 저장/공유가 비활성');
      post.favMode === true ? ok('favMode를 유저 대신 켜준 것이 반영됨') : bad('favMode가 안 켜짐');
      cdp.close();
    }

    // ── ④ 연결선 즐겨찾기만 — 궤도에 아무것도 안 모이므로 숨겨야 한다 ──
    {
      const cdp = await boot({ ...BASE, kpu_fav_connections: JSON.stringify(['a|b']) });
      const r = await ev(cdp, `({conn:favConnections.size,vis:${VIS}})`);
      (r.conn === 1 && r.vis === false) ? ok('연결선 즐겨찾기만으로는 아이콘이 안 뜸')
                                        : bad(`연결선만 있는데 버튼이 보임(conn=${r.conn}, vis=${r.vis})`);
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
