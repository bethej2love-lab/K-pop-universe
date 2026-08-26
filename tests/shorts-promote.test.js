// 가로→쇼츠 일괄 승격 스윕 — 안전장치 회귀 테스트 (2026-08-26)
//
// 배경(사용자 제보 "shorts인데 형식 지정 안 돼서 가로 직사각형에 축소 노출되는 게 왜 이렇게 많냐"):
// 동기화 시점 세로 판별이 원리적으로 불가능했다 — 쇼츠 썸네일도 high/standard/maxres가 전부 가로라
// hiTh.height>hiTh.width가 참이 될 수 없고, 세로 비율을 유지하는 건 oardefault.jpg뿐. 결과적으로 세로
// 영상 약 2.8만 건이 가로 카드로 찌그러져 노출돼 왔다. 이 스윕은 short가 아닌 행을 oardefault 실측으로
// 확인해 세로면 category='short'로 **승격만** 한다.
//
// 이 테스트가 지키는 불변식(28만 행을 건드리는 일괄 작업이라 회귀가 치명적):
//  ① 수동 편집(tags_manual) 보호  ② 강등 금지(short는 조회에서 제외, update는 항상 'short'만)
//  ③ oardefault 실측(_probeIsPortrait)으로만 판정  ④ 중단/재개(커서)  ⑤ 실행 전체가 하나의 되돌리기 batch
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

// ② 강등 금지 — short는 조회에서 빼고(재프로브·강등 원천 차단), 쓰는 값은 오직 'short'
need(fn.includes(".neq('category','short')"), '이미 short인 행은 조회 제외(강등·재프로브 안 함)');
const updates = fn.match(/\.update\(\{category:'[^']*'\}\)/g) || [];
need(updates.length > 0 && updates.every(u => u === ".update({category:'short'})"),
  `카테고리 쓰기는 항상 'short'만(승격 전용) — 발견 ${JSON.stringify(updates)}`);

// ③ oardefault 실측으로만 판정
need(fn.includes('_probeIsPortrait('), 'oardefault 실측(_probeIsPortrait)으로 세로 판정');
need(fn.includes("typeof _probeIsPortrait!=='function'"), '_probeIsPortrait 부재 시 안전하게 중단');

// ④ 중단/재개 — localStorage 커서 + id 오름차순 이어가기
need(fn.includes('_SHORTS_PROMOTE_CURSOR_KEY') && fn.includes('localStorage.setItem'),
  '진행 커서를 localStorage에 저장(재개 지원)');
need(fn.includes(".gt('id',cursor)") && fn.includes(".order('id',{ascending:true})"),
  'id 오름차순 + 커서 이후만 조회(이미 확인한 가로 행 재프로브 안 함)');
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
need(src.includes("getElementById('sp-shortspromote-btn')?.addEventListener('click',_ytSweepPromoteShorts)"),
  '버튼 클릭 핸들러 연결됨');
need(/_BULK_SNAP_COLS=\[[^\]]*'category'[^\]]*\]/.test(src),
  'category가 스냅샷 백업 컬럼에 포함(되돌리기가 category 복원)');

console.log(pass ? '\n✅ 쇼츠 승격 스윕 테스트 통과' : '\n❌ 쇼츠 승격 스윕 테스트 실패');
process.exit(pass ? 0 : 1);
