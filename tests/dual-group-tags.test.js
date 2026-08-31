// 겸임(이중소속) 멤버 태그 정규화 회귀 테스트 (2026-08-31 신설)
//
// 사용자 제보 — "사실상 동일인물인데 이중 소속인 친구들 더블 태깅이 너무 많이 됐다".
// 케이스는 전부 2026-08-31 실DB 표본(with_members 있는 6,000행)에서 그대로 가져왔다.
//
// ⚠️ 이 테스트가 지키는 가장 중요한 것은 **동명이인을 합치지 않는 것**이다. 세븐틴 민규와 동키즈
//    민규는 다른 사람이라 둘 다 맞을 수 있는데, 이름만 보고 합치면 멀쩡한 태그가 사라진다.
// 실행: node tests/dual-group-tags.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_normalizeMemberTags,_amtSamePerson,ARTISTS}=M;
if(!_normalizeMemberTags){console.error('_normalizeMemberTags 없음 — admin.js에서 슬라이스 실패');process.exit(2);}

let pass=0,fail=0;
function t(name,actual,expected){
  const a=JSON.stringify(actual),e=JSON.stringify(expected);
  if(a===e)pass++;else{fail++;console.error(`✗ ${name}\n    기대: ${e}\n    실제: ${a}`);}
}
const N=(o)=>_normalizeMemberTags(Object.assign({title:'',groupKo:null,members:[],withGroups:[],withMembers:[]},o)).withMembers;

// 실제로 겸임인지 데이터로 먼저 확인 — artists.json이 바뀌어 전제가 깨지면 여기서 먼저 걸린다
const has=(ko,g)=>ARTISTS.some(a=>a.name&&a.name.ko===ko&&[...(a.groups||[a.group])].some(x=>x&&x.ko===g));
t('전제 — 엄지는 비비지·여자친구 겸임',[has('엄지','비비지'),has('엄지','여자친구')],[true,true]);

// ── ① 같은 사람이 두 그룹으로 중복 → 하나로 ──
t('이진혁 업텐션/엑스원 → 하나만',
  N({title:"[MPD직캠] 이진혁 직캠 4K '활'",withMembers:['이진혁(업텐션)','이진혁(엑스원)']}).length,1);
t('마시로 메이딘/케플러 → 하나만',
  N({title:'#마시로 님과 어디서나 당당하게 걷기',withMembers:['마시로(메이딘)','마시로(케플러)']}).length,1);
t('제목에 케플러가 있으면 케플러를 고름',
  N({title:'케플러 마시로와 함께',withMembers:['마시로(메이딘)','마시로(케플러)']}),['마시로(케플러)']);
t('제목에 메이딘이 있으면 메이딘을 고름',
  N({title:'메이딘 마시로와 함께',withMembers:['마시로(메이딘)','마시로(케플러)']}),['마시로(메이딘)']);
// 제목에 근거가 없을 때 — 프로젝트/서바이벌 그룹(projectRing)보다 정규 그룹을 고른다.
// 이대휘·박우진은 artists.json 주 소속이 워너원(프로듀스101 프로젝트, 해체)이라 이 규칙이 없으면
// 현 소속인 에이비식스 대신 워너원이 남는다(2026-08-31 실측).
t('이대휘 — 워너원(프로젝트)보다 에이비식스(정규)',
  N({title:'아무 근거 없는 제목',withMembers:['이대휘(워너원)','이대휘(에이비식스)']}),['이대휘(에이비식스)']);
t('이진혁 — 엑스원(프로젝트)보다 업텐션(정규)',
  N({title:'아무 근거 없는 제목',withMembers:['이진혁(업텐션)','이진혁(엑스원)']}),['이진혁(업텐션)']);
t('김요한 — 엑스원(프로젝트)보다 위아이(정규)',
  N({title:'아무 근거 없는 제목',withMembers:['김요한(위아이)','김요한(엑스원)']}),['김요한(위아이)']);
t('제목 근거가 프로젝트 그룹을 가리키면 그건 존중',
  N({title:'워너원 시절 이대휘',withMembers:['이대휘(워너원)','이대휘(에이비식스)']}),['이대휘(워너원)']);

