// CHANGELOG 정리(2026-11-11 사용자 "참고하기엔 너무 많이 쌓였다" — 2.2MB·446세션, 11월만 11일에 159세션).
// 최근 KEEP_DAYS일 세션만 CHANGELOG.md에 두고, 그 전 세션은 docs/changelog/YYYY-MM.md로 **내용 그대로** 옮긴다(최신이 위).
// 옮긴 세션의 '⏳' 줄은 CHANGELOG.md 아래 '⏳ 열린 일(보관분)' 목록으로 모은다 — 끝난 건 보관 파일에서 ⏳를 ✅로 바꾸면 다음 정리 때 빠진다.
// '사용 규칙'·'DECISIONS'는 그대로 CHANGELOG.md에 남는다.
// 실행: node tools/archive_changelog.cjs [보관 기준 일수=7]   (일주일에 한 번쯤)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const MAIN = path.join(ROOT, 'CHANGELOG.md');
const ARCH = path.join(ROOT, 'docs', 'changelog');
const KEEP_DAYS = +(process.argv[2] || 7);
const OPEN_HD = '## ⏳ 열린 일(보관분)';

const src = fs.readFileSync(MAIN, 'utf8');
const nl = src.includes('\r\n') ? '\r\n' : '\n';
const text = src.replace(/\r\n/g, '\n');
// '## '로 시작하는 줄마다 자른다(첫 조각은 '# CHANGELOG' 머리)
const parts = text.split(/\n(?=## )/);
const head = parts.shift();
const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
const keep = [], special = [], moved = {};
for (const p of parts) {
  const h = p.split('\n', 1)[0];
  if (h.startsWith(OPEN_HD)) continue; // 다시 만든다
  const m = /^## (\d{4}-\d{2}-\d{2})/.exec(h);
  if (!m) { special.push(p); continue; }
  if (m[1] >= cutoff) keep.push(p);
  else (moved[m[1].slice(0, 7)] = moved[m[1].slice(0, 7)] || []).push(p);
}
const byDateDesc = (a, b) => b.slice(3, 13).localeCompare(a.slice(3, 13)); // 같은 날은 원래 순서 유지(sort는 안정 정렬)
fs.mkdirSync(ARCH, { recursive: true });
let nMoved = 0;
for (const [ym, list] of Object.entries(moved)) {
  const f = path.join(ARCH, `${ym}.md`);
  let old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : `# CHANGELOG 보관 — ${ym}\n\n최근 세션은 저장소 루트 CHANGELOG.md. 이 파일은 tools/archive_changelog.cjs가 옮긴 것(내용 그대로, 최신이 위).\n`;
  const oParts = old.split(/\n(?=## )/); const oHead = oParts.shift();
  const all = [...list, ...oParts].sort(byDateDesc);
  fs.writeFileSync(f, (oHead.trimEnd() + '\n\n' + all.map(s => s.trimEnd()).join('\n\n') + '\n').replace(/\n/g, nl));
  nMoved += list.length;
}
// 보관 파일 전체에서 아직 ⏳인 줄 모으기
const open = [];
for (const f of fs.readdirSync(ARCH).filter(x => /^\d{4}-\d{2}\.md$/.test(x)).sort().reverse()) {
  const t = fs.readFileSync(path.join(ARCH, f), 'utf8').replace(/\r\n/g, '\n');
  let cur = '', block = false; // block: '### ⏳ 덜 된 일' 같은 제목 줄 아래 목록
  for (const line of t.split('\n')) {
    if (line.startsWith('## ')) { cur = line.slice(3).trim(); block = false; continue; }
    if (/^#{3,}/.test(line)) { block = line.includes('⏳'); continue; }
    if (block && !line.trim()) { block = false; continue; }
    if (line.includes('⏳') || (block && /^\s*[-*\d]/.test(line))) {
      const s = line.replace(/^\s*(?:-|\*|\d+\.)\s*/, '').trim();
      if (/^(\[(완료|해소[^\]]*|취소|폐기)\]|✅|~~)/.test(s)) continue; // 이미 끝난 줄
      open.push(`- ${cur.slice(0, 10)} · ${cur.slice(11).replace(/^\(|\)$/g, '').slice(0, 50)} — ${s.length > 220 ? s.slice(0, 220) + '…' : s} ([보관](docs/changelog/${f}))`);
    }
  }
}
const openSec = `${OPEN_HD}\n- 보관 파일(docs/changelog/)에 남은 '⏳' 줄 ${open.length}개 — 오래된 건 이미 끝났을 수 있으니 확인 후 처리. 끝냈으면 **보관 파일의 그 줄 ⏳를 ✅로** 바꾸면 다음 정리 때 여기서 빠진다.\n${open.join('\n')}`;
const headOut = head.trimEnd().includes('docs/changelog') ? head.trimEnd()
  : head.trimEnd() + `\n\n> 최근 ${KEEP_DAYS}일 세션만 여기 있다. 그 전은 [docs/changelog/](docs/changelog/)에 월별로(내용 그대로), 남은 ⏳는 맨 아래 '⏳ 열린 일(보관분)'. 정리: \`node tools/archive_changelog.cjs\`. 사용 규칙·DECISIONS도 맨 아래.`;
const out = [headOut, ...keep.map(s => s.trimEnd()), ...special.map(s => s.trimEnd()), openSec].join('\n\n') + '\n';
fs.writeFileSync(MAIN, out.replace(/\n/g, nl));
console.log(`CHANGELOG: 최근 ${keep.length}세션 유지(${cutoff}~) · ${nMoved}세션 보관(${Object.keys(moved).sort().join(', ') || '-'}) · 열린 ⏳ ${open.length}줄 · ${(Buffer.byteLength(src) / 1024).toFixed(0)}KB → ${(Buffer.byteLength(out) / 1024).toFixed(0)}KB`);
