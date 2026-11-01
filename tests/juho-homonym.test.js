// Actual shared title matcher. Juho is not ZUHO unless the title identifies SF9.
const assert=require('node:assert/strict'),{_m2ParseTitle}=require('../tools/matcher_harness.cjs');
const sf9=r=>!!r&&(r.primaryGroup==='에스에프나인'||(r.withGroups||[]).includes('에스에프나인')||(r.membersByGroup?.에스에프나인||[]).includes('주호'));
const cases=[
 ["[MV] Juho(주호), Nilo(닐로) _ The Last Letter(이별 편지) (Live Clip)",false],
 ["[MV] Juho(주호) _ Looks like love(사랑 같아 보여도)",false],
 ["[MV] Juho(주호) _ 잘가요",false],
 ["[Live] 주호(JUHO) - 녹슨 가슴",false],
 ["[플리캠 4K] HAWW JUHO 'How Are You' (하우 주호 직캠) l Simply K-Pop CON-TOUR Ep.560",false],
 ["SF9 주호 - It's my paradise",true],
 ["ZU HO(SF9) (주호(에스에프나인)) - It's my paradise",true],
 ["[MV] ZUHO(주호) - SOLO",true],
 ["SF9 JUHO(주호) - LIVE",true],
 ["Juho(주호) '잘가요' COVER BY SF9 ZUHO",true],
 ["Juho(주호) X SF9 영빈 라이브",true],
];
let failed=0;for(const [title,want]of cases){try{assert.equal(sf9(_m2ParseTitle(title)),want);}catch(e){failed++;console.error('FAIL '+title+' expected SF9='+want);}}
console.log(cases.length+' checks / '+failed+' failed');if(failed)process.exitCode=1;
