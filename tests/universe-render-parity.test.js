// 우주 렌더 브라우저 일관성·행성 비침 회귀 가드 (2026-10-12 신설)
//
// 배경: 캔버스가 투명이고 별·헤일로가 additive(알파 안 씀)라 "색 > 알파" 픽셀이 화면의 ~26%였다(헤드리스 실측
// 1,600점 중 416). premultiplied 합성에서 정의되지 않은 값이라 사파리/크롬이 다르게 그렸고(사파리: 빈 공간 솔로
// 별 소실), 그걸 메우려던 10-11 패치(writeAlpha·밝기하한 0.55·camDist 기준 변경)가 크롬에선 우주를 뿌옇게,
// 행성을 더 투명하게 만들었다. 이 테스트는 그 구조를 동결한다.
//
// 실행: node tests/universe-render-parity.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'kpop_universe.css'), 'utf8');
let fail = 0;
const ck = (c, msg) => { console.log((c ? '✓ ' : '✗ 실패: ') + msg); if (!c) fail++; };

console.log('\n── 우주 렌더 일관성 ──');
// ① 불투명 배경
ck(/scene\.background=_buildUniverseBg\(\);/.test(html), '씬 배경을 불투명 그라데이션으로 채움(투명 캔버스 합성 차이 제거)');
const resize = /window\.addEventListener\('resize',\(\)=>\{[\s\S]{0,400}?\},150\);/.exec(html);
ck(!!resize && /_buildUniverseBg\(\)/.test(resize[0]), '리사이즈 때 배경을 다시 그림(그라데이션이 화면비에 묶임)');
// ② 배경 그라데이션 = CSS body 배경(캔버스를 숨겨도 이음매 없게)
const stopsM = /const _UNI_BG_STOPS=(\[[^;]+\]);/.exec(html);
const stops = stopsM ? JSON.parse(stopsM[1].replace(/'/g, '"')) : [];
const bodyM = /body\{\s*background:radial-gradient\(ellipse at 50% 38%,([\s\S]*?)\);/.exec(css);
const cssStops = bodyM ? [...bodyM[1].matchAll(/(#[0-9a-f]{6})\s+(\d+)%/gi)].map(m => [+m[2] / 100, m[1].toLowerCase()]) : [];
ck(stops.length > 0 && JSON.stringify(stops.map(([o, c]) => [o, c.toLowerCase()])) === JSON.stringify(cssStops),
  `캔버스 배경 색 정지점이 CSS body 그라데이션과 같음 (JS ${JSON.stringify(stops)} / CSS ${JSON.stringify(cssStops)})`);
// ③ 투명 PNG 캡처는 배경을 빼고 그림
ck((html.match(/_snapRender\(snapCam\)/g) || []).length === 2 && !/renderer\.render\(scene,snapCam\)/.test(html),
  '캡처 2곳 모두 _snapRender(배경 제외)로 그림');
// ④ 걷어낸 임시 처방이 돌아오지 않게
ck(!/writeAlpha/.test(html.replace(/\/\/[^\n]*/g, '')), '솔로 별 writeAlpha(알파 기록) 분기 없음 — 불투명 배경이라 불필요');
ck(!/Math\.max\(ptsOpMult,0\.55\)/.test(html), '솔로 별 밝기 하한 0.55 없음 — 크롬에서 우주 전체를 뿌옇게 만든 원인');
ck(/const camDist=camera\.position\.length\(\);/.test(html), '줌 거리는 원점 기준 — 오빗 타깃 기준이면 행성에 다가갈수록 투명해짐(비침 회귀)');
// ⑤ 점 크기 DPR 이중 곱 금지 — three r128이 size에 pixelRatio를 이미 곱한다(데스크톱 레티나에서 별·헤일로 2배 = 뿌연 우주)
ck(/size:sizeW\*\(isMob\(\)\?Math\.min\(window\.devicePixelRatio,2\):1\)/.test(html),
  '데스크톱 점 크기에 DPR을 또 곱하지 않음(어느 화면이든 같은 CSS 크기)');
// ⑥ 포커스 행성 차폐막
ck(/colorWrite:false,depthWrite:true,side:THREE\.BackSide/.test(html), '행성 뒷면만 depth에 쓰는 차폐 재질 존재');
ck(/occ\.scale\.setScalar\(1\.01\)/.test(html), '차폐막이 행성보다 살짝 큼(같은 깊이면 z-fighting 얼룩)');
ck(/occ\.raycast=\(\)=>\{\}/.test(html), '차폐막은 클릭 판정 제외');
ck(/occ\.visible=!!\(focusGroupKo&&GROUPS\[focusGroupKo\]\)&&mesh\._focusTarget>0\.8/.test(html),
  '차폐막은 실제 그룹 포커스일 때만(솔로 카드에서 전 행성 차폐 방지)');

// ⑦ 솔로 카드 포커스(2026-10-12) — 그룹 카드처럼 나머지를 흐리게. '솔로' placeholder로 비교하면 모든 솔로 별이 같이 밝아진다.
const sfM = /^function setFocus\(groupKo, extra=\[\], soloArtist=null\)\{[\s\S]*?\n\}/m.exec(html);
const sf = sfM ? sfM[0] : '';
ck(/if\(GROUPS\[groupKo\]\|\|soloArtist\)\{/.test(sf), '솔로 카드도 행성 딤');
ck(/const artKos=allKos\.filter\(k=>GROUPS\[k\]\);/.test(sf) && /artKos\.includes\(g\.ko\)/.test(sf), "별 딤 비교에서 '솔로' placeholder 제외");
ck(/_focusSoloArtist=soloArtist;/.test(sf) && (html.match(/setFocus\(focusGroupKo,\[\.\.\._extraFocusKos\],_focusSoloArtist\)/g) || []).length === 2,
  '재호출(필터 닫기·내 우주 해제)도 솔로 주인공을 유지');

console.log(`\n${fail === 0 ? '✅' : '❌'} ${fail} 실패`);
process.exit(fail ? 1 : 0);
