// 탐험 "오리지널 콘텐츠" 선반 제외 규칙 + 조회수/재생시간 표기 테스트 (2026-09-16 신설)
//
// 배경 ①(뮤비 제외): 개인 채널에도 뮤직비디오·리릭비디오가 올라오는데 그건 "오리지널 콘텐츠"가 아니다.
//   ⚠️ 함정: 'mv'를 부분문자열로 보면 "올림픽 MVP 쇼트트랙"이 같이 걸리고, 반대로 "MV Behind The
//      Scenes"·"MV Making Film"·"MV reaction"은 그 자체가 오리지널 콘텐츠인데 같이 날아간다. 실측
//      (idol 채널 가로 1,116건)에서 'MV/M/V' 포함 134건 중 41건이 바로 그 구제 대상이었다.
//
// 배경 ②(라이브 방송 제외): "제목에 live/라이브가 있으면 제외"는 틀린 규칙이다. 같은 실측에서 'live'
//   포함 70건이 거의 전부 라이브 클립·Live Studio Cover·[I'm LIVE]·Live Performance Video 같은
//   **퍼포먼스 영상**이었다. 그래서 제목이 아니라 was_live(유튜브 liveStreamingDetails) + 길이로 본다.
//
// 배경 ③(조회수 표기): 1,000 미만이 "847"처럼 한 자리까지 드러나 위 구간(1.2M+/34K+)과 정밀도가
//   어긋났다 → 백의 자리로 끊는다. DB 값은 정확값 그대로여야 한다(랭킹 정렬이 쓴다).
//
// 실행: node tests/orig-shelf.test.js

const fs=require('fs');
const path=require('path');
const vm=require('vm');
const src=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const admin=fs.readFileSync(path.join(__dirname,'..','admin.js'),'utf8');

let pass=0,fail=0;
const ok=m=>{pass++;console.log(`✅ ${m}`);};
const bad=(m,d)=>{fail++;console.log(`❌ ${m}`);if(d)console.log('   '+d);};
const need=(c,m,d)=>c?ok(m):bad(m,d);

function slice(s,re,label){
  const m=re.exec(s);
  if(!m)throw new Error(`선언을 못 찾음: ${label}`);
  let i=s.indexOf('{',m.index),depth=0;
  for(;i<s.length;i++){
    if(s[i]==='{')depth++;
    else if(s[i]==='}'){depth--;if(depth===0){i++;break;}}
  }
  return s.slice(m.index,i);
}
// 한 줄 선언(정규식 리터럴 const 등)을 그대로 뽑는다 — 중괄호 스캔으로는 못 잡는다.
function line(s,re,label){
  const m=re.exec(s);
  if(!m)throw new Error(`선언을 못 찾음: ${label}`);
  const start=s.lastIndexOf('\n',m.index)+1;
  const end=s.indexOf('\n',m.index);
  return s.slice(start,end<0?s.length:end);
}

