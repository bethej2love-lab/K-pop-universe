// 무조건 제외 키워드 — 공식 채널 면제 회귀 테스트 (2026-08-27)
//
// 사용자 요청: "제외 키워드에 '닥터킴의'·'최강야구' 추가. 근데 대신 **아이돌 공식 채널에 업로드된
// 영상은 제외 키워드에도 불구하고 무조건 끌어오는** 걸로."
//
// 이 목록은 원래 "남의 채널이 짜깁기해 올린 것"(띵곡팔이류)이나 그룹과 무관한 외부 예능/상담
// 콘텐츠를 걸러내려고 만든 장치다. 그룹/솔로가 **자기 채널에 직접 올린** 영상은 제목에 뭐가 들어
// 있든 그 아티스트의 콘텐츠가 맞으므로 걸러낼 이유가 없다.
//
// 지키는 것: 판단이 `_shouldJunkFlag(title, sourceTier)` **한 곳**에만 있고, 이 규칙을 쓰는 세 경로
// (공식 채널 동기화 · 외부 채널 동기화 · 소급 스윕)가 전부 그 함수를 통과하는지. 한 곳이라도
// `_isJunkVideoTitle`을 직접 부르면 면제가 새서 공식 채널 영상이 조용히 사라진다.
//
// 실행: node tests/junk-exempt.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── 키워드 목록 ──────────────────────────────────────────────────────────────
// ⚠️ `[^\]]*`로 잘라내면 안 된다 — 이 목록엔 '[#여권들고'·'[#학연]'처럼 **대괄호가 들어있는 키워드**가
// 있어서 첫 ']'에서 잘린다(실제로 이 테스트가 처음에 그렇게 헛짚었다). 줄 끝의 `];`까지 통째로 잡는다.
const kwMatch = html.match(/const _JUNK_TITLE_KEYWORDS_GLOBAL=\[([\s\S]*?)\];\n/);
need(!!kwMatch, '_JUNK_TITLE_KEYWORDS_GLOBAL 목록이 존재');
const kws = kwMatch ? [...kwMatch[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]) : [];
for (const k of ['닥터킴의', '최강야구', '띵곡팔이'])
  need(kws.includes(k), `  · 제외 키워드에 '${k}' 포함`);

// ── 면제 판단이 한 곳인가 ────────────────────────────────────────────────────
need(/function _shouldJunkFlag\(title,sourceTier\)\{/.test(html), '면제 판단이 _shouldJunkFlag 한 함수에 있음');
const body = (html.match(/function _shouldJunkFlag\(title,sourceTier\)\{[\s\S]*?\n\}/) || [''])[0];
need(/sourceTier==='official'\)return false/.test(body), "  · source_tier==='official'이면 무관 처리 안 함");
need(/_isJunkVideoTitle\(title\)/.test(body), '  · 그 외에는 기존대로 키워드 검사');

// ── 세 경로가 전부 그 함수를 통과하는가 ──────────────────────────────────────
// admin.js에서 _isJunkVideoTitle을 직접 부르는 곳이 하나라도 남으면 그 경로만 면제가 안 먹는다.
const direct = (admin.match(/_isJunkVideoTitle\(/g) || []).length;
need(direct === 0, `admin.js가 _isJunkVideoTitle을 직접 부르지 않음(전부 _shouldJunkFlag 경유) — 발견 ${direct}곳`);
const uses = (admin.match(/_shouldJunkFlag\(/g) || []).length;
need(uses === 3, `_shouldJunkFlag 사용처 3곳(공식 동기화 · 외부 동기화 · 소급 스윕) — 발견 ${uses}곳`);

need(/_shouldJunkFlag\(v\.title,'official'\)/.test(admin),
  '공식 채널 동기화(_ytSyncGroup)가 source_tier=official로 판단 → 항상 면제');
need(/_shouldJunkFlag\(v\.title,tier\)/.test(admin),
  '외부 채널 동기화(_extBuildRows)는 그 채널의 tier로 판단(official 아님 → 기존대로 걸러냄)');

// 소급 스윕은 source_tier를 select해야 판단할 수 있다 — 안 읽으면 전부 undefined라 면제가 통째로 무력화.
const sweep = (() => {
  const i = admin.indexOf('async function _ytSweepJunkKeywordVideos(');
  let j = admin.indexOf('{', i), d = 0;
  for (let k = j; k < admin.length; k++) { if (admin[k] === '{') d++; else if (admin[k] === '}') { d--; if (!d) return admin.slice(i, k + 1); } }
  return '';
})();
need(sweep.length > 0, '소급 스윕 함수 파싱됨');
need(/\.select\('id,title,source_tier'\)/.test(sweep),
  '  · 스윕이 source_tier를 같이 조회(안 읽으면 면제가 통째로 무력화됨)');
need(/_shouldJunkFlag\(v\.title,v\.source_tier\)/.test(sweep),
  '  · 스윕도 같은 규칙으로 판단');
need(/\.eq\('tags_manual',false\)/.test(sweep),
  '  · 관리자가 직접 저장한 행(tags_manual)은 여전히 안 건드림');

console.log(pass ? '\n✅ 제외 키워드 면제 테스트 통과' : '\n❌ 제외 키워드 면제 테스트 실패');
process.exit(pass ? 0 : 1);
