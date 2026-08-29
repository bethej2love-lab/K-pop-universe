// 원곡 해석기 v2(_coverResolve) 회귀 테스트 (2026-08-30 신설)
// 케이스는 전부 2026-08-30 실DB 표본(kw/chal/with 2,400행)에서 그대로 가져온 제목이다. 기대값은
// 사용자 결정(챌린지도 원곡 태깅 / 동반 표시 없으면 원곡자 멤버는 출연 아님 / 자기 곡은 커버 아님 /
// 커버 확정 시 with_* 정리)을 반영한다. 실행: node tests/cover-resolve.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_coverResolve}=M;
if(!_coverResolve){console.error('_coverResolve 없음');process.exit(2);}
const chart=[
  {group_ko:'소녀시대',member_ko:null,song_title:'Gee',year:2009},
  {group_ko:'방탄소년단',member_ko:null,song_title:'Dynamite',year:2020},
  {group_ko:'블랙핑크',member_ko:null,song_title:'뚜두뚜두 (DDU-DU DDU-DU)',year:2018},
  {group_ko:'솔로',member_ko:'아이유',song_title:'좋은 날',year:2010},
];
M._coverBuildIndex(chart);

const cases=[];
function t(name,row,check){cases.push({name,row,check});}
const R=(title,group_ko,extra)=>Object.assign({title,group_ko,members:[],with_members:[],with_groups:[],cover_of_members:[],cover_of_groups:[],published_at:'2025-01-01'},extra||{});
const covG=(r,g)=>!!r&&!!r.origin&&r.origin.kind==='group'&&r.origin.gko===g;
const covM=(r,m)=>!!r&&!!r.origin&&r.origin.kind!=='group'&&`${r.origin.mko}(${r.origin.gko})`===m;

// ── 크레딧(원곡: X) ──
t('크레딧 — 이즈나 정세비 Pretty Girl(*원곡: 카라)',R("[K-Fancam] 이즈나 정세비 직캠 'Pretty Girl(*원곡: 카라)' (izna JEONG SAE BI) @뮤직뱅크 글로벌 페스티벌 251230",'이즈나'),r=>covG(r,'카라')&&r.patch.cover_of_song==='Pretty Girl');
t('크레딧 — 유태양 Don\'t Call Me(원곡 : SHINee) 영문 그룹명',R("[2022 쇼챔 상반기 결산 리포트] YOO TAE YANG(SF9) - Don't Call Me(원곡 : SHINee) (유태양(에스에프나인) - 돈콜미) l EP.443",'에스에프나인'),r=>covG(r,'샤이니'));
t('크레딧 — 템페스트 행복 (원곡 : H.O.T.)',R("[쇼챔직캠 4K] TEMPEST EUNCHAN - 행복 (원곡 : H.O.T.) (템페스트 은찬 - 행복) | Show Champion | EP.469",'템페스트'),r=>covG(r,'H.O.T.'));
t('크레딧 — 원어스 Now (Original by Fin.K.L)',R("[쇼챔직캠 4K] ONEUS LEEDO - Now (Original by Fin.K.L) (원어스 이도 - 나우) | Show Champion | EP.519 | 240529",'원어스'),r=>covG(r,'핑클'));
t('크레딧 — 위클리 Tell Me (Original song by. Wonder Girls)',R("[릴레이댄스 어게인] 위클리(Weeekly) - Tell Me (Original song by. Wonder Girls) (4K)",'위클리'),r=>covG(r,'원더걸스'));
t('크레딧 — 아이유 원곡은 cover_of_members "아이유(솔로)"',R("규민(GYUMIN) \"이름에게\" Cover (원곡 : IU)",'소디엑'),r=>covM(r,'아이유(솔로)'));
t('크레딧 — 원곡이 시스템 밖(Mika Nakashima)이면 커버지만 cover_of 없음',R("[COVER] TIOT(티아이오티) 신예찬 - 雪の華 (눈의꽃)  (원곡 : Mika Nakashima )",'티아이오티'),r=>!!r&&r.isCover&&!r.origin);
t('크레딧 — 자기 곡(원곡: 코르티스)은 커버 아님',R("[LIVE] CORTIS 성현&건호 - JoyRide (원곡: 코르티스) | 우쥬레코드 코르티스 편",'코르티스',{members:['성현','건호']}),r=>!r||!r.origin);
t('크레딧 — 자기 곡(ZEROBASEONE 원곡) 커버 아님',R("[LIVE] ZEROBASEONE 장하오&김태래 - SLAM DUNK (원곡: ZEROBASEONE) | 우쥬레코드 제로베이스원 편",'제로베이스원'),r=>!r||!r.origin);
t('크레딧 — 멤버 솔로곡 원곡(태민)은 "태민(샤이니)"',R("[#퀸덤퍼즐/Full CAM] ♬ Advice - 수윤 (SU YUN) (원곡 : 태민 (TAEMIN)) @업다운배틀 #QUEENDOMPUZZLE",'로켓펀치'),r=>covM(r,'태민(샤이니)'));
t('크레딧 — 원곡자가 with에 있으면 cover_of로 이동+with 제거',R("[Weekly Playlist l 짐벌캠] kep1er - The Boys (케플러 - 더 보이즈 (원곡 : 소녀시대) ) l EP.547",'케플러',{with_groups:['소녀시대']}),r=>covG(r,'소녀시대')&&Array.isArray(r.patch.with_groups)&&!r.patch.with_groups.includes('소녀시대'));

