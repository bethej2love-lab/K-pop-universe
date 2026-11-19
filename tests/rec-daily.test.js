// 추천순 하루 단위 순서 바꿈 + 본 영상 내리기(2026-11-19 사용자 "적어도 하루 한 번은 순서 바꾸는 게")
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const pick=re=>{const m=src.match(re);if(!m)throw new Error('못 찾음: '+re);return m[0];};
const code=[pick(/const _VID_CAT_WEIGHT=[^\n]*\n/),pick(/function _vidCatWeight\(cat\)\{[^\n]*\n/),pick(/const _REC_W=[^\n]*\n/),pick(/function _recDayKey\(\)\{[^\n]*\n/),
  pick(/function _recNoise\(id\)\{[^\n]*\n/),pick(/function _recSeenPen\(id\)\{[^\n]*\n/),pick(/function _recOrder\(vids,memberKo\)\{[\s\S]*?\n\}\n/),pick(/const _COMPILATION_RE=[^\n]*\n/),pick(/function _isCompilationVid\(v\)\{[^\n]*\n/)].join('');
let nowMs=Date.parse('2026-11-19T03:00:00Z');
class FD extends Date{constructor(...a){if(a.length)super(...a);else super(nowMs);}static now(){return nowMs;}}
const ctx={Math:Object.create(Math),Date:FD,isNaN,Set,Map,_scrapCounts:new Map(),favMembers:new Set(),myProfile:null,_isShortV:()=>false,_vidProg:new Map()};
ctx.Math.random=()=>0.5;
vm.createContext(ctx);vm.runInContext(code+'\nthis.R=_recOrder;this.N=_recNoise;this.P=_recSeenPen;',ctx);
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('✅ '+m);}else{fail++;console.log('❌ '+m);}};
// 비슷한 조건의 영상 40개(같은 날짜·조회수) — 순서는 무작위 항이 정한다
const mk=()=>Array.from({length:40},(_,i)=>({id:'v'+i,published_at:'2026-10-01',view_count:1e5,category:'live'}));
const day1=ctx.R(mk(),null).map(v=>v.id).join(',');
ok(ctx.R(mk(),null).map(v=>v.id).join(',')===day1,'같은 날 다시 열면 같은 순서');
ok(ctx.N('abc')>=0&&ctx.N('abc')<1&&ctx.N('abc')===ctx.N('abc')&&ctx.N('abc')!==ctx.N('abd'),'무작위 값은 0~1, 같은 영상·같은 날이면 같고 영상이 다르면 다르다');
nowMs+=24*3600e3;
const day2=ctx.R(mk(),null).map(v=>v.id).join(',');
ok(day2!==day1,'다음 날은 순서가 바뀐다');
const top1=day1.split(',').slice(0,10),top2=day2.split(',').slice(0,10);
ok(top1.filter(x=>top2.includes(x)).length<=7,'첫 10개 중 적어도 3개는 다른 영상('+top1.filter(x=>top2.includes(x)).length+'개 겹침)');
// 최신 영상은 그래도 위쪽(무작위가 최신을 완전히 덮지 않는다)
const withNew=mk().concat([{id:'fresh',published_at:new FD().toISOString().slice(0,10),view_count:1e5,category:'live'}]);
ok(ctx.R(withNew,null).map(v=>v.id).indexOf('fresh')<10,'오늘 올라온 영상은 첫 10개 안');
// 본 영상 감점
ctx._vidProg.set('done',{t:99,d:100});ctx._vidProg.set('open',{t:5,d:100});
ok(ctx.P('done')===0.30&&ctx.P('open')===0.10&&ctx.P('none')===0,'다 본 영상 −0.30 · 열어 본 영상 −0.10 · 안 본 영상 0');
const three=[{id:'done',published_at:'2026-10-01',view_count:1e5,category:'live'},{id:'none',published_at:'2026-10-01',view_count:1e5,category:'live'}];
let wins=0;for(let d=0;d<20;d++){nowMs+=24*3600e3;if(ctx.R(three.map(x=>({...x})),null)[0].id==='none')wins++;}
ok(wins>=17,'같은 조건이면 안 본 영상이 다 본 영상보다 거의 항상 위(20일 중 '+wins+'일)');
console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
