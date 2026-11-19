// '최근 본 것'에서 무관·보류·숨김 영상 빼기(2026-11-19 사용자 "무관 처리하면 recently viewed든 어디서든 안 보여야")
const fs=require('fs'),path=require('path'),vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const m=src.match(/^function _recentDropFlagged\([^\n]*$/m);if(!m)throw new Error('_recentDropFlagged 없음');
const ctx={ytId:u=>{const x=/(?:v=|shorts\/|youtu\.be\/)([\w-]{6,})/.exec(u||'');return x?x[1]:'';},Set};vm.createContext(ctx);
vm.runInContext(m[0]+'\nthis.D=_recentDropFlagged;',ctx);
let pass=0,fail=0;const ok=(c,t)=>{if(c){pass++;console.log('✅ '+t);}else{fail++;console.log('❌ '+t);}};
const arr=[{u:'https://www.youtube.com/watch?v=aaaaaa1',t:'A'},{u:'https://youtube.com/shorts/bbbbbb2',t:'B'},{u:'https://www.youtube.com/watch?v=cccccc3',t:'C'}];
ok(ctx.D(arr,['bbbbbb2']).map(v=>v.t).join('')==='AC','걸린 영상만 빠지고 순서 유지(쇼츠 주소도)');
ok(ctx.D(arr,[]).length===3&&ctx.D(arr,null).length===3,'걸린 게 없으면 그대로');
ok(ctx.D(arr,['aaaaaa1','bbbbbb2','cccccc3']).length===0,'전부 걸리면 빈 목록');
ok(ctx.D(null,['x']).length===0,'빈 기록 안전');
ok(/_recentPurgeFlagged\(arr\);\n\}/.test(src)&&/in\('content_flag',_FLAG_HIDE\)/.test(src)&&/const _FLAG_HIDE=\['무관','보류','hidden'\]/.test(src),'선반을 그릴 때마다 확인하고, 무관·보류·숨김을 본다');
console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
