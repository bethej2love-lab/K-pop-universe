// 주간 보고 '방문자' 절 집계(tools/visitor_report.mjs) — 가짜 기록으로 계산이 맞는지
(async()=>{
const {summarize,toMarkdown}=await import('../tools/visitor_report.mjs');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('✅ '+m);}else{fail++;console.log('❌ '+m);}};
const now=Date.parse('2026-11-19T00:00:00Z'),d=n=>new Date(now-n*86400e3).toISOString();
const app=[
 {user_id:'a',ev:'view_group',k:'에스파',created_at:d(1)},{user_id:'a',ev:'video_play',k:null,created_at:d(1)},{user_id:'a',ev:'view_group',k:'에스파',created_at:d(3)},
 {user_id:'a',ev:'view_group',k:'에스파',created_at:d(9)},
 {user_id:'b',ev:'favorite_group',k:'add',created_at:d(2)},{user_id:'c',ev:'favorite_group',k:'remove',created_at:d(2)},
 {user_id:'d',ev:'view_member',k:'x:y',created_at:d(10)},
];
const seo=[
 {ev:'land',page_type:'member',src:'google.com',did:'1',ua:'Mozilla',created_at:d(1)},{ev:'play',page_type:'member',src:'',did:'1',ua:'Mozilla',created_at:d(1)},
 {ev:'land',page_type:'group',src:'',did:'2',ua:'Mozilla',created_at:d(1)}, // 출처도 행동도 없음 → 사람으로 안 침
 {ev:'land',page_type:'group',src:'naver.com',did:'3',ua:'Yeti bot',created_at:d(1)}, // 봇
 {ev:'land',page_type:'song',src:'google.com',did:'4',ua:'Mozilla',created_at:d(2)},{ev:'to_app',page_type:'song',src:'',did:'4',ua:'Mozilla',created_at:d(2)},
 {ev:'land',page_type:'song',src:'google.com',did:'5',ua:'Mozilla',created_at:d(10)},
];
const s=summarize(app,seo,now);
ok(s.app.cur.users===3&&s.app.prev.users===2,'앱 온 사람 이번 주 3 / 지난주 2');
ok(s.app.cur.play===1,'재생한 사람 1');
ok(s.app.cur.save===1,'저장 = 즐겨찾기 추가만(해제는 안 셈)');
ok(s.app.cur.multiDay===1,'이틀 이상 온 사람 1(a)');
ok(s.app.back===1&&s.app.fresh===2,'또 온 사람 1(a) · 처음 온 사람 2(b,c)');
ok(s.seo.cur.land===2&&s.seo.prev.land===1,'정적 들어온 사람 2(봇·무행동 제외) / 지난주 1');
ok(s.seo.cur.play===1&&s.seo.cur.toApp===1,'정적 재생 1 · 앱으로 1');
ok(s.seo.cur.src[0][0]==='google.com'&&s.seo.cur.src[0][1]===2,'출처 1위 google.com 2명');
const md=toMarkdown(s,false);
ok(/온 사람 \| 3 \(지난주 2\)/.test(md)&&/앱으로 넘어간 사람 \| 1/.test(md)&&!/undefined|NaN/.test(md),'표 문구 정상');
ok(/일부만 읽었다/.test(toMarkdown(s,true)),'기록이 잘렸으면 경고');
ok(summarize([],[],now).app.cur.users===0&&!/NaN/.test(toMarkdown(summarize([],[],now))),'빈 기록 안전');
console.log(`\n${pass} 통과 / ${fail} 실패`);process.exit(fail?1:0);
})();
