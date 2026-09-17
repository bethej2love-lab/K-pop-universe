// 디스코그래피 변형판·해외반 노출 회귀 테스트 (2026-09-17 신설)
//
// 배경: 수집 정책을 "멜론에 있는 모든 발매를 태그해서 넣고, 노출은 선별한다"로 바꿨다(사용자 결정).
// 그 순간부터 **데이터에 있는 것과 화면에 보이는 것이 달라도 되는 대신, 거르는 코드가 반드시 있어야**
// 한다. 없으면 82메이저처럼 14장 중 7장이 리믹스인 팀의 디스코그래피가 리믹스로 도배된다.
// 여기서 지키는 것:
//   ① 데이터 — 변형판/해외반이 태그(variant/region)를 달고 있고, 부가(isMain:false)로 들어가 있다.
//   ② 화면 — _renderDiscography가 기본값에서 variant를 거르고, 케밥 토글이 있다.
//   ③ 색인 — 원곡(cover) 색인이 변형판을 빼고, 해외반은 원판을 못 이기게 약하게 넣는다.
//      (일본판 `偽物(FAKE LOVE)`가 타이틀곡으로 들어가 방탄소년단 원곡 판정을 동점으로 떨어뜨린 사고)
//
// 실행: node tests/discog-variant.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let pass = 0, fail = 0;
const need = (c, m, d) => { if (c) { pass++; console.log(`✅ ${m}`); } else { fail++; console.log(`❌ ${m}`); if (d) console.log('   ' + d); } };

/* ① 데이터 */
let variantCnt = 0, variantMain = 0, regionCnt = 0;
for (const g of Object.values(groups)) for (const al of (g.discography || [])) {
  if (al.variant) { variantCnt++; if (al.isMain) variantMain++; }
  if (al.region) regionCnt++;
}
need(variantCnt > 0, `변형판 태그(variant)가 데이터에 있음 — ${variantCnt}장`);
need(variantMain === 0, '변형판은 전부 부가(isMain:false)', `isMain인 변형판 ${variantMain}장`);
need(regionCnt > 0, `해외반 태그(region)가 데이터에 있음 — ${regionCnt}장`);

/* ② 화면 */
need(/let\s+variantIncluded\s*=\s*false/.test(html), '디스코그래피 기본값이 변형판 제외(variantIncluded=false)');
need(/base=base\.filter\(a=>!a\.variant\)/.test(html), 'currentList가 variant를 걸러냄');
need(/-discog-variant-btn/.test(html), '케밥에 변형판 토글 버튼이 있음');
need((html.match(/id="(gc|tt)-discog-variant-btn"/g) || []).length === 2,
  '그룹 카드(gc)·멤버 카드(tt) 양쪽에 토글이 있음',
  '한쪽만 있으면 같은 데이터가 화면마다 다르게 보인다');
need(/variantBtn\.style\.display=albums\.some\(a=>a\.variant\)/.test(html),
  '변형판이 있는 아티스트에서만 토글 노출');

/* ③ 원곡 색인 */
need(/const\s+indexable\s*=\s*al\s*=>\s*!!al&&!al\.variant/.test(admin),
  '원곡 색인이 변형판 앨범을 제외');
need(/const\s+albumTier\s*=\s*\(al,\s*baseTier\)\s*=>\s*al&&al\.region\s*\?\s*'C'/.test(admin),
  '해외반은 가장 약한 근거(tier C)로만 색인');
need(/const\s+albumIsTitle\s*=\s*\(al,\s*isTitle\)\s*=>\s*!!\(isTitle&&!\(al&&al\.region\)\)/.test(admin),
  '해외반 트랙은 타이틀곡 가산점을 받지 않음');
need((admin.match(/\.filter\(indexable\)/g) || []).length >= 3,
  '색인 세 경로(그룹·솔로·유닛)에 전부 적용', '한 곳만 빠져도 그 경로로 변형판이 새어 들어간다');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
