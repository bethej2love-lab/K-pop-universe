// 영상 관리 패널 — 검수 큐 정의 일원화 + 탭 결과 캐시 회귀 테스트 (2026-08-27)
//
// 배경(사용자 제보 2건):
//  ① "그룹배정 검수 탭으로 들어간 영상인데 이후 무관 처리했으면 그 탭에서 빠지게 해줘."
//     큐 조회가 `needs_review=true`만 보고 content_flag를 안 봐서, 무관으로 정리한 뒤에도 계속 남았다
//     (실측 2026-08-27: 큐 156건 중 11건이 그 상태). 무관은 "이 그룹배정이 틀렸다"는 판정이라
//     검수를 마친 것과 같으므로 빠지는 게 맞다.
//  ② "여러 탭 한 번 조회했으면 다른 탭 갔다 와도 결과가 일정 기간 유지되게."
//     탭 전환마다 같은 쿼리를 통째로 다시 던지고 있었다(검수/strictSync/카테고리잠금은 _sbFetchAll로
//     수만 행). '전체' 탭 1~2글자 검색(_avsEnsureCache)과 '채널' 탭만 이미 캐시돼 있었다.
//
// 이 테스트가 지키는 것 — 둘 다 "두 곳이 같은 정의를 써야 하는데 한쪽만 고쳐지는" 드리프트 방지다.
// 같은 종류의 사고가 이 프로젝트에서 반복됐다(루틴 vs 버튼, 커버 섹션 vs 탭 노출 판정).
//
// 실행: node tests/vm-panel.test.js

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── ① 검수 큐 정의가 한 곳에 있고, 목록과 홈 카운트가 **둘 다** 그걸 쓰는가 ──────────────
need(/function _vmReviewQueueFilter\(q\)\{/.test(src), '검수 큐 정의가 _vmReviewQueueFilter 한 함수에 있음');
const filterBody = (src.match(/function _vmReviewQueueFilter\(q\)\{[\s\S]*?\n\}/) || [''])[0];
need(/\.eq\('needs_review',true\)/.test(filterBody), '  · needs_review=true 조건 포함');
need(/content_flag\.neq\.무관/.test(filterBody), "  · content_flag='무관'은 제외");

// 목록 조회(_vmLoad의 review 탭)와 홈 카운트 카드가 둘 다 이 함수를 통과해야 한다.
const uses = (src.match(/_vmReviewQueueFilter\(/g) || []).length;
need(uses >= 3, `_vmReviewQueueFilter 사용처 ${uses}곳(정의 1 + 목록 1 + 홈 카운트 1 이상)`);
need(/_admCount\(_vmReviewQueueFilter\(/.test(src), '관리자 홈 카운트 카드가 같은 정의를 사용');
// 큐를 세거나 긁는 곳에서 이 함수를 안 거치고 needs_review를 직접 필터하면 드리프트다.
const rawEq = [...src.matchAll(/\.eq\('needs_review',true\)/g)].length;
need(rawEq === 1, `needs_review=true 직접 필터는 _vmReviewQueueFilter 안 1곳뿐이어야 함 — 발견 ${rawEq}곳`);

// ── ② 무관 처리한 행이 화면에서도 즉시 빠지는가(재조회 없이) ────────────────────────────
need(/const stillFits=r=>_vmTab!=='review'\|\|\(r\.needs_review===true&&r\.content_flag!=='무관'\)/.test(src),
  '_vmRefreshRows의 stillFits가 무관 행을 검수 탭에서 제외(조회 필터와 같은 기준)');
need(/\(tab==='review'&&newFlag==='무관'\)/.test(src),
  "_vmSetFlag가 검수 탭에서 무관으로 바꾼 행을 목록에서 걷어냄");

// ── ③ 탭 결과 캐시 ────────────────────────────────────────────────────────────────────
need(/const _VM_CACHE_TTL=\d+;/.test(src), '탭 캐시 TTL 상수 존재');
const ttl = Number((src.match(/const _VM_CACHE_TTL=(\d+);/) || [])[1]);
need(ttl >= 30000 && ttl <= 600000, `TTL이 상식 범위(30초~10분) — ${ttl}ms`);
need(/const _vmCache=new Map\(\)/.test(src) && /function _vmCacheSync\(\)/.test(src) && /function _vmCacheDropOthers\(\)/.test(src),
  '캐시 저장소 + 동기화(_vmCacheSync) + 타탭 폐기(_vmCacheDropOthers)');

// _vmLoad 본문만 잘라서 검사
function blockAt(from) {
  let i = src.indexOf('{', from), d = 0;
  for (let j = i; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); } }
  return '';
}
const vmLoad = blockAt(src.indexOf('async function _vmLoad('));
need(vmLoad.length > 0, '_vmLoad 본문 파싱됨');
need(/_vmCache\.get\(cacheKey\)/.test(vmLoad) && /Date\.now\(\)-_cached\.ts<_VM_CACHE_TTL/.test(vmLoad),
  '_vmLoad가 조회 전에 TTL 안의 캐시를 먼저 확인');
// 캐시 복원 경로에서 ts를 다시 찍으면 TTL이 "마지막 방문 기준"으로 미끄러져 영원히 재조회가 안 된다.
const restore = vmLoad.slice(vmLoad.indexOf('_cached.ts<_VM_CACHE_TTL'), vmLoad.indexOf('  try{'));
need(!/_vmCacheSync\(\)/.test(restore),
  '캐시 복원 경로는 ts를 갱신하지 않음(TTL이 미끄러지지 않게)');

// 새 조회가 끝나는 지점마다 캐시에 저장돼야 한다 — 렌더 호출 수와 저장 호출 수가 맞는지로 본다.
const renders = (vmLoad.match(/_vmRenderVideoList\(\)/g) || []).length;
const syncs = (vmLoad.match(/_vmCacheSync\(\)/g) || []).length;
need(syncs === renders - 1,
  `_vmLoad의 조회 완료 지점이 전부 캐시에 저장됨 (렌더 ${renders}곳 중 캐시복원 1곳 제외 → 저장 ${syncs}곳)`);

// 목록에서 행을 걷어내는 모든 곳이 캐시에도 반영해야 한다 — 안 하면 탭을 다시 열 때 되살아난다.
const removalLines = src.split('\n');
const missing = [];
removalLines.forEach((l, i) => {
  if (!/_vmRows=_vmRows\.(filter|map)\(/.test(l)) return;
  // 검사 창을 8줄로 잡는 이유: _vmCacheSync는 상태 문구(#vm-status)를 읽어서 캐시에 같이 담으므로
  // **status를 세팅한 뒤**에 와야 하고, 그 사이에 item.remove()·카운트 갱신·설명 주석이 끼어든다.
  // (4줄로 잡았더니 실제로는 반영돼 있는 두 곳이 오탐으로 잡혔다.)
  const near = removalLines.slice(i, i + 8).join('\n');
  if (!/_vmCacheSync\(\)/.test(near)) missing.push(`${i + 1}: ${l.trim().slice(0, 62)}`);
});
need(missing.length === 0,
  `_vmRows를 바꾸는 모든 지점이 캐시에 반영 — 누락 ${missing.length}건${missing.length ? '\n     ' + missing.join('\n     ') : ''}`);

// 일괄 작업은 수천 행을 바꾸므로 캐시를 통째로 버려야 한다. 모든 일괄 버튼이 반드시 거치는
// _snapshotBeforeBulk 한 곳에서 처리한다(새 일괄 버튼이 생겨도 자동으로 적용됨).
const snap = blockAt(src.indexOf('async function _snapshotBeforeBulk('));
need(/_vmCache\.clear\(\)/.test(snap), '_snapshotBeforeBulk(모든 일괄 작업의 관문)가 탭 캐시를 비움');

console.log(pass ? '\n✅ 영상 관리 패널 테스트 통과' : '\n❌ 영상 관리 패널 테스트 실패');
process.exit(pass ? 0 : 1);
