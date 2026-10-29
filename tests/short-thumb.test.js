// 쇼츠 썸네일 표시 — 단일 경로 + 폴백 동작 회귀 테스트 (2026-09-30)
//
// 배경(사용자 제보 "쇼츠인데 세로 틀에 세로 사진이 작게 가운데, 나머지는 모자이크"):
// 유튜브가 쇼츠 일부에 세로 원본 썸네일(oardefault)을 안 준다. 그때 쓰는 가로 썸네일은 이미
// "세로 화면 + 좌우 검은 띠"라, 세로 틀에 contain으로 넣으면 작은 그림이 블러 배경 가운데 갇힌다.
// 실측(헤드리스 390px, 아홉 카드): 수정 전 164×291 틀에 164×92로 그려진 쇼츠 22건.
//
// 근본 원인은 **같은 로직이 세 곳에 복붙**돼 폴백 처리가 서로 달랐던 것(그룹/멤버 카드 그리드·모아보기
// 목록은 contain, 탐험 피드는 cover). 한 곳을 고쳐도 나머지에서 같은 증상이 났다. 그래서:
//  ① 표시용 oardefault URL은 _mountShortThumb 한 곳에서만 만든다(프로브 함수 3개는 판정용이라 예외)
//  ② _mountShortThumb 동작: 120×90 플레이스홀더/404 → hqdefault + .is-fallback, 그것도 실패 → onFail
//  ③ 폴백 이미지는 CSS에서 cover(9:16 틀이 가운데 세로 화면만 정확히 잘라낸다)
//  ④ 브라우저 프로브가 "세로 원본 없음(120×90)"을 "가로"로 판정하지 않는다 — 서버(/shorts/ HEAD)가 확정한
//     쇼츠를 강등해 가로 틀에 가두던 경로
//
// 실행: node tests/short-thumb.test.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = require('../tools/index_source.cjs').readIndexSource();
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => (c ? ok(m) : bad(m));

const fnBody = name => {
  const i = html.indexOf('function ' + name + '(');
  if (i < 0) return '';
  let d = 0;
  for (let j = html.indexOf('{', i); j < html.length; j++) {
    if (html[j] === '{') d++;
    else if (html[j] === '}') { d--; if (!d) return html.slice(i, j + 1); }
  }
  return '';
};

