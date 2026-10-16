// 투어 흥행(관객 수·매출·공연 횟수) 수집 — 영문 위키 투어 문서의 {{Infobox concert}} 요약값 (2026-10-16 신설)
//
// 왜: 빌보드 Boxscore는 유료·재사용 제한이라 직접 못 긁는다. 그런데 위키 투어 문서 인포박스의 attendance·box office는
//     대부분 Boxscore/주최사 발표를 출처로 단 공개 수치다. 그걸 그룹별로 모아 "투어 성과 비교"의 재료로 쓴다.
//     (사용자 자문 메모 — Luminate·Boxscore 검토, 2026-10-16)
// ⚠️ 해석 주의(카드에도 출처로 표기): 보고된 수치만 있다 · 매출은 USD로 적힌 것만 숫자로 쓴다(엔·원 표기는 원문만 보관) ·
//    관객 수와 매출은 다른 지표다 · 투어가 끝나지 않았으면 중간 집계다.
//
// 투어 문서 찾기는 tools/wiki_tours.mjs와 같은 두 경로: ①Category:"{그룹} concert tours" ②검색 + 인포박스 artist 검증.
// 실행: node tools/wiki_boxscore.mjs --tour "Born Pink World Tour"   (한 문서 테스트)
//       node tools/wiki_boxscore.mjs --group 블랙핑크
//       node tools/wiki_boxscore.mjs --all            (전체 → tours_boxscore.json)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const UA = 'kpopuniverse-tourbot/1.0 (concert data for fan site; contact before0hwa@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';
const sleep = s => { try { execFileSync('sleep', [String(s)]); } catch (_) {} };

