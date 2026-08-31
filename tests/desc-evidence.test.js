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

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
