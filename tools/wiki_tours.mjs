// 위키피디아 콘서트 투어 수집 — 그룹별 "concert tours" 카테고리의 투어 문서에서 일정표(Date/City/Country/
// Venue)를 파싱해 공연 목록을 만든다. KOPIS가 못 잡는 해외 투어·과거 이력 보완용 (2026-09-04 신설).
//
// 접근: en.wikipedia Category:"{EnName} concert tours" 로 투어 문서 열거 → 각 문서 wikitext의 일정표 파싱.
// rowspan/colspan 캐리 처리, [[..]]·<ref>·{{..}} 정리, "Month D, YYYY" 날짜 파싱, 취소·소계행 스킵.
//
// 실행: node tools/wiki_tours.mjs --tour "Born Pink World Tour"   (한 문서 테스트)
//       node tools/wiki_tours.mjs --group 블랙핑크                 (한 그룹 전체 투어)
//       node tools/wiki_tours.mjs --all                            (전체 그룹 → tours_raw.json)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const UA = 'kpopuniverse-tourbot/1.0 (concert data for fan site; contact before0hwa@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';

const getJSON = url => {
  for (let t = 0; t < 5; t++) {
    try { execFileSync('sleep', ['0.6']); } catch (_) {} // 위키 API 예의(요청 간 텀)
    try {
      const b = execFileSync('curl', ['-sk', '-m', '40', '-A', UA, url + (url.includes('?') ? '&' : '?') + 'maxlag=5'], { maxBuffer: 1 << 28, encoding: 'utf8' });
      if (/^You are making too many|maxlag/i.test(b.slice(0, 40))) { execFileSync('sleep', ['5']); continue; }
      const j = JSON.parse(b);
      if (j.error && /maxlag|ratelimit/i.test(j.error.code || '')) { execFileSync('sleep', ['5']); continue; }
      return j;
    } catch (e) { try { execFileSync('sleep', ['3']); } catch (_) {} }
  }
  return null;
};
const wikitext = title => {
  const j = getJSON(`${API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&redirects=1`);
  return j?.parse?.wikitext || '';
};
const catMembers = cat => {
  const j = getJSON(`${API}?action=query&list=categorymembers&cmtitle=${encodeURIComponent('Category:' + cat)}&cmlimit=100&format=json&formatversion=2`);
  return (j?.query?.categorymembers || []).map(m => m.title);
};
// 그룹 정식 문서명 정규화(대소문자·리다이렉트) — "BLACKPINK"→"Blackpink"
const resolveTitle = name => {
  const j = getJSON(`${API}?action=query&titles=${encodeURIComponent(name)}&redirects=1&format=json&formatversion=2`);
  const p = j?.query?.pages?.[0];
  return (p && !p.missing) ? p.title : name;
};

