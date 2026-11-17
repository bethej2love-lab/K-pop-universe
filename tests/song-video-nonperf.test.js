// 곡 페이지에서 비공연 영상 거르기(2026-11-17, Codex 팬 관점 검수) — 스트레이키즈 This & That 실제 제목으로.
// 앨범과 같은 이름의 곡은 앨범 홍보 영상 제목에 곡명이 그대로 들어 있어 트레일러·메이킹·다른 수록곡 UNVEIL이 곡 영상으로 잡혔다.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
const SEO = require('../tools/seo_extra.js');
let total = 0, failed = 0; const check = (n, f) => { total++; try { f(); } catch (e) { failed++; console.error('FAIL ' + n + ': ' + e.message); } };
const V = (id, title, category, content_formats, view_count = 1000) => ({ id, title, category, content_formats: content_formats || [], view_count, members: [], published_at: '2026-08-01' });
const KEEP = [
  V('mv1', 'Stray Kids "This & That" M/V', 'mv'),
  V('dp1', 'Stray Kids "This & That" Dance Practice Video', 'live', ['안무영상']),
  V('mc1', 'Stray Kids (스트레이 키즈) - This & That | Show! MusicCore | MBC260808방송', 'live'),
  V('mb1', 'This & That - Stray Kids (스트레이 키즈) [뮤직뱅크/Music Bank] | KBS 260807 방송', 'live'),
  V('sbs1', 'This & That - Stray Kids | SBS 260816 방송', 'other'), // 실제 무대인데 other로 분류된 것 — 남겨야 한다
  V('gayo1', 'Stray Kids(스트레이 키즈) - CEREMONY + This & That + MIROH @SBS GayoDaejeon Summer', 'other', ['EV:sbs-gayo', 'EV:sbs-gayo:2025-Summer']),
];
const DROP = [
  V('tr1', 'Stray Kids "THIS & THAT" Trailer', 'other'),
  V('un1', 'Stray Kids "THIS & THAT" UNVEIL : TRACK "After You"', 'other'),
  V('un2', 'Stray Kids "THIS & THAT" UNVEIL : TRACK "FARMING"', 'other'),
  V('re1', 'Stray Kids "This & That" M/V Reaction', 'other'),
  V('ma1', 'Stray Kids ＜THIS & THAT＞ Mashup Video', 'other'),
  V('gu1', 'Stray Kids "This & That" (Feat. STAY) Guide Video', 'other'),
  V('ly1', 'Stray Kids "This & That (That Version)" Lyric Visualizer', 'other'),
  V('mk1', 'Stray Kids "This & That" M/V MAKING FILM', 'other', ['비하인드']),
  V('mk2', 'Stray Kids "THIS & THAT" Jacket MAKING FILM', 'other', ['비하인드']),
  V('in1', 'Stray Kids [INTRO "THIS & THAT"]', 'other'),
  V('va1', '[SUB] This & That… What CAN’T Stray Kids Do? | YouTube K-bongbakdu EP.3', 'other', ['variety']),
];
check('판정: 공연은 두고 비공연만 뺀다', () => {
  KEEP.forEach(v => assert.equal(SEO.isNonPerformance(v), false, '남겨야 함: ' + v.title));
  DROP.forEach(v => assert.equal(SEO.isNonPerformance(v), true, '빼야 함: ' + v.title));
});
check('live·mv는 제목에 어떤 말이 있어도 항상 둔다(분류를 믿는다)', () => {
  assert.equal(SEO.isNonPerformance(V('x', 'Teaser Reaction Mashup Trailer', 'live')), false);
  assert.equal(SEO.isNonPerformance(V('y', 'M/V Teaser', 'mv')), false);
});
check('buildSongs: This & That 곡 영상에서 트레일러류가 빠지고 무대는 남는다 + 페이지 생성 기준은 거르기 전 개수', () => {
  const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')), artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
  const rows = [...KEEP, ...DROP];
  const out = SEO.buildSongs({ ROOT, groups, artists, EX: { wins: {}, top: {} }, vids: { 스트레이키즈: rows }, minVids: 4 });
  const s = (out['스트레이키즈'] || []).find(x => /this ?& ?that/i.test(x.title));
  assert(s, 'This & That 곡이 만들어져야 한다');
  const ids = new Set(s.vids.map(v => v.id));
  KEEP.forEach(v => assert(ids.has(v.id), '남아야 함: ' + v.id));
  DROP.forEach(v => assert(!ids.has(v.id), '빠져야 함: ' + v.id));
  assert(s.vidsAll >= KEEP.length + DROP.length - 2, '거르기 전 개수가 기록돼야 한다 ' + s.vidsAll);
});
check('거른 뒤 하나도 안 남으면 원래 목록을 쓴다(빈 곡 페이지 방지)', () => {
  const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')), artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
  const only = ['a', 'b', 'c', 'd'].map((x, i) => V('t' + i, 'Stray Kids "This & That" Trailer ' + i, 'other'));
  const out = SEO.buildSongs({ ROOT, groups, artists, EX: { wins: {}, top: {} }, vids: { 스트레이키즈: only }, minVids: 4 });
  const s = (out['스트레이키즈'] || []).find(x => /this ?& ?that/i.test(x.title));
  assert(s && s.vids.length === 4, '전부 비공연이어도 페이지는 유지: ' + (s && s.vids.length));
});
console.log(total + ' checks / ' + failed + ' failed'); if (failed) process.exitCode = 1;
