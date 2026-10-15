// 행사 태그(shared.js _eventTags) 불변식 (2026-10-15)
// 시상식·연말 무대·페스티벌·해외 특집 음방을 제목에서 찾아 'EV:<시리즈>'·'EV:<시리즈>:<회차>'를 붙인다(admin.js 세부 포맷 스윕).
// 실데이터 표본 4,596건으로 규칙을 맞추며 실제로 걸렸던 함정들을 고정한다.
// 실행: node tests/event-tags.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'shared.js'), 'utf8');
const start = src.indexOf('const _EV_CITY=');
if (start < 0) { console.error('❌ shared.js에 _EV_CITY 없음'); process.exit(1); }
const ctx = {}; vm.createContext(ctx);
vm.runInContext(src.slice(start) + '\nthis._eventTags=_eventTags;', ctx);
let pass = 0, fail = 0;
const eq = (title, pub, want, why) => {
  const got = JSON.stringify(ctx._eventTags(title, pub));
  if (got === JSON.stringify(want)) pass++; else { fail++; console.error(`❌ ${why}\n   "${title}" ${pub}\n   기대 ${JSON.stringify(want)}\n   실제 ${got}`); }
};
// 마마무·엑소 노래 MAMA는 행사가 아니다
eq('[MV] 마마무 (MAMAMOO) - 딩가딩가', '2022-10-15', [], '마마무는 MAMA 행사 아님(단어 경계)');
eq('EXO-K 엑소케이 \'MAMA\' MV', '2012-04-08', [], '엑소 노래 MAMA는 연도/AWARDS 없으면 행사 아님');
// 연말 행사: 제목에 연도가 없으면 11월 전 업로드는 직전 해 회차(그해 회차는 아직 안 열림)
eq('MAMA AWARDS 무대 직캠', '2026-03-01', ['EV:mama', 'EV:mama:2025'], '연말 행사 — 3월 업로드는 전년도');
eq('MAMA AWARDS 무대 직캠', '2025-11-30', ['EV:mama', 'EV:mama:2025'], '연말 행사 — 11월 업로드는 그해');
eq('[#2023MAMA] Red Carpet with RIIZE', '2024-02-01', ['EV:mama', 'EV:mama:2023'], '제목 연도가 우선');
// 연초 행사는 업로드 연도 그대로
eq('제39회 골든디스크 무대', '2025-01-06', ['EV:gda', 'EV:gda:2025'], '골든디스크는 1월 개최 — 업로드 연도');
// 가요대전 썸머는 연말 가요대전과 별개 회차
eq('[2026 가요대전 썸머 4K] 직캠 @SBS GayoDaejeon', '2026-08-18', ['EV:sbs-gayo', 'EV:sbs-gayo:2026-Summer'], '가요대전 썸머 별도 회차');
// 도시가 회차를 가른다
eq('ACAI - CORTIS [2026 뮤직뱅크 인 바르셀로나] | KBS 261007 방송', '2026-10-07', ['EV:mb-in', 'EV:mb-in:2026-Barcelona'], '해외 특집 음방 도시');
eq('남자 없이 잘 살아 - miss A | MUSIC BANK IN ISTANBUL 2012 | KBS 121117 방송', '2024-01-28', ['EV:mb-in', 'EV:mb-in:2012-Istanbul'], '옛 무대 재업로드 — 제목 연도');
eq('앤팀(&TEAM), 케이콘 재팬 레드카펫 | &TEAM KCON JAPAN 2026', '2026-05-10', ['EV:kcon', 'EV:kcon:2026-Japan'], 'KCON 도시');
// 6자리 방송일(261007)을 연도로 오인하지 않는다
eq('워터밤 무대 | 250712', '2025-07-13', ['EV:waterbomb', 'EV:waterbomb:2025'], '6자리 날짜는 연도 아님');
console.log(fail ? `💥 행사 태그 테스트 실패 ${fail}건 (통과 ${pass})` : `✅ 행사 태그 테스트 통과 ${pass}건`);
process.exit(fail ? 1 : 0);
