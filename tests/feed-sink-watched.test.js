// For You 선반: 다 본 영상(92%↑)은 뒤로, 보다 만 영상·안 본 영상은 순서 그대로(2026-11-19, docs/FOR_YOU_FEED.md 1단계)
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const grab=name=>{const m=src.match(new RegExp('^(?:const|function) '+name+'[^\\n]*$','m'));if(!m)throw new Error('app.js에 '+name+' 없음');return m[0];};
const ctx={_vidProg:new Map()};vm.createContext(ctx);
vm.runInContext(['_FEED_DONE_RATIO','_feedVidDone','_feedSinkWatched'].map(grab).join('\n')+';this._feedVidDone=_feedVidDone;this._feedSinkWatched=_feedSinkWatched;',ctx);
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('✅ '+m);}else{fail++;console.log('❌ '+m);}};
ctx._vidProg.set('done',{t:95,d:100});ctx._vidProg.set('half',{t:50,d:100});ctx._vidProg.set('edge',{t:92,d:100});ctx._vidProg.set('nod',{t:30,d:0});
ok(ctx._feedVidDone('done')===true,'95% 본 영상 = 다 봄');
ok(ctx._feedVidDone('edge')===true,'92% 경계 = 다 봄');
ok(ctx._feedVidDone('half')===false,'절반 본 영상 = 다 본 게 아님(제자리)');
ok(ctx._feedVidDone('none')===false&&ctx._feedVidDone('nod')===false&&ctx._feedVidDone(null)===false,'기록 없음·길이 0·id 없음 = false');
const out=ctx._feedSinkWatched(['a','done','half','edge','b'],x=>ctx._feedVidDone(x));
ok(out.join(',')==='a,half,b,done,edge','다 본 것만 뒤로, 각 묶음 안 순서 유지 → '+out.join(','));
ok(ctx._feedSinkWatched(null,()=>false).length===0,'빈 입력 안전');
ok(/_rest=_feedSinkWatched\(songs\.filter\(s=>!_isFav\(s\)\|\|_done\(s\)\),_done\)/.test(src)&&/_favFirst=songs\.filter\(s=>_isFav\(s\)&&!_done\(s\)\)/.test(src),'New Videos 선반이 실제로 이 정렬을 쓴다');
console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
