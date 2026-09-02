// 영상관리 패널 "받는 대로 그리기" + 영속 캐시 회귀 테스트 (2026-09-02 신설)
//
// 배경: 숨김 탭이 statement_timeout으로 아예 안 열렸고(→ content_flag 인덱스로 해결), 그와 별개로
// "매번 전량 재조회 + 다 받아야 한 번에 뜸"이 불편하다는 제보. _sbFetchAll에 페이지 도착 훅(onPage)을
// 달고, _vmProgressive가 그 훅에서 목록을 다시 그린다.
//
// ⚠️ 이 파일은 **실제 함수를 실행**해서 검증한다. 같은 종류의 검증을 소스 문자열 정규식으로 했다가
//    "가드 문구는 있는데 동작은 안 하는" 상태를 세 번 통과시킨 전례가 있다(matching.test.js 하단 주석).
//
// 실행: node tests/vm-progressive.test.js

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','admin.js'),'utf8');

function slice(re,label){
  const m=re.exec(src);
  if(!m)throw new Error(`선언을 못 찾음: ${label}`);
  let i=src.indexOf('{',m.index),depth=0;
  for(;i<src.length;i++){
    if(src[i]==='{')depth++;
    else if(src[i]==='}'){depth--;if(depth===0){i++;break;}}
  }
  return src.slice(m.index,i);
}

let pass=0,fail=0;
const ok=m=>{pass++;console.log(`✅ ${m}`);};
const bad=(m,d)=>{fail++;console.log(`❌ ${m}`);if(d)console.log('   '+d);};
const need=(c,m,d)=>c?ok(m):bad(m,d);

