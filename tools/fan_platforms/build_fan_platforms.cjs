// 조사 초안(draft_*.json) → 앱이 읽는 fan_platforms.json
// 2026-11-10 사용자: "카드에 메시지 아이콘 + bubble 같은 텍스트, 누르면 그 서비스로 연결(펼침 없이)".
//   s=서비스 이름, u=연결 주소, m=입점 멤버(멤버 카드는 명단에 있을 때만), k='c'면 커뮤니티 앱(아이콘만 다름). 위버스 커뮤니티는 SNS 줄(links.weverse)에 이미 있어 뺀다.
// 실행: node tools/fan_platforms/build_fan_platforms.cjs
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const drafts=['draft_2026-11-10.json','draft_rest_2026-11-10.json'].filter(f=>fs.existsSync(path.join(__dirname,f)));
const draft=[].concat(...drafts.map(f=>JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'))));
const groups=JSON.parse(fs.readFileSync(path.join(ROOT,'groups.json'),'utf8'));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
// 프롬 그룹 채널 — 헤드리스로 열어 실제 채널이 뜨는 것만(2026-11-10 확인). 나머지는 프롬 첫 화면.
const FROMM_CH={'더보이즈':'theboyz','온앤오프':'onf','이펙스':'epex','오마이걸':'ohmygirl','에이비식스':'ab6ix'};
// JYP FANS 라인업(나무위키 FANS 문서 4. 아티스트 라인업, 2026-11-10). 앱이라 그룹별 주소가 없어 첫 화면으로.
const JYP_FANS=new Set(['2pm','day6','twice','straykids','itzy','niziu','xdinaryheroes','nmixx','girlset','nexz','kickflip'].map(norm));
const URL={bubble:()=>'https://dear-u.co',fromm:g=>FROMM_CH[g]?`https://channel.frommyarti.com/en/channels/${FROMM_CH[g]}/notice`:'https://frommyarti.com',
  'Weverse DM':g=>((groups[g]||{}).links||{}).weverse||'https://dm.weverse.io'};
const out={_meta:{updated:'2026-11-10',note:'k=c 커뮤니티 앱, 없으면 메시지 서비스. m=입점 멤버(없으면 그룹 단위·명단 미확인). 근거: 나무위키 분류·버블/FANS 문서 표, 위버스 DM 추천·공식 오픈 공지, 사용자 확인. tools/fan_platforms/'}};
for(const r of draft){
  const items=[];const info=groups[r.g]||{};
  const comm=r.commLinks||{};
  // 커뮤니티 앱 — 그룹 페이지 주소를 아는 것만(모르면 앱 첫 화면)
  if(r.community.includes('Berriz'))items.push({k:'c',s:'Berriz',u:comm.berriz||'https://berriz.in'});
  if(r.community.includes('Mnet Plus'))items.push({k:'c',s:'Mnet Plus',u:comm.mnetplus||'https://www.mnetplus.world'});
  if(comm.bstage)items.push({k:'c',s:'b.stage',u:comm.bstage});
  if(JYP_FANS.has(norm(info.en))||JYP_FANS.has(norm(r.g)))items.push({k:'c',s:'FANS',u:'https://app.fans'});
  for(const m of r.msg){
    if(!URL[m.svc])continue; // withfan 등 공식 주소를 못 찾은 서비스는 보류
    if(r.noDm&&r.noDm[m.svc])continue;
    const it={s:m.svc,u:URL[m.svc](r.g)};
    if(Array.isArray(m.members)&&m.members.length)it.m=m.members;
    items.push(it);
  }
  if(items.length)out[r.g]=items;
}
fs.writeFileSync(path.join(ROOT,'fan_platforms.json'),JSON.stringify(out,null,1)+'\n');
const n=k=>Object.values(out).filter(v=>Array.isArray(v)&&v.some(x=>x.s===k)).length;
console.log('그룹',Object.keys(out).length-1,'| bubble',n('bubble'),'fromm',n('fromm'),'WeverseDM',n('Weverse DM'),'| Berriz',n('Berriz'),'MnetPlus',n('Mnet Plus'),'b.stage',n('b.stage'),'FANS',n('FANS'));
