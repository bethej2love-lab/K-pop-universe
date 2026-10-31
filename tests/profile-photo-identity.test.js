// 기념일/즐겨찾기 아바타의 실제 인물→공식 계정 경로. 사진 DB 키가 같은 솔로끼리 사진을 공유하지 않는다.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=require('../tools/index_source.cjs').readIndexSource(),ARTISTS=require('../artists.slim.json'),GROUPS=require('../groups.slim.json');
function extract(name){const at=src.indexOf('async function '+name+'(');assert(at>=0);let d=0,i=src.indexOf('{',at);for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&--d===0)break;}return src.slice(at,i+1);}
let db=0,official=true;
const box={ARTISTS,GROUPS,_artistGroups:a=>a.groups||[a.group],_igEntry:async url=>official?{pic:url}:null,
 sb:{from:()=>{db++;const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:{pic_url:'saved-photo'}})};return q;}},
 _picKey:(n,g)=>n+'|'+g,_instaPicPreloadP:null,_instaPicCache:new Map()};
vm.createContext(box);vm.runInContext(['_fetchInstaPicUrl','_fetchArtistPicAnyGroup','_igPicFor'].map(extract).join('\n'),box);
(async()=>{
 let n=0;const solo=ARTISTS.filter(a=>!GROUPS[a.group.ko]);
 for(const a of solo.filter(a=>a.links?.instagram&&solo.some(b=>b!==a&&b.name.ko===a.name.ko))){
  assert.equal(await box._fetchArtistPicAnyGroup(a),a.links.instagram,a.id+'가 타인 공식 사진을 선택');n++;
 }
 assert(n>=2);
 assert.equal(await box._igPicFor('유주','솔로'),null,'ID 없는 모호한 공식 계정은 추정하지 않음');
 const before=db;official=false;
 assert.equal(await box._fetchInstaPicUrl('유주','솔로','a1475'),null);
 assert.equal(db,before,'동명이인 공유 키의 DB 사진을 요청하지 않음');
 assert.equal(await box._fetchInstaPicUrl('유주','솔로','missing'),null);
 assert.equal(db,before,'없는 ID는 다른 사람의 사진으로 대체하지 않음');
 assert.equal(await box._fetchInstaPicUrl('유주','체리블렛','a1475'),'saved-photo','명확한 옛 소속 등록 사진은 보존');
 assert.equal(db,before+1);
 official=true;assert.equal(await box._igPicFor('', '에스파'),GROUPS['에스파'].links.instagram,'그룹 공식 계정 보존');
 console.log(`동명 솔로 공식 계정 ${n}등록행·모호한 DB키 차단·기존 소속/그룹 사진 호환 통과`);
})().catch(e=>{console.error(e);process.exitCode=1;});
