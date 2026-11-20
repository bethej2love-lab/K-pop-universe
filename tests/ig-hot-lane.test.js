// 인스타 수집의 '관심 계정' 몫(2026-11-20) — 유저가 즐겨찾기한 그룹·멤버 계정을 핸들로 바꾸는 함수와 회차 배분 주기를 본다. 네트워크 없음.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const s=fs.readFileSync(path.join(__dirname,'../tools/ig_business_discovery.mjs'),'utf8');
const a=s.indexOf('function hotHandles('),b=s.indexOf('let liveStats',a);assert(a>=0&&b>a);
const hotHandles=vm.runInNewContext(s.slice(a,b)+';hotHandles');
const handleOf=u=>{const m=String(u||'').match(/instagram\.com\/([A-Za-z0-9._]+)/i);return m?m[1].toLowerCase():null;};
const groups={'코르티스':{links:{instagram:'https://www.instagram.com/cortis/'}},'아이브':{links:{instagram:'https://instagram.com/IVEstarship'}},'없는팀':{}};
const artists=[{name:{ko:'성현'},group:{ko:'코르티스'},links:{instagram:'https://instagram.com/sh_cortis'}},
  {name:{ko:'성현'},group:{ko:'다른팀'},links:{instagram:'https://instagram.com/other_sh'}},
  {name:{ko:'레이'},group:{ko:'아이브'},links:{}}];
const hot=[...hotHandles({fav:{'코르티스':6,'없는팀':1},favm:{'코르티스:성현':5,'아이브:레이':3}},groups,artists,handleOf)].sort();
assert.deepEqual(hot,['cortis','ivestarship','sh_cortis'],'즐겨찾기 그룹 계정 + 즐겨찾기 멤버 계정 + 그 멤버의 그룹 계정, 동명이인은 그룹으로 구분');
assert.equal(hotHandles(null,groups,artists,handleOf).size,0,'통계를 못 받으면 빈 목록');
const lanes=/const lane = \[([^\]]+)\]\[i % 9\]/.exec(s);assert(lanes,'9칸 주기');
const L=lanes[1].replace(/['\s]/g,'').split(',');
assert.equal(L.length,9);assert.equal(L.filter(x=>x==='hot').length,3);assert.equal(L.filter(x=>x==='active').length,3);
for(const k of ['expiring','rotation','fresh'])assert(L.includes(k),k+' 몫이 남아 있어야 비활동·미수집 계정도 전진한다');
console.log('PASS ig hot lane: 이름→핸들 / 동명이인 / 통계 없음 / 배분 주기');
