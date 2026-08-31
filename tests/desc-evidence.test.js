// 설명란 출연 근거 + 이니셜형 영문명 경계 회귀 테스트 (2026-08-31 신설)
//
// 사용자 발견 — "그룹 전체 무대인데 위너는 송민호, 아이콘은 B.I, 하츠투하츠는 예온이 체크돼 있다".
// 원인이 두 개였고 케이스는 전부 실DB 표본에서 그대로 가져왔다.
//   ① 설명란의 트랙리스트·멀티앵글·관련링크를 출연 근거로 읽음(등록 영문명이 있는 멤버만 걸려 한 명만)
//   ② B.I.G(비아이지)가 토큰 b/i/g로 쪼개져 아이콘 B.I의 ['b','i']와 맞아떨어짐 — 38건 오배정
// 실행: node tests/desc-evidence.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_atmStripDescNoise,_atmResolveMembers,_atmMatchesMember,_atmTokenize,ARTISTS}=M;
if(!_atmStripDescNoise){console.error('_atmStripDescNoise 없음 — admin.js에서 슬라이스 실패');process.exit(2);}

let pass=0,fail=0;
function t(name,actual,expected){
  const a=JSON.stringify(actual),e=JSON.stringify(expected);
  if(a===e)pass++;else{fail++;console.error(`✗ ${name}\n    기대: ${e}\n    실제: ${a}`);}
}
const _ag=a=>a.groups||[a.group];
const roster=gko=>ARTISTS.filter(a=>_ag(a).some(g=>g&&g.ko===gko))
  .map(a=>({ko:a.name.ko,en:a.name.en,left:a.left,aliases:a.matchAliases}));
const has=(arr,n)=>arr.includes(n);

// ── ① 설명란 노이즈 줄 제거 ──
const keep=l=>_atmStripDescNoise(l)===l;
t('트랙리스트 불릿 줄 제거',_atmStripDescNoise('・FIANCE (MINO)'),'');
t('feat. 크레딧 줄 제거',_atmStripDescNoise('・CALL ANYTIME feat.MINO (JINU)'),'');
t('멀티앵글 목록 줄 제거',_atmStripDescNoise('[MULTI ANGLE] ・EVERYDAY_YOON / JINU / HOONY / MINO'),'');
t('URL 있는 줄 제거',_atmStripDescNoise("WINNER's 걔 세 MINO SOLO M/V @ http://youtu.be/iQnAL"),'');
t('번호 트랙 줄 제거',_atmStripDescNoise('01. FIANCE (MINO)'),'');
t('작사/작곡 크레딧 줄 제거',_atmStripDescNoise('작사 B.I 작곡 B.I'),'');
// ⚠️ 이게 이 규칙의 핵심 제약 — 출연자 해시태그 나열은 진짜 근거라 살아남아야 한다
t('출연자 해시태그 줄은 유지',keep('#Hearts2Hearts #하츠투하츠 #YUHA #A_NA #YE_ON'),true);
t('평범한 문장은 유지',keep('오늘도 열심히 연습했어요'),true);
t('여러 줄 — 노이즈만 골라 제거',
  _atmStripDescNoise('#세림 #앨런\n・FIANCE (MINO)\n연습 영상입니다\nhttps://example.com'),
  '#세림 #앨런\n연습 영상입니다');
t('빈 값은 그대로',_atmStripDescNoise(''),'');
t('null은 그대로',_atmStripDescNoise(null),null);

// ── ① 통합: 실제 위너 케이스 ──
const W=roster('위너');
t('전제 — 위너 로스터에 송민호 있음',W.some(m=>m.ko==='송민호'),true);
t('트랙리스트에만 MINO가 있으면 송민호를 안 붙임',
  has(_atmResolveMembers("WINNER - 'WINNER THE BEST \"SONG 4 U\"' Trailer2",
    'JAPAN BEST ALBUM\n・FIANCE (MINO)\n・CALL ANYTIME feat.MINO (JINU)',W,'위너','2020-02-12')||[],'송민호'),false);
t('멀티앵글 목록에만 있으면 안 붙임',
  has(_atmResolveMembers('WINNER - EVERYDAY (WINNER JAPAN TOUR 2019)',
    '[MULTI ANGLE]\n・EVERYDAY_YOON / JINU / HOONY / MINO',W,'위너','2020-03-04')||[],'송민호'),false);
t('관련영상 링크에만 있으면 안 붙임',
  has(_atmResolveMembers("WINNER -'공허해(empty)' 0831 SBS Inkigayo",
    "WINNER's 걔 세(I'm him) MINO SOLO M/V @ http://youtu.be/iQnAL",W,'위너','2014-08-31')||[],'송민호'),false);
// 반대로 진짜 근거는 계속 잡혀야 한다
t('제목에 송민호가 있으면 그대로 붙음',
  has(_atmResolveMembers('[안방1열 직캠4K] 위너 송민호 - I LOVE U','',W,'위너','2022-07-31')||[],'송민호'),true);
// 설명란 해시태그로 **일부** 멤버만 밝힌 경우는 그대로 근거로 인정한다.
// (전원이 다 걸리면 채널 시그니처 블록으로 보고 제목만 신뢰하는 기존 가드가 따로 작동한다 —
//  그건 이번 변경과 무관한 사전 동작이라 여기서 건드리지 않는다.)
t('설명란 출연자 해시태그(일부 멤버)는 그대로 근거로 인정',
  has(_atmResolveMembers('WINNER - PHOTO STUDIO',
    '오늘의 촬영 비하인드\n#WINNER #위너 #송민호 #김진우',W,'위너','2020-08-17')||[],'송민호'),true);

