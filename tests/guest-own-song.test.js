// 공식 채널의 "남이 부른 우리 곡"(2026-11-19 사용자 — "Open Your Eyes by #XODIAC 규민님 🎼 #CLOSEYOUREYES": 클로즈유어아이즈 공식 채널 영상인데
// 소디엑 규민이 그 곡을 부른다 → 규민만 태깅, 원곡 클로즈유어아이즈). admin.js _guestSingsOwnSong — 조건이 전부 맞을 때만. 실행: node tests/guest-own-song.test.js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {load}=require('../tools/m2_harness');
const M=load();
if(!M._guestSingsOwnSong){console.error('_guestSingsOwnSong 없음(tools/m2_harness.js 등록 확인)');process.exit(2);}
M._coverBuildIndex([]);
const G=(title,group_ko)=>M._guestSingsOwnSong({title,group_ko,published_at:'2026-11-10'});
let total=0,failed=0;const check=(n,f)=>{total++;try{f();}catch(e){failed++;console.error('FAIL '+n+': '+e.message);}};
check('사용자 사례 — 소디엑 규민만, 원곡 클로즈유어아이즈·곡명',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(G('Open Your Eyes by #XODIAC 규민님 🎼 #CLOSEYOUREYES #클로즈유어아이즈 #256thNote','클로즈유어아이즈'))),
    {group_ko:'소디엑',members:['규민'],cover_of_groups:['클로즈유어아이즈'],cover_of_song:'Open Your Eyes'});});
check('그룹 전체가 부른 경우 — 멤버 없이 그룹만',()=>{const r=G('Snowy Summer by #아이브 🎼 #CLOSEYOUREYES','클로즈유어아이즈');assert.equal(r.group_ko,'아이브');assert.deepEqual([...r.members],[]);assert.equal(r.cover_of_song,'Snowy Summer');});
for(const [n,t] of [
  ['with = 같이 나옴','Open Your Eyes with #XODIAC 규민님 🎼 #CLOSEYOUREYES'],
  ['& = 같이 나옴','Open Your Eyes by #XODIAC 규민님 & 송승호 🎼'],
  ['by 뒤가 자기 멤버','Open Your Eyes by 송승호 🎼 #CLOSEYOUREYES'],
  ['자기 곡명 없음(브이로그)','Vlog by #XODIAC 규민님 #CLOSEYOUREYES'],
  ['by 없음(챌린지 표기만)','Open Your Eyes 챌린지 #XODIAC 규민님 🎼 #CLOSEYOUREYES'],
  ['평범한 자기 무대','[MV] CLOSE YOUR EYES - Open Your Eyes'],
])check('안 바꿈: '+n,()=>assert.equal(G(t,'클로즈유어아이즈'),null));
check('채널 주인이 그룹이 아니면 대상 아님',()=>assert.equal(G('Open Your Eyes by #XODIAC 규민님','없는그룹'),null));
const admin=fs.readFileSync(path.join(__dirname,'..','admin.js'),'utf8');
check('공식 채널 동기화에 연결(검수 표시)',()=>assert.match(admin,/_guestSingsOwnSong\(\{title:v\.title,group_ko:ko,published_at:v\.published_at\}\)[^\n]*needs_review:true/));
console.log(total+' checks / '+failed+' failed');if(failed)process.exitCode=1;