t('재배정 — group_ko=원곡자(샤이니)·with=씨아이엑스 옛 오저장 → 공연자 씨아이엑스로 바꾸고 원곡 샤이니',R("[릴레이댄스 어게인] CIX(씨아이엑스) - 누난 너무 예뻐(Replay) (Original song by. SHINee) (4K)",'샤이니',{with_groups:['씨아이엑스']}),r=>covG(r,'샤이니')&&r.patch.group_ko==='씨아이엑스'&&r.patch.with_groups.length===0);
t('재배정 — group_ko=세븐틴·with_members=세은(싸이커스) → 공연자 싸이커스/세은',R("[K-Fancam] 싸이커스 세은 직캠 'MAESTRO (원곡: 세븐틴)' (xikers SEEUN Fancam) @뮤직뱅크글로벌페스티벌 241219",'세븐틴',{with_members:['세은(싸이커스)']}),r=>covG(r,'세븐틴')&&r.patch.group_ko==='싸이커스'&&r.patch.members.join()==='세은');
t('따옴표+선행 아티스트 — TREASURE - BIGBANG \'봄여름가을겨울\' → 빅뱅',R("TREASURE  - BIGBANG '봄여름가을겨울 (Still Life)' COVER VIDEO",'트레저',{with_groups:['빅뱅']}),r=>covG(r,'빅뱅')&&r.patch.with_groups.length===0);
t('따옴표+선행 아티스트 — Billlie | SHINee \'Don\'t Call Me\'',R("Billlie | SHINee 'Don't Call Me' DANCE COVER",'빌리',{with_groups:['샤이니']}),r=>covG(r,'샤이니'));
t('Covered by — FAKE LOVE Covered by IVE LEESEO → 방탄소년단',R("FAKE LOVE Covered by IVE LEESEO",'아이브',{members:['이서']}),r=>covG(r,'방탄소년단'));
t('크레딧 멤버 — Original song by. BAEKHYUN → 백현(엑소), 곡 Bambi',R("[정권 챌린지] Bambi - 벨 (BELLE of KISS OF LIFE) (Original song by. BAEKHYUN)",'키스오브라이프',{members:['벨']}),r=>covM(r,'백현(엑소)'));
t('무문맥 흔한단어 따옴표(\'BLUE\')는 태깅 안 함',R("[UNFILTERED CAM] ZEROBASEONE SUNG HAN BIN(성한빈) 'BLUE' 4K | STUDIO CHOOM",'스트레이키즈',{members:['한'],with_members:['성한빈(제로베이스원)']}),r=>!r||!r.origin);
// ── 따옴표/대시 곡명 → 사전 ──
t('따옴표 — 시그니처 "방탄소년단(BTS)-Dynamite" Dance Cover',R("시그니처(cignature) - \"방탄소년단(BTS)-Dynamite\" Dance Cover",'시그니처',{with_groups:['방탄소년단']}),r=>covG(r,'방탄소년단')&&r.patch.with_groups.length===0);
t('대시 — TWICE - MORE & MORE Cover by DKB → with 트와이스를 cover_of로',R("TWICE - MORE & MORE Cover by DKB",'다크비',{with_groups:['트와이스']}),r=>covG(r,'트와이스')&&r.patch.with_groups.length===0);
t('따옴표 — Weeekly TWICE \'Feel Special\' DANCE COVER',R("Weeekly(위클리) : 이수진, 먼데이 - TWICE (트와이스) 'Feel Special' DANCE COVER🎶",'위클리',{members:['이수진','먼데이'],with_groups:['트와이스']}),r=>covG(r,'트와이스')&&r.patch.with_groups.length===0);
t('따옴표 — NAYEON "ABCD" COVER → 나연(트와이스) 솔로곡',R("NAYEON(나연) \"ABCD\" COVER by #MASHIRO #MADEIN",'메이딘',{members:['마시로']}),r=>covM(r,'나연(트와이스)'));
t('따옴표 — 커버 문맥 없어도 명시적 곡명+가요제 → 소녀시대',R("[가요대제전 #최애직캠] 엔시티 위시 사쿠야 (NCT WISH SAKUYA) – Kissing You (원곡:소녀시대) | Gayo Daejejeon 2024 | MBC250129",'엔시티 위시'),r=>covG(r,'소녀시대'));
t('대시 — Now(원곡:핑클) - 프로미스나인',R("Now(원곡:핑클) - 프로미스나인 (fromis_9) [뮤직뱅크 Music Bank] 20191018",'프로미스나인'),r=>covG(r,'핑클'));
t('평문 — 아이브 이서 BTS FAKE LOVE / MONSTA X Love Killa 롤모델 커버(그룹 저장 오류) → 원곡 방탄·몬스타엑스',R("천재아이돌 아이브 막내 이서의 파워풀한 댄스 커버  | IVE LEESEO | BTS FAKE LOVE, MONSTA X Love Killa | Role Model Cover VS",'방탄소년단',{with_members:['이서(아이브)'],with_groups:['몬스타엑스']}),r=>!!r&&r.isCover);
t('챌린지 — 위키미키 #Siesta_challenge는 위키미키 자기 곡(문별은 게스트) → 커버 아님, with 유지',R("문대표님과 함께🌙 #지수연 #엘리 #루아 #루시 & #마마무 #문별 의 #Siesta_challenge 🧡",'위키미키',{with_members:['문별(마마무)']}),r=>!r||!r.origin);
t('챌린지 — 자기 곡 챌린지(#BANGBANGchallenge on IVE)는 커버 아님',R("모르겠어요 뱅치고 싶어요 #IVE #아이브 #ANYUJIN #안유진 #BANGBANG #IVE_BANGBANG #BANGBANGchallenge #Shorts",'아이브',{members:['안유진']}),r=>!r||!r.origin);
t('챌린지 — 타 그룹 곡 챌린지(동반 표시 없음) → 원곡만, with 없음',R("#Badder_Love 🌟 Challenge #EVNNE #이븐",'이븐'),r=>r===null||!r.origin||(r.patch.with_members||[]).length===0);
t('챌린지 — #첫만남챌린지 with &TEAM MAKI → 원곡 TWS 자기 곡이면 커버 아님',R("#첫만남챌린지 🫧 with &TEAM #MAKI #andTEAM #한진 #경민 #TWS #투어스 #첫만남은계획대로되지않아 #plot_twist @andTEAM_official",'투어스',{members:['한진','경민'],with_members:['마키(앤팀)']}),r=>!r||!r.origin);
t('챌린지 — 하츠투하츠 채널에 아이브 곡? (#WifeChallenge on 아이들 자기 곡) 커버 아님',R("I make you feel so high 🤍#WifeChallenge",'아이들'),r=>!r||!r.origin);
t('챌린지 — 유니스 #너만몰라_Challenge (에이핑크 남주) → 원곡 남주 솔로 or 에이핑크',R("남주 선배님만 알아🖤 @officialapink #UNIS #Apink #NamJoo #너만몰라 #너만몰라_Challenge",'유니스',{with_members:['김남주(에이핑크)']}),r=>!r||!r.origin||covM(r,'김남주(에이핑크)')||covG(r,'에이핑크')); // 데이터에 '너만 몰라'가 없으면 null도 정답
t('챌린지 — 스테이씨 #Teddybear_Challenge with 휴닝바히에 → 자기 곡, 커버 아님',R("하루 온종일 #케플러 모습이 아른아른 아른아른 ✨💕#휴닝바히에 님과 함께한 #Teddybear_Challenge 🧸",'스테이씨',{with_members:['휴닝바히에(케플러)']}),r=>!r||!r.origin);
t('챌린지 — 크래비티 #SETNETGO_Challenge with 몬스타엑스 민혁 → 자기 곡',R("#MONSTAX #민혁 선배님과 망설일 필요 없이 지금 #SETNETGO_Challenge 🍇 #Shorts",'크래비티',{with_members:['민혁(몬스타엑스)']}),r=>!r||!r.origin);
t('챌린지 — 케플러 #Nxde_Challenge(아이들 곡, 샤오팅 출연) → 원곡 아이들',R("#Nxde_Challenge With #샤오팅 #케플러 #Kep1er #XIAOTING #GIDLE #여자아이들 #SHUHUA #슈화 #YUQI #우기 #Nxde #Shorts",'아이들',{members:['우기','슈화'],with_members:['샤오팅(케플러)']}),r=>!r||!r.origin);

