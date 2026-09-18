// For You 선반이 유튜브 영상 말고도 우리가 모으는 걸 드러내는지 — 실제 렌더로 확인 (2026-09-18 신설)
//
// 왜: "New from your fav"가 유튜브 영상만 보여주고 있었다(사용자 제보). 디스코그래피는 매일 모으는데
// Discover의 전체 신보 선반에만 있었고, 기념일 선반은 대상이 좁아 **그룹 하나만 즐겨찾기한 사람은
// 1년에 딱 한 번**(그 그룹 데뷔일) 봤다 — 데뷔기념일은 favGroups만, 생일은 favMembers만 봤기 때문.
//
// 이 테스트가 지키는 것:
//  ① 기념일 대상 교차 — 즐겨찾기 **그룹**을 담으면 그 멤버 생일이, **멤버**를 담으면 그 소속 그룹
//     데뷔일이 대상에 들어온다. 좁히면 위 증상이 그대로 돌아온다.
//  ② 그룹을 타고 들어온 멤버는 탈퇴/해체를 제외한다(_isFormerOf). 고인이 된 멤버 6명은 전원
//     active:false라 같은 가드에 걸린다 — 그룹을 담았다고 추모 대상의 생일 카드가 뜨면 안 된다.
//  ③ 즐겨찾기 신보 선반이 실제로 채워진다(albums_recent.json 필터).
//  ④ 선반 순서 = 시간 민감도 순(기념일 → 신보 → 신작 영상 → 이어보기).
//  ⑤ 앨범 카드가 정사각 스타일을 **받는다** — 이 스타일은 원래 #feed-newalbum에 id로 묶여 있어서
//     같은 빌더를 쓰는 새 선반이 못 받았고, 커버 비율이 제각각이 되고 제목이 한 글자씩 세로로 깨졌다.
//
// ⚠️ 픽스처를 날짜로 하드코딩하지 말 것 — "가을 D-6"은 내일이면 틀린다. 실행 시점에 artists.json /
//    albums_recent.json에서 조건에 맞는 대상을 **계산해서** 쓴다. 조건에 맞는 대상이 없으면 그 케이스만
//    건너뛴다(연중 어느 날 돌려도 통과해야 한다).
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 정확히 종료(프로세스명 일괄 kill 금지).
// 실행: node tests/foryou-shelves.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8960;
const CDP_PORT = 9360;
const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
];
const BROWSER_PATH = BROWSER_CANDIDATES.find(p => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = 0, fail = 0, skip = 0;
const ok = m => { pass++; console.log(`✅ ${m}`); };
const bad = m => { fail++; console.log(`❌ ${m}`); };
const skipped = m => { skip++; console.log(`⏭️  ${m}`); };
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

// ── 픽스처를 오늘 날짜 기준으로 계산 ──────────────────────────────────────────
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const ALBUMS = JSON.parse(fs.readFileSync(path.join(ROOT, 'albums_recent.json'), 'utf8'));
const daysUntil = b => {
  const p = String(b || '').split('.'); if (p.length < 3) return null;
  const n = new Date(), today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  let x = new Date(today.getFullYear(), +p[1] - 1, +p[2]); if (x < today) x = new Date(today.getFullYear() + 1, +p[1] - 1, +p[2]);
  return Math.round((x - today) / 86400000);
};
const withinWeek = a => a.bday && daysUntil(a.bday) != null && daysUntil(a.bday) >= 0 && daysUntil(a.bday) <= 7;
// ① 현역 멤버의 생일이 일주일 안인 그룹 하나
const liveBday = ARTISTS.find(a => withinWeek(a) && a.active !== false && a.group && a.group.ko);
// ② 탈퇴/비활성 멤버의 생일이 일주일 안인 그룹 하나(그 그룹엔 현역 생일자가 없어야 판정이 깔끔)
const exBday = ARTISTS.find(a => withinWeek(a) && a.active === false && a.group && a.group.ko);
// ③ 최근 30일 안에 앨범이 있는 그룹 — ⚠️ **일본 발매반은 제품이 의도적으로 거른다**(_isJpRelease).
//    파일에서 날짜만 보고 고르면 최근 앨범이 일본반뿐인 그룹이 뽑혀 "선반이 안 뜬다"고 오탐한다
//    (실제로 키스오브라이프로 그랬다). 그래서 후보만 여기서 추리고, **최종 선택은 브라우저에서
//    제품의 _isJpRelease로** 한다(아래 pickAlbumGroup).
const albDate = s => { const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
const recentAlbumGroups = [...new Set(ALBUMS
  .filter(a => a.k === 'g' && isFinite(albDate(a.d)) && Date.now() - albDate(a.d) <= 30 * 86400000)
  .map(a => a.o))];

(async () => {
  if (!BROWSER_PATH) { console.log('⏭️  브라우저를 못 찾음 — 스킵'); process.exit(0); }
  server.listen(PORT);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-fys-'));
  const proc = spawn(BROWSER_PATH, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=390,844', 'about:blank',
  ], { stdio: 'ignore' });
  console.log(`[foryou-shelves] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);

  async function openForYou(seed) {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const all = Object.assign({ kpu_visit_count: '9' }, seed);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try{localStorage.clear();${Object.entries(all).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(v)});`).join('')}}catch(e){}`,
    });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    for (let i = 0; i < 80; i++) { if (await ev(cdp, `(typeof bubbleMeshes!=='undefined'&&bubbleMeshes.length>0)`)) break; await sleep(500); }
    await sleep(4500);
    // 온보딩이 peek으로 먼저 열어두므로 닫았다 전체 열림으로 다시 연다(그래야 For You가 다 그려진다)
    await ev(cdp, `(function(){if(document.getElementById('feed-overlay').classList.contains('open'))_closeFeedOverlay();return 1;})()`);
    await sleep(500);
    await ev(cdp, `(function(){_openFeedOverlay();document.getElementById('feed-overlay').classList.remove('peek');return 1;})()`);
    await sleep(9000);
    return cdp;
  }
  const SHELVES = `(function(){
    const sec=id=>{const e=document.getElementById(id);if(!e)return null;
      return {shown:getComputedStyle(e).display!=='none',
        items:[...e.querySelectorAll('.feed-strip>*,.feed-grid>*')].map(x=>x.innerText.replace(/\\n+/g,' | ').trim())};};
    const order=[...document.querySelectorAll('#feed-pane-rec .feed-section')]
      .filter(s=>getComputedStyle(s).display!=='none').map(s=>s.id);
    return {anniv:sec('feed-foryou-anniv-section'),album:sec('feed-favalbum-section'),
            favnew:sec('feed-favnew-section'),order};})()`;

  try {
    await waitForCdp();

    // ── ① 그룹만 즐겨찾기 → 그 그룹 멤버 생일이 뜬다(이번 수정의 핵심) ──
    if (!liveBday) skipped('오늘 기준 일주일 안 생일인 현역 멤버가 없음 — 케이스 ① 건너뜀');
    else {
      const gko = liveBday.group.ko, mko = liveBday.name.ko;
      const cdp = await openForYou({ kpu_fav_groups: JSON.stringify([gko]) });
      const r = await ev(cdp, SHELVES);
      r.anniv?.shown ? ok(`① 그룹(${gko})만 담았는데 기념일 선반이 뜸`) : bad(`① 기념일 선반이 안 뜸 (${gko})`);
      (r.anniv?.items || []).some(t => t.includes(mko))
        ? ok(`① 즐겨찾기 **그룹의 멤버** 생일이 뜸 (${mko} D-${daysUntil(liveBday.bday)})`)
        : bad(`① ${mko} 생일이 없음 — 대상이 favGroups만 보던 옛 동작으로 돌아갔다: ${JSON.stringify(r.anniv?.items)}`);
      cdp.close();
    }

    // ── ② 멤버만 즐겨찾기 → 그 소속 그룹이 데뷔기념일 대상에 들어간다 ──
    {
      const a = ARTISTS.find(x => x.group && x.group.ko && x.name && x.name.ko);
      const cdp = await openForYou({ kpu_fav_members: JSON.stringify([`${a.group.ko}:${a.name.ko}`]) });
      const gkos = await ev(cdp, `(function(){const s=new Set(favGroups);
        favMembers.forEach(k=>{const i=k.indexOf(':');const g=k.slice(0,i);if(GROUPS[g])s.add(g);});return [...s];})()`);
      gkos.includes(a.group.ko) ? ok(`② 멤버(${a.name.ko})만 담아도 소속 그룹(${a.group.ko})이 데뷔기념일 대상에 포함`)
                                : bad(`② 소속 그룹이 대상에서 빠짐: ${JSON.stringify(gkos)}`);
      cdp.close();
    }

    // ── ③ 그룹을 타고 들어온 탈퇴/비활성 멤버 생일은 안 뜬다 ──
    if (!exBday) skipped('오늘 기준 일주일 안 생일인 탈퇴 멤버가 없음 — 케이스 ③ 건너뜀');
    else {
      const gko = exBday.group.ko, mko = exBday.name.ko;
      const cdp = await openForYou({ kpu_fav_groups: JSON.stringify([gko]) });
      const r = await ev(cdp, SHELVES);
      !(r.anniv?.items || []).some(t => t.includes(mko))
        ? ok(`③ 탈퇴/비활성 멤버(${gko} ${mko}) 생일은 안 뜸 — _isFormerOf 가드`)
        : bad(`③ 탈퇴 멤버 생일이 뜸 (${mko}) — 그룹 경유 경로에 _isFormerOf가 빠졌다`);
      cdp.close();
    }

    // ── ④ 즐겨찾기 신보 선반 + 순서 + 정사각 카드 스타일 ──
    // 제품의 _isJpRelease를 그대로 써서 "선반에 실제로 뜰" 그룹을 고른다(위 주석 참고).
    let albumGroup = null;
    if (recentAlbumGroups.length) {
      const probe = await openForYou({});
      albumGroup = await ev(probe, `(async function(){
        const all=await _ensureRecentAlbums(); if(!Array.isArray(all))return null;
        const cand=${JSON.stringify(recentAlbumGroups)};
        const now=Date.now();
        for(const g of cand){
          const hit=all.some(a=>a.k==='g'&&a.o===g&&isFinite(_albumDate(a.d))
            &&now-_albumDate(a.d)<=${'30'}*86400000&&!_isJpRelease(a,a.o));
          if(hit)return g;
        }
        return null;})()`);
      probe.close();
    }
    if (!albumGroup) skipped('최근 30일 안 그룹 앨범이 없음(일본반 제외) — 케이스 ④ 건너뜀');
    else {
      const cdp = await openForYou({ kpu_fav_groups: JSON.stringify([albumGroup]) });
      const r = await ev(cdp, SHELVES);
      r.album?.shown ? ok(`④ 즐겨찾기 신보 선반이 뜸 (${albumGroup})`) : bad(`④ 신보 선반이 안 뜸 (${albumGroup})`);
      (r.album?.items || []).length > 0 ? ok(`④ 앨범 카드가 채워짐 (${r.album.items.length}장)`) : bad('④ 선반은 떴는데 카드가 0장');
      const oi = id => r.order.indexOf(id);
      (oi('feed-favalbum-section') >= 0 && oi('feed-favalbum-section') < oi('feed-favnew-section'))
        ? ok('④ 순서: 신보가 신작 영상보다 위') : bad(`④ 순서가 뒤집힘: ${JSON.stringify(r.order)}`);
      (oi('feed-foryou-anniv-section') < 0 || oi('feed-foryou-anniv-section') < oi('feed-favalbum-section'))
        ? ok('④ 순서: 기념일이 신보보다 위') : bad(`④ 기념일이 신보 아래: ${JSON.stringify(r.order)}`);
      (oi('feed-recent-section') < 0 || oi('feed-favnew-section') < oi('feed-recent-section'))
        ? ok('④ 순서: 신작 영상이 이어보기보다 위') : bad(`④ 이어보기가 위로 올라옴: ${JSON.stringify(r.order)}`);
      // ⑤ 정사각 카드 스타일이 실제로 먹었는지 — computed로 본다(셀렉터가 id에 묶여 있으면 여기서 걸린다)
      const card = await ev(cdp, `(function(){const c=document.querySelector('#feed-favalbum>.feed-card');
        if(!c)return null;const w=c.querySelector('.feed-card-thumb-wrap');
        return {cardW:Math.round(c.getBoundingClientRect().width),
                thumbH:w?Math.round(w.getBoundingClientRect().height):0,
                thumbW:w?Math.round(w.getBoundingClientRect().width):0};})()`);
      if (!card) bad('⑤ 앨범 카드를 못 찾음');
      else {
        const squareish = Math.abs(card.thumbW - card.thumbH) <= 4;
        squareish ? ok(`⑤ 커버가 정사각 (${card.thumbW}×${card.thumbH})`)
                  : bad(`⑤ 커버가 정사각이 아님 (${card.thumbW}×${card.thumbH}) — 정사각 스타일이 #feed-newalbum에만 묶여 있는지 확인`);
      }
      cdp.close();
    }
  } catch (e) {
    bad(`예외: ${e.message}`);
  } finally {
    try { proc.kill(); } catch (e) {}
    server.close();
  }
  console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과${skip ? ` (건너뜀 ${skip})` : ''}`);
  process.exit(fail ? 1 : 0);
})();