// ── 준비: 가짜 DOM/전역 위에서 실제 함수를 돌린다 ─────────────────────────────
const els={};
const mkEl=id=>(els[id]=els[id]||{id,textContent:'',scrollTop:0,children:[],appendChild(c){this.children.push(c);}});
let renderCount=0,renderedLens=[];
let checkedBox=null;
const ctx={
  console,setTimeout,clearTimeout,
  document:{
    getElementById:id=>mkEl(id),
    querySelector:sel=>(sel.includes('checkbox')?checkedBox:null),
  },
  _vmSearchGen:1,
  _vmRows:[],
  _vmRenderVideoList(){renderCount++;renderedLens.push(ctx._vmRows.length);},
};
vm.createContext(ctx);
vm.runInContext(slice(/async function _sbFetchAll\(/,'_sbFetchAll'),ctx);
vm.runInContext(slice(/function _vmProgressive\(/,'_vmProgressive'),ctx);
need(typeof ctx._sbFetchAll==='function','_sbFetchAll 로드됨');
need(typeof ctx._vmProgressive==='function','_vmProgressive 로드됨');

// 가짜 PostgREST 쿼리 빌더 — .limit()/.gt()를 체이닝하고 await하면 페이지를 돌려준다.
function makeTable(total,pageSize){
  const all=Array.from({length:total},(_,i)=>({id:'v'+String(i).padStart(5,'0')}));
  let calls=0;
  const build=()=>{
    let lim=1000,cur=null;
    const q={
      limit(n){lim=n;return q;},
      gt(_c,v){cur=v;return q;},
      then(res){
        calls++;
        const start=cur===null?0:all.findIndex(r=>r.id===cur)+1;
        res({data:all.slice(start,start+Math.min(lim,pageSize)),error:null});
      },
    };
    return q;
  };
  build.calls=()=>calls;
  build.all=all;
  return build;
}

(async()=>{
  // ① onPage 없이 부르면 예전과 똑같이 전량을 모아 돌려준다(기존 호출부 무수정 보장)
  {
    const t=makeTable(2500,1000);
    const{data,error}=await ctx._sbFetchAll(t,1000);
    need(!error&&data.length===2500,'onPage 없이 호출 — 전량 2,500행 수집(하위호환)',`받은 행=${data&&data.length}`);
  }

  // ② onPage를 넘기면 페이지마다 (그 페이지, 누적)으로 불린다
  {
    const t=makeTable(2500,1000);
    const seen=[];
    const{data}=await ctx._sbFetchAll(t,1000,(page,acc)=>{seen.push([page.length,acc.length]);});
    need(seen.length===3,`페이지마다 onPage 호출 — 3회`,`실제=${seen.length}`);
    need(JSON.stringify(seen)==='[[1000,1000],[1000,2000],[500,2500]]',
      'onPage 인자가 (이번 페이지, 누적)으로 정확',JSON.stringify(seen));
    need(data.length===2500,'onPage를 써도 최종 반환은 전량 그대로');
  }

  // ③ onPage가 false를 돌려주면 즉시 중단한다(탭 이동 등)
  {
    const t=makeTable(5000,1000);
    const{data,aborted}=await ctx._sbFetchAll(t,1000,(p,acc)=>acc.length<2000);
    need(aborted===true&&data.length===2000,'onPage가 false면 조기 중단',`aborted=${aborted} rows=${data&&data.length}`);
    need(t.calls()===2,'중단 후 추가 요청 없음',`요청수=${t.calls()}`);
  }

  // ④ onPage에서 예외가 나도 조회는 계속된다(그리기 실패가 데이터 수집을 죽이면 안 됨)
  {
    const t=makeTable(2500,1000);
    const origErr=console.error;console.error=()=>{};
    const{data,error}=await ctx._sbFetchAll(t,1000,()=>{throw new Error('렌더 실패');});
    console.error=origErr;
    need(!error&&data.length===2500,'onPage 예외가 조회를 죽이지 않음',`rows=${data&&data.length}`);
  }

  // ⑤ _vmProgressive — 첫 페이지는 즉시 그리고, 이어지는 페이지는 500ms 스로틀로 건너뛴다
  {
    renderCount=0;renderedLens=[];checkedBox=null;ctx._vmSearchGen=1;
    const cb=ctx._vmProgressive(1,arr=>arr.slice(),'숨김');
    cb([1,2,3],[1,2,3]);                 // 첫 페이지 → 그림
    cb([4,5,6],[1,2,3,4,5,6]);           // 곧바로 두 번째 → 스로틀로 건너뜀
    need(renderCount===1,'첫 페이지는 즉시 렌더, 직후 페이지는 스로틀로 생략',`렌더수=${renderCount}`);
    need(renderedLens[0]===3,'렌더 시점의 _vmRows가 그때까지의 누적과 일치',JSON.stringify(renderedLens));
  }

  // ⑥ 세대(_vmSearchGen)가 바뀌면 false를 돌려 조회를 버린다 — 탭을 옮겼는데 옛 결과가 덮어쓰는 사고 방지
  {
    renderCount=0;checkedBox=null;
    const cb=ctx._vmProgressive(7,null,'숨김');
    ctx._vmSearchGen=8;                  // 다른 조회가 시작됨
    const r=cb([1],[1]);
    need(r===false,'세대가 바뀌면 onPage가 false 반환(조회 중단)');
    need(renderCount===0,'세대가 바뀌면 그리지도 않음',`렌더수=${renderCount}`);
    ctx._vmSearchGen=1;
  }

  // ⑦ 사용자가 체크박스를 건드린 뒤엔 다시 그리지 않는다 — 재렌더가 선택을 통째로 날리기 때문
  {
    renderCount=0;checkedBox={checked:true};
    const cb=ctx._vmProgressive(1,null,'숨김');
    cb([1],[1]);
    need(renderCount===0,'선택 중이면 진행 렌더를 건너뜀(선택 보존)',`렌더수=${renderCount}`);
    checkedBox=null;
  }

  // ⑧ 스크롤 위치가 진행 렌더 전후로 보존된다
  {
    renderCount=0;checkedBox=null;
    const lst=mkEl('vm-list');lst.scrollTop=420;
    ctx._vmRenderVideoList=()=>{renderCount++;lst.scrollTop=0;}; // 실제 렌더처럼 목록을 비워 스크롤이 0이 됨
    const cb=ctx._vmProgressive(1,null,'숨김');
    cb([1],[1]);
    need(lst.scrollTop===420,'진행 렌더 후 스크롤 위치 복원',`scrollTop=${lst.scrollTop}`);
  }

  // ⑨ _vmIdbDropTabs — 탭의 디스크 캐시를 **검색어별 변형까지** 지우는가.
  //    키가 `탭 검색어` 형태라 `_vmIdbDel('nomem ')` 하나로는 "무관 탭에서 검색해둔 목록"이 남아,
  //    새로고침 후 이미 처리한 행이 되살아난다(2026-09-02에 실제로 이 구멍이 있었음).
  {
    const deleted=[];
    const dctx={
      console,
      _vmIdbTx:(_mode,fn)=>Promise.resolve(fn({getAllKeys:()=>['nomem ','nomem 아이브','hold ','hidden ','all 뉴진스','review ']})),
      _vmIdbDel:k=>{deleted.push(k);},
    };
    vm.createContext(dctx);
    vm.runInContext(slice(/async function _vmIdbDropTabs\(/,'_vmIdbDropTabs'),dctx);
    await dctx._vmIdbDropTabs(new Set(['nomem','review']),'review ');
    deleted.sort();
    need(JSON.stringify(deleted)==='["nomem ","nomem 아이브"]',
      '_vmIdbDropTabs — 대상 탭의 검색어 변형까지 폐기, 현재 보는 키/타 탭은 보존',JSON.stringify(deleted));
  }

  console.log(`\n${pass}/${pass+fail} 통과${fail?`, ${fail}개 실패`:''}`);
  process.exit(fail?1:0);
})();
