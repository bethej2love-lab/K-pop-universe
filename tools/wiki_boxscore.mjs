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
// 넘겨주기를 따라간 실제 문서명까지 같이 — 중복 판정에 쓴다
const parsePage = title => { const p = getJSON(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`)?.parse; return { title: p?.title || title, wt: p?.wikitext || '' }; };
const wikitext = title => parsePage(title).wt;
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
  // 목록 템플릿은 항목을 살린다 — {{unbulleted list|23 in Asia|…|51 in total}}를 통째로 지워 공연 횟수가 비던 것(트와이스)
  s = s.replace(/\{\{\s*(?:unbulleted list|ubl|bulleted list|hlist|plainlist|flatlist)\s*\|([^{}]*)\}\}/gi, (_, x) => x.split('|').join('; '));
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
  // 공연 횟수가 지역별 목록이면 'N in total'/'Total: N'을 우선(첫 숫자는 '23 in Asia' 같은 일부다)
  const showsTxt = cleanVal(f.number_of_shows || f.shows || '');
  const tot = showsTxt.replace(/,/g, '').match(/(\d+)\s*(?:in\s+)?total|total\D{0,3}(\d+)/i);
  const shows = tot ? +(tot[1] || tot[2]) : num(showsTxt);
  const rec = {
    tour: cleanVal(f.name || f.concert_tour_name || f.tour_name || '').replace(/;\s*/g, ' · ') || title, wiki: title, // 이름 속 줄바꿈(<br>)은 ' · '
    artist: cleanVal(f.artist || ''),
    start: dateOf(cleanVal(f.start_date || f.date || '')), end: dateOf(cleanVal(f.end_date || '')),
    shows: shows || null,
    attendance: num(att), attendance_raw: att || null,
    gross_usd: usd(gross), gross_raw: gross || null,
  };
  // 앞뒤 투어 링크(last_tour·next_tour) — 분류·검색에 안 걸리는 투어를 사슬로 찾는 데 쓴다(_links, 저장 안 함)
  const links = [];
  for (const k of ['last_tour', 'next_tour', 'prev_tour', 'previous_tour']) {
    const m = String(f[k] || '').match(/\[\[([^\]|#]+)/); if (m) links.push(m[1].trim());
  }
  Object.defineProperty(rec, '_links', { value: links, enumerable: false });
  if (!rec.attendance && !rec.gross_raw && !rec.shows) return null; // 흥행 정보가 하나도 없으면 버림
  return rec;
}

// ── 투어 문서 찾기(wiki_tours.mjs와 같은 규칙) ───────────
const NOT_TOUR = /dream concert|music bank|kcon|\bmama\b|golden disc|gaon|melon music|festival|ticketlink|asia song|super concert|countdown|water bomb|show champion/i;
// ⚠️ 제목에 tour/concert가 없는 투어가 많다('Synk: Parallel Line' — 에스파가 0개로 나와 발견). 제목 조건은 빼고
//    부정 패턴(디스코·곡·앨범 등)만 거른다 — 진짜 걸러내기는 인포박스(Infobox concert + artist=이 그룹)가 한다.
function searchTours(canon) {
  const hits = (getJSON(`${API}?action=query&list=search&srsearch=${encodeURIComponent('"' + canon + '" concert tour')}&srlimit=20&srnamespace=0&format=json&formatversion=2`)?.query?.search || []).map(h => h.title);
  return hits.filter(t => !/discography|^List of|videography|\(song\)|\(album\)|\(EP\)|filmography|awards|members|\(band\)$|\(group\)$|\(singer\)$|\(rapper\)$/i.test(t) && t.toLowerCase() !== canon.toLowerCase());
}
function artistOk(rec, canon) {
  const a = (rec.artist || '').toLowerCase(), c = canon.toLowerCase().replace(/\s*\(.*\)$/, '');
  return !!a && (a.includes(c) || c.includes(a));
}
function groupTours(en) {
  const canon = resolveTitle(en);
  // ⚠️ 위키 문서명이 'Twice (group)'처럼 괄호가 붙으면 분류는 'Twice concert tours'다 — 괄호 뗀 이름도 시도(트와이스 투어가 거의 다 빠졌던 원인)
  const bare = canon.replace(/\s*\(.*\)$/, '');
  const titles = new Set();
  for (const v of [`${canon} concert tours`, `${bare} concert tours`, `${bare} (band) concert tours`, `${bare} (group) concert tours`]) {
    const m = catMembers(v).filter(t => !/^List of|discography/i.test(t));
    if (m.length) { m.forEach(t => titles.add(t)); break; }
  }
  searchTours(bare).slice(0, 16).forEach(t => titles.add(t));
  const out = [], seen = new Set();
  for (const t of titles) {
    if (NOT_TOUR.test(t)) continue;
    const pg = parsePage(t); if (!pg.wt) continue;
    // ⚠️ 넘겨주기(리다이렉트)는 실제 문서명으로 중복 판정 — 'BTS World Tour Love Yourself: Speak Yourself'가
    //    'Love Yourself World Tour'로 넘어가 같은 투어가 두 번 들어갔던 것. 같은 일정·관객 수도 같은 투어로 본다.
    if (seen.has('p:' + pg.title)) continue; seen.add('p:' + pg.title);
    // 이 그룹 투어면 앞뒤 투어 링크를 찾을 목록에 더한다(Set은 순회 중 추가분도 돈다) — 흥행 수치가 없는 투어도 사슬은 잇는다
    const fb = infobox(pg.wt);
    if (fb && artistOk({ artist: cleanVal(fb.artist || '') }, canon)) {
      for (const k of ['last_tour', 'next_tour', 'prev_tour', 'previous_tour']) {
        const m = String(fb[k] || '').match(/\[\[([^\]|#]+)/);
        if (m && titles.size < 60) titles.add(m[1].trim());
      }
    }
    const rec = tourFromWt(pg.title, pg.wt);
    if (!rec || !artistOk(rec, canon)) continue; // 인포박스 artist가 이 그룹이어야(오귀속 방지)
    const k = rec.tour.toLowerCase(), k2 = `${rec.start}|${rec.end}|${rec.attendance}|${rec.shows}`;
    if (seen.has(k) || (rec.start && seen.has(k2))) continue; seen.add(k); seen.add(k2);
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
    if (out[ko] && out[ko].length && !argv.includes('--refresh')) continue; // 이어서 하기(빈 결과는 다시 — 찾기 규칙을 고친 뒤 회수)
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
