// 아티스트별 직캠 전체 페이지 TOP 순위 구역 (2026-11-16 사용자 "차트 노출 — 아티스트별 전체 직캠 페이지에 TOP 모음을 추가")
// 빌드 전체를 돌리지 않고(sitemap 7만 줄 소실 함정) 함수·소스 규칙만 확인한다. 실제 생성 결과는 CI의 정적 페이지 재생성 뒤 확인.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const src = fs.readFileSync(path.join(__dirname, '..', 'build_group_pages.js'), 'utf8');
let failures = 0;
const check = (n, fn) => { try { fn(); console.log('PASS ' + n); } catch (e) { failures++; console.error('FAIL ' + n + ': ' + e.message); } };
function extract(name) {
  const s = src.indexOf('function ' + name + '('); assert(s >= 0, name + ' 없음');
  let d = 0, i = src.indexOf('{', s);
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  return src.slice(s, i + 1);
}
const box = { ytThumb: (id, q) => `https://i.ytimg.com/vi/${id}/${q || 'hq'}.jpg`, escHtml: s => String(s).replace(/</g, '&lt;'), SEO: { fmtViews: n => n + '회', fmtVC: n => n + '회' } };
vm.createContext(box); vm.runInContext(extract('fancamCardHtml'), box);
const v = { id: 'abc123', title: 'T <x>', published_at: '2026-01-02T00:00:00Z', view_count: 1234 };
check('순위를 주면 카드에 번호 배지가 붙는다', () => { const h = vm.runInContext('fancamCardHtml(__v,false,3)', Object.assign(box, { __v: v })); assert.ok(h.includes('<span class="rk">3</span>'), h); });
check('순위를 안 주면(곡별 구역 등) 배지가 없다', () => { const h = vm.runInContext('fancamCardHtml(__v,false)', box); assert.ok(!h.includes('class="rk"')); });
check('TOP 개수 상수가 10이고 맨 위 구역이 1위부터 번호를 단다', () => {
  assert.ok(/const FANCAM_RANK_N = 10;/.test(src));
  assert.ok(src.includes('fancams.slice(0, FANCAM_RANK_N).map((v, i) => fancamCardHtml(v, isEn, i + 1))'));
});
check('제목은 "직캠 모음"을 유지하고 "TOP 10"을 덧붙인다(한·영)', () => {
  assert.ok(src.includes('${idTitle} 직캠 모음·TOP 10'));
  assert.ok(src.includes('${idTitle} Fancams · Top 10'));
});
check('설명에 TOP 10 순위·최근 1년 인기 문구', () => {
  assert.ok(src.includes('조회수 TOP 10 순위와 최근 1년 인기 직캠까지.'));
  assert.ok(src.includes("with the most-viewed Top 10 ranking and this year's popular picks"));
});
check('"직캠 순위 TOP N" 소제목과 "최근 1년 인기" 구역(3개 미만이면 생략)', () => {
  assert.ok(src.includes('직캠 순위 TOP ${Math.min(FANCAM_RANK_N, fancams.length)}'));
  assert.ok(src.includes('최근 1년 인기 직캠'));
  assert.ok(src.includes('recentTop.length >= 3 ? recentTop.map'));
});
check('최근 1년 구역은 TOP 10과 겹치는 영상을 빼고 업로드일이 1년 안인 것만', () => {
  assert.ok(src.includes('!topIds.has(v.id)')); assert.ok(src.includes("String(v.published_at || '').slice(0, 10) >= _yr"));
});
check('배지 스타일이 페이지 <style>에 있다(.card-th relative + .rk)', () => assert.ok(src.includes('.card-th{position:relative;}.rk{position:absolute;')));
console.log(failures ? '실패 ' + failures : '🎉 직캠 TOP 순위 테스트 통과');
process.exit(failures ? 1 : 0);
