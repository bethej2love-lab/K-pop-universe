// 프로그램 컬렉션 회귀 하네스 (2026-09-05 신설)
//
// 왜 만들었나: 검색 "불후의명곡"→모아보기 카드, 그룹/멤버 카드 "출연 프로그램" 2x2, 그리고 그 후속
// 수정 4종(오버레이 z-순서·최신순 정렬·'자컨'→'Original'·오리지널 선반 쇼츠 제외)을 배포 전에 고정한다.
// 사용자 지적("제발 그런 오류 안 나게 미리 좀 검사"에 대한 체계적 답 — 손검수 말고 코드로 잠근다).
//
// 방식(overlay-front.test.js와 동일 계열, 브라우저 불필요): 실제 index.html에서 코드를 잘라
// (1) _matchPrograms를 진짜 실행해 프로그램명 검색 매칭을 검증하고, (2) 수정된 지점들의 소스 불변식을
// 문자열로 동결한다(누가 최신순 정렬을 다시 shuffle로 바꾸거나, 선반 쇼츠 제외를 지우면 실패).
//
// 못 잡는 것: 실제 픽셀·2x2 렌더·모바일 레이아웃은 아이폰 눈검수 필요. 여기선 로직/구조만 지킨다.
//
// 실행: node tests/program-collection.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

// ── 하네스 헬퍼(overlay-front.test.js와 동일) ─────────────────────────────────
function extractBraces(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}
function extractStmt(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let d = 0;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ';' && d === 0) return src.slice(m.index, i + 1);
  }
  throw new Error('[harness] ; 못 찾음: ' + label);
}

