// 말하듯 검색 해석기(_nlParse) — 이름 부분과 형식·정렬·연도를 가르는지. 브라우저·네트워크 없음.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const a=s.indexOf('const _NL_CATS=['),b=s.indexOf('// 검색어 전체가 그대로 그룹·멤버·곡 이름이면',a);assert(a>=0&&b>a);
const P=vm.runInNewContext(s.slice(a,b)+';_nlParse');
const t=(q,exp)=>{const r=P(q);const got=r&&{ent:r.ent,cat:r.cat&&r.cat.key,sort:r.sort,year:r.year};assert.deepEqual(got,exp,q+' → '+JSON.stringify(got));};
t('성현 최근 직캠',{ent:'성현',cat:'fancam',sort:'latest',year:null});
t('성현직캠',{ent:'성현',cat:'fancam',sort:null,year:null});
t('카리나의 인기 쇼츠 보여줘',{ent:'카리나',cat:'short',sort:'popular',year:null});
t('아이브 2024 무대',{ent:'아이브',cat:'live',sort:null,year:2024});
t('코르티스 성현 조이라이드 직캠',{ent:'코르티스 성현 조이라이드',cat:'fancam',sort:null,year:null});
t('aespa karina fancam latest',{ent:'aespa karina',cat:'fancam',sort:'latest',year:null});
t('뉴진스 24년 뮤비',{ent:'뉴진스',cat:'mv',sort:null,year:2024});
t('장원영 페이스캠',{ent:'장원영',cat:'facecam',sort:null,year:null});
t('레이 챌린지 영상 모음',{ent:'레이',cat:'challenge',sort:null,year:null});
// 해석하지 않는 경우: 형식·정렬 낱말 없음 / 이름 부분이 빔
assert.equal(P('성현'),null);assert.equal(P('뉴진스 하니'),null);assert.equal(P('최근 직캠'),null);assert.equal(P('직캠'),null);assert.equal(P(''),null);
// 낱말 안에 든 글자는 건드리지 않는다(통째 일치만)
assert.equal(P('Livewire'),null);assert.equal(P('무대뽀'),null);
console.log('PASS nl search: 형식·정렬·연도·붙여쓰기·조사·영문 / 해석 안 하는 경우');
