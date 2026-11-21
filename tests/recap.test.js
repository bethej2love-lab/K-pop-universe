// 덕질 결산(2026-11-21) — 달별 시청 집계(_watchLogAdd)와 결산(_recapOf). 브라우저·네트워크 없음.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const a=s.indexOf("const _WATCH_LOG_KEY='kpu_watch_log';"),b=s.indexOf('function _recapMonthLabel(ym)',a);assert(a>=0&&b>a);
const store={};
const ctx={localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v);}},Date,JSON,Object,Array,scraps:[]};
vm.createContext(ctx);vm.runInContext(s.slice(a,b)+'\nthis.A=_watchLogAdd;this.R=_recapOf;this.YM=_watchYm;this.L=_watchLogLoad;',ctx);
const ym=ctx.YM();
for(let i=0;i<5;i++)ctx.A('v1',{t:'a',groupKo:'코르티스',memberKos:['성현']});
for(let i=0;i<2;i++)ctx.A('v2',{t:'b',groupKo:'코르티스',memberKos:['건호','성현']});
ctx.A('v3',{t:'c',groupKo:'아이브',memberKos:[]});
ctx.scraps.push({t:'h',u:'x',at:Date.now()},{t:'old',u:'y',at:Date.parse('2020-01-01')},{t:'nodate',u:'z'});
const r=ctx.R(ym);
assert.equal(r.n,8);assert.equal(r.days,1);
assert.deepEqual(JSON.parse(JSON.stringify(r.topM)),[['코르티스:성현',7],['코르티스:건호',2]]);
assert.deepEqual(JSON.parse(JSON.stringify(r.topG)),[['코르티스',7],['아이브',1]]);
assert.equal(r.topV[0].id,'v1');assert.equal(r.topV[0].n,5);
assert.equal(r.hearts.length,1,'이번 달에 누른 하트만');
assert.equal(ctx.R('1999-01'),null);
// 영상 150개 상한 — 적게 본 것부터 지운다
for(let i=0;i<170;i++)ctx.A('x'+i,{t:'x',groupKo:'g'});
const n=Object.keys(ctx.L()[ym].v).length;assert(n<=150,'영상 상한 '+n);assert(ctx.L()[ym].v.v1,'많이 본 영상은 남는다');
console.log('PASS recap: 달별 집계 · 많이 본 멤버/그룹/영상 · 이번 달 하트 · 상한');
