// Old official MVs imported from a new channel must survive the newest-50 title limit.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('async function _openSongVideos(');
const end = html.indexOf('// 형식 칩', start);
assert(start >= 0 && end > start, 'song-video function boundary');
const official = { id: 'official', title: 'IVE BANG BANG MV', category: 'mv', published_at: '2026-02-09', song_keys: null };
const recent = { id: 'recent', title: 'BANG BANG stage', published_at: '2026-10-05', song_keys: ['아이브:bangbang'] };
const other = { id: 'wrong-song', title: 'BANG BANG', song_keys: ['아이브:another'] };
const hidden = { ...official, id: 'hidden', content_flag: 'hidden' };
let mvFails = false;
const calls = [];
function query() {
  const q = { kind: 'title' };
  for (const name of ['select', 'or', 'ilike', 'order', 'limit', 'contains', 'eq']) {
    q[name] = (...args) => {
      calls.push([name, ...args]);
      if (name === 'contains') q.kind = 'key';
      if (name === 'eq' && args[0] === 'category') q.kind = 'mv';
      return q;
    };
  }
  q.then = (resolve, reject) => {
    if (q.kind === 'mv' && mvFails) return Promise.reject(new Error('network')).then(resolve, reject);
    const data = q.kind === 'mv' ? [official, other, hidden, recent] : [recent];
    return Promise.resolve({ data }).then(resolve, reject);
  };
  return q;
}
const el = () => ({ classList: { add() {}, contains: () => true }, hidden: false, innerHTML: '', textContent: '' });
const ctx = {
  sb: { from: query }, _YT_TABLE: 'yt_channel_videos', _songVidReq: 0, _songKeysCol: true,
  document: { getElementById: el }, currentLang: 'ko',
  _fillSongMeta() {}, _renderCreditsInto() {}, _bringToFront() {}, _renderSongVideoTabs() {},
  _titleNorm: s => s.toLowerCase(), _songBase: s => s.toLowerCase().replace(/ /g, ''), _pgFilterVal: s => s,
  _coverOfQueryKeys: () => ({ personKeys: [], groupKey: null }),
  _filterBannedVideos: rows => rows.filter(v => !v.content_flag),
};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end), ctx);
(async () => {
  await ctx._openSongVideos('BANG BANG', { gko: '아이브' });
  assert(ctx._songVid.orig.some(v => v.id === 'official'), 'old MV supplements key/title results');
  assert.equal(ctx._songVid.orig.filter(v => v.id === 'recent').length, 1, 'deduplicate all sources');
  assert(!ctx._songVid.orig.some(v => ['wrong-song', 'hidden'].includes(v.id)), 'keep song-key and visibility guards');
  assert(calls.some(c => c[0] === 'eq' && c[1] === 'category' && c[2] === 'mv'), 'query MV-specific pool');
  mvFails = true;
  await ctx._openSongVideos('BANG BANG', { gko: '아이브' });
  assert(ctx._songVid.orig.some(v => v.id === 'recent'), 'MV query failure preserves existing results');
  console.log('✅ song-video MV fallback: 5 checks passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
