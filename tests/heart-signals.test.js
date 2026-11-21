// 하트 기록 활용(2026-11-21) — 직캠 종류 판정과 취향 추정(_myKindPref), 추천순 가산(_recKindBoost). 브라우저·네트워크 없음.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const a=s.indexOf('function _vidKindOf(t){'),b=s.indexOf('// ③ 지난 방문 이후',a);assert(a>=0&&b>a);
const ctx={scraps:[]};vm.createContext(ctx);vm.runInContext(s.slice(a,b)+'\nthis.K=_vidKindOf;this.P=_myKindPref;this.B=_recKindBoost;',ctx);
assert.equal(ctx.K('[입덕직캠] 코르티스 성현 직캠 4K'),'full');
assert.equal(ctx.K('[페이스캠4K] 코르티스 성현 (FaceCam)'),'face');
assert.equal(ctx.K('[얼빡직캠 4K] 코르티스 성현'),'face');
assert.equal(ctx.K('[#최애직캠] CORTIS SEONGHYEON'),'face');
assert.equal(ctx.K('[보이스캠] 성현 Voice Focused FanCam'),'voice');
assert.equal(ctx.K("CORTIS 'REDRED' Official MV"),'');
assert.equal(ctx.P(),'','하트가 없으면 취향 없음');
const face=n=>Array.from({length:n},(_,i)=>({t:'[페이스캠4K] x '+i})),full=n=>Array.from({length:n},(_,i)=>({t:'[MPD직캠] y 직캠 '+i}));
ctx.scraps.push(...face(3));assert.equal(ctx.P(),'','5개 미만이면 판단하지 않는다');
ctx.scraps.push(...face(3),...full(2));assert.equal(ctx.P(),'face','8개 중 6개(75%)면 얼굴 위주');
assert.equal(ctx.B({title:'[페이스캠4K] z'}),0.07);assert.equal(ctx.B({title:'[MPD직캠] z 직캠'}),0);
ctx.scraps.push(...full(4));assert.equal(ctx.P(),'','6:6으로 갈리면(60% 미만) 취향 없음');
console.log('PASS heart signals: 종류 판정 · 취향 추정 문턱 · 추천순 가산');
