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
  // 2026-09-08: 임계 2 → 4(사용자 요청). 칩 썸네일이 상위 4편 2x2 모자이크라 4편 미만은 빈 칸이 남는다.
  ck(/const PROGRAM_MIN=4/.test(lp) && /\.filter\(b=>b\.vids\.length>=PROGRAM_MIN\)/.test(lp),
    '_loadProgramRow: 4편 이상 프로그램만 노출(PROGRAM_MIN)');
})();

// ── Part 6: 프로그램 목록 자체의 불변식(2026-09-08, 13→28개 확장) ───────────────
// 목록은 앞으로도 계속 늘어난다. 늘릴 때마다 반복될 실수 세 가지를 여기서 못박는다.
console.log('\n── Part 6: _PROGRAM_COLLECTIONS 불변식 ──');
(() => {
  // ⚠️ extractBraces는 `{}`만 세서 배열 리터럴을 못 자른다(첫 객체 하나만 잘려 나온다 — 실제로 겪음).
  //    `[` 깊이로 자르는 전용 추출기를 쓴다. 문자열 안에 대괄호가 없어서 단순 깊이 계산으로 충분하다.
  const start = html.indexOf('[', html.search(/^const _PROGRAM_COLLECTIONS=/m));
  let d = 0, end = start;
  for (; end < html.length; end++) { if (html[end] === '[') d++; else if (html[end] === ']') { d--; if (d === 0) { end++; break; } } }
  const list = eval(html.slice(start, end)); // 순수 리터럴 배열
  // 2026-09-08에 13→28개로 늘렸고, 2026-09-11에 STAR ZOOM IN을 빼서 27개(사용자 요청).
  // 하한만 본다 — 개수 자체가 목적이 아니라 "확장분이 통째로 날아가지 않았나"를 보는 검사다.
  ck(list.length >= 27, `프로그램 ${list.length}개 등록(13→28 확장 후 STAR ZOOM IN 제외)`);

  // ⓪ host(개인 진행 자체 콘텐츠, 2026-09-11) — 진행자가 로스터에 실제로 있어야 한다.
  //    host는 "그 카드에서만 group_ko 제약을 푼다"는 표시라, 오타가 나면 **에러 없이 조용히**
  //    아무 데서도 안 뜬다(사나의 냉터뷰 19건은 게스트 그룹 14팀에 흩어져 있어 진행자 카드 외엔
  //    볼 곳이 없다). 그래서 여기서 이름을 못박는다.
  (() => {
    const ARTISTS = Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'artists.json'), 'utf8')));
    const hosts = list.filter(p => p.host);
    if (!hosts.length) { ck(true, 'host 지정 프로그램 없음(검사 생략)'); return; }
    const bad = hosts.filter(p => !ARTISTS.some(a => a.name && a.name.ko === p.host.mko &&
      ((a.groups || [a.group]).some(g => g && g.ko === p.host.gko))));
    ck(bad.length === 0, `host 진행자 ${hosts.length}명 전부 로스터에 실존` +
      (bad.length ? ` — 없음: ${bad.map(p => `${p.label}(${p.host.gko}/${p.host.mko})`).join(', ')}` : ''));
    const noKw = hosts.filter(p => !p.kw.some(k => k.includes(p.host.mko)));
    ck(noKw.length === 0, 'host 프로그램 키워드에 진행자 이름이 들어감(다른 진행자 회차 혼입 방지)' +
      (noKw.length ? ` — ${noKw.map(p => p.label).join(', ')}` : ''));
  })();

  // ① 키/키워드 중복 — 같은 키워드가 두 프로그램에 있으면 한 영상이 두 버킷에 뜬다
  const keys = list.map(p => p.key);
  ck(new Set(keys).size === keys.length, 'key 중복 없음');
  const seen = new Map(); const dup = [];
  list.forEach(p => p.kw.forEach(k => {
    const n = k.toLowerCase().replace(/\s+/g, '');
    if (seen.has(n) && seen.get(n) !== p.key) dup.push(`${k}(${seen.get(n)}↔${p.key})`);
    seen.set(n, p.key);
  }));
  ck(!dup.length, `키워드 중복 없음${dup.length ? ' — ' + dup.join(', ') : ''}`);

  // ② 채널 브랜드를 키워드로 쓰지 않는다 — 넣으면 그 채널의 다른 프로그램을 통째로 삼킨다
  //    (딩고뮤직 → 킬링보이스·세로라이브·이슬라이브 / 1theK·원더케이 → 릴레이댄스·수트댄스·원더킬포)
  const BRAND = ['딩고뮤직', '딩고 뮤직', 'dingo', '1thek', '원더케이', 'studio choom', '스튜디오춤'];
  const bad = [];
  list.forEach(p => p.kw.forEach(k => { const n = k.toLowerCase().replace(/\s+/g, ''); BRAND.forEach(b => { if (n === b.toLowerCase().replace(/\s+/g, '')) bad.push(`${p.key}:${k}`); }); }));
  ck(!bad.length, `⚠️ 채널 브랜드를 키워드로 쓰지 않음${bad.length ? ' — ' + bad.join(', ') : ''}`);

  // ③ 너무 넓은 단독 키워드 — '인간극장'은 원본 다큐를 끌어온다(실측 6건). '아이돌 인간극장'이어야 함
  ck(!list.some(p => p.kw.some(k => k.replace(/\s+/g, '') === '인간극장')),
    "⚠️ '인간극장' 단독 키워드 금지(원본 다큐 혼입) — '아이돌 인간극장'으로 좁힐 것");

  // ④ 아포스트로피 2종 — _titleNorm은 NFKC+lowercase뿐이라 '(U+0027)와 ’(U+2019)를 안 합친다.
  //    한쪽만 넣으면 실제 제목의 절반이 조용히 빠진다.
  const its = list.find(p => p.key === 'itslive');
  ck(its && its.kw.some(k => k.includes("'")) && its.kw.some(k => k.includes('’')),
    "⚠️ 잇츠라이브 kw에 아포스트로피 2종(' 와 ’) 모두 포함");

  // ⑤ 조회 필터는 큰따옴표로 감싼다(PostgREST 예약문자 → statement_timeout 방지)
  ck(/_PROGRAM_KW_OR=.*title_norm\.ilike\."\*\$\{k\}\*"/.test(html),
    '_PROGRAM_KW_OR: ilike 패턴을 큰따옴표로 감쌈');
})();

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 프로그램 컬렉션 하네스 통과');
process.exit(fail ? 1 : 0);