// ── ② 이니셜형 영문명(B.I) 경계 ──
const K=roster('아이콘');
const bi=K.find(m=>m.ko==='B.I');
t('전제 — 아이콘 로스터에 B.I 있음',!!bi,true);
const mt=(title)=>_atmMatchesMember(bi,title,_atmTokenize(title),'아이콘');
t('B.I.G(비아이지)는 B.I가 아님',mt('[안방1열 직캠4K] 비아이지 \'FLASHBACK\' 풀캠 (B.I.G Full Cam)'),false);
t('B.I.G - FLASHBACK 도 아님',mt('B.I.G - FLASHBACK (비아이지 - 플래시백) | Show Champion'),false);
t('공백으로 떨어진 B.I는 인정',mt('iKON B.I 무대'),true);
t('B.I X BOBBY 처럼 뒤에 단독 글자가 와도 인정',mt('B.I X BOBBY'),true);
t('BI(점 없이)도 인정',mt('iKON BI Solo'),true);
t('BIG(점 없는 단어)는 아님',mt('BIG BANG 무대'),false);

// ── "bts of ○○" = behind the scenes (2026-08-31) ──
// 실측: 제목에 'bts of'가 든 62건 중 55건이 방탄소년단으로 잘못 태깅돼 있었다.
const {_m2ParseTitle,_atmStripCommonNounCtx}=M;
const gkoOf=(title)=>{const r=_m2ParseTitle(title,undefined,undefined,'2024-06-01');return r?[r.primaryGroup,...(r.withGroups||[])]:[];};
t('bts of ○○ 는 방탄소년단이 아님',
  gkoOf('bts of impossible: day 3 #RIIZE #라이즈 #RISEandREALIZE').includes('방탄소년단'),false);
t('bts of ○○ — 다른 사례',
  gkoOf('bts of We are FIFTY FIFTY #ATHENA #아테나').includes('방탄소년단'),false);
t('그래도 라이즈는 정상 인식',
  gkoOf('bts of impossible: day 3 #RIIZE #라이즈 #RISEandREALIZE').includes('라이즈'),true);
// ⚠️ 'bts' 단독은 건드리면 안 된다 — 그건 진짜 방탄소년단이다
t('BTS 단독 언급은 그대로 방탄소년단',
  gkoOf('BTS (방탄소년단) Dynamite 무대').includes('방탄소년단'),true);
t('_atmStripCommonNounCtx — bts of만 제거하고 나머지는 보존',
  /impossible/.test(_atmStripCommonNounCtx('bts of impossible #RIIZE')),true);

// ── 영문 BTS는 "게스트 근거"로 인정 안 함 (2026-08-31, 사용자 승인) ──
// 실측: with_groups에 방탄소년단이 든 329건 중 174건(53%)이 제목에 한글명도 #BTS도 없었고
// 표본이 전부 비하인드·멘션·플레이리스트였다. ⚠️ primary(group_ko)와 자체 채널은 면제 — 그쪽은
// 같은 조건에 2,329건이 걸려 범위가 너무 크다.
t('bare BTS는 게스트로 안 붙음 — 힛지스 영상',
  gkoOf('HITGS ver. Countdown! BTS 🎬 #HITGS #힛지스').includes('방탄소년단'),false);
t('bare BTS는 게스트로 안 붙음 — 플레이리스트 나열',
  gkoOf('[띵곡팔이] 귀성길 플레이리스트 BTS, NCT 127, Stray Kids #스트레이키즈').includes('방탄소년단'),false);
t('한글명이 있으면 게스트로 인정',
  gkoOf('힛지스 X 방탄소년단 스페셜 무대 #힛지스').includes('방탄소년단'),true);
t('#BTS 해시태그가 있으면 게스트로 인정',
  gkoOf('스페셜 무대 #HITGS #힛지스 #BTS').includes('방탄소년단'),true);
// ⚠️ 면제가 지켜지는지 — 이게 깨지면 방탄 단독 영상 2,329건이 통째로 영향받는다.
// 면제 기준은 "위치(primary냐)"가 아니라 **다른 그룹이 같이 안 잡혔는가**다(위치로 하면
// `HITGS ... BTS #힛지스`에서 방탄이 primary로 뒤집혀 잡혀 규칙이 무력해진다 — 실측 확인).
t('방탄만 잡힌 영상은 영문만 있어도 유지(면제)',
  gkoOf('BTS - Dynamite @ MAMA 2020').includes('방탄소년단'),true);
t('  └ 그 경우 primary도 방탄',gkoOf('BTS - Dynamite @ MAMA 2020')[0],'방탄소년단');
t('다른 그룹이 같이 잡히면 그 그룹이 주인이 됨',
  gkoOf('HITGS ver. Countdown! BTS 🎬 #HITGS #힛지스')[0],'힛지스');

// ── 위너(WINNER) = 영어 단어 winner — 같은 규칙 ──
// 실측: with_groups에 위너가 든 59건 중 55건(93%)이 제목에 한글 '위너'가 없었고 전부 시상식 클립이었다.
t('the winner of that night 은 위너가 아님',
  gkoOf('Remember the winner of that night?✨ Best New Female Artist #ive #아이브 #shorts').includes('위너'),false);
t('the Winner Is? 도 아님',
  gkoOf('[BANGTAN BOMB] Bickering Over a Camera, and the Winner Is? - BTS (방탄소년단)').includes('위너'),false);
t('한글 위너가 있으면 인정',
  gkoOf('아이브 X 위너 스페셜 무대 #아이브').includes('위너'),true);

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
