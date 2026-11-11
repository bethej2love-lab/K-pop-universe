// Evaluate the emitted scripts, including template-literal escaping, without sending analytics.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const builder = fs.readFileSync(path.join(root, 'build_group_pages.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tagSource = builder.match(/^const SEO_GA_TAG = [\s\S]*?^<script async[^\n]+\x60;/m)[0];
const tag = vm.runInNewContext(tagSource + '\nSEO_GA_TAG');
const seoGuard = tag.match(/<script>([\s\S]+?)<\/script>/)[1];
const appGuard = app.match(/try\{window\._kpuAutomated=[^\n]+\n\s*if\(window\._kpuAutomated\)[^\n]+/)[0];
const flag = 'ga-disable-G-Z5NTV6X3YF';
assert(tag.indexOf(flag) < tag.indexOf('googletagmanager'));
const templates = [...builder.matchAll(/\$\{SEO_GA_TAG\}\r?\n<script>([^\n]+)<\/script>/g)];
assert.equal(templates.length, 10); // 2026-11-11 멤버 직캠 전체 페이지(fancamPageHtml) 추가로 9→10
const cases = [
  ['Mozilla/5.0 Chrome/130.0', false, false],
  ['Mozilla/5.0 iPhone Safari', false, false],
  ['Chrome', true, true],
  ...['HeadlessChrome', 'Googlebot', 'Crawler', 'Spider', 'Lighthouse', 'Playwright', 'Puppeteer']
    .map(ua => [ua, false, true]),
];

for (const [, body] of templates) {
  const tick = String.fromCharCode(96);
  const emitted = new Function('ms', 'gko', 'h1', 'kind', 'return ' + tick + body + tick)(
    false, null, 'Demo', 'debut'
  );
  for (const [userAgent, webdriver, excluded] of cases) {
    const navigator = { userAgent, webdriver };
    const appWindow = {};
    vm.runInNewContext(appGuard, { window: appWindow, navigator });
    assert.equal(!!appWindow[flag], excluded);

    const queued = [];
    const callbacks = [];
    const context = {
      navigator,
      location: { pathname: '/en/g/demo/s/test/' },
      document: {
        querySelector: selector => selector === 'h1' ? { textContent: 'Demo' } : null,
        addEventListener: (event, callback) => callbacks.push(callback),
      },
      dataLayer: queued,
    };
    context.window = context;
    vm.runInNewContext(seoGuard, context);
    assert.equal(!!context[flag], excluded);
    vm.runInNewContext(emitted, context);
    callbacks.forEach(callback => callback());
    assert(queued.some(args => args[0] === 'config'));
    assert(queued.some(args => args[1] === 'seo_land'));
  }
}
console.log(`PASS ${templates.length * cases.length} automation and visitor cases across ${templates.length} static templates`);
