const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=require('../tools/index_source.cjs').readIndexSource();
const ARTISTS=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8'));
const GROUPS=JSON.parse(fs.readFileSync(path.join(root,'groups.json'),'utf8'));
function extract(name){const start=src.indexOf('function '+name+'(');assert(start>=0,name);let d=0,i=src.indexOf('{',start);for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&--d===0)break;}return src.slice(start,i+1);}
const data=new Map(),key='kpu_recent_searches';
const box={ARTISTS,GROUPS,Map,currentLang:'ko',_artByNG:null,RECENT_SEARCH_KEY:key,RECENT_SEARCH_MAX:8,
 _dispName:a=>a.name.ko,bubbleMeshes:[],localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
vm.createContext(box);vm.runInContext(['_artistByNameGroup','_loadRecentSearches','_recordRecentSearch','_resolveRecentSearches'].map(extract).join('\n'),box);
const record=a=>{box.__hit={type:'member',data:a};vm.runInContext('_recordRecentSearch(__hit)',box);};
const resolve=()=>vm.runInContext('_resolveRecentSearches()',box);
let failures=0;
function check(name,fn){data.clear();try{fn();console.log('PASS '+name);}catch(e){failures++;console.error('FAIL '+name+': '+e.message);}}
const a=ARTISTS.find(a=>a.id==='a0607'),b=ARTISTS.find(a=>a.id==='a1475');assert(a&&b);
check('최근 검색은 선택한 두 번째 유주를 그대로 복원',()=>{record(b);assert.equal(resolve()[0].data.id,b.id);});
check('같은 이름/그룹의 서로 다른 ID를 둘 다 기억',()=>{record(a);record(b);assert.deepEqual(Array.from(resolve(),h=>h.data.id),[b.id,a.id]);});
check('동일 ID 재검색은 중복 없이 맨 위로',()=>{record(a);record(b);record(a);assert.deepEqual(Array.from(resolve(),h=>h.data.id),[a.id,b.id]);});
check('모호한 구형 기록은 다른 사람으로 복원하지 않음',()=>{data.set(key,JSON.stringify([{type:'member',ko:'유주',groupKo:'솔로'}]));assert.equal(resolve().length,0);});
check('존재하지 않는 명시 ID도 다른 사람으로 대체하지 않음',()=>{data.set(key,JSON.stringify([{type:'member',ko:'유주',groupKo:'솔로',artistId:'missing-id'}]));assert.equal(resolve().length,0);});
check('구형의 명확한 기록은 계속 복원',()=>{data.set(key,JSON.stringify([{type:'member',ko:'카리나',groupKo:'에스파'}]));assert.equal(resolve()[0].data.id,ARTISTS.find(a=>a.name.ko==='카리나').id);});
check('이름이 바뀐 기록도 ID가 같으면 현재 인물로 복원',()=>{data.set(key,JSON.stringify([{type:'member',ko:'옛 표기',groupKo:'옛 그룹',artistId:b.id}]));assert.equal(resolve()[0].data.id,b.id);});
console.log('실패 '+failures);if(failures)process.exitCode=1;
