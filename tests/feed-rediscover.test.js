// For You 'Rediscover' 선반 — 조회 구간 계획(_redPlan)과 고르기(_redPick) (2026-11-19, docs/FOR_YOU_FEED.md)
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const cut=name=>{const a=src.indexOf('function '+name+'(');if(a<0)throw new Error(name+' 없음');return src.slice(a,src.indexOf('\n}\n',a)+3);};
const one=name=>{const m=src.match(new RegExp('^function '+name+'\\([^\\n]*$','m'));if(!m)throw new Error(name+' 없음');return m[0]+'\n';};
const ctx={Math,Date};vm.createContext(ctx);
vm.runInContext(one('_redSeed')+cut('_redPlan')+cut('_redPick')+'this.plan=_redPlan;this.pick=_redPick;',ctx);
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('✅ '+m);}else{fail++;console.log('❌ '+m);}};
const p1=ctx.plan('2026-11-19'),p1b=ctx.plan('2026-11-19'),p2=ctx.plan('2026-11-20');
ok(JSON.stringify(p1)===JSON.stringify(p1b),'같은 날은 같은 구간');
ok(JSON.stringify(p1.win)!==JSON.stringify(p2.win)||p1.yrs!==p2.yrs,'다음 날은 다른 구간');
ok(p1.yrs>=1&&p1.yrs<=6,'N년 전 = 1~6년 ('+p1.yrs+')');
const days=(a,b)=>(Date.parse(b)-Date.parse(a))/864e5;
ok(days(p1.ann[0],p1.ann[1])===7&&p1.ann[0].slice(5)==='11-16','이맘때 구간 = 오늘 ±3일(7일 폭), '+p1.ann.join('~'));
ok(days(p1.win[0],p1.win[1])===40&&days(p1.win[1],'2026-11-19')>=365&&days(p1.win[0],'2026-11-19')<=365*6+41,'안 본 무대 구간 = 1~6년 전 사이 40일, '+p1.win.join('~'));
let allIn=true;for(let d=0;d<400;d++){const k=new Date(Date.parse('2026-01-01')+d*864e5).toISOString().slice(0,10);const p=ctx.plan(k);if(!(p.yrs>=1&&p.yrs<=6&&days(p.win[1],k)>=365))allIn=false;}
ok(allIn,'400일 내내 구간이 범위 안');
const v=(id,vc,cat,pa)=>({id,view_count:vc,category:cat||'live',published_at:pa||'2023-05-01'});
const ann=[v('a1',10),v('a2',500),v('a3',90)],win=[v('w1',5),v('w2',900),v('w3',300,'other'),v('w4',50),v('a2',500),v('seen',9999),v('bad',8888)];
const got=ctx.pick(ann,win,{yrs:3,max:6,isSeen:id=>id==='seen',ok:x=>x.id!=='bad'});
ok(got.map(x=>x.v.id).join(',')==='a2,a3,w2,w4,w1','이맘때 2개(조회수 순) → 안 본 무대(조회수 순), 본 것·걸러진 것·겹침 제외: '+got.map(x=>x.v.id).join(','));
ok(got[0].why.kind==='ann'&&got[0].why.yrs===3&&got[2].why.kind==='unseen'&&got[2].why.year==='2023','이유: N년 전 이맘때 / 아직 안 본 무대 · 연도');
const few=ctx.pick([],[v('o1',5,'other'),v('o2',9,'other'),v('l1',1)],{yrs:1,isSeen:()=>false,ok:()=>true});
ok(few.map(x=>x.v.id).join(',')==='l1,o2,o1','무대가 모자라면 그 구간의 다른 영상으로 채운다');
ok(ctx.pick(null,null,{yrs:1,isSeen:()=>false,ok:()=>true}).length===0,'빈 입력 안전');
ok(ctx.pick([],Array.from({length:30},(_,i)=>v('x'+i,i)),{yrs:1,isSeen:()=>false,ok:()=>true}).length===6,'최대 6개');
console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
