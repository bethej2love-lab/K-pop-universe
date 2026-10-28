// Discover "오늘의 케이팝 소식(Today's K-pop)" 선반 회귀 하네스 (2026-09-23 신설)
//
// 앨범 발매·음방 1위·조회수 마일스톤 세 소스를 "오늘" 날짜로만 좁혀 합친 선반. Date.now가 매번
// 달라 정확한 결과는 런타임 단언이 어려우므로, 구조 불변식을 문자열로 동결한다(누가 오늘-필터를
// 빼거나, seeded 제외를 지우거나, 배선을 끊으면 배포 전에 실패).
//
// 실행: node tests/feed-dailynews.test.js

const fs = require('fs');
const path = require('path');
const html = require('../tools/index_source.cjs').readIndexSource();
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
// 2026-10-16: 조회(_collectWeekNews — For You '내 최애 소식'과 공유)·빌더·렌더(_renderNewsList)로 나뉘었다 — 세 덩어리를 합쳐 검사
const fn = extractBraces(html, /^function _collectWeekNews\(/m, '_collectWeekNews')
  + extractBraces(html, /^async function _buildFeedDailyNews\(/m, '_buildFeedDailyNews')
  + extractBraces(html, /^function _renderNewsList\(/m, '_renderNewsList');
ck(/const today=new Date\(\)\.toISOString\(\)\.slice\(0,10\)/.test(fn), '오늘 날짜를 계산함(하드코딩 아님)');
// 음방 1위는 "이번 주"(최근 7일) — 2026-10-15 오늘→7일로 확대(오늘만이면 대부분의 날 비었다)
ck(/\.gte\('win_date',sevenDaysAgo\)\.lte\('win_date',today\)/.test(fn), '음방 1위를 최근 7일로 필터');
ck(/\.eq\('crossed_at',today\)/.test(fn), '조회수 마일스톤을 오늘 날짜로만 필터');
ck(/\.eq\('seeded',false\)/.test(fn),
  '최초 시딩분(seeded=true)을 제외함 — 안 걸리면 기존 데이터 전부가 "오늘 크로싱"으로 오인됨');
// 트로피(카드 배지)와 달리 여기선 티어 하한을 걸지 않는다 — 설계 의도(수집은 넓게, 이 선반도 넓게)
ck(!/yt_view_milestones[\s\S]{0,300}gte\('tier'/.test(fn),
  '조회수 마일스톤에 티어 하한을 걸지 않음(작은 그룹의 10만·100만도 소식으로 보여야 함 — 트로피 배지 기준(1000만)과는 다른 축)');
// 2026-10-12 합침: 앨범은 소식 줄이 아니라 같은 섹션 안 발매 앨범 블록(#feed-newalbum)이 맡는다
ck(!/_ensureRecentAlbums|type:'album'/.test(fn), '소식 목록에 앨범 줄을 다시 넣지 않음(아래 발매 앨범 블록과 같은 앨범이 두 번 나옴)');
const secM = /id="feed-dailynews-section"[\s\S]*?id="feed-anniv-section"/.exec(html);
ck(!!secM && /id="feed-newalbum-section"/.test(secM[0]) && /id="feed-newalbum"/.test(secM[0]),
  "발매 앨범 블록이 This Week's K-pop 섹션 안에 있음");
const albFn = extractBraces(html, /^async function _buildFeedNewAlbums\(/m, '_buildFeedNewAlbums');
ck(/finally\{_syncDailyNewsSection\(\);\}/.test(fn) && /finally\{_syncDailyNewsSection\(\);\}/.test(albFn),
  '두 빌더 모두 끝날 때 섹션 표시를 동기화(한쪽만 있어도 섹션이 뜸)');
// 조회수 돌파 쇼츠: is_short를 받아와 세로 2열 카드로(2026-10-12 — 16:9 전폭+흐린 패딩으로 보이던 버그)
ck(/yt_channel_videos!inner\([^)]*is_short/.test(fn), '조회수 마일스톤 조회에 is_short 포함');
// 전폭 헤드라인은 2026-10-28에 뺐다(사용자 "1열 너무 크다") — 가로 소식은 2열, 쇼츠는 그 칸에 안 섞음
ck(!fn.includes('_appendNewsHero') && fn.includes('_compactMv=!r.isShort&&'), '가로 소식(MV·티저·조회수)은 2열, 쇼츠는 그 칸에 안 섞음');
ck(/_appendNewsItems\(list,/.test(fn) && !/_appendNewsRow\(list,r\)/.test(fn), '소식 렌더가 쇼츠 2열 경로(_appendNewsItems)를 탐');
ck(/if\(!items\.length\)return;/.test(fn), '세 소스 다 비면 섹션을 그대로 숨김(억지로 안 채움)');

// 앨범 커버 클릭 = 아티스트 카드 + 그 앨범 상세(2026-10-12). 그룹·멤버 두 경로 다.
const navFn = extractBraces(html, /^function _albumCardNav\(/m, '_albumCardNav');
ck((navFn.match(/_openAlbumDetailWhenReady\(a,'(gc|tt)'/g) || []).length === 2, '앨범 클릭이 그룹·멤버 두 경로 모두 앨범 상세까지 연다');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${fail} 실패`);
process.exit(fail ? 1 : 0);
