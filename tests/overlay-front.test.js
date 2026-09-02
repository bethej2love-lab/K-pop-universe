// 오버레이 z-순서(_bringToFront) 회귀 하네스 (2026-09-02 신설)
//
// 왜 만들었나: "그룹 클릭했는데 카드 뒤로 뜬다 / 편집 버튼이 밑에 뜬다 / 검색창만 남고 텅 빈다" —
// 새 창이 뒤로 뜨는 문제가 기능 추가 때마다 반복됐다. 원인은 늘 같다: 새 오버레이를 만들면서
// _bringToFront(el) 호출을 빠뜨림(정적 z-index 경쟁 = 두더지잡기). [[reference_zindex_bringtofront]]
//
// 방식(admin-dock-close.test.js와 동일 계열, 브라우저 불필요): 실제 배포되는 index.html/admin.js에서
// 코드를 그대로 잘라 목 DOM으로 돌리고(Part1), 유저 버그 났던 핵심 오프너가 _bringToFront를 계속
// 부르는지 고정하고(Part2), 현재 오버레이 open 지점을 스냅샷으로 동결해 새 오프너가 _bringToFront
// 없이 추가되면 배포 전에 실패시킨다(Part3). 검색 결과 클릭이 풀스크린 검색시트를 닫는지도(Part4).
//
// 못 잡는 것: 실제 픽셀 겹침/애니메이션 타이밍/실기기 렌더링(별·글로우)은 여전히 아이폰 눈검수 필요.
// 이 테스트는 "z 시스템의 로직과 구조"만 지킨다 — 그래도 반복 버그의 뿌리는 여기였다.
//
// 실행: node tests/overlay-front.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const admin = fs.readFileSync(path.join(ROOT, 'admin.js'), 'utf8');

let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

// 선언부부터 "다음 최상위 function 선언 직전"까지 잘라낸다(중괄호 카운트 없이도 "이 함수가
// _bringToFront를 참조하는가"는 안전하게 확인 가능 — 오프너들은 함수 앞머리에서 바로 부른다).
function fnRegion(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  const after = m.index + m[0].length;
  const rest = src.slice(after);
  const nxt = rest.search(/\n(?:async function|function) [A-Za-z_$]/);
  return src.slice(m.index, after + (nxt < 0 ? 3000 : nxt));
}
// 중괄호 균형으로 함수 본문 전체를 잘라 실제 실행할 때 쓴다(Part1).
function extractBraces(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) { i++; break; } } }
  return src.slice(m.index, i);
}
function extractStmt(src, declRe, label) {
  const m = declRe.exec(src);
  if (!m) throw new Error('[harness] 선언을 못 찾음: ' + label);
  let d = 0;
  for (let i = m.index; i < src.length; i++) {
    const c = src[i];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ';' && d === 0) return src.slice(m.index, i + 1);
  }
  throw new Error('[harness] ; 못 찾음: ' + label);
}

