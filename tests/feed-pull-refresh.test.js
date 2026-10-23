// Node runtime regression: refresh threshold, cancellation, and one-time tab restoration.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('function _reloadFeedFromPull(');
const end = html.indexOf('function _wireFeedTabSwipe(', start);
assert(start >= 0 && end > start);

function setup({mobile = true, top = 0, tab = 'rec'} = {}) {
  const listeners = new Map(), hints = [], storage = new Map(), calls = [];
  const pane = {
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
    document: {createElement: () => ({style: {}, setAttribute() {}})},
    sessionStorage: {setItem: (k, v) => storage.set(k, v), getItem: k => storage.get(k), removeItem: k => storage.delete(k)},
    location: {reload: () => calls.push('reload')},
    setTimeout: fn => fn(),
    _openFeedOverlay: () => calls.push('open'),
    _feedSwitchTab: t => calls.push(t),
    _obEngaged: () => calls.push('engaged')
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
  return {ctx, pane, calls, storage, send};
}

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
    assert.equal(h.calls.includes('reload'), refresh, `${tab}: ${name}`);
    if (refresh) {
      const click = h.send('click', 100, 340);
      assert(click.prevented && click.stopped, 'pull must not click a video');
      h.ctx._restoreFeedAfterPull();
      assert.deepEqual(h.calls, ['reload', 'open', tab, 'engaged']);
      h.ctx._restoreFeedAfterPull();
      assert.equal(h.calls.length, 4, 'restore only once');
    }
  }
}
for (const value of ['broken json', JSON.stringify({tab: 'other', at: Date.now()}), JSON.stringify({tab: 'disc', at: Date.now() - 120000})]) {
  const h = setup();
  h.storage.set('kpu_feed_pull_resume', value);
  h.ctx._restoreFeedAfterPull();
  assert.equal(h.calls.length, 0, 'ignore invalid or expired resume');
}
console.log('PASS mobile feed pull refresh: gestures, click suppression, and tab restoration');
