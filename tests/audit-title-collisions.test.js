const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const m=require('../tools/m2_harness.js').load(),root=path.join(__dirname,'..');
const parse=title=>m._m2ParseTitle(title,undefined,false,'2026-06-01');
for(const title of ['[Show Champion] 시크릿 넘버 - 후 디스? (SECRET NUMBER - Who Dis?) l EP.356','[Show Champion] SECRET NUMBER - Who Dis? l EP.356']){
 const r=parse(title);assert.equal(r.primaryGroup,'시크릿넘버');assert.ok(!r.withGroups.includes('시크릿'));
}
const both=parse('시크릿 전효성 X SECRET NUMBER 나비 ICE CREAM challenge');assert.deepEqual(new Set([both.primaryGroup,...both.withGroups]),new Set(['시크릿','시크릿넘버']));
for(const title of ['251005 CxM 유닛 팬파티 피에스타 Fiesta | 에스쿱스 민규 FAN PARTY #CXM','251005 CxM 유닛 팬파티 Fiesta | 에스쿱스 민규 피에스타 FAN PARTY #SCOUPS #MINGYU']){
 const r=parse(title);assert.equal(r.primaryGroup,'세븐틴');assert.ok(!r.withGroups.includes('피에스타'));assert.deepEqual(new Set(r.membersByGroup['세븐틴']),new Set(['에스쿱스','민규']));
}
assert.equal(parse('[MV] FIESTAR(피에스타) - 짠해').primaryGroup,'피에스타');
assert.deepEqual(parse('251005 CxM 에스쿱스 직캠 Fiesta').membersByGroup['세븐틴'],['에스쿱스'],'unit alias must not expand a personal fancam to both members');
assert.deepEqual(parse('[직캠] CxM 민규 - Fiesta').membersByGroup['세븐틴'],['민규']);
for(const title of ['미미의 과몰입 여자친구 연기','여자친구 앞에서 소중한 여사친 만난다는 남자 실드 치는 이효리','고양이 털 알레르기 있는 남자친구 무시하는 여자친구 참교육 하는 이효리']){
 const r=parse(title);assert.ok(!r||![r.primaryGroup,...r.withGroups].includes('여자친구'),'relationship noun: '+title);
}
assert.equal(parse('[MV] 여자친구 - MAGO').primaryGroup,'여자친구');
assert.equal(parse('GFRIEND(여자친구) - 시간을 달려서').primaryGroup,'여자친구');
// Preserve the group DIA and PIXY Dia while giving the newly registered solo a distinct key.
const solo=m.ARTISTS.find(a=>a.id==='a1897'),pixy=m.ARTISTS.find(a=>a.id==='a1798');assert(solo&&pixy);assert.equal(solo.group.ko,'솔로');assert.equal(pixy.group.ko,'픽시');
const shared=fs.readFileSync(path.join(root,'shared.js'),'utf8');const key=new Function('ARTISTS','GROUPS',shared+';return _ytGroupKoFor;')(m.ARTISTS,m.GROUPS);
assert.equal(key(solo),'디아#a1897');assert.equal(key(pixy),'픽시');
console.log('✅ Compound group names, CxM song/title collisions, genuine FIESTAR and separate DIA identities');

for(const title of ['DIA(디아) - Neverland | K-Pop Live Session','Tune-in Time with Ballad Singer DIA 디아']){const r=parse(title);assert.ok(!r||![r.primaryGroup,...r.withGroups].includes('다이아'));}
assert.equal(parse('[STAGE] DIA(다이아) - WooWoo').primaryGroup,'다이아');
assert.equal(parse('PIXY 디아(DIA) - Wings').primaryGroup,'픽시');
