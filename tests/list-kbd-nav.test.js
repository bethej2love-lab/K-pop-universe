// 검색 목록 키보드 내비게이션(_wireListKeyboardNav) 회귀 테스트 (2026-09-02 신설)
//
// 배경: 관리자 태그 편집 모달에서 멤버 이름을 치고 엔터를 "한 번" 눌렀는데 **두 명이 선택**되는
// 제보. 원인은 한글 IME 조합 확정 엔터를 안 걸러낸 것 —
//   ① 조합 확정 엔터(isComposing=true)에 목록 첫 항목이 눌려 1명 추가
//   ② 확정되며 input이 다시 떠 결과가 새로 렌더
//   ③ 사용자가 "이제 고르자"고 누른 진짜 엔터에 또 1명 추가
// 이 헬퍼는 검색창 5곳(데스크톱/모바일 우주 검색, 태그 모달 "타 그룹 멤버"/"원곡자", 커버 지정)이
// 전부 공유하므로 한 곳에서 고치고 여기서 지킨다.
//
// 실행: node tests/list-kbd-nav.test.js

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

let pass=0,fail=0;
const ok=m=>{pass++;console.log(`✅ ${m}`);};
const bad=(m,d)=>{fail++;console.log(`❌ ${m}`);if(d)console.log('   '+d);};
const need=(c,m,d)=>c?ok(m):bad(m,d);

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

// ── 최소 DOM 스텁 — 실제 헬퍼를 그대로 실행하기 위한 것(로직을 베끼지 않는다) ──────────
function mkItem(name,picked){
  const cls=new Set();
  return {
    _name:name,
    classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),contains:c=>cls.has(c)},
    scrollIntoView(){},
    click(){picked.push(name);},
    get active(){return cls.has('kbd-active');},
  };
}
function mkHarness(){
  const picked=[];
  let items=[];
  const handlers={};
  const inputEl={addEventListener:(t,fn)=>{(handlers[t]=handlers[t]||[]).push(fn);}};
  const resultsEl={querySelectorAll:()=>items};
  return {
    picked,
    setItems(n){items=Array.from({length:n},(_,i)=>mkItem('후보'+i,picked));},
    items:()=>items,
    fire(type,ev){(handlers[type]||[]).forEach(fn=>fn(ev));},
    key(k,extra){
      let prevented=false;
      this.fire('keydown',Object.assign({key:k,preventDefault(){prevented=true;}},extra||{}));
      return prevented;
    },
    inputEl,resultsEl,
  };
}

const ctx={};
vm.createContext(ctx);
vm.runInContext(slice(/function _wireListKeyboardNav\(/,'_wireListKeyboardNav'),ctx);
need(typeof ctx._wireListKeyboardNav==='function','_wireListKeyboardNav 로드됨');

// ── ① 사용자가 제보한 그 시나리오 ─────────────────────────────────────────
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(3);
  h.fire('input',{});          // "성호" 입력 → 결과 렌더
  h.key('Enter',{isComposing:true}); // ① 한글 조합 확정 엔터
  h.fire('input',{});          // ② 확정되며 input 재발생 → 결과 재렌더
  h.key('Enter',{});           // ③ 사용자가 선택하려고 누른 진짜 엔터
  need(h.picked.length===1,
    `이름 치고 엔터 = 정확히 1명만 선택 (조합 확정 엔터가 겹쳐도)`,
    `선택된 것: ${JSON.stringify(h.picked)}`);
}

// keyCode 229 폴백(isComposing을 안 채우는 구형 브라우저)
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(3);
  h.fire('input',{});
  h.key('Enter',{keyCode:229});
  need(h.picked.length===0,'keyCode 229(조합 중)도 선택으로 치지 않음',JSON.stringify(h.picked));
}

// ── ② 조합이 아닐 때의 정상 동작은 그대로여야 한다 ────────────────────────
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(3);
  h.fire('input',{});
  const prevented=h.key('Enter',{});
  need(h.picked.length===1&&h.picked[0]==='후보0','조합이 아니면 엔터로 첫 항목 선택',JSON.stringify(h.picked));
  need(prevented===true,'엔터는 기본 동작을 막음(폼 전송/줄바꿈 방지)');
}
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(3);
  h.fire('input',{});
  h.key('ArrowDown',{});h.key('ArrowDown',{});  // 0 → 1
  h.key('Enter',{});
  need(h.picked.length===1&&h.picked[0]==='후보1','화살표로 이동한 항목이 선택됨',JSON.stringify(h.picked));
}
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(3);
  h.fire('input',{});
  h.key('ArrowDown',{});                 // idx 0
  h.key('ArrowDown',{isComposing:true}); // 조합 중 화살표는 IME 후보 이동용 — 목록은 안 움직여야 함
  h.key('Enter',{});
  need(h.picked[0]==='후보0','조합 중 화살표는 목록 선택을 옮기지 않음',JSON.stringify(h.picked));
}
// 결과가 없을 때 엔터는 아무 일도 없어야 한다(예외 없이)
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(0);
  let threw=false;
  try{h.key('Enter',{});}catch(e){threw=true;}
  need(!threw&&h.picked.length===0,'결과가 없으면 엔터가 무해(예외 없음)');
}
// 검색어가 바뀌면 선택 인덱스가 리셋돼 엉뚱한 항목에 눌어붙지 않는다(기존 보장 유지)
{
  const h=mkHarness();
  ctx._wireListKeyboardNav(h.inputEl,h.resultsEl,'.opt');
  h.setItems(3);
  h.fire('input',{});
  h.key('ArrowDown',{});h.key('ArrowDown',{}); // idx 1
  h.setItems(3);
  h.fire('input',{});                          // 새 검색어 → idx 리셋
  h.key('Enter',{});
  need(h.picked[0]==='후보0','검색어가 바뀌면 선택 인덱스 리셋',JSON.stringify(h.picked));
}

console.log(`\n${pass}/${pass+fail} 통과${fail?`, ${fail}개 실패`:''}`);
process.exit(fail?1:0);
