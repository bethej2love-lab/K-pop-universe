// 영상 발행 상대표기(_fmtVidAgo) 회귀 테스트 (2026-09-02 신설)
//
// 배경: 17시간 전에 올라온 코르티스 롤라팔루자 영상이 "어제"로 표기된다는 제보. 원인은 표기 함수가
// 아니라 **데이터**였다 — 동기화가 유튜브의 정확한 업로드 시각을 `slice(0,10)`으로 잘라 날짜만
// 저장해서, "2026-09-01"이 그 날 00:00 UTC(=한국시간 오전 9시)로 읽혀 경과가 31시간으로 계산됐다.
// 고친 것: ①동기화가 published_ts(timestamptz)를 따로 저장 ②이 함수는 **시각이 없는 값이면 시간을
// 지어내지 않고** 달력 기준(오늘/어제/N일 전)으로 떨어진다.
//
// 실행: node tests/vid-ago.test.js

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

const ctx={currentLang:'ko'};
vm.createContext(ctx);
vm.runInContext(slice(src,/function _fmtVidAgo\(/,'_fmtVidAgo'),ctx);
need(typeof ctx._fmtVidAgo==='function','_fmtVidAgo 로드됨');

const hoursAgo=h=>new Date(Date.now()-h*3600000).toISOString();
const daysAgoDate=n=>{const d=new Date();d.setDate(d.getDate()-n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};

// ── ① 시각이 있는 값(published_ts) — 여기서만 "N시간 전"을 쓴다 ────────────────
need(ctx._fmtVidAgo(hoursAgo(0.5))==='방금','30분 전 → 방금',ctx._fmtVidAgo(hoursAgo(0.5)));
need(ctx._fmtVidAgo(hoursAgo(3))==='3시간 전','3시간 전',ctx._fmtVidAgo(hoursAgo(3)));
// 사용자가 제보한 바로 그 케이스
need(ctx._fmtVidAgo(hoursAgo(17))==='17시간 전','17시간 전 영상은 "17시간 전"(제보 케이스)',ctx._fmtVidAgo(hoursAgo(17)));
need(ctx._fmtVidAgo(hoursAgo(23))==='23시간 전','23시간까지는 시간 표기',ctx._fmtVidAgo(hoursAgo(23)));
need(ctx._fmtVidAgo(hoursAgo(25))==='어제','24시간 넘으면 어제',ctx._fmtVidAgo(hoursAgo(25)));
need(ctx._fmtVidAgo(hoursAgo(47))==='어제','47시간까지 어제',ctx._fmtVidAgo(hoursAgo(47)));
need(ctx._fmtVidAgo(hoursAgo(50))==='2일 전','48시간 넘으면 N일 전',ctx._fmtVidAgo(hoursAgo(50)));

// ── ② 시각이 없는 값(옛 행의 published_at) — 시간을 지어내면 안 된다 ───────────
// 이게 이번 버그의 핵심. "어제 날짜"에 시간 계산을 하면 자정 UTC 기준이라 한국시간에서 최대
// 33시간까지 부풀려져 엉뚱한 "N시간 전"/"어제"가 나온다.
const yd=ctx._fmtVidAgo(daysAgoDate(1));
need(yd==='어제',`날짜만 있으면 달력 기준 — 어제 날짜는 "어제"`,yd);
const td=ctx._fmtVidAgo(daysAgoDate(0));
need(td==='오늘',`날짜만 있으면 오늘 날짜는 "오늘"(가짜 시간 표기 금지)`,td);
need(!/시간 전/.test(td)&&!/시간 전/.test(yd),'날짜만 있는 값에서 "N시간 전"이 절대 안 나옴',`오늘=${td} 어제=${yd}`);
need(ctx._fmtVidAgo(daysAgoDate(3))==='3일 전','날짜만 있어도 며칠 전은 정확',ctx._fmtVidAgo(daysAgoDate(3)));

// 빈 값·깨진 값은 조용히 빈 문자열
need(ctx._fmtVidAgo('')===''&&ctx._fmtVidAgo(null)===''&&ctx._fmtVidAgo('그냥문자')==='','빈 값/깨진 값은 빈 문자열');

// 영어
ctx.currentLang='en';
need(ctx._fmtVidAgo(hoursAgo(17))==='17h ago','영어 — 17h ago',ctx._fmtVidAgo(hoursAgo(17)));
need(ctx._fmtVidAgo(daysAgoDate(1))==='yesterday','영어 — 날짜만이면 yesterday',ctx._fmtVidAgo(daysAgoDate(1)));
ctx.currentLang='ko';

// ── ③ 데이터 쪽(동기화)이 정확한 시각을 실제로 저장하는가 ──────────────────────
// 표기 함수만 고치면 소용없다 — 원인은 동기화가 시각을 잘라버린 것이었다.
need(/const publishedTs=item\.snippet\.publishedAt\|\|null;/.test(admin),
  '동기화가 유튜브 publishedAt을 자르지 않고 그대로 보관');
need(/published_ts:publishedTs,/.test(admin),'동기화 행에 published_ts가 실림');
need(/part=statistics,snippet/.test(admin),
  '조회수 갱신이 snippet을 같이 받아 옛 행의 업로드 시각을 백필(쿼터 추가 0)');
// 마이그레이션 전 환경에서 동기화/피드가 깨지지 않아야 한다
need(/_ytHasPubTs/.test(admin),'admin: published_ts 컬럼 부재 폴백 있음');
need(/_isPubTsMissing/.test(src)&&/_hasPubTs=false/.test(src),'index: 컬럼 부재 시 select에서 빼고 재조회');
// 피드가 실제로 새 컬럼을 우선 쓰는가
need(/paFull:v\.published_ts\|\|v\.published_at/.test(src),
  '피드가 published_ts를 우선 사용(없으면 published_at으로 폴백)');
need((src.match(/paFull:v\.published_ts/g)||[]).length===2,
  '피드 두 곳(Trend·즐겨찾기 신규) 모두 반영');

console.log(`\n${pass}/${pass+fail} 통과${fail?`, ${fail}개 실패`:''}`);
process.exit(fail?1:0);
