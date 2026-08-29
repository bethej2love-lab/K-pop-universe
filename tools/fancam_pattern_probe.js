// 음악방송 직캠 제목 패턴 시뮬레이션(2026-08-29).
// 실제 DB 없이도 "이 로스터·이 곡명으로 음악방송 직캠이 올라오면 지금 매처가 어떻게 태깅하는가"를
// 전수(모든 그룹×멤버×실제 곡명×방송 포맷)로 돌려, 오태깅이 나는 조합과 원인을 뽑는다.
// 실행: node tools/fancam_pattern_probe.js            (요약)
//       node tools/fancam_pattern_probe.js --dump      (실패 전건 JSON → /tmp/fancam_probe.json)
const {load}=require('./m2_harness');
const M=load();
const {_m2ParseTitle,GROUPS,ARTISTS,_STRICT_SYNC_GROUPS}=M;
const _artistGroups=a=>(a.groups&&a.groups.length?a.groups:[a.group]).filter(g=>g&&g.ko);

// ── 포맷 카탈로그 — 각 방송사 공식 채널이 실제로 쓰는 제목 틀. {G}그룹ko {GE}그룹en {M}멤버ko {ME}멤버en(대문자) {S}곡명 {D}날짜
// kind: 'member'(개인 직캠 → members=[M] 기대) / 'group'(단체 직캠 → members=[] 기대)
const TEMPLATES=[
  // KBS 뮤직뱅크
  {id:'KBS 뮤뱅 원픽캠',kind:'member',t:"[뮤뱅 원픽캠 4K] {G} {M} '{S}' ({GE} {ME} FanCam) | @MusicBank {D}"},
  {id:'KBS 뮤직뱅크 직캠(구)',kind:'member',t:"[뮤직뱅크 직캠] {G} {M} '{S}' ({GE} {ME} FanCam) @MusicBank {D}"},
  {id:'KBS K-Choreo 8K',kind:'group',t:"[K-Choreo 8K] {G} 직캠 '{S}' ({GE} Choreography) @MusicBank {D}"},
  // MBC 쇼! 음악중심
  {id:'MBC 예능연구소 4K',kind:'member',t:"[예능연구소 4K] {G} {M} 직캠 '{S}' ({GE} {ME} FanCam) @쇼!음악중심_{D}"},
  {id:'MBC 음중직캠 세로',kind:'member',t:"[#음중직캠] {G} {M} 세로캠 '{S}' ({GE} {ME} FanCam) | @MBC 쇼! 음악중심 {D}"},
  {id:'MBC 예능연구소 단체',kind:'group',t:"[예능연구소 4K] {G} 직캠 '{S}' ({GE} FanCam) @쇼!음악중심_{D}"},
  // Mnet 엠카운트다운 (M2 MPD직캠)
  {id:'Mnet MPD직캠',kind:'member',t:"[MPD직캠] {G} {M} 직캠 4K '{S}' ({GE} {ME} FanCam) | @MCOUNTDOWN_{D}"},
  {id:'Mnet #MPD직캠 세로',kind:'member',t:"[#MPD직캠] {G} {M} 세로 직캠 4K '{S}' ({GE} {ME} FanCam) | @MCOUNTDOWN_{D}"},
  {id:'Mnet MPD직캠 단체',kind:'group',t:"[MPD직캠] {G} 직캠 4K '{S}' ({GE} FanCam) | @MCOUNTDOWN_{D}"},
  // SBS 인기가요
  {id:'SBS 안방1열 직캠',kind:'member',t:"[안방1열 직캠4K] {G} {M} '{S}' ({GE} {ME} FanCam) @SBS Inkigayo {D}"},
  {id:'SBS 안방1열 페이스캠',kind:'member',t:"[안방1열 페이스캠4K] {G} {M} '{S}' ({GE} {ME} FaceCam) @SBS Inkigayo {D}"},
  {id:'SBS 안방1열 풀캠',kind:'group',t:"[안방1열 풀캠4K] {G} '{S}' 풀캠 ({GE} Full Cam) @SBS Inkigayo {D}"},
  // MBC M 쇼챔피언
  {id:'쇼챔직캠',kind:'member',t:"[쇼챔직캠 4K] {G} {M} - {S} ({GE} {ME}) l Show Champion l EP.520 l {D}"},
  {id:'쇼챔 단체',kind:'group',t:"[쇼챔직캠 4K] {G} - {S} ({GE}) l Show Champion l EP.520 l {D}"},
  // SBS M 더쇼
  {id:'더쇼 직캠',kind:'member',t:"[THE SHOW 직캠] {G} {M} '{S}' 4K 직캠 ({GE} {ME} FanCam) | 더쇼 {D}"},
  // 잇츠라이브 / 킬링보이스 (제목에 '직캠' 없음, 그룹(EN) 표기)
  {id:"it's Live 그룹",kind:'group',t:"[it's Live] {G}({GE}) - {S}"},
  {id:'딩고 킬링보이스 그룹',kind:'group',t:"{G}({GE})의 킬링보이스를 라이브로! – {S}, {S2} | 딩고뮤직 | Dingo Music"},
];

