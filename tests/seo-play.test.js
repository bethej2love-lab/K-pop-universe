// 정적 페이지 영상 페이지 안 재생(seo_play.js, 2026-11-04) — 빌더의 모든 정적 템플릿이 이 파일을 불러오는지, 파일이 문법적으로 맞는지.
// 동작(카드 클릭→재생창·다음 영상·뒤로가기) 자체는 헤드리스로 확인했다(CHANGELOG 2026-11-04). 실행: node tests/seo-play.test.js
const fs=require('fs'),path=require('path');const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const b=fs.readFileSync(path.join(ROOT,'build_group_pages.js'),'utf8');
const ga=(b.match(/gtag\('config','G-Z5NTV6X3YF'\)/g)||[]).length,sp=(b.match(/<script src="\/seo_play\.js" defer><\/script>/g)||[]).length;
if(ga>0&&ga===sp)ok(`정적 템플릿 ${ga}개 모두 /seo_play.js를 불러옴`);else bad(`gtag 템플릿 ${ga}개 중 seo_play ${sp}개`);
const src=fs.readFileSync(path.join(ROOT,'seo_play.js'),'utf8');
try{new Function(src);ok('seo_play.js 문법');}catch(e){bad('seo_play.js 문법 '+e.message);}
if(/youtube-nocookie\.com\/embed\//.test(src)&&/metaKey\|\|e\.ctrlKey/.test(src)&&/pushState/.test(src))ok('공식 임베드 · 새 탭 클릭은 가로채지 않음 · 뒤로가기로 닫힘');else bad('seo_play 핵심 동작 누락');
console.log(`\n${pass} 통과 / ${fail} 실패`);if(fail)process.exitCode=1;
