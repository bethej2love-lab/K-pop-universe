// MV 비하인드·메이킹·리액션은 MV 탭이 아니다(2026-10-26 Codex 점검 — 에스파 MV 탭에 비하인드/리액션 다수).
// 'MV' 낱말 판정이 먼저라 전부 mv로 들어가던 것. 메이킹 영상으로 만든 정식 MV("(Making Ver.)", "Making M/V")와
// 곡 제목 'BEHIND YOU'는 진짜 MV라 남아야 한다. admin.js의 _ytClassify를 그대로 꺼내 실행한다.
const fs=require('fs'),path=require('path'),vm=require('vm');
const js=fs.readFileSync(path.join(__dirname,'..','admin.js'),'utf8');
const start=js.indexOf('const _YT_PRERECORDED_RE=');
const end=js.indexOf('// ── 세부 콘텐츠 포맷 태깅 (content_formats)');
if(start<0||end<start){console.log('❌ _ytClassify 블록을 못 찾음');process.exit(1);}
const ctx={};vm.createContext(ctx);vm.runInContext(js.slice(start,end)+';this._ytClassify=_ytClassify;',ctx);
let pass=true;
const cases=[
  ["aespa 에스파 'Spicy' MV Behind The Scenes",'other'],
  ["aespa 에스파 l 태연 TAEYEON 'Weekend' MV Reaction",'other'],
  ["MINO - '탕!♡ (TANG!♡)' M/V MAKING FILM",'other'],
  ["[EPISODE] 'ParadoXXX Invasion' MV Shoot Sketch - ENHYPEN (엔하이픈)",'other'],
  ["RIIZE 라이즈 'Lucky' MV Commentary",'other'],
  ["눈물바다 될 뻔한 10주년 뮤비 촬영 현장..?!",'other'],
  ["aespa 에스파 'Supernova' MV",'mv'],
  ["[MV] NIEL(니엘) (TEEN TOP) _ BEHIND YOU(너의 뒤에서)",'mv'],
  ["[MV] SEUNGKWAN(승관)(SEVENTEEN) _ Still You (Making Ver.)",'mv'],
  ["VICTON '그냥 나오면 돼' Making M/V",'mv'],
];
for(const[t,want]of cases){const got=ctx._ytClassify(t);if(got!==want){pass=false;console.log(`❌ ${t} → ${got} (기대 ${want})`);}else console.log(`✅ ${want.padEnd(5)} ${t}`);}
if(!pass)process.exit(1);
console.log('\n✅ MV 분류 테스트 통과');
