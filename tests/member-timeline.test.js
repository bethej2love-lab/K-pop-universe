// 한 사람의 시간축(킬러 6.3 v1) 회귀 하네스 (2026-09-05 신설)
//
// 멤버 카드에 데뷔→(첫1위)→탈퇴→솔로를 시간순으로. DOM·DB가 필요한 부분은 브라우저 검수라, 여기선
// 날짜 헬퍼(_tlKey/_tlDate)의 실제 동작과 배선 불변식을 고정한다.
//
// 실행: node tests/member-timeline.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let fail = 0;
const ck = (c, m) => { console.log((c ? '✓ ' : '✗ 실패: ') + m); if (!c) fail++; };
function extractBraces(src, re, label) {
  const m = re.exec(src); if (!m) throw new Error('못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}

console.log('\n── 시간축 날짜 헬퍼(런타임) ──');
const api = new Function(
  extractBraces(html, /^function _tlKey\(/m, '_tlKey') + '\n' +
  extractBraces(html, /^function _tlDate\(/m, '_tlDate') + '\nreturn {k:_tlKey, d:_tlDate};')();
ck(api.d('2020.11.17') === '2020.11', '"2020.11.17" → "2020.11"');
ck(api.d('2021-01-17') === '2021.01', '"2021-01-17"(win_date) → "2021.01"');
ck(api.d('2018') === '2018', '연도만 → 그대로');
ck(api.k('2018.10.29') < api.k('2021.04.29'), '키 정렬: 2018 < 2021');
ck(api.k('2020.11.17') < api.k('2020.11.18'), '키 정렬: 일 단위까지');
ck(api.k('') === 0, '빈 값 → 0');

console.log('\n── 배선 불변식 ──');
ck(/id="tt-timeline-section"/.test(html) && /id="tt-timeline"/.test(html), '멤버 카드에 시간축 섹션 DOM');
ck(/_buildMemberTimeline\(a\)/.test(html), 'showT에서 _buildMemberTimeline 호출');
const fn = extractBraces(html, /^function _buildMemberTimeline\(/m, '_buildMemberTimeline');
ck(/from\('music_show_wins'\)/.test(fn) && /win_date/.test(fn), "첫 1위: music_show_wins.win_date 조회");
ck(/from\('kpop_events'\)/.test(fn) && /date_start/.test(fn), "첫 콘서트/투어: kpop_events.date_start 조회");
ck(/_ensureGroupDisco\(/.test(fn) && /\/\^정규\//.test(fn), "정규 1집: 그룹 디스코 로드 후 type '정규…' 최소날짜");
ck(/hd\.textContent='History'/.test(fn) && !/'이력'/.test(fn), "헤더는 'History'(‘이력’ 아님)");
ck(/ev\.length>=2/.test(fn), '1개(데뷔만)면 숨김 — 2개 이상일 때만 노출');
ck(/_openTArtist!==a/.test(fn), '비동기 결과는 현재 카드일 때만 반영(스테일 가드)');
ck(/a\.group\.ko!=='솔로'/.test(fn) && /a\.groups\|\|\[\]/.test(fn), '실존 그룹 수집: 현소속+groups[] 이력');
ck(/soloDiscography/.test(fn), '솔로 데뷔 마일스톤(soloDiscography)');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 시간축 하네스 통과');
process.exit(fail ? 1 : 0);
