// 앨범·곡·영상 연결 테스트 (2026-10-20 사용자 — "앨범, 곡, 영상을 연결하는 거대 풀")
//  1단계: 앨범 창에서 곡 누르면 곡 오버레이 대신 옆(폰은 아래) 영상 패널이 그 곡 영상으로 · 다시 누르거나 ‹ = 앨범 전체 · 닫으면 부품 원위치
//  PC 1280·폰 390 둘 다. KPU_SHOT=폴더 지정 시 캡처 저장
// ⚠️ 브라우저는 이 스크립트가 spawn한 PID만 종료. 브라우저 없으면 스킵. 실행: node tests/album-song-hub.test.js

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const PORT = 8988, CDP_PORT = 9388;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'kpu-ash-'));
  const proc = spawn(BROWSER_PATH, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1280,800', 'about:blank'], { stdio: 'ignore' });
  console.log(`[album-song-hub] 헤드리스 PID=${proc.pid} (전용 프로필, 이 PID만 kill)`);
  try {
    await waitForCdp();
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const cdp = await connectCdp(webSocketDebuggerUrl);
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
    const SHOT = process.env.KPU_SHOT || '';
    const shot = async name => { if (!SHOT) return; const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOT, name + '.png'), Buffer.from(r.data, 'base64')); };
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` }); await sleep(2500);
    await ev(cdp, `(localStorage.setItem('kpu_onboard_done','1'),1)`); // 첫 방문 안내가 화면을 가리지 않게
    const VIEWS = [['pc', 1280, 800, false], ['mob', 390, 844, true]];
    for (const [tag, w, h, mobile] of VIEWS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
      await sleep(8000);
      if (!(await ev(cdp, `typeof showGC==='function'&&ARTISTS.length>0`))) { bad(`[${tag}] 앱 미준비`); continue; }
      // 아이브 카드 → 수록곡 있는 앨범(타이틀곡 있는 것) 열기
      await ev(cdp, `(showGC('아이브',innerWidth/2,innerHeight*0.4),1)`); await sleep(2500);
      const alb = await ev(cdp, `(async()=>{await _ensureGroupDisco('아이브');const L=GROUPS['아이브'].discography||[];const i=L.findIndex(a=>(a.tracks||[]).length>=3&&(a.tracks||[]).some(t=>t.isTitle));if(i<0)return null;_gcDiscogList=L;_openGcDiscogDetail(L[i],i);return L[i].title;})()`);
      if (!alb) { bad(`[${tag}] 테스트용 앨범 없음`); continue; }
      await sleep(3500);
      const st = () => ev(cdp, `(()=>{const p=document.getElementById('gc-discog-video-panel');const sv=document.getElementById('gc-discog-song-view');
        return{panel:!!p&&!p.hidden&&p.getBoundingClientRect().height>0,song:p.classList.contains('is-song'),
          overlay:document.getElementById('gc-track-videos-overlay').classList.contains('open'),
          songItems:sv.querySelectorAll('.tvf-item').length,albItems:document.querySelectorAll('#gc-discog-video-list .adv-item').length,
          albVis:!document.getElementById('gc-discog-video-list').hidden,
          active:[...document.querySelectorAll('#gc-discog-detail-tracks .gc-discog-track.is-active')].map(r=>r.dataset.title),
          lbl:document.getElementById('gc-discog-video-lbl').textContent,
          detail:document.getElementById('gc-discog-detail').classList.contains('open')};})()`);
      let s = await st();
      if (s.panel && s.albItems > 0 && !s.song) ok(`[${tag}] ① 앨범 열면 앨범 영상 패널 (${alb}, ${s.albItems}개)`); else bad(`[${tag}] ① ${JSON.stringify(s)}`);
      await shot(`${tag}-1-album`);
      // 타이틀곡 클릭
      const tt = await ev(cdp, `(()=>{const r=document.querySelector('#gc-discog-detail-tracks .gc-discog-track.is-title')||document.querySelector('#gc-discog-detail-tracks .gc-discog-track');r.click();return r.dataset.title;})()`);
      await sleep(4000); s = await st();
      if (!s.overlay && s.detail && s.song && s.songItems > 0 && !s.albVis && s.active.length === 1 && s.active[0] === tt && s.lbl === tt)
        ok(`[${tag}] ② 곡 누르면 새 창 없이 옆 패널이 그 곡 영상으로 (${tt}, ${s.songItems}개)`);
      else bad(`[${tag}] ② ${JSON.stringify(s)}`);
      if (mobile) {
        const vis = await ev(cdp, `(()=>{const r=document.getElementById('gc-discog-video-panel').getBoundingClientRect();return r.top<innerHeight*0.6;})()`);
        if (vis) ok(`[${tag}] ②-1 폰: 영상 칸으로 스크롤됨`); else bad(`[${tag}] ②-1 폰: 영상 칸이 화면 아래에 남음`);
      }
      await shot(`${tag}-2-song`);
      // ②-2 같은 앨범을 다시 그려도(음방 1위 뱃지 늦게 도착 시 실제로 이렇게 다시 그린다) 곡 선택 유지
      await ev(cdp, `(_openGcDiscogDetail(_gcDiscogList[_gcDiscogIdx],_gcDiscogIdx),1)`); await sleep(1500); s = await st();
      if (s.song && s.songItems > 0 && s.active[0] === tt) ok(`[${tag}] ②-2 앨범 다시 그려도 곡 선택 유지`); else bad(`[${tag}] ②-2 ${JSON.stringify(s)}`);
      // 영상 누르면 라이트박스, 앨범 창 유지
      await ev(cdp, `(document.querySelector('#gc-discog-song-view .tvf-item').click(),1)`); await sleep(1800);
      const lb = await ev(cdp, `document.getElementById('yt-lightbox').classList.contains('open')`);
      await ev(cdp, `(closeLightbox(),1)`); await sleep(1000); s = await st();
      if (lb && s.detail && s.song) ok(`[${tag}] ③ 곡 영상 재생 → 닫으면 앨범 창·곡 보기 그대로`); else bad(`[${tag}] ③ lb=${lb} ${JSON.stringify(s)}`);
      // 같은 곡 다시 누름 = 앨범 전체
      await ev(cdp, `(document.querySelector('#gc-discog-detail-tracks .gc-discog-track.is-active').click(),1)`); await sleep(800); s = await st();
      if (!s.song && s.albVis && s.albItems > 0 && !s.active.length && s.lbl === 'Videos') ok(`[${tag}] ④ 같은 곡 다시 누르면 앨범 전체 영상`); else bad(`[${tag}] ④ ${JSON.stringify(s)}`);
      // ‹ 버튼
      await ev(cdp, `(document.querySelectorAll('#gc-discog-detail-tracks .gc-discog-track')[1].click(),1)`); await sleep(3000);
      await ev(cdp, `(document.getElementById('gc-discog-song-back').click(),1)`); await sleep(800); s = await st();
      if (!s.song && s.albVis) ok(`[${tag}] ⑤ ‹ 누르면 앨범 전체 영상`); else bad(`[${tag}] ⑤ ${JSON.stringify(s)}`);
      // 곡 고른 채로 닫기 → 부품이 곡 오버레이로 돌아가 단독 곡 오버레이가 정상
      await ev(cdp, `(document.querySelectorAll('#gc-discog-detail-tracks .gc-discog-track')[0].click(),1)`); await sleep(2500);
      await ev(cdp, `(_closeGcDiscogDetail(),1)`); await sleep(500);
      const back = await ev(cdp, `['gc-track-videos-credits','gc-track-videos-tabs','gc-track-videos-actions','gc-track-videos-list'].every(id=>document.getElementById(id).parentElement.id==='gc-track-videos-sheet')`);
      await ev(cdp, `(_filterGcVideosByTrack(${JSON.stringify(tt)}),1)`); await sleep(4000);
      const ov = await ev(cdp, `(()=>{const o=document.getElementById('gc-track-videos-overlay');return o.classList.contains('open')&&o.querySelectorAll('.tvf-item').length>0;})()`);
      if (back && ov) ok(`[${tag}] ⑥ 앨범 창 닫으면 곡 목록 부품 원위치·곡 오버레이 단독 정상`); else bad(`[${tag}] ⑥ back=${back} ov=${ov}`);
      await ev(cdp, `(document.getElementById('gc-track-videos-overlay').classList.remove('open'),1)`);
      // ⑦ 2단계: 검색에서 곡 누르면 그 곡이 든 앨범 창이 곡 선택된 채로
      await ev(cdp, `(closeCards(),1)`); await sleep(1200);
      if (process.env.KPU_DEBUG) await ev(cdp, `(()=>{window.__log=[];["_openGcDiscogDetail","_albTrackClick","_closeGcDiscogDetail","_openSongHub","showGC","_openSongVideos"].forEach(n=>{const o=window[n];window[n]=function(...a){__log.push(n+" "+Math.round(performance.now())+" "+String(a[0]&&a[0].title||a[0]).slice(0,20));return o.apply(this,a);};});return 1})()`);
      await ev(cdp, `(document.getElementById(${JSON.stringify(mobile ? 'tab-search' : 'dh-search-btn')}).click(),1)`); await sleep(1200);
      const inp = await ev(cdp, `(()=>{const i=[document.getElementById('msheet-input'),document.getElementById('search-input')].find(x=>x&&x.offsetParent);if(!i)return null;i.value='LOVE DIVE';i.dispatchEvent(new Event('input',{bubbles:true}));return i.id;})()`);
      await sleep(2500);
      const picked = await ev(cdp, `(()=>{const e=[...document.querySelectorAll('.sr-item[data-type=song]')].find(e=>e.offsetParent&&/LOVE DIVE/i.test(e.textContent)&&/IVE|아이브/.test(e.textContent));if(!e)return null;e.click();return e.textContent;})()`);
      if (!picked) bad(`[${tag}] ⑦ 검색 곡 결과 없음 (입력창 ${inp})`);
      else {
        await sleep(9000); s = await st();
        const at = await ev(cdp, `document.getElementById('gc-discog-detail-title').textContent`);
        const firstMv = await ev(cdp, '_songVid&&_songVid.rows[0]&&_songVid.rows[0].category==="mv"');
        if (s.detail && s.song && !s.overlay && /LOVE DIVE/i.test(s.lbl) && s.active.length === 1 && s.songItems > 0 && firstMv)
          ok(`[${tag}] ⑦ 검색 곡 → 앨범 창(${at}) + 곡 선택(${s.songItems}개, 첫 영상 뮤비)`);
        else bad(`[${tag}] ⑦ ${JSON.stringify(s)} 앨범=${at} 첫뮤비=${firstMv}`);
        if (process.env.KPU_DEBUG) console.log(await ev(cdp, `JSON.stringify(window.__log)`));
        await shot(`${tag}-3-search-song`);
      }
      // ⑧~⑫ 3단계: 재생 화면 곡 카드 → 재생 화면에 붙은 앨범 창
      await ev(cdp, `(_closeGcDiscogDetail(),closeCards(),1)`); await sleep(1200);
      await ev(cdp, `(showGC('아이브',innerWidth/2,innerHeight*0.4),1)`); await sleep(2500);
      const vt = await ev(cdp, `(async()=>{const r=await sb.from(_YT_TABLE).select('id,title,group_ko,members,with_members,song_keys,category').eq('group_ko','아이브').eq('category','mv').contains('song_keys',['아이브:lovedive']).limit(1);const v=r.data&&r.data[0];if(!v)return null;openLightbox('https://www.youtube.com/watch?v='+v.id,false,[{t:v.title,u:'https://www.youtube.com/watch?v='+v.id,..._rowTags(v)}],0,{groupKo:'아이브'});return v.title;})()`);
      await sleep(4000);
      const lbs = () => ev(cdp, `(()=>{const d=document.getElementById('gc-discog-detail'),lb=document.getElementById('yt-lightbox'),b=document.getElementById('yt-lb-song'),sh=document.getElementById('gc-discog-detail-sheet');
        return{lb:lb.classList.contains('open'),card:!b.hidden&&b.getBoundingClientRect().height>0,cardTxt:b.textContent,det:d.classList.contains('open'),dock:d.classList.contains('lb-dock'),
          lbl:document.getElementById('gc-discog-video-lbl').textContent,items:document.querySelectorAll('#gc-discog-song-view .tvf-item').length,
          zD:+getComputedStyle(d).zIndex,zL:+getComputedStyle(lb).zIndex,vid:String(_lbActiveVid||''),st:sh.scrollTop};})()`);
      let l = await lbs();
      if (vt && l.lb && l.card && /LOVE DIVE/.test(l.cardTxt)) ok(`[${tag}] ⑧ 재생 화면에 곡 카드 (${l.cardTxt.trim()})`); else bad(`[${tag}] ⑧ ${vt} ${JSON.stringify(l)}`);
      // ⑧-1 "이 영상에 나온 사람" 그룹 사진 = 카드와 같은 사진(2026-10-20 — 예전엔 그룹은 색 원만)
      const pp = await ev(cdp, `(async()=>{const b=[...document.querySelectorAll('#yt-lb-people .lb-person.is-group')][0];const want=await _groupAvUrl('아이브');const img=b&&b.querySelector('img');return{want:!!want,got:img?img.src:null,same:!!(img&&want&&(img.src===want||img.src===_avBackup.get(want)))};})()`);
      if (pp.same) ok(`[${tag}] ⑧-1 출연자 그룹 사진 = 카드 사진`); else bad(`[${tag}] ⑧-1 ${JSON.stringify(pp)}`);
      await ev(cdp, `(document.getElementById('yt-lb-song').click(),1)`); await sleep(4500); l = await lbs();
      if (l.lb && l.det && l.dock && /LOVE DIVE/.test(l.lbl) && l.items > 0 && l.zD > l.zL && (!mobile || l.st > 0))
        ok(`[${tag}] ⑨ 곡 카드 → 재생 화면에 붙은 앨범 창, 곡 선택(${l.items}개)${mobile ? ', 영상 칸으로 스크롤' : ''}`);
      else bad(`[${tag}] ⑨ ${JSON.stringify(l)}`);
      await shot(`${tag}-4-lb-dock`);
      const v0 = l.vid;
      await ev(cdp, `(document.querySelectorAll('#gc-discog-song-view .tvf-item')[1].click(),1)`); await sleep(2500); l = await lbs();
      if (l.lb && l.det && l.dock && l.vid !== v0 && l.zD > l.zL) ok(`[${tag}] ⑩ 앨범 창에서 다른 영상 → 재생 화면에서 바로, 앨범 창은 위에 그대로`); else bad(`[${tag}] ⑩ v0=${v0} ${JSON.stringify(l)}`);
      await ev(cdp, `(_closeTopOverlay(),1)`); await sleep(900); l = await lbs();
      if (l.lb && !l.det) ok(`[${tag}] ⑪ ESC = 앨범 창만, 영상은 그대로`); else bad(`[${tag}] ⑪ ${JSON.stringify(l)}`);
      await ev(cdp, `(document.getElementById('yt-lb-song').click(),1)`); await sleep(2500);
      await ev(cdp, `(closeLightbox(),1)`); await sleep(1200); l = await lbs();
      const parts = await ev(cdp, `['gc-track-videos-list'].every(id=>document.getElementById(id).parentElement.id==='gc-track-videos-sheet')`);
      if (!l.lb && !l.det && !l.dock && parts) ok(`[${tag}] ⑫ 영상 닫으면 붙어 있던 앨범 창도 함께 닫힘`); else bad(`[${tag}] ⑫ parts=${parts} ${JSON.stringify(l)}`);
      // ⑬ 뒤로가기(폰 시스템 뒤로·브라우저 뒤로) — 한 번은 앨범 창만, 두 번째에 영상
      await ev(cdp, `(async()=>{const r=await sb.from(_YT_TABLE).select('id,title,group_ko,members,with_members,song_keys').eq('group_ko','아이브').contains('song_keys',['아이브:lovedive']).limit(1);const v=r.data[0];openLightbox('https://www.youtube.com/watch?v='+v.id,false,[{t:v.title,u:'https://www.youtube.com/watch?v='+v.id,..._rowTags(v)}],0,{groupKo:'아이브'});return 1;})()`);
      await sleep(3500); await ev(cdp, `(document.getElementById('yt-lb-song').click(),1)`); await sleep(2500);
      await ev(cdp, `(history.back(),1)`); await sleep(1200); const b1 = await lbs();
      await ev(cdp, `(history.back(),1)`); await sleep(1500); const b2 = await lbs();
      if (b1.lb && !b1.det && !b2.lb) ok(`[${tag}] ⑬ 뒤로가기 한 번 = 앨범 창만, 두 번 = 영상`); else bad(`[${tag}] ⑬ 1회=${JSON.stringify(b1)} 2회=${JSON.stringify(b2)}`);
    }
  } catch (e) { bad('예외: ' + e.message); } finally { try { proc.kill(); } catch (e) {} server.close(); }
  console.log(`
${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
  process.exit(fail ? 1 : 0);
})();
