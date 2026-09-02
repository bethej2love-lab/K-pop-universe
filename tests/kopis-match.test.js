// KOPIS 공연명 → 그룹 매칭 회귀 (tools/kopis_events.mjs 셀프테스트를 CI에 연결, 2026-09-02 신설)
//
// 왜: 공연 매칭은 이미 tools/kopis_events.mjs --selftest + tools/kopis_fixture.json(실데이터 픽스처)로
// 검증한다. 그런데 이게 CI(data-and-tests)엔 안 걸려 있어서, 매처를 고쳐도 자동으로 안 돌았다.
// "하츠투하츠 스텔라 공연"(스텔라 도넬리·콜, 알레시아 카라 = 외국 내한공연이 K팝 이름과 겹쳐 오매칭)
// 같은 오탐이 다시 새지 않게, 그 셀프테스트를 여기서 실행해 CI(tests/*.test.js 자동수집)에 태운다.
//
// 네트워크 불필요(픽스처+groups.json+artists.json만 읽음). 실패하면 셀프테스트 출력을 그대로 보여준다.
// 실행: node tests/kopis-match.test.js

const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

try {
  const out = execFileSync('node', ['tools/kopis_events.mjs', '--selftest'], { cwd: ROOT, encoding: 'utf8' });
  process.stdout.write(out);
  console.log('\n✅ KOPIS 매칭 셀프테스트 통과');
  process.exit(0);
} catch (e) {
  if (e.stdout) process.stdout.write(e.stdout);
  if (e.stderr) process.stderr.write(e.stderr);
  console.log('\n✗ KOPIS 매칭 셀프테스트 실패 (오탐/놓침 발생 — 위 ❌ 항목 확인)');
  process.exit(1);
}
