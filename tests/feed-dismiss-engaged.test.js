// 탐험 패널: 한 번 쓴 뒤에는 배경 탭으로 닫히지 않는다 (2026-09-16 신설)
//
// 증상(사용자 제보): "처음에 탐험 패널에서 영상 보고 배경 탭하면 탐험 패널이 아예 꺼진다.
// 다시 켜고는 괜찮은 것 같은데 처음만 문제인가?"
//
// 원인이 두 겹이었다:
//  ① `_obActive`(자동 열림 온보딩 상태)가 주석대로 "아직 아무 상호작용도 없었음"을 뜻하는데 실제로는
//     패널을 스크롤하고 영상을 열어도 해제되지 않았다 → `_obEngaged()` 신설로 해제.
//  ② ①만 고쳐도 패널은 계속 닫혔다(헤드리스 실측). **진범은 온보딩이 아니라**
//     `window pointerdown → closePanels() → _closeFeedOverlay()` 경로였다. closePanels가 탐험 패널을
//     무조건 닫기 때문. → 배경 탭 경로에서만 `{keepFeed:_feedEngaged}`로 예외를 준다.
//
// "다시 켜면 괜찮다"의 정체: 수동으로 열면 **전체 펼침**이라 탭할 배경이 없고, 자동 열림은 peek(반열림)이라
// 배경이 보인다. 그래서 같은 버그가 첫 회차에만 드러났다.
//
// 지켜야 하는 두 방향:
//   · 썼으면(영상 열기·스크롤) 배경 탭으로 안 닫힌다
//   · 안 썼으면 예전처럼 배경 탭으로 사라진다(관심 없으면 사라진다는 원래 설계)
//
// 실행: node tests/feed-dismiss-engaged.test.js

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
const need = (c, m, d) => { if (c) { pass++; console.log(`✅ ${m}`); } else { fail++; console.log(`❌ ${m}`); if (d) console.log('   ' + d); } };

// ── ① 사용 시 온보딩 수명 종료 ────────────────────────────────────────────────
need(/function _obEngaged\(\)\{[\s\S]{0,200}_obActive=false;[\s\S]{0,80}_feedEngaged=true;/.test(src),
  '_obEngaged가 _obActive와 _feedEngaged를 함께 처리');
need(/closest\('#feed-overlay,#tab-feed,#dh-feed-btn,#gc-totop,#yt-lightbox,#msheet'\)\)\{_obEngaged\(\);return;\}/.test(src),
  '패널·라이트박스를 건드리면 return이 아니라 _obEngaged()를 부른다(예전엔 그냥 return이라 무장이 유지됐다)');
// ⚠️ _OB_KEY는 "검색바 글라스 힌트를 본 적 있는지"만 뜻한다 — 패널을 썼다고 같이 찍으면 힌트가 조용히 사라진다.
// (정규식으로 범위를 어림하면 바로 뒤 _dismissOnboardHint의 _OB_KEY를 잘못 집는다 — 본문만 잘라서 본다)
function bodyOf(name) {
  const m = new RegExp('function ' + name + '\\([^)]*\\)\\s*\\{').exec(src);
  if (!m) return '';
  let i = src.indexOf('{', m.index), d = 0;
  for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (!d) { i++; break; } } }
  return src.slice(m.index, i);
}
need(!/_OB_KEY/.test(bodyOf('_obEngaged')),
  '_obEngaged는 _OB_KEY를 건드리지 않는다(검색바 힌트와 별개)');

// ── ② 배경 탭 경로에만 예외 ──────────────────────────────────────────────────
need(/function closePanels\(opt\)\{/.test(src), 'closePanels가 opt를 받는다');
need(/if\(!\(opt&&opt\.keepFeed\)\)_closeFeedOverlay\(\);/.test(src),
  'closePanels는 keepFeed일 때만 탐험 패널을 남긴다');
need(/closePanels\(\{keepFeed:_feedEngaged\}\);_dismissOnboardHint\(\);/.test(src),
  '배경 탭(window pointerdown)만 keepFeed를 넘긴다');
// 명시적으로 닫는 경로(탭바 홈·랜덤탐험 등)는 인수 없이 부르므로 동작이 그대로여야 한다
const bare = (src.match(/closePanels\(\)/g) || []).length;
need(bare >= 3, `명시적 닫기 경로는 인수 없이 closePanels() 호출 유지 (${bare}곳)`);

// ── ③ 패널이 닫히면 표식을 되돌린다 ─────────────────────────────────────────
// 안 되돌리면 한 번 쓴 뒤로 **영구히** 배경 탭에 안 닫혀서, "관심 없으면 사라진다"는 설계가 깨진다.
need(/function _closeFeedOverlay\(returning\)\{[\s\S]{0,400}?_feedEngaged=false;/.test(src),
  '_closeFeedOverlay가 _feedEngaged를 되돌린다');

console.log(`\n${pass}/${pass + fail} 통과${fail ? `, ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
