// 탭바·줌 컨트롤 리빌 타이밍 가드 (2026-09-02 신설)
//
// 왜: 이 둘은 처음부터 뜨면 안 되고 아이맥스 클립(화면 확장)에 맞춰 떠야 한다(제보). 각자 transition을
// 스크롤숨김(#tabbar)·패널이동(#zoom-ctrl)에 이미 써서 CSS 리빌 트랜지션이 덮인다 — 그래서 booting과
// 별개의 chrome-wait 클래스로 숨겨두고 JS(_revealChrome)로만 띄운다. [[reference_zindex_bringtofront]]와
// 같은 "덮어쓰기 두더지잡기" 계열이라, 배선이 조용히 깨지지 않게 구조를 고정한다.
//
// 핵심 불변식: chrome-wait는 html에 딱 한 번 걸리고, 리빌/폴백/감소모션/에러 모든 출구에서 반드시
// 해제돼야 한다(안 그러면 탭바·줌이 영영 안 뜬다).
//
// 못 잡는 것: 실제 페이드 타이밍이 "확장과 잘 맞는지"는 아이폰 눈검수(시각). 여기선 배선만 지킨다.
// 실행: node tests/chrome-reveal.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');

let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

// ── html에 chrome-wait가 처음부터 걸려 있어야(로드 시 즉시 숨김) ──
ck(/<html[^>]*class="[^"]*\bchrome-wait\b[^"]*"/.test(html), '<html>에 chrome-wait 초기 클래스');

// ── CSS: chrome-wait가 탭바·줌을 숨긴다(booting 풀린 뒤에도) ──
const cwRule = css.match(/html\.chrome-wait[^{]*\{[^}]*\}/);
ck(!!cwRule, 'CSS에 html.chrome-wait 규칙 존재');
if (cwRule) {
  const sel = css.slice(Math.max(0, cwRule.index - 120), cwRule.index + cwRule[0].length);
  ck(/#tabbar/.test(sel) && /#zoom-ctrl/.test(sel), '  → #tabbar·#zoom-ctrl 둘 다 대상');
  ck(/opacity\s*:\s*0/.test(cwRule[0]) && /visibility\s*:\s*hidden/.test(cwRule[0]), '  → opacity:0 + visibility:hidden');
}

// ── _revealChrome 정의 + 페이드/즉시 두 모드 ──
ck(/function _revealChrome\(fade\)/.test(html), '_revealChrome(fade) 정의');
const rc = html.match(/function _revealChrome\([\s\S]*?\n\}/);
if (rc) {
  ck(/getElementById\('tabbar'\)|'tabbar'/.test(rc[0]) && /'zoom-ctrl'/.test(rc[0]), '  → tabbar·zoom-ctrl 둘 다 처리');
  ck(/remove\('chrome-wait'\)/.test(rc[0]), '  → chrome-wait 해제');
  ck(/transition\s*=\s*''/.test(rc[0]), '  → 페이드 후 인라인 transition 걷어냄(스크롤숨김 복원)');
}

// ── 리빌 본 경로는 확장에 맞춘 페이드(true), 폴백/감소모션은 즉시(false) ──
ck(/_revealChrome\(true\)/.test(html), '본 리빌 경로에서 _revealChrome(true) — 확장에 맞춘 페이드');
ck(/REVEAL\.clip\s*\*\s*0?\.\d/.test(html), '  → 페이드 시작을 REVEAL.clip에 비례(하드코딩 상수 아님)');
ck((html.match(/_revealChrome\(false\)/g) || []).length >= 2, '폴백·감소모션 경로에서 _revealChrome(false) 즉시 표시(≥2곳)');

// ── 불변식: booting을 지우는 모든 곳에서 chrome-wait도 해제되거나 _revealChrome이 호출돼야 ──
// (안 그러면 그 출구로 빠졌을 때 탭바·줌이 영영 숨은 채로 남는다)
const lines = html.split('\n');
let bad = [];
lines.forEach((l, i) => {
  if (!/remove\('booting'\)/.test(l)) return;
  if (/function _endBooting\(/.test(l)) return; // 공용 헬퍼 — 호출부(3곳)가 반드시 _revealChrome을 짝지음
  // 같은 줄 또는 인접 ±2줄 안에서 chrome-wait 해제/_revealChrome 호출이 있으면 OK
  const win = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
  if (!/remove\('chrome-wait'\)|_revealChrome\(/.test(win)) bad.push(i + 1);
});
ck(bad.length === 0, 'booting 해제 지점마다 chrome-wait도 함께 풀림(영구 숨김 방지)');
if (bad.length) console.log('   ↳ chrome-wait 미해제 의심 줄: ' + bad.join(', '));

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 탭바·줌 리빌 배선 통과');
process.exit(fail ? 1 : 0);
