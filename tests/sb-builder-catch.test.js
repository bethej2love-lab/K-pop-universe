// Supabase 쿼리 빌더에 .catch를 바로 붙이지 않았는가 (2026-09-28)
//
// 빌더(sb.from(...).select(...).eq(...)...)는 thenable일 뿐 Promise가 아니라 .catch가 없다. 붙이면 그 줄에서
// TypeError가 나고, 보통 try/catch로 감싼 선반 전체가 사라진다 — "오늘의 소식" 선반이 9/27 마일스톤 소스를
// 추가한 직후부터 이렇게 통째로 안 떴는데, 기존 feed-dailynews 테스트는 모킹이라 통과했다.
// 올바른 형태: .then(r=>r,()=>fallback) 또는 await를 try/catch로.
const fs = require('fs');
const path = require('path');
let bad = [];
for (const f of ['index.html', 'admin.js', 'shared.js']) {
  const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  // 빌더 체인 메서드 바로 뒤에 .catch( — 사이에 .then(이 없으면 빌더에 직접 붙인 것
  const re = /\.(limit|eq|neq|in|is|gte|lte|gt|lt|order|select|single|maybeSingle|range|or|not|like|ilike|contains|match|upsert|insert|update|delete)\([^()]*(?:\([^()]*\)[^()]*)*\)\s*\.catch\(/g;
  let m;
  while ((m = re.exec(src))) bad.push(`${f}:${src.slice(0, m.index).split('\n').length} — ${m[0].slice(0, 80)}`);
}
if (bad.length) { console.log('❌ 빌더에 .catch 직접 사용:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log('✅ Supabase 빌더에 .catch를 직접 붙인 곳 없음');