const ctx={};
vm.createContext(ctx);
vm.runInContext(line(src,/^const _ORIG_MV_KEEP=/m,'_ORIG_MV_KEEP'),ctx);
vm.runInContext(line(src,/^const _ORIG_MV_DROP=/m,'_ORIG_MV_DROP'),ctx);
vm.runInContext(line(src,/^const _LIVE_ARCHIVE_MIN_SEC=/m,'_LIVE_ARCHIVE_MIN_SEC'),ctx);
vm.runInContext(line(src,/^const _AUTO_LIVE_TITLE=/m,'_AUTO_LIVE_TITLE'),ctx);
vm.runInContext(slice(src,/function _isMusicVideoTitle\(/,'_isMusicVideoTitle'),ctx);
vm.runInContext(slice(src,/function _isLiveArchive\(/,'_isLiveArchive'),ctx);
vm.runInContext(slice(src,/function _fmtVC\(/,'_fmtVC'),ctx);
vm.runInContext(slice(src,/function _fmtDur\(/,'_fmtDur'),ctx);
need(typeof ctx._isMusicVideoTitle==='function','_isMusicVideoTitle 로드됨');

// ── ① 뮤비/리릭비디오는 제외 (실제 DB 제목) ──────────────────────────────────
[
  "HYOLYN(효린) 'SAY MY NAME(쎄마넴)' Official MV",
  "HYOLYN (효린) 'YOU AND I' M/V",
  "[MV] 주은 (JUEUN) 'Stay' Official MV",
  "백예린 (Yerin Baek) - 'Berlin' (Official Lyric Video)",
  "ROSÉ & Bruno Mars - APT. (Official Music Video)",
  "[Lyric Video] HYOLYN (효린) ChecK 리릭비디오",
  "TAEMIN (태민) - 'FLOAT' Official MV",
].forEach(t=>need(ctx._isMusicVideoTitle(t),`제외: ${t.slice(0,44)}`));

// ── ② 'mv'가 단어 속에 있는 건 걸리지 않아야 한다 ────────────────────────────
// 실측에서 이 한 건이 부분문자열 매칭의 유일한 오탐이었다. 단어 경계 규칙이 풀리면 여기서 잡힌다.
need(!ctx._isMusicVideoTitle('올림픽 MVP 쇼트트랙 2관왕 김길리를 만나다. [SUB.]'),
  'MVP는 뮤비가 아니다(단어 경계)');
need(!ctx._isMusicVideoTitle('SMVILLE 스페셜 무대'),'단어 안의 mv는 무시');

// ── ③ 비하인드·메이킹·리액션·코멘터리는 오리지널 콘텐츠라 남긴다 ─────────────
[
  'JENNIE - ZEN (Official MV Behind The Scenes)',
  "CHUNG HA 청하 | 'EENIE MEENIE (Feat. Hongjoong of ATEEZ)' M/V Making Film",
  '[ENG SUB] 이게 교감이지 뭐야! 효린(HYOLYN) MV reaction |  소유 (SOYOU)',
  'JENNIE - Mantra MV Rehearsal',
  "HYO 효연 'DEEP' MV Commentary with TEAM HYO",
  "CHUNG HA 청하 | 'There Goes Santa Claus!' M/V Shoot Sketch",
  'JENNIE – Love Hangover (Lyrics Breakdown in Korean)',
  'CHUNG HA 청하ㅣ갑자기 공개된 I.O.I 청하 뮤비 비하인드… 이건 못 참지🍦💃💜',
  "[Behind The Scene] JAMIE(제이미) 3D Woman MV",
].forEach(t=>need(!ctx._isMusicVideoTitle(t),`남김: ${t.slice(0,44)}`));

// ── ④ 라이브: 제목이 아니라 was_live + 길이로 판정 ───────────────────────────
// 제목에 LIVE가 있어도 was_live가 아니면(=업로드 영상) 절대 빠지지 않는다 — 이게 이 설계의 핵심.
need(!ctx._isLiveArchive({title:"[LIVE] HYOLYN(효린) '모닝콜' @ 네이버 NOW.",duration_sec:240}),
  '제목에 LIVE가 있어도 was_live가 아니면 남긴다');
need(!ctx._isLiveArchive({was_live:true,duration_sec:213}),
  '프리미어 공개(3분대)는 라이브 아카이브가 아니다');
need(ctx._isLiveArchive({was_live:true,duration_sec:3030}),
  '생방송 아카이브(50분, 청하 Countdown Live)는 제외');
need(!ctx._isLiveArchive({was_live:true,duration_sec:null}),
  '길이를 모르면(백필 전) 자르지 않는다 — 오제외보다 통과가 안전');
need(!ctx._isLiveArchive(null)&&!ctx._isLiveArchive({}),'빈 값에도 안 터짐');
// 제목으로 확실한 단 하나의 예외 — 유튜브 자동 생성 생방송 제목(마이그레이션 전에도 걸러짐)
need(ctx._isLiveArchive({title:'CHUNG HA 청하님의 실시간 스트림'}),
  '유튜브 자동 생성 생방송 제목은 was_live 없이도 제외');
need(ctx._isLiveArchive({title:'소녀소연백서님의 실시간 스트림',duration_sec:0}),
  '길이 0(진행 중/빈 값)이어도 자동 생성 제목은 제외');
need(!ctx._isLiveArchive({title:'실시간 반응 모음 | 따라해볼레이'}),
  '"실시간"만 들어간 일반 콘텐츠는 남긴다(자동 생성 제목 패턴이 아님)');
// const는 vm 컨텍스트의 **속성이 안 된다**(전역 렉시컬 스코프에만 생김) — 값으로 꺼내 확인한다.
need(vm.runInContext('_LIVE_ARCHIVE_MIN_SEC',ctx)===1200,'라이브 아카이브 임계 20분');

// 선반이 두 규칙을 실제로 적용하는가 (호출이 빠지면 규칙만 있고 효과가 없다)
need(/if\(_isMusicVideoTitle\(v\.title\)\)continue;/.test(src),'선반 루프가 뮤비 제외를 적용');
need(/if\(_isLiveArchive\(v\)\)continue;/.test(src),'선반 루프가 라이브 아카이브 제외를 적용');
// 판정에 필요한 컬럼이 select에 실려야 한다 — 안 실리면 v.was_live가 항상 undefined라 규칙이 조용히 죽는다
need(/_FEED_COLS=\(\)=>.*_durCol\(\)\+_liveCol\(\)/.test(src),'_FEED_COLS가 duration_sec·was_live를 함께 선택');
need(/_hasLiveCol=false/.test(src)&&/_probeOptCol\('was_live'/.test(src),
  'was_live 컬럼 부재 폴백(프로브) 있음 — 마이그레이션 전에도 안 깨짐');

// ── ④-2 프로브 자체가 조용히 죽지 않는가 (2026-09-16에 실제로 그랬던 버그) ─────
// _YT_TABLE은 19,1xx행 선언인데 프로브는 17,5xx행에 있다. 즉시 실행하면 TDZ ReferenceError가 나고
// catch(e){}가 삼켜서 _hasDurCol이 영원히 false로 남는다 — 2026-09-10에 넣은 duration_sec 기능이
// 실제로 그 상태로 방치돼 있었다(컬럼도 있고 데이터도 12.7만 건 있는데 select에 한 번도 안 실렸음).
// 두 가지를 못박는다: ①프로브는 스크립트 본문 뒤로 미룬다 ②실패를 콘솔에 남긴다.
need(/setTimeout\(async\(\)=>\{[\s\S]{0,400}?select\(col\)\.limit\(1\)/.test(src),
  '선택 컬럼 프로브가 스크립트 본문 뒤로 미뤄짐(_YT_TABLE TDZ 회피)');
need(/프로브가 던짐/.test(src),'프로브 예외를 조용히 삼키지 않고 콘솔에 남김');
need(_probeIdx()<src.indexOf("const _YT_TABLE='yt_channel_videos'"),
  '프로브가 _YT_TABLE 선언보다 위에 있다는 전제 자체를 테스트가 알고 있음(위치가 바뀌면 이 가드 재검토)');
function _probeIdx(){return src.indexOf('function _probeOptCol(');}
// 딥링크 진입(카드가 로드 직후 자동 오픈)에서 프로브를 앞지르지 않도록 조회부가 기다린다
need(/const _optColsReady=Promise\.all\(/.test(src),'프로브 완료를 기다릴 수 있는 promise 존재');
need((src.match(/await _optColsReady;/g)||[]).length>=2,
  `영상 조회부가 프로브를 기다림 (${(src.match(/await _optColsReady;/g)||[]).length}곳)`);

// ── ⑤ 조회수 표기 — 1,000 미만은 백의 자리까지 ───────────────────────────────
need(ctx._fmtVC(847)==='800+','847 → 800+',ctx._fmtVC(847));
need(ctx._fmtVC(150)==='100+','150 → 100+',ctx._fmtVC(150));
need(ctx._fmtVC(999)==='900+','999 → 900+',ctx._fmtVC(999));
need(ctx._fmtVC(100)==='100+','100 → 100+',ctx._fmtVC(100));
need(ctx._fmtVC(99)==='<100','99 → <100(뭉갤 자리가 없음)',ctx._fmtVC(99));
need(ctx._fmtVC(0)==='<100','0도 <100',ctx._fmtVC(0));
need(ctx._fmtVC(1200)==='1K+','1,200 → 1K+(기존 규칙 유지)',ctx._fmtVC(1200));
need(ctx._fmtVC(167000000)==='167M+','1.67억 → 167M+(기존 규칙 유지)',ctx._fmtVC(167000000));
need(ctx._fmtVC(null)===''&&ctx._fmtVC(undefined)==='','값이 없으면 빈 문자열(호출부가 줄을 숨김)');
// ⚠️ 표기만 뭉갠다 — 저장은 정확값이어야 한다(랭킹 정렬 근거).
need(/view_count:vc/.test(admin)&&!/Math\.floor\(vc\/100\)/.test(admin),
  '수집은 정확값 그대로 저장(표기만 반올림)');
// 표기 규칙이 다시 여러 곳으로 흩어지지 않았는가
need(!/Math\.floor\(n\/1000000\)\+'M\+'/.test(src),'조회수 표기식이 _fmtVC 밖에 복제돼 있지 않음');

// ── ⑥ 재생시간 표기 ──────────────────────────────────────────────────────────
need(ctx._fmtDur(208)==='3:28','208초 → 3:28',ctx._fmtDur(208));
need(ctx._fmtDur(46)==='0:46','46초 → 0:46',ctx._fmtDur(46));
need(ctx._fmtDur(3725)==='1:02:05','3,725초 → 1:02:05',ctx._fmtDur(3725));
need(ctx._fmtDur(3600)==='1:00:00','3,600초 → 1:00:00',ctx._fmtDur(3600));
// null(아직 백필 안 됨)에 "0:00"을 찍으면 "길이 0초 영상"으로 읽힌다 — 배지를 아예 안 그려야 한다
need(ctx._fmtDur(null)===''&&ctx._fmtDur(undefined)===''&&ctx._fmtDur(0)==='',
  '길이를 모르거나 0이면 빈 문자열(배지 자체를 안 그림)');

// ── ⑦ 수집 경로 — 쿼터 추가 0으로 duration/was_live를 같이 받는가 ────────────
need(/part=statistics,snippet,contentDetails,liveStreamingDetails/.test(admin),
  '정기 조회수 갱신이 재생시간·생방송여부를 같이 받음');
need(/part=\$\{_parts\}/.test(admin)&&/'statistics'\+\(_dur\?',contentDetails':''\)/.test(admin),
  '순환 갱신(전체 테이블 한 바퀴)도 같이 받음 — 이게 예능·개인채널 duration을 채우는 유일한 경로');
need(/_ytWasLive=it=>!!it\.liveStreamingDetails/.test(admin),'was_live 판정은 liveStreamingDetails 유무');
need(/if\(ds!=null\)patch\.duration_sec=ds;/.test(admin),
  '재생시간을 못 읽으면 덮어쓰지 않음(0으로 저장 금지)');
need(/_ytColSupported/.test(admin),'없는 컬럼을 patch에 넣어 배치를 통째로 죽이지 않도록 프로브함');
need(fs.existsSync(path.join(__dirname,'..','live_broadcast_migration.sql')),
  'live_broadcast_migration.sql 존재');

// ── ⑧ 재생시간 배지가 실제로 붙는가(썸네일 3개 면) ──────────────────────────
need(/function _attachDurBadge\(/.test(src)&&/function _placeDurBadge\(/.test(src),'배지 헬퍼 존재');
need((src.match(/_attachDurBadge\(/g)||[]).length>=4,
  `배지가 카드 그리드·모아보기·연결카드 타일에 붙음 (${(src.match(/_attachDurBadge\(/g)||[]).length}곳)`);
need((src.match(/_placeDurBadge\(/g)||[]).length>=3,'썸네일 높이를 잰 자리에서 배지 위치를 잡아줌');
need(/className='feed-card-dur'/.test(src),'탐험 선반 카드에도 배지');
need((src.match(/dur:song\.dur/g)||[]).length>=3,'단일 영상 선반 3종이 길이를 카드로 넘김');
const css=fs.readFileSync(path.join(__dirname,'..','kpop_universe.css'),'utf8');
need(/\.gc-ch-dur\{/.test(css)&&/\.feed-card-dur\{/.test(css),'배지 CSS 존재');
need(/translateY\(calc\(-100% - 4px\)\)/.test(css),
  '배지는 JS가 준 top에서 자기 높이만큼 되올려 썸네일 밑변에 맞춤');

console.log(`\n${pass}/${pass+fail} 통과${fail?`, ${fail}개 실패`:''}`);
process.exit(fail?1:0);
