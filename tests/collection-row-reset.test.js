// 카드 Collections 행 잔존/중복 회귀 가드 (2026-10-12 신설)
//
// 10-11에 출연 프로그램 행을 Collections 행에 합치면서(c00240235) 프로그램 쪽 innerHTML='' 가 사라졌고,
// _renderCollectionRow는 목록 0개면 비우지 않고 return했다. 결과(헤드리스 재현): 디모렉스 → 아이유 카드를 열면
// 아이유 카드에 디모렉스 '잇츠라이브'가 남고, 같은 카드를 다시 불러올 때마다 '잇츠라이브'가 하나씩 늘었다.
//
// 실행: node tests/collection-row-reset.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };
function extractBraces(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}

console.log('\n── 카드 Collections 행 ──');
const load = extractBraces(html, /^async function _loadCollectionRow\(/m, '_loadCollectionRow');
const render = extractBraces(html, /^function _renderCollectionRow\(/m, '_renderCollectionRow');
const prog = extractBraces(html, /^async function _loadProgramRow\(/m, '_loadProgramRow');

ck(/le\.innerHTML=''/.test(load), '_loadCollectionRow가 시작할 때 칩을 비움(직전 카드 칩 잔존 방지)');
const iClear = render.indexOf("listEl.innerHTML=''"), iEmpty = render.indexOf('if(!list.length)');
ck(iClear >= 0 && iEmpty >= 0 && iClear < iEmpty, '_renderCollectionRow는 빈 목록 return보다 먼저 비움');
ck(/row\._loadSeq/.test(load) && /_loadProgramRow\(ko,containerId,memberKo,cardMemberKo,_stale\)/.test(load),
  '늦게 도착한 이전 호출이 칩을 덧붙이지 못하게 토큰 전달');
ck(/_gone\(\)\)return;/.test(prog), '_loadProgramRow가 렌더 전에 토큰 확인');
ck(!/row\.style\.display='none'/.test(prog), '_loadProgramRow는 행을 숨기지 않음(먼저 그려진 컬렉션 칩까지 숨겨짐)');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${fail} 실패`);
process.exit(fail ? 1 : 0);
