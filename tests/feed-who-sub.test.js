// 피드 캡션 "누구" 자리 — 개인 채널 영상은 멤버 먼저, 그룹은 작게 (2026-09-28)
//
// 왜: 오리지널 콘텐츠(아이돌 개인 채널) 선반이 슬기 개인 채널 영상 밑에 "레드벨벳"만 띄워 그룹 채널처럼
// 읽혔다(사용자 지적). 같은 캡션 조립이 Trend·For You에도 복붙돼 있어서 한 곳만 고치면 선반마다 어긋난다 —
// 공용 헬퍼(_feedWhoSub)를 실제로 실행해 보고, 세 선반이 전부 그걸 쓰는지 확인한다.
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };

const start = html.indexOf('function _feedWhoSub(song){');
const end = html.indexOf('\n}\n', start);
need(start > 0 && end > start, '_feedWhoSub 헬퍼가 있음');
const ARTISTS = [
  { name: { ko: '슬기', en: 'SEULGI' }, group: { ko: '레드벨벳' } },
  { name: { ko: '다영', en: 'DAYOUNG' }, group: { ko: '우주소녀' } },
];
const fn = new Function('ARTISTS', '_gLabelKo', '_artistGroups', '_dispName',
  html.slice(start, end + 2) + '; return _feedWhoSub;')(
  ARTISTS, ko => ko || '', a => a.groups || [a.group], a => a.name.ko);

need(fn({ groupKo: '레드벨벳', memberKos: ['슬기'], ownerCh: true }) === '슬기 <span class="feed-sub-grp">레드벨벳</span>',
  '개인 채널: 멤버 먼저 + 그룹은 작게');
need(fn({ groupKo: '레드벨벳', memberKos: ['슬기'], ownerCh: false }) === '레드벨벳', '그룹 채널 영상은 예전처럼 그룹만');
need(fn({ groupKo: '우주소녀', memberKos: [], ownerCh: true }) === '우주소녀', '멤버 태그 없는 개인 채널(팬 tier 등)은 그룹만');
need(fn({ groupKo: '우주소녀', memberKos: ['다영', '슬기'], ownerCh: true }).startsWith('다영, 슬기 '), '공동운영 채널은 주인 전부');

const uses = (html.match(/const sub=\[_feedWhoSub\(song\),/g) || []).length;
need(uses >= 3, `오리지널 콘텐츠·Trend·For You 세 선반이 같은 헬퍼를 씀(${uses}곳)`);
need(!/const sub=\[_gLabelKo\(song\.groupKo\),song\.paFull/.test(html), '그룹만 적는 옛 캡션 조립이 남아 있지 않음');
need(/source_tier/.test((/const _FEED_COLS=\(\)=>'([^']*)'/.exec(html) || [])[1] || ''), '피드 조회가 source_tier를 가져옴(개인 채널 판정 근거)');

console.log(pass ? '\n✅ 피드 캡션 테스트 통과' : '\n💥 피드 캡션 테스트 실패');
process.exit(pass ? 0 : 1);