// ── 셀 정리 ──────────────────────────────────────────
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
function cleanCell(raw) {
  let s = raw || '';
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<(sup|small|sub)[^>]*>[\s\S]*?<\/\1>/gi, ''); // 각주/작은글씨 주석 제거
  // {{flag|X}} {{flagicon|X}} {{sortname|A|B}} 등 → 마지막 유의미 인자
  s = s.replace(/\{\{(?:flag(?:icon|country|u)?|nowrap)\|([^{}|]+)[^{}]*\}\}/gi, '$1');
  s = s.replace(/\{\{sortname\|([^{}|]+)\|([^{}|]+)[^{}]*\}\}/gi, '$1 $2');
  s = s.replace(/\{\{[^{}]*\}\}/g, ''); // 남은 템플릿 제거
  s = s.replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1').replace(/\[\[([^\]]+)\]\]/g, '$1'); // 위키링크
  s = s.replace(/\[[^\s\]]+\s([^\]]+)\]/g, '$1'); // 외부링크 [url text]
  s = s.replace(/<[^>]+>/g, ''); // 남은 HTML
  s = s.replace(/'''?/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&');
  return s.replace(/\s+/g, ' ').trim();
}
function parseDate(s) {
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`;
  return null;
}

// ── 한 표를 행렬로(rowspan/colspan 캐리) ───────────────
function parseTable(tblText) {
  const rows = tblText.split(/\n\|-/); // 첫 조각은 표속성, 헤더는 보통 첫 |- 다음 행
  // 헤더 행 = '!' 셀을 가진 첫 행(rows[0] 또는 rows[1])
  let hIdx = rows.findIndex(r => /^\s*!/m.test(r));
  if (hIdx < 0) return null;
  const headerCells = [];
  rows[hIdx].split('\n').forEach(ln => {
    if (/^\s*!/.test(ln)) ln.replace(/^\s*!/, '').split('!!').forEach(c => headerCells.push(cleanCell(c.split('|').pop())));
  });
  const idx = name => headerCells.findIndex(h => new RegExp('^' + name, 'i').test(h));
  const di = idx('Date'), ci = idx('City'), coi = idx('Country'), vi = idx('Venue');
  if (di < 0 || ci < 0) return null; // 일정표 아님
  const nCols = headerCells.length;
  const pending = {}; // col -> {value, rows}
  const out = [];
  for (const rowText of rows.slice(hIdx + 1)) {
    // 셀 추출: 줄이 '|'로 시작(‖ 또는 개별줄), '||'로 다중
    const cells = [];
    for (const ln of rowText.split('\n')) {
      if (!/^\s*\|/.test(ln)) continue;
      if (/^\s*\|\}/.test(ln)) continue;
      const body = ln.replace(/^\s*\|/, '');
      for (const seg of body.split('||')) {
        // 속성 | 값  (속성에 rowspan/colspan)
        let attrs = '', val = seg;
        const bar = seg.indexOf('|');
        if (bar >= 0 && /rowspan|colspan|style|scope|align|class/i.test(seg.slice(0, bar))) { attrs = seg.slice(0, bar); val = seg.slice(bar + 1); }
        const rs = (attrs.match(/rowspan\s*=\s*"?(\d+)/i) || [])[1];
        const cs = (attrs.match(/colspan\s*=\s*"?(\d+)/i) || [])[1];
        cells.push({ value: cleanCell(val), rowspan: rs ? +rs : 1, colspan: cs ? +cs : 1 });
      }
    }
    if (!cells.length) continue;
    // 소계/취소/레그헤더 스킵: 한 셀이 전체를 colspan 하거나 취소 문구
    if (cells.length === 1 && (cells[0].colspan >= nCols - 1 || cells[0].rowspan >= 3)) continue;
    if (cells.some(c => /^(cancell?ed|postponed|total)/i.test(c.value))) continue;
    // 행렬 채우기
    const rowArr = new Array(nCols).fill(null);
    let col = 0, ci2 = 0;
    while (col < nCols) {
      if (pending[col] && pending[col].rows > 0) { rowArr[col] = pending[col].value; pending[col].rows--; col++; continue; }
      const cell = cells[ci2++]; if (!cell) break;
      for (let k = 0; k < cell.colspan && col + k < nCols; k++) {
        rowArr[col + k] = cell.value;
        if (cell.rowspan > 1) pending[col + k] = { value: cell.value, rows: cell.rowspan - 1 };
      }
      col += cell.colspan;
    }
    const date = parseDate(rowArr[di] || '');
    if (!date) continue;
    out.push({ date, city: rowArr[ci] || '', country: coi >= 0 ? (rowArr[coi] || '') : '', venue: vi >= 0 ? (rowArr[vi] || '') : '' });
  }
  return out;
}

// 검색으로 투어 문서 발견(카테고리 없는 그룹용). 제목이 투어스럽고 본문이 그룹명을 언급하는 것만.
function searchTours(canon) {
  const j = getJSON(`${API}?action=query&list=search&srsearch=${encodeURIComponent('"' + canon + '" concert tour')}&srlimit=30&srnamespace=0&format=json&formatversion=2`);
  const hits = (j?.query?.search || []).map(h => h.title);
  return hits.filter(t =>
    /tour|concert|\blive\b|fan\s?(meeting|con|meet)|showcase|in (seoul|tokyo|japan|asia|america|europe)/i.test(t) &&
    !/discography|^List of|videography|\(song\)|\(album\)|\(EP\)|filmography|awards|members/i.test(t) &&
    t.toLowerCase() !== canon.toLowerCase());
}
// 다중아티스트 정기행사(개별 그룹 투어 아님) 블록리스트
const NOT_TOUR = /dream concert|music bank|kcon|\bmama\b|golden disc|gaon|melon music|festival|ticketlink|asia song|super concert|countdown|water bomb|show champion/i;
function parseToursVerified(title, canon) {
  if (NOT_TOUR.test(title)) return [];
  const wt = wikitext(title);
  if (!wt) return [];
  // 투어 인포박스({{Infobox concert}})의 artist 필드가 이 그룹이어야 인정(오귀속 방지의 핵심)
  const ci = wt.toLowerCase().indexOf('{{infobox concert');
  if (ci < 0) return []; // 콘서트 인포박스 없으면 개별 그룹투어로 안 봄
  const box = wt.slice(ci, ci + 2000);
  const am = box.match(/\|\s*artist\s*=\s*([^\n|]+)/i);
  const artist = cleanCell(am ? am[1] : '').toLowerCase();
  const cl = canon.toLowerCase(), clBare = cl.replace(/\s*\(.*\)$/, '');
  if (!artist || (!artist.includes(clBare) && !clBare.includes(artist))) return [];
  return parseToursFromWt(wt);
}
function parseTours(title) {
  const wt = wikitext(title);
  return wt ? parseToursFromWt(wt) : [];
}
function parseToursFromWt(wt) {
  const shows = [];
  const parts = wt.split(/\{\|/);
  let prefix = parts[0];
  const GENERIC = /^(concert tours?|tours?|headlining|co-headlining|concerts?|joint|fan meetings?|live performances?|showcases?|promotional)/i;
  for (let i = 1; i < parts.length; i++) {
    const tbl = parts[i].split(/\n\|\}/)[0];
    if (/\|\s*Date/i.test(tbl) && /\|\s*City/i.test(tbl)) {
      // 이 표 직전의 마지막 헤딩(=== 투어명 ===)을 섹션명으로
      const hm = [...prefix.matchAll(/^={2,4}\s*(.+?)\s*={2,4}\s*$/gm)];
      let sec = ''; // 위로 올라가며 첫 비일반 헤딩 = 투어명("Tour dates"·"Concert tours"는 건너뜀)
      for (let h = hm.length - 1; h >= 0; h--) { const t = cleanCell(hm[h][1]); if (t && !GENERIC.test(t) && !/tour dates|setlist|shows?$/i.test(t)) { sec = t; break; } }
      const rows = parseTable(tbl);
      if (rows) for (const r of rows) shows.push({ ...r, section: sec });
    }
    prefix += '{|' + parts[i];
  }
  return shows;
}

// ── 실행 ─────────────────────────────────────────────
if (argv.includes('--tour')) {
  const title = argv[argv.indexOf('--tour') + 1];
  const shows = parseTours(title);
  console.log(`[${title}] ${shows.length}회차`);
  shows.slice(0, 40).forEach(s => console.log(`  ${s.date}  ${s.city} / ${s.country}  @ ${s.venue}`));
  if (shows.length > 40) console.log(`  …+${shows.length - 40}`);
  process.exit(0);
}

// 그룹 en명 → 투어 문서 열거(카테고리 변형 시도)
const _catCache = {};
function tourArticles(en) {
  const canon = resolveTitle(en); // 대소문자·리다이렉트 정규화
  for (const v of [`${canon} concert tours`, `${canon} (band) concert tours`, `${canon} (group) concert tours`]) {
    if (_catCache[v] === undefined) _catCache[v] = catMembers(v);
    if (_catCache[v].length) return _catCache[v].filter(t => !/^List of|discography/i.test(t));
  }
  return [];
}

if (argv.includes('--group')) {
  const ko = argv[argv.indexOf('--group') + 1];
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const en = G[ko]?.en || ko;
  const arts = tourArticles(en);
  console.log(`[${ko}/${en}] 투어문서 ${arts.length}개: ${arts.join(' · ')}`);
  let total = 0;
  for (const a of arts) { const s = parseTours(a); total += s.length; console.log(`  ${a}: ${s.length}회`); }
  console.log(`총 ${total}회차`);
  process.exit(0);
}

if (argv.includes('--all')) {
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const out = {}; let gi = 0, tot = 0;
  const names = Object.keys(G);
  for (const ko of names) {
    gi++;
    const en = G[ko]?.en; if (!en) continue;
    const arts = tourArticles(en);
    if (!arts.length) continue;
    const shows = [];
    for (const a of arts) { for (const s of parseTours(a)) shows.push({ ...s, tour: a }); }
    if (shows.length) { out[ko] = shows; tot += shows.length; }
    process.stderr.write(`\r[${gi}/${names.length}] ${ko} · 누적 ${tot}회 · 그룹 ${Object.keys(out).length}    `);
  }
  fs.writeFileSync('/tmp/tours_raw.json', JSON.stringify(out));
  console.log(`\n\n완료 — ${Object.keys(out).length}그룹 · ${tot}회차 → /tmp/tours_raw.json`);
  process.exit(0);
}
if (argv.includes('--search')) {
  const ko = argv[argv.indexOf('--search') + 1];
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const canon = resolveTitle(G[ko]?.en || ko);
  const cands = searchTours(canon);
  console.log(`[${ko}/${canon}] 검색후보 ${cands.length}: ${cands.join(' · ')}`);
  let tot = 0;
  for (const c of cands) { const s = parseToursVerified(c, canon); if (s.length) { console.log(`  ✓ ${c}: ${s.length}회`); tot += s.length; } else console.log(`  ✗ ${c}: 0(표없음/타그룹)`); }
  console.log(`총 ${tot}회차`);
  process.exit(0);
}

// 한 그룹의 모든 공연 발견: "List of X concert tours/live performances" 직접 파싱 + 검색된 개별 투어(인포박스검증)
function discoverGroup(canon) {
  const bare = canon.replace(/\s*\(.*\)$/, '');
  const shows = []; const seen = new Set();
  const add = (arr, tour) => { for (const s of arr) { const k = s.date + '|' + s.city + '|' + s.venue; if (!seen.has(k)) { seen.add(k); shows.push({ ...s, tour }); } } };
  // 1) List 문서 직접(제목에 그룹명 있으니 신뢰)
  for (const lt of [`List of ${bare} concert tours`, `List of ${bare} live performances`]) {
    const wt = wikitext(lt);
    if (wt && wt.slice(0, 3000).toLowerCase().includes(bare.toLowerCase())) add(parseToursFromWt(wt), lt);
  }
  // 2) 검색된 개별 투어(인포박스 artist 검증)
  for (const c of searchTours(canon).slice(0, 12)) if (!/^List of/i.test(c)) add(parseToursVerified(c, canon), c);
  return shows;
}

if (argv.includes('--discover-all')) {
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const prev = fs.existsSync('/tmp/tours_raw.json') ? JSON.parse(fs.readFileSync('/tmp/tours_raw.json', 'utf8')) : {};
  const out = {}; let gi = 0, tot = 0; const names = Object.keys(G);
  for (const ko of names) {
    gi++;
    if (prev[ko]) continue;
    const en = G[ko]?.en; if (!en) continue;
    let shows; try { shows = discoverGroup(resolveTitle(en)); } catch (e) { shows = []; }
    if (shows.length) { out[ko] = shows; tot += shows.length; }
    process.stderr.write(`\r[${gi}/${names.length}] ${ko} · 누적 ${tot} · 그룹 ${Object.keys(out).length}    `);
  }
  fs.writeFileSync('/tmp/tours_raw2.json', JSON.stringify(out));
  console.log(`\n\n발견 완료 — ${Object.keys(out).length}그룹 · ${tot}회차 → /tmp/tours_raw2.json`);
  process.exit(0);
}

if (argv.includes('--search-all')) {
  const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
  const prev = fs.existsSync('/tmp/tours_raw.json') ? JSON.parse(fs.readFileSync('/tmp/tours_raw.json', 'utf8')) : {};
  const out = {}; let gi = 0, tot = 0; const names = Object.keys(G);
  for (const ko of names) {
    gi++;
    if (prev[ko]) continue; // 1단계에서 이미 잡힌 그룹은 스킵
    const en = G[ko]?.en; if (!en) continue;
    const canon = resolveTitle(en);
    let cands; try { cands = searchTours(canon); } catch (e) { cands = []; }
    if (!cands.length) { process.stderr.write(`\r[${gi}/${names.length}] ${ko} · 누적 ${tot} · 그룹 ${Object.keys(out).length}    `); continue; }
    const shows = [];
    const seen = new Set();
    for (const c of cands.slice(0, 12)) {
      for (const s of parseToursVerified(c, canon)) { const k = s.date + '|' + s.city + '|' + s.venue; if (!seen.has(k)) { seen.add(k); shows.push({ ...s, tour: c }); } }
    }
    if (shows.length) { out[ko] = shows; tot += shows.length; }
    process.stderr.write(`\r[${gi}/${names.length}] ${ko} · 누적 ${tot} · 그룹 ${Object.keys(out).length}    `);
  }
  fs.writeFileSync('/tmp/tours_raw2.json', JSON.stringify(out));
  console.log(`\n\n검색발견 완료 — ${Object.keys(out).length}그룹 · ${tot}회차 → /tmp/tours_raw2.json`);
  process.exit(0);
}
console.log('사용: --tour "제목" | --group 한글명 | --all | --search 한글명 | --search-all');
