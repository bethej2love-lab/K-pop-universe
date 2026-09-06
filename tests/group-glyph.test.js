// 별자리 글리프(디자인리뷰 Q2) 회귀 하네스 (2026-09-07 신설)
//
// 그룹 멤버 좌표(x,y)로 만든 SVG 글리프가 올바른 점 개수·정규화·lit 표시를 내는지 고정한다.
// 실제 카드 배치·시각은 브라우저 눈검수.
//
// 실행: node tests/group-glyph.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const _slim = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.slim.json'), 'utf8'));
const ARTISTS = Array.isArray(_slim) ? _slim : (_slim.artists || []);

let fail = 0;
const ck = (c, m) => { console.log((c ? '✓ ' : '✗ 실패: ') + m); if (!c) fail++; };
function extractBraces(src, re, label) {
  const m = re.exec(src); if (!m) throw new Error('못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}

const glyph = new Function('GROUPS', 'ARTISTS',
  extractBraces(html, /^function _groupGlyphSVG\(/m, '_groupGlyphSVG') + '\nreturn _groupGlyphSVG;')(G, ARTISTS);

const nCircles = svg => (svg.match(/<circle/g) || []).length;

console.log('\n── 별자리 글리프 ──');
const es = glyph('에스파', 18);
ck(/^<svg /.test(es) && /viewBox="0 0 100 100"/.test(es), '유효한 SVG(viewBox 100)');
const nEs = ARTISTS.filter(a => a.group && a.group.ko === '에스파' && typeof a.x === 'number').length;
ck(nCircles(es) === nEs && nEs >= 4, `에스파 점 개수 = 멤버 수(${nEs})`);

const esLit = glyph('에스파', 18, '카리나');
ck((esLit.match(/r="9"/g) || []).length === 1, '멤버 lit 시 큰 점(r=9) 정확히 1개(카리나)');
ck((esLit.match(/opacity="1"/g) || []).length === 1, 'lit 점만 불투명 1');

// 좌표가 전부 viewBox(0~100) 안(찌그러짐/이탈 없음)
const coords = [...es.matchAll(/c[xy]="([\d.]+)"/g)].map(m => parseFloat(m[1]));
ck(coords.every(v => v >= 0 && v <= 100), '모든 점이 viewBox 0~100 안');

ck(glyph('존재안함그룹', 18) === '', '없는 그룹 → 빈 문자열');
ck(nCircles(glyph('뉴진스', 18)) >= 5, '뉴진스 점 5+');

// 배선: 카드 헤더에 글리프 span + showGC/showT에서 채움
ck(/id="gc-glyph"/.test(html) && /id="tt-glyph"/.test(html), '그룹/멤버 카드 헤더에 글리프 span');
ck(/_groupGlyphSVG\(ko,18\)/.test(html), 'showGC가 글리프 채움');
ck(/_groupGlyphSVG\(a\.group\.ko,18,a\.name\.ko\)/.test(html), 'showT가 본인 lit 글리프 채움');

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 별자리 글리프 하네스 통과');
process.exit(fail ? 1 : 0);
