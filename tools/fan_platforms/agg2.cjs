// 그룹별 팬 소통 플랫폼 표 — 나무위키 그룹 분류 + 버블 문서 표 + 위버스 DM 추천 수집
const fs=require('fs'),path=require('path');
const D=process.argv[2]||'C:/Users/user/AppData/Local/Temp/claude/5b1d5a1d6e0ced79/8180be63-55c5-48a4-8488-8ec6692ff1c1/scratchpad/namu';
const R='C:/Users/user/Documents/GitHub/kpopuniverse';
const groups=JSON.parse(fs.readFileSync(R+'/groups.json','utf8'));
const artists=JSON.parse(fs.readFileSync(R+'/artists.json','utf8'));
const cats=JSON.parse(fs.readFileSync(D+'/cats.json','utf8'));
const raw=JSON.parse(fs.readFileSync(D+'/platforms_raw.json','utf8'));
const bubble=JSON.parse(fs.readFileSync(D+'/bubble_rows.json','utf8'));
const dm=JSON.parse(fs.readFileSync(process.env.TEMP+'/wdm_rooms.json','utf8'));
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
const list=fs.readFileSync(D+'/list.tsv','utf8').trim().split('\n').map(l=>l.split('\t')[0]);
const memsOf=g=>artists.filter(a=>(a.group&&a.group.ko===g)||(a.groups||[]).some(x=>x&&x.ko===g));
const BUBBLE_SKIP=/^(Dear U bubble|2\.1|3\.|5\.|8\.)/;
const out=[];
for(const g of list){
  const info=groups[g]||{};const keys=new Set([norm(g),norm(info.en)]);
  const cs=cats[g]||[];
  const has=re=>cs.some(c=>re.test(c)&&!/서비스 종료/.test(c));
  const ended=cs.filter(c=>/서비스 종료/.test(c)).map(c=>c.replace(/ 입점 아티스트\/서비스 종료/,''));
  const community=[];
  if(has(/^Weverse 입점/))community.push('Weverse');
  if(has(/^Berriz/))community.push('Berriz');
  if(has(/엠넷플러스/))community.push('Mnet Plus');
  const snips=(raw[g]&&raw[g].snips||[]).join(' ');
  if(/Cosmo 라는 이름의 애플리케이션|Cosmo : the Gate/.test(snips))community.push('Cosmo');
  if(g==='뉴진스'&&/포닝|Phoning/.test(snips))community.push('Phoning'); // 뉴진스 전용 앱
  if((raw[g]&&raw[g].links||[]).some(u=>/bstage|b\.stage/.test(u)))community.push('b.stage'); // 링크가 있을 때만
  const msg=[];
  // 버블: 문서 표(현행 섹션) 그룹명 일치
  let brow=bubble.filter(r=>!BUBBLE_SKIP.test(r.sec)&&!/JAPAN/.test(r.sec)&&keys.has(norm(r.cells[0])));
  // 버블 문서는 NCT를 한 줄로 묶는다 — 우리 유닛(127·드림) 명단과 겹치는 멤버만
  if(!brow.length&&/^엔시티 (127|드림)$/.test(g)){const roster=new Set(memsOf(g).map(a=>a.name.ko));brow=bubble.filter(r=>r.sec==='4.1. Lysn'&&r.cells[0]==='NCT').map(r=>({...r,cells:[r.cells[0],r.cells[1].split(',').map(x=>x.trim()).filter(x=>roster.has(x)).join(', ')]}));}
  if(brow.length){
    const names=[...new Set(brow.flatMap(r=>r.cells[1].split(',').map(s=>s.trim()).filter(Boolean)))];
    const total=memsOf(g).filter(a=>!a.left&&a.active!==false).length||null;
    msg.push({svc:'bubble',members:names,total,note:brow.map(r=>r.notes.join(' ')).join(' ').slice(0,160)});
  }else if(has(/bubble/))msg.push({svc:'bubble',members:null,note:'분류만(멤버 표 없음)'});
  if(has(/^fromm/))msg.push({svc:'fromm',members:null,note:'분류'});
  if(has(/withfan/))msg.push({svc:'withfan',members:null,note:'분류'});
  const dmRooms=dm.filter(x=>keys.has(norm(x.community)));
  if(dmRooms.length)msg.push({svc:'Weverse DM',members:dmRooms.map(x=>x.name),note:'위버스 DM 추천에서 확인(일부만 잡혔을 수 있음)'});
  out.push({g,community,msg,ended});
}
fs.writeFileSync(D+'/platform_table.json',JSON.stringify(out,null,1));
// 마크다운 표
const fmtMsg=m=>m.map(x=>x.svc+(x.members?` (${x.members.length}${x.total?'/'+x.total:''}명)`:'')).join(', ')||'—';
let md='| 그룹 | 커뮤니티 | 메시지(DM) | 종료된 서비스 |\n|---|---|---|---|\n';
for(const r of out)md+=`| ${r.g} | ${r.community.join(', ')||'—'} | ${fmtMsg(r.msg)} | ${r.ended.join(', ')||''} |\n`;
fs.writeFileSync(D+'/platform_table.md',md);
const n=k=>out.filter(r=>r.msg.some(m=>m.svc===k)).length;
console.log('그룹',out.length,'| 커뮤니티 있음',out.filter(r=>r.community.length).length,'| 메시지 있음',out.filter(r=>r.msg.length).length,'| bubble',n('bubble'),'fromm',n('fromm'),'WeverseDM',n('Weverse DM'));
