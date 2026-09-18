// 차트 정의 드리프트 가드 — index.html(화면)과 kpopuniverse-share의 스냅샷 크론이 같은 차트를 봐야 한다
// (2026-09-18 신설)
//
// 왜: "주간 개인 직캠 TOP 20 / 월간 무대 TOP 30"의 순위 변동 배지는 rank_snapshots와 화면 목록을 대조해
// 만든다. 그런데 스냅샷은 Vercel 크론(kpopuniverse-share/api/cron/snapshot-ranks.js)이 **자기 코드로**
// 차트를 다시 계산해 넣는 구조라, 한쪽만 바뀌면 두 목록이 서로 다른 물건이 되고 겹치지 않는 항목이 전부
// "NEW"로 찍힌다. 실측(2026-09-18): 월간 무대 30자리 중 15개가 스냅샷에 없어 절반이 NEW였고, 직캠은
// 화면 11개 vs 스냅샷 15개로 개수부터 안 맞았다. 원인은 크론이 아래를 못 따라간 것 —
//   content_flag '보류' 제외 / _applyLiveExclude / _filterBannedVideos / 월간 무대 쇼츠 제외(2026-09-10)
//   / 직캠 판정의 PROMO 2단 구조 / 7일 풀 limit 300.
// 사람이 두 레포를 같이 고치는 걸 기억하는 데 의존하면 또 어긋난다 — 그래서 상수/판정을 기계로 대조한다.
//
// ⚠️ 이 테스트는 **문자열 대조가 정당한 드문 경우**다. 매칭 로직의 정확도를 재는 게 아니라 "두 파일에
//    적힌 같은 값이 실제로 같은가"만 보기 때문. 로직이 맞는지는 실물 대조(scratchpad parity 스크립트,
//    화면 목록 vs 크론 계산 결과)로 따로 확인했다.
//
// ⚠️ 형제 레포가 없으면(CI 러너 등) 조용히 스킵한다 — 실패로 만들면 CI가 영영 빨간불이 된다.
// 실행: node tests/chart-snapshot-parity.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CRON = path.join(ROOT, '..', 'kpopuniverse-share', 'api', 'cron', 'snapshot-ranks.js');

if (!fs.existsSync(CRON)) {
  console.log('⏭️  kpopuniverse-share 레포가 옆에 없음 — 스킵 (로컬에서만 도는 검사)');
  process.exit(0);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cron = fs.readFileSync(CRON, 'utf8');

let pass = 0, fail = 0;
const ok = m => { pass++; console.log(`✅ ${m}`); };
const bad = m => { fail++; console.log(`❌ ${m}`); };

// `const NAME=...` 한 줄에서 값 부분만 뽑아 공백을 지운 정규형으로 비교한다(따옴표 스타일·들여쓰기 무시).
function literal(src, name) {
  const i = src.search(new RegExp('(?:^|\\n)\\s*(?:export\\s+)?const\\s+' + name + '\\s*='));
  if (i < 0) return null;
  const eq = src.indexOf('=', i);
  let end = src.indexOf('\n', eq);
  // 여러 줄로 쓰인 경우(크론의 BANNED_GLOBAL_RE 등)는 세미콜론까지
  const semi = src.indexOf(';', eq);
  if (semi > -1 && (end < 0 || semi < end)) end = semi;
  else if (semi > -1 && src.slice(eq, end).split('(').length !== src.slice(eq, end).split(')').length) end = semi;
  return src.slice(eq + 1, end).replace(/\s+/g, '').replace(/;$/, '');
}

// ── 값이 같아야 하는 상수 (index.html 이름 → 크론 이름) ──
for (const [a, b] of [
  ['_LIVE_EXCLUDE', 'LIVE_EXCLUDE'],
  ['_STAGE_EXCLUDE_FORMATS', 'STAGE_EXCLUDE_FORMATS'],
  ['_SHORT_CLIP_SEC', 'SHORT_CLIP_SEC'],
  ['_BANNED_VIDEO_NAMES_GLOBAL', 'BANNED_VIDEO_NAMES_GLOBAL'],
  ['_FANCAM_BRAND_RE', 'FANCAM_BRAND_RE'],
  ['_FANCAM_PROMO_RE', 'FANCAM_PROMO_RE'],
]) {
  const va = literal(html, a), vb = literal(cron, b);
  if (va == null) { bad(`index.html에서 ${a}를 못 찾음 — 이름이 바뀌었으면 이 테스트도 같이 고칠 것`); continue; }
  if (vb == null) { bad(`크론에서 ${b}를 못 찾음 — index.html의 ${a}가 크론에 없다`); continue; }
  if (va === vb) ok(`${a} ≡ ${b}`);
  else bad(`${a} ≠ ${b}\n    index.html: ${va}\n    cron      : ${vb}`);
}

// ── 크론이 빠뜨리면 조용히 NEW 폭증으로 이어지는 조건들 ──
const must = [
  ['보류', /보류/, 'content_flag 보류 제외 (2026-08-27 추가분)'],
  ['[live] 제외', /%\[live\]%/, '제목 [live] 제외 (_applyLiveExclude)'],
  ['title_norm', /title_norm=not\.ilike/, '_LIVE_EXCLUDE를 title_norm에 적용'],
  ['content_formats', /content_formats=not\.cs/, '_STAGE_EXCLUDE_FORMATS(안무영상) 제외'],
  ['금칙 이름', /BANNED_GLOBAL_RE/, '_filterBannedVideos 상당'],
  ['월간 쇼츠 제외', /!isShortClip\(v\)/, '월간 무대 쇼츠 제외 (2026-09-10 추가분)'],
  ['7일 풀 limit 300', /fetchPool\([^)]*since7[^)]*300\)/, '7일 풀 limit이 화면과 같은 300'],
  ['30일 풀 limit 500', /fetchPool\([^)]*since30[^)]*500\)/, '30일 풀 limit이 화면과 같은 500'],
];
for (const [label, re, why] of must) {
  re.test(cron) ? ok(`크론에 ${label} 있음 — ${why}`) : bad(`크론에 ${label} 없음 — ${why}`);
}

// ── 화면 쪽 안전망: 스냅샷에 없다고 무조건 NEW로 찍으면 안 된다 ──
// 크론을 고쳐도 이 가드는 남아야 한다(두 곳에서 따로 계산하는 구조인 한 또 어긋난다).
/published_at\s*\|\|\s*''\)\s*>=\s*prev\.date/.test(html)
  ? ok('화면: NEW 판정이 published_at 기준 (스냅샷 누락만으로는 NEW 안 붙음)')
  : bad('화면: NEW 판정이 published_at을 안 봄 — 크론이 어긋나면 거짓 NEW가 다시 쏟아진다');
/return\{date:prevDate,ranks:m\}/.test(html)
  ? ok('화면: _fetchPrevRanks가 스냅샷 날짜를 같이 반환')
  : bad('화면: _fetchPrevRanks가 날짜를 안 주면 published_at 비교를 할 수 없다');

console.log(`\n${fail ? '❌' : '✅'} ${pass}/${pass + fail} 통과`);
process.exit(fail ? 1 : 0);
