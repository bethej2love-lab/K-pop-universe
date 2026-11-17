// 시상식 소식 E2E — 실제 앱·실제 DB(읽기만): 소식 줄 → 수상 목록 펼침 → 수상자 카드 → 무대 영상 화면
// 브라우저+DB가 필요해서 CI의 'Node 전용 테스트' 단계(data-and-tests.yml)에선 못 돈다. 그 단계의 skip(browser) 목록은 워크플로 파일이라 이 토큰으로 못 고쳐서,
// 여기서 스스로 건너뛴다. 로컬에서는 `node tests/award-news-e2e.test.js`로 실행(크롬 필요, 이번 주 시상식이 있을 때만 의미 있음: 마지막 날부터 9일).
if (process.env.GITHUB_ACTIONS) { console.log('skip(browser) — CI Node 전용 단계에서는 건너뜀'); process.exit(0); }
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { spawn, execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const { waitForBrowserCdp } = require(ROOT + '/tools/browser_test_runtime.cjs');
const PORT = 8972, CDP = 9372, CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
});
function conn(url) { return new Promise((res, rej) => { const ws = new WebSocket(url); let id = 0; const w = new Map();
  ws.addEventListener('open', () => res({ send: (m, p) => new Promise((a, b) => { const i = ++id; w.set(i, { a, b }); ws.send(JSON.stringify({ id: i, method: m, params: p })); }), close: () => ws.close() }));
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { const { a, b } = w.get(m.id); w.delete(m.id); m.error ? b(new Error(m.error.message)) : a(m.result); } }); ws.addEventListener('error', rej); }); }
async function ev(c, x) { const r = await c.send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; }
let pass = 0, fail = 0; const ok = (c, m, extra) => { if (c) { pass++; console.log('✅ ' + m); } else { fail++; console.log('❌ ' + m + (extra ? ' → ' + extra : '')); } };
(async () => {
  server.listen(PORT);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-award-'));
  const proc = spawn(CHROME, ['--headless=new', '--no-sandbox', '--remote-debugging-port=' + CDP, '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'], { stdio: 'ignore' });
  try {
    await waitForBrowserCdp(proc, CDP);
    const tab = await (await fetch('http://127.0.0.1:' + CDP + '/json/new?about:blank', { method: 'PUT' })).json(), c = await conn(tab.webSocketDebuggerUrl);
    await c.send('Page.enable'); await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 800, deviceScaleFactor: 2, mobile: true });
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__errs=[];addEventListener('error',e=>__errs.push(e.message));addEventListener('unhandledrejection',e=>__errs.push(String(e.reason&&e.reason.message||e.reason)));" });
    await c.send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html' });
    for (let i = 0; i < 120; i++) { await sleep(500); try { if (await ev(c, "typeof _collectAwardNews==='function'&&typeof ARTISTS!=='undefined'&&ARTISTS.length>0&&!!sb&&!!GROUPS['에스파']")) break; } catch (e) {} }
    // 1) 데이터: 이번 주 시상식 항목
    const news = JSON.parse(await ev(c, "(async()=>JSON.stringify((await _collectAwardNews()).map(r=>({type:r.type,title:r.title,sub:r.sub,score:r.score,id:r.award.id}))))()"));
    ok(news.length >= 1 && news.some(n => n.id === 'mma'), '이번 주 시상식에 MMA 2026이 잡힘', JSON.stringify(news));
    console.log('   ', JSON.stringify(news[0] || {}));
    // 2) 소식 줄 렌더 → 줄·버튼
    await ev(c, "(async()=>{const list=document.getElementById('feed-dailynews');list.innerHTML='';_renderNewsList(list,[],await _collectAwardNews());})()");
    await sleep(300);
    const row = JSON.parse(await ev(c, "JSON.stringify({rows:document.querySelectorAll('#feed-dailynews .feed-news-row').length,badge:(document.querySelector('#feed-dailynews .feed-news-badge')||{}).textContent,title:(document.querySelector('#feed-dailynews .feed-news-title')||{}).textContent,btns:[...document.querySelectorAll('#feed-dailynews .feed-news-btns button')].map(b=>b.textContent)})"));
    ok(row.rows >= 1 && row.badge === '🏆 시상식' && /멜론뮤직어워드 2026/.test(row.title || '') && row.btns.length >= 2 && row.btns.length === row.rows * 2, '소식 줄: 🏆 시상식 · 멜론뮤직어워드 2026 · 버튼 2개', JSON.stringify(row));
    // 2-b) 대표 영상 썸네일 — 대상 받은 팀의 무대 영상(수상소감 등 제외), 줄에 썸네일이 그려진다 (사용자 11-17)
    const rep = JSON.parse(await ev(c, "(async()=>{const e=(await _awardEvents()).find(x=>x.id==='mma'&&x.edition==='2026');const v=await _awardRepVideo(e);const aw=await _collectAwardNews();return JSON.stringify({top:[...new Set(e.top.flatMap(x=>x.names))],v:v&&{id:v.id,title:v.title,g:v.group_ko,vc:v.view_count,cat:v.category},thumb:(aw.find(x=>x.award.id==='mma')||{}).thumb||null,img:document.querySelectorAll('#feed-dailynews .feed-news-row .feed-news-tw img').length})})()"));
    ok(rep.v && rep.top.includes(rep.v.g) && rep.v.cat === 'live' && !/수상 ?소감|인터뷰|비하인드/.test(rep.v.title) && !!rep.thumb, '대표 영상 = 대상 받은 팀의 무대 영상(수상소감·인터뷰 제외)·썸네일 있음', JSON.stringify(rep.v));
    console.log('    대표:', rep.v && (rep.v.g + ' | ' + rep.v.title.slice(0, 60) + ' | ' + rep.v.vc));
    await ev(c, "(async()=>{const list=document.getElementById('feed-dailynews');list.innerHTML='';_renderNewsList(list,[],await _collectAwardNews());})()");
    await sleep(400);
    ok(await ev(c, "document.querySelectorAll('#feed-dailynews .feed-news-row .feed-news-tw img').length>=1"), '시상식 줄에 대표 영상 썸네일이 그려진다');
    // 2-c) MV 소식에 시상식·수상소감·제작 뒷이야기가 안 섞인다
    const mv = JSON.parse(await ev(c, "(async()=>JSON.stringify((await _collectWeekNews()).filter(x=>x.type==='mv'||x.type==='teaser').map(x=>String(x.title))))()"));
    const bad = mv.filter(t => /MMA|MAMA|KGMA|수상 ?소감|올해의|어워드|시상식|Production Meeting|MAKING|Behind|Reaction/i.test(t));
    ok(bad.length === 0, 'MV·티저 소식에 시상식·수상소감·제작 뒷이야기 영상이 없다(' + mv.length + '개 중)', bad.join(' | '));
    // 3) 수상 목록 펼침
    await ev(c, "document.querySelector('#feed-dailynews .feed-news-btns button').click()");
    for (let i = 0; i < 20; i++) { await sleep(300); if (await ev(c, "document.querySelectorAll('.feed-award-detail .fa-row').length>0")) break; }
    const det = JSON.parse(await ev(c, "JSON.stringify({hidden:document.querySelector('.feed-award-detail').hidden,rows:document.querySelectorAll('.feed-award-detail .fa-row').length,tiers:[...document.querySelectorAll('.feed-award-detail .fa-tier')].map(x=>x.textContent),links:document.querySelectorAll('.feed-award-detail .fa-link').length,first:(document.querySelector('.feed-award-detail .fa-row')||{}).textContent})"));
    ok(!det.hidden && det.rows >= 20 && det.tiers[0] === '대상' && det.links >= 5, '수상 목록 펼침: 대상 먼저·29개 부문·수상자 링크', JSON.stringify(det));
    console.log('    첫 줄:', det.first, '| 구분:', det.tiers.join('/'));
    // 5) 무대 영상 화면
    await ev(c, "(async()=>{const e=(await _awardEvents()).find(x=>x.id==='mma'&&x.edition==='2026');_openAwardEv(e);})()");
    let vid = null;
    for (let i = 0; i < 30; i++) { await sleep(500); vid = JSON.parse(await ev(c, "JSON.stringify({open:!!document.getElementById('feed-list-overlay')?.classList.contains('open'),title:document.getElementById('feed-list-hd-title')?.textContent,sub:document.getElementById('feed-list-sub')?.textContent,cards:document.querySelectorAll('#feed-list-grid .gc-ch-item, #feed-list-grid .feed-card').length,secs:[...document.querySelectorAll('#feed-list-grid .feed-list-sec-title, #feed-list-grid [class*=sec] h3, #feed-list-grid .gc-section-title')].slice(0,5).map(x=>x.textContent)})")); if (vid.cards > 0) break; }
    ok(vid.open && /멜론뮤직어워드 2026/.test(vid.title || '') && vid.cards >= 10, '무대 영상 화면: 열림·제목·영상 10개 이상', JSON.stringify(vid));
    console.log('    부제:', vid.sub, '| 영상 카드', vid.cards);
    // 4) 수상자 클릭 → 그룹 카드 (대상 첫 링크)
    await ev(c, "document.querySelector('.feed-award-detail .fa-link').click()");
    await sleep(1500);
    const card = await ev(c, "typeof _openGCko!=='undefined'?_openGCko:null");
    ok(!!card, '수상자(칩) 클릭 → 그룹 카드가 열림', String(card));
    // 6) For You 내 최애 소식 — 즐겨찾기(에스파·코르티스 성현)가 받은 상이 줄 부제에 먼저 나온다
    await ev(c, "favGroups.add('에스파');favMembers.add('코르티스:성현');_buildFeedFavNews()");
    await sleep(1500);
    const fav = JSON.parse(await ev(c, "JSON.stringify({show:document.getElementById('feed-favnews-section').style.display!=='none',rows:document.querySelectorAll('#feed-favnews .feed-news-row').length,sub:(document.querySelector('#feed-favnews .feed-news-sub')||{}).textContent,badge:(document.querySelector('#feed-favnews .feed-news-badge')||{}).textContent})"));
    ok(fav.show && fav.rows >= 1 && fav.badge === '🏆 시상식' && /⭐/.test(fav.sub || '') && /에스파/.test(fav.sub || ''), 'For You 내 최애 소식: 시상식 줄 + ⭐ 내 최애 수상 부제', JSON.stringify(fav));
    console.log('    부제:', fav.sub);
    const errs = JSON.parse(await ev(c, 'JSON.stringify(__errs)'));
    ok(errs.length === 0, '페이지 오류 0건', errs.slice(0, 3).join(' | '));
    // 스크린샷(눈으로 확인용)
    const shot = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(os.tmpdir(), 'award_e2e.png'), Buffer.from(shot.data, 'base64'));
    c.close();
  } catch (e) { fail++; console.log('❌ 예외: ' + e.message.slice(0, 300)); }
  finally { try { execSync('taskkill /PID ' + proc.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} server.close(); console.log(pass + ' 통과 / ' + fail + ' 실패'); process.exit(fail ? 1 : 0); }
})();