// ── 제외 문맥 ──
t('제외 — BE ORIGINAL 은 커버 아님',R("[UNFILTERED CAM] IVE REI(레이) 'Baddie' 4K | BE ORIGINAL",'아이브'),r=>r===null);
t('제외 — STUDIO CHOOM ORIGINAL',R("[UNFILTERED CAM] NCT WISH JAEHEE(재희) 'COLOR' 4K | STUDIO CHOOM ORIGINAL",'엔시티 위시'),r=>r===null);
t('제외 — 잡지 커버스타',R("얼루어 10월호 커버스타 미연을 소개합니다! 로라 메르시에와 함께한 핑크빛 모먼트💗 | 얼루어코리아 Allure Korea",'베이비몬스터'),r=>r===null);
t('제외 — 언더커버셰프',R("샘 킴 보며 엄마 미소 짓는 사장님 ㅋㅋ #언더커버셰프",'드림노트'),r=>r===null);
t('제외 — Undercover(베리베리 자기 곡)',R("[안방1열 직캠4K] 베리베리 'Undercover' 풀캠 (VERIVERY Full Cam)│@SBS Inkigayo_2022.05.01.",'베리베리'),r=>r===null);
t('제외 — 자기 곡 \'Original Stage\'',R("LE SSERAFIM (르세라핌) 'EASY' l Original Stage",'르세라핌'),r=>r===null);