function songsOf(g){
  const out=new Set();
  (g.songs||[]).forEach(s=>s&&s.t&&out.add(s.t));
  (g.discography||[]).forEach(al=>(al.tracks||[]).forEach(tr=>tr&&tr.isTitle&&tr.title&&out.add(tr.title)));
  return [...out].map(s=>s.replace(/\s*\((?:feat|Feat|prod|Prod)[^)]*\)/g,'').trim()).filter(Boolean);
}
const D='260828';
const fails=[];let total=0;
const strictSkipped=new Set();
for(const [gko,g] of Object.entries(GROUPS)){
  const songs=songsOf(g);
  if(!songs.length)continue;
  const roster=ARTISTS.filter(a=>_artistGroups(a).some(x=>x.ko===gko)&&a.active!==false);
  const ge=g.en||gko;
  for(const tpl of TEMPLATES){
    const members=tpl.kind==='member'?roster:[null];
    for(const m of members){
      for(let si=0;si<songs.length;si++){
        const S=songs[si],S2=songs[(si+1)%songs.length];
        const title=tpl.t.replace(/\{G\}/g,gko).replace(/\{GE\}/g,ge).replace(/\{S2\}/g,S2).replace(/\{S\}/g,S).replace(/\{D\}/g,D)
          .replace(/\{M\}/g,m?m.name.ko:'').replace(/\{ME\}/g,m?(m.name.en||'').toUpperCase():'').replace(/\s+/g,' ');
        total++;
        if(_STRICT_SYNC_GROUPS.has(gko)){strictSkipped.add(gko);}
        const r=_m2ParseTitle(title,undefined,false,'2026-08-28');
        const exp=m?[m.name.ko]:[];
        const got=r?(r.membersByGroup[gko]||[]):[];
        const problems=[];
        if(!r)problems.push('전체 미매칭(skip)');
        else{
          if(r.primaryGroup!==gko)problems.push(`group_ko≠ (→${r.primaryGroup})`);
          if(r.withGroups.length)problems.push(`with_groups 오염(${r.withGroups.join(',')})`);
          const extra=got.filter(x=>!exp.includes(x)),miss=exp.filter(x=>!got.includes(x));
          if(extra.length)problems.push(`멤버 추가(${extra.join(',')})`);
          if(miss.length)problems.push(`멤버 누락(${miss.join(',')})`);
        }
        if(problems.length)fails.push({tpl:tpl.id,gko,member:m?m.name.ko:null,song:S,title,problems,result:r&&{primary:r.primaryGroup,with:r.withGroups,members:got}});
      }
    }
  }
}
// ── 요약 ──
const byProblem={};
fails.forEach(f=>f.problems.forEach(p=>{const k=p.replace(/\(.*\)/,'');byProblem[k]=(byProblem[k]||0)+1;}));
console.log(`시뮬 제목 ${total}건 / 문제 ${fails.length}건 (${(100*fails.length/total).toFixed(1)}%)`);
console.log('유형별:',byProblem);
console.log('strictSync라 음악방송 제목으로 영영 못 잡는 그룹:',[...strictSkipped].join(', ')||'없음');
// 원인 클러스터: (그룹, 곡명) 단위로 묶어 "곡명 때문에" 생기는 것과 "멤버명 때문에" 생기는 것을 분리
const bySong={},byMember={};
fails.forEach(f=>{
  const k=`${f.gko} '${f.song}'`;
  const hasMemberIssue=f.problems.some(p=>/멤버 누락/.test(p));
  if(hasMemberIssue){const mk=`${f.gko} ${f.member}`;byMember[mk]=byMember[mk]||{n:0,ex:f};byMember[mk].n++;}
  else{bySong[k]=bySong[k]||{n:0,ex:f};bySong[k].n++;}
});
console.log('\n── 곡명 유발(제목의 곡명이 다른 그룹/멤버명과 충돌) — 상위 40 ──');
Object.entries(bySong).sort((a,b)=>b[1].n-a[1].n).slice(0,40).forEach(([k,v])=>console.log(`${String(v.n).padStart(4)}  ${k}  → ${v.ex.problems.join('; ')}`));
console.log('\n── 멤버명 유발(개인 직캠인데 멤버 못 잡음) — 상위 40 ──');
Object.entries(byMember).sort((a,b)=>b[1].n-a[1].n).slice(0,40).forEach(([k,v])=>console.log(`${String(v.n).padStart(4)}  ${k}  → ${v.ex.problems.join('; ')}  예) ${v.ex.title}`));
if(process.argv.includes('--dump')){
  require('fs').writeFileSync('/tmp/fancam_probe.json',JSON.stringify(fails,null,1));
  console.log('\n전건 → /tmp/fancam_probe.json');
}
