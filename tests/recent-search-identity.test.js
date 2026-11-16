const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),src=require('../tools/index_source.cjs').readIndexSource();
const ARTISTS=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8'));
const GROUPS=JSON.parse(fs.readFileSync(path.join(root,'groups.json'),'utf8'));
function extract(name){const start=src.indexOf('function '+name+'(');assert(start>=0,name);let d=0,i=src.indexOf('{',start);for(;i<src.length;i++){if(src[i]==='{')d++;else if(src[i]==='}'&&--d===0)break;}return src.slice(start,i+1);}
const data=new Map(),key='kpu_recent_searches';
const box={ARTISTS,GROUPS,Map,currentLang:'ko',_artByNG:null,RECENT_SEARCH_KEY:key,RECENT_SEARCH_MAX:8,
 _dispName:a=>a.name.ko,bubbleMeshes:[],localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
vm.createContext(box);vm.runInContext(['_artistByNameGroup','_loadRecentSearches','_recentKey','_recentEntryOf','_recordRecentSearch','_resolveRecentSearches'].map(extract).join('\n'),box);
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
// ── 2026-11-16 곡·공연·공연장·행사도 최근 검색에 남는다 ──
const recHit=h=>{box.__hit=h;vm.runInContext('_recordRecentSearch(__hit)',box);};
box.bubbleMeshes.push({ko:'에스파',mesh:{position:{clone:()=>({x:1})}}});
check('곡(그룹 주인)을 그 곡 자체로 저장·복원',()=>{recHit({type:'song',name:'Supernova',alias:'Armageddon',sub:'에스파',data:'에스파',ownerType:'group'});const r=resolve();assert.equal(r.length,1);assert.equal(r[0].type,'song');assert.equal(r[0].name,'Supernova');assert.equal(r[0].alias,'Armageddon');assert.equal(r[0].data,'에스파');assert.equal(r[0].ownerType,'group');});
check('곡(멤버 주인)도 저장·복원',()=>{a._worldPos={x:2};const m=a;recHit({type:'song',name:'My Song',alias:'',sub:'유주',data:m,ownerType:'member'});const r=resolve();assert.equal(r[0].type,'song');assert.equal(r[0].data.id,a.id);});
check('같은 곡을 다시 고르면 중복 없이 맨 위로',()=>{recHit({type:'song',name:'A',data:'에스파',ownerType:'group'});recHit({type:'song',name:'B',data:'에스파',ownerType:'group'});recHit({type:'song',name:'A',data:'에스파',ownerType:'group'});assert.deepEqual(Array.from(resolve(),h=>h.name),['A','B']);});
check('공연은 id로 저장하고 제목·날짜·공연장을 복원',()=>{recHit({type:'event',id:77,name:'TOUR X',alias:'2026-12-01',sub:'KSPO DOME',data:'에스파',ownerType:'group'});const r=resolve();assert.equal(r[0].type,'event');assert.equal(r[0].id,77);assert.equal(r[0].name,'TOUR X');assert.equal(r[0].alias,'2026-12-01');assert.equal(r[0].sub,'KSPO DOME');});
check('id 없는 공연은 저장하지 않는다',()=>{recHit({type:'event',name:'no id',data:null});assert.equal(resolve().length,0);});
check('공연장 저장·복원',()=>{recHit({type:'venue',name:'KSPO돔',data:'KSPO DOME',sub:'15,000석 · 서울'});const r=resolve();assert.equal(r[0].type,'venue');assert.equal(r[0].data,'KSPO DOME');});
check('행사(시상식)는 저장하고 프로그램 컬렉션은 저장하지 않는다',()=>{recHit({type:'program',name:'KGMA 모아보기',sub:'행사',data:{__festival:'kgma'}});recHit({type:'program',name:'아이돌 라디오',data:{big:1}});const r=resolve();assert.equal(r.length,1);assert.equal(r[0].data.__festival,'kgma');});
check('최근 검색은 8개까지만',()=>{for(let i=0;i<12;i++)recHit({type:'event',id:i,name:'E'+i,data:null});assert.equal(resolve().length,8);});
check('곡 주인이 사라졌으면(그룹 행성 없음) 조용히 건너뜀',()=>{data.set(key,JSON.stringify([{type:'song',title:'X',ownerType:'group',ko:'없는그룹'}]));assert.equal(resolve().length,0);});

console.log('실패 '+failures);if(failures)process.exitCode=1;
