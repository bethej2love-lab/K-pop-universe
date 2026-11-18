// 팬이 찍은 공연·행사 무대는 퍼포먼스(live)다(2026-11-18 사용자 "퍼포먼스로 잡혀야 하는데 기타가 너무 많다").
// '직캠' 낱말 없이 날짜·따옴표 곡명·공연 이름만 적은 제목이 전부 기타로 샜다(최근 30일 기타 34,540건 중 3,264건이 이 꼴).
// 반대로 공연 이름만 있고 무대가 아닌 클립(멘트·등장·시구·M&G·팬싸)은 기타 그대로여야 한다 — 퍼포먼스 탭·차트가 이 값을 쓴다.
// admin.js의 _ytClassify를 그대로 꺼내 실행한다.
const fs = require('fs'), path = require('path'), vm = require('vm');
const js = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const end = js.indexOf('// ── 세부 콘텐츠 포맷 태깅 (content_formats)');
if (end < 0) { console.log('❌ _ytClassify 블록을 못 찾음'); process.exit(1); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(js.slice(0, end) + ';this._ytClassify=_ytClassify;', ctx);
let pass = true;
const cases = [
  ["[4K] 260802 'Runaway' 원이 리센느 WONI RESCENE | 영주 시원나잇 페스타", 'live', true],
  ["251029 'Love Attack' 원이 WONI 리센느 RESCENE 4K 60P | 목포과학대학교 축제", 'live', true],
  ["[4K cam] 260409-11 BTS WORLD TOUR ARIRANG IN GOYANG NOT TODAY Jin Multi-Cam Focus", 'live', false],
  ["230423 Deadlock 쇼케이스 Xdinary Heroes - Happy Death Day [가온 Focus]", 'live', false],
  ["EXO-CBX - Hey Mama! XIUMIN 시우민 focus.", 'live', false],
  ["Momo Dance Break #momo #twice #likey #kpop", 'live', true],
  ["aespa - Intro + Supernova + Whiplash | 2024 MBC Music Festival | #aespa #kpop", 'live', false],
  ["251102 추위이기게 소리질러~!~!!  #TWS #SHINYU #투어스 #신유", 'other', true],
  ["251102 등장✨️ #TWS #SHINYU #투어스 #신유", 'other', true],
  ["[4k] 250629 ZOZO Marines 지바 마린스 시구 TWS KYUNGMIN 투어스 경민", 'other', false],
  ["[4K] 240728 - LA KCON M&G - 투어스 신유 / TWS SHINYU", 'other', false],
  ["260329 STAY in Our Little House #아이엔 #I_N #양정인 #StrayKids #스트레이키즈 #팬미팅", 'other', true],
  ["180603 홍대 팬싸인회 JIMIN Answering Questions", 'other', false],
];
for (const [t, want, short] of cases) { const got = ctx._ytClassify(t, { isShort: short }); if (got !== want) { pass = false; console.log(`❌ ${t} → ${got} (기대 ${want})`); } else console.log(`✅ ${want.padEnd(5)} ${t}`); }
if (!pass) process.exit(1);
console.log('\n✅ 팬 공연 무대 분류 테스트 통과');
