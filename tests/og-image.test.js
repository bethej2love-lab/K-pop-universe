// 정적 페이지 공유 미리보기(og:image) 회귀 테스트 (2026-11-02)
// 사용자 "블로그에 공유하려니 이미지가 안 뜬다 — 새로 만든 공유 페이지들" — 소속사·연도별 1위·아이돌 생년·커버 모음 등 422개 페이지에
// og:image가 아예 없었다(페이지 종류마다 빌더가 따로라 새 종류를 만들 때 빠뜨림). 빌드 끝 안전망(tools/ensure_og_images.cjs)이 채운다.
// 여기선 **모든** 정적 index.html에 og:image가 있는지(리다이렉트 전용 페이지 제외), 그리고 안전망이 빌더 끝에 연결돼 있는지 본다.
// 실행: node tests/og-image.test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = m => console.log('✅ ' + m), bad = m => { fail++; console.log('❌ ' + m); };

const build = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'utf8');
/require\('\.\/tools\/ensure_og_images\.cjs'\)\.ensureOgImages\(ROOT\)/.test(build)
  ? ok('빌더 끝에 og:image 안전망 연결') : bad('build_group_pages.js가 ensureOgImages를 부르지 않음 — 새 페이지 종류에서 미리보기 이미지가 다시 빠진다');

const SKIP = new Set(['node_modules', '.git', '.github', '.audit-worktrees', 'tests', 'docs', 'tools', 'sql', 'sitemaps', 'icons', 'disco', 'album_videos', 'events_sql']);
const missing = [];let n = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(dir, e.name)); continue; }
    if (e.name !== 'index.html' || dir === ROOT) continue; // 루트 index.html(앱)은 아래에서 따로
    const html = fs.readFileSync(path.join(dir, e.name), 'utf8');
    const head = html.slice(0, Math.max(0, html.indexOf('</head>')));
    if (/http-equiv="refresh"/i.test(head)) continue;
    n++;
    if (!head.includes('property="og:image"')) missing.push(path.relative(ROOT, path.join(dir, e.name)));
  }
})(ROOT);
missing.length ? bad(`og:image 없는 정적 페이지 ${missing.length}개 — 예: ${missing.slice(0, 5).join(', ')}`) : ok(`정적 페이지 ${n}개 모두 og:image 있음`);
/property="og:image" content="https:\/\/kpop-universe\.kr\/og-image\.png"/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))
  ? ok('앱(index.html) 기본 미리보기 이미지') : bad('index.html og:image 없음');
fs.existsSync(path.join(ROOT, 'og-image.png')) ? ok('og-image.png 있음') : bad('og-image.png 없음');
console.log(fail ? `\n❌ ${fail} 실패` : '\n✅ og:image 테스트 통과');
process.exit(fail ? 1 : 0);
