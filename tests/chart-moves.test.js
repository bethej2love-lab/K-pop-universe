// 차트 창 '오늘의 움직임' 줄(2026-11-19) — 급상승 2 · 새 진입 3 · 최장 체류 1, 겹치면 한 번, 최대 6. 움직임이 없으면 빈 배열(예전 미니 그래프로)
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const a=src.indexOf('function _chartMoves('),b=src.indexOf('\n}\n',a)+2;
const ctx={currentLang:'ko'};vm.createContext(ctx);vm.runInContext(src.slice(a,b)+';this._chartMoves=_chartMoves;',ctx);
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('✅ '+m);}else{fail++;console.log('❌ '+m);}};
const mk=(id,rank,o)=>Object.assign({id,s:{rank,u:id},climb:null,isNew:false,streak:1},o);
const st=[mk('a',1,{streak:9,climb:2}),mk('b',2,{climb:30}),mk('c',3,{isNew:true}),mk('d',4,{isNew:true}),mk('e',5,{isNew:true}),mk('f',6,{isNew:true}),mk('g',7,{climb:12}),mk('h',8,{})];
const mv=ctx._chartMoves(st,7);
ok(mv.map(m=>m.o.id).join(',')==='b,c,d,e,g,a','순서: 최대 상승 → 새 진입 3 → 둘째 상승 → 최장 체류 ('+mv.map(m=>m.o.id).join(',')+')');
ok(mv[0].badge==='↑30'&&mv[1].badge==='NEW'&&mv[5].badge==='9+일째','딱지: ↑30 · NEW · 9+일째(기록 길이 넘으면 +)');
ok(mv.length<=6&&new Set(mv.map(m=>m.o.id)).size===mv.length,'최대 6개·겹침 없음');
ok(ctx._chartMoves([mk('x',1,{}),mk('y',2,{})],7).length===0,'움직임 없으면 빈 배열');
const one=ctx._chartMoves([mk('x',1,{climb:5,streak:4})],7);
ok(one.length===1&&one[0].kind==='rise','같은 무대가 상승·체류 둘 다여도 한 번만');
ctx.currentLang='en';ok(ctx._chartMoves([mk('x',1,{streak:4})],9)[0].badge==='4d','영어 딱지 4d');
ok(/if\(!exp\)\{const mv=_chartMoves\(/.test(src),'접힌 기본 화면이 이 줄을 쓴다');
console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
