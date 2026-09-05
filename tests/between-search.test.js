// 두 사람 검색(둘 사이) 감지·해석 회귀 (2026-09-05 신설, 킬러 6.1)
//
// "카리나, 장원영" / "A x B" / "A & B"처럼 두 이름을 치면 둘의 연결 카드를 여는 "함께 보기" 결과가
// 떠야 한다. 여기선 노드로 검증 가능한 부분(구분자 분리 + 이름→아티스트 해석)만 고정한다.
// 실제 연결 카드 열림·B 자동선택은 브라우저(연결 카드 DOM)라 아이폰/웹 눈검수.
//
// 실행: node tests/between-search.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

let fail = 0;
const ck = (c, m) => { console.log((c ? '✓ ' : '✗ 실패: ') + m); if (!c) fail++; };
function extractBraces(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}

// 배포 코드에서 그대로 잘라 실행(카피 드리프트 없음)
const normEn = extractBraces(html, /^function _normEn\(/m, '_normEn');
const resolve = extractBraces(html, /^function _resolveArtistByStr\(/m, '_resolveArtistByStr');
const _resolve = new Function('ARTISTS', normEn + '\n' + resolve + '\nreturn _resolveArtistByStr;')(ARTISTS);

// 구분자 분리 — doSearch의 정규식과 동일해야 한다(바뀌면 이 상수도 같이 바꿀 것)
const SPLIT = /\s*(?:,|·|&|×|\/|\bvs\b| x )\s*/i;
const two = q => { const p = q.split(SPLIT).map(s => s.trim()).filter(Boolean); return p.length === 2 ? p : null; };

console.log('\n── 두 사람 검색 감지·해석 ──');
// 분리
ck(!!two('카리나, 장원영'), '쉼표로 두 이름 분리');
ck(!!two('카리나 x 장원영'), '" x "로 분리');
ck(!!two('karina & wonyoung'), '"&"로 분리');
ck(two('아이유') === null, '한 명이면 두 사람 아님');
// 해석
const A = _resolve('카리나'), B = _resolve('장원영');
ck(A && A.name.ko === '카리나' && A.group.ko === '에스파', '"카리나" → 카리나(에스파)');
ck(B && B.name.ko === '장원영' && B.group.ko === '아이브', '"장원영" → 장원영(아이브)');
ck(_resolve('wonyoung') && _resolve('wonyoung').name.ko === '장원영', '영문 "wonyoung" → 장원영');
ck(_resolve('') === null && _resolve('ㅋ') === null, '빈/1자는 null');
// 둘 다 해석되고 서로 다를 때만 성립
const p = two('카리나, 장원영');
const rA = _resolve(p[0]), rB = _resolve(p[1]);
ck(rA && rB && rA !== rB, '두 이름 모두 해석되고 서로 다름 → between 성립');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 두 사람 검색 하네스 통과');
process.exit(fail ? 1 : 0);
