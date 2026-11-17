// awards/*.json(시상식 수집분) → awards/events.json — 앱 '이번 주 소식'이 읽는 작은 목록(2026-11-17).
// 왜: 전체 색인(awards/index.json)은 487KB라 앱이 못 읽는다. 앱은 이 파일(수 KB)로 '최근 며칠 안에 열린 시상식'만 찾고, 눌렀을 때만 그 시상식 파일 하나(~7KB)를 받는다.
// 쓰는 법: 시상식 수집 파일(awards/{id}-{edition}.json)을 추가·고치면 `node tools/build_awards_events.mjs` 를 다시 돌려 events.json을 커밋한다.
// 날짜가 'YYYY-MM-DD'가 아닌 회차(예: sma-2026 "2026")는 '이번 주' 판정을 못 하므로 뺀다. 2년 넘은 회차는 빼서 파일을 작게 유지.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'awards');
const YEAR_MIN = new Date().getFullYear() - 1;
const full = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const events = [];
for (const f of fs.readdirSync(DIR).filter(x => /^[a-z0-9]+-\d{4}\.json$/.test(x)).sort()) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (!j.id || !j.edition || +j.edition < YEAR_MIN) continue;
  const ds = (j.dates || []).filter(full).sort();
  if (!ds.length) continue;
  const compact = s => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  // 영상 제목 검색 키워드(title_norm에 ilike) — '[#MMA2026]'·'2026 MMA'·'멜론뮤직어워드' 꼴. 너무 짧거나 흔하면 오검색이라 id+연도 결합형을 우선.
  const kw = [...new Set([compact(j.id + j.edition), compact(j.edition + j.id), compact(j.name)].filter(x => x.length >= 5))];
  const top = (j.categories || []).filter(c => c.tier === '대상').slice(0, 6).map(c => ({ ko: c.ko, en: c.en || c.ko, names: (c.winners || []).map(w => w.name).filter(Boolean).slice(0, 3) }));
  events.push({ id: j.id, edition: String(j.edition), no: j.no || null, name: j.name || '', nameEn: j.nameEn || j.name || '', start: ds[0], end: ds[ds.length - 1], venue: j.venue || '', kw, n: (j.categories || []).length, top });
}
events.sort((a, b) => (a.end < b.end ? 1 : -1));
const out = { built: new Date().toISOString().slice(0, 10), events };
fs.writeFileSync(path.join(DIR, 'events.json'), JSON.stringify(out) + '\n');
console.log('awards/events.json —', events.length + '개 회차,', fs.statSync(path.join(DIR, 'events.json')).size + 'B');
events.slice(0, 5).forEach(e => console.log(' ', e.end, e.id, e.edition, e.name, '| 대상', e.top.length + '개 | kw', e.kw.join(',')));
