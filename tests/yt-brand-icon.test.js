// YouTube API Services 감사 III.F.2a(2026-11-16): 카드 헤더의 YouTube 아이콘은 공식 모양·색(#FF0000 + 흰 삼각형), 높이 20px 이상, 변형(투명도·필터·hover 색 변화) 없음.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'kpop_universe.css'), 'utf8');
const m = /\{key:'youtube',label:'YouTube',svg:'(<svg[^']*<\/svg>)'\}/.exec(app); assert(m, '_LINK_DEFS youtube 항목을 못 찾음');
const svg = m[1];
assert(/viewBox="0 0 28\.57 20"/.test(svg), '공식 비율 28.57×20 viewBox');
assert(/fill="#FF0000"/.test(svg) && /fill="#FFFFFF"/.test(svg), '공식 색 고정(빨강+흰 삼각형)');
assert(!/currentColor|stroke=/.test(svg), '윤곽선·currentColor 금지(색을 바꿀 수 있어 규정 위반)');
const r = /\.gc-link-icon\.gc-link-icon-youtube,#tt-links \.gc-link-icon\.gc-link-icon-youtube\{width:([\d.]+)px;height:(\d+)px;\}/.exec(css); assert(r, 'YouTube 아이콘 크기 CSS');
assert(+r[2] >= 20, '높이 20px 이상'); assert(Math.abs(+r[1] / +r[2] - 28.57 / 20) < 0.01, '원본 비율 유지(찌그러뜨리지 않기)');
assert(!/gc-link-icon-youtube[^{]*\{[^}]*(opacity|filter)/.test(css), 'YouTube 아이콘에 opacity·filter 금지');
console.log('✅ YouTube 공식 아이콘: 모양·색 고정, 높이 ' + r[2] + 'px, 비율 유지, 변형 없음');
