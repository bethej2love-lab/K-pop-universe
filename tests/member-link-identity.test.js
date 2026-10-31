// 생성된 소개 페이지, 실제 해시 수신/공유, 모바일 스택이 같은 등록 ID를 가리키는지 검증한다.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const src=require('../tools/index_source.cjs').readIndexSource();
const ARTISTS=JSON.parse(fs.readFileSync(path.join(root,'artists.json'),'utf8'));
const GROUPS=JSON.parse(fs.readFileSync(path.join(root,'groups.json'),'utf8'));
function extract(name,optional=false){
 const start=src.indexOf('function '+name+'(');if(start<0){if(optional)return '';throw Error('함수 없음: '+name);}
 let depth=0,i=src.indexOf('{',start);
 for(;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&--depth===0)break;}
 return src.slice(start,i+1);
}
const box={ARTISTS,GROUPS,URL,URLSearchParams,location:{hash:'',origin:'https://kpop-universe.kr'},
 document:{referrer:''},window:{innerWidth:1200,innerHeight:900},currentLang:'ko',
 _openTArtist:null,_openGCko:null,_openUnit:null,_UNIT_KEY:'unit:',_cardStack:[],_connAnchor:null,_connSelected:[],mobile:false,
 _hashEsc:encodeURIComponent,_gaEvent(){},_setPendingVidPreset(){},_isUnitKey:g=>g.startsWith('unit:'),
 isMob:()=>box.mobile,showT:a=>{box.opened=a;},showGC:g=>{box.openedGroup=g;},openConnCard:a=>{box.connOpened=a;}};
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(root,'shared.js'),'utf8'),box);
vm.runInContext(['_memberIdParam','_cardHash','_stackIndexForHash','_openFromHash','_connShareHash',
 '_seoUrlSafeKo','_seoSlugify','_seoUrlForMember'].map(n=>extract(n,n==='_memberIdParam')).join('\n'),box);
const solo=ARTISTS.filter(a=>!GROUPS[a.group.ko]);
const ambiguous=solo.filter(a=>solo.some(b=>b!==a&&b.name.ko===a.name.ko));
assert(ambiguous.length>=2,'실제 중복 이름 사례 존재');
let failed=0,checked=0;
function check(label,fn){checked++;try{fn();}catch(e){failed++;console.error('FAIL '+label+': '+e.message);}}
function open(hash){box.location.hash=hash;box.opened=null;box.openedGroup=null;vm.runInContext('_openFromHash()',box);return box.opened;}
for(const a of ambiguous){
 check('명시 ID로 올바른 등록행 열기 '+a.id,()=>{
  assert.equal(open('#m='+encodeURIComponent(a.name.ko)+'&mid='+a.id)?.id,a.id);
 });
 check('현재 카드 URL이 ID를 보존 '+a.id,()=>{
  box._openTArtist=a;box.mobile=false;assert.equal(new URLSearchParams(vm.runInContext('_cardHash()',box).slice(1)).get('mid'),a.id);
 });
 for(const lang of ['ko','en'])check('소개 CTA의 소유자 보존 '+a.id+'/'+lang,()=>{
  box.currentLang=lang;box.__a=a;const url=vm.runInContext('_seoUrlForMember(__a)',box);
  const file=path.join(root,decodeURIComponent(new URL(url).pathname),'index.html');
  const html=fs.readFileSync(file,'utf8');const href=html.match(/<div class="cta-dock"><a class="cta" href="([^"]+)"/)[1];
  const hash=new URL(href.replace(/&amp;/g,'&')).hash;
  assert.equal(new URLSearchParams(hash.slice(1)).get('mid'),a.id);assert.equal(open(hash)?.id,a.id);
 });
}
const yuju=ambiguous.filter(a=>a.name.ko==='유주');assert.equal(yuju.length,2);
for(const [i,a] of yuju.entries())check('모바일 뒤로가기는 같은 이름도 ID로 구별 '+a.id,()=>{
 box.mobile=true;box._cardStack=yuju.map(data=>({type:'tt',data}));
 assert.equal(vm.runInContext(`_stackIndexForHash(${JSON.stringify('#m=유주&mid='+a.id)})`,box),i);
});
check('모바일 최상단 카드 URL도 정확한 ID',()=>{
 box.mobile=true;box._cardStack=yuju.map(data=>({type:'tt',data}));
 assert.equal(new URLSearchParams(vm.runInContext('_cardHash()',box).slice(1)).get('mid'),yuju[1].id);
});
check('연결 카드 공유도 명시 ID 보존',()=>{
 box._connAnchor=yuju[1];box._connSelected=[];
 assert.equal(new URLSearchParams(vm.runInContext('_connShareHash()',box).slice(1)).get('mid'),yuju[1].id);
});
check('연결 카드 공유를 열어도 같은 등록 ID로 복원',()=>{
 box._connAnchor=yuju[1];box._connSelected=[];box.connOpened=null;
 const hash=vm.runInContext('_connShareHash()',box);assert.equal(open(hash)?.id,yuju[1].id);assert.equal(box.connOpened?.id,yuju[1].id);
});
check('없는 명시 ID를 다른 같은 이름으로 대체하지 않음',()=>{assert.equal(open('#m=유주&mid=missing-id')?.id,undefined);});
check('기존 그룹/멤버 링크 호환',()=>{
 box.mobile=false;assert.equal(open('#g=에스파&m=카리나')?.id,ARTISTS.find(a=>a.name.ko==='카리나'&&a.group.ko==='에스파').id);
});
check('기존 단일 솔로 링크 호환',()=>{
 assert.equal(open('#m=아이유')?.id,ARTISTS.find(a=>a.name.ko==='아이유').id);
});
check('기존 솔로 placeholder 링크 호환',()=>{assert.equal(open('#g=솔로&m=유주')?.id,yuju[0].id);});
console.log(checked+'개 검사 / 실패 '+failed);if(failed)process.exitCode=1;
