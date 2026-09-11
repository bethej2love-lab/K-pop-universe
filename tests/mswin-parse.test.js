// 음악방송 1위 제목 파서(_mswParseWin) 회귀 테스트 (2026-09-11 신설)
//
// 케이스는 전부 2026-09-11 실DB 표본(제목에 '1위'/'SHOW CHOICE'/'챔피언송'이 든 2026년 영상 229건)에서
// 제목을 **그대로** 가져왔다. 기대값은 music_show_wins의 기존 저장 규약을 따른다:
//   · show는 '뮤직뱅크/쇼음악중심/인기가요/엠카운트다운/쇼챔피언/더쇼' 여섯 값(기존 2,626행과 같은 철자)
//   · 그룹 수상은 group_ko만, 멤버 솔로 수상은 group_ko=소속그룹 + member_ko=이름
//     (2026-07-17 뮤뱅 연준 → 투모로우바이투게더/연준, 2026-05-29 뮤뱅 태용 → 엔시티 127/태용)
//   · A등급 = 자동 반영 대상(제목에 방송일 + 요일 일치 + 아티스트 유일 해석). 나머지는 B.
//
// 실행: node tests/mswin-parse.test.js
const {load}=require('../tools/m2_harness');
const M=load();
const {_mswParseWin,_mswResolveArtist}=M;
if(!_mswParseWin){console.error('_mswParseWin 없음 — admin.js에 음방 1위 파서가 있는지 확인');process.exit(2);}

let pass=true;
const ok=m=>console.log(`✅ ${m}`);
const bad=(m,extra)=>{pass=false;console.log(`❌ ${m}`+(extra?`\n   → ${extra}`:''));};

// t(설명, 제목, 업로드일, 기대) — 기대는 {show,win_date,group_ko,member_ko,song_title,grade} 부분집합
function t(name,title,pub,want,hintGko){
  const r=_mswParseWin(title,pub,hintGko);
  if(want===null){
    if(r===null)ok(name);
    else bad(name,`파싱되면 안 되는데 잡힘: ${JSON.stringify({show:r.show,win:r.win_date,g:r.group_ko,grade:r.grade})}`);
    return;
  }
  if(!r){bad(name,'파싱 실패(null)');return;}
  const diff=Object.entries(want).filter(([k,v])=>r[k]!==v);
  if(!diff.length)ok(name);
  else bad(name,diff.map(([k,v])=>`${k}: 기대 ${JSON.stringify(v)} ≠ 실제 ${JSON.stringify(r[k])}`).join(' / '));
}

console.log('── 뮤직뱅크(금) ──');
t('기본형',"[4K] 알파드라이브원 'BORN DIRE' 뮤직뱅크 1위 앵콜직캠 (ALPHA DRIVE ONE Encore Facecam) @뮤직뱅크(Music Bank) 260904",'2026-09-04',
  {show:'뮤직뱅크',win_date:'2026-09-04',group_ko:'알파드라이브원',member_ko:null,song_title:'BORN DIRE',grade:'A'});
t('곡명 속 아포스트로피(Eye-Poppin\')',"[4K] 킥플립 '눈에 거슬리고 싶어 (Eye-Poppin')' 뮤직뱅크 1위 앵콜직캠(KickFlip Encore Facecam) @뮤직뱅크(Music Bank) 260417",'2026-04-17',
  {show:'뮤직뱅크',win_date:'2026-04-17',group_ko:'킥플립',song_title:"눈에 거슬리고 싶어 (Eye-Poppin')",grade:'A'});
t('한글 방송명 없이 @Music Bank만',"[4K] 투모로우바이투게더 '하루에 하루만 더 (Stick With You)' 뮤직뱅크 1위 앵콜직캠(TXT  Encore Facecam) @Music Bank 260424",'2026-04-24',
  {show:'뮤직뱅크',win_date:'2026-04-24',group_ko:'투모로우바이투게더',grade:'A'});
t('그룹명에 공백(스트레이 키즈 → 스트레이키즈)',"[4K] 스트레이 키즈 'This & That' 뮤직뱅크 1위 앵콜직캠 (Stray Kids Encore Facecam) @뮤직뱅크(Music Bank) 260814",'2026-08-14',
  {show:'뮤직뱅크',win_date:'2026-08-14',group_ko:'스트레이키즈',song_title:'This & That',grade:'A'});
// 솔로 수상 — group_ko는 소속 그룹, member_ko에 이름. 영상 group_ko가 본인 이름(솔로 키)이어도 같아야 한다.
t('솔로 — 연준(투모로우바이투게더)',"[4K] 연준 'Ice Cream' 뮤직뱅크 1위 앵콜직캠(YEONJUN Encore Facecam) @뮤직뱅크(Music Bank) 260717",'2026-07-17',
  {show:'뮤직뱅크',win_date:'2026-07-17',group_ko:'투모로우바이투게더',member_ko:'연준',song_title:'Ice Cream',grade:'A'},'연준');
