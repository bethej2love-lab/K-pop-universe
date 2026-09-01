// 가로→쇼츠 일괄 승격 스윕 — 안전장치 회귀 테스트 (2026-08-26)
//
// 배경(사용자 제보 "shorts인데 형식 지정 안 돼서 가로 직사각형에 축소 노출되는 게 왜 이렇게 많냐"):
// 동기화 시점 세로 판별이 원리적으로 불가능했다 — 쇼츠 썸네일도 high/standard/maxres가 전부 가로라
// hiTh.height>hiTh.width가 참이 될 수 없고, 세로 비율을 유지하는 건 oardefault.jpg뿐. 결과적으로 세로
// 영상 약 2.8만 건이 가로 카드로 찌그러져 노출돼 왔다. 이 스윕은 아직 세로가 아닌 행을 oardefault
// 실측으로 확인해 세로면 **is_short=true로 승격만** 한다.
//
// 2026-08-27 직교화: 승격이 category를 'short'로 덮어쓰던 시절엔 세로 직캠을 승격하는 순간 장르가
// 날아가 Live 탭에서 사라졌다. short는 장르가 아니라 형식이므로 is_short 불리언으로 빼냈다
// (is_short_migration.sql). 이 테스트는 그게 다시 category로 되돌아가지 않게 못을 박는다.
//
// 이 테스트가 지키는 불변식(28만 행을 건드리는 일괄 작업이라 회귀가 치명적):
//  ① 수동 편집(tags_manual) 보호  ② 강등 금지 + category 불간섭(쓰는 건 is_short뿐)
//  ③ oardefault 실측(_probeIsPortrait)으로만 판정  ④ 중단/재개(커서)  ⑤ 실행 전체가 하나의 되돌리기 batch
//  ⑥ short 직교화 — 판별/조회/렌더가 전부 is_short 기준
//
// 실행: node tests/shorts-promote.test.js

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

const fnBody = name => {
  const i = src.indexOf(name);
  if (i < 0) return '';
  let d = 0, s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return '';
};

need(/async function _ytSweepPromoteShorts\(\)\{/.test(src), '승격 스윕 함수 _ytSweepPromoteShorts 존재');
const fn = fnBody('async function _ytSweepPromoteShorts');
need(fn.length > 0, '함수 파싱됨');

// ① 수동 편집 보호
need(fn.includes(".eq('tags_manual',false)"), '수동 편집(tags_manual) 행은 조회에서 제외');

// ② 강등 금지 + category 불간섭 — 이미 세로인 행은 조회에서 빼고(재프로브·강등 원천 차단),
//    쓰는 값은 오직 is_short:true. category를 건드리면 승격이 곧 장르 소실이 된다(직교화 이전 버그).
need(fn.includes(".eq('is_short',false)"), '이미 세로인 행은 조회 제외(강등·재프로브 안 함)');
const updates = fn.match(/\.update\(\{[^}]*\}\)/g) || [];
need(updates.length > 0 && updates.every(u => u === '.update({is_short:true})' || u === '.update({short_probed_at:_now})'),
  `쓰기는 is_short:true(승격) 또는 short_probed_at(표식)만 — category 불간섭 — 발견 ${JSON.stringify(updates)}`);
need(!/category/.test(fn), '승격 스윕은 category를 아예 언급하지 않음(장르 소실 재발 방지)');

// ③ oardefault 실측으로만 판정
need(fn.includes('_probeIsPortrait('), 'oardefault 실측(_probeIsPortrait)으로 세로 판정');
need(fn.includes("typeof _probeIsPortrait!=='function'"), '_probeIsPortrait 부재 시 안전하게 중단');

// ④ 중단/재개 — short_probed_at 표식(id 커서 폐기, 2026-08-31). 확인한 행은 표식이 박혀 영구 제외돼
//    재프로브 0이고 커서를 잃어도 안전. 조회는 최신순(부분 인덱스 매칭 → statement timeout 회피).
need(fn.includes('short_probed_at') && fn.includes("update({short_probed_at"),
  '확인한 청크를 short_probed_at으로 표식(재프로브 방지)');
need(fn.includes(".is('short_probed_at',null)") && fn.includes(".order('published_at',{ascending:false})"),
  '표식 없는 것만 최신순 조회(인덱스 매칭 · 재프로브 안 함)');
