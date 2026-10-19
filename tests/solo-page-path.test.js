// 솔로 정적 페이지 주소가 겹치지 않는다 (2026-10-19)
// 동명이인 솔로(프리스틴·공원소녀 레나 등)가 member/<이름>/ 하나를 나눠 써서 나중 것이 덮어쓰던 문제.
// 규칙은 shared.js _soloPageSuffix 하나 — 빌더(memberPagePath)와 앱 공유 링크(_seoUrlForMember)가 같이 쓴다.
// 실행: node tests/solo-page-path.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + '\nthis.f=_soloPageSuffix;', ctx);
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const slug = (en, ko) => (String(en || ko || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || 'group';
let fail = 0;
const seen = { ko: new Map(), en: new Map() };
for (const a of A) {
  if (!a || !a.name || !a.group || G[a.group.ko]) continue;
  const s = ctx.f(a, A, G);
  const ko = `member/${String(a.name.ko).replace(/[.\s]+$/, '')}${s.ko}/`, en = `en/member/${slug(a.name.en || a.name.ko, a.name.ko)}${s.en}/`;
  for (const [l, p] of [['ko', ko], ['en', en]]) {
    if (seen[l].has(p)) { fail++; console.log(`❌ 주소 겹침 ${p} — ${seen[l].get(p)} / ${a.name.ko}(${a.id})`); }
    else seen[l].set(p, `${a.name.ko}(${a.id})`);
  }
}
// 앱 쪽이 같은 함수를 부르는지(따로 계산하면 공유 링크가 페이지와 갈린다)
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'latin1');
if (!/_soloPageSuffix\(a,ARTISTS,GROUPS\)/.test(html)) { fail++; console.log('❌ index.html _seoUrlForMember가 _soloPageSuffix를 안 쓴다'); }
const builder = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'latin1');
if (!/soloSuffix\(a\)\.ko/.test(builder) || !/soloSuffix\(a\)\.en/.test(builder)) { fail++; console.log('❌ build_group_pages.js memberPagePath가 soloSuffix를 안 쓴다'); }
console.log(fail ? `💥 솔로 페이지 주소 테스트 실패 ${fail}건` : `✅ 솔로 페이지 주소 ${seen.ko.size}개(ko)·${seen.en.size}개(en) 모두 겹치지 않음`);
process.exit(fail ? 1 : 0);
