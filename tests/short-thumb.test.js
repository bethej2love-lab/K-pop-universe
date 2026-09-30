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
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
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

// ② _mountShortThumb 동작 — 가짜 img로 실제 실행
const helper = fnBody('_mountShortThumb');
const run = steps => {
  if (!helper) return { img: { src: '', cls: new Set() }, bg: { style: {} }, log: [] };
  const img = { src: '', naturalWidth: 0, naturalHeight: 0, cls: new Set(), classList: { add: c => img.cls.add(c) } };
  const bg = { style: {} };
  const log = [];
  vm.runInNewContext(helper + ';_mountShortThumb(img,"VID",{bg,onReady:()=>log.push("ready"),onFail:()=>log.push("fail")});', { img, bg, log });
  for (const st of steps) {
    if (st === 'error') img.onerror && img.onerror();
    else { [img.naturalWidth, img.naturalHeight] = st; img.onload && img.onload(); }
  }
  return { img, bg, log };
};
{
  const r = run([[1080, 1920]]);
  need(/oardefault\.jpg$/.test(r.img.src) && r.log.join() === 'ready' && !r.img.cls.has('is-fallback') && /oardefault/.test(r.bg.style.backgroundImage || ''),
    '세로 원본 있음 → 그대로 표시 + 블러 배경도 세로 원본');
}
{
  const r = run([[120, 90], [480, 360]]);
  need(/hqdefault\.jpg$/.test(r.img.src) && r.img.cls.has('is-fallback') && r.log.join() === 'ready',
    '120×90 플레이스홀더 → hqdefault + .is-fallback 후 ready');
}
{
  const r = run(['error', [480, 360]]);
  need(/hqdefault\.jpg$/.test(r.img.src) && r.img.cls.has('is-fallback') && r.log.join() === 'ready', 'oardefault 404 → hqdefault 폴백');
}
{
  const r = run(['error', 'error']);
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