need(fn.includes('_shortsPromoteRunning'), '실행 중 재클릭으로 중단 가능(토글 플래그)');

// ⑤ 실행 전체가 하나의 되돌리기 batch
need(/const runBatchId=/.test(fn), '실행마다 batchId 하나 생성');
need(fn.includes("_snapshotBeforeBulk('가로→쇼츠 승격',portraitIds,runBatchId)"),
  '청크마다 같은 runBatchId로 스냅샷 → 실행 전체가 한 번에 되돌려짐');

// _snapshotBeforeBulk가 forceBatchId(3번째 인자)를 받도록 확장됐는지
need(/async function _snapshotBeforeBulk\(opLabel,ids,forceBatchId\)\{/.test(src),
  '_snapshotBeforeBulk가 forceBatchId 인자를 받음');
need(/const batchId=forceBatchId\|\|/.test(src), 'forceBatchId가 있으면 그 batch로 묶음');

// 핸들러 연결 + category가 스냅샷 백업 컬럼에 포함(되돌리기 실효성)
// 2026-09-01 — 실행 버튼은 전역 락 래퍼 _admExecBind로 등록(설정패널 개선 1). 쇼츠 승격은
// "실행 중 재클릭=중단" 기능이 있어 selfRestop 옵션으로 등록돼야 그 중단이 락에 막히지 않는다.
need(src.includes("_admExecBind('sp-shortspromote-btn',_ytSweepPromoteShorts,'쇼츠 승격',{selfRestop:true})"),
  '버튼 클릭 핸들러 연결됨(전역 락 _admExecBind · selfRestop)');
need(/_BULK_SNAP_COLS=\[[^\]]*'category'[^\]]*\]/.test(src),
  'category가 스냅샷 백업 컬럼에 포함(되돌리기가 category 복원)');
need(/_BULK_SNAP_COLS=\[[^\]]*'is_short'[^\]]*\]/.test(src),
  'is_short가 스냅샷 백업 컬럼에 포함(승격 되돌리기의 실효성)');

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ short 직교화(2026-08-27) — 형식 플래그가 장르(category)와 분리돼 있는지
// ─────────────────────────────────────────────────────────────────────────────
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

