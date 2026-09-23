// Discover "오늘의 케이팝 소식(Today's K-pop)" 선반 회귀 하네스 (2026-09-23 신설)
//
// 앨범 발매·음방 1위·조회수 마일스톤 세 소스를 "오늘" 날짜로만 좁혀 합친 선반. Date.now가 매번
// 달라 정확한 결과는 런타임 단언이 어려우므로, 구조 불변식을 문자열로 동결한다(누가 오늘-필터를
// 빼거나, seeded 제외를 지우거나, 배선을 끊으면 배포 전에 실패).
//
// 실행: node tests/feed-dailynews.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

function extractBraces(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}

console.log('\n── Discover 오늘의 소식 ──');
// DOM + 배선
ck(/id="feed-dailynews-section"/.test(html) && /id="feed-dailynews"/.test(html), '오늘의 소식 섹션 DOM 존재');
ck(/_buildFeedDailyNews\(\)/.test(html), '_buildFeedDailyNews 호출 존재(_buildFeedDisc에서)');
const disc = extractBraces(html, /^function _buildFeedDisc\(/m, '_buildFeedDisc');
ck(/_buildFeedDailyNews\(\)/.test(disc), '_buildFeedDisc가 오늘의 소식 빌더를 호출');
// 기념일보다 먼저 호출돼야 한다(선반 순서 = 시간민감도 순, 이 선반이 "헤드라인"이라는 설계 의도)
const dnIdx = disc.indexOf('_buildFeedDailyNews()');
const annivIdx = disc.indexOf('_buildFeedAnniversaries()');
ck(dnIdx >= 0 && annivIdx >= 0 && dnIdx < annivIdx, '오늘의 소식이 기념일 선반보다 먼저 호출됨(맨 첫 섹션)');

// 빌더 불변식
const fn = extractBraces(html, /^async function _buildFeedDailyNews\(/m, '_buildFeedDailyNews');
ck(/const today=new Date\(\)\.toISOString\(\)\.slice\(0,10\)/.test(fn), '오늘 날짜를 계산함(하드코딩 아님)');
ck(/\.eq\('win_date',today\)/.test(fn), '음방 1위를 오늘 날짜로만 필터');
ck(/\.eq\('crossed_at',today\)/.test(fn), '조회수 마일스톤을 오늘 날짜로만 필터');
ck(/\.eq\('seeded',false\)/.test(fn),
  '최초 시딩분(seeded=true)을 제외함 — 안 걸리면 기존 데이터 전부가 "오늘 크로싱"으로 오인됨');
// 트로피(카드 배지)와 달리 여기선 티어 하한을 걸지 않는다 — 설계 의도(수집은 넓게, 이 선반도 넓게)
ck(!/yt_view_milestones[\s\S]{0,300}gte\('tier'/.test(fn),
  '조회수 마일스톤에 티어 하한을 걸지 않음(작은 그룹의 10만·100만도 소식으로 보여야 함 — 트로피 배지 기준(1000만)과는 다른 축)');
ck(/albumsAll[\s\S]{0,40}filter\(a=>a\.d===todayDot\)/.test(fn), '앨범 발매도 오늘 날짜로만 필터(New Releases의 최근 60일 창과 다름)');
ck(/if\(!items\.length\)return;/.test(fn), '세 소스 다 비면 섹션을 그대로 숨김(억지로 안 채움)');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${fail} 실패`);
process.exit(fail ? 1 : 0);
