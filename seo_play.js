// 정적(검색 착지) 페이지 영상 페이지 안 재생(2026-11-04).
// 왜: 검색·챗지피티로 들어온 사람이 직캠 카드를 누르면 유튜브 새 탭으로 나가 GA에 "1분 내 이탈"로 잡혔다(페이지당 유튜브 링크 ~27개, 남는 길은 앱 버튼 하나).
// 이제 유튜브 링크를 누르면 이 페이지 위에서 공식 임베드로 재생하고, 아래에 같은 페이지의 다음 영상 6개 + 앱으로 가는 버튼을 둔다.
// 링크 자체(href)는 그대로라 검색엔진·자바스크립트 꺼진 환경·새 탭 열기(ctrl/⌘/가운데 클릭)는 예전처럼 유튜브로 간다.
// 이 파일은 모든 정적 페이지가 /seo_play.js로 불러온다 — 고칠 때 4만 장을 다시 만들 필요가 없다.
(function(){
  'use strict';
  if(window.__kpuPlay)return;window.__kpuPlay=1;
  var EN=/^\/en\//.test(location.pathname)||document.documentElement.lang==='en';
  var T=EN?{close:'Close',next:'Up next',app:'See more in the app',nxK:'Explore',nxS:'Profile · fancams · stages'}:{close:'닫기',next:'이어서 보기',app:'앱에서 더 보기',nxK:'더 둘러보기',nxS:'프로필 · 직캠 · 무대'};
  var RE=/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  function vidOf(a){var m=RE.exec(a&&a.getAttribute('href')||'');return m?m[1]:null;}
  function isShort(a){return /\/shorts\//.test(a.getAttribute('href')||'');}
  function ga(n,p){try{if(typeof gtag==='function')gtag('event',n,p||{});}catch(e){}
    var m={seo_play:'play',seo_play_cta:'to_app',seo_play_youtube:'yt'}[n];if(m)log(m,p&&p.video_id);}
  // ── 우리 쪽 전환 기록(2026-11-10) — GA는 우리가 못 읽어서 정적 페이지 → 앱 흐름을 Supabase seo_events에도 남긴다.
  // land(페이지 열림)·play(페이지 안 재생)·cta·to_app(앱으로 가는 클릭)·yt(유튜브로 나감). 자동 접속(헤드리스·봇)은 안 센다(GA 차단과 같은 기준).
  // did는 이 기기 무작위 ID — 사람 수를 세려는 것뿐, 앱 계정과 잇지 않는다. 실패해도 페이지 동작엔 영향 없음.
  var BOT=(function(){try{return !!navigator.webdriver||/headless|bot|crawl|spider|lighthouse|playwright|puppeteer|yeti|daumoa|slurp|bytespider|gptbot|chatgpt-user|perplexity|claude|facebookexternalhit|preview|inspectiontool|mediapartners/i.test(navigator.userAgent||'');}catch(e){return true;}})();
  var DID=(function(){try{var d=localStorage.getItem('kpu_seo_did');if(!d){d=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('kpu_seo_did',d);}return d;}catch(e){return '';}})();
  var SRC=(function(){try{var u=new URLSearchParams(location.search).get('utm_source');if(u)return u;var h=document.referrer?new URL(document.referrer).hostname.replace(/^www\./,''):'';return h&&!/kpop-universe\.kr$/.test(h)?h:'';}catch(e){return '';}})();
  var PTYPE=(function(){var p=location.pathname.split('/').filter(Boolean);if(p[0]==='en')p.shift();if(p[0]!=='g')return p[0]?'other':'group_list';if(p.indexOf('fancams')>0)return 'fancams';if(p.indexOf('s')>0)return 'song';if(p.indexOf('a')>0)return 'album';if(p.indexOf('credits')>0)return 'credits';return p.length>=3?'member':'group';})();
  // 이 페이지의 그룹(앱 버튼 #g=) — 그룹별 '이번 주 n명'을 세려고 기록에 같이 남긴다(2026-11-12)
  var GRP=(function(){try{var a=document.querySelector('a.cta[href*="#g="]');return a?(new URLSearchParams(new URL(a.href).hash.slice(1)).get('g')||''):'';}catch(e){return '';}})();
  function log(ev,vid){if(BOT)return;try{fetch('https://dukgguehegnembimqvkm.supabase.co/rest/v1/rpc/log_seo_event',{method:'POST',keepalive:true,
    headers:{'Content-Type':'application/json',apikey:'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0',Authorization:'Bearer sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'},
    body:JSON.stringify({p_ev:ev,p_type:PTYPE,p_path:decodeURIComponent(location.pathname).slice(0,200),p_src:SRC,p_did:DID,p_ua:ev==='land'?String(navigator.userAgent||'').slice(0,160):null,p_vid:vid||null,p_grp:GRP||null})}).catch(function(){});}catch(e){}}
  log('land');
  // 사람 신호(2026-11-12): 봇 표시 없이 JS를 돌리는 크롤러가 land만 잔뜩 남겨서(하루 ~950기기) — 첫 스크롤·터치·키 입력 때 한 번 'eng'.
  // 집계(seo_human_land)는 출처가 있거나 이런 행동이 있는 기기만 센다.
  (function(){var done=false;function on(){if(done)return;done=true;['scroll','touchstart','pointerdown','keydown'].forEach(function(t){removeEventListener(t,on,true);});log('eng');}
    ['scroll','touchstart','pointerdown','keydown'].forEach(function(t){addEventListener(t,on,{capture:true,passive:true});});})();
  // 앱으로 가는 링크(사이트 첫 화면·#해시 딥링크) 클릭 — 상단 CTA 버튼 포함
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a||(a.closest&&a.closest('.kpu-pl')))return;
    try{var u=new URL(a.href,location.href);if(/kpop-universe\.kr$/.test(u.hostname)&&(u.pathname==='/'||u.pathname==='/index.html'))log(a.classList.contains('cta')?'cta':'to_app');}catch(_){}},true);
  var entity=((document.querySelector('h1')||{}).textContent||'').trim();
  var css='.kpu-pl{position:fixed;inset:0;z-index:2147483000;background:#07070a;display:flex;justify-content:center;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}'
    +'.kpu-pl-in{width:100%;max-width:760px;padding:56px 16px 32px;box-sizing:border-box}'
    +'.kpu-pl-x{position:fixed;top:12px;right:12px;width:40px;height:40px;border-radius:20px;border:1px solid rgba(255,255,255,.18);background:rgba(25,25,28,.85);color:#fff;font-size:20px;line-height:38px;text-align:center;cursor:pointer;z-index:2}'
    +'.kpu-pl-v{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}'
    +'.kpu-pl-v.sh{aspect-ratio:9/16;max-width:min(100%,calc((100vh - 120px)*9/16));margin:0 auto}'
    +'.kpu-pl-v iframe{position:absolute;inset:0;width:100%;height:100%;border:0}'
    // 제목·날짜는 분리해 두 줄로(2026-11-16 사용자 "날짜·조회수는 제목 밑에 작게") — 긴 통짜 토큰이 가로를 밀지 않게 anywhere
    +'.kpu-pl-t{color:#eef2ff;font-size:15px;font-weight:600;line-height:1.4;margin:12px 2px 2px;word-break:keep-all;overflow-wrap:anywhere}'
    +'.kpu-pl-m{color:rgba(170,190,235,.62);font-size:12px;margin:0 2px 14px}'
    // '이어서' 카드 — 폰은 가로로 넘기고, 넓은 화면은 칸을 나눠 한 줄에 여럿(빌더가 실은 #kpu-next: 케미·곡 → 앱의 그 화면)
    +'.kpu-pl-nx{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;margin:2px -16px 22px;padding:0 16px}.kpu-pl-nx::-webkit-scrollbar{display:none}'
    // 카드가 하나면 플레이어 너비에 딱 맞춤(2026-11-16 사용자 "배너 너비 맞추든지")
    +'.kpu-pl-nx.one{margin:2px 0 22px;padding:0}.kpu-pl-nx.one .kpu-pl-n{flex:1 1 auto}'
    +'@media(min-width:640px){.kpu-pl-nx{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;margin:2px 0 22px;padding:0}.kpu-pl-n:nth-child(n+4){display:none}}'
    +'.kpu-pl-n{flex:0 0 252px;box-sizing:border-box;display:flex;align-items:center;gap:11px;min-width:0;padding:8px 12px 8px 8px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);text-decoration:none;transition:background .15s,border-color .15s}'
    +'.kpu-pl-n:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}'
    +'.kpu-pl-n img{width:68px;height:42px;border-radius:9px;object-fit:cover;flex:none;background:#1b1b1e}'
    +'.kpu-pl-n i{display:block;font-style:normal;min-width:0;flex:1}'
    +'.kpu-pl-n .k{display:block;font-size:11px;color:rgba(165,185,240,.65)}'
    +'.kpu-pl-n .t{display:block;font-size:13.5px;font-weight:650;color:#f1f4ff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.kpu-pl-n .s{display:block;font-size:11.5px;color:rgba(190,205,240,.58);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.kpu-pl-n b{font-weight:400;color:rgba(200,212,245,.45);font-size:17px;flex:none}'
    +'.kpu-pl-h{color:rgba(190,205,240,.75);font-size:13px;font-weight:600;margin:6px 2px 10px}'
    +'.kpu-pl-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    +'.kpu-pl-c{display:block;text-decoration:none;color:#dfe6ff;font-size:12.5px;line-height:1.35;cursor:pointer;min-width:0}'
    +'.kpu-pl-c img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;background:#1b1b1e}'
    +'.kpu-pl-c .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:6px;overflow-wrap:anywhere}'
    +'.kpu-pl-c .y{display:block;font-size:11px;color:rgba(170,190,235,.55);margin-top:3px}'
    +'html.kpu-pl-open,html.kpu-pl-open body{overflow:hidden}'
    // 폰 첫 화면 보정(2026-11-04 이탈 개선 2단계): 대표 이미지가 첫 화면의 절반(약 400px)을 차지해 직캠 목록이 거의 안 보였다 →
    // 가로로 긴 배너(최대 190px)로 줄여 첫 화면에 직캠이 두 줄 들어오게. 데스크톱은 그대로. 빌더 템플릿과 무관하게 모든 정적 페이지에 바로 적용된다.
    +'.kpu-hd{display:flex;align-items:center;gap:14px;margin:8px 0 16px}.kpu-hd img.cover{width:84px;height:84px;border-radius:50%;object-fit:cover;object-position:50% 25%;margin:0;flex:none}.kpu-hd h1{margin:0}.kpu-hd .sub{margin-top:2px}';
  // 폰(600px 이하): 이름 옆 원형 사진으로 — 이름 2줄 + 큰 대표 이미지(~200px)가 첫 화면을 나눠 써서 직캠이 아래로 밀렸다
  function compactHead(){
    if(innerWidth>600)return;
    var h1=document.querySelector('.wrap>h1'),cv=document.querySelector('.wrap>img.cover');if(!h1||!cv||cv.closest('.kpu-hd'))return;
    var sub=h1.nextElementSibling&&h1.nextElementSibling.classList&&h1.nextElementSibling.classList.contains('sub')?h1.nextElementSibling:null;
    var hd=document.createElement('div');hd.className='kpu-hd';h1.parentNode.insertBefore(hd,h1);
    var tx=document.createElement('div');tx.appendChild(h1);if(sub)tx.appendChild(sub);hd.appendChild(cv);hd.appendChild(tx);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',compactHead);else compactHead();
  // ── 칩 정리(2026-11-16 사용자) ──
  // ① 발매·앨범처럼 링크 아닌 칩이 버튼처럼 보였다 → 민무늬 글줄로. ② 직캠 전체 페이지의 곡 칩이
  //    수십 개 전부 펼쳐져 자리를 너무 차지 → 위쪽 몇 개만 보이고 "전체 N곡" 토글(정적 HTML은 그대로라 검색엔진은 전부 읽는다).
  function chipsTidy(){
    var CUT=10;
    [].forEach.call(document.querySelectorAll('.chips'),function(ul){
      var lis=[].slice.call(ul.children).filter(function(li){return li.tagName==='LI';});
      lis.forEach(function(li){if(!li.querySelector('a'))li.classList.add('kpu-plain');});
      var links=lis.filter(function(li){return li.querySelector('a');});
      if(links.length>CUT+2){
        links.slice(CUT).forEach(function(li){li.classList.add('kpu-chip-more');});
        var tg=document.createElement('li');tg.className='kpu-chip-tg';
        var b=document.createElement('button');b.type='button';
        var open=false,word=EN?['All '+links.length+' songs','Show less']:['전체 '+links.length+'곡','접기'];
        b.textContent=word[0]+' ▾';
        b.addEventListener('click',function(){open=!open;ul.classList.toggle('kpu-chips-open',open);b.textContent=open?word[1]+' ▴':word[0]+' ▾';});
        tg.appendChild(b);ul.appendChild(tg);
      }
    });
  }
  css+='.chips li.kpu-plain{background:none;border:0;padding:5px 2px;color:rgba(190,205,240,.72)}'
    +'.chips li.kpu-chip-more{display:none}.chips.kpu-chips-open li.kpu-chip-more{display:block}'
    +'.kpu-chip-tg{background:none!important;border:0!important;padding:0!important}'
    +'.kpu-chip-tg button{font:inherit;font-size:12.5px;padding:5px 12px;border-radius:999px;background:rgba(150,175,255,0.14);border:0.5px solid rgba(150,175,255,0.3);color:#dce6ff;cursor:pointer}';
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',chipsTidy);else chipsTidy();
  // ── 정적 페이지 겉모습(2026-11-12) — 정적 페이지 유입이 앱보다 훨씬 많다. 사용자 "정적 페이지와 본 사이트의 경계가 흐려지고,
  // 케이팝 유니버스 자체가 브랜딩이 되면". 모든 템플릿에 한 번에 적용되도록 여기서:
  // ① 왼쪽 위 'K-POP UNIVERSE' 글자 → 앱 아이콘 + 이름(로고). ② 하단 보라 버튼 → 우주 위에 뜬 반투명 카드 한 장
  //    (아이콘·이름 / 이 페이지 주인 / 어디로 가는지 ›), 내려 읽을 땐 숨고 올리거나 끝에 닿으면 나타난다(콘텐츠를 가리지 않게).
  // ③ 곡 페이지(song-page.css)는 넓은 화면에서 대표 영상 옆에 정보·카드를 두는 2단(웹 = 폰 확대판 금지, TASTE.md 4장).
  // '앱에서 보기' 같은 말은 쓰지 않는다 — 다음에 볼 것을 보여준다(메모리: 정적→앱 유도 문구 금지).
  var ICON='https://kpop-universe.kr/icons/icon-192.png';
  css+='a.brand{vertical-align:middle}.kpu-logo{display:inline-flex!important;align-items:center;gap:8px;font-size:13px!important;font-weight:600;letter-spacing:.01em!important;color:rgba(234,239,255,.9)!important}'
    +'.kpu-logo img{width:22px;height:22px;border-radius:7px;display:block}'
    +'.cta-dock.kpu-dk{position:fixed!important;left:0;right:0;bottom:0;margin:0!important;padding:0 12px calc(12px + env(safe-area-inset-bottom))!important;background:none!important;pointer-events:none;z-index:50;transition:transform .3s ease,opacity .3s ease}'
    +'.kpu-dk.hid{transform:translateY(calc(100% + 6px));opacity:0}'
    +'body.kpu-has-dk{padding-bottom:88px}'
    +'a.cta.kpu-card{pointer-events:auto;display:flex!important;align-items:center;gap:11px;box-sizing:border-box;max-width:440px;margin:0 auto;padding:8px 14px 8px 8px!important;border-radius:18px!important;background:rgba(23,23,26,.74)!important;-webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);border:1px solid rgba(255,255,255,.1)!important;box-shadow:0 10px 30px rgba(0,0,0,.45);text-align:left!important;font-weight:400!important;color:#f1f4ff!important;text-decoration:none!important;transition:background .15s,border-color .15s}'
    +'a.cta.kpu-card:hover{background:rgba(30,36,66,.82)!important;border-color:rgba(255,255,255,.16)!important}'
    +'.kpu-card>img{width:64px;height:40px;border-radius:9px;object-fit:cover;flex:none;background:#1b1b1e}'
    +'.kpu-card i{display:block;font-style:normal;min-width:0;flex:1}'
    +'.kpu-card .k{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(170,190,240,.7)}.kpu-card .k img{width:13px;height:13px;border-radius:4px}'
    +'.kpu-card .t{display:block;font-size:14px;font-weight:650;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.kpu-card .s{display:block;font-size:11.5px;color:rgba(190,205,240,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.kpu-card>b{font-weight:400;color:rgba(200,212,245,.5);font-size:18px;flex:none}'
    +'.kpu-side-cta{display:none}'
    +'@media(min-width:1000px){body.kpu-song .cta-dock.kpu-dk{display:none}body.kpu-song.kpu-has-dk{padding-bottom:0}.kpu-side-cta{display:block;margin-top:14px}.kpu-side-cta a.cta.kpu-card{max-width:none;margin:0;box-shadow:none;background:rgba(255,255,255,.05)!important}}';
  function shell(){
    var b=document.querySelector('a.brand');
    if(b&&!b.classList.contains('kpu-logo')&&/K-POP UNIVERSE/.test(b.textContent)){b.classList.add('kpu-logo');var li=document.createElement('img');li.src=ICON;li.alt='';b.insertBefore(li,b.firstChild);}
    var d=document.querySelector('.cta-dock'),a=d&&d.querySelector('a.cta');
    if(a&&!a.classList.contains('kpu-card')){
      var label=(a.textContent||'').replace(/\s*[→›]\s*$/,'').trim();
      var og=document.querySelector('meta[property="og:image"]'),src=og&&og.getAttribute('content')||'';
      src=src.replace(/\/(maxresdefault|hq720|hqdefault|sddefault)\.jpg/,'/mqdefault.jpg');
      a.textContent='';a.classList.add('kpu-card');
      if(src&&!/og-image\.png$/.test(src)){var im=document.createElement('img');im.alt='';im.src=src;im.onerror=function(){im.remove();};a.appendChild(im);}
      var tx=document.createElement('i'),k=document.createElement('span');k.className='k';var ki=document.createElement('img');ki.src=ICON;ki.alt='';k.appendChild(ki);k.appendChild(document.createTextNode('K-POP UNIVERSE'));tx.appendChild(k);
      var t=document.createElement('span');t.className='t';t.textContent=entity||label;tx.appendChild(t);
      if(entity){var s=document.createElement('span');s.className='s';s.textContent=label;tx.appendChild(s);}
      a.appendChild(tx);var ar=document.createElement('b');ar.textContent='›';a.appendChild(ar);
      d.classList.add('kpu-dk');document.body.classList.add('kpu-has-dk');
      var y0=scrollY,tick=false;
      addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){tick=false;var y=scrollY,end=innerHeight+y>=document.documentElement.scrollHeight-140;
        if(end||y<160||y<y0-8)d.classList.remove('hid');else if(y>y0+8)d.classList.add('hid');if(Math.abs(y-y0)>8)y0=y;});},{passive:true});
    }
    // 곡 페이지 2단: 대표 영상(.hero) 옆에 경로·칩·카드(폰에선 그대로 위아래)
    var hero=document.querySelector('.wrap>.hero');
    if(hero&&/song-page\.css/.test((document.querySelector('link[href*="song-page.css"]')||{}).href||'')&&!document.querySelector('.kpu-top')){
      document.body.classList.add('kpu-song');
      var top=document.createElement('div');top.className='kpu-top';hero.parentNode.insertBefore(top,hero);var cap=hero.nextElementSibling&&hero.nextElementSibling.matches('.hero-cap')?hero.nextElementSibling:null;if(cap){var hc=document.createElement('div');hc.className='kpu-hero';top.appendChild(hc);hc.appendChild(hero);hc.appendChild(cap);}else top.appendChild(hero);
      var side=document.createElement('div');side.className='kpu-side';top.appendChild(side);
      var h1=hero.querySelector('h1'),sb=hero.querySelector('.sub');if(h1){var sh=document.createElement('div');sh.className='kpu-side-h';sh.setAttribute('aria-hidden','true');var st1=document.createElement('div');st1.className='h'+(h1.textContent.length>22?' long':'');st1.textContent=h1.textContent;sh.appendChild(st1);if(sb){var st2=document.createElement('div');st2.className='sb';st2.textContent=sb.textContent;sh.appendChild(st2);}side.appendChild(sh);}
      var n=top.nextElementSibling;while(n&&n.matches&&n.matches('.crumbs,.hub-back,.lead,.chips')&&!(n.matches('.chips')&&n.children.length>5)){var nx=n.nextElementSibling;side.appendChild(n);n=nx;}
      if(a){var sc=document.createElement('div');sc.className='kpu-side-cta';var cl=a.cloneNode(true);var ct=cl.querySelector('.t'),cs=cl.querySelector('.s');if(ct&&cs){ct.textContent=cs.textContent;cs.remove();}sc.appendChild(cl);side.appendChild(sc);}
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shell);else shell();
  // ── 하트(2026-11-12 사용자 "그 멤버·그룹이 좋아서 보는 거니 하트를 유도하고, 누르면 맞춤 기능이 많다는 걸 스무스하게") ──
  // 멤버·그룹·직캠 모음 페이지 제목 옆 하트. 누르면 이 기기(같은 주소라 앱과 저장소 공유)에 'kpu_fav_pending'으로 남기고,
  // 유니버스에 들어오는 순간 app.js _importStaticFavs가 진짜 즐겨찾기로 옮긴다(첫 하트면 우주 연출). 가입·로그인 없음.
  // 이미 앱에서 즐겨찾기한 대상은 처음부터 채워진 하트.
  function heart(){
    if(!/^(group|member|fancams)$/.test(PTYPE))return;
    var h1=document.querySelector('h1'),cta=document.querySelector('a.cta[href*="#g="]');
    if(!h1||!cta||h1.querySelector('.kpu-heart'))return;
    var hp;try{hp=new URLSearchParams(new URL(cta.href).hash.slice(1));}catch(e){return;}
    var g=hp.get('g'),m=hp.get('m');if(!g)return;
    var name=(h1.textContent||'').replace(/\s*\(.*$/,'').replace(/\s+(Fancams?|직캠.*)$/i,'').trim()||g;
    function rd(k){try{return JSON.parse(localStorage.getItem(k)||'[]')||[];}catch(e){return [];}}
    function inApp(){return m?rd('kpu_fav_members').indexOf(g+':'+m)>=0:rd('kpu_fav_groups').indexOf(g)>=0;}
    function pending(){return rd('kpu_fav_pending').some(function(x){return x&&x.g===g&&(x.m||'')===(m||'');});}
    var H=EN?{add:'Add to favorites',on:'In your favorites',t:'New fancams & stages of '+name+' will gather in your universe',go:'Open my universe',had:name+' is already in your universe'}
      :{add:'즐겨찾기',on:'즐겨찾기함',t:name+' 새 직캠·무대가 올라오면 내 우주에 모아둘게요',go:'내 우주 보기',had:name+' — 이미 내 우주에 있어요'};
    var st=document.createElement('style');st.textContent=
      '.kpu-heart{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:36px;height:36px;margin:-4px 0 0 10px;padding:0;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:rgba(230,235,250,.82);cursor:pointer;transition:background .15s,border-color .15s,transform .15s}'
      +'.kpu-heart:hover{background:rgba(255,255,255,.09)}.kpu-heart svg{width:18px;height:18px}'
      +'.kpu-heart.on{color:#ff5c8a;border-color:rgba(255,92,138,.45);background:rgba(255,92,138,.1)}.kpu-heart.on path{fill:currentColor}'
      +'.kpu-heart.pop{animation:kpu-hp .42s cubic-bezier(.2,1.6,.4,1)}@keyframes kpu-hp{0%{transform:scale(.7)}60%{transform:scale(1.18)}100%{transform:scale(1)}}'
      +'.kpu-ft{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));z-index:2147482000;transform:translate(-50%,12px);opacity:0;transition:opacity .22s,transform .22s;width:min(420px,calc(100vw - 24px));box-sizing:border-box;padding:12px 14px;border-radius:16px;background:rgba(19,19,22,.94);border:1px solid rgba(255,255,255,.1);box-shadow:0 10px 32px rgba(0,0,0,.45);color:#e8ecf6;font-size:13.5px;line-height:1.45;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}'
      +'.kpu-ft.in{opacity:1;transform:translate(-50%,0)}.kpu-ft b{color:#ff5c8a;font-weight:600;margin-right:6px}'
      +'.kpu-ft a{display:inline-block;margin-top:8px;color:#fff;font-weight:600;text-decoration:none;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}.kpu-ft a:hover{background:rgba(255,255,255,.14)}'
      +'body:not(.kpu-has-dk) .kpu-ft{bottom:calc(20px + env(safe-area-inset-bottom))}';
    document.head.appendChild(st);
    var b=document.createElement('button');b.type='button';b.className='kpu-heart';
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.5 7.8 3.6 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.5 3.3 4.3 6.6-1.8 4.8-9.3 9.4-9.3 9.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    function sync(){var on=inApp()||pending();b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');b.title=on?H.on:H.add;b.setAttribute('aria-label',(on?H.on:H.add)+' — '+name);}
    sync();h1.appendChild(b);
    var ft=null,ftT=0;
    function toast(msg,first){
      if(!ft){ft=document.createElement('div');ft.className='kpu-ft';ft.setAttribute('role','status');document.body.appendChild(ft);}
      ft.textContent='';
      var p=document.createElement('div');if(first){var hb=document.createElement('b');hb.textContent='♥';p.appendChild(hb);}p.appendChild(document.createTextNode(msg));ft.appendChild(p);
      var a=document.createElement('a');a.href=cta.href;a.textContent=H.go+' ›';a.addEventListener('click',function(){log('to_app');});ft.appendChild(a);
      requestAnimationFrame(function(){ft.classList.add('in');});
      clearTimeout(ftT);ftT=setTimeout(function(){ft.classList.remove('in');},7000);
    }
    b.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      if(inApp()){toast(H.had,false);return;}
      if(pending()){ // 다시 누르면 취소(앱으로 넘어가기 전이라 이 기기에만 있는 표시)
        try{localStorage.setItem('kpu_fav_pending',JSON.stringify(rd('kpu_fav_pending').filter(function(x){return !(x&&x.g===g&&(x.m||'')===(m||''));})));}catch(_){}
        sync();if(ft)ft.classList.remove('in');return;
      }
      try{var L=rd('kpu_fav_pending');L.push({g:g,m:m||'',at:Date.now()});localStorage.setItem('kpu_fav_pending',JSON.stringify(L.slice(-10)));}catch(_){}
      sync();b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');
      log('fav');ga('seo_fav',{entity_name:name});
      toast(H.t,true);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',heart);else heart();
  // ── 이번 주 많이 본 직캠(2026-11-12 사용자 "정적 페이지 반응을 모아 보여주면 궁금해서 들어온다") ──
  // 서버 get_hot_fancams(1시간 캐시): 최근 7일 게시 직캠을 유튜브 조회수 순, 한 그룹 최대 2개, 12개.
  // 우리 사이트 재생(seo_events vid, 7일)이 쌓이면 그 영상이 앞으로 온다. 카드는 유튜브 링크라 이 페이지 안 재생기로 열린다.
  function hot(){
    if(/^(other|group_list)$/.test(PTYPE)&&!/^\/(en\/)?show\//.test(location.pathname))return;
    if(/\/rank\//.test(location.pathname)||document.querySelector('.kpu-hot'))return;
    var KEY='kpu_hot_v1',data=null;
    try{var c=JSON.parse(sessionStorage.getItem(KEY)||'null');if(c&&Date.now()-c.t<30*60e3)data=c.d;}catch(e){}
    function draw(d){
      var items=(d&&d.items||[]).filter(function(x){return x&&x.id;});if(items.length<4)return;
      var st=document.createElement('style');st.textContent=
        '.kpu-hot{margin:34px 0 8px}.kpu-hot-h{display:flex;align-items:baseline;gap:10px;margin:0 0 4px}'
        +'.kpu-hot-h h2{margin:0;font-size:17px;font-weight:700;color:#eef1fa}.kpu-hot-h a{margin-left:auto;font-size:12.5px;color:rgba(190,205,240,.7);text-decoration:none;white-space:nowrap}.kpu-hot-h a:hover{color:#fff}'
        +'.kpu-hot-s{font-size:12px;color:rgba(190,205,240,.55);margin:0 0 12px}'
        +'.kpu-hot-r{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}'
        +'.kpu-hot-c{flex:0 0 200px;scroll-snap-align:start;text-decoration:none;color:#e6eaf5;min-width:0}'
        +'.kpu-hot-c .th{position:relative;display:block;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#1b1b1e}.kpu-hot-c img{width:100%;height:100%;object-fit:cover;display:block}'
        +'.kpu-hot-c .n{position:absolute;left:7px;top:6px;font-size:12px;font-weight:700;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.8)}'
        +'.kpu-hot-c .t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.38;margin-top:7px}'
        +'.kpu-hot-c .v{display:block;font-size:11.5px;color:rgba(190,205,240,.55);margin-top:3px}'
        +'@media(min-width:900px){.kpu-hot-c{flex-basis:220px}}';
      document.head.appendChild(st);
      var fmt=function(n){n=+n||0;if(!n)return '';if(n>=1e6)return Math.floor(n/1e6)+'M+';if(n>=1e3)return Math.floor(n/1e3)+'K+';if(n>=100)return Math.floor(n/100)*100+'+';return '<100';};
      var sec=document.createElement('section');sec.className='kpu-hot';
      var hd=document.createElement('div');hd.className='kpu-hot-h';var h2=document.createElement('h2');h2.textContent=EN?'Trending fancams this week':'이번 주 인기 직캠';hd.appendChild(h2);
      var more=document.createElement('a');more.href=(EN?'/en':'')+'/rank/fancam/'+new Date().getFullYear()+'/';more.textContent=(EN?'Rankings':'직캠 순위')+' ›';hd.appendChild(more);sec.appendChild(hd);
      var sb=document.createElement('p');sb.className='kpu-hot-s';sb.textContent=EN?'Fancams posted in the last 7 days · trending':'최근 7일 올라온 직캠 · 인기순'; // 순서는 조회수 순위+이 사이트에서의 재생(서버 get_hot_fancams)을 섞은 점수 — '조회수 순'이라 적으면 숫자 순서와 어긋나 보였다(2026-11-17 Codex)sec.appendChild(sb);
      var row=document.createElement('div');row.className='kpu-hot-r';
      items.slice(0,12).forEach(function(x,i){
        var a=document.createElement('a');a.className='kpu-hot-c';a.href='https://www.youtube.com/watch?v='+x.id;a.target='_blank';a.rel='noopener';
        var th=document.createElement('span');th.className='th';var im=document.createElement('img');im.loading='lazy';im.alt='';im.src='https://i.ytimg.com/vi/'+x.id+'/mqdefault.jpg';th.appendChild(im);
        var n=document.createElement('span');n.className='n';n.textContent=String(i+1);th.appendChild(n);a.appendChild(th);
        var t=document.createElement('span');t.className='t';t.textContent=x.t||'';a.appendChild(t);
        var v=document.createElement('span');v.className='v';v.textContent=fmt(x.vc);a.appendChild(v);
        row.appendChild(a);
      });
      sec.appendChild(row);
      // 바닥 언어 전환·사이트 소개 줄(.lang-switch) 위에 — 없으면 앱 카드 위, 그것도 없으면 본문 끝
      var foot=document.querySelector('.lang-switch'),dock=document.querySelector('.cta-dock'),wrap=document.querySelector('.wrap')||document.querySelector('main')||document.body;
      var at=foot||dock;if(at&&at.parentNode)at.parentNode.insertBefore(sec,at);else wrap.appendChild(sec);
    }
    if(data){draw(data);return;}
    try{fetch('https://dukgguehegnembimqvkm.supabase.co/rest/v1/rpc/get_hot_fancams',{method:'POST',
      headers:{'Content-Type':'application/json',apikey:'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0',Authorization:'Bearer sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'},body:'{}'})
      .then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d)return;try{sessionStorage.setItem(KEY,JSON.stringify({t:Date.now(),d:d}));}catch(e){}draw(d);}).catch(function(){});}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hot);else hot();
  // ── 이번 주 n명(2026-11-12) — 서버 get_week_viewers(1시간 캐시): 그룹별 7일 본 사람(정적 페이지 사람 + 앱 카드 연 계정), 30명 이상만.
  // 숫자가 작으면 아예 안 보인다(빈 식당처럼 보이지 않게). 그룹·멤버·직캠 모음·곡 페이지의 제목 아래 한 줄.
  // ── 제목 아래 상태 줄(2026-11-18 정리) — 앱 카드 상태 줄(_renderGcStatusLine)과 **같은 구조·같은 디자인**: 6px 맥박 점 + 문장, 4초마다
  // 아래에서 밀려 올라오며 교체. 지표(좋아해요 분홍·이번 주 흔적 민트·다녀간 사람 연보라) 뒤에 정보(조용한 점: 빌드 때 심은 #kpu-facts).
  // 숫자는 서버 get_live_stats 하나(1시간 저장)로 — 카드용 RPC를 페이지마다 부르면 DB 부담. 앱과 같은 저장 키(kpu_ls_v1)라 서로 나눠 쓴다.
  function viewers(){
    if(!/^(group|member|fancams|song)$/.test(PTYPE))return;
    if(document.querySelector('.kpu-vw'))return;
    var g=GRP,m=null;
    try{var cta=document.querySelector('a.cta[href*="#g="]');if(cta){var hp=new URLSearchParams(new URL(cta.href).hash.slice(1));g=hp.get('g')||g;m=hp.get('m');}}catch(e){}
    var facts=[];try{var fe=document.getElementById('kpu-facts');if(fe)facts=JSON.parse(fe.textContent)||[];}catch(e){}
    var line=null,items=[],idx=0,timer=null;
    function ensure(){
      if(line)return true;
      var h1=document.querySelector('h1');if(!h1)return false;
      var st=document.createElement('style');
      st.textContent='.kpu-vw{position:relative;overflow:hidden;height:18px;margin:6px 0 10px;font-size:12.5px;letter-spacing:.01em}'
        +'.kpu-vw .in{position:absolute;inset:0;display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
        +'.kpu-vw .in.a-in{animation:kpu-si .42s cubic-bezier(.22,.8,.36,1) forwards}.kpu-vw .in.a-out{animation:kpu-so .38s cubic-bezier(.64,0,.78,.2) forwards}'
        +'@keyframes kpu-si{from{transform:translateY(110%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes kpu-so{from{transform:translateY(0);opacity:1}to{transform:translateY(-110%);opacity:0}}'
        +'.kpu-vw i{width:6px;height:6px;border-radius:50%;flex:none;animation:kpu-pl 1.6s ease-in-out infinite}'
        +'@keyframes kpu-pl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.72)}}'
        +'.kpu-vw .t-fav{color:rgba(255,150,190,.85);text-shadow:0 0 6px rgba(255,120,170,.3)}.kpu-vw .t-fav i{background:rgb(255,110,165);box-shadow:0 0 5px rgba(255,110,165,.8)}'
        +'.kpu-vw .t-tr{color:#ccd8ee}.kpu-vw .t-tr i{background:rgb(110,225,195);box-shadow:0 0 5px rgba(110,225,195,.75)}'
        +'.kpu-vw .t-vis{color:#ccd8ee}.kpu-vw .t-vis i{background:rgb(170,160,255);box-shadow:0 0 5px rgba(170,160,255,.8)}'
        +'.kpu-vw .t-info{color:rgba(190,205,235,.72)}.kpu-vw .t-info i{width:5px;height:5px;background:rgba(150,175,225,.6);animation:none}'
        +'@media (prefers-reduced-motion:reduce){.kpu-vw i{animation:none}.kpu-vw .in.a-in,.kpu-vw .in.a-out{animation:none}}';
      document.head.appendChild(st);
      line=document.createElement('div');line.className='kpu-vw';
      var top=document.querySelector('.kpu-top');
      if(top&&top.contains(h1)){var side=document.querySelector('.kpu-side-h');(side||h1).insertAdjacentElement('afterend',line);}
      else{var meta=document.querySelector('.top2 .meta');(meta||h1).insertAdjacentElement(meta?'beforebegin':'afterend',line);}
      return true;
    }
    function piece(it,anim){var d=document.createElement('div');d.className='in t-'+it.t+(anim?' a-in':'');var i=document.createElement('i');d.appendChild(i);d.appendChild(document.createTextNode(it.s));return d;}
    function render(){
      if(!items.length||!ensure())return;
      clearInterval(timer);timer=null;idx=0;
      line.innerHTML='';line.appendChild(piece(items[0],false));
      if(items.length<2)return;
      timer=setInterval(function(){
        if(document.hidden)return;
        idx=(idx+1)%items.length;
        var old=line.querySelector('.in');if(old)old.classList.add('a-out');
        setTimeout(function(){line.innerHTML='';line.appendChild(piece(items[idx],true));},420);
      },4000);
    }
    var info=facts.map(function(x){return{t:'info',s:x};});
    items=info.slice();render(); // 정보 줄은 바로, 지표는 받아 오면 앞에 붙여 다시
    function withStats(d){
      if(!d)return;
      var f=function(n){return Number(n).toLocaleString(EN?'en-US':'ko-KR');},met=[];
      var fav=m?(d.favm&&d.favm[g+':'+m]):(d.fav&&d.fav[g]);
      if(fav>0)met.push({t:'fav',s:EN?(f(fav)+' like this'):(f(fav)+'명이 좋아해요')});
      var tr=!m&&d.tr&&d.tr[g];
      if(tr&&tr[0]>0&&tr[1]>0)met.push({t:'tr',s:EN?(f(tr[0])+' left '+f(tr[1])+' traces this week'):('이번 주 '+f(tr[0])+'명이 흔적 '+f(tr[1])+'개를 남겼어요')});
      var w=d.vw&&d.vw[g],t=d.vt&&d.vt[g];
      if(w||t)met.push({t:'vis',s:EN?((w?f(w)+' this week · ':'')+(t?f(t)+' visited so far':'visited')):((w?'이번 주 '+f(w)+'명 · ':'')+(t?'지금까지 '+f(t)+'명이 다녀갔어요':'다녀갔어요'))});
      if(!met.length)return;
      items=met.concat(info);render();
    }
    var KEY='kpu_ls_v1';
    try{var c=JSON.parse(sessionStorage.getItem(KEY)||'null');if(c&&Date.now()-c.t<30*60e3){withStats(c.d);return;}}catch(e){}
    if(!g)return;
    try{fetch('https://dukgguehegnembimqvkm.supabase.co/rest/v1/rpc/get_live_stats',{method:'POST',
      headers:{'Content-Type':'application/json',apikey:'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0',Authorization:'Bearer sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'},body:'{}'})
      .then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d)return;try{sessionStorage.setItem(KEY,JSON.stringify({t:Date.now(),d:d}));}catch(e){}withStats(d);}).catch(function(){});}catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',viewers);else viewers();



  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  // 제목은 제목 칸(.card-t 등)만 — a.textContent를 통째로 쓰면 날짜·조회수(.card-y)까지 한 덩어리로 붙어
  // "…MBC2504262025.04.28 · 조회수 4만회"처럼 보이고, 긴 통짜 토큰이 그리드 칸까지 밀었다(2026-11-16).
  function titleOf(a){var t=(a.getAttribute('title')||'').trim();if(t)return t;var x=a.querySelector('.card-t,.mf-t,.t,.title,b,strong');t=((x&&x.textContent)||'').replace(/\s+/g,' ').trim();if(!t)t=(a.textContent||'').replace(/\s+/g,' ').trim();if(!t){var im=a.querySelector('img');t=im&&im.alt||'';}return t.slice(0,140);}
  function metaOf(a){var y=a.querySelector('.card-y,.v');return y?y.textContent.replace(/\s+/g,' ').trim():'';}
  function allLinks(){var seen={},out=[];[].forEach.call(document.querySelectorAll('a[href]'),function(a){if(a.closest&&a.closest('.kpu-pl'))return;var v=vidOf(a);if(!v||seen[v])return;seen[v]=1;out.push({v:v,a:a,t:titleOf(a),m:metaOf(a),sh:isShort(a)});});return out;}
  var ov=null,cur=-1,list=[];
  function close(fromPop){if(!ov)return;ov.remove();ov=null;document.documentElement.classList.remove('kpu-pl-open');if(!fromPop&&history.state&&history.state.kpuPlay)history.back();}
  function render(i){
    cur=i;var it=list[i];if(!it)return;
    var box=ov.querySelector('.kpu-pl-v');box.className='kpu-pl-v'+(it.sh?' sh':'');
    box.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+it.v+'?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title=""></iframe>';
    box.querySelector('iframe').title=it.t;
    ov.querySelector('.kpu-pl-t').textContent=it.t;
    ov.querySelector('.kpu-pl-m').textContent=it.m||'';
    renderNext(it);
    var g=ov.querySelector('.kpu-pl-g');g.innerHTML='';
    for(var k=1,n=0;k<list.length&&n<6;k++){var j=(i+k)%list.length,x=list[j];if(j===i)continue;n++;
      var c=document.createElement('a');c.className='kpu-pl-c';c.href=x.a.getAttribute('href');c.setAttribute('data-i',j);
      var im=document.createElement('img');im.loading='lazy';im.alt='';im.src='https://i.ytimg.com/vi/'+x.v+'/mqdefault.jpg';
      var sp=document.createElement('span');sp.className='t';sp.textContent=x.t;c.appendChild(im);c.appendChild(sp);
      if(x.m){var ym=document.createElement('span');ym.className='y';ym.textContent=x.m;c.appendChild(ym);}
      g.appendChild(c);}
    ov.scrollTop=0;
  }
  // '이어서' 항목: 빌더가 실은 #kpu-next(멤버 페이지) — 없으면 페이지의 하단 버튼 주소로 카드 하나
  var NX=null;
  function nextItems(){
    if(NX)return NX;
    try{var j=document.getElementById('kpu-next');NX=j?JSON.parse(j.textContent):[];}catch(e){NX=[];}
    if(!NX.length){var cta=document.querySelector('.cta');var og=document.querySelector('meta[property="og:image"]');
      // 카드 제목에선 '직캠' 꼬리를 뗀다(2026-11-16 사용자) — 눌러서 나오는 건 멤버 카드(프로필·디스코그래피)라 문구와 실제가 어긋났다
      var nm=entity.replace(/['’‘]?\s*(직캠|Fancams?)\s*(모음|전체)?\s*$/i,'').trim()||entity;
      NX=[{k:T.nxK,t:nm,s:T.nxS,h:cta?cta.getAttribute('href'):'https://kpop-universe.kr/',im:og?og.getAttribute('content'):''}];}
    return NX;
  }
  function norm(x){return String(x||'').toLowerCase().split(' ').join('');}
  function renderNext(it){
    var box=ov.querySelector('.kpu-pl-nx');box.innerHTML='';
    var items=nextItems().slice(),tt=norm(it&&it.t);
    box.classList.toggle('one',items.length===1);
    items.sort(function(a,b){return (b.m&&tt.indexOf(norm(b.m))>=0?1:0)-(a.m&&tt.indexOf(norm(a.m))>=0?1:0);});
    items.forEach(function(x){
      var a=document.createElement('a');a.className='kpu-pl-n';a.href=x.h;a.setAttribute('data-k',x.m?'song':(x.k||''));
      var src=x.img?'https://i.ytimg.com/vi/'+x.img+'/mqdefault.jpg':(x.im||'');
      if(src){var im=document.createElement('img');im.alt='';im.loading='lazy';im.src=src;a.appendChild(im);}
      var tx=document.createElement('i');[['k',x.k],['t',x.t],['s',x.s]].forEach(function(p){if(!p[1])return;var e=document.createElement('span');e.className=p[0];e.textContent=p[1];tx.appendChild(e);});
      a.appendChild(tx);var ar=document.createElement('b');ar.textContent='›';a.appendChild(ar);box.appendChild(a);
    });
  }
  function open(i){
    list=allLinks();if(!list[i])return;
    if(!ov){
      ov=document.createElement('div');ov.className='kpu-pl';ov.setAttribute('role','dialog');
      // '유튜브에서 보기' 링크는 뺐다(2026-11-16 사용자) — 새 탭은 ctrl/⌘/가운데 클릭으로 여전히 가능.
      ov.innerHTML='<button class="kpu-pl-x" type="button"></button><div class="kpu-pl-in"><div class="kpu-pl-v"></div><div class="kpu-pl-t"></div><div class="kpu-pl-m"></div><div class="kpu-pl-nx"></div><div class="kpu-pl-h"></div><div class="kpu-pl-g"></div></div>';
      var x=ov.querySelector('.kpu-pl-x');x.textContent='✕';x.setAttribute('aria-label',T.close);x.onclick=function(){close();};
      ov.querySelector('.kpu-pl-h').textContent=T.next;
      ov.querySelector('.kpu-pl-nx').onclick=function(e){var n=e.target.closest&&e.target.closest('.kpu-pl-n');if(n)ga('seo_play_cta',{entity_name:entity,video_id:list[cur]&&list[cur].v,kind:n.getAttribute('data-k')||''});};
      ov.addEventListener('click',function(e){
        if(e.target===ov||e.target.classList.contains('kpu-pl-in')){close();return;}
        var c=e.target.closest&&e.target.closest('.kpu-pl-c');
        if(c&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey){e.preventDefault();var j=+c.getAttribute('data-i');ga('seo_play_next',{entity_name:entity,video_id:list[j]&&list[j].v});render(j);}
      });
      document.body.appendChild(ov);document.documentElement.classList.add('kpu-pl-open');
      try{history.pushState({kpuPlay:1},'');}catch(e){}
    }
    render(i);
  }
  window.addEventListener('popstate',function(){if(ov)close(true);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&ov)close();});
  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    var a=e.target.closest&&e.target.closest('a[href]');if(!a||(a.closest&&a.closest('.kpu-pl')))return;
    var v=vidOf(a);if(!v)return;
    e.preventDefault();
    var L=allLinks(),i=0;for(var k=0;k<L.length;k++)if(L[k].v===v){i=k;break;}
    ga('seo_play',{entity_name:entity,video_id:v,idx:i});
    open(i);
  },true);
  // 이전 화면 버튼(2026-11-15 사용자 "정적 페이지에서도 이전 화면 갈 수 있는 버튼 있으면 좋을 듯").
  // 우리 사이트 안에서 넘어온 경우에만 보인다 — 검색에서 바로 착지한 첫 화면엔 돌아갈 곳이 없어 무의미.
  // 이 파일은 모든 정적 페이지가 불러오므로 4만 장 재빌드 없이 한 번에 적용된다.
  try{
    var _ref=document.referrer?new URL(document.referrer):null;
    if(_ref&&_ref.origin===location.origin&&_ref.pathname!==location.pathname&&history.length>1){
      var _w=document.querySelector('.wrap');
      if(_w){
        var _bk=document.createElement('a');
        _bk.href=document.referrer;_bk.textContent='‹';_bk.setAttribute('aria-label',EN?'Back':'이전 화면');
        _bk.setAttribute('style','display:inline-block;margin:0 12px 8px -4px;padding:0 10px;font-size:19px;line-height:1.2;color:rgba(150,175,255,0.75);text-decoration:none;');
        _bk.addEventListener('click',function(ev){ev.preventDefault();history.back();});
        _w.insertBefore(_bk,_w.firstChild);
      }
    }
  }catch(e){}
})();

