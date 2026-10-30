// 인스타 뷰어 사진별 글·틀 비율 + 수집기 장 수/본문 길이 (2026-10-30 사용자 "사진마다 글인데 우두두 나열", "가로 사진은 가운데")
//  ① 수집기: 캐러셀 20장(인스타 최대)·본문 2,200자(인스타 최대) — 10장/600자에서 잘라 장원영 20장 게시물이 10장만 보였다
//  ② 뷰어: 문단 수 === 사진 수일 때만 장별 글, 아니면 전체 / 여러 장이면 첫 장 비율 틀(igv-framed)
//  ③ CSS: 모바일·좁은 무대에서 틀 고정 + 사진 가운데
// 실제 화면 동작은 헤드리스로 확인(390px: 틀 517px 고정, 가로 사진 위아래 129px씩 가운데).
// 실행: node tests/ig-viewer-percap.test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const col = fs.readFileSync(path.join(ROOT, 'tools/ig_business_discovery.mjs'), 'utf8');
const app = require('../tools/index_source.cjs').readIndexSource();
const css = fs.readFileSync(path.join(ROOT, 'kpop_universe.css'), 'utf8');
let fail = 0;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };

need(/o\.c = cs\.slice\(0, 20\)/.test(col), '수집기: 캐러셀 사진 20장까지');
need(/o\.cap = String\(m\.caption\)\.slice\(0, 2200\)/.test(col), '수집기: 본문 2,200자까지');
need(/per:pics\.length>1&&paras\.length===pics\.length\?paras:null/.test(app), '뷰어: 문단 수=사진 수일 때만 사진별 글');
need(/_igv\.per&&!_igv\.full\?_igv\.per\[i\]:\(_igv\.m\.cap\|\|''\)/.test(app), '뷰어: 지금 장 문단 / 전체 보기 토글');
need(/md\.classList\.add\('igv-framed'\)/.test(app) && /naturalHeight\/f\.naturalWidth,0\.52\),1\.34/.test(app), '뷰어: 첫 장 비율 틀(1.91:1~3:4)');
need(/#igv-media\.igv-framed\{width:100%;aspect-ratio:1 \/ var\(--igv-ar\);max-height:62dvh;\}/.test(css), 'CSS 모바일: 틀 고정');
need(/#igv-overlay\.igv-narrow #igv-media\.igv-framed\{/.test(css), 'CSS 좁은 무대: 틀 고정');

// 문단 나누기 실제 동작(빈 줄 기준, 공백만 있는 줄도 빈 줄)
const split = s => String(s || '').split(/\n[ \t]*\n/).map(x => x.trim()).filter(Boolean);
need(split('a\n\nb\n \nc').length === 3 && split('한 줄\n이어지는 줄').length === 1, '문단 나누기: 빈 줄 기준, 줄바꿈 하나는 같은 문단');

console.log(fail ? `\n❌ ${fail}개 실패` : '\n✅ 인스타 뷰어 사진별 글 테스트 통과');
process.exit(fail ? 1 : 0);
