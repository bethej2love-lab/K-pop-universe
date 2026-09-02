// 멤버 표시 이름(_dispName) 회귀 테스트 (2026-09-02 신설)
//
// 배경: 트레저 5명의 성 포함 활동명(현석→최현석 등)을 displayName으로 넣었는데, 표시 지점마다
// `currentLang==='ko'?a.name.ko:(a.name.en||a.name.ko)`를 각자 손으로 쓰고 있어서 **멤버 카드에만**
// 반영되고 그룹 카드·인덱스·칩·검색은 옛 이름 그대로였다(사용자 제보: "그룹 카드 표기도 통일해야지").
// 표시를 _dispName 하나로 모으고, 여기서 두 가지를 지킨다:
//   ① 동작 — displayName이 있으면 한국어에서 그걸 쓰고, 영어에선 영문명을 그대로 쓴다.
//   ② 드리프트 — 손으로 쓴 옛 패턴이 다시 생기지 않는지(새 표시 지점을 만들 때 재발하기 쉬움).
//
// 실행: node tests/disp-name.test.js

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

let pass=0,fail=0;
const ok=m=>{pass++;console.log(`✅ ${m}`);};
const bad=(m,d)=>{fail++;console.log(`❌ ${m}`);if(d)console.log('   '+d);};
const need=(c,m,d)=>c?ok(m):bad(m,d);

function slice(re,label){
  const m=re.exec(src);
  if(!m)throw new Error(`선언을 못 찾음: ${label}`);
  let i=src.indexOf('{',m.index),depth=0;
  for(;i<src.length;i++){
    if(src[i]==='{')depth++;
    else if(src[i]==='}'){depth--;if(depth===0){i++;break;}}
  }
  return src.slice(m.index,i);
}

// ── ① 동작 ────────────────────────────────────────────────────────────────
const ctx={currentLang:'ko'};
vm.createContext(ctx);
vm.runInContext(slice(/function _dispKo\(/,'_dispKo'),ctx);
vm.runInContext(slice(/function _dispName\(/,'_dispName'),ctx);
need(typeof ctx._dispName==='function','_dispName 로드됨');

const hs={name:{ko:'현석',en:'Choi Hyunsuk'},displayName:'최현석'};   // 트레저 — 성 포함 활동명
const ji={name:{ko:'지훈',en:'Jihoon'}};                              // 활동명 없음
const noEn={name:{ko:'하루토'}};                                       // 영문명 없음
const dk={name:{ko:'도경수',en:'Doh Kyungsoo'},displayName:'디오'};    // 활동명이 본명과 아예 다른 경우

ctx.currentLang='ko';
need(ctx._dispName(hs)==='최현석','한국어 — displayName이 있으면 그걸 쓴다',ctx._dispName(hs));
need(ctx._dispName(ji)==='지훈','한국어 — displayName이 없으면 name.ko',ctx._dispName(ji));
need(ctx._dispName(dk)==='디오','한국어 — 본명과 다른 활동명도 그대로',ctx._dispName(dk));

ctx.currentLang='en';
need(ctx._dispName(hs)==='Choi Hyunsuk','영어 — 한글 활동명이 영문 표기를 덮지 않음',ctx._dispName(hs));
need(ctx._dispName(dk)==='Doh Kyungsoo','영어 — displayName이 있어도 영문명 우선',ctx._dispName(dk));
need(ctx._dispName(noEn)==='하루토','영어 — 영문명이 없으면 name.ko로 폴백',ctx._dispName(noEn));
need(ctx._dispName(null)===''&&ctx._dispName(undefined)==='','아티스트가 없으면 빈 문자열(예외 안 남)');
ctx.currentLang='ko';

// ⚠️ 표기용 displayName이 식별자(name.ko)를 대체하면 안 된다 — DB members 배열과 즐겨찾기 키
//    (`그룹:name.ko`)가 name.ko를 쓰므로, 바뀌는 순간 그 멤버 카드의 영상이 통째로 빈다.
need(hs.name.ko==='현석','displayName은 표기 전용 — name.ko는 식별자로 그대로 남음');

// ── ② 드리프트 방지 ───────────────────────────────────────────────────────
// 손으로 쓴 옛 패턴: `currentLang==='ko'?X.name.ko:(X.name.en||X.name.ko)` / `isKo?…` 변형.
const legacy=[...src.matchAll(/(?:currentLang==='ko'|isKo)\?([A-Za-z_][A-Za-z0-9_.]*)\.name\.ko:\(\1\.name\.en\|\|\1\.name\.ko\)/g)];
need(legacy.length===0,
  `표시 지점이 전부 _dispName을 거침 (손으로 쓴 옛 패턴 ${legacy.length}곳)`,
  legacy.slice(0,5).map(m=>m[0]).join('  |  '));

// 그룹 카드 멤버 목록(사용자가 제보한 바로 그 지점)이 실제로 _dispName을 쓰는가
const gc=slice(/function _renderGcMemberList\(/,'_renderGcMemberList');
need(/_dispName\(/.test(gc),'그룹 카드 멤버 목록이 _dispName을 사용');
need(!/textContent=currentLang==='ko'\?m\.name\.ko/.test(gc),'그룹 카드에 옛 직접 표기가 남아있지 않음');

// 멤버 카드 이름도 같은 헬퍼 계열을 쓰는가(_dispKo/_dispName 둘 다 허용 — 같은 값을 낸다)
need((src.match(/_dispName\(/g)||[]).length>=15,
  `_dispName이 표시 지점 전반에 퍼져 있음 (${(src.match(/_dispName\(/g)||[]).length}곳)`);

console.log(`\n${pass}/${pass+fail} 통과${fail?`, ${fail}개 실패`:''}`);
process.exit(fail?1:0);
