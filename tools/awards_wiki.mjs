// 위키백과 영문판 시상식 회차 문서 → awards/{id}-{연도}.json (역대 수상 수집기, 2026-11-16)
// 규칙: {{Award category|색|부문명}} 아래 글머리표에서 굵은 글씨('''…''')가 수상자(후보는 안 담는다).
// 수상자 이름은 영문 표기 → groups.json(en/altNames)·artists.json(name.en)으로 연결, 못 찾으면 ext(우주 밖/미등록) 표시.
// 위키 수집분은 autoSource:'wikipedia' — 출처가 위키 1개라 사람이 확인한 파일(MMA/KGMA 2026처럼)보다 신뢰도 낮음.
// 실행: node tools/awards_wiki.mjs mma 2024 2025      (시상식 id + 연도들)
//       node tools/awards_wiki.mjs mma 2012-2025      (범위)
//       이미 awards/{id}-{연도}.json 이 있으면 건너뜀(사람이 만든 파일 보호). --force 로 덮어쓰기(autoSource 파일만)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { koCategory } from './awards_ko.mjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const norm = s => String(s || '').toLowerCase().replace(/[\s.\-_·'’"()!]/g, '');
const gEn = new Map();
for (const [ko, g] of Object.entries(GROUPS)) for (const k of [g.en, ...(g.altNames || []), ...(g.formerNames || [])]) { const n = norm(k); if (n && !gEn.has(n)) gEn.set(n, ko); }
const aEn = new Map();
for (const a of ARTISTS) { const n = norm(a.name && a.name.en); if (n) (aEn.get(n) || aEn.set(n, []).get(n)).push(a); }
const groupsOf = a => (a.groups || [a.group]).filter(Boolean).map(g => g.ko);

// 시상식 정의: 위키 문서 제목 후보(연도 → 제목들)
const ORD = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
const DEFS = {
  mma: { name: '멜론뮤직어워드', nameEn: 'Melon Music Awards', titles: y => [`${y} Melon Music Awards`] },
  mama: { name: '마마 어워즈', nameEn: 'Mnet Asian Music Awards', titles: y => [`${y} MAMA Awards`, `${y} Mnet Asian Music Awards`] },
  gda: { name: '골든디스크어워즈', nameEn: 'Golden Disc Awards', titles: y => [`${ORD(y - 1985)} Golden Disc Awards`, `${ORD(y - 1986)} Golden Disc Awards`, `${ORD(y - 1984)} Golden Disc Awards`] },
  sma: { name: '서울가요대상', nameEn: 'Seoul Music Awards', titles: y => [`${ORD(y - 1991)} Seoul Music Awards`, `${ORD(y - 1990)} Seoul Music Awards`, `${ORD(y - 1992)} Seoul Music Awards`] },
  aaa: { name: '아시아 아티스트 어워즈', nameEn: 'Asia Artist Awards', titles: y => [`${y} Asia Artist Awards`] },
  gaon: { name: '써클차트 뮤직어워즈', nameEn: 'Circle Chart Music Awards', titles: y => [`${ORD(y - 2011)} Circle Chart Music Awards`, `${ORD(y - 2011)} Gaon Chart Music Awards`, `${ORD(y - 2012)} Gaon Chart Music Awards`] },
  kgma: { name: '코리아그랜드뮤직어워즈', nameEn: 'Korea Grand Music Awards', titles: y => [`${y} Korea Grand Music Awards`] },
  sbs: { name: 'SBS 가요대전', nameEn: 'SBS Gayo Daejeon', titles: y => [`${y} SBS Gayo Daejeon`] },
  mbc: { name: 'MBC 가요대제전', nameEn: 'MBC Music Festival', titles: y => [`${y} MBC Music Festival`, `${y} MBC Gayo Daejejeon`] },
  kbs: { name: 'KBS 가요대축제', nameEn: 'KBS Song Festival', titles: y => [`${y} KBS Song Festival`, `${y} KBS Gayo Daechukje`] },
};

