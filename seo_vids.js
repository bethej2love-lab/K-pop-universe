// 곡·멤버×곡 정적 페이지 영상 목록 — 정렬(인기순·최신순·날짜순) + 더 보기 (2026-11-17 사용자: "상위 30개만 보여주는데 더 보기, 앱 카드처럼 정렬")
// 왜 따로 파일: 4만 장 페이지가 같은 파일을 불러 쓰고(고칠 때 다시 안 만들어도 됨), seo_play.js(모든 정적 페이지 공용)를 안 건드리려고.
// 데이터: 페이지 안 <script type="application/json" id="kpu-vids"> = [[영상id, 제목, 'yyyy-mm-dd', 조회수], …] (인기순 정렬 상태).
// 검색엔진은 예전처럼 HTML에 있는 인기순 상위 30개만 본다. 카드 모양은 빌더(build_group_pages.js)의 .card 와 같게 — 클릭은 seo_play.js 가
// 문서 전체 위임으로 처리하니 새로 그린 카드도 페이지 안 재생이 된다.
(function(){
  'use strict';
  var jEl=document.getElementById('kpu-vids'),grid=document.getElementById('kpu-grid'),bar=document.getElementById('kpu-sortbar');
  if(!jEl||!grid||!bar)return;
  var data;try{data=JSON.parse(jEl.textContent);}catch(e){return;}
  if(!data||data.length<2)return;
  var EN=/^\/en\//.test(location.pathname)||document.documentElement.lang==='en';
  var L=EN?{pop:'Most viewed',nw:'Newest',old:'Oldest',more:'Show more',left:' left',all:'All',full:'Full body',face:'Face',voice:'Voice',rnd:'Shuffle'}:{pop:'조회수순',nw:'최신순',old:'날짜순',more:'더 보기',left:'개 남음',all:'전체',full:'전신',face:'얼굴',voice:'보이스',rnd:'랜덤 재생'};
  var STEP=30,sort='pop',shown=STEP,touched=false,kind='all';
  // 직캠 종류(2026-11-20) — 그룹·멤버 페이지 도구 줄(seo_play.js fanBar)과 같은 분류·같은 모양. 방송사마다 이름이 달라 팬이 골라 보기 어렵던 것을 세 묶음으로.
  function kindOf(s){s=String(s||'').toLowerCase();
    if(/보이스캠|voice ?cam/.test(s))return 'voice';
    if(/페이스캠|face ?cam|얼빡|최애직캠/.test(s))return 'face';
    if(/직캠|fan ?cam|focus ?cam|unfiltered cam|세로캠/.test(s))return 'full';
    return 'etc';}
  function ga(n,p){try{if(typeof gtag==='function')gtag('event',n,p||{});}catch(e){}}
  function f1(x){var v=Math.floor(x*10+1e-9)/10;return v%1===0?String(v):v.toFixed(1);}
  function views(n){n=+n||0;if(!n)return '';if(n>=1e6)return Math.floor(n/1e6)+'M+';if(n>=1e3)return Math.floor(n/1e3)+'K+';if(n>=100)return Math.floor(n/100)*100+'+';return '<100';} // 앱 _fmtVC와 같게
  function dot(d){return d?String(d).slice(0,10).split('-').join('.'):'';}
  // 영상 제목 끝 유튜브 채널 꼬리 " | @핸들_날짜" 제거(SSR seo_extra.js cleanVidTitle과 같은 규칙) — @ 있는 꼬리만
  function cleanT(t){t=String(t==null?'':t);return t.replace(/\s*[|｜ㅣ]\s*@\S+\s*$/,'').trim()||t;}
  function sorted(){
    var a=kind==='all'?data.slice():data.filter(function(v){return kindOf(v[1])===kind;});
    if(sort==='nw')a.sort(function(x,y){return String(y[2]||'').localeCompare(String(x[2]||''))||(y[3]||0)-(x[3]||0);});
    else if(sort==='old')a.sort(function(x,y){return String(x[2]||'9999').localeCompare(String(y[2]||'9999'))||(y[3]||0)-(x[3]||0);});
    else a.sort(function(x,y){return (y[3]||0)-(x[3]||0);});
    return a;
  }
  function card(v){
    var a=document.createElement('a');a.className='card';a.href='https://www.youtube.com/watch?v='+v[0];a.target='_blank';a.rel='noopener';
    var th=document.createElement('span');th.className='card-th';var im=document.createElement('img');im.src='https://i.ytimg.com/vi/'+v[0]+'/mqdefault.jpg';im.alt='';im.loading='lazy';th.appendChild(im);
    var t=document.createElement('span');t.className='card-t';t.textContent=cleanT(v[1]||'');
    var y=document.createElement('span');y.className='card-y';y.textContent=[dot(v[2]),views(v[3])].filter(Boolean).join(' · ');
    a.appendChild(th);a.appendChild(t);a.appendChild(y);return a;
  }
  var more=document.createElement('button');more.type='button';more.className='kpu-more';
  grid.parentNode.insertBefore(more,grid.nextSibling);
  var chips={};
  // 위 제목(h2) — 정렬에 맞춰 '조회수 많은'만 바꾼다(최신순→'최신', 날짜순→'오래된', 영문 Most viewed→Newest/Oldest)
  var h2=bar.previousElementSibling;while(h2&&h2.tagName!=='H2')h2=h2.previousElementSibling;
  var h0=h2?h2.textContent:'';
  // 한국어 '날짜순'은 '오래된'이라 부르지 않는다(사용자 11-17: 유튜브도 날짜순) — 제목에서 '조회수 많은 '만 뗀다. 영문은 앱 라벨(Oldest)과 같게.
  var HW=EN?{pop:'Most viewed',nw:'Newest',old:'Oldest'}:{pop:'조회수 많은',nw:'최신',old:''};
  function setHead(){if(!h2||h0.indexOf(HW.pop+' ')<0)return;h2.textContent=sort==='pop'?h0:h0.split(HW.pop+' ').join(HW[sort]?HW[sort]+' ':'');}
  // 도구 줄: 왼쪽 종류(있는 것만) · 오른쪽 정렬(누를 때마다 조회수순→최신순→날짜순)·랜덤 재생. 테두리 없는 글자 버튼(예전 알약 3개를 대체).
  if(!document.getElementById('kpu-fbar-css')){var st=document.createElement('style');st.id='kpu-fbar-css';
    st.textContent='.kpu-fbar{display:flex;align-items:center;gap:4px 16px;flex-wrap:wrap;margin:0 0 12px;font-size:13.5px}'
      +'.kpu-fbar button{background:none;border:0;border-radius:0;padding:6px 0;margin:0;height:auto;font:inherit;color:rgba(160,180,230,.7);cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}'
      +'.kpu-fbar button.on{color:#f1f4ff;font-weight:650;background:none;border:0}.kpu-fbar .rt{margin-left:auto;display:flex;align-items:center;gap:16px}.kpu-fbar .rnd{color:rgba(190,205,250,.9)}'
      +'@media(max-width:430px){.kpu-fbar{gap:4px 12px;font-size:13px}.kpu-fbar .rt{gap:12px}}';
    document.head.appendChild(st);}
  bar.className='kpu-fbar';
  var cnt={};data.forEach(function(v){var k=kindOf(v[1]);cnt[k]=(cnt[k]||0)+1;});
  var kinds=[['all',L.all],['full',L.full],['face',L.face],['voice',L.voice]].filter(function(k){return k[0]==='all'||cnt[k[0]]>=2;});
  if(kinds.length>2)kinds.forEach(function(k){var b=document.createElement('button');b.type='button';b.textContent=k[1];b.setAttribute('data-k',k[0]);
    b.addEventListener('click',function(){if(kind===k[0])return;kind=k[0];shown=STEP;touched=true;ga('seo_vid_kind',{kind:kind,n:data.length});render();});
    bar.appendChild(b);chips[k[0]]=b;});
  var rt=document.createElement('span');rt.className='rt';bar.appendChild(rt);
  var ORDER=['pop','nw','old'];
  var sortB=document.createElement('button');sortB.type='button';
  sortB.addEventListener('click',function(){sort=ORDER[(ORDER.indexOf(sort)+1)%3];shown=STEP;touched=true;ga('seo_vid_sort',{kind:sort,n:data.length});render();});
  rt.appendChild(sortB);
  var rnd=document.createElement('button');rnd.type='button';rnd.className='rnd';rnd.textContent=L.rnd;
  rnd.addEventListener('click',function(){var list=sorted();if(!list.length)return;var i=Math.floor(Math.random()*list.length),id=list[i][0];
    ga('seo_vid_random',{n:list.length});
    var a=grid.querySelector('a[href*="'+id+'"]')||document.querySelector('a[href*="'+id+'"]');
    if(!a){shown=Math.max(shown,i+2);touched=true;render();a=grid.querySelector('a[href*="'+id+'"]');}
    if(a)a.click();});
  rt.appendChild(rnd);
  more.addEventListener('click',function(){shown+=STEP;touched=true;ga('seo_vid_more',{kind:sort,shown:shown,n:data.length});render();});
  function render(){
    var list=sorted();
    // 인기순 첫 영상은 위 대표 영상(hero)에 이미 있다 — 처음 모양 그대로 2번째부터. 다른 정렬은 전부.
    var skipHero=sort==='pop'&&kind==='all';
    var from=skipHero?1:0,to=Math.min(list.length,from+shown-(skipHero?1:0));
    var frag=document.createDocumentFragment();
    for(var i=from;i<to;i++)frag.appendChild(card(list[i]));
    grid.textContent='';grid.appendChild(frag);
    if(window.kpuRelDates)window.kpuRelDates(grid);
    Object.keys(chips).forEach(function(k){chips[k].className=k===kind?'on':'';chips[k].setAttribute('aria-pressed',k===kind?'true':'false');});
    sortB.textContent=L[sort];
    setHead();
    var left=list.length-to;
    more.style.display=left>0?'':'none';more.textContent=L.more+' ('+left+(EN?L.left:L.left)+')';
    var note=document.getElementById('kpu-vnote');if(note)note.style.display='none';
  }
  // 처음엔 서버가 그려 준 카드를 그대로 두고(깜빡임 없음), 버튼 상태만 맞춘다.
  var initialLeft=data.length-STEP;
  Object.keys(chips).forEach(function(k){chips[k].className=k===kind?'on':'';chips[k].setAttribute('aria-pressed',k===kind?'true':'false');});
  sortB.textContent=L[sort];
  if(initialLeft>0){more.style.display='';more.textContent=L.more+' ('+initialLeft+L.left+')';var n0=document.getElementById('kpu-vnote');if(n0)n0.style.display='none';}else more.style.display='none';
  // 영상이 적은 곡(6개 미만)은 도구 줄 없이 목록만 — 버튼이 내용보다 많아 보이지 않게
  bar.style.display=data.length>=6?'':'none';
})();
