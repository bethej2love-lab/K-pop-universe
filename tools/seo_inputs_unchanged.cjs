// SEO publish 경합 시 사용. DB 조회/외부 push 없이 빌드 입력만 비교한다.
// index.html 전체를 비교하면 캐시버스터·앨범/뷰어 UI 수정에도 10분짜리 재빌드를 반복한다.
// 빌더가 index에서 읽는 것은 _AGENCY_EN 한 블록뿐(build_group_pages.js와 같은 추출식).
const {spawnSync, execFileSync} = require('child_process');
// 빌더와 비교기가 같은 추출 함수를 사용해 입력 범위가 갈라지지 않게 한다.
function agencySource(src) { return src.match(/const _AGENCY_EN=\{[\s\S]*?\n\};/)?.[0] || null; }
module.exports = {agencySource};
if (require.main === module) {
const [before = 'HEAD', after = 'origin/main'] = process.argv.slice(2);
const inputs = ['artists.json', 'groups.json', 'admin.js', 'shared.js', 'build_group_pages.js',
  'tools/seo_extra.js', 'tools/m2_harness.js', 'tools/build_og_thumbs.mjs', 'tools/seo_inputs_unchanged.cjs',
  'tours_boxscore.json', 'group_awards.json', 'group_certifications.json', 'artist_credits.json', 'og_thumbs_pin.json'];
try {
  const diff = spawnSync('git', ['diff', '--quiet', before, after, '--', ...inputs]);
  if (diff.error) throw diff.error;
  if (diff.status !== 0) {
    if (diff.status !== 1) throw new Error('git diff failed: ' + diff.status);
    console.log('SEO 원본 변경 — 최신 입력으로 재빌드 필요'); process.exit(1);
  }
  const agency = ref => {
    // 2026-10-26부터 앱 코드는 app.js(_AGENCY_EN도 거기) — 분리 전 리비전엔 app.js가 없으니 있으면 붙인다
    const show = f => { try { return execFileSync('git', ['show', ref + ':' + f], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore']}); } catch (e) { return ''; } };
    const src = show('index.html') + '\n' + show('app.js');
    const block = agencySource(src);
    if (!block) throw new Error('_AGENCY_EN 추출 실패: ' + ref);
    return block;
  };
  if (agency(before) !== agency(after)) {
    console.log('SEO 소속사 표 변경 — 재빌드 필요'); process.exit(1);
  }
  console.log('SEO 입력 동일 — 다른 변경을 보존해 게시 가능');
} catch (e) { console.error('[SEO 입력 비교] ' + e.message); process.exitCode = 1; }
}