need(/function _isShortV\(v\)\{return !!v&&\(v\.is_short===true\|\|v\.category==='short'\)/.test(html),
  '_isShortV 헬퍼 — is_short 우선 + category===\'short\' 레거시 폴백');

// 판별을 헬퍼 한 곳으로 모았는지: 헬퍼 정의/주석 밖에서 category==='short'를 직접 비교하면 안 된다.
// 면제 대상은 "세로 판별 헬퍼의 정의 줄" 전부다 — 원래 _isShortV만 이름으로 박아뒀는데, 2026-08-27
// 쇼츠 판별 통일에서 곡 객체용 _songIsShort가 새로 생기면서 이 검사가 그날부터 계속 빨간 상태였다
// (2026-08-28 발견). 헬퍼가 또 늘어나도 안 깨지게 이름 대신 "헬퍼 정의 줄" 패턴으로 면제한다.
const HELPER_DEF = /function\s+_(isShortV|songIsShort)\s*\(/;
const strayReads = html.split('\n').filter(l => {
  const t = l.trim();
  if (t.startsWith('//') || HELPER_DEF.test(l)) return false;
  return /category(!|=)=='short'/.test(l);
});
need(strayReads.length === 0,
  `세로 판별은 _isShortV 한 곳에서만 — 직접 비교 잔재 ${strayReads.length}건`);

// category를 읽는 쿼리는 반드시 is_short도 같이 뽑아야 한다 — 안 그러면 폴백(category==='short')만
// 남아서, 승격만 되고 category는 장르인 행(직교화의 정상 상태)이 가로로 그려진다. 이게 이번 리팩터에서
// 가장 조용히 깨지기 쉬운 지점이라 두 파일의 컬럼 목록 문자열을 통째로 훑는다.
const colListRe = /(?:\.select\(|_cols=|selectCols=|_COLS=)\s*(['"`])([^'"`\n]+)\1/g;
const missing = [];
for (const [file, text] of [['index.html', html], ['admin.js', src]]) {
  for (const m of text.matchAll(colListRe)) {
    const cols = m[2].split(',').map(s => s.trim());
    if (cols.includes('category') && !cols.includes('is_short')) {
      missing.push(`${file}: ${m[2].slice(0, 70)}`);
    }
  }
}
need(missing.length === 0,
  `category를 뽑는 컬럼 목록엔 is_short도 포함 — 누락 ${missing.length}건${missing.length ? '\n     ' + missing.join('\n     ') : ''}`);

// Shorts 탭 조회는 플래그 기준(부분 인덱스 idx_ytv_is_short_group_published와 같은 형태)
need((html.match(/filter==='short'\)\{/g) || []).length >= 2 && html.includes(".eq('is_short',true)"),
  "Shorts 탭 필터가 .eq('is_short',true) 기준");

// 동기화 시점: 세로 여부가 category 자리를 뺏지 않는지
need(/function _ytIsShortTitle\(title\)\{/.test(src), '제목 기반 세로 판정이 _ytIsShortTitle로 분리됨');
need(!/return'short'/.test(src), "_ytClassify가 더 이상 'short'를 장르로 반환하지 않음");
need((src.match(/const isShort=isShortThumb\|\|_ytIsShortTitle\(title\)/g) || []).length >= 3,
  '동기화 3경로 모두 썸네일 OR 제목으로 is_short를 따로 계산');
need(/category:cat,is_short:isShort/.test(src), '동기화 행에 category와 is_short가 둘 다 실림');

// ── 실제 동작 확인: 분류기를 잘라와 진짜 제목으로 돌려본다(문자열 검사만으론 못 잡는 회귀 대비) ──
// _YT_PRERECORDED_RE 선언부터 _ytClassify 끝까지가 자기완결 블록이라 그대로 eval한다.
const clsStart = src.indexOf('const _YT_PRERECORDED_RE=');
const clsEnd = src.indexOf('\n}', src.indexOf('function _ytClassify(title){')) + 2;
need(clsStart > 0 && clsEnd > clsStart, '분류기 블록 슬라이스 성공');
const { _ytClassify, _ytIsShortTitle } =
  new Function(src.slice(clsStart, clsEnd) + '\nreturn{_ytClassify,_ytIsShortTitle};')();

const cases = [
  // [제목, 기대 category, 기대 is_short(제목 기준)]
  ['[MC 컷 모음] 오늘의 진행 #shorts', 'other', true],
  ['에스파 카리나 직캠 4K #shorts', 'live', true],   // ★ 예전엔 'short'가 돼서 Live 탭에서 사라졌던 케이스
  ['뉴진스 Super Shy M/V #Shorts', 'mv', true],
  ['아이브 안유진 엠카운트다운 무대', 'live', false],
  ['르세라핌 Performance Video', 'other', false],
  ['OFFICIAL AUDIO - 어떤 곡', 'skip', false],
];
let behavOk = true;
for (const [title, wantCat, wantShort] of cases) {
  const gotCat = _ytClassify(title), gotShort = _ytIsShortTitle(title);
  if (gotCat !== wantCat || gotShort !== wantShort) {
    behavOk = false;
    bad(`"${title}" → category=${gotCat}(기대 ${wantCat}), is_short=${gotShort}(기대 ${wantShort})`);
  }
}
if (behavOk) ok(`분류기 실제 동작 ${cases.length}건 — #shorts가 붙어도 장르를 잃지 않음`);

// ⚠️ 여기 있던 "마이그레이션 SQL이 코드와 같은 전제를 갖는지" 검사 3건은 제거했다(2026-08-31).
// `is_short_migration.sql`은 이미 실행이 끝나 레포에서 삭제됐고(실행 완료된 마이그레이션 12개 정리),
// 스키마의 근거는 이제 파일이 아니라 **라이브 DB**다. 지워진 파일을 계속 읽으면 테스트가 ENOENT로
// 죽기만 하고 실제 스키마와의 어긋남은 못 잡는다(정리 커밋 직후 실제로 이렇게 깨졌다).
// is_short 컬럼 자체의 전제는 위 ①~⑥ 불변식과 admin.js 주석이 지킨다.

console.log(pass ? '\n✅ 쇼츠 승격 스윕 테스트 통과' : '\n❌ 쇼츠 승격 스윕 테스트 실패');
process.exit(pass ? 0 : 1);
