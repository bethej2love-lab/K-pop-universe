// 공유 썸네일(og:image) 커버리지 (2026-10-19)
// 사이트맵에 오른 그룹·멤버·솔로·곡 페이지가 기본 이미지(og-image.png)로 공유되면 안 된다 — 새로 등록한 A2O LITE·SOUL이
// 공유 링크에 썸네일 없이 뜨던 사용자 제보. 대체 순서: 대표 영상 → 등록 프로필 사진 → (멤버) 소속·이력 그룹 썸네일.
// 빨간불이면: 그 그룹·멤버 영상이 아직 없고 프로필 사진도 없는 것 → 영상 동기화를 기다리거나 사진 등록 후
//   node tools/build_og_thumbs.mjs --keep-existing && node build_group_pages.js
// 실행: node tests/og-coverage.test.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://kpop-universe.kr';
const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const target = locs.filter(u => /\/(en\/)?(g\/[^/]+\/([^/]+\/)?|member\/[^/]+\/)$/.test(u.replace(SITE, '')) && !/\/(en\/)?g\/$/.test(u));
const bad = [];
let checked = 0;
for (const u of target) {
  const rel = decodeURIComponent(u.replace(SITE + '/', ''));
  const f = path.join(ROOT, rel, 'index.html');
  if (!fs.existsSync(f)) continue;
  checked++;
  const img = (fs.readFileSync(f, 'utf8').match(/og:image" content="([^"]*)/) || [])[1] || '';
  if (!img || /\/og-image\.png$/.test(img)) bad.push(rel);
}
if (bad.length) {
  console.log(`❌ 공유 썸네일이 기본 이미지인 페이지 ${bad.length}/${checked}:\n  ` + bad.slice(0, 40).join('\n  '));
  console.log('   → 영상·프로필 사진이 생기면: node tools/build_og_thumbs.mjs --keep-existing && node build_group_pages.js');
  process.exit(1);
}
console.log(`✅ 공유 썸네일 커버리지 — 그룹·멤버·솔로 페이지 ${checked}개 모두 대표 이미지 있음`);
