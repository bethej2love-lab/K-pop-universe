// 조사 초안(draft_*.json) → 앱이 읽는 fan_platforms.json (메시지 서비스만, 링크 포함)
// 2026-11-10 사용자: "카드에 메시지 아이콘 + bubble 같은 텍스트, 누르면 그 서비스로 연결". 커뮤니티(위버스 등)는 SNS 줄에 이미 있거나 다음 단계.
// 실행: node tools/fan_platforms/build_fan_platforms.cjs
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..');
const draft=JSON.parse(fs.readFileSync(path.join(__dirname,'draft_2026-11-10.json'),'utf8'));
const groups=JSON.parse(fs.readFileSync(path.join(ROOT,'groups.json'),'utf8'));
// 프롬 그룹 채널 — 헤드리스로 열어 실제 채널이 뜨는 것만(2026-11-10 확인). 나머지는 프롬 첫 화면.
const FROMM_CH={'더보이즈':'theboyz','온앤오프':'onf','이펙스':'epex','오마이걸':'ohmygirl','에이비식스':'ab6ix'};
const URL={bubble:()=>'https://dear-u.co',fromm:g=>FROMM_CH[g]?`https://channel.frommyarti.com/en/channels/${FROMM_CH[g]}/notice`:'https://frommyarti.com',
  'Weverse DM':g=>((groups[g]||{}).links||{}).weverse||'https://dm.weverse.io'};
const out={_meta:{updated:'2026-11-10',note:'메시지 서비스(아티스트가 팬에게 보내는 구독형 메시지). m=입점 멤버(없으면 그룹 단위·명단 미확인). 근거: 나무위키 분류·버블 문서 표, 위버스 DM 추천·공식 오픈 공지, 사용자 확인. tools/fan_platforms/'}};
for(const r of draft){
  const items=[];
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
console.log('그룹',Object.keys(out).length-1);