// ── Part 1: _bringToFront 동작(실제 코드 실행) ─────────────────────────────
console.log('\n── Part 1: _bringToFront 동작(런타임) ──');
(() => {
  const zDecl = extractStmt(html, /^let _topLayerZ\s*=/m, '_topLayerZ');
  const fn = extractBraces(html, /^function _bringToFront\(/m, '_bringToFront');
  const base = parseInt(zDecl.match(/=\s*(\d+)/)[1], 10);
  ck(base === 131, `_topLayerZ 기준선 131 (현재 ${base}) — 곡영상110·조합112 위, 토스트200·피커9990 아래`);
  const api = new Function(zDecl + '\n' + fn + '\nreturn {bf:_bringToFront, z:()=>_topLayerZ};')();
  const mk = () => ({ style: {} });
  const a = mk(), b = mk(), c = mk();
  api.bf(a); api.bf(b); api.bf(c);
  const za = +a.style.zIndex, zb = +b.style.zIndex, zc = +c.style.zIndex;
  ck(za > base, `첫 오픈 z(${za}) > 기준선(${base})`);
  ck(zb > za && zc > zb, `나중에 연 게 항상 위 (${za} < ${zb} < ${zc})`);
  ck(zc === Math.max(za, zb, zc), '마지막에 연 창이 최상단');
  api.bf(a); // 이미 열린 걸 다시 앞으로
  ck(+a.style.zIndex > zc, `다시 부르면 그게 최상단으로 (${+a.style.zIndex} > ${zc}) — 스택 위 재클릭 대응`);
  let threw = false; try { api.bf(null); api.bf(undefined); } catch (e) { threw = true; }
  ck(!threw, 'null/undefined 넣어도 안전(예외 없음)');
})();

// ── Part 2: 유저 버그 났던 핵심 오프너는 _bringToFront 유지(고정) ───────────
console.log('\n── Part 2: 핵심 오프너의 _bringToFront 유지 ──');
const OPENERS = [
  [/^function openLightbox\(/m, 'openLightbox(재생 플레이어)'],
  [/^function openMemberPanel\(/m, 'openMemberPanel(멤버 카드)'],
  [/^function openSidePanel\(/m, 'openSidePanel(데스크톱 카드)'],
  [/^function openMobSheet\(/m, 'openMobSheet(모바일 카드)'],
  [/^async function _openSongVideos\(/m, '_openSongVideos(곡→영상 오버레이)'],
  [/^function _openComboPanel\(/m, '_openComboPanel(멤버 조합)'],
];
OPENERS.forEach(([re, label]) => {
  const region = fnRegion(html, re, label);
  ck(/_bringToFront\s*\(/.test(region), `${label} 은 _bringToFront 호출을 유지`);
});
// admin.js 편집모달(vid-tag-overlay) — 재생 플레이어 위에서 열어도 맨 위여야(2곳: 쇼츠/일반)
const vtOpens = (admin.match(/vid-tag-overlay'\)\.classList\.add\('open'\)/g) || []).length;
const vtFront = (admin.match(/_bringToFront\(document\.getElementById\('vid-tag-overlay'\)\)/g) || []).length;
ck(vtOpens >= 2 && vtFront >= vtOpens, `admin 편집모달 open ${vtOpens}곳 모두 _bringToFront 동반(${vtFront})`);
// ⚠️ 형제 오버레이 함정(2026-09-02 회귀): openMobSheet은 첫 카드(mob-sheet)와 2번째+ 카드(mob-card-stack)를
// 같은 함수에서 서로 다른 분기로 연다. 첫 카드만 _bringToFront로 131+ 밴드에 올리고 스택을 정적 z(64)에
// 두면, 그룹 카드에서 멤버를 눌렀을 때 멤버 카드가 그룹 카드 뒤로 뜬다(실제 발생). 위 Part2는 함수 안에
// _bringToFront가 "하나라도" 있으면 통과라 이걸 못 잡았고, Part3 스냅샷은 이 상태를 허용목록에 얼려버려
// 놓쳤다. 그래서 여기서 **두 엘리먼트 모두** 올리는지 명시적으로 고정한다.
const _oms = fnRegion(html, /^function openMobSheet\(/m, 'openMobSheet');
ck(/_bringToFront\(mobSheetEl\)/.test(_oms), 'openMobSheet: 첫 카드(mobSheetEl)를 _bringToFront');
ck(/_bringToFront\(mobCardStackEl\)/.test(_oms), 'openMobSheet: 스택 카드(mobCardStackEl)도 _bringToFront — 멤버 카드가 그룹 카드 뒤로 안 뜨게');

// ── Part 3: 오버레이 open 지점 스냅샷 동결 ──────────────────────────────────
// 아래 SNAPSHOT = 2026-09-02 현재 "같은 줄에 _bringToFront가 없는" open 지점의 서명→개수.
// 이들 대부분은 CSS 정적 z가 이미 맞아서 괜찮은 것들(확인/토스트/시트 등). 목적은 "새로" 추가되는
// 오프너를 잡는 것: 어떤 서명이 스냅샷보다 많아지면 = 새 오버레이가 _bringToFront 없이 들어온 것 →
// 실패. 해결: 그 오프너에 _bringToFront(el)를 붙이거나(권장), 정적 z가 확실하면 여기 카운트를 올린다.
const SNAPSHOT = {
  "_flOv.classList.add('open');": 2,
  "_msEl.classList.add('open');_msEl.setAttribute('aria-hidden','false');": 1,
  "_profileOverlayEl.classList.add('open');": 1,
  "connPanelEl.classList.add('open');": 1,
  "connSheetEl.classList.add('bs-open');": 1,
  "cp.classList.add('open');": 1,
  "detail.classList.add('open');": 1,
  "document.getElementById('date-edit-overlay').classList.add('open');": 1,
  "document.getElementById('feedback-overlay').classList.add('open');": 1,
  "document.getElementById('gc-discog-detail').classList.add('open');": 1,
  "document.getElementById('lb-react-extended').classList.add('open');": 1,
  "document.getElementById('link-confirm-overlay').classList.add('open');": 1,
  "document.getElementById('logout-confirm-overlay').classList.add('open');": 1,
  "document.getElementById('pp-bias-emoji-overlay').classList.add('open');": 1,
  "document.getElementById('settings-panel').classList.add('open');": 1,
  "document.getElementById('trophy-overlay').classList.add('open');": 1,
  "document.getElementById('unfav-confirm-overlay').classList.add('open');": 1,
  "document.getElementById('welcome-choice-overlay').classList.add('open');": 1,
  "document.getElementById('welcome-login-overlay').classList.add('open');": 1,
  "el.classList.add('open');": 2,
  "else document.getElementById('welcome-choice-overlay').classList.add('open');": 1,
  "else if(mobSearch){res.classList.add('open');document.getElementById('tabbar').classList.add('has-sr');}": 1,
  "else if(obSr){res.classList.add('open');}": 2,
  "if(_keepSet){document.getElementById('settings-panel').classList.add('open');['tab-settings','dh-settings-btn'].forEach(id=>document.getElementById(id)?.classList.add('active'));}": 1,
  "if(_keepSet){document.getElementById('settings-panel').classList.add('open');document.getElementById('dh-settings-btn')?.classList.add('active');}": 1,
  "mobCardStackEl.classList.add('bs-open');": 2,
  "overlay.classList.add('open');": 4,
  "pickerWrap.classList.add('open');": 1,
  "reactionRow.classList.add('open');noteInput.style.display='';": 1,
  "requestAnimationFrame(()=>mobFilterSheetEl.classList.add('bs-open'));": 1,
  "requestAnimationFrame(()=>mobSheetEl.classList.add('bs-open'));": 1,
  "res.classList.add('open');": 1,
  "sidebar.classList.add('open');": 1,
};
console.log('\n── Part 3: 오버레이 open 스냅샷 동결 ──');
(() => {
  const re = /\.classList\.add\((?:'open'|"open"|'bs-open')\)/;
  const observed = {};
  html.split('\n').forEach(l => {
    if (re.test(l) && !/_bringToFront/.test(l)) { const s = l.trim(); observed[s] = (observed[s] || 0) + 1; }
  });
  let news = [];
  for (const sig in observed) {
    const allowed = SNAPSHOT[sig] || 0;
    if (observed[sig] > allowed) news.push(`  +${observed[sig] - allowed}: ${sig}`);
  }
  ck(news.length === 0, '새 오버레이 open 지점 없음(있으면 _bringToFront 붙이거나 SNAPSHOT 갱신)');
  if (news.length) console.log('   ↳ _bringToFront 없이 추가된 open 지점:\n' + news.join('\n'));
})();

// ── Part 4: 검색 결과 클릭이 풀스크린 검색시트(msheet)를 닫는다 ─────────────
// 안 닫으면: 카드가 시트 뒤로 뜨거나, 반쯤 남은 시트로 재검색 시 텅 빈 여백(2026-09-02 제보).
console.log('\n── Part 4: 검색 결과 클릭 → 검색시트 닫힘 ──');
(() => {
  // 영상 결과 경로
  ck(/_msIsOpen\(\)\)\s*closeMobSearchSheet\(\)/.test(html), '영상 결과 클릭 시 _msIsOpen()→closeMobSearchSheet()');
  // 카드(그룹/멤버/곡) 결과 경로 — _msIsOpen() 분기 안에서 시트를 닫는다
  ck(/_msIsOpen\(\)\)\s*\{[\s\S]{0,120}?closeMobSearchSheet\(\)/.test(html), '카드 결과 클릭 경로에도 _msIsOpen()→closeMobSearchSheet() 분기 존재');
})();

console.log(fail ? `\n✗ ${fail}건 실패` : '\n✅ 오버레이 z-순서 하네스 통과');
process.exit(fail ? 1 : 0);
