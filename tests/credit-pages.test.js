// 작사·작곡 페이지(build_group_pages.js buildCreditPages, 2026-11-04 검색 유입 ⑨) — 실제 artists.json·artist_credits.json으로
// 페이지 수·주소·제목·버전 묶기·한국어 조사를 본다. 빌더 전체는 DB가 필요해, 해당 블록만 떼어 vm에서 돌린다. 실행: node tests/credit-pages.test.js
const fs=require('fs'),path=require('path'),vm=require('vm');const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;const ok=m=>{pass++;console.log('✅ '+m)},bad=m=>{fail++;console.log('❌ '+m)};
const src=fs.readFileSync(path.join(ROOT,'build_group_pages.js'),'utf8');
const a=src.indexOf('// ── 작사·작곡 페이지'),b=src.indexOf('// ── 앨범 페이지');
if(a<0||b<a){bad('작사·작곡 블록을 못 찾음');process.exit(1);}
const pick=name=>{const i=src.indexOf('function '+name+'(');let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'){d--;if(!d)return src.slice(i,k+1);}}};
const pages=[];
const ctx={require,fs,path,ROOT,SEO:require('../tools/seo_extra.js'),console:{log(){}},
  artists:JSON.parse(fs.readFileSync(path.join(ROOT,'artists.json'),'utf8')),groups:JSON.parse(fs.readFileSync(path.join(ROOT,'groups.json'),'utf8')),
  SONGS:{},SITE:'https://kpop-universe.kr',escHtml:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  simplePageHtml:o=>o,writeSimple:(rel,o)=>pages.push({rel,...o}),ogImageForMember:()=>'',songPagePath:(g,b,l)=>`g/${g}/s/${b}/`};
vm.createContext(ctx);
const jA=src.indexOf('const JOSA_READ_AS_WORD'),jB=src.indexOf('\n}',src.indexOf('function josa('))+2; // 조사 판정 상수~josa 함수(빌더 그대로)
ctx.soloSuffix=()=>({ko:'',en:''}); // 솔로 동명이인 꼬리는 이 검사 범위 밖
vm.runInContext(src.slice(jA,jB)+'\n'+['urlSafeKo','slugify','memberPagePath'].map(pick).join('\n')+'\n'+src.slice(a,b),ctx);
vm.runInContext('buildCreditPages()',ctx);
// Profile facts and detailed collections must use the exact same catalog for every generated artist.
const seo=require('../tools/seo_extra.js'),staticData=seo.loadStatic(ROOT);
let compared=0;
for(const artist of ctx.artists){
  const catalog=ctx.creditsFor(artist);if(!catalog)continue;
  const facts=seo.memberExtra(artist,artist.group.ko,'ko',{top:{},memberWins:{}},staticData,catalog).facts.join(' ');
  if((catalog.ly.length&&!facts.includes(`작사 ${catalog.ly.length}곡`))||(catalog.co.length&&!facts.includes(`작곡 ${catalog.co.length}곡`)))bad('프로필/상세 곡수 '+artist.name.ko);
  compared++;
}
if(compared>500)ok('프로필·상세 크레딧 공통 집계 '+compared+'명');else bad('집계 대조 대상 부족 '+compared);
const ko=pages.filter(p=>p.lang==='ko'),en=pages.filter(p=>p.lang==='en');
if(ko.length>300&&ko.length===en.length)ok(`작사·작곡 페이지 ${ko.length}명 × 2개 언어`);else bad(`페이지 수 ko ${ko.length} en ${en.length}`);
const w=ko.find(p=>p.rel==='g/스트레이키즈/방찬/credits/');
if(w&&/방찬 작사·작곡 곡 목록/.test(w.title)&&/작사 \d+곡/.test(w.title))ok('방찬: '+w.title);else bad('방찬 페이지 '+JSON.stringify(w&&w.title));
// 같은 곡의 리믹스·버전은 한 번만 — 작사 목록 안 제목이 서로 다른지
{const items=w?[...w.body.split('<h2>')[1].matchAll(/<li>(.*?)<\/li>/g)].map(m=>m[1].replace(/<[^>]+>/g,'')):[];if(items.length&&new Set(items).size===items.length)ok(`작사 목록 ${items.length}곡 중복 없음`);else bad('작사 목록 중복');}
const rm=ko.find(p=>/\/알엠\/credits\/$/.test(p.rel));if(rm&&/방탄소년단 알엠이 작사에 참여한/.test(rm.desc))ok('조사: '+rm.desc.slice(0,40));else bad('알엠 설명 '+JSON.stringify(rm&&rm.desc));
const e=en.find(p=>/en\/g\/stray-kids\/bang-chan\/credits\//.test(p.rel));if(e&&/Songwriting Credits/.test(e.title))ok('영문 주소·제목 '+e.rel);else bad('영문 방찬 '+JSON.stringify(e&&e.rel));
console.log(`\n${pass} 통과 / ${fail} 실패`);if(fail)process.exitCode=1;

// ── 앨범 페이지(buildAlbumPages, 같은 날 ⑧) ──
{
  const A0=src.indexOf('// ── 앨범 페이지'),A1=src.indexOf('function buildAgencyPages');
  const ap=[];const c2={require,fs,path,ROOT,console:{log(){}},artists:ctx.artists,groups:ctx.groups,SONGS:{},SITE:ctx.SITE,escHtml:ctx.escHtml,
    simplePageHtml:o=>o,writeSimple:(rel,o)=>ap.push({rel,...o}),songPagePath:(g,b,l)=>`g/${g}/s/${b}/`};vm.createContext(c2);
  vm.runInContext(['urlSafeKo','slugify','groupPagePath'].map(pick).join('\n')+'\nconst _CRED_SB='+src.match(/const _CRED_SB = (\(\(\) => \{[\s\S]*?\}\)\(\));/)[1]+';\n'+src.slice(A0,A1),c2);
  vm.runInContext('buildAlbumPages()',c2);
  const ko2=ap.filter(p=>p.lang==='ko');
  if(ko2.length>1500&&ko2.length===ap.length/2)ok(`앨범 페이지 ${ko2.length}장 × 2개 언어`);else bad('앨범 페이지 수 '+ko2.length);
  const arm=ko2.find(p=>/^g\/에스파\/a\/armageddon\/$/.test(p.rel));
  if(arm&&/에스파 'Armageddon' 수록곡·트랙리스트 — 정규 1집/.test(arm.title)&&/\(타이틀\)/.test(arm.body)&&/작사 /.test(arm.body))ok('에스파 Armageddon: '+arm.title);else bad('Armageddon '+JSON.stringify(arm&&arm.title));
  const e2=ap.find(p=>p.rel==='en/g/aespa/a/armageddon/');if(e2&&/1st Full Album/.test(e2.title))ok('영문 '+e2.title.slice(0,60));else bad('영문 Armageddon '+JSON.stringify(e2&&e2.title));
  const dupe=ko2.length-new Set(ko2.map(p=>p.rel)).size;if(!dupe)ok('주소 겹침 없음');else bad('주소 겹침 '+dupe);
}
console.log(`\n(앨범 포함) ${pass} 통과 / ${fail} 실패`);if(fail)process.exitCode=1;
