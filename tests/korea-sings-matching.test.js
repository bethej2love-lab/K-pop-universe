// 전국노래자랑 실제 오수집19행 + 정상 문맥7행. 운영 API/DB 쓰기 없음.
// 실행: node tests/korea-sings-matching.test.js
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {_m2ParseTitle}=require('../tools/matcher_harness.cjs');
const alternate=require('../tools/m2_harness.js').load()._m2ParseTitle;
let n=0,failed=0;function check(label,fn){n++;try{fn();}catch(e){failed++;console.error('FAIL '+label+': '+e.message);}}
const negatives=[
  {
    "id": "8ubddys0YcQ",
    "title": "동작구를 뒤집으러 온! 김수민, 신현경, 신혜원, 전화진, 구은정 씨의 날 봐 귀순 + 서커스 [전국 노래자랑/Korea Sings] | KBS 261101 방송",
    "date": "2026-11-01",
    "oldGroup": "트리플에스"
  },
  {
    "id": "GUI53-v5Ui4",
    "title": "초대가수 진성 씨의 소금꽃 [전국 노래자랑/Korea Sings] | KBS 261101 방송",
    "date": "2026-11-01",
    "oldGroup": "정진성"
  },
  {
    "id": "Ls0kXbUD-mA",
    "title": "초대가수 유민 씨의 야 좋냐 [전국 노래자랑/Korea Sings] | KBS 261101 방송",
    "date": "2026-11-01",
    "oldGroup": "올아워즈"
  },
  {
    "id": "pBTJO7xCGOk",
    "title": "동작이 낳은 동작 아이들! 김민혁, 김산 씨의 달빛 창가에서 [전국 노래자랑/Korea Sings] | KBS 261101 방송",
    "date": "2026-11-01",
    "oldGroup": "아이들"
  },
  {
    "id": "IgZDyN_xIP8",
    "title": "가야금은 뜯고! 무대는 씹어 먹고! 오승아 양의 고추 + 가야금 연주 [전국 노래자랑/Korea Sings] | KBS 261025 방송",
    "date": "2026-10-25",
    "oldGroup": "오승아"
  },
  {
    "id": "yXf--Jm9WNc",
    "title": "60대 싸이! 서동조 씨의 나팔바지 + Bad Case Of Loving You [전국 노래자랑/Korea Sings] | KBS 261025 방송",
    "date": "2026-10-25",
    "oldGroup": "싸이"
  },
  {
    "id": "q2iJmYCp2DM",
    "title": "특공! 경찰특공대! 김한진 씨의 타잔 [전국 노래자랑/Korea Sings] | KBS 261018 방송",
    "date": "2026-10-18",
    "oldGroup": "올데이프로젝트"
  },
  {
    "id": "HllVwm_UsVI",
    "title": "초대가수 신유 씨의 줄리엣 [전국 노래자랑/Korea Sings] | KBS 261018 방송",
    "date": "2026-10-18",
    "oldGroup": "투어스"
  },
  {
    "id": "WLqovvMQmj0",
    "title": "부안 끼쟁이! 문하은 씨의 엄지 척 [전국 노래자랑/Korea Sings] | KBS 261018 방송",
    "date": "2026-10-18",
    "oldGroup": "비비지"
  },
  {
    "id": "rL30-GKzwyE",
    "title": "부안의 싸이! 김현민 씨의 나팔바지 + 댄스 [전국 노래자랑/Korea Sings] | KBS 261018 방송",
    "date": "2026-10-18",
    "oldGroup": "싸이"
  },
  {
    "id": "oMnlJebbOoY",
    "title": "세계적인 성악가가 될 뻔한! 김천아 씨의 아름다운 나라 + 10월의 어느 멋진 날에 [전국 노래자랑/Korea Sings] | KBS 261011 방송",
    "date": "2026-10-11",
    "oldGroup": "나라"
  },
  {
    "id": "jT9rqJNNN_o",
    "title": "제주의 장원영! 송지연 씨의 뿜뿜 + 댄스 [전국 노래자랑/Korea Sings] | KBS 261004 방송",
    "date": "2026-10-04",
    "oldGroup": "아이브"
  },
  {
    "id": "sjRB-HwMvp4",
    "title": "외모는 백점 흥은 만점! 이승범, 이찬, 이준 씨의 달빛 창가에서 [전국 노래자랑/Korea Sings] | KBS 261004 방송",
    "date": "2026-10-04",
    "oldGroup": "다크비"
  },
  {
    "id": "Te9pVOV6psU",
    "title": "초대가수 진성 씨의 소금꽃 [전국 노래자랑/Korea Sings] | KBS 261004 방송",
    "date": "2026-10-04",
    "oldGroup": "정진성"
  },
  {
    "id": "xA9BlMs6Pxc",
    "title": "10년 지기 중학교 친구들! 김연재, 김예진, 김재현, 최은주, 정수빈 씨의 애상 [전국 노래자랑/Korea Sings] | KBS 260920 방송",
    "date": "2026-09-20",
    "oldGroup": "정수빈"
  },
  {
    "id": "ojuHOKVjayk",
    "title": "낭랑 18세! 김다빈, 박다원, 장지유, 김나영, 남승유, 양서윤, 이수 양의 찐이야 [전국 노래자랑/Korea Sings] | KBS 260913 방송",
    "date": "2026-09-13",
    "oldGroup": "김나영"
  },
  {
    "id": "X2WXq5R1p3Q",
    "title": "초대가수 유민 씨의 야 좋냐 [전국 노래자랑/Korea Sings] | KBS 260913 방송",
    "date": "2026-09-13",
    "oldGroup": "올아워즈"
  },
  {
    "id": "-ZUQd4tusHs",
    "title": "트로트를 사랑하는! 김재이 양의 흥 아리랑 [전국 노래자랑/Korea Sings] | KBS 260913 방송",
    "date": "2026-09-13",
    "oldGroup": "김재이"
  },
  {
    "id": "H0yfc6wXpDw",
    "title": "초대가수 신유 씨의 줄리엣 [전국 노래자랑/Korea Sings] | KBS 260906 방송",
    "date": "2026-09-06",
    "oldGroup": "투어스"
  }
];
for(const v of negatives)for(const strict of [false,true])for(const owner of [undefined,v.oldGroup]){
 check(v.id+' strict='+strict+' saved='+owner,()=>{const r=_m2ParseTitle(v.title,owner,strict,v.date);
 assert(!r||r.hold&&!r.primaryGroup&&!r.withGroups.length&&!Object.keys(r.membersByGroup).length,JSON.stringify(r));});
}
const controls=[
  {
    "id": "c7Xd3SHcZbU",
    "title": "아프지 않은 이별은 없다 - 전국노래자랑 디노 직캠 #dino",
    "date": "2026-06-28",
    "group": "세븐틴"
  },
  {
    "id": "2NinSiAxih8",
    "title": "260627 전국노래자랑 세븐틴 디노 - 아프지 않은 이별은 없다 DINO focus seventeen svt 디노 직캠",
    "date": "2026-06-27",
    "group": "세븐틴"
  },
  {
    "id": "NXaROBpKRjc",
    "title": "전국노래자랑 아스테룸 편🎤 노아&하민의 진또배기 트로트 대전 라이브 풀버전💜🖤｜#플레이브 PLAVE｜Noah & Hamin Live Full Ver.",
    "date": "2023-05-19",
    "group": "플레이브"
  },
  {
    "id": "-LN_SU_dFBY",
    "title": "[PLAY TIME🎵] 진우피셜. 전국노래자랑처럼 즐겨줬으면 하는 무대💝  | 팀 14시 | 1R 라이벌 매치 풀캠 리액션 | 피크타임 | PEAK TIME",
    "date": "2023-03-17",
    "group": null
  },
  {
    "id": "_5IxGf26N7U",
    "title": "[오! 이사벨] 오마이걸 승희, 전국노래자랑 출신? 자옥아 한소절 라이브![두시의 데이트 지석진입니다] 20180118",
    "date": "2018-01-18",
    "group": "오마이걸"
  },
  {
    "id": "GYhNpdJMedI",
    "title": "유희열의 스케치북 Yu Huiyeol's Sketchbook - 여자친구 은하, 전국노래자랑 가상체험 트로트 열창.20170311",
    "date": "2017-03-11",
    "group": "여자친구"
  },
  {
    "id": "Qu6Ox_MOOuI",
    "title": "[EXID(이엑스아이디)] 추석특집 아이돌 전국 노래자랑",
    "date": "2015-10-01",
    "group": "이엑스아이디"
  }
];
for(const v of controls)check('기존 정상 문맥 '+v.id,()=>{const r=_m2ParseTitle(v.title,undefined,false,v.date);assert.equal(r&&r.primaryGroup,v.group);assert(!r||!r.hold);});
for(const v of [...negatives,...controls])check('두 실제 코드 하네스 일치 '+v.id,()=>{assert.deepEqual(alternate(v.title,undefined,false,v.date),_m2ParseTitle(v.title,undefined,false,v.date));});
const synthetic=[
 ['초대가수 세븐틴 디노 씨의 엄지 척 [전국 노래자랑/Korea Sings] | KBS 261101 방송','세븐틴','디노'],
 ['초대가수 투어스 신유 씨의 타잔 [전국노래자랑] | KBS 261101 방송','투어스','신유'],
 ['초대가수 ALL(H)OURS 유민 씨의 야 좋냐 [전국 노래자랑/Korea Sings]','올아워즈','유민'],
 ['초대가수 아이들 미연 씨의 소나기 [전국 노래자랑/Korea Sings]','아이들','미연'],
 ['초대가수 오마이걸 씨의 비밀정원 [전국 노래자랑/Korea Sings]','오마이걸',null],
 ['[전국 노래자랑/Korea Sings] 초대가수 세븐틴 디노 씨의 엄지 척 | KBS 방송','세븐틴','디노'],
 ['아이돌 전국노래자랑 투어스 신유 직캠','투어스','신유'],
 ['올아워즈 유민 직캠','올아워즈','유민']
];
for(const [title,g,m]of synthetic)check('출연 명시 보존 '+title,()=>{const r=_m2ParseTitle(title,undefined,false,'2026-11-01');assert.equal(r&&r.primaryGroup,g);assert(!r.hold);if(m)assert(r.membersByGroup[g].includes(m));assert(!r.withGroups.includes('비비지')&&!r.withGroups.includes('올데이프로젝트'));});
for(const title of [
 '아이브 장원영 닮은! 송지연 씨의 LOVE DIVE [전국 노래자랑/Korea Sings]',
 '아이들 좋아하는! 김민혁 씨의 TOMBOY [전국 노래자랑/Korea Sings]',
 '김한진 씨의 세븐틴 디노 [전국 노래자랑/Korea Sings]',
 '초대가수 #유민 씨의 야 좋냐 [전국 노래자랑/Korea Sings]',
 '초대가수 유민 - 야 좋냐 [전국 노래자랑/Korea Sings]'
])check('그룹/태그가 수식어·곡에만 있음 '+title,()=>{const r=_m2ParseTitle(title,undefined,false,'2026-11-01');assert(!r||r.hold&&!r.primaryGroup);});
for(const title of ['초대가수 싸이 씨의 나팔바지 [전국 노래자랑/Korea Sings]','[전국노래자랑] 초대가수 유민 씨의 야 좋냐'])check('이름만으로는 실제 출연 신원 미확정 '+title,()=>{const r=_m2ParseTitle(title,undefined,false,'2026-11-01');assert(r&&r.hold&&!r.primaryGroup);});
check('관련 인물이 전혀 없는 일반 참가자를 전부 검수 큐에 쌓지 않음',()=>{assert.equal(_m2ParseTitle('동작의 아들! 손영기 씨의 흥 아리랑 [전국 노래자랑/Korea Sings]'),null);});
// 실제 외부 채널 행 빌더까지 실행. 주변 헬퍼만 격리하며 매처는 실코드를 쓴다.
const src=fs.readFileSync(require.resolve('../admin.js'),'utf8'),start=src.indexOf('function _extBuildRows('),end=src.indexOf('\n}',start)+2;
const build=vm.runInNewContext(src.slice(start,end)+';_extBuildRows',{
 _m2ParseTitle,_extOwnerGko:o=>o&&o.gko,
 _classifyGuestGroup:(sec)=>({asGroup:!sec.length,extraMembers:sec}),
 _normalizeMemberTags:x=>({withGroups:x.withGroups,withMembers:x.withMembers}),
 _soloReattribGko:()=>null,_titleNorm:t=>t,_shouldJunkFlag:()=>false,
 _flagPatch:(content_flag,flag_source,extra)=>({content_flag,flag_source,...extra}),_coverResolve:()=>null
});
check('신규 동기화: 유민 동명이인은 소속 확정 없이 보류, NOT NULL 핸들',()=>{const v=negatives.find(v=>v.id==='Ls0kXbUD-mA');const out=build([{...v,published_at:v.date}],false,'music',null,'none','LegendKpop');
 assert.equal(out.rows.length,1);const r=out.rows[0];assert.equal(r.group_ko,'LegendKpop');assert.equal(r.content_flag,'보류');assert.equal(r.needs_review,true);assert.equal(r.members.length+r.with_groups.length+r.with_members.length,0);});
check('신규 동기화: 일반명사 아이들/곡명 타잔은 다른 그룹으로 저장하지 않음',()=>{for(const id of ['pBTJO7xCGOk','q2iJmYCp2DM']){const v=negatives.find(v=>v.id===id),out=build([{...v,published_at:v.date}],false,'music',null,'none','LegendKpop');assert(out.rows.every(r=>r.group_ko==='LegendKpop'&&r.content_flag==='보류'));}});
check('전용 팬채널 소유자는 프로그램명 때문에 삭제/보류하지 않음',()=>{const v=negatives.find(v=>v.id==='Ls0kXbUD-mA');const r=build([{...v,published_at:v.date}],false,'fans',{gko:'세븐틴',mko:'디노'},'none','owned').rows[0];assert.equal(r.group_ko,'세븐틴');assert.equal(r.members[0],'디노');assert(!r.content_flag);});
console.log('korea-sings-matching: '+(n-failed)+' passed, '+failed+' failed');if(failed)process.exitCode=1;
