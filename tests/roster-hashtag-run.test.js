// 설명란 멤버 해시태그 묶음 · 붙여쓴 영문 이름 회귀 테스트 (2026-10-20)
// 트리플에스 공식 채널은 모든 영상 설명 끝에 그 시점 멤버 전원 해시태그를 붙인다 — 몇 명만 나오는 SIGNAL에도 전원이 태그됐다.
// 9명 이상 묶음은 출연 근거가 아니다(16명 이상 그룹만). 유닛 영상의 8명 이하 묶음과 6~13명 그룹의 전원 묶음은 그대로 근거.
// 실행: node tests/roster-hashtag-run.test.js
const {load}=require('../tools/m2_harness');
const {ARTISTS}=require('../tools/matcher_harness.cjs');
const M=load();
const ag=a=>a.groups||[a.group];
const roster=g=>ARTISTS.filter(a=>ag(a).some(x=>x.ko===g)).map(a=>{const e=ag(a).find(x=>x.ko===g)||{};const st=[e.name,e.nameEn].filter(Boolean);return{ko:a.name.ko,en:a.name.en,left:(e.left!==undefined?e.left:a.left),aliases:st.length?[...(a.matchAliases||[]),...st]:a.matchAliases};});
let fail=0;const eq=(a,b)=>a.slice().sort().join()===b.slice().sort().join();
const t=(g,title,desc,want,why)=>{const got=M._atmResolveMembers(title,desc,roster(g),g);if(typeof want==='function'?want(got):eq(got,want))console.log('✓',why);else{fail++;console.log('✗',why,'— 실제',JSON.stringify(got));}};
const ALL24='#tripleS #트리플에스 #トリプルS \n#SeoYeon #HyeRin #JiWoo #ChaeYeon #YooYeon #SooMin #NaKyoung #YuBin #Kaede #DaHyun #Kotone #YeonJi #Nien #SoHyun #Xinyu #Mayu #Lynn #JooBin #HaYeon #ShiOn #ChaeWon #Sullin #SeoAh #JiYeon';
const OLD16='#tripleS #트리플에스\n#SeoYeon #HyeRin #JiWoo #ChaeYeon #YooYeon #SooMin #NaKyoung #YuBin #Kaede #DaHyun #Kotone #YeonJi #Nien #SoHyun #Xinyu #Mayu';
const UNIT8='#tripleS #LOVElution\n#SeoYeon #HyeRin #JiWoo #YooYeon #NaKyoung #YuBin #Kaede #Kotone';
t('트리플에스','채연이와 마유의 간식 털이 현장 | EN JP CN | SIGNAL 230728',OLD16,['김채연','마유'],'16명 묶음 → 제목의 두 명만');
t('트리플에스','수민이의 숨무살 생일파티 | tripleS 트리플에스 : SIGNAL LIVE 261003',ALL24,['김수민'],'24명 묶음 → 제목의 수민만');
t('트리플에스','설렘 가득한 HAUS의 첫 저녁 | EN JP CN | SIGNAL 240122',ALL24,[],'이름 없는 SIGNAL → 그룹 전체 영상');
t('트리플에스',"Girls' Capitalism 포토 비하인드 필름 Part B｜LOVElution.SSS",UNIT8,g=>g.length===8,'유닛 8명 묶음은 출연 근거로 유지');
t('트리플에스','SecretBase 250401 KimChaeWon.SSS [ EN JP CN ]',ALL24,['김채원'],'붙여쓴 KimChaeWon → 김채원 한 명');
t('엔하이픈','[LIVE] 엔하이픈, "인천국제공항 입국" l ENHYPEN, "ICN INT Airport Arrival" [공항]','#ENHYPEN #JUNGWON #HEESEUNG #JAY #JAKE #SUNGHOON #SUNOO #NIKI',g=>g.length>=5,'6~13명 그룹의 전원 묶음은 그대로(공항 단체 영상 — 비워지지 않음)');
t('이달의소녀','이달의소녀탐구 #332 (LOONA TV #332)','#이달의소녀탐구 #LOONATV #LOONA #진솔 #OliviaHye #JinSoul #올리비아혜',g=>g.includes('올리비아 혜')&&g.includes('진솔'),'#OliviaHye 붙여쓴 해시태그');
console.log(fail?`\n❌ ${fail} 실패`:'\n✅ 0 실패');process.exit(fail?1:0);
