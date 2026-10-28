// 카드 영상 "추천순" 점수(_recOrder, 2026-10-28) 불변식 — 무작위 항을 0으로 고정하고 기준별 우선순위를 확인한다.
// 실행: node tests/rec-order.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const pick = re => { const m = src.match(re); if (!m) throw new Error('못 찾음: ' + re); return m[0]; };
const code = [
  pick(/const _VID_CAT_WEIGHT=[^\n]*\n/),
  pick(/function _vidCatWeight\(cat\)\{[^\n]*\n/),
  pick(/const _REC_W=[^\n]*\n/),
  pick(/function _recOrder\(vids,memberKo\)\{[\s\S]*?\n\}\n/),
].join('');
const ctx = { Math: Object.create(Math), Date, isNaN, Set, Map, _scrapCounts: new Map(), favMembers: new Set(), myProfile: null, _isShortV: v => !!v.is_short };
ctx.Math.random = () => 0;
vm.createContext(ctx); vm.runInContext(code + '\nthis.R=_recOrder;', ctx);
let pass = 0, fail = 0;
const need = (c, m) => { if (c) pass++; else { fail++; console.error('❌ ' + m); } };
const day = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const ids = arr => ctx.R(arr, null).map(v => v.id);
// 최신 vs 오래된(조회수 같음)
need(ids([{ id: 'old', published_at: day(400), view_count: 1e5, category: 'live' }, { id: 'new', published_at: day(2), view_count: 1e5, category: 'live' }])[0] === 'new', '조회수가 같으면 최신이 위');
// 상승 신호
need(ids([{ id: 'a', published_at: day(60), view_count: 1e5, category: 'live' }, { id: 'up', published_at: day(60), view_count: 1e5, category: 'live', _rise: true }])[0] === 'up', '같은 조건이면 상승(_rise)이 위');
// 조회수
need(ids([{ id: 'low', published_at: day(30), view_count: 100, category: 'live' }, { id: 'hi', published_at: day(30), view_count: 5e7, category: 'live' }])[0] === 'hi', '같은 날이면 조회수 많은 쪽이 위');
// 즐겨찾기(그룹 카드에서만)
ctx.favMembers.add('코르티스:성현');
const fv = [{ id: 'x', group_ko: '코르티스', members: ['건호'], published_at: day(30), view_count: 1e5, category: 'live' }, { id: 'fav', group_ko: '코르티스', members: ['성현'], published_at: day(30), view_count: 1e5, category: 'live' }];
need(ctx.R(fv, null)[0].id === 'fav', '그룹 카드에선 내 즐겨찾기 멤버 영상이 위');
need(ctx.R(fv, '건호')[0].id === 'x', '멤버 카드에선 즐겨찾기 가산 없음(원래 순서 유지)');
// 하트
ctx._scrapCounts.set('https://www.youtube.com/watch?v=h', 7);
need(ids([{ id: 'n', published_at: day(30), view_count: 1e5, category: 'live' }, { id: 'h', published_at: day(30), view_count: 1e5, category: 'live' }])[0] === 'h', '하트 많은 영상이 위');
// 예능은 직캠보다 뒤(분류 가중치)
need(ids([{ id: 'etc', published_at: day(30), view_count: 1e5, category: 'other' }, { id: 'cam', published_at: day(30), view_count: 1e5, category: 'live' }])[0] === 'cam', '같은 조건이면 예능보다 직캠');
// 조회수 모름(null)도 안 죽음
need(ids([{ id: 'u', published_at: '', view_count: null, category: 'live' }]).length === 1, '날짜·조회수 없는 행도 처리');
console.log(fail ? `💥 추천순 테스트 실패 ${fail}건 (통과 ${pass})` : `✅ 추천순 테스트 통과 ${pass}건`);
process.exit(fail ? 1 : 0);