// ── ② members에 이미 있는 사람이 with_에도 → 제거 ──
t('비비지 영상에서 members=[엄지] + with=[엄지(여자친구)] → with 제거',
  N({title:'[페이스캠4K] 여자친구 엄지 MAGO',groupKo:'비비지',members:['엄지'],withMembers:['엄지(여자친구)']}),[]);
t('솔로 자기키도 같은 사람 — members=[승한] + with=[승한(승한)] → 제거',
  N({title:'감탄만 나오는 승한 댄스 실력',groupKo:'라이즈',members:['승한'],withMembers:['승한(승한)']}),[]);

// ── ⚠️ 동명이인은 절대 "합치지" 않는다 (합치는 것과 근거를 요구하는 것은 다른 문제) ──
t('_amtSamePerson이 동명이인을 동일인물로 보지 않음(합치기 금지의 근거)',
  _amtSamePerson('민규','세븐틴','동키즈'),false);

// ── ③ 동명이인 교차 태그는 제목에 그 그룹명이 있을 때만 ──
// 실측 124건 중 114건(92%)이 제목에 그룹명이 없었다 — 근거가 이름뿐이면 매칭이 아니라 우연이다.
t('제목에 동키즈가 없으면 민규(동키즈) 제거',
  N({title:'NINE to SIX, Don\'t Call Me 민규 포커스 [THE SHOW]',groupKo:'세븐틴',members:['민규'],withMembers:['민규(동키즈)']}),[]);
t('제목에 동키즈가 있으면 유지',
  N({title:'세븐틴 민규 X 동키즈 민규 콜라보',groupKo:'세븐틴',members:['민규'],withMembers:['민규(동키즈)']}),['민규(동키즈)']);
t('김우석 — 제목에 판타지보이즈 없으면 제거(실측 52건 유형)',
  N({title:"KIM WOO SEOK(김우석) - Sugar @인기가요 20210207",groupKo:'엑스원',members:['김우석'],withMembers:['김우석(판타지보이즈)']}),[]);
t('영문 그룹명으로도 인정(공백 무시)',
  N({title:'X1 김우석 with FANTASY BOYS',groupKo:'엑스원',members:['김우석'],withMembers:['김우석(판타지보이즈)']}).length,1);
// ⚠️ 범위 제한 — members에 같은 이름이 없으면(홈 로스터와 안 겹치면) 근거를 못 잰 구간이라 손대지 않는다
t('members에 같은 이름이 없으면 제목 근거 없어도 유지',
  N({title:'아무 제목',groupKo:'세븐틴',members:['호시'],withMembers:['민규(동키즈)']}),['민규(동키즈)']);
t('_amtSamePerson — 엄지(비비지/여자친구)는 동일인물',_amtSamePerson('엄지','비비지','여자친구'),true);
t('_amtSamePerson — 민규(세븐틴/동키즈)는 다른 사람',_amtSamePerson('민규','세븐틴','동키즈'),false);

// ── 건드리면 안 되는 정상 케이스 ──
t('서로 다른 사람 여럿은 그대로',
  N({title:'콜라보',withMembers:['카리나(에스파)','윈터(에스파)','채원(르세라핌)']}).length,3);
t('빈 배열은 빈 배열',N({}),[]);
t('완전 중복(같은 문자열)은 하나로',
  N({withMembers:['카리나(에스파)','카리나(에스파)']}),['카리나(에스파)']);
t('괄호 없는 이상 표기는 건드리지 않음',N({withMembers:['이상한값']}),['이상한값']);
t('members에 있어도 그룹이 다른 사람이면 유지',
  N({groupKo:'에스파',members:['카리나'],withMembers:['윈터(에스파)']}),['윈터(에스파)']);

// with_groups 중복 제거
t('with_groups 중복 제거(순서 유지)',
  _normalizeMemberTags({title:'',groupKo:null,members:[],withGroups:['아이브','에스파','아이브'],withMembers:[]}).withGroups,
  ['아이브','에스파']);

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
