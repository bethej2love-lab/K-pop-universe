// 영상은 어디서 눌러도 "같은 라이트박스"로 열려야 한다 (2026-10-01 신설)
//
// 왜: 사용자 제보 "검색해서 영상 누르면 라이트박스 모드 아니네". 검색 결과 클릭이 openLightbox(url, isShort)만
// 불러 재생목록 항목이 없었고, 그러면 라이트박스가 **제목·조회수·저장/컬렉션·멤버 칩·다음 영상이 빠진 껍데기**로
// 떴다(일일 소식 MV·조회수 돌파도 playlist=null로 같은 상태). ctx도 안 넘겨 이전 세션 주인이 남았다.
//
// 무엇을 확인하는가(DB 없이 — 가짜 행으로 제품 함수를 그대로 부른다):
//  ① 검색 결과 영상 클릭 → 현재 항목에 제목이 있고, 같은 결과의 영상 전부가 재생목록, 저장 버튼 노출, ctx=그 영상 그룹
//  ② URL만 넘긴 호출(playlist=null) → 현재 항목이 null이 아니다(저장 버튼 노출), 새 세션 ctx는 이전 값이 안 남는다
//
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/lb-every-entry.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8975;
const CDP_PORT = 9375;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-lbe-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[lb-every-entry] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await sleep(6000);
    const ready = await ev(cdp, `(typeof openLightbox==='function'&&typeof _makeSearchItem==='function'&&typeof _srVidHit==='function')`);
    if (!ready) { bad('앱 미준비'); throw new Error('미준비'); }
    ok('앱 로드');
    const state = `JSON.stringify({open:document.getElementById('yt-lightbox').classList.contains('open'),
      cur:(_lbPlaylist&&_lbIdx>=0)?_lbPlaylist[_lbIdx]:null,n:_lbPlaylist?_lbPlaylist.length:0,ctx:_lbCtx,
      scrap:document.getElementById('yt-lb-scrap').style.display,title:document.getElementById('yt-lb-title-text').textContent})`;

    // ① 검색 결과 클릭 — 실제 결과 그릇(#search-results)에 제품 함수로 항목 3개를 만들고 두 번째를 누른다
    const rows = [
      { id: 'aaaaaaaaaa1', title: '테스트 영상 1', group_ko: '에스파', members: ['카리나'], with_members: [], is_short: false, view_count: 10, thumb: '', published_at: '2025-01-01' },
      { id: 'aaaaaaaaaa2', title: '테스트 영상 2', group_ko: '아이브', members: [], with_members: [], is_short: false, view_count: 20, thumb: '', published_at: '2025-01-02' },
      { id: 'aaaaaaaaaa3', title: '테스트 영상 3', group_ko: '에스파', members: [], with_members: [], is_short: true, view_count: 30, thumb: '', published_at: '2025-01-03' },
    ];
    await ev(cdp, `(function(){_lbCtx={groupKo:'이전세션그룹'};const res=document.getElementById('search-results');res.innerHTML='';res.style.display='block';
      ${JSON.stringify(rows)}.forEach(v=>res.appendChild(_makeSearchItem(_srVidHit(v),res,false,false)));
      res.querySelectorAll('.sr-vid')[1].click();return 1;})()`);
    await sleep(800);
    let s = JSON.parse(await ev(cdp, state));
    if (!s.open) bad('[검색] 라이트박스가 안 열림');
    else if (!s.cur || s.cur.t !== '테스트 영상 2') bad(`[검색] 현재 항목에 제목이 없음 — 껍데기 라이트박스(cur=${JSON.stringify(s.cur)})`);
    else ok('[검색] 현재 항목 제목 있음');
    if (s.n === 3) ok('[검색] 같은 결과 영상 3개가 재생목록'); else bad(`[검색] 재생목록 길이 ${s.n} (기대 3)`);
    if (s.scrap !== 'none') ok('[검색] 저장 버튼 노출'); else bad('[검색] 저장 버튼 숨김 — 현재 항목 null');
    if (s.ctx && s.ctx.groupKo === '아이브') ok('[검색] ctx=그 영상 그룹'); else bad(`[검색] ctx가 ${JSON.stringify(s.ctx)}`);
    await ev(cdp, `(closeLightbox(),1)`); await sleep(400);

    // ② URL만 넘긴 호출(일일 소식 등) — 현재 항목이 생기고, 이전 세션 ctx가 안 남는다
    await ev(cdp, `(function(){_lbCtx={groupKo:'이전세션그룹'};openLightbox('https://www.youtube.com/watch?v=bbbbbbbbbb1',false);return 1;})()`);
    await sleep(800);
    s = JSON.parse(await ev(cdp, state));
    if (s.open && s.cur && s.n === 1) ok('[URL만] 1개짜리 재생목록으로 현재 항목 생성'); else bad(`[URL만] 현재 항목 없음(n=${s.n})`);
    if (s.scrap !== 'none') ok('[URL만] 저장 버튼 노출'); else bad('[URL만] 저장 버튼 숨김');
    if (!s.ctx || s.ctx.groupKo !== '이전세션그룹') ok('[URL만] 이전 세션 ctx 안 남음'); else bad('[URL만] 이전 세션 ctx가 남음');
  } catch (e) {
    bad('예외: ' + e.message);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