// ① oardefault URL을 만드는 곳 전수 — 허용된 함수 안에 있어야 한다
const ALLOWED = ['_mountShortThumb', '_thumbIsVertical', '_probeIsPortrait', '_probeAspect'];
const bodies = ALLOWED.map(n => [n, fnBody(n)]);
bodies.forEach(([n, b]) => need(b, `${n} 함수 존재`));
const re = /\.src\s*=\s*`[^`]*oardefault\.jpg`/g;
let m, stray = [];
while ((m = re.exec(html))) {
  const inside = bodies.some(([, b]) => { const s = html.indexOf(b); return b && m.index >= s && m.index < s + b.length; });
  if (!inside) stray.push(html.slice(0, m.index).split('\n').length);
}
need(!stray.length, `표시용 oardefault URL은 _mountShortThumb에서만 만든다${stray.length ? ` — 밖에서 만든 줄: ${stray.join(', ')}` : ''}`);
need(!/_shortThumbFallback/.test(html), '옛 부분 헬퍼(_shortThumbFallback) 잔재 없음');
const uses = (html.match(/_mountShortThumb\(/g) || []).length - 1;
need(uses >= 3, `_mountShortThumb 호출 ${uses}곳(그리드·모아보기·탐험 피드)`);

// 큰 세로 원본(1080×1920)은 카드 크기로 줄여 다시 끼운다 — 아이폰이 큰 그림 수십 장을 버려 블러 배경만 남던 것(2026-10-27)
need(/_shortThumbShrink\(big,img/.test(fnBody('_mountShortThumb')||'') && !!fnBody('_shortThumbShrink'), '세로 원본은 카드 크기로 축소(_shortThumbShrink)');
// 큰 원본은 화면 img에 붙이지 않고 화면 밖 Image로만 받는다 + 동시 2장 제한(2026-10-30 5번째 재발 "위쪽 모자이크·아래 뿌옇다 짠" —
// 원본을 먼저 띄우고 같은 걸 또 받아 축소본으로 갈아끼우던 게 메모리를 두 배로 튀게 했다)
{
  const b = fnBody('_mountShortThumb') || '';
  need(/new Image\(\)/.test(b) && /_shortThumbQueue\(/.test(b) && !/img\.src\s*=\s*`[^`]*oar/.test(b) && !/_shrinkShortThumb/.test(html), '큰 세로 원본은 화면 밖 Image로만 받고 줄 세워 처리');
  need(/\.decode\(/.test(b) && /setTimeout\(setBg/.test(b), '다 펼친 뒤 표시 + 블러 배경은 페이드 끝난 뒤(뿌옇다 짠 방지)');
}

// ② _mountShortThumb 동작 — 가짜 img로 실제 실행
const helper = fnBody('_mountShortThumb');
const run = steps => {
  if (!helper) return { img: { src: '', cls: new Set() }, bg: { style: {} }, log: [] };
  // decode()는 바로 끝난 것으로(동기 thenable) — 결과를 같은 틱에 검사하려고
  const img = { src: '', naturalWidth: 0, naturalHeight: 0, cls: new Set(), classList: { add: c => img.cls.add(c) }, dataset: {}, getAttribute: a => (a === 'src' && img.src) || null, decode: () => ({ then: f => f() }) };
  const bg = { style: {} };
  const log = [], bigs = [];
  class FakeImage { constructor() { bigs.push(this); this.src = ''; } }
  vm.runInNewContext(helper + ';_mountShortThumb(img,"VID",{bg,onReady:()=>log.push("ready"),onFail:()=>log.push("fail")});', {
    img, bg, log, Image: FakeImage, Promise, setTimeout: f => f(),
    _shortThumbWatch: () => {}, _shortThumbWhenNear: (el, f) => f(), _shortThumbQueue: job => job(() => {}), _shortThumbShrink: (b, i, cb) => cb(null),
  });
  // 화면 img에 아직 아무것도 안 붙었으면 화면 밖 Image(큰 원본 프로브) 단계, 붙었으면 화면 img 단계
  let loadedSrc = '';
  steps.forEach((st, i) => {
    const big = !img.src && bigs[bigs.length - 1];
    const t = big || img;
    if (st === 'error') t.onerror && t.onerror();
    // 화면 밖이라 감시가 src를 뗌 — 사파리는 이때 error를 쏜다
    else if (st === 'unload') { img.src = ''; img.onerror && img.onerror(); }
    else { [t.naturalWidth, t.naturalHeight] = st; t.onload && t.onload(); }
    // 화면 img에 주소가 막 붙었으면 다음 단계가 error가 아닌 한 정상 로드
    if (img.src && img.src !== loadedSrc && steps[i + 1] !== 'error') { loadedSrc = img.src; img.onload && img.onload(); }
  });
  return { img, bg, log, bigs };
};
{
  const r = run([[1080, 1920]]);
  need(/oardefault\.jpg$/.test(r.img.src) && r.log.join() === 'ready' && !r.img.cls.has('is-fallback') && /mqdefault/.test(r.bg.style.backgroundImage || ''),
    '세로 원본 있음 → 그대로 표시 + 블러 배경은 작은 썸네일(큰 그림 두 장이면 아이폰이 앞 그림을 버림, 2026-10-23)');
}
// 2026-10-22: 세로 원본이 없으면 hqdefault 전에 oar2(1080×1920 세로 프레임) — hqdefault를 9:16로 키우면 뿌옇다
{
  const r = run([[120, 90], [1080, 1920]]);
  need(/oar2\.jpg$/.test(r.img.src) && !r.img.cls.has('is-fallback') && r.log.join() === 'ready',
    '120×90 플레이스홀더 → oar2(세로 프레임) 후 ready');
}
{
  const r = run(['error', [1080, 1920]]);
  need(/oar2\.jpg$/.test(r.img.src) && !r.img.cls.has('is-fallback') && r.log.join() === 'ready', 'oardefault 404 → oar2');
}
{
  const r = run(['error', 'error', [480, 360]]);
  need(/hqdefault\.jpg$/.test(r.img.src) && r.img.cls.has('is-fallback') && r.log.join() === 'ready', 'oardefault·oar2 둘 다 없음 → hqdefault 폴백');
}
{
  const r = run([[120, 90], [120, 90], [480, 360]]);
  need(/hqdefault\.jpg$/.test(r.img.src) && r.img.cls.has('is-fallback') && r.log.join() === 'ready', '둘 다 플레이스홀더 → hqdefault 폴백');
}
// 2026-10-26: 사파리는 src를 떼면 error를 쏜다 — 그걸 실패로 받아 그림을 지우면 블러 배경만 남아 뿌옇게 굳었다
{
  const r = run([[1080, 1920], 'unload']);
  need(r.log.join() === 'ready', '뜬 뒤 화면 밖에서 src 뗄 때 error → onFail 안 부름(그림 유지)');
}
{
  const r = run([[1080, 1920], [1080, 1920], 'error']) // 프로브 로드 → 화면 로드 → 나중 error;
  need(r.log.join() === 'ready', '한 번 뜬 그림은 이후 error로 지우지 않음');
}
{
  const r = run(['error', 'error', 'error']);
  need(r.log.join() === 'fail', '폴백까지 실패 → onFail(아이콘 폴백 등 호출부 처리)');
}

// ③ 폴백 이미지는 cover
need(/\.gc-ch-item\.is-short \.gc-ch-thumb\.is-fallback\{[^}]*object-fit:cover/.test(css), '그리드 폴백 쇼츠 썸네일 object-fit:cover');
need(/\.feed-card\.is-short \.feed-card-thumb\{[^}]*object-fit:cover/.test(css), '탐험 피드 쇼츠 썸네일 object-fit:cover');

// ④ 강등 프로브: 120×90 → unknown
{
  const probe = fnBody('_probeAspect');
  const res = [];
  // 가짜 Image — 생성된 인스턴스를 잡아 onload를 직접 부른다
  const ctx2 = { setTimeout: () => {}, out: res, last: null };
  ctx2.Image = class { constructor() { ctx2.last = this; } };
  vm.runInNewContext(probe + ';_probeAspect("x").then(r=>out.push(r));last.naturalWidth=120;last.naturalHeight=90;last.onload();', ctx2);
  const ctx3 = { setTimeout: () => {}, out: res, last: null };
  ctx3.Image = class { constructor() { ctx3.last = this; } };
  vm.runInNewContext(probe + ';_probeAspect("y").then(r=>out.push("y:"+r));last.naturalWidth=1280;last.naturalHeight=720;last.onload();', ctx3);
  setTimeout(() => {
    need(res.includes('unknown'), '120×90 플레이스홀더 → unknown(쇼츠를 가로로 강등하지 않음)');
    need(res.includes('y:landscape'), '실제 가로 원본 → landscape(진짜 가로는 강등)');
    console.log(pass ? '\n✅ 쇼츠 썸네일 테스트 통과' : '\n❌ 실패 있음');
    process.exit(pass ? 0 : 1);
  }, 50);
}
