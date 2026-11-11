// 공유 미리보기 이미지(og:image) 안전망 — 2026-11-02 사용자 "블로그에 공유하려니 이미지가 안 뜨는 링크가 많다(새로 만든 페이지들)".
// 실측: 정적 페이지 422개에 og:image가 아예 없었다 — 커버 모음 215·아이돌 생년 108·소속사 52·연도별 1위 38 등. 페이지 종류마다
// 빌더 함수가 따로라(simplePageHtml·buildYearPages·관계 페이지…) 새 종류를 만들 때마다 같은 구멍이 다시 생겼다.
// 그래서 빌드 **끝에** 한 번 훑어, og:image가 없는 페이지에만 넣는다(이미 있는 페이지는 손대지 않음):
//   ① 그 페이지 안 첫 유튜브 썸네일(mqdefault — 모든 영상에 있고 16:9, 2026-11-11 hqdefault 4:3 검은 띠 제거) → ② 커버·콜라보 페이지면 그 그룹 대표 썸네일(og_thumbs.json)
//   → ③ 등록 프로필 사진(supabase) → ④ 사이트 기본 이미지(og-image.png 1200×630)
// build_group_pages.js가 마지막에 부르고, 단독 실행도 된다: node tools/ensure_og_images.cjs  (고친 파일 수를 찍는다)
// tests/og-image.test.js가 og:image 없는 정적 페이지를 잡는다.
const fs = require('fs');
const path = require('path');

const SITE = 'https://kpop-universe.kr';
const DEFAULT = { url: `${SITE}/og-image.png`, w: 1200, h: 630 };
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.audit-worktrees', 'tests', 'docs', 'tools', 'sql', 'sitemaps', 'icons', 'disco', 'album_videos', 'events_sql']);

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (e.name === 'index.html') out.push(path.join(dir, e.name));
  }
  return out;
}

function pickImage(html, rel, ogThumbs) {
  const yt = html.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([A-Za-z0-9_-]{6,})\//);
  if (yt) return { url: `https://i.ytimg.com/vi/${yt[1]}/mqdefault.jpg`, w: 320, h: 180 };
  const m = rel.match(/^(?:en\/)?(?:cover|collab)\/([^/]+)\//);
  if (m && ogThumbs && ogThumbs.groups) {
    let seg = m[1]; try { seg = decodeURIComponent(seg); } catch (e) {}
    const t = ogThumbs.groups[seg] || Object.entries(ogThumbs.groups).find(([k]) => k.toLowerCase() === seg.toLowerCase())?.[1];
    const id = t && (String(t).match(/\/vi\/([^/]+)\//) || [])[1];
    if (id) return { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, w: 320, h: 180 };
  }
  const sb = html.match(/<img[^>]+src="(https:\/\/[^"]+supabase\.co\/storage\/[^"]+)"/);
  if (sb) return { url: sb[1], w: 600, h: 600 };
  return DEFAULT;
}

function ensureOgImages(root) {
  let ogThumbs = null;
  try { ogThumbs = JSON.parse(fs.readFileSync(path.join(root, 'og_thumbs.json'), 'utf8')); } catch (e) {}
  const files = walk(root, []);
  let fixed = 0;
  for (const f of files) {
    const html = fs.readFileSync(f, 'utf8');
    if (html.includes('property="og:image"')) continue;
    const headEnd = html.indexOf('</head>');
    if (headEnd < 0) continue;
    if (/http-equiv="refresh"/i.test(html.slice(0, headEnd))) continue; // 옮겨 간 옛 주소(리다이렉트 전용)는 미리보기 대상이 아님
    const rel = path.relative(root, f).split(path.sep).join('/');
    const img = pickImage(html, rel, ogThumbs);
    const big = img.w >= 600;
    let head = html.slice(0, headEnd);
    // twitter:card — 큰 그림이면 큰 카드로(이미 summary로 적힌 페이지가 많다)
    if (/<meta name="twitter:card" content="summary">/.test(head)) { if (big) head = head.replace('<meta name="twitter:card" content="summary">', '<meta name="twitter:card" content="summary_large_image">'); }
    else if (!/name="twitter:card"/.test(head)) head += `<meta name="twitter:card" content="${big ? 'summary_large_image' : 'summary'}">\n`;
    head += `<meta property="og:image" content="${img.url}">\n<meta property="og:image:width" content="${img.w}">\n<meta property="og:image:height" content="${img.h}">\n<meta name="twitter:image" content="${img.url}">\n`;
    fs.writeFileSync(f, head + html.slice(headEnd));
    fixed++;
  }
  return { scanned: files.length, fixed };
}

module.exports = { ensureOgImages };
if (require.main === module) {
  const r = ensureOgImages(path.join(__dirname, '..'));
  console.log(`og:image 안전망: ${r.scanned}개 중 ${r.fixed}개에 넣음`);
}
