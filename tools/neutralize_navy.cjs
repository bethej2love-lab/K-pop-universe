#!/usr/bin/env node
// 남색 계열 어두운 표면색 → 중립 검정 (2026-11-12 사용자 "우주·카드·재생 화면이 남색검정이라 뿌옇다, 검정에 가깝게").
// 밝기는 유지하고 푸른 기만 뺀다 — 카드·시트·버튼 사이의 명암 단계가 그대로 남는다.
// 대상: 세 채널 다 64 이하이고 파랑이 빨강보다 6 이상 큰 색(rgba·rgb·#hex). 글자·강조색(밝은 색)은 안 건드린다.
// 결과: r=g=평균-1, b=평균+2 (아주 살짝 차가운 중립). 실행: node tools/neutralize_navy.cjs [--apply] 파일...
const fs = require('fs');
const APPLY = process.argv.includes('--apply');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const conv = (r, g, b) => {
  if (Math.max(r, g, b) > 64 || b - r < 6) return null;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 지각 밝기 유지
  const n = Math.round(L + 1.2);
  const c = v => Math.max(0, Math.min(255, v));
  return [c(n - 1), c(n - 1), c(n + 2)];
};
const hex2 = v => v.toString(16).padStart(2, '0');
let total = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8'), n = 0;
  const seen = new Map();
  s = s.replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => {
    const o = conv(+r, +g, +b); if (!o) return m;
    n++; const out = a ? `rgba(${o.join(',')}${a.replace(/\s+/g, '')})` : `rgb(${o.join(',')})`; seen.set(m, out); return out;
  });
  s = s.replace(/#([0-9a-fA-F]{6})\b/g, (m, h) => {
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const o = conv(r, g, b); if (!o) return m;
    n++; const out = '#' + o.map(hex2).join(''); seen.set(m, out); return out;
  });
  total += n;
  console.log(`${f}: ${n}곳 (${seen.size}종)`);
  [...seen].slice(0, 12).forEach(([a, b]) => console.log(`   ${a} → ${b}`));
  if (APPLY && n) fs.writeFileSync(f, s);
}
console.log(`합계 ${total}곳${APPLY ? ' · 저장' : ' · 미리보기'}`);
