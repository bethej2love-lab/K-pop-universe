// 사이트맵 주소 모으기(테스트 공용, 2026-10-30) — sitemap.xml이 목록 파일(sitemapindex)이면 가리키는 sitemaps/*.xml을 로컬에서 읽어 합친다.
// 예전 한 파일(urlset)도 그대로 읽는다. 파일 이름이 _로 시작해 테스트 실행 목록(*.test.js)에는 안 걸린다.
const fs = require('fs');
const path = require('path');
const SITE = 'https://kpop-universe.kr';
function sitemapLocs(ROOT) {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const locsOf = xml => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const top = read('sitemap.xml');
  if (!/<sitemapindex/.test(top)) return locsOf(top);
  return locsOf(top).flatMap(u => {
    const url = new URL(u);
    if (url.origin !== SITE) throw new Error('외부 사이트맵은 로컬 검사할 수 없음: ' + u);
    const base = path.resolve(ROOT);
    const file = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(base + path.sep)) throw new Error('사이트맵 경로가 프로젝트 밖임: ' + u);
    // 누락된 조각을 []로 바꾸면 해당 페이지 수천 개가 검사에서 빠진 채 통과한다.
    return locsOf(fs.readFileSync(file, 'utf8'));
  });
}
module.exports = { sitemapLocs };
