// 모션 줄이기(prefers-reduced-motion) 배선 회귀 테스트 (2026-08-26)
//
// ⚠️ 이건 **동작 테스트가 아니라 배선 테스트**다. 실제 동작(자동회전 정지·비행 즉시 도착·기능 유지)은
// 도입 시점에 헤드리스로 확인했고, 여기서는 "리팩터링하다 가드가 조용히 빠지는 것"만 막는다.
// 접근성 기능은 화면에 티가 안 나서 한 번 빠지면 아무도 모른 채 몇 달을 가기 때문에 잠가둔다.
// 동작까지 다시 확인하고 싶으면 reducedMotion:'reduce' 컨텍스트로 띄워서 3초간 camera.position이
// 안 움직이는지 보면 된다(기존 테스트들이 Playwright 없이 CDP를 쓰는 구조라 여기 합치진 않음).
//
// 실행: node tests/motion.test.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');

let pass = true;
const ok = m => console.log('✅ ' + m);
const fail = m => { pass = false; console.log('❌ ' + m); };
const need = (cond, m) => cond ? ok(m) : fail(m);

need(/let\s+_reduceMotion\s*=/.test(html), '_reduceMotion 플래그 선언');
need(html.includes("matchMedia('(prefers-reduced-motion: reduce)')"), 'prefers-reduced-motion 미디어 쿼리 감지');
need(/_rmq\.addEventListener|_rmq\.addListener/.test(html), 'OS 설정을 도중에 바꿔도 반영되는 change 리스너');
need(html.includes('controls.autoRotate=!_reduceMotion'), '자동회전이 플래그를 따름');
need(html.includes('flyState.dur=_reduceMotion?1:'), '카메라 비행이 즉시 도착으로 단축됨');
need(html.includes('if(!_reduceMotion)_nctRingGroups.forEach'), '링 자동회전이 정지됨');

// 리플/펄스/별똥별 가드 — 함수 본문 첫 줄의 early return
const guards = ['pulseGroupRipple', 'pulseGroup', 'pulseMember', '_checkBdayShootingStars'];
guards.forEach(fn => {
  const i = html.indexOf('function ' + fn + '(');
  const body = i >= 0 ? html.slice(i, i + 400) : '';
  need(i >= 0 && /if\(_reduceMotion\)return;/.test(body), `${fn}() 연출 생략 가드`);
});

need(/@media \(prefers-reduced-motion: reduce\)/.test(css), 'CSS에 prefers-reduced-motion 블록');
// 일부러 남긴 것들 — 이게 꺼지면 "로딩 중인데 멈춘 것처럼" 보이거나 카드가 중간 상태로 고착된다
const rmBlock = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
need(!/transition\s*:\s*none/.test(rmBlock), '전역 transition 무력화를 하지 않음(시트 고착 방지)');
need(!/\.yt-lb-spinner|loading-shimmer/.test(rmBlock), '로딩 표시는 유지');

console.log(pass ? '\n✅ 모션 줄이기 배선 테스트 통과' : '\n❌ 모션 줄이기 배선 테스트 실패');
process.exit(pass ? 0 : 1);