// ── Part 1: _matchPrograms 실제 실행(프로그램명 검색 매칭) ─────────────────────
console.log('\n── Part 1: _matchPrograms 런타임(검색 매칭) ──');
(() => {
  const normEn = extractBraces(html, /^function _normEn\(/m, '_normEn');
  const progColl = extractStmt(html, /^const _PROGRAM_COLLECTIONS\s*=/m, '_PROGRAM_COLLECTIONS');
  const matchFn = extractBraces(html, /^function _matchPrograms\(/m, '_matchPrograms');
  const api = new Function(normEn + '\n' + progColl + '\n' + matchFn +
    '\nreturn {mp:_matchPrograms, PC:_PROGRAM_COLLECTIONS, normEn:_normEn};')();
  const run = q => api.mp(q, q.toLowerCase(), api.normEn(q)).map(p => p.key);

  ck(api.PC.length >= 10, `프로그램 목록 ${api.PC.length}개(10+ 기대)`);
  // 모든 항목이 필수 필드를 갖는지(kw 배열·label) — 빠지면 매칭/렌더가 조용히 깨진다
  ck(api.PC.every(p => p.key && p.label && Array.isArray(p.kw) && p.kw.length), '모든 프로그램이 key/label/kw 보유');

  const cases = [
    ['불후의명곡', 'immortal'],
    ['불후', 'immortal'],          // 접두 2자
    ['리무진', 'limousine'],
    ['리무진서비스', 'limousine'],
    ['주간아이돌', 'weeklyidol'],
    ['아는형님', 'knowingbros'],
    ['전참시', 'manager'],
    ['weekly idol', 'weeklyidol'], // 영문명(_normEn 경로)
    ['killing voice', 'killingvoice'],
  ];
  cases.forEach(([q, key]) => {
    const keys = run(q);
    ck(keys.includes(key), `"${q}" → ${key} 매칭 (실제: [${keys.join(',')}])`);
  });

  // 매칭되면 안 되는 것들(오탐 방지)
  [['뉴진스'], ['a'], [''], ['ㅋㅋ']].forEach(([q]) => {
    ck(run(q).length === 0, `"${q}" → 매칭 없음(오탐 방지)`);
  });

  // 온전한 프로그램명은 정확히 1개만 나와야(다른 프로그램으로 새지 않게)
  ck(run('불후의명곡').length === 1, '"불후의명곡"은 정확히 1개만 매칭');
})();

// ── Part 2: 최신순 정렬 잠금(_openProgramCollection) ───────────────────────────
// 사용자 요청으로 shuffle/diversify를 걷어내고 published_at desc로 고정했다. 누가 되돌리면 실패.
console.log('\n── Part 2: 모아보기 최신순 정렬 잠금 ──');
(() => {
  const fn = extractBraces(html, /^async function _openProgramCollection\(/m, '_openProgramCollection');
  ck(/order\('published_at',\{ascending:false\}\)/.test(fn), "_openProgramCollection: published_at desc 정렬 유지");
  ck(!/_shuffle\(/.test(fn) && !/_diversifyFeed\(/.test(fn), '_openProgramCollection: shuffle/diversify 없음(최신순 보장)');
  ck(/_openFeedListOverlay\(/.test(fn), '_openProgramCollection: 결과를 _openFeedListOverlay로 연다');
})();

// ── Part 3: Discover 오리지널 콘텐츠 선반 쇼츠 제외 잠금(_buildFeedJacon) ──────
console.log('\n── Part 3: 오리지널 선반 쇼츠 제외 잠금 ──');
(() => {
  const fn = extractBraces(html, /^async function _buildFeedJacon\(/m, '_buildFeedJacon');
  ck(/\.eq\('is_short',\s*false\)/.test(fn), "_buildFeedJacon: is_short=false(쇼츠 제외) 유지");
  ck(/\.eq\('source_tier','idol'\)/.test(fn), "_buildFeedJacon: source_tier='idol'(개인채널) 유지");
})();

// ── Part 4: '자컨'→'Original' 라벨 + 빈 탭 방지 구조 ──────────────────────────
console.log("\n── Part 4: 카드 'Original' 탭 구조 ──");
(() => {
  ck(/catTabs\.splice\(1,0,\['jacon','Original'\]\)/.test(html), "개인채널 영상 있을 때만 'Original' 탭 삽입(빈 탭·깜빡임 방지)");
  ck(!/_jaconTab/.test(html), "옛 _jaconTab(초기 배열 상주) 잔재 없음");
  // 탭 라벨(배열 튜플)에 한글 '자컨'을 쓰지 않는다(다른 탭과 톤 통일). 주석 속 설명은 허용하므로
  // 배열 리터럴 [...자컨...] 안에만 없으면 통과 — 주석의 서술형 '자컨'까지 잡지 않게 범위를 좁힌다.
  ck(!/\[[^\]]*자컨[^\]]*\]/.test(html), "탭 라벨 배열에 '자컨' 미사용(다른 탭과 톤 통일)");
})();

// ── Part 5: 프로그램 컬렉션 배선(검색 hit + 카드 행 + 오프너) ─────────────────
console.log('\n── Part 5: 프로그램 컬렉션 배선 ──');
(() => {
  // 검색: doSearch가 프로그램 hit을 넣고, _makeSearchItem이 program 타입을 클릭 처리
  ck(/_matchPrograms\(q,ql,qln\)\.forEach/.test(html), 'doSearch: _matchPrograms 결과를 hits에 추가');
  ck(/type:'program'/.test(html), "검색 hit type:'program' 존재");
  ck(/if\(h\.type==='program'\)/.test(html), "_makeSearchItem: program 클릭 분기 존재");
  ck(/_openProgramCollection\(h\.data\)/.test(html), '검색 클릭 → _openProgramCollection(h.data)');
  // 카드: HTML 행 + showGC/showT 호출 + 칩 클릭
  ck(/id="gc-program-row"/.test(html) && /id="tt-program-row"/.test(html), '그룹/멤버 카드에 program-row DOM 존재');
  ck(/_loadProgramRow\(ko,'gc-program-row'\)/.test(html), 'showGC: _loadProgramRow 호출');
  ck(/_loadProgramRow\(_ttGroupQueryKo,'tt-program-row'/.test(html), 'showT: _loadProgramRow 호출');
  ck(/_openProgramCollection\(p,ctx\)/.test(html), '카드 칩 클릭 → _openProgramCollection(p,ctx)');
  // 멤버 카드는 members 결속(동명이인/타멤버 누수 방지) — _loadProgramRow가 memberKo로 contains
  const lp = extractBraces(html, /^async function _loadProgramRow\(/m, '_loadProgramRow');
  ck(/contains\('members',\[memberKo\]\)/.test(lp), '_loadProgramRow: memberKo면 members contains로 좁힘');
  ck(/\.filter\(b=>b\.vids\.length>=2\)/.test(lp), '_loadProgramRow: 2편 이상 프로그램만 노출');
})();

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 프로그램 컬렉션 하네스 통과');
process.exit(fail ? 1 : 0);