// 영상 날짜 표기(2026-11-17, 앱 _fmtVidAgo와 통일): 정적 HTML엔 yyyy.mm.dd로 굽고(검색엔진·JS 꺼진 환경 그대로), 브라우저가 7일 안이면 'N일 전'(en: Nd ago)으로 바꾼다.
// 날짜만 있고 시각을 모르는 값이라 앱과 같이 오늘 올라온 건 날짜 칸을 뺀다("N시간 전"을 못 말하므로). 카드 메타(.card-y·.mf-y)만 대상 — 동적으로 그린 카드는 seo_vids.js가 다시 부른다.
(function(){
  window.kpuRelDates=function(root){
    try{
      var EN=/^\/en\//.test(location.pathname)||document.documentElement.lang==='en';
      var n=new Date(),t0=new Date(n.getFullYear(),n.getMonth(),n.getDate()).getTime();
      [].forEach.call((root||document).querySelectorAll('.card-y,.mf-y'),function(el){
        if(el.getAttribute('data-rd'))return;
        el.setAttribute('data-rd','1');
        var ch=false;
        var parts=el.textContent.split(' · ').map(function(p){
          var m=/^(\d{4})\.(\d{2})\.(\d{2})$/.exec(p);if(!m)return p;
          var d=Math.round((t0-new Date(+m[1],+m[2]-1,+m[3]).getTime())/86400000);
          if(d>=7)return p;
          ch=true;
          if(d<=0)return '';
          return EN?(d+'d ago'):(d+'일 전');
        }).filter(Boolean);
        if(ch)el.textContent=parts.join(' · ');
      });
    }catch(e){}
  };
  window.kpuRelDates();
})();
