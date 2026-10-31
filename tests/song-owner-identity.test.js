// 同名 솔로의 곡을 다른 인물로 복원하거나 중복 제거로 잃지 않는지 실제 검색 코드를 실행한다.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const src=require('../tools/index_source.cjs').readIndexSource();
const artists=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8'));
const groups=JSON.parse(fs.readFileSync(path.join(root,'groups.json'),'utf8'));
const tracks=JSON.parse(fs.readFileSync(path.join(root,'tracks_index.json'),'utf8'));
const rs=src.indexOf('function _artistByNameGroup('),re=src.indexOf('\nlet _loadDone=',rs);
const ss=src.indexOf('function _songKey('),se=src.indexOf('// ── 최근 검색',ss);
assert(rs>=0&&re>rs&&ss>=0&&se>ss,'소유자 복원/검색 함수 경계 확인');
function load(A=artists,G=groups,T=tracks){
 return new Function('ARTISTS','GROUPS','_TI','let _artByNG=null;\n'+src.slice(rs,re)+'\n'+src.slice(ss,se)+
  '\nreturn {build:_buildSongIndex,resolve:_artistByNameGroup};')(A,G,T);
}
let failed=0;
function check(label,fn){try{fn();console.log('PASS '+label);}catch(e){failed++;console.error('FAIL '+label+': '+e.message);}}
const index=load().build();
for(const [label,title,id] of [
 ['여자친구 유주','Love Gamer','a0607'],['포미닛 현아','Bubble Pop','a0524'],
 ['공원소녀 레나','침대','a0473'],['애프터스쿨 가은','기억할게','a1006']
]) check(label+'의 실제 곡 소유자',()=>{
 const a=artists.find(a=>a.id===id);assert(a);
 const source=(a.discography||[]).flatMap(al=>(al.tracks||[]).filter(t=>t.title&&t.title.toLowerCase().startsWith(title.toLowerCase())));
 assert(source.length,'검증할 곡이 원본 디스코에 존재: '+title);
 const hit=index.find(t=>t.ownerType==='member'&&t.title.toLowerCase().startsWith(title.toLowerCase()));
 assert(hit,'검색 인덱스에 곡 존재');assert.equal(hit.owner.id,id);
});
check('구형 인덱스의 명확한 소유자 호환',()=>{
 const a=artists.find(a=>a.id==='a0051');assert(a);
 const ti={groups:{},members:{[a.name.ko+'\u0000'+a.group.ko]:[['검증곡',1,'검증앨범']]}};
 assert.equal(load(artists,groups,ti).build()[0].owner.id,a.id);
});
check('구형의 모호한 소유자를 뒤 사람으로 대입하지 않음',()=>{
 const ti={groups:{},members:{'유주\u0000솔로':[['모호한 구형 곡',1,'구형앨범']]}};
 assert.equal(load(artists,groups,ti).build().length,0);
});
check('존재하지 않는 명시 ID는 다른 동명이인으로 대체하지 않음',()=>{
 const ti={groups:{},members:{'유주\u0000솔로':[['없는 사람 곡',1,'앨범','','not-an-artist']]}};
 assert.equal(load(artists,groups,ti).build().length,0);
});
check('이름/그룹이 맞지 않는 명시 ID도 오연결하지 않음',()=>{
 const ti={groups:{},members:{'유주\u0000솔로':[['잘못 연결된 곡',1,'앨범','','a0051']]}};
 assert.equal(load(artists,groups,ti).build().length,0);
});
const A=[{id:'alpha',name:{ko:'가은'},group:{ko:'솔로'},discography:[{title:'A',tracks:[{title:'같은 제목',isTitle:true}]}]},
 {id:'beta',name:{ko:'가은'},group:{ko:'솔로'},discography:[{title:'B',tracks:[{title:'같은 제목',isTitle:true}]}]}];
check('경량 인덱스의 같은 제목/다른 인물은 둘 다 보존',()=>{
 const ti={groups:{},members:{'가은\u0000솔로':[['같은 제목',1,'A','','alpha'],['같은 제목',1,'B','','beta']]}};
 assert.deepEqual(load(A,{},ti).build().map(t=>t.owner.id).sort(),['alpha','beta']);
});
check('전체 디스코 폴백도 같은 제목/다른 인물을 보존',()=>{
 assert.deepEqual(load(A,{},null).build().map(t=>t.owner.id).sort(),['alpha','beta']);
});
check('같은 이름의 그룹과 개인도 서로의 곡을 지우지 않음',()=>{
 const G={'가은':{discography:[{title:'G',tracks:[{title:'같은 제목'}]}]}};
 assert.equal(load([A[0]],G,null).build().length,2);
});
console.log('실패 '+failed);if(failed)process.exitCode=1;
