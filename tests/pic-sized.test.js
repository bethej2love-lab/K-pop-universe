// 프로필 사진 축소 주소(_picSized)는 반드시 resize=contain — 11-17 사고: width만 주면 가로를 잘라 세로 띠(600x750→240x750)가 와서 동그라미 안 얼굴이 확대됐다(투어스 영재).
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const m=/function _picSized[\s\S]*?class _PicMap extends Map\{[\s\S]*?\n\}/.exec(src);assert(m,'_picSized 못 찾음');
const {_picSized,_PicMap}=new Function(m[0]+';return {_picSized,_PicMap}')();
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
const base='https://x.supabase.co/storage/v1/object/public/artist-pics/';
check('축소 주소에 resize=contain이 있다(비율 유지)',()=>{for(const w of [240,560])assert.match(_picSized(base+'a.webp',w),/\?width=\d+&resize=contain&quality=75$/);});
check('높이를 따로 고정하지 않는다(cover 기본값으로 돌아가면 잘린다)',()=>{assert(!/height=/.test(_picSized(base+'a.jpg',240)));});
check('jpg·png·webp만 변환, 그 밖(gif·유튜브·다른 버킷)은 그대로',()=>{for(const e of ['jpg','jpeg','png','webp'])assert.match(_picSized(base+'a.'+e,240),/render\/image/);assert.equal(_picSized(base+'a.gif',240),base+'a.gif');assert.equal(_picSized('https://i.ytimg.com/vi/a/hq.jpg',240),'https://i.ytimg.com/vi/a/hq.jpg');assert.equal(_picSized('https://x.supabase.co/storage/v1/object/public/other/a.jpg',240),'https://x.supabase.co/storage/v1/object/public/other/a.jpg');});
check('.get은 240, .getBig은 560, .getRaw는 원본(DB 저장용)',()=>{const c=new _PicMap();c.set('k',base+'a.webp');assert.match(c.get('k'),/width=240&resize=contain/);assert.match(c.getBig('k'),/width=560&resize=contain/);assert.equal(c.getRaw('k'),base+'a.webp');});
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