async function wikitext(title) {
  const u = 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=' + encodeURIComponent(title);
  let j = null;
  for (let t = 0; t < 5 && !j; t++) { // 위키가 "too many requests"를 일반 텍스트로 돌려주면 길게 쉬고 재시도
    const r = await fetch(u, { headers: { 'User-Agent': 'kpopuniverse-awards/1.0 (K-pop data; polite crawler)' } });
    const body = await r.text();
    try { j = JSON.parse(body); } catch { await new Promise(res => setTimeout(res, 15000 * (t + 1))); }
  }
  if (!j) throw new Error('위키 응답 없음(요청 제한)');
  return j.parse ? { title: j.parse.title, text: j.parse.wikitext } : null;
}
const clean = s => s.replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '');
const tierOf = (t, daesang) => daesang ? '대상' : /top ?10/i.test(t) ? '본상' : /rookie|new artist|newcomer|best new|rising/i.test(t) ? '신인' : /popular|favorite|favourite|fans|star award|choice|hallyu|k-?wave|vote|fan/i.test(t) ? '인기' : /^(top ?10|best|artist of|song of|album of|record of|main|bonsang|digital|album|performance)/i.test(t) ? '본상' : '특별';
const plain = s => s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/\{\{[^}]*\}\}/g, '').replace(/''+/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// 수상자 줄 → [{name, target}...] (대시 앞의 링크들 = 수상자, 뒤 = 작품)
function parseWinnerLine(line) {
  const body = line.replace(/^\*+\s*/, '');
  const m = /^'''(.*?)'''(?!')/.exec(body.replace(/'''''/g, "'''")) || /^'''(.*)$/.exec(body);
  if (!m) return null;
  const inner = body.replace(/'''''/g, "'''").replace(/^'''/, '').replace(/'''$/, '');
  const split = inner.split(/\s[–—-]\s/);
  const who = split[0], work = split.length > 1 ? plain(split.slice(1).join(' – ')) : '';
  const names = [];
  const re = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g; let x;
  while ((x = re.exec(who))) names.push({ target: x[1], name: plain(x[2] || x[1]) });
  if (!names.length) { const t = plain(who); if (t) names.push({ target: t, name: t }); }
  return { names, work };
}
function resolveEn(n) {
  const cands = [n.name, n.target, n.target.replace(/\s*\([^)]*\)\s*$/, '')];
  for (const c of cands) { const k = norm(c); if (gEn.has(k)) return { gko: gEn.get(k) }; }
  for (const c of cands) { const a = aEn.get(norm(c)); if (a && a.length === 1) return { id: a[0].id }; }
  return null;
}
function parseDate(t) {
  let m = /\|\s*date\s*=\s*\{\{(?:Start date|start date|Start date and age)\|(\d{4})\|(\d{1,2})\|(\d{1,2})/i.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /\|\s*date\s*=\s*([A-Za-z]+) (\d{1,2})(?:[–-]\d{1,2})?, (\d{4})/.exec(t);
  const MO = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  if (m && MO.includes(m[1].toLowerCase())) return `${m[3]}-${String(MO.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = /\|\s*date\s*=\s*(\d{1,2})(?:[–-]\d{1,2})? ([A-Za-z]+) (\d{4})/.exec(t);
  if (m && MO.includes(m[2].toLowerCase())) return `${m[3]}-${String(MO.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function parseAwardsPage(text) {
  const t = clean(text), lines = t.split(/\r?\n/), cats = [];
  let cur = null, hidden = 0;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const am = /\{\{Award category\|[^|]*\|(.*)$/i.exec(line);
    if (am) {
      let title = am[1];
      const daesang = /daesang|grand prize|grand award/i.test(title);
      title = plain(title.replace(/<br\s*\/?>\s*\(?[^)]*\)?/gi, ' ').replace(/\}\}\s*$/, ''));
      cur = { en: title.replace(/\s*\((?:Daesang|Grand Prize)\)\s*/i, '').trim(), daesang, winners: [] };
      cats.push(cur); hidden = 0; continue;
    }
    if (!cur) continue;
    if (/\{\{Hidden/i.test(line)) hidden++;
    if (hidden && /^\}\}\s*$/.test(line)) { hidden--; continue; }
    if (/^\|-|^\|\}/.test(line)) { cur = null; continue; }
    if (!hidden && /^\*\s*'''/.test(line)) { const w = parseWinnerLine(line); if (w) cur.winners.push(w); }
    else if (!hidden && /^\*\*\s*'''/.test(line)) { const w = parseWinnerLine(line); if (w) cur.winners.push(w); }
  }
  return cats.filter(c => c.winners.length);
}

// 구형 문서: 표 머리글(! … | 부문명)이 칸 순서대로 부문, 칸 안의 굵은 글머리표가 수상자
function parseTablePage(text) {
  const lines = clean(text).split(/\r?\n/), cats = [];
  let headers = [], inTable = false, cell = -1, rowHasData = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\{\|/.test(line)) { inTable = true; headers = []; cell = -1; rowHasData = false; continue; }
    if (/^\|\}/.test(line)) { inTable = false; continue; }
    if (!inTable) continue;
    if (/^\|-/.test(line)) { if (rowHasData) { headers = []; rowHasData = false; } cell = -1; continue; }
    if (/^!/.test(line)) {
      if (rowHasData) { headers = []; rowHasData = false; }
      const m = /^!\s*(?:[^|[]*\|)?\s*(.*)$/.exec(line);
      headers.push(plain(m ? m[1] : '')); cell = -1; continue;
    }
    if (/^\|/.test(line)) { cell++; rowHasData = true; continue; }
    if (cell >= 0 && /^\*+\s*'''/.test(line) && headers[cell]) {
      const title = headers[cell], daesang = /daesang|grand prize/i.test(title);
      const en = title.replace(/\s*\((?:Daesang|Bonsang|Grand Prize)\)\s*/gi, ' ').trim();
      const last = cats[cats.length - 1];
      let c = last && last._h === headers && last._c === cell ? last : null;
      if (!c) { c = { en, daesang, winners: [], _h: headers, _c: cell }; cats.push(c); }
      const w = parseWinnerLine(line); if (w) c.winners.push(w);
    }
  }
  return cats.filter(c => c.winners.length);
}

async function collect(id, year, force) {
  const def = DEFS[id]; if (!def) throw new Error('모르는 시상식 id: ' + id);
  const out = path.join(ROOT, 'awards', `${id}-${year}.json`);
  if (fs.existsSync(out)) { const cur = JSON.parse(fs.readFileSync(out, 'utf8')); if (!cur.autoSource || !force) return `${id}-${year}: 이미 있음(건너뜀)`; }
  let page = null;
  for (const title of def.titles(year)) { const p = await wikitext(title); if (p && (/\{\{Award category/i.test(p.text) || /^\*+\s*'''/m.test(p.text))) { page = p; break; } }
  if (!page) return `${id}-${year}: 위키 문서·표 없음`;
  let cats = parseAwardsPage(page.text);
  if (!cats.length) cats = parseTablePage(page.text);
  if (!cats.length) return `${id}-${year}: 수상 표 파싱 0건`;
  const date = parseDate(page.text);
  // 회차의 연도 = 개최일 기준, 1~2월에 열린 시상식(골든디스크·서울가요대상·써클차트)은 전년도 시상 — 어느 연도로 요청해도 같은 파일 하나로 모인다
  const dm = date && /^(\d{4})-(\d{2})/.exec(date);
  if (dm) { year = +dm[1] - (+dm[2] <= 2 ? 1 : 0); }
  const outFinal = path.join(ROOT, 'awards', `${id}-${year}.json`);
  if (outFinal !== out && fs.existsSync(outFinal)) { const cur = JSON.parse(fs.readFileSync(outFinal, 'utf8')); if (!cur.autoSource || !force) return `${id}-${year}: 이미 있음(요청 ${out.slice(-9, -5)} → 같은 회차, 건너뜀)`; }
  let ext = 0, linked = 0;
  const categories = cats.map(c => {
    const winners = []; const work = c.winners.length === 1 ? (c.winners[0].work || '') : ''; // 수상자 줄이 하나일 때만 작품명(여러 팀이면 줄마다 달라 생략)
    for (const w of c.winners) {
      for (const n of w.names) {
        const r = resolveEn(n);
        if (r && r.gko) { winners.push({ name: n.name, gko: r.gko }); linked++; }
        else if (r && r.id) { winners.push({ name: n.name, id: r.id }); linked++; }
        else { winners.push({ name: n.name, ext: true }); ext++; }
      }
    }
    const seenW = new Set(); const uniq = winners.filter(w => { const k = w.name + '|' + (w.gko || w.id || ''); if (seenW.has(k)) return false; seenW.add(k); return true; }); // 같은 이름 부문이 여러 개(AAA 대상 등)면 합쳐지며 중복 → 제거
    const koName = koCategory(c.en); // 한글 부문명(번역 사전에 없으면 영어 그대로 — 화면에서 언어별로 고름)
    return { ko: koName || c.en, en: c.en, ...(koName ? { koAuto: true } : {}), tier: tierOf(c.en, c.daesang), winners: uniq, ...(work ? { work } : {}) };
  });
  const doc = {
    id, edition: String(year), name: def.name, nameEn: def.nameEn, dates: [date || String(year)], venue: '',
    src: ['https://en.wikipedia.org/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'))], autoSource: 'wikipedia', collectedAt: new Date().toISOString().slice(0, 10),
    note: '위키백과 영문판 표 자동 수집(수상자만, 부문명은 영문 그대로). 사람이 확인한 한글 정본이 생기면 그 파일로 교체.',
    categories,
  };
  fs.mkdirSync(path.join(ROOT, 'awards'), { recursive: true });
  fs.writeFileSync(outFinal, JSON.stringify(doc, null, 1) + '\n');
  return `${id}-${year}: ${categories.length}부문 · 연결 ${linked} · 미등록 ${ext} ← ${page.title}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--')), force = process.argv.includes('--force');
  const id = args[0]; const years = [];
  for (const a of args.slice(1)) { const m = /^(\d{4})-(\d{4})$/.exec(a); if (m) for (let y = +m[1]; y <= +m[2]; y++) years.push(y); else years.push(+a); }
  if (!id || !years.length) { console.log('사용: node tools/awards_wiki.mjs <id> <연도|시작-끝>...  (id: ' + Object.keys(DEFS).join(', ') + ')'); process.exit(1); }
  for (const y of years) { try { console.log(await collect(id, y, force)); } catch (e) { console.log(`${id}-${y}: 오류 ${e.message}`); } await new Promise(r => setTimeout(r, 2000)); }
}
