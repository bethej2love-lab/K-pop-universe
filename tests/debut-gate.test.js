// 데뷔 이전 게이트 회귀 테스트 (2026-08-31 신설)
//
// "영상이 그룹 데뷔보다 한참 전에 올라왔으면 그 그룹일 수 없다."
// 케이스는 2026-08-31 실DB 실측(2016년 이전 12,536건)에서 그대로 가져왔다. 최대 오염이
// `아이들`(2018 데뷔)에 붙은 제국의 아이들(ZE:A) 2012년 영상 97건이었고, 이건 B.I⊂B.I.G와 같은
// 부분문자열 충돌이다 — 게이트의 값어치는 연도 필터가 아니라 **오배정 탐지**에 있다.
// 실행: node tests/debut-gate.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_m2DebutBlocks,_m2ParseTitle,GROUPS}=M;
if(!_m2DebutBlocks){console.error('_m2DebutBlocks 없음 — admin.js에서 슬라이스 실패');process.exit(2);}

let pass=0,fail=0;
function t(name,actual,expected){
  const a=JSON.stringify(actual),e=JSON.stringify(expected);
  if(a===e)pass++;else{fail++;console.error(`✗ ${name}\n    기대: ${e}\n    실제: ${a}`);}
}

// 전제 — 데이터가 바뀌어 테스트가 무의미해지면 여기서 먼저 걸린다
t('전제 — 아이들 데뷔 2018',String(GROUPS['아이들'].debut).slice(0,4),'2018');
t('전제 — 268개 그룹 전부 debut 파싱 가능',
  Object.values(GROUPS).every(g=>/^\d{4}$/.test(String(g.debut).slice(0,4))),true);

// ── 게이트 판정 자체 ──
t('2012년 영상 + 2018 데뷔 → 차단',_m2DebutBlocks('아이들','2012-01-26'),true);
t('2015년 영상 + 2018 데뷔 → 통과(여유 3년 안)',_m2DebutBlocks('아이들','2015-06-01'),false);
t('2014년 영상 + 2018 데뷔 → 차단(여유 3년 밖)',_m2DebutBlocks('아이들','2014-12-31'),true);
t('데뷔 후 영상은 당연히 통과',_m2DebutBlocks('아이들','2019-01-01'),false);
t('published_at 없으면 판정 안 함',_m2DebutBlocks('아이들',null),false);
t('GROUPS에 없는 키(솔로 자기키)는 대상 아님',_m2DebutBlocks('아이유','2012-01-01'),false);

// ── 실제 오염 사례가 막히는가 ──
const gko=(title,pub)=>{const r=_m2ParseTitle(title,undefined,undefined,pub);return r?r.primaryGroup:null;};
t('제국의 아이들 2012 영상이 아이들로 안 감',
  gko('ZE:A - Mazeltov (제국의 아이들 -  Mazeltov) @ SBS Inkigayo 인기가요 100221','2012-01-26')==='아이들',false);
t('제국의 아이들 2012 영상 — 다른 사례',
  gko('Z:EA - Level Up (제국의 아이들 - 이별 드립) @ SBS Inkigayo 인기가요 100725','2012-01-31')==='아이들',false);
t('엔하이픈(2020 데뷔)에 2014 박재범 영상 안 감',
  gko('[4가지쇼] 지인들이 말하는 인간 박재범 Jay Park, 천사재범!','2014-04-02')==='엔하이픈',false);

// ── ⚠️ 정상 영상은 그대로 잡혀야 한다(게이트가 과잉이면 여기서 걸린다) ──
t('아이들 데뷔 후 영상은 정상 매칭',
  gko("(여자)아이들 - 'TOMBOY' 무대",'2022-03-14'),'아이들');
t('데뷔 직전 오디션 영상(여유 3년 안)은 살아남음 — 엔하이픈 I-LAND 2020',
  gko('[I-LAND] 엔하이픈 데뷔 무대','2020-09-18'),'엔하이픈');
t('published_at을 안 주면 게이트가 개입하지 않음',
  gko("(여자)아이들 - 'TOMBOY' 무대",undefined),'아이들');

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
