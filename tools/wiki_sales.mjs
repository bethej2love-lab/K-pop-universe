// 앨범 초동(first-week)·총판매 수집 — 개별 앨범 위키 문서 프로즈에서 추출 (2026-09-05).
// 상위 그룹의 groups.json 디스코그래피 앨범을 위키 문서로 열어 초동/총판매를 긁는다.
// 실행: node tools/wiki_sales.mjs --group 트와이스 | --top   (상위그룹 전체 → sales_raw.json)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const UA = 'kpopuniverse-tourbot/1.0 (before0hwa@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';
const get = url => { for (let t = 0; t < 5; t++) { try { execFileSync('sleep', ['0.5']); } catch (_) {} try { const b = execFileSync('curl', ['-sk', '-m', '40', '-A', UA, url + (url.includes('?') ? '&' : '?') + 'maxlag=5'], { maxBuffer: 1 << 28, encoding: 'utf8' }); if (/^You are making too many/i.test(b.slice(0, 30))) { execFileSync('sleep', ['5']); continue; } return JSON.parse(b); } catch (e) { try { execFileSync('sleep', ['3']); } catch (_) {} } } return null; };
const wikitext = title => { const j = get(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`); return j?.parse?.wikitext || ''; };
const exists = title => { const j = get(`${API}?action=query&titles=${encodeURIComponent(title)}&format=json&formatversion=2`); const p = j?.query?.pages?.[0]; return p && !p.missing ? p.title : null; };

// KMCA/써클 인증(Million/Platinum/Gold) 추출 — 구조화 템플릿이라 정확. South Korea 인증만.
const AWARD_KO = { million: '밀리언', platinum: '플래티넘', gold: '골드' };
function extractSales(wt, groupEn) {
  if (!wt) return null;
  const certs = wt.match(/\{\{Certification Table Entry[^{}]*\}\}/gi) || [];
  let best = null; // 최고 등급(밀리언>N배플래티넘>플래티넘>골드)
  const rank = a => /million/i.test(a) ? 400 + (parseInt(a) || 1) : /platinum/i.test(a) ? 200 + (parseInt(a) || 1) : /gold/i.test(a) ? 100 : 0;
  for (const c of certs) {
    if (!/region\s*=\s*South Korea/i.test(c)) continue;
    const aw = (c.match(/award\s*=\s*([^|}]+)/i) || [])[1];
    if (!aw) continue;
    const award = aw.trim();
    const year = (c.match(/certyear\s*=\s*(\d{4})/i) || [])[1] || '';
    if (!best || rank(award) > rank(best.award)) best = { award, year };
  }
  if (!best) return null;
  const kind = /million/i.test(best.award) ? 'million' : /platinum/i.test(best.award) ? 'platinum' : 'gold';
  return { award: best.award, awardKo: AWARD_KO[kind], million: kind === 'million', year: best.year };
}
// 앨범 제목 → 위키 문서. 대소문자·스타일·괄호 변형이 많아 검색 API로 후보를 찾고 제목 매칭.
function resolveAlbum(title, groupEn) {
  const g = groupEn.replace(/\s*\(.*\)$/, '');
  const norm = s => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const nt = norm(title);
  const j = get(`${API}?action=query&list=search&srsearch=${encodeURIComponent(`${title} ${g}`)}&srlimit=6&srnamespace=0&format=json&formatversion=2`);
  const hits = (j?.query?.search || []).map(h => h.title);
  // 제목이 앨범명과 일치(괄호 앞부분)하고 앨범/EP스러운 문서 우선
  const base = t => norm(t.replace(/\s*\(.*\)$/, ''));
  let cand = hits.find(t => base(t) === nt && /\((.*(album|ep|single).*)?\)/i.test(t))
    || hits.find(t => base(t) === nt)
    || hits.find(t => base(t).startsWith(nt) && nt.length >= 4);
  return cand || null;
}

const TOP = ['방탄소년단', '세븐틴', '스트레이키즈', '엑소', '트와이스', '블랙핑크', '에스파', '엔시티 127', '엔시티 드림', '뉴진스', '아이브', '르세라핌', '있지', '투모로우바이투게더', '엔하이픈', '레드벨벳', '(여자)아이들', '슈퍼주니어', '소녀시대', '갓세븐', '몬스타엑스', '마마무', '샤이니', '데이식스', '에이티즈', '빅뱅', '2NE1', '워너원'];

function collectGroup(ko, G) {
  const en = G[ko]?.en; if (!en) return [];
  const disco = (G[ko]?.discography || []).filter(d => /정규|미니|규|EP|studio|mini/i.test(d.type || '') || (d.tracks || []).length >= 4);
  const out = [];
  for (const d of disco) {
    const title = d.title; if (!title) continue;
    const art = resolveAlbum(title, en); if (!art) continue;
    const s = extractSales(wikitext(art), en); if (s) out.push({ title, article: art, ...s });
  }
  return out;
}

if (argv.includes('--group')) {
  const ko = argv[argv.indexOf('--group') + 1];
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const s = collectGroup(ko, G);
  console.log(`[${ko}] 인증 ${s.length}개 (밀리언 ${s.filter(x => x.million).length})`);
  s.forEach(x => console.log(`  ${x.title}: ${x.award}${x.year ? ' (' + x.year + ')' : ''}`));
  process.exit(0);
}
if (argv.includes('--top')) {
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const out = {}; let gi = 0, tot = 0;
  for (const ko of TOP) {
    gi++; if (!G[ko]) { process.stderr.write(`\r[${gi}/${TOP.length}] ${ko} 없음`); continue; }
    const s = collectGroup(ko, G);
    if (s.length) { out[ko] = s; tot += s.length; }
    process.stderr.write(`\r[${gi}/${TOP.length}] ${ko} · 누적 ${tot}    `);
  }
  fs.writeFileSync('/tmp/sales_raw.json', JSON.stringify(out));
  console.log(`\n\n완료 — ${Object.keys(out).length}그룹 · ${tot}앨범 → /tmp/sales_raw.json`);
  process.exit(0);
}
console.log('사용: --group 한글명 | --top');
