// Node runtime regression: gesture guards and in-place refresh without page navigation.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = require('../tools/index_source.cjs').readIndexSource();
const start = html.indexOf('function _refreshFeedFromPull(');
const end = html.indexOf('function _wireFeedTabSwipe(', start);
assert(start >= 0 && end > start);

function setup({mobile = true, top = 0, tab = 'rec'} = {}) {
  const listeners = new Map(), hints = [], calls = [], timers = new Map(), notices = [];
  let timerId = 0;
  let finish;
  const node = () => {
    const classes = new Set(), attrs = new Map();
    return {style: {}, children: [], classList: {add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x)},
      appendChild(x) { this.children.push(x); }, setAttribute: (k,v) => attrs.set(k,v), removeAttribute: k => attrs.delete(k)};
  };
  const pane = {
    ...node(),
    id: 'feed-pane-' + tab, scrollTop: top,
    classList: {add() {}, remove() {}},
    prepend(hint) { hints.push(hint); },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    }
  };
  const ctx = {
    isMob: () => mobile, currentLang: 'en', Date, JSON,
    document: {createElement: node},
    location: {reload: () => { throw new Error('must not reload the page'); }},
    setTimeout: (fn, ms) => { if(ms === 500) { fn(); return 0; } const id=++timerId; timers.set(id,fn); return id; },
    clearTimeout: id => timers.delete(id),
    _showShareToast: msg => notices.push(msg),
    _feedRecPending: null, _feedDiscPending: null, _feedPullRefreshP: null,
    _weekNewsAt: 123, _recentAlbumsP: {}, _upConcertsAt: 123, _feedTrendAt: 123,
    _buildFeedRec: () => { calls.push('rec'); return new Promise(resolve => { finish = resolve; }); },
    _buildFeedDisc: () => { calls.push('disc'); return new Promise(resolve => { finish = resolve; }); }
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(start, end), ctx);
  ctx._wireFeedPullRefresh(pane);
  ctx._wireFeedPullRefresh(pane);
  assert.equal(hints.length, 1, 'binding is idempotent');
  function send(type, x, y, options = {}) {
    const touch = {clientX: x, clientY: y};
    const e = {touches: [touch], cancelable: true, target: {closest: () => false},
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options};
    for (const fn of listeners.get(type) || []) fn(e);
    return e;
  }
  return {ctx, pane, calls, hints, send, timers, notices, expire: () => {const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());}, complete: () => finish()};
}

async function main() {
for (const tab of ['rec', 'disc']) {
  for (const [name, dx, dy, options, refresh] of [
    ['large pull', 0, 240, {}, true],
    ['short pull', 0, 150, {}, false],
    ['horizontal', 250, 20, {}, false],
    ['upward', 0, -240, {}, false],
    ['scrolled', 0, 240, {top: 100}, false],
    ['desktop', 0, 240, {mobile: false}, false],
    ['cancelled', 0, 240, {cancel: true}, false],
    ['reversed', 0, 240, {reverse: true}, false],
    ['multitouch', 0, 240, {multi: true}, false]
  ]) {
    const h = setup({...options, tab});
    h.send('touchstart', 100, 100);
    h.send('touchmove', 100 + dx, 100 + dy, options.multi ? {touches: [{clientX: 100, clientY: 340}, {}]} : {});
    if (options.reverse) h.send('touchmove', 100, 130);
    h.send(options.cancel ? 'touchcancel' : 'touchend', 100 + dx, 100 + dy);
    await new Promise(setImmediate);
    assert.equal(h.calls.length, refresh ? 1 : 0, `${tab}: ${name}`);
    if (refresh) {
      const click = h.send('click', 100, 340);
      assert(click.prevented && click.stopped, 'pull must not click a video');
      assert.deepEqual(h.calls, [tab], 'rebuild only the current tab');
      assert(h.hints[0].classList.contains('is-refreshing'));
      assert.equal(h.hints[0].textContent, undefined, 'no visible text instruction');
      h.send('touchstart', 100, 100); h.send('touchend', 100, 100);
      assert.equal(h.hints[0].style.height, '64px', 'keep spinner visible while loading');
      assert.equal(h.ctx._weekNewsAt, 0); assert.equal(h.ctx._recentAlbumsP, null);
      h.complete(); await new Promise(setImmediate);
      assert.equal(h.hints[0].style.height, '0px', 'collapse after completion');
      assert.equal(h.timers.size, 0, 'clear deadline timer after completion');
      assert.equal(h.notices.length, 0, 'no slow-loading notice on completion');
    }
  }
}
const waiting = setup();
let releaseInitial;
waiting.ctx._feedRecPending = new Promise(resolve => { releaseInitial = resolve; });
const first = waiting.ctx._refreshFeedFromPull('rec');
assert.equal(waiting.ctx._refreshFeedFromPull('rec'), first, 'coalesce overlapping refreshes');
await new Promise(setImmediate);
assert.equal(waiting.calls.length, 0, 'reuse the existing build');
releaseInitial(); await new Promise(setImmediate);
assert.deepEqual(waiting.calls, [], 'do not repeat the entire build after initial loading');
await first;
assert.equal(waiting.ctx._feedPullRefreshP, null);
for(const tab of ['rec','disc']) {
  const slow=setup({tab});
  const pull=()=>{slow.send('touchstart',100,100);slow.send('touchmove',100,340);slow.send('touchend',100,340);};
  pull();await new Promise(setImmediate);
  assert(slow.hints[0].classList.contains('is-refreshing'));
  slow.expire();await new Promise(setImmediate);
  assert.equal(slow.hints[0].style.height,'0px','stop spinner even when a request never settles');
  assert.equal(slow.notices.length,1,'explain that background loading continues');
  assert(slow.ctx._feedPullRefreshP,'keep actual build locked after UI deadline');
  pull();await new Promise(setImmediate);
  assert.deepEqual(slow.calls,[tab],'repeated pull must not duplicate slow requests');
  slow.complete();await new Promise(setImmediate);
  assert.equal(slow.ctx._feedPullRefreshP,null,'release lock when actual work finishes');
  assert.equal(slow.hints[0].style.height,'0px');
  assert.equal(slow.timers.size,0);
}
console.log('PASS mobile feed pull refresh: gestures, spinner lifecycle, current-tab rebuild without navigation');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
