// 공유 링크 경로 규칙 회귀 테스트 (2026-08-26)
//
// 왜 필요한가: 공유 버튼이 만드는 정적 SEO 페이지 URL 규칙이 index.html과 build_group_pages.js
// 두 곳에 중복돼 있다. 한쪽만 고치면 공유 링크가 조용히 404가 되는데, 링크 미리보기는 사람이
// 매번 확인하지 않으므로 오래 방치되기 쉽다. 그래서 index.html에서 헬퍼를 **그대로 추출해** 실제
// 생성된 디렉터리와 전수 대조한다.
//
// 실행: node tests/seo-url.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

// index.html에서 헬퍼 4개를 원문 그대로 뽑아온다(복사가 아니라 추출 — 그래야 드리프트가 잡힌다)
function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error(`index.html에서 ${name}()을 찾지 못함 — 함수명이 바뀌었는지 확인`);
  let depth = 0, i = html.indexOf('{', start);
  const from = i;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}
const src = ['_seoUrlSafeKo', '_seoSlugify', '_seoUrlForGroup', '_seoUrlForMember'].map(extract).join('\n');

const ORIGIN = 'https://kpop-universe.kr';
const sandbox = { GROUPS: groups, location: { origin: ORIGIN }, currentLang: 'ko' };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

let fail = 0, checked = 0;
const miss = [];
const urlToPath = u => decodeURIComponent(u.replace(ORIGIN + '/', '')) + 'index.html';

function check(label, url) {
  checked++;
  if (!url) { fail++; miss.push(`${label} → URL 생성 실패(null)`); return; }
  const p = path.join(ROOT, urlToPath(url));
  if (!fs.existsSync(p)) { fail++; if (miss.length < 15) miss.push(`${label} → ${urlToPath(url)} 없음`); }
}

for (const lang of ['ko', 'en']) {
  sandbox.currentLang = lang;
  Object.keys(groups).forEach(ko => {
    check(`[${lang}] 그룹 ${ko}`, vm.runInContext(`_seoUrlForGroup(${JSON.stringify(ko)})`, sandbox));
  });
  artists.forEach(a => {
    sandbox.__a = a;
    check(`[${lang}] 멤버 ${a.name.ko}(${a.group.ko})`, vm.runInContext('_seoUrlForMember(__a)', sandbox));
  });
}

console.log(`[seo-url] 검사 ${checked}건 (그룹 ${Object.keys(groups).length} + 멤버 ${artists.length}, ko/en 각각)`);
if (fail) {
  console.error(`\n❌ ${fail}건이 실제 생성된 정적 페이지와 어긋남:`);
  miss.forEach(m => console.error('   ' + m));
  if (fail > miss.length) console.error(`   … 외 ${fail - miss.length}건`);
  console.error('\n원인 후보: ①정적 페이지 리빌드가 안 됨(node build_group_pages.js) ②index.html과 build_group_pages.js의 경로 규칙이 어긋남');
  process.exit(1);
}
console.log('✅ 공유 링크가 가리키는 정적 페이지가 전부 존재함');
