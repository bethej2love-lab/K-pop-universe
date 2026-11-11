// 정적(검색 착지) 페이지 영상 페이지 안 재생(2026-11-04).
// 왜: 검색·챗지피티로 들어온 사람이 직캠 카드를 누르면 유튜브 새 탭으로 나가 GA에 "1분 내 이탈"로 잡혔다(페이지당 유튜브 링크 ~27개, 남는 길은 앱 버튼 하나).
// 이제 유튜브 링크를 누르면 이 페이지 위에서 공식 임베드로 재생하고, 아래에 같은 페이지의 다음 영상 6개 + 앱으로 가는 버튼을 둔다.
// 링크 자체(href)는 그대로라 검색엔진·자바스크립트 꺼진 환경·새 탭 열기(ctrl/⌘/가운데 클릭)는 예전처럼 유튜브로 간다.
// 이 파일은 모든 정적 페이지가 /seo_play.js로 불러온다 — 고칠 때 4만 장을 다시 만들 필요가 없다.
(function(){
  'use strict';
  if(window.__kpuPlay)return;window.__kpuPlay=1;
  var EN=/^\/en\//.test(location.pathname)||document.documentElement.lang==='en';
  var T=EN?{close:'Close',next:'Up next',app:'See more in the app',nxK:'Explore',nxS:'Profile · fancams · stages',yt:'Watch on YouTube'}:{close:'닫기',next:'다음 영상',app:'앱에서 더 보기',nxK:'더 둘러보기',nxS:'프로필 · 직캠 · 무대',yt:'유튜브에서 보기'};
  var RE=/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
  function vidOf(a){var m=RE.exec(a&&a.getAttribute('href')||'');return m?m[1]:null;}
  function isShort(a){return /\/shorts\//.test(a.getAttribute('href')||'');}
  function ga(n,p){try{if(typeof gtag==='function')gtag('event',n,p||{});}catch(e){}
    var m={seo_play:'play',seo_play_cta:'to_app',seo_play_youtube:'yt'}[n];if(m)log(m);}
  // ── 우리 쪽 전환 기록(2026-11-10) — GA는 우리가 못 읽어서 정적 페이지 → 앱 흐름을 Supabase seo_events에도 남긴다.
  // land(페이지 열림)·play(페이지 안 재생)·cta·to_app(앱으로 가는 클릭)·yt(유튜브로 나감). 자동 접속(헤드리스·봇)은 안 센다(GA 차단과 같은 기준).
  // did는 이 기기 무작위 ID — 사람 수를 세려는 것뿐, 앱 계정과 잇지 않는다. 실패해도 페이지 동작엔 영향 없음.
  var BOT=(function(){try{return !!navigator.webdriver||/headless|bot|crawl|spider|lighthouse|playwright|puppeteer/i.test(navigator.userAgent||'');}catch(e){return true;}})();
  var DID=(function(){try{var d=localStorage.getItem('kpu_seo_did');if(!d){d=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('kpu_seo_did',d);}return d;}catch(e){return '';}})();
  var SRC=(function(){try{var u=new URLSearchParams(location.search).get('utm_source');if(u)return u;var h=document.referrer?new URL(document.referrer).hostname.replace(/^www\./,''):'';return h&&!/kpop-universe\.kr$/.test(h)?h:'';}catch(e){return '';}})();
  var PTYPE=(function(){var p=location.pathname.split('/').filter(Boolean);if(p[0]==='en')p.shift();if(p[0]!=='g')return p[0]?'other':'group_list';if(p.indexOf('fancams')>0)return 'fancams';if(p.indexOf('s')>0)return 'song';if(p.indexOf('a')>0)return 'album';if(p.indexOf('credits')>0)return 'credits';return p.length>=3?'member':'group';})();
  function log(ev){if(BOT)return;try{fetch('https://dukgguehegnembimqvkm.supabase.co/rest/v1/rpc/log_seo_event',{method:'POST',keepalive:true,
    headers:{'Content-Type':'application/json',apikey:'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0',Authorization:'Bearer sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'},
    body:JSON.stringify({p_ev:ev,p_type:PTYPE,p_path:decodeURIComponent(location.pathname).slice(0,200),p_src:SRC,p_did:DID})}).catch(function(){});}catch(e){}}
  log('land');
  // 앱으로 가는 링크(사이트 첫 화면·#해시 딥링크) 클릭 — 상단 CTA 버튼 포함
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a||(a.closest&&a.closest('.kpu-pl')))return;
    try{var u=new URL(a.href,location.href);if(/kpop-universe\.kr$/.test(u.hostname)&&(u.pathname==='/'||u.pathname==='/index.html'))log(a.classList.contains('cta')?'cta':'to_app');}catch(_){}},true);
  var entity=((document.querySelector('h1')||{}).textContent||'').trim();
  var css='.kpu-pl{position:fixed;inset:0;z-index:2147483000;background:#05070f;display:flex;justify-content:center;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}'
    +'.kpu-pl-in{width:100%;max-width:760px;padding:56px 16px 32px;box-sizing:border-box}'
    +'.kpu-pl-x{position:fixed;top:12px;right:12px;width:40px;height:40px;border-radius:20px;border:1px solid rgba(255,255,255,.18);background:rgba(20,24,44,.85);color:#fff;font-size:20px;line-height:38px;text-align:center;cursor:pointer;z-index:2}'
    +'.kpu-pl-v{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}'
    +'.kpu-pl-v.sh{aspect-ratio:9/16;max-width:min(100%,calc((100vh - 120px)*9/16));margin:0 auto}'
    +'.kpu-pl-v iframe{position:absolute;inset:0;width:100%;height:100%;border:0}'
    +'.kpu-pl-t{color:#eef2ff;font-size:15px;font-weight:600;line-height:1.4;margin:12px 2px 4px;word-break:keep-all}'
    +'.kpu-pl-yt{display:inline-block;color:rgba(170,190,235,.8);font-size:12.5px;text-decoration:none;margin:0 2px 14px}'
    // '이어서' 카드 — 폰은 가로로 넘기고, 넓은 화면은 칸을 나눠 한 줄에 여럿(빌더가 실은 #kpu-next: 케미·곡 → 앱의 그 화면)
    +'.kpu-pl-nx{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;margin:2px -16px 22px;padding:0 16px}.kpu-pl-nx::-webkit-scrollbar{display:none}'
    +'@media(min-width:640px){.kpu-pl-nx{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;margin:2px 0 22px;padding:0}.kpu-pl-n:nth-child(n+4){display:none}}'
    +'.kpu-pl-n{flex:0 0 252px;box-sizing:border-box;display:flex;align-items:center;gap:11px;min-width:0;padding:8px 12px 8px 8px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);text-decoration:none;transition:background .15s,border-color .15s}'
    +'.kpu-pl-n:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.18)}'
    +'.kpu-pl-n img{width:68px;height:42px;border-radius:9px;object-fit:cover;flex:none;background:#141a30}'
    +'.kpu-pl-n i{display:block;font-style:normal;min-width:0;flex:1}'
    +'.kpu-pl-n .k{display:block;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:rgba(165,185,240,.65)}'
    +'.kpu-pl-n .t{display:block;font-size:13.5px;font-weight:650;color:#f1f4ff;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.kpu-pl-n .s{display:block;font-size:11.5px;color:rgba(190,205,240,.58);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.kpu-pl-n b{font-weight:400;color:rgba(200,212,245,.45);font-size:17px;flex:none}'
    +'.kpu-pl-h{color:rgba(190,205,240,.75);font-size:12px;font-weight:700;letter-spacing:.08em;margin:6px 2px 10px}'
    +'.kpu-pl-g{display:grid;grid-template-columns:1fr 1fr;gap:12px}'
    +'.kpu-pl-c{display:block;text-decoration:none;color:#dfe6ff;font-size:12.5px;line-height:1.35;cursor:pointer}'
    +'.kpu-pl-c img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;background:#141a30}'
    +'.kpu-pl-c span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-top:6px}'
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
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  function titleOf(a){var t=(a.getAttribute('title')||'').trim();if(t)return t;var x=a.querySelector('.mf-t,.title,b,strong');t=((x&&x.textContent)||a.textContent||'').replace(/\s+/g,' ').trim();if(!t){var im=a.querySelector('img');t=im&&im.alt||'';}return t.slice(0,140);}
  function allLinks(){var seen={},out=[];[].forEach.call(document.querySelectorAll('a[href]'),function(a){if(a.closest&&a.closest('.kpu-pl'))return;var v=vidOf(a);if(!v||seen[v])return;seen[v]=1;out.push({v:v,a:a,t:titleOf(a),sh:isShort(a)});});return out;}
  var ov=null,cur=-1,list=[];
  function close(fromPop){if(!ov)return;ov.remove();ov=null;document.documentElement.classList.remove('kpu-pl-open');if(!fromPop&&history.state&&history.state.kpuPlay)history.back();}
  function render(i){
    cur=i;var it=list[i];if(!it)return;
    var box=ov.querySelector('.kpu-pl-v');box.className='kpu-pl-v'+(it.sh?' sh':'');
    box.innerHTML='<iframe src="https://www.youtube-nocookie.com/embed/'+it.v+'?autoplay=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title=""></iframe>';
    box.querySelector('iframe').title=it.t;
    ov.querySelector('.kpu-pl-t').textContent=it.t;
    var yt=ov.querySelector('.kpu-pl-yt');yt.href=it.a.getAttribute('href');
    renderNext(it);
    var g=ov.querySelector('.kpu-pl-g');g.innerHTML='';
    for(var k=1,n=0;k<list.length&&n<6;k++){var j=(i+k)%list.length,x=list[j];if(j===i)continue;n++;
      var c=document.createElement('a');c.className='kpu-pl-c';c.href=x.a.getAttribute('href');c.setAttribute('data-i',j);
      var im=document.createElement('img');im.loading='lazy';im.alt='';im.src='https://i.ytimg.com/vi/'+x.v+'/mqdefault.jpg';
      var sp=document.createElement('span');sp.textContent=x.t;c.appendChild(im);c.appendChild(sp);g.appendChild(c);}
    ov.scrollTop=0;
  }
  // '이어서' 항목: 빌더가 실은 #kpu-next(멤버 페이지) — 없으면 페이지의 하단 버튼 주소로 카드 하나
  var NX=null;
  function nextItems(){
    if(NX)return NX;
    try{var j=document.getElementById('kpu-next');NX=j?JSON.parse(j.textContent):[];}catch(e){NX=[];}
    if(!NX.length){var cta=document.querySelector('.cta');var og=document.querySelector('meta[property="og:image"]');
      NX=[{k:T.nxK,t:entity,s:T.nxS,h:cta?cta.getAttribute('href'):'https://kpop-universe.kr/',im:og?og.getAttribute('content'):''}];}
    return NX;
  }
  function norm(x){return String(x||'').toLowerCase().split(' ').join('');}
  function renderNext(it){
    var box=ov.querySelector('.kpu-pl-nx');box.innerHTML='';
    var items=nextItems().slice(),tt=norm(it&&it.t);
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
      ov.innerHTML='<button class="kpu-pl-x" type="button"></button><div class="kpu-pl-in"><div class="kpu-pl-v"></div><div class="kpu-pl-t"></div><a class="kpu-pl-yt" target="_blank" rel="noopener"></a><div class="kpu-pl-nx"></div><div class="kpu-pl-h"></div><div class="kpu-pl-g"></div></div>';
      var x=ov.querySelector('.kpu-pl-x');x.textContent='✕';x.setAttribute('aria-label',T.close);x.onclick=function(){close();};
      ov.querySelector('.kpu-pl-yt').textContent=T.yt+' ↗';
      ov.querySelector('.kpu-pl-h').textContent=T.next;
      ov.querySelector('.kpu-pl-nx').onclick=function(e){var n=e.target.closest&&e.target.closest('.kpu-pl-n');if(n)ga('seo_play_cta',{entity_name:entity,video_id:list[cur]&&list[cur].v,kind:n.getAttribute('data-k')||''});};
      ov.querySelector('.kpu-pl-yt').onclick=function(){ga('seo_play_youtube',{entity_name:entity,video_id:list[cur]&&list[cur].v});};
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
})();
