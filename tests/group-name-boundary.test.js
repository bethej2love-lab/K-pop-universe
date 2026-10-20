// 풀네임 지우기 예외의 그룹명 검사는 단어 경계로(2026-10-21) — "[LIVE]" 안의 IVE가 아이브로 읽혀
// "[LIVE] 전유진(Jeon Yujin)"·"신유진 (Shin Yujin) … K-Pop Live Session"이 아이브 안유진이 됐다.
const {load}=require('../tools/m2_harness');
const M=load();
let fail=0;
const g=(title,want,why)=>{const r=M._m2ParseTitle(title,undefined,false);const got=r?r.primaryGroup:null;
  if(got===want)console.log('✓',why);else{fail++;console.log('✗',why,'— 기대',want,'실제',got);}};
g("[LIVE] 전유진(Jeon Yujin) - 나의 사랑 나의 운명| 웬디의 영스트리트",null,'[LIVE]의 IVE는 아이브 근거 아님');
g("신유진 (Shin Yujin) - 방자 (BangJa) | K-Pop Live Session | K-Poppin'",null,'Live Session의 IVE도 아님');
g("[LIVE] 안유진(An Yujin) - 노래",'아이브','본인 풀네임은 그대로 아이브');
g("IVE AN YUJIN 직캠",'아이브','단어로 쓴 IVE는 그룹명');
console.log(fail?`\n❌ ${fail} 실패`:'\n✅ 0 실패');process.exit(fail?1:0);
