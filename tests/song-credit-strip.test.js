// Mnet 서바이벌 곡 크레딧 "♬곡 - 원곡자"는 출연 근거가 아니다(2026-10-21 — 블랙핑크 공유 미리보기가 리벤지배틀 연습생 페이스캠).
// 단 킹덤·퀸덤 계열은 "♬곡 - 실제 공연자 (원곡: X)"라 그대로 둔다(♬ 제목 1,000건 이전/새 매처 차분으로 확인).
const {load}=require('../tools/m2_harness');
const M=load();
let fail=0;
const g=(title,bad,why)=>{const r=M._m2ParseTitle(title,undefined,false);const got=r?r.primaryGroup:null;
  const ok=typeof bad==='function'?bad(got):got!==bad;if(ok)console.log('✓',why,'→',got);else{fail++;console.log('✗',why,'— 실제',got);}};
g("[4회/페이스캠] 카리스마 위너스 | #배예람 #BAE YERAM ♬뚜두뚜두-BLACKPINK(블랙핑크) #리벤지배틀",'블랙핑크','리벤지배틀 연습생 — 원곡자 블랙핑크 아님');
g("[#스틸하트클럽/직캠] 키보드 윤영준 ♬Lovesick Girls - BLACKPINK｜1R '클럽 오디션'",'블랙핑크','스틸하트클럽 — 원곡자 아님');
g("[BOYS ll PLANET/4회 직캠] 김준서 KIM JUN SEO ♬Whiplash - aespa (에스파) @1vs1 계급 배틀",'에스파','보이즈플래닛 — 원곡자 아님');
g("[ENG] Road to Kingdom [6회] ♬ 하드캐리 - TOO (원곡  GOT7) @3차 경연 너의 노래 200604 EP.6",x=>x==='티오원','로드투킹덤은 크레딧이 공연자 — 티오원 유지');
g("[#로드투킹덤_A/3회] '부동의 에이스 1위' ♬ Sovereign Shadows - 원어스 ACE 환웅ㅣ1차전 에이스 배틀 | Mnet 241003 방송",x=>x==='원어스','로드투킹덤_A — 원어스 유지');
console.log(fail?`\n❌ ${fail} 실패`:'\n✅ 0 실패');process.exit(fail?1:0);
