const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const ROOT = path.join(__dirname, '..'), SITE = 'https://kpop-universe.kr';
const src = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'utf8');
function extract(name) {
  const from = src.indexOf(`function ${name}(`), end = src.indexOf('\n}\n', from);
  assert(from >= 0 && end > from, name);
  return src.slice(from, end + 2);
}
const ctx = vm.createContext({fs, path, ROOT, SITE, escHtml: s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')});
vm.runInContext(extract('existingRelPages') + '\n' + extract('relationHubSection'), ctx);
const saved = ctx.existingRelPages();
assert(saved.sitemap.length > 0, 'check real existing pages');
for (const lang of ['ko', 'en']) {
  const links = saved.hubLinks[lang], html = ctx.relationHubSection(lang, links);
  assert(links.length > 0);
  for (const link of links) {
    assert(saved.sitemap.some(p => p.loc === link.href), 'same URL as sitemap');
    assert(html.includes(`href="${link.href}"`), 'preserve every entry link');
    assert(fs.existsSync(path.join(ROOT, link.href.slice(SITE.length), 'index.html')));
  }
  assert(!html.includes('class="yr"'), 'do not invent counts after a failed query');
}
assert.equal(saved.sitemap.length, saved.hubLinks.ko.length + saved.hubLinks.en.length);
assert(ctx.relationHubSection('ko', [{href: SITE+'/cover/example/',label:'A & B <C>',n:null}]).includes('A &amp; B &lt;C&gt;'));
assert(ctx.relationHubSection('en', [{href: SITE+'/cover/example/',label:'A',n:3}]).includes('>3</span>'));
assert.match(src, /const existing = existingRelPages\(\);\s*relPages = existing\.sitemap; hubLinks = existing\.hubLinks;/, 'actual catch restores both');
console.log(`PASS SEO fallback: ${saved.sitemap.length} existing pages, both languages, hub links and safe labels`);
