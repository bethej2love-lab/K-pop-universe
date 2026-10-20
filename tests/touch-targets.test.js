// 카드 버튼 터치 영역 · '나' 탭 라벨 · 데스크톱 탭바 라벨 회귀 테스트 (2026-10-20, Codex 모바일 점검 P2 + 사용자 요청)
//
//  ① 모바일 '나' 탭: 프로필 갱신(_updateProfileBtns) 뒤에도 라벨이 남고, 다른 탭과 키가 같다
//     (예전엔 innerHTML을 아이콘만으로 덮어 라벨이 사라지고 키가 27px로 낮아졌다).
//  ② 멤버 카드 상단(하트·공유·+)·영상 도구 줄(단독만·검색·정렬·선택)의 **실제 눌리는 높이**가 40px 이상,
//     연결 버튼은 30px 이상(가로 스크롤 줄 안이라 위아래 여유가 적다). elementFromPoint로 잰다(보이는 크기 아님).
//  ③ 데스크톱 우상단 탭바: 홈/검색/탐험/나 라벨, 부가 버튼 툴팁. 프로필 갱신 뒤에도 유지.
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료(프로세스명 일괄 kill 금지). 브라우저가 없으면 스킵.
// 실행: node tests/touch-targets.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8981, CDP_PORT = 9381;
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

(async () => {
  if (!BROWSER_PATH) { console.log('⏭️  브라우저를 못 찾음 — 스킵'); process.exit(0); }
  server.listen(PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-tap-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[touch-targets] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    // ── 모바일(터치) ──
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(7000);
    if (!(await ev(cdp, `typeof showT==='function'&&typeof _updateProfileBtns==='function'&&ARTISTS.length>0`))) { bad('앱 미준비'); throw new Error('미준비'); }
    ok('앱 로드');
    const tab = JSON.parse(await ev(cdp, `(function(){_updateProfileBtns();const p=document.getElementById('tab-profile'),h=document.getElementById('tab-home');
      return JSON.stringify({label:(p.querySelector('.tab-label')||{}).textContent||'',ph:p.getBoundingClientRect().height,hh:h.getBoundingClientRect().height});})()`));
    if (tab.label) ok(`① '나' 탭 라벨 유지(${tab.label})`); else bad("① '나' 탭 라벨 사라짐");
    if (Math.abs(tab.ph - tab.hh) <= 2) ok(`① '나' 탭 높이 = 홈 탭(${Math.round(tab.ph)}px)`); else bad(`① '나' 탭 ${tab.ph}px vs 홈 ${tab.hh}px`);

    await ev(cdp, `(showT(ARTISTS.find(a=>a.name&&a.name.ko==='카리나'&&a.group&&a.group.ko==='에스파')||ARTISTS.find(a=>a._worldPos&&a.group&&GROUPS[a.group.ko])),1)`);
    await sleep(6000);
    const HIT = `(function(sel){const el=sel==='SORT'?(document.querySelector('#mob-sheet .gc-ch-only')?.parentElement?.querySelector('.gc-ch-sort-btn')):document.querySelector(sel);if(!el)return -1;const r=el.getBoundingClientRect();if(!r.height)return -1;
      const cx=r.left+r.width/2,cy=r.top+r.height/2;const reach=dy=>{let d=0;for(let k=1;k<=30;k++){const t=document.elementFromPoint(cx,cy+dy*k);if(t&&(t===el||el.contains(t)))d=k;else break;}return d;};
      return reach(-1)+reach(1)+1;})`;
    const hit = async sel => ev(cdp, `${HIT}(${JSON.stringify(sel)})`);
    for (const [sel, min] of [['#tt-fav', 40], ['#tt-share', 40], ['#tt-card-menu', 40], ['#tt-conn-btn', 30]]) {
      const h = await hit(sel);
      if (h < 0) console.log(`  (건너뜀: ${sel} 안 보임)`); else if (h >= min) ok(`② ${sel} 눌리는 높이 ${h}px`); else bad(`② ${sel} 눌리는 높이 ${h}px (< ${min})`);
    }
    await ev(cdp, `(document.querySelector('#mob-sheet .gc-ch-only')?.scrollIntoView({block:'center'}),1)`); await sleep(1500);
    for (const sel of ['#mob-sheet .gc-ch-only', '#mob-sheet .gc-ch-search-toggle', 'SORT', '#mob-sheet .gc-ch-sel-btn']) {
      const h = await hit(sel);
      if (h < 0) console.log(`  (건너뜀: ${sel} 안 보임)`); else if (h >= 40) ok(`② ${sel.split(' ').pop()} 눌리는 높이 ${h}px`); else bad(`② ${sel} 눌리는 높이 ${h}px (< 40)`);
    }

    // ── 데스크톱 ──
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(7000);
    const d = JSON.parse(await ev(cdp, `(function(){_updateProfileBtns();const r=document.getElementById('dh-right').getBoundingClientRect();
      return JSON.stringify({labels:[...document.querySelectorAll('#dh-right .dh-label')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.textContent),
        titles:['dh-random-btn','dh-fav-btn','dh-lang-btn','dh-settings-btn'].map(i=>document.getElementById(i).title),h:r.height,right:r.right});})()`));
    if (d.labels.join(',') === '홈,검색,탐험,나') ok('③ 데스크톱 탭바 라벨 4개(프로필 갱신 뒤에도)'); else bad(`③ 라벨 ${JSON.stringify(d.labels)}`);
    if (d.titles.every(Boolean)) ok('③ 부가 버튼 툴팁 4개'); else bad(`③ 툴팁 ${JSON.stringify(d.titles)}`);
    if (d.h <= 44 && d.right <= 1280) ok(`③ 탭바 한 줄(${Math.round(d.h)}px)·화면 안`); else bad(`③ 탭바 높이 ${d.h}·오른쪽 ${d.right}`);
  } catch (e) {
    bad('예외: ' + e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