t('솔로 — 태용(엔시티 127)',"[4K] 태용 'WYLD' 뮤직뱅크 1위 앵콜직캠(TAEYONG Encore Facecam) @뮤직뱅크(Music Bank) 260529",'2026-05-29',
  {show:'뮤직뱅크',win_date:'2026-05-29',member_ko:'태용',song_title:'WYLD',grade:'A'},'태용');

console.log('── 인기가요(일) / 쇼음악중심(토) ──');
t('인기가요 앵콜캠',"[앵콜캠4K] 엔하이픈 'Bloody Paradise' 인기가요 1위 앵콜 직캠 (ENHYPEN Encore Fancam) @SBS Inkigayo 260830",'2026-08-30',
  {show:'인기가요',win_date:'2026-08-30',group_ko:'엔하이픈',song_title:'Bloody Paradise',grade:'A'});
t('음중직캠 — 영문(한글) 병기 + 엔대시',"[#음중직캠] NCT 127 (엔시티 127) – Blingy 1위 직캠 | 쇼! 음악중심 | MBC260905",'2026-09-05',
  {show:'쇼음악중심',win_date:'2026-09-05',group_ko:'엔시티 127',song_title:'Blingy',grade:'A'});
t('음중 미방분 — N주차 1위',"[쇼! 음악중심 미방분] 9월 1주차 1위 NCT 127 (엔시티 127) - Blingy | Show! MusicCore | MBC260905방송",'2026-09-05',
  {show:'쇼음악중심',win_date:'2026-09-05',group_ko:'엔시티 127',song_title:'Blingy',grade:'A'});
t('음중직캠 — 한글 곡명',"[#음중직캠] I.O.I (아이오아이) – 갑자기 1위 직캠 | 쇼! 음악중심 | MBC260704",'2026-07-04',
  {show:'쇼음악중심',win_date:'2026-07-04',group_ko:'아이오아이',song_title:'갑자기',grade:'A'});

console.log('── 엠카운트다운(목) ──');
t('MPD직캠',"[MPD직캠] 엔하이픈 1위 앵콜 직캠 4K 'Bloody Paradise' (ENHYPEN FanCam No.1 Encore) | @MCOUNTDOWN_2026.8.27",'2026-08-27',
  {show:'엠카운트다운',win_date:'2026-08-27',group_ko:'엔하이픈',song_title:'Bloody Paradise',grade:'A'});
// 본채널 앵콜 무대는 제목에 방송일이 없다. 며칠 지나 올라오면 "직전 목요일"이 추측이 되므로 B
// (같은 1위를 MPD직캠이 A로 덮으므로 손해가 없다). 반대로 방송 당일(목)에 올라왔으면 날짜가 확정이라 A.
t('본채널 앵콜 — 일요일 업로드는 역산이라 B',"8월 마지막 주 1위 'ENHYPEN (엔하이픈)'의 'Bloody Paradise' 앵콜 무대! (Full ver.) #엠카운트다운 EP.943",'2026-08-31',
  {show:'엠카운트다운',win_date:'2026-08-27',group_ko:'엔하이픈',song_title:'Bloody Paradise',grade:'B'});
t('본채널 앵콜 — 방송 당일(목) 업로드면 A',"1월 3주 1위 'Apink (에이핑크)'의 'Love Me More' 앵콜 무대! (Full ver.) #엠카운트다운 EP.910",'2026-01-15',
  {show:'엠카운트다운',win_date:'2026-01-15',group_ko:'에이핑크',song_title:'Love Me More',grade:'A'});

console.log('── 쇼챔피언(수) ──');
t('쇼챔 — 방송 당일(수) 업로드면 A',"[쇼챔 1위] 9월 2주 챔피언송 ＜ 82MAJOR (82메이저)- Like Fire ＞ 앵콜 Full ver.",'2026-09-09',
  {show:'쇼챔피언',win_date:'2026-09-09',group_ko:'82메이저',song_title:'Like Fire',grade:'A'});
t('쇼챔 — 수상소감 표기도 같은 규칙',"[쇼챔 1위] 8월 5주 챔피언송 ＜ENHYPEN (엔하이픈) - Bloody Paradise＞ 수상소감 Full ver.",'2026-08-26',
  {show:'쇼챔피언',win_date:'2026-08-26',group_ko:'엔하이픈',grade:'A'});
t('쇼챔 — 업로드가 수요일이 아니면 역산이라 B',"[쇼챔 1위] 7월 3주 챔피언송 ＜아홉(AHOF) - RUN TO YOU＞ 앵콜 Full ver.",'2026-07-17',
  {show:'쇼챔피언',win_date:'2026-07-15',group_ko:'아홉',grade:'B'});

console.log('── 더쇼(화) — 표기 네 갈래 ──');
t('더쇼 — 그룹 \'팬픽캠 멤버\'(멤버는 수상자가 아님)',"THE SHOW CHOICE - ALPHA DRIVE ONE 'JUNSEO' [THE SHOW] 260901 방송 [FAN PICK CAM 4K]",'2026-09-03',
  {show:'더쇼',win_date:'2026-09-01',group_ko:'알파드라이브원',member_ko:null,song_title:null,grade:'A'});
