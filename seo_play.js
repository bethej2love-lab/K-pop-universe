// 정적(검색 착지) 페이지 영상 페이지 안 재생(2026-11-04).
// 왜: 검색·챗지피티로 들어온 사람이 직캠 카드를 누르면 유튜브 새 탭으로 나가 GA에 "1분 내 이탈"로 잡혔다(페이지당 유튜브 링크 ~27개, 남는 길은 앱 버튼 하나).
// 이제 유튜브 링크를 누르면 이 페이지 위에서 공식 임베드로 재생하고, 아래에 같은 페이지의 다음 영상 6개 + 앱으로 가는 버튼을 둔다.
// 링크 자체(href)는 그대로라 검색엔진·자바스크립트 꺼진 환경·새 탭 열기(ctrl/⌘/가운데 클릭)는 예전처럼 유튜브로 간다.
// 이 파일은 모든 정적 페이지가 /seo_play.js로 불러온다 — 고칠 때 4만 장을 다시 만들 필요가 없다.
(function(){
  'use strict';
  if(window.__kpuPlay)return;window.__kpuPlay=1;
  var EN=/^\/en\//.test(location.pathname)||document.documentElement.lang==='en';
  var T=EN?{back:'Back',close:'Close',next:'Up next',app:'See more in the app',nxK:'Explore',nxS:'Profile · fancams · stages'}:{back:'이전',close:'닫기',next:'이어서 보기',app:'앱에서 더 보기',nxK:'더 둘러보기',nxS:'프로필 · 직캠 · 무대'};
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
    +'.kpu-pl-x{position:fixed;top:10px;left:8px;width:44px;height:44px;border-radius:22px;border:none;background:rgba(25,25,28,.6);color:#fff;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2}.kpu-pl-x svg{width:22px;height:22px;display:block}' // 2026-11-19 사용자: 오른쪽 위 ✕ 대신 왼쪽 위 '이전'(‹) — 닫는다기보다 보던 페이지로 돌아가는 느낌. 테두리 없음
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
    +'.kpu-hd{display:flex;align-items:center;gap:14px;margin:8px 0 16px}.kpu-hd img.cover{width:84px;height:84px;border-radius:50%;object-fit:cover;object-position:50% 25%;margin:0;flex:none}.kpu-hd h1{margin:0}.kpu-hd .sub{margin-top:2px}'
    // 폰 그룹·멤버 페이지 머리(2026-11-19 사용자 스크린샷 "원 사진 옆으로 이름 넣는 게 낫다 — 지금 참 보기 안 좋다, 쓸데없는 여백 ㄴㄴ"):
    // 이름(h1)이 한 줄을 통째로 쓰고 그 아래 원 사진이 또 한 덩어리를 차지했다 → 사진 왼쪽(76px)·이름과 상태 줄 오른쪽, 메타·링크는 그 아래 전체 폭.
    // 웹(.top2 격자, seo_extra.js)은 그대로. 이 파일이라 재생성 없이 전 페이지에 바로 적용.
    +'@media(max-width:600px){.top2:has(.avatar){display:grid;grid-template-columns:76px minmax(0,1fr);column-gap:14px;align-items:center;margin:14px 0 6px}'
    +'.top2:has(.avatar)>.cover.avatar{grid-column:1;grid-row:1/span 2;width:76px;height:76px;max-width:none;margin:0}'
    +'.top2:has(.avatar)>h1{grid-column:2;grid-row:1;margin:0;font-size:22px;line-height:1.2;align-self:end;word-break:keep-all}'
    +'.top2:has(.avatar)>.kpu-vw{grid-column:2;grid-row:2;align-self:start;margin:4px 0 0}'
    +'.top2:has(.avatar)>h1:only-of-type{align-self:center}'
    +'.top2:has(.avatar)>*:not(.cover):not(h1):not(.kpu-vw){grid-column:1/-1}'
    +'.top2:has(.avatar)>.meta{margin-top:12px;margin-bottom:0}.top2:has(.avatar)>.sns{margin:10px 0 0}'
    // 맨 윗줄(이전 ‹ · 브랜드 · 그룹 전체 · 모아보기 · 언어)이 한 줄에 들어가게 보조 링크만 한 단계 작게
    +'.brand+.brand{font-size:11px;margin-left:8px!important}}'
    +'@media(max-width:380px){.brand+.brand+.brand{display:none}}'
    // 2026-11-20 사용자: ①위 안내 줄과 브랜드 줄 사이 여백이 쓸데없이 크다 → 폰 .wrap 위 여백 23→11px(정적 CSS는 캐시 때문에 여기서도)
    // ②'나무위키' 알약 하나가 한 줄을 통째로 차지 → 링크가 하나뿐이면 소속·생일 줄 끝에 글자 링크로 붙인다(metaTidy) ③생일 옆 '(만 n세)' 제거(재생성 전 페이지용)
    +'@media(max-width:700px){.kpu-topbar+.wrap,.wrap{padding-top:11px}}'
    +'@media(max-width:600px){.top2>.meta{gap:7px 12px;font-size:13px!important}}' // 나이 괄호를 뺀 자리에 한 줄 세 칸(소속·생일·데뷔)이 들어가게 — 그래야 둘째 줄에 소속사+나무위키가 같이 선다
    +'.meta .kpu-meta-link{display:inline-flex;align-items:center}.meta .kpu-meta-link a:not(.kpu-sns-ic){color:rgba(170,190,240,.82);text-decoration:none}'
    // 바로가기 칩·관련 목록의 둥근 네모 테두리 제거(2026-11-20 사용자 "버튼 디자인 거지같음, 테두리 지워") — 글자 링크로
    +'.hub-more a{padding:0;border:0;border-radius:0;background:none;color:rgba(170,190,240,.85);font-size:13.5px}.member-list,.discog-list{gap:6px 16px}.member-list li,.discog-list li{background:none;border:0;border-radius:0;padding:0}'
    // 사진 줄 아래 소속 글자가 본문 크기로 커 보였다(멤버 페이지엔 .face-n 규칙이 없다) — 작고 흐리게, 한 줄로(2026-11-20 재생성 뒤 실페이지 확인)
    +'.rel-faces .face-nm{font-size:12.5px}.rel-faces .face-n{display:block;font-size:11px;color:rgba(160,180,230,.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.member-list.jump{gap:4px 18px;margin-top:10px!important}.member-list.jump li,.member-list.rel li{background:none;border:0;border-radius:0;padding:0}'
    +'.member-list.jump a{color:rgba(170,190,240,.85);font-size:13.5px}.member-list.jump a:after{content:" ›";opacity:.6}.member-list.rel{gap:6px 16px}'
    +'.sns.kpu-sns-row{gap:14px;align-items:center;margin-top:12px}'
    +'a.kpu-sns-ic{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;padding:0;border:0;border-radius:0;background:none;color:rgba(170,190,240,.8)}'
    +'a.kpu-sns-ic:hover{background:none}a.kpu-sns-ic svg{width:100%;height:100%;display:block}a.kpu-sns-ic.kpu-sns-youtube{width:28.6px}';
  function metaTidy(){
    try{
      // 재생성 전 페이지 보정(2026-11-20 사용자): 이름의 영문 괄호를 한 칸 띄어쓰기로('코르티스(CORTIS)'→'코르티스 CORTIS'), 바로가기 칩의 '멤버' 제거(바로 아래에 보인다)
      var h1=document.querySelector('.top2>h1');
      if(h1&&h1.childNodes.length===1&&h1.firstChild.nodeType===3){var m1=/^(.+?)\(([^()]+)\)$/.exec(h1.textContent.trim());if(m1)h1.textContent=m1[1]+' '+m1[2];}
      // 페이지 아래 '링크' 묶음(나무위키·인스타 글자)은 위쪽 아이콘 줄과 같은 링크라 뺀다
      [].forEach.call(document.querySelectorAll('.wrap>h2'),function(h){var tx=h.textContent.trim();if(tx!=='링크'&&tx!=='Links')return;var ul=h.nextElementSibling;if(ul&&ul.classList.contains('member-list')){ul.parentNode.removeChild(ul);h.parentNode.removeChild(h);}});
      var jm=document.querySelector('.member-list.jump a[href="#members"]');if(jm&&jm.parentNode)jm.parentNode.parentNode.removeChild(jm.parentNode);
      var meta=document.querySelector('.top2>.meta');if(!meta)return;
      var s0=meta.querySelector('span');if(s0&&s0.lastChild&&s0.lastChild.nodeType===3){var m2=/^(\s*.+?)\(([^()]+)\)\s*$/.exec(s0.lastChild.nodeValue);if(m2)s0.lastChild.nodeValue=m2[1]+' '+m2[2];}
      [].forEach.call(meta.querySelectorAll('span'),function(sp){var n=sp.lastChild;if(n&&n.nodeType===3)n.nodeValue=n.nodeValue.replace(/\s*\((만\s*\d+세|age\s*\d+)\)\s*$/,'');});
      var sns=document.querySelector('.top2>.sns');if(!sns)return;
      var links=sns.querySelectorAll('a');
      // SNS 링크를 글자 알약 대신 공식 로고 아이콘으로(2026-11-20 사용자 "정적 페이지 sns 링크 다 아이콘으로"). 앱 카드(_LINK_DEFS)와 같은 그림.
      // 이름은 aria-label·title로 남긴다. 링크가 하나뿐이면 한 줄을 통째로 쓰지 않게 소속·생일 줄 끝에 붙인다.
      var IC={"youtube": "<svg viewBox=\"0 0 28.57 20\" role=\"img\" aria-label=\"YouTube\"><path fill=\"#FF0000\" d=\"M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 2.24288e-07 14.285 0 14.285 0C14.285 0 5.35042 2.24288e-07 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C2.24288e-07 5.35042 0 10 0 10C0 10 2.24288e-07 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5701 5.35042 27.9727 3.12324Z\"/><path fill=\"#FFFFFF\" d=\"M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z\"/></svg>", "instagram": "<svg viewBox=\"-1 -1 26 26\" role=\"img\" aria-label=\"Instagram\"><defs><radialGradient id=\"kpuIgG\" cx=\"0.3\" cy=\"1.07\" r=\"1.3\"><stop offset=\"0\" stop-color=\"#FFD600\"/><stop offset=\"0.25\" stop-color=\"#FF7A00\"/><stop offset=\"0.5\" stop-color=\"#FF0069\"/><stop offset=\"0.75\" stop-color=\"#D300C5\"/><stop offset=\"1\" stop-color=\"#7638FA\"/></radialGradient></defs><path fill=\"url(#kpuIgG)\" d=\"M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077\"/></svg>", "x": "<svg viewBox=\"-3 -3 30 30\" fill=\"#fff\" role=\"img\" aria-label=\"X\"><path d=\"M18.24 2.25h3.31L14.32 10.5l8.5 11.25H16.2l-4.72-6.23-5.4 6.23H2.75l7.73-8.84L2 2.25h6.06l4.26 5.63L18.24 2.25zm-1.16 17.52h1.83L7.08 4.13H5.12L17.08 19.77z\"/></svg>", "tiktok": "<svg viewBox=\"-3 -3 30 30\" role=\"img\" aria-label=\"TikTok\"><path fill=\"#25F4EE\" transform=\"translate(-0.9 -0.7)\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/><path fill=\"#FE2C55\" transform=\"translate(0.9 0.7)\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/><path fill=\"#fff\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/></svg>", "weverse": "<svg viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M12 21C6 17 2 13 2 9 2 6 4.5 4 7.5 4 9.5 4 11.2 5.8 12 7.5 12.8 5.8 14.5 4 16.5 4 19.5 4 22 6 22 9 22 13 18 17 12 21z\" stroke=\"currentColor\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/></svg>", "namu": "<svg viewBox=\"-2 -2 28 28\" role=\"img\" aria-label=\"나무위키\"><path fill=\"#00A495\" d=\"M12 0C5.3724 0 0 5.372 0 12c0 6.6278 5.3723 12 12 12 6.6278 0 12-5.3722 12-12 0-6.628-5.3722-12-12-12zM6.4902 5.9219c1.1467-.0082 2.0869.918 2.0957 2.0644.005.6836-.324 1.2912-.832 1.6739l1.7871 4.2207 2.959-1.252-.3848-.9082c-.0923.013-.1852.0228-.2812.0234-1.1466.0088-2.0868-.9182-2.0957-2.0644-.0087-1.1472.9177-2.085 2.0644-2.0938 1.1466-.0081 2.087.9168 2.0957 2.0625.0048.655-.2955 1.2423-.7675 1.627l1.125 2.6562 3.5293-1.496a2.0834 2.0834 0 0 1-.045-.4122c-.0085-1.147.9178-2.0868 2.0645-2.0957 1.1465-.0088 2.0851.9163 2.0937 2.0625.0085 1.1473-.9162 2.0879-2.0625 2.0957-.6053.0044-1.1519-.2535-1.5351-.664l-3.6133 1.5293.496 1.1738a.5542.5542 0 0 1-.2929.7266.5546.5546 0 0 1-.7265-.295l-1.2305-2.9082-4.8828 2.0664c.0112.0845.0189.1702.0195.2559.0085 1.147-.9178 2.0863-2.0644 2.0957-1.146.0081-2.0875-.9174-2.0957-2.0644-.0088-1.1465.9176-2.0861 2.0644-2.0957.6647-.005 1.258.3045 1.6426.789l.9043-.3828-1.7969-4.2441a1.9538 1.9538 0 0 1-.2012.0117c-1.1467.0092-2.087-.916-2.0957-2.0625-.0087-1.1462.9159-2.087 2.0625-2.0957zM6.5 7.1406c-.4749.0036-.8573.3933-.8535.8672.0035.475.3925.8572.8672.8535.474-.0031.8573-.3927.8535-.8672-.0037-.4745-.393-.8574-.8672-.8535zm5.3125 1.6621c-.4749.0043-.859.3928-.8555.8672.0033.4745.3932.8571.8672.8535.4749-.0034.859-.3908.8555-.8652-.0035-.4739-.393-.8585-.8672-.8555zm7.957 2.3438c-.4537.0267-.8137.4075-.8105.8672.0034.4743.3924.8565.8672.8535.474-.0036.8565-.3922.8535-.8672-.0044-.474-.393-.8567-.8672-.8535-.0148.0001-.0283-.0009-.043 0zM5.9844 15.125c-.4749.0049-.8576.393-.8535.8672a.8613.8613 0 0 0 .8652.8555c.4739-.0036.8568-.3935.8535-.8672-.0036-.474-.3911-.8586-.8652-.8555z\"/></svg>"};
      [].forEach.call(links,function(a){var k=(a.className.match(/sns-([a-z0-9]+)/)||[])[1],svg=IC[k];if(!svg)return;var nm=a.textContent;a.setAttribute('aria-label',nm);a.title=nm;a.className='kpu-sns-ic kpu-sns-'+k;a.innerHTML=svg;});
      sns.className+=' kpu-sns-row';
      if(links.length===1){var sp=document.createElement('span');sp.className='kpu-meta-link';sp.appendChild(links[0]);meta.appendChild(sp);sns.parentNode.removeChild(sns);}
    }catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',metaTidy);else metaTidy(); // 아래 주석은 다음 줄(fanBar)용
  // ── 직캠 목록 도구 줄(2026-11-20) — 다른 직캠 사이트·팬 후기 비교에서 가져온 세 가지 ─────────────
  // ①종류 구분: 같은 무대가 방송사마다 다른 이름으로 올라온다(입덕·MPD·안방1열·음중 = 전신/상반신, 페이스캠·얼빡·최애직캠 = 얼굴 위주, 보이스캠).
  //   팬은 이 이름으로 골라 보는데 목록은 섞여 있었다 → '전체 · 전신 · 얼굴 · 보이스' 글자 칩(있는 종류만).
  // ②정렬: 조회수순(기본) ↔ 최신순. ③랜덤 재생(직캠 사이트 moonpa의 랜덤 재생 방식 — 뭘 볼지 모를 때 한 번에).
  // 영상 카드가 8개 이상인 첫 목록에만. 테두리 없는 글자 버튼(TASTE). 재생성 없이 전 페이지 적용.
  function fanBar(){
    try{
      var grid=document.querySelector('.wrap>.mf-grid');if(!grid||grid.previousElementSibling&&grid.previousElementSibling.classList.contains('kpu-fbar'))return;
      var cards=[].slice.call(grid.querySelectorAll('a.mf-card[href*="youtube.com/watch"],a.mf-card[href*="youtu.be/"]'));if(cards.length<8)return;
      var en=/^en/i.test(document.documentElement.lang||'');
      var kindOf=function(s){s=s.toLowerCase();
        if(/보이스캠|voice ?cam/.test(s))return 'voice';
        if(/페이스캠|face ?cam|얼빡|최애직캠/.test(s))return 'face';
        if(/직캠|fan ?cam|focus ?cam|unfiltered cam|세로캠/.test(s))return 'full';
        return 'etc';};
      var dateOf=function(c){var m=/(\d{4})\.(\d{2})\.(\d{2})/.exec((c.querySelector('.mf-y')||{}).textContent||'');return m?+(m[1]+m[2]+m[3]):0;};
      cards.forEach(function(c,i){c._k=kindOf((c.querySelector('.mf-t')||c).textContent||'');c._i=i;c._d=dateOf(c);});
      var cnt={};cards.forEach(function(c){cnt[c._k]=(cnt[c._k]||0)+1;});
      var kinds=[['all',en?'All':'전체'],['full',en?'Full body':'전신'],['face',en?'Face':'얼굴'],['voice',en?'Voice':'보이스']].filter(function(k){return k[0]==='all'||cnt[k[0]]>=2;});
      var st=document.createElement('style');
      st.textContent='.kpu-fbar{display:flex;align-items:center;gap:4px 16px;flex-wrap:wrap;margin:0 0 12px;font-size:13.5px}'
        +'.kpu-fbar button{background:none;border:0;padding:6px 0;margin:0;font:inherit;color:rgba(160,180,230,.7);cursor:pointer;-webkit-tap-highlight-color:transparent}'
        +'.kpu-fbar button.on{color:#f1f4ff;font-weight:650}.kpu-fbar .sp{flex:1}.kpu-fbar .rnd{color:rgba(190,205,250,.9)}'
        +'.mf-card.kpu-hide{display:none}';
      document.head.appendChild(st);
      var bar=document.createElement('div');bar.className='kpu-fbar';
      var cur='all',byDate=false;
      var apply=function(){
        var arr=cards.slice().sort(function(x,y){return byDate?(y._d-x._d)||(x._i-y._i):x._i-y._i;});
        arr.forEach(function(c){c.classList.toggle('kpu-hide',cur!=='all'&&c._k!==cur);grid.appendChild(c);});
        [].forEach.call(bar.querySelectorAll('button[data-k]'),function(b){b.classList.toggle('on',b.getAttribute('data-k')===cur);});
        sortB.textContent=byDate?(en?'Newest':'최신순'):(en?'Most viewed':'조회수순');
      };
      if(kinds.length>2)kinds.forEach(function(k){var b=document.createElement('button');b.type='button';b.setAttribute('data-k',k[0]);b.textContent=k[1];
        b.addEventListener('click',function(){cur=k[0];apply();try{log('fbar_'+k[0]);}catch(e){}});bar.appendChild(b);});
      var sp=document.createElement('span');sp.className='sp';bar.appendChild(sp);
      var sortB=document.createElement('button');sortB.type='button';sortB.addEventListener('click',function(){byDate=!byDate;apply();try{log('fbar_sort');}catch(e){}});bar.appendChild(sortB);
      var rnd=document.createElement('button');rnd.type='button';rnd.className='rnd';rnd.textContent=en?'Shuffle':'랜덤 재생';
      rnd.addEventListener('click',function(){var vis=cards.filter(function(c){return !c.classList.contains('kpu-hide');});if(!vis.length)return;try{log('fbar_random');}catch(e){}vis[Math.floor(Math.random()*vis.length)].click();});
      bar.appendChild(rnd);
      grid.parentNode.insertBefore(bar,grid);apply();
    }catch(e){}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fanBar);else fanBar(); // 아주 좁은 폰(360)은 셋째 링크(모아보기)까지는 안 들어가 한 줄을 더 먹었다 — 그 폭에서만 뺀다
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
      // 경로 줄이 썸네일 위에 있는 새 배치(2026-11-19)면 넓은 화면에선 옆 칸으로 데려온다 — 웹 배치는 예전과 같게
      var pv=top.previousElementSibling;if(pv&&pv.matches&&pv.matches('.crumbs')&&window.matchMedia&&matchMedia('(min-width:1000px)').matches)side.appendChild(pv);
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
      '.kpu-heart{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:32px;height:32px;margin:-4px 0 0 8px;padding:0;border-radius:50%;border:none;background:none;color:rgba(230,235,250,.82);cursor:pointer;transition:background .15s,transform .15s}'
      +'.kpu-heart:hover{background:rgba(255,255,255,.08)}.kpu-heart svg{width:20px;height:20px}'
      +'.kpu-heart.on{color:#ff5c8a;background:none}.kpu-heart.on path{fill:currentColor}'
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
      // 멤버·직캠 모음 페이지는 멤버 단위(2026-11-18) — 이 페이지와 짝 언어 페이지 주소 키 + 앱 멤버 카드 키를 더한다(app.js _memberVisitKeys와 같은 키)
      var w,t;
      if(m){
        var mk=function(p){p=decodeURIComponent(String(p||'')).replace(/^\/en(?=\/)/,'');var x=p.split('/');if(x[1]==='g'&&x[3]&&['s','a','credits'].indexOf(x[3])<0)return 'g/'+x[2]+'/'+x[3];if(x[1]==='member'&&x[2])return 'member/'+x[2];return null;};
        var keys=['m:'+g+':'+m],k1=mk(location.pathname);if(k1)keys.push(k1);
        var alt=document.querySelector('link[rel="alternate"][hreflang="'+(EN?'ko':'en')+'"]');if(alt){try{var k2=mk(new URL(alt.href).pathname);if(k2&&keys.indexOf(k2)<0)keys.push(k2);}catch(e){}}
        var sum=function(o){return keys.reduce(function(a,k){return a+((o&&o[k])||0);},0);};
        w=sum(d.mw);t=sum(d.mt);
      }else{w=d.vw&&d.vw[g];t=d.vt&&d.vt[g];}
      // 이번 주·지금까지 중 하나만(2026-11-19 사용자 "둘 다 뜰 필요 없이 하나만", app.js _visitLine과 같은 규칙) — 주간 숫자가 있으면 주간, 없으면 누적
      if(w)met.push({t:'vis',s:EN?(f(w)+' visited this week'):('이번 주 '+f(w)+'명이 다녀갔어요')});
      else if(t)met.push({t:'vis',s:EN?(f(t)+' visited so far'):('지금까지 '+f(t)+'명이 다녀갔어요')});
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
  // ── 맨 위 한 줄 + 은은한 별가루(2026-11-18 사용자 "웹 기준 맨 윗줄에 한 줄 할애해서 활용"(The Pudding 공지 줄·무신사 앱 열기 줄 참고),
  // "정적 페이지 배경에 진짜 은은하게 우주처럼"). 줄: 사이트 전체가 살아 있다는 신호를 상태 줄과 같은 방식(맥박 점·4초 교체)으로 —
  // 이번 주 다녀간 사람·지금까지·이번 주 새로 모은 영상(get_live_stats.site, 봇 제외)·최근 업데이트 소식 제목(한국어만). 오른쪽 '우주 열기'.
  // 별가루: 움직임 없는 아주 흐린 점 무늬를 맨 위 360px에만, 아래로 갈수록 사라지게(글·영상 격자 뒤엔 없음 — 읽기 방해 금지).
  // 맨 위 한 줄(2026-11-18 사용자 재지정): 통계·소식 교체 멘트·'우주 열기' 버튼 다 빼고, 고정 멘트
  // "Find your place in K-pop."(유니버스 인트로 문구)만. 줄 전체가 유니버스로 가는 링크. 높이 2배(68px)·폰트 +1pt. 별가루는 유지.
  function topbar(){
    if(document.querySelector('.kpu-topbar'))return;
    var wrap=document.querySelector('.wrap');if(!wrap)return;
    var cta=document.querySelector('a.cta');var href=cta?cta.href:'https://kpop-universe.kr/';
    var st=document.createElement('style');
    st.textContent='.kpu-topbar{position:relative;z-index:6;display:flex;align-items:center;justify-content:center;gap:9px;height:45px;padding:0 16px;'
      +'background:rgba(16,16,24,.92);border-bottom:.5px solid rgba(150,175,255,.14);font-size:13.5px;font-weight:600;letter-spacing:.02em;color:#ccd8ee;text-decoration:none;cursor:pointer}'
      +'.kpu-topbar:hover{background:rgba(22,22,32,.96);color:#fff}'
      +'.kpu-topbar i{width:6px;height:6px;border-radius:50%;flex:none;background:rgb(170,160,255);box-shadow:0 0 5px rgba(170,160,255,.8);animation:kpu-pl 1.6s ease-in-out infinite}'
      +'@keyframes kpu-pl{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.72)}}'
      +'body::before{content:"";position:absolute;left:0;right:0;top:0;height:380px;pointer-events:none;z-index:0;opacity:.55;'
      +'background-image:radial-gradient(1px 1px at 12% 22%,rgba(255,255,255,.55),transparent 60%),radial-gradient(1px 1px at 31% 64%,rgba(200,215,255,.45),transparent 60%),'
      +'radial-gradient(1.2px 1.2px at 47% 18%,rgba(255,200,230,.5),transparent 60%),radial-gradient(1px 1px at 63% 48%,rgba(255,255,255,.4),transparent 60%),'
      +'radial-gradient(1px 1px at 78% 28%,rgba(200,215,255,.5),transparent 60%),radial-gradient(1.4px 1.4px at 88% 70%,rgba(255,255,255,.45),transparent 60%),'
      +'radial-gradient(1px 1px at 22% 84%,rgba(255,220,240,.35),transparent 60%),radial-gradient(1px 1px at 55% 88%,rgba(200,215,255,.35),transparent 60%);'
      +'background-size:420px 380px;-webkit-mask-image:linear-gradient(#000,transparent);mask-image:linear-gradient(#000,transparent)}'
      +'body{position:relative}.wrap{position:relative;z-index:1}'
      +'@media(max-width:700px){.kpu-topbar{font-size:13px;height:40px}}' // 높이를 3분의 2로(2026-11-19 사용자 — 68→45, 폰 60→40. 웹도 같이)
      +'@media (prefers-reduced-motion:reduce){.kpu-topbar i{animation:none}}';
    document.head.appendChild(st);
    var bar=document.createElement('a');bar.className='kpu-topbar';bar.href=href;
    var i=document.createElement('i');bar.appendChild(i);
    bar.appendChild(document.createTextNode('Find your place in K-pop'));
    document.body.insertBefore(bar,document.body.firstChild);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',topbar);else topbar();




  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  // 제목은 제목 칸(.card-t 등)만 — a.textContent를 통째로 쓰면 날짜·조회수(.card-y)까지 한 덩어리로 붙어
  // "…MBC2504262025.04.28 · 조회수 4만회"처럼 보이고, 긴 통짜 토큰이 그리드 칸까지 밀었다(2026-11-16).
  function titleOf(a){var t=(a.getAttribute('title')||'').trim();if(t)return t;
    // 맨 위 대표 영상(.hero)은 안에 페이지 제목(h1)과 부제가 붙어 있어 통째로 읽으면 '…직캠코르티스(CORTIS) · 직캠 5개'처럼 한 덩어리가 됐다(2026-11-19 발견) — 그림의 alt(실제 영상 제목)를 쓴다
    if(a.classList&&a.classList.contains('hero')){var hi=a.querySelector('img');if(hi&&hi.alt)return hi.alt.trim().slice(0,140);var hh=a.querySelector('h1');if(hh)return hh.textContent.replace(/\s+/g,' ').trim().slice(0,140);}
    var x=a.querySelector('.card-t,.mf-t,.t,.title,b,strong');t=((x&&x.textContent)||'').replace(/\s+/g,' ').trim();if(!t)t=(a.textContent||'').replace(/\s+/g,' ').trim();if(!t){var im=a.querySelector('img');t=im&&im.alt||'';}return t.slice(0,140);}
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
      var x=ov.querySelector('.kpu-pl-x');x.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';x.setAttribute('aria-label',T.back);x.onclick=function(){close();};
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
        _bk.setAttribute('style','display:inline-block;vertical-align:middle;margin:-2px 4px 0 -6px;padding:0 6px;font-size:19px;line-height:20px;color:rgba(150,175,255,0.75);text-decoration:none;'); // 2026-11-19: 아래 여백 8px을 없애고 좁혀 브랜드·언어 링크와 같은 줄에 선다(예전엔 ‹ 혼자 한 줄 + 언어 버튼 한 줄 + 브랜드 한 줄 = 세 줄)
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
