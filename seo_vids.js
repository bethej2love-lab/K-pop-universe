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
  var L=EN?{pop:'Most viewed',nw:'Newest',old:'Oldest',more:'Show more',left:' left'}:{pop:'인기순',nw:'최신순',old:'날짜순',more:'더 보기',left:'개 남음'};
  var STEP=30,sort='pop',shown=STEP,touched=false;
  function ga(n,p){try{if(typeof gtag==='function')gtag('event',n,p||{});}catch(e){}}
  function f1(x){var v=Math.floor(x*10+1e-9)/10;return v%1===0?String(v):v.toFixed(1);}
  function views(n){n=+n||0;if(!n)return '';if(n>=1e6)return Math.floor(n/1e6)+'M+';if(n>=1e3)return Math.floor(n/1e3)+'K+';if(n>=100)return Math.floor(n/100)*100+'+';return '<100';} // 앱 _fmtVC와 같게
  function dot(d){return d?String(d).slice(0,10).split('-').join('.'):'';}
  function sorted(){
    var a=data.slice();
    if(sort==='nw')a.sort(function(x,y){return String(y[2]||'').localeCompare(String(x[2]||''))||(y[3]||0)-(x[3]||0);});
    else if(sort==='old')a.sort(function(x,y){return String(x[2]||'9999').localeCompare(String(y[2]||'9999'))||(y[3]||0)-(x[3]||0);});
    else a.sort(function(x,y){return (y[3]||0)-(x[3]||0);});
    return a;
  }
  function card(v){
    var a=document.createElement('a');a.className='card';a.href='https://www.youtube.com/watch?v='+v[0];a.target='_blank';a.rel='noopener';
    var th=document.createElement('span');th.className='card-th';var im=document.createElement('img');im.src='https://i.ytimg.com/vi/'+v[0]+'/mqdefault.jpg';im.alt='';im.loading='lazy';th.appendChild(im);
    var t=document.createElement('span');t.className='card-t';t.textContent=v[1]||'';
    var y=document.createElement('span');y.className='card-y';y.textContent=[dot(v[2]),views(v[3])].filter(Boolean).join(' · ');
    a.appendChild(th);a.appendChild(t);a.appendChild(y);return a;
  }
  var more=document.createElement('button');more.type='button';more.className='kpu-more';
  grid.parentNode.insertBefore(more,grid.nextSibling);
  var chips={};
  [['pop',L.pop],['nw',L.nw],['old',L.old]].forEach(function(p){
    var b=document.createElement('button');b.type='button';b.textContent=p[1];b.setAttribute('data-s',p[0]);
    b.addEventListener('click',function(){if(sort===p[0])return;sort=p[0];shown=STEP;touched=true;ga('seo_vid_sort',{kind:sort,n:data.length});render();});
    bar.appendChild(b);chips[p[0]]=b;
  });
  more.addEventListener('click',function(){shown+=STEP;touched=true;ga('seo_vid_more',{kind:sort,shown:shown,n:data.length});render();});
  function render(){
    var list=sorted();
    // 인기순 첫 영상은 위 대표 영상(hero)에 이미 있다 — 처음 모양 그대로 2번째부터. 다른 정렬은 전부.
    var from=sort==='pop'?1:0,to=Math.min(list.length,from+shown-(sort==='pop'?1:0));
    var frag=document.createDocumentFragment();
    for(var i=from;i<to;i++)frag.appendChild(card(list[i]));
    grid.textContent='';grid.appendChild(frag);
    if(window.kpuRelDates)window.kpuRelDates(grid);
    Object.keys(chips).forEach(function(k){chips[k].className=k===sort?'on':'';chips[k].setAttribute('aria-pressed',k===sort?'true':'false');});
    var left=list.length-to;
    more.style.display=left>0?'':'none';more.textContent=L.more+' ('+left+(EN?L.left:L.left)+')';
    var note=document.getElementById('kpu-vnote');if(note)note.style.display='none';
  }
  // 처음엔 서버가 그려 준 카드를 그대로 두고(깜빡임 없음), 버튼 상태만 맞춘다.
  var initialLeft=data.length-STEP;
  Object.keys(chips).forEach(function(k){chips[k].className=k===sort?'on':'';chips[k].setAttribute('aria-pressed',k==='pop'?'true':'false');});
  if(initialLeft>0){more.style.display='';more.textContent=L.more+' ('+initialLeft+L.left+')';var n0=document.getElementById('kpu-vnote');if(n0)n0.style.display='none';}else more.style.display='none';
  bar.style.display='';
})();
