// 한 글자 영문 이름 멤버 오태깅 회귀 테스트 (2026-10-20)
// 앤팀 케이(K)·방탄 뷔(V)·더보이즈 큐(Q)·빅스 엔(N)·인피니트 엘(L)·골든차일드 Y·스테이씨 재이(J)·블랭키 유(U)는
// 토큰 대조로 "K-POP"·"KCON 'K' Festival"·"#k_link_Festival"·"M/V"·"Q&A"·제목 구분자 " l "에서 잡혔다
// (순찰 표본: 앤팀 케이만 붙은 영상 424건 대부분). 대문자 한 글자가 홀로 있을 때만 인정한다.
// 실행: node tests/single-letter-names.test.js
const {load}=require('../tools/m2_harness');
const {ARTISTS}=require('../tools/matcher_harness.cjs');
const M=load();
const ag=a=>a.groups||[a.group];
const roster=g=>ARTISTS.filter(a=>ag(a).some(x=>x.ko===g)).map(a=>{const e=ag(a).find(x=>x.ko===g)||{};const st=[e.name,e.nameEn].filter(Boolean);return{ko:a.name.ko,en:a.name.en,left:(e.left!==undefined?e.left:a.left),aliases:st.length?[...(a.matchAliases||[]),...st]:a.matchAliases};});
let fail=0;
const t=(g,m,title,desc,want,why)=>{const got=M._atmResolveMembers(title,desc||'',roster(g),g).includes(m);
  if(got===want)console.log('✓',why);else{fail++;console.log('✗',why,'— 기대',want,'실제',got);}};
// 잡으면 안 되는 것
t('앤팀','케이',"[MCD Summer Camp] &TEAM (앤팀) - Bewitched (Korean ver.)",'World No.1 K-POP Chart Show M COUNTDOWN',false,'설명란 K-POP');
t('앤팀','케이',"[KCON JAPAN 2026] &TEAM - We on Fire",'Every ‘K’ Festival ‘KCON JAPAN 2026’',false,"KCON 구호 'K' Festival");
t('앤팀','케이',"[K-Choreo 8K] 앤팀 'We on Fire' (&TEAM Choreography)",'',false,'K-Choreo·8K');
t('앤팀','케이',"[Go ONE!!!] EP.6 \"지금부터 영어 금지!\" 오케이~ - &TEAM",'',false,'오케이(오+케이 성씨 오인)');
t('방탄소년단','뷔',"방탄소년단 '상남자' 미국판 M/V 최초공개!",'',false,'M/V');
t('더보이즈','큐',"더보이즈(THE BOYZ) 밤편지! Q&A 게임",'',false,'Q&A');
t('인피니트','엘',"[Weekly Idol] 인피니트 랜덤 플레이 댄스!! l EP.152",'',false,'제목 구분자 l');
// 잡아야 하는 것
t('앤팀','케이',"[MPD직캠] &TEAM K FanCam",'',true,'&TEAM K FanCam');
t('앤팀','케이',"&TEAM Mood Video",'#K #YUMA #MAKI',true,'#K 해시태그');
t('방탄소년단','뷔',"[BANGTAN BOMB] BTS does a funny imitation of V. - BTS",'',true,'문장 끝 V.');
t('방탄소년단','뷔',"3 DAYS IN LA l V’s VLOG",'',true,'V’s 소유격');
t('방탄소년단','뷔',"[BANGTAN BOMB] V&Jungkook Singing at standby time",'',true,'V&Jungkook');
t('방탄소년단','뷔',"방탄소년단 뷔 아이컨택 모음 #BTS_V",'',true,'#BTS_V');
t('빅스','엔',"[2017 ISAC] VIXX 'LEO' Humiliating His Members 'N & Hyuk'",'',true,"'N & Hyuk'");
t('골든차일드','Y',"골든차일드 Y&이장준&배승민 메들리 댄스",'',true,'Y&이장준');
// 외부 역추론: #k_link_Festival 꼬리표가 붙은 다른 그룹 쇼츠를 앤팀으로 만들지 않는다
const r=M._m2ParseTitle("남들과 다른 ITZY걸크러쉬에 홀리는 중 #shorts #visitkoreayear #한국방문의해 #k_link_Festival",undefined,false);
if(!r||r.primaryGroup!=='앤팀')console.log('✓ #k_link_Festival은 앤팀 역추론 근거 아님');else{fail++;console.log('✗ #k_link_Festival이 앤팀으로 역추론됨');}
console.log(fail?`\n❌ ${fail} 실패`:'\n✅ 0 실패');process.exit(fail?1:0);