// ── with 정리 ──
t('with 정리 — 커버 확정+동반 신호 없음 → with 전부 비움',R("[DONGKIZ(동키즈)] 아스트로(ASTRO) - Blue Flame (JONGHYEONG ver.) | DANCE COVER",'동키즈',{with_groups:['아스트로']}),r=>covG(r,'아스트로')&&r.patch.with_groups.length===0);
t('with 정리 — 커버 확정+"X" 동반 신호 → 원곡자만 빼고 나머지 유지',R("Road to Kingdom [풀버전] ♬ Kill This Love (PTG&ONF Ver.) - 펜타곤X온앤오프 (원곡: BLACKPINK) @3차 경연 컬래버레이션",'펜타곤',{with_groups:['온앤오프','블랙핑크']}),r=>covG(r,'블랙핑크')&&r.patch.with_groups.join()==='온앤오프');
t('with 정리 — 원곡 외부(Justin Bieber)인데 with에 게스트 오인 → 비움',R("[US RECORD] Johnny Orlando - Last Christmas (Cover by 환웅)",'원어스',{members:['환웅'],with_members:['쟈니(엔시티 127)']}),r=>!!r&&r.isCover&&Array.isArray(r.patch.with_members)&&r.patch.with_members.length===0);

// ── 애매/약함 → 태깅 안 함 ──
t('약함 — 커버 문맥 없고 곡명도 없는 제목은 null',R("[SUB] 오마이걸을 위협하는 의문의 정체😱 “너도 봤어...?”ㅣ돌프라이즈ㅣOH MY GIRLㅣMBC KPOP ORIGINAL",'오마이걸'),r=>r===null);
t('약함 — 메들리 나열(BLACKPINK BTS SKZ NCT)은 원곡 1개로 확정하지 않음',R("[4K] 2020년 K-POP 띵곡 커버한 STAYC(스테이씨) | BLACKPINK BTS SKZ NCT | Cover Dance Medley | COUNTDANCE|카운트댄스",'스테이씨'),r=>!r||!r.origin||r.ambiguous);

let pass=0,fail=0;
cases.forEach(({name,row,check})=>{
  let r,ok=false,err=null;
  try{r=_coverResolve(row,{chartRows:chart});ok=check(r);}catch(e){err=e;}
  if(ok){pass++;console.log('✅ '+name);}
  else{fail++;console.log('❌ '+name);console.log('   title='+row.title);console.log('   result='+JSON.stringify(r&&{isCover:r.isCover,origin:r.origin,song:r.song,ambiguous:r.ambiguous,reason:r.reason,patch:r.patch,collab:r.collab,cands:r.candidates}));if(err)console.log('   error='+err.stack);}
});
console.log(`\n${pass}/${cases.length} 통과${fail?`, ${fail}개 실패`:''}`);
process.exit(fail?1:0);
