// index.html의 "논리적 원본" 읽기 (2026-10-26 메인 페이지 경량화)
//
// 메인 앱 코드(약 1.5MB)는 index.html 안의 인라인 <script>였는데, 페이지가 2MB나 돼서 네이버 블로그
// 링크 미리보기가 "링크 정보를 불러오는 데 실패"했다(그룹·멤버 정적 페이지 14KB는 정상). 그래서 코드를
// app.js로 빼고 index.html에는 <script src="app.js?v=…"></script> 한 줄만 남겼다 — 실행 순서·시점은
// 인라인 때와 같다(defer/async 없음 → 그 자리에서 파싱을 멈추고 실행).
//
// 테스트·도구 100여 곳이 index.html 원문에서 코드를 정규식/슬라이스로 읽으므로, 그쪽은 이 함수로
// "app.js를 원래 자리에 다시 끼운 index.html"을 받는다 — 분리 전과 글자 하나까지 같은 문자열.
// ⚠️ 새 테스트·도구에서 앱 코드를 읽을 땐 fs.readFileSync('index.html') 말고 이걸 쓸 것.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_TAG_RE = /<script src="app\.js\?v=[^"]*"><\/script>/;

function joinIndexSource(html, app) {
  if (!APP_TAG_RE.test(html)) return html; // 분리 전 리비전(git show 등)
  return html.replace(APP_TAG_RE, () => '<script>\n' + app + '</script>');
}

function readIndexSource(root = ROOT) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!APP_TAG_RE.test(html)) return html;
  return joinIndexSource(html, fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
}

module.exports = { readIndexSource, joinIndexSource, APP_TAG_RE };
