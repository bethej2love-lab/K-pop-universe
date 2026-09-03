// 절전 모드 배선 + 선언 순서 회귀 테스트 (2026-08-26)
//
// 이 테스트의 존재 이유는 딱 하나다: **TDZ 크래시 재발 방지.**
// 구현 중 실제로 한 번 냈다 — 절전 상태(let _powerSaveOn)를 설정 UI 근처(파일 뒤쪽)에 선언했는데,
// animate()는 스크립트 로드 직후 즉시 돌기 시작하고 그 안의 _curRenderInterval()이 그 변수를 읽는다.
// 결과: 매 프레임 "Cannot access '_powerSaveOn' before initialization"이 터지며 **로딩화면 영구 정지**.
// ⚠️ typeof 가드로는 못 막는다 — typeof는 "미선언"만 안전하게 넘기고 TDZ에서는 똑같이 던진다.
//    (PRINCIPLES.md의 "최상위 즉시실행 코드에서 파일 뒤쪽 let/const 참조 금지"와 같은 계열 사고)
// 스모크 테스트도 이걸 잡지만(로딩 해제 실패로), 여기서는 원인을 정확히 짚어준다.
//
// 실행: node tests/powersave.test.js

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── 선언 순서 ──────────────────────────────────────────────────────────────────
const declAt = html.indexOf('let _powerSaveOn');
const useAt = html.indexOf('function _curRenderInterval');
const animAt = html.indexOf('function animate(');
need(declAt >= 0, '_powerSaveOn 선언 존재');
need(useAt >= 0, '_curRenderInterval 존재');
if (declAt >= 0 && useAt >= 0) {
  need(declAt < useAt, `_powerSaveOn이 _curRenderInterval보다 먼저 선언됨 (${declAt} < ${useAt})`);
}
if (declAt >= 0 && animAt >= 0) {
  need(declAt < animAt, `_powerSaveOn이 animate()보다 먼저 선언됨 — 즉시 실행되는 루프가 읽는다`);
}
need(!/typeof _powerSaveOn/.test(html), 'typeof 가드를 쓰지 않음(TDZ를 못 막으므로 오히려 위험한 안심)');

// ── 레버가 실제로 연결돼 있는가 ────────────────────────────────────────────────
need(/if\(_powerSaveOn\)return \(performance\.now\(\)-_lastInteractMs/.test(html), '프레임 상한 레버');
need(/_maxFar=_powerSaveOn\?/.test(html), '라벨 LOD 상한 레버');
// ⚠️ 비절전 쪽 상한은 이 테스트의 관심사가 아니다 — 2026-09-02 발열 작업에서 그쪽이 `2`에서
// `isMob()?_MOB_DPR_CAP:2`로 바뀌었는데, 정규식이 `:2)`까지 통째로 못 박아둬서 **코드는 멀쩡한데
// 테스트만 빨간불**이 됐고 그대로 CI가 죽어 있었다(2026-09-03 발견). 이 검사가 지켜야 할 건
// "절전이면 픽셀비를 1.25로 낮추는 레버가 연결돼 있는가" 하나뿐이므로 거기까지만 본다.
need(/renderer\.setPixelRatio\(Math\.min\(dpr,want\?1\.25:/.test(html), '픽셀비 레버(절전 시 1.25)');
need(/_psAutoWeak=true;_applyPowerSave\(\);/.test(html), 'fps 실측 결과로 자동 판정 확정');
need(/navigator\.deviceMemory/.test(html) && /hardwareConcurrency/.test(html), '기기 힌트로 1차 판단');

// ── 설정 UI ───────────────────────────────────────────────────────────────────
need(html.includes('id="sp-ps-seg"'), '설정 패널 세그먼트 컨트롤');
need(/_PS_KEY='kpu_power_save'/.test(html), '선택이 localStorage에 저장됨');
['powerSave', 'psAuto', 'psOn', 'psOff', 'psHintAuto', 'psHintAutoOn', 'psHintOn', 'psHintOff']
  .forEach(k => need(new RegExp(k + ":'").test(html), `i18n 키 ${k}`));
// 한/영 양쪽에 다 있는지(한쪽만 있으면 언어 전환 시 빈 텍스트가 된다)
need((html.match(/powerSave:'/g) || []).length >= 2, 'i18n 한국어·영어 양쪽 등록');

console.log(pass ? '\n✅ 절전 모드 배선 테스트 통과' : '\n❌ 절전 모드 배선 테스트 실패');
process.exit(pass ? 0 : 1);