const getJSON = url => {
  for (let t = 0; t < 5; t++) {
    sleep(0.6);
    try {
      const b = execFileSync('curl', ['-sk', '-m', '40', '-A', UA, url + (url.includes('?') ? '&' : '?') + 'maxlag=5'], { maxBuffer: 1 << 28, encoding: 'utf8' });
      if (/^You are making too many|maxlag/i.test(b.slice(0, 40))) { sleep(5); continue; }
      const j = JSON.parse(b);
      if (j.error && /maxlag|ratelimit/i.test(j.error.code || '')) { sleep(5); continue; }
      return j;
    } catch (e) { sleep(3); }
  }
  return null;
};
const wikitext = title => getJSON(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`)?.parse?.wikitext || '';
const catMembers = cat => (getJSON(`${API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:' + cat)}&cmlimit=100&format=json&formatversion=2`)?.query?.categorymembers || []).map(m => m.title);
const resolveTitle = name => { const p = getJSON(`${API}?action=query&titles=${encodeURIComponent(name)}&redirects=1&format=json&formatversion=2`)?.query?.pages?.[0]; return (p && !p.missing) ? p.title : name; };

// ── 인포박스 ──────────────────────────────────────────
// 인포박스 본문을 중괄호 짝을 세며 잘라낸다(값 안에 {{...}}가 중첩되므로 정규식으로 못 끊는다)
function infobox(wt) {
  const i = wt.search(/\{\{\s*Infobox concert/i);
  if (i < 0) return null;
  let d = 0, j = i;
  for (; j < wt.length; j++) {
    if (wt.startsWith('{{', j)) { d++; j++; } else if (wt.startsWith('}}', j)) { d--; j++; if (d === 0) break; }
  }
  const body = wt.slice(i + 2, j - 1);
  // 최상위 '|'로만 필드를 나눈다
  const fields = {}; let depth = 0, cur = '';
  const flush = () => { const m = cur.match(/^\s*([a-z_ ]+?)\s*=\s*([\s\S]*)$/i); if (m) fields[m[1].trim().toLowerCase().replace(/\s+/g, '_')] = m[2].trim(); cur = ''; };
  for (let k = 0; k < body.length; k++) {
    const two = body.slice(k, k + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; k++; continue; }
    if (two === '}}' || two === ']]') { depth--; cur += two; k++; continue; }
    if (body[k] === '|' && depth === 0) { flush(); continue; }
    cur += body[k];
  }
  flush();
  return fields;
}
// 통화 템플릿을 글자로 먼저 바꾼 뒤 나머지 정리({{US$|246.1 million}} → $246.1 million)
function cleanVal(raw) {
  let s = String(raw || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/\{\{\s*(?:US\$|USD)\s*\|\s*([^{}|]+)[^{}]*\}\}/gi, '$$$1');
  s = s.replace(/\{\{\s*(?:JP¥|JPY|¥)\s*\|\s*([^{}|]+)[^{}]*\}\}/gi, '¥$1');
  s = s.replace(/\{\{\s*(?:KRW|₩)\s*\|\s*([^{}|]+)[^{}]*\}\}/gi, '₩$1');
  s = s.replace(/\{\{\s*(?:nowrap|small|nobr)\s*\|\s*([^{}]+)\}\}/gi, '$1');
  s = s.replace(/\{\{\s*(?:start|end) date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})[^{}]*\}\}/gi, (_, y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  s = s.replace(/\{\{[^{}]*\}\}/g, '');
  s = s.replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1');
  s = s.replace(/<br\s*\/?>/gi, '; ').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/'''?/g, '');
  return s.replace(/\s+/g, ' ').trim();
}
// "1.8 million" · "1,800,000" · "over 2 million" · "340,000+" → 숫자. 범위·복수 값이면 첫 값
function num(s) {
  const m = String(s).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(million|billion|thousand)?/i);
  if (!m) return null;
  const mul = { million: 1e6, billion: 1e9, thousand: 1e3 }[(m[2] || '').toLowerCase()] || 1;
  return Math.round(+m[1] * mul);
}
const usd = s => { const m = String(s).match(/(?:US)?\$\s*([\d.,]+\s*(?:million|billion|thousand)?)/i); return m ? num(m[1]) : null; };
function dateOf(s) {
  const iso = String(s).match(/(\d{4})-(\d{2})-(\d{2})/); if (iso) return iso[0];
  const M = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  const m = String(s).match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/) || String(s).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) { const y = String(s).match(/\b(19|20)\d\d\b/); return y ? y[0] : null; }
  const [mo, d] = M[m[1].toLowerCase()] ? [M[m[1].toLowerCase()], m[2]] : [M[(m[2] || '').toLowerCase()], m[1]];
  return mo ? `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : m[3];
}
function tourFromWt(title, wt) {
  const f = infobox(wt); if (!f) return null;
  const att = cleanVal(f.attendance || ''), gross = cleanVal(f.box_office || f.gross || f.revenue || '');
  const shows = num(cleanVal(f.number_of_shows || f.shows || ''));
  const rec = {
    tour: cleanVal(f.name || '') || title, wiki: title,
    artist: cleanVal(f.artist || ''),
    start: dateOf(cleanVal(f.start_date || f.date || '')), end: dateOf(cleanVal(f.end_date || '')),
    shows: shows || null,
    attendance: num(att), attendance_raw: att || null,
    gross_usd: usd(gross), gross_raw: gross || null,
  };
  if (!rec.attendance && !rec.gross_raw && !rec.shows) return null; // 흥행 정보가 하나도 없으면 버림
  return rec;
}

// ── 투어 문서 찾기(wiki_tours.mjs와 같은 규칙) ───────────
const NOT_TOUR = /dream concert|music bank|kcon|\bmama\b|golden disc|gaon|melon music|festival|ticketlink|asia song|super concert|countdown|water bomb|show champion/i;
function searchTours(canon) {
  const hits = (getJSON(`${API}?action=query&list=search&srsearch=${encodeURIComponent('"' + canon + '" concert tour')}&srlimit=30&srnamespace=0&format=json&formatversion=2`)?.query?.search || []).map(h => h.title);
  return hits.filter(t => /tour|concert|\blive\b|fan\s?(meeting|con|meet)|in (seoul|tokyo|japan|asia|america|europe)/i.test(t) &&
    !/discography|^List of|videography|\(song\)|\(album\)|\(EP\)|filmography|awards|members/i.test(t) && t.toLowerCase() !== canon.toLowerCase());
}
function artistOk(rec, canon) {
  const a = (rec.artist || '').toLowerCase(), c = canon.toLowerCase().replace(/\s*\(.*\)$/, '');
  return !!a && (a.includes(c) || c.includes(a));
}
function groupTours(en) {
  const canon = resolveTitle(en);
  const titles = new Set();
  for (const v of [`${canon} concert tours`, `${canon} (band) concert tours`, `${canon} (group) concert tours`]) {
    const m = catMembers(v).filter(t => !/^List of|discography/i.test(t));
    if (m.length) { m.forEach(t => titles.add(t)); break; }
  }
  searchTours(canon).slice(0, 12).forEach(t => titles.add(t));
  const out = [], seen = new Set();
  for (const t of titles) {
    if (NOT_TOUR.test(t)) continue;
    const wt = wikitext(t); if (!wt) continue;
    const rec = tourFromWt(t, wt);
    if (!rec || !artistOk(rec, canon)) continue; // 인포박스 artist가 이 그룹이어야(오귀속 방지)
    const k = rec.tour.toLowerCase(); if (seen.has(k)) continue; seen.add(k);
    out.push(rec);
  }
  return out.sort((a, b) => String(a.start || '').localeCompare(String(b.start || '')));
}

if (argv.includes('--tour')) {
  const t = argv[argv.indexOf('--tour') + 1];
  console.log(JSON.stringify(tourFromWt(t, wikitext(t)), null, 2));
  process.exit(0);
}
const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
if (argv.includes('--group')) {
  const ko = argv[argv.indexOf('--group') + 1];
  const r = groupTours(G[ko]?.en || ko);
  r.forEach(x => console.log(`${x.start || '?'}  ${x.tour}  · ${x.shows || '?'}회 · 관객 ${x.attendance ?? '-'} · $${x.gross_usd ?? '-'}  [${x.gross_raw || ''}]`));
  process.exit(0);
}
if (argv.includes('--all')) {
  // 이전에 투어 일정을 찾았던 그룹(kpop_events) 위주로 돌면 시간이 덜 든다 — 그 목록이 없으면 전체 그룹
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
  const names = (only || Object.keys(G)).filter(ko => G[ko]?.en);
  const outPath = ROOT + '/tours_boxscore.json';
  const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
  let gi = 0;
  for (const ko of names) {
    gi++;
    if (out[ko] && !argv.includes('--refresh')) continue; // 이어서 하기
    let r = []; try { r = groupTours(G[ko].en); } catch (e) {}
    if (r.length) out[ko] = r; else out[ko] = out[ko] || [];
    if (gi % 10 === 0) fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
    process.stderr.write(`\r[${gi}/${names.length}] ${ko} · 투어 ${r.length}    `);
  }
  // 빈 그룹은 빼고 저장(파일 작게) — 이어하기용 표시는 메모리에서만
  const clean = Object.fromEntries(Object.entries(out).filter(([, v]) => v.length));
  fs.writeFileSync(outPath, JSON.stringify(clean, null, 1));
  console.log(`\n완료 — ${Object.keys(clean).length}그룹 · 투어 ${Object.values(clean).reduce((s, v) => s + v.length, 0)}개 → tours_boxscore.json`);
  process.exit(0);
}
console.log('사용: --tour "제목" | --group 한글명 | --all [--only 그룹1,그룹2] [--refresh]');
