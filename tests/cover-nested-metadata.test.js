// 중첩 feat/prod 크레딧의 사람·소속 이름이 곡 별칭으로 색인되지 않아야 한다.
const assert=require('assert'),M=require('../tools/m2_harness').load(),keys=M._coverSongKeys;let fail=0,n=0;
const cases=[
 ['Be Natural (Feat. SR14B \'TAEYONG (태용)\')',['be natural']],
 ['Traveler (Feat. 지코(ZICO))',['traveler']],
 ['Merry-Go-Round (Prod. 조원상(LUCY), DINT (HIGHBRID))',['merry go round']],
 ['Oops!! (Feat. f(x))',['oops']],
 ['Ma Boy (Ma Girl) (Prod. LAS (라스))',['ma boy','ma girl']],
 ['Ma Boy (Ma Girl) (Prod. LAS (라스)) (Inst.)',['ma boy','ma girl']],
 ['꿈 (Feat. 승연 (Luizy))',[]], // 기존 두 글자 최소 키 정책, 원본 트랙 삭제 아님
 ['소원을 말해봐 (Genie)',['소원을 말해봐','genie']],
 ['Fact Check (불가사의; 不可思議)',['fact check','불가사의 不可思議']],
 ['Song [Feat. Guest (Alias)]',['song']],
 ['Song 【Prod. Guest (Alias)】',['song']],
 ['Song （Feat. Guest （Alias））',['song']],
 ['Song (Feat.Guest (Alias)) (안녕)',['song','안녕']],
 ['Song (With Guest (Alias))',['song']],
 ['Song (FTISLAND (Korea))',['song ftisland']],
 ['Song (FT아일랜드 (Korea))',['song ft아일랜드']],
 ['Song (Artist (Name))',['song artist','name']],
 ['Song (Feat. Guest (Alias)',['song feat guest','alias']],
 ['Song (Feat. Guest [Alias)',['song feat guest','alias']],
 ['',[]],[null,[]],
];
for(const [raw,want]of cases){n++;try{assert.deepEqual(keys(raw),want);}catch(e){fail++;console.error('FAIL '+JSON.stringify(raw)+': '+JSON.stringify(keys(raw))+' expected '+JSON.stringify(want));}}
// 공식 빌리 커버 제목이 피처링 본명(HAON) 인덱스를 통해 전혀 다른 곡으로 연결되던 실제 경로.
n++;try{const r=M._coverResolve({title:"Billlie | 김하온 (HAON) '붕붕 (Feat. 식케이)' Rap COVER | COVERED BY MOON SUA , SIYOON",group_ko:'빌리',members:['문수아','시윤'],with_members:[],with_groups:[],cover_of_members:[],cover_of_groups:[],published_at:'2021-10-22'});assert(!r?.origin,'라비의 STILL NIRVANA는 명시된 붕붕 원곡이 아님');assert(!r?.patch?.group_ko&&!r?.patch?.members,'공연자 귀속 변경 없음');}catch(e){fail++;console.error('FAIL 붕붕 원곡: '+e.message);}
console.log(`${n}검사 / ${fail}실패`);if(fail)process.exitCode=1;