t('더쇼 — 곡 - 그룹 순서',"[THE SHOW CHOICE] Pretty Girl - RESCENE [THE SHOW] 260714 방송",'2026-07-14',
  {show:'더쇼',win_date:'2026-07-14',group_ko:'리센느',song_title:'Pretty Girl',grade:'A'});
t('더쇼 — CHOICE - 곡 - 그룹',"[FAN CAM 4K] THE SHOW CHOICE - SWEAT - KISS OF LIFE  [THE SHOW] 260811 방송",'2026-08-11',
  {show:'더쇼',win_date:'2026-08-11',group_ko:'키스오브라이프',song_title:'SWEAT',grade:'A'});
t('더쇼 — 옛 표기(그룹, THE SHOW CHOICE!)',"TWS, THE SHOW CHOICE! [THE SHOW 251021]",'2025-10-21',
  {show:'더쇼',win_date:'2025-10-21',group_ko:'투어스',grade:'A'});
t('더쇼 — @theshow 표기',"[FAN PICK CAM 4K] THE SHOW CHOICE - KISS OF LIFE 'JULIE '  @theshow 260811 방송",'2026-08-11',
  {show:'더쇼',win_date:'2026-08-11',group_ko:'키스오브라이프',grade:'A'});
// 7자리 오타(2607028)는 날짜로 읽지 않는다 — 260702로 잘라 읽으면 엉뚱한 주가 된다.
// 같은 방송의 정상 표기 영상이 따로 있으므로 여기서 못 읽어도 수상 자체는 잡힌다.
t('더쇼 — 7자리 오타 날짜는 무시하고 업로드일 기준',"[FAN CAM] THE SHOW CHOICE - Kids Return - idntt [THE SHOW] 2607028 방송",'2026-07-28',
  {show:'더쇼',win_date:'2026-07-28',group_ko:'아이덴티티',song_title:'Kids Return'});

console.log('── 오탐 방지: 같은 낱말을 쓰는 무관한 제목 ──');
[
  ['빌보드','빌보드 1위 가수의 클래스','2026-08-08'],
  ['유행템','올여름 유행템 1위! 느좋 파츠로 나만의 젤리 슈즈 꾸미기⋆｡˚ | 따라해볼레이 EP.90','2026-07-23'],
  ['서열','장 씨 집안 서열 1위의 등장','2026-07-19'],
  ['예능 서열','[#워너원고] 밧줄까지 평정한 워너원 서열 1위','2026-09-01'],
  ['대기실 브이로그','뮤직뱅크 1위 기념 아이브 대기실 극장','2026-03-13'],
  ['자체 채널 축하글','idntt 첫 뮤직뱅크 1위💚','2026-01-16'],
  ['남의 1위 축하(그룹 오배정 위험)',"RESCENE(리센느) 'LOVE ATTACK' NEWBEAT(뉴비트) ver. | 리센느 선배님들의 1위를 축하드립니다! @RESCENE_official",'2026-07-15'],
  ['게임 1위','게임 1위 도장깨기 하러 매점 온 사람? 이즈 나❤️ 승부욕이 맴~맴맴도는 열쩡 폭주 현장🔥 #인기가요끝나면매점가요2 EP.12 #izna','2026-07-10'],
  ['1위 기념 브이로그','브리즈 1위 축하해!🥳 | RIIZE 라이즈 \'Do your dance\' 음악방송 대기실 비하인드 #2','2026-07-15'],
  ['첫 1위 비하인드','[BEHIND THE SHOW] 리센느 첫 1위 비하인드 궁금한 사람 오이데~ #RESCENE','2026-07-23'],
].forEach(([n,title,pub])=>t('무관 — '+n,title,pub,null));

console.log('── 요일 게이트 ──');
// 실제 방송일이 아닌 날짜가 제목에 박히면(특집 편성·오타) 자동 반영 대상에서 빠져야 한다.
t('뮤뱅인데 날짜가 목요일이면 B',"[4K] 엔하이픈 'Bloody Paradise' 뮤직뱅크 1위 앵콜직캠 (ENHYPEN Encore Facecam) @뮤직뱅크(Music Bank) 260827",'2026-08-27',
  {show:'뮤직뱅크',win_date:'2026-08-27',group_ko:'엔하이픈',grade:'B'});

console.log('── 아티스트 해석 ──');
(()=>{
  const r=_mswResolveArtist('ALPHA DRIVE ONE (알파드라이브원)');
  r&&r.group_ko==='알파드라이브원'&&!r.member_ko?ok('영문(한글) 병기 해석'):bad('영문(한글) 병기 해석',JSON.stringify(r));
  const r2=_mswResolveArtist('NouerA(누에라)');
  r2&&r2.group_ko==='누에라'?ok('괄호 앞 공백 없는 병기'):bad('괄호 앞 공백 없는 병기',JSON.stringify(r2));
  const r3=_mswResolveArtist('듣도보도 못한 그룹');
  r3===null?ok('미등록 아티스트는 null'):bad('미등록 아티스트는 null',JSON.stringify(r3));
})();

console.log(pass?'\n전부 통과':'\n실패 있음');
process.exit(pass?0:1);
