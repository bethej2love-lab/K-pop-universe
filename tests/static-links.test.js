// 정적 페이지 내부 링크 검사 (2026-08-31 신설)
//
// 2026-08-31까지 정적 페이지 3,999개는 **서로를 전혀 안 가리키는 고아**였다 — 그룹→멤버, 멤버→그룹
// 링크가 전부 앱 딥링크 해시(`/#g=에스파&m=카리나`)라 크롤러가 sitemap 말고는 들어올 경로가 없었다.
// 이제 정적 경로로 바꿨는데, 경로 규칙이 생성부와 어긋나면 **4,000개 페이지에 404가 박힌다**.
// 그래서 "모든 내부 링크가 디스크에 실재하는가"를 매번 검사한다.
// 실행: node tests/static-links.test.js   (먼저 node build_group_pages.js)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SITE = 'https://kpop-universe.kr';

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('✅ ' + m); };
const bad = m => { fail++; console.error('❌ ' + m); };

// 생성된 정적 페이지 전부 수집
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name === 'index.html') out.push(p);
  }
  return out;
}
const pages = [...walk(path.join(ROOT, 'g')), ...walk(path.join(ROOT, 'en', 'g')),
               ...walk(path.join(ROOT, 'member')), ...walk(path.join(ROOT, 'en', 'member'))];
if (!pages.length) { console.error('정적 페이지가 없음 — 먼저 node build_group_pages.js'); process.exit(2); }
ok(`정적 페이지 ${pages.length}개 수집`);

// 허브가 존재하는가 — 그래프의 진입점
for (const hub of ['g/index.html', 'en/g/index.html']) {
  fs.existsSync(path.join(ROOT, hub)) ? ok(`허브 존재: /${path.dirname(hub)}/`) : bad(`허브 없음: ${hub}`);
}

// 내부 링크가 전부 실재하는가
let checked = 0; const missing = new Map();
for (const p of pages) {
  const html = fs.readFileSync(p, 'utf8');
  for (const m of html.matchAll(/href="https:\/\/kpop-universe\.kr\/([^"#]*)"/g)) {
    const rel = m[1];
    if (!rel || rel.startsWith('icons/')) continue;      // 루트·아이콘은 대상 아님
    checked++;
    const target = path.join(ROOT, rel, 'index.html');
    if (!fs.existsSync(target)) {
      const k = rel;
      if (!missing.has(k)) missing.set(k, path.relative(ROOT, p));
    }
  }
}
if (missing.size === 0) ok(`내부 링크 ${checked}개 전부 실재 (깨진 링크 0)`);
else {
  bad(`깨진 내부 링크 ${missing.size}종`);
  [...missing.entries()].slice(0, 10).forEach(([t, from]) => console.error(`     ${t}  ← ${from}`));
}

// 고아 방지 — 멤버 페이지가 최소 한 번은 다른 페이지에서 링크되는가(표본)
const allHtml = pages.slice(0, 400).map(p => fs.readFileSync(p, 'utf8')).join('\n');
const sampleMembers = pages.filter(p => /[\\/]g[\\/][^\\/]+[\\/][^\\/]+[\\/]index\.html$/.test(p)).slice(0, 5);
let linked = 0;
for (const p of sampleMembers) {
  const rel = path.relative(ROOT, path.dirname(p)).split(path.sep).join('/') + '/';
  if (allHtml.includes(`${SITE}/${rel}"`)) linked++;
}
sampleMembers.length && linked === sampleMembers.length
  ? ok(`멤버 페이지 표본 ${sampleMembers.length}개가 전부 다른 페이지에서 링크됨(고아 아님)`)
  : bad(`멤버 페이지 표본 ${sampleMembers.length}개 중 ${linked}개만 링크됨 — 고아 페이지 존재`);

// sitemap에 허브가 들어갔는가
const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
sm.includes(`<loc>${SITE}/g/</loc>`) ? ok('sitemap에 허브 포함') : bad('sitemap에 허브 없음');

console.log(`\n${pass}/${pass + fail} 통과`);
process.exit(fail ? 1 : 0);
