// 수동 편집 이력 diff(_tagLogDiff) 회귀 테스트 (2026-08-31 신설)
// 이 diff가 로그의 품질을 통째로 결정한다 — 안 바뀐 것까지 "바뀜"으로 잡으면 로그가 노이즈로 차서
// 학습 재료로 못 쓰고, 바뀐 걸 놓치면 정답 신호가 그대로 사라진다. 실행: node tests/tag-edit-log.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_tagLogDiff,_tagLogSame}=M;
if(!_tagLogDiff){console.error('_tagLogDiff 없음 — admin.js에서 슬라이스 실패');process.exit(2);}

let pass=0,fail=0;
function t(name,actual,expected){
  const a=JSON.stringify(actual),e=JSON.stringify(expected);
  if(a===e){pass++;}
  else{fail++;console.error(`✗ ${name}\n    기대: ${e}\n    실제: ${a}`);}
}

// ── 배열은 순서 무관 ──
// members는 저장할 때마다 체크박스 순서대로 나와서 순서가 자주 뒤집힌다. 순서만 다른 걸 "편집"으로
// 기록하면, 아무것도 안 고치고 저장만 눌러도 로그가 쌓인다.
t('members 순서만 다르면 변경 아님',
  _tagLogDiff({members:['카리나','윈터']},{members:['윈터','카리나']}),[]);
t('members 실제 추가는 변경',
  _tagLogDiff({members:['카리나']},{members:['카리나','윈터']}),['members']);
t('members 전부 빠짐도 변경(가장 중요한 오답 신호)',
  _tagLogDiff({members:['한']},{members:[]}),['members']);
t('빈 배열끼리는 변경 아님',_tagLogDiff({with_groups:[]},{with_groups:[]}),[]);
t('null과 빈 배열은 같게 본다(DB가 둘 다 씀)',_tagLogDiff({with_members:null},{with_members:[]}),[]);

// ── 스칼라 ──
t('content_flag null→보류는 변경',
  _tagLogDiff({content_flag:null},{content_flag:'보류'}),['content_flag']);
t('content_flag 같으면 변경 아님',_tagLogDiff({content_flag:'무관'},{content_flag:'무관'}),[]);
t('group_ko 재배정은 변경',_tagLogDiff({group_ko:'더보이즈'},{group_ko:'이즈나'}),['group_ko']);
t('undefined와 null은 같게 본다',_tagLogDiff({category:undefined},{category:null}),[]);
t('is_short false→true는 변경',_tagLogDiff({is_short:false},{is_short:true}),['is_short']);

// ── after에 없는 필드는 아예 판단 대상이 아님(일괄 편집은 손댄 필드만 넘긴다) ──
t('after에 없는 필드는 무시',
  _tagLogDiff({members:['카리나'],group_ko:'에스파'},{group_ko:'에스파'}),[]);
t('일괄 편집 — 플래그만 넘기면 플래그만 판정',
  _tagLogDiff({members:['카리나'],content_flag:null},{content_flag:'보류'}),['content_flag']);

// ── 여러 필드 동시 변경 ──
t('그룹 재배정 + 멤버 교체',
  _tagLogDiff({group_ko:'더보이즈',members:['뉴'],content_flag:null},
              {group_ko:'이즈나',members:['정세비'],content_flag:null}),['group_ko','members']);

// ── 원곡(cover_of) 필드도 잡아야 함 — 오탐 정정이 곧 학습 재료 ──
t('cover_of_groups 제거는 변경',
  _tagLogDiff({cover_of_groups:['2PM']},{cover_of_groups:[]}),['cover_of_groups']);
t('cover_of_members 유지는 변경 아님',
  _tagLogDiff({cover_of_members:['태연(소녀시대)']},{cover_of_members:['태연(소녀시대)']}),[]);

// ── before가 통째로 없을 때(조회 실패) 방어 ──
t('before 없으면 after에 있는 값만 변경으로',
  _tagLogDiff(undefined,{members:['카리나']}),['members']);
t('before 없고 after도 빈 값이면 변경 없음',_tagLogDiff(undefined,{members:[]}),[]);

// ── _tagLogSame 직접 ──
t('_tagLogSame 배열 순서 무관',_tagLogSame(['a','b'],['b','a']),true);
t('_tagLogSame 길이 다르면 다름',_tagLogSame(['a'],['a','b']),false);
t('_tagLogSame 스칼라',_tagLogSame('보류','보류'),true);

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
