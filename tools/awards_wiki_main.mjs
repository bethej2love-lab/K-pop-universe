// 위키백과 영문판 "메인 문서 연도표" 수상 수집기 (2026-11-17, awards_wiki.mjs의 짝)
// 왜 따로 있나: 옛 회차(가온/써클 2012~2019·AAA 2016~2021·서울가요대상 ~2019·골든디스크 ~2006)는
// 회차별 문서가 없거나 메인 문서로 리다이렉트된다. 메인 문서는 **부문별 섹션(== / ===) 아래
// 연도별 행 표**(! scope="row" | 13th / | 2023 / | [[수상자]]…) 형식이라 awards_wiki.mjs의
// 회차 문서 파서(parseAwardsPage/parseTablePage)로는 0건이 나온다.
// 실행: node tools/awards_wiki_main.mjs gaon 2012-2019
//       node tools/awards_wiki_main.mjs aaa 2016-2021 2024
// 이미 awards/{id}-{연도}.json 이 있으면 건너뜀(사람·회차문서 수집분 보호). --force는 autoSource 파일만 덮어씀.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clean, plain, resolveEn, tierOf } from './awards_wiki.mjs';
import { koCategory } from './awards_ko.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const DEFS = {
  gaon: { name: '써클차트 뮤직어워즈', nameEn: 'Circle Chart Music Awards', page: 'Circle Chart Music Awards' },
  aaa: { name: '아시아 아티스트 어워즈', nameEn: 'Asia Artist Awards', page: 'Asia Artist Awards' },
  sma: { name: '서울가요대상', nameEn: 'Seoul Music Awards', page: 'Seoul Music Awards' },
  gda: { name: '골든디스크어워즈', nameEn: 'Golden Disc Awards', page: 'Golden Disc Awards' },
  mma: { name: '멜론뮤직어워드', nameEn: 'Melon Music Awards', page: 'Melon Music Awards' },
};

// 표 밖 보일러플레이트 섹션 — 이 제목 아래 표는 수상 표가 아니다
const SKIP_HEAD = /^(ceremonies|host venues|winners|notes|references|see also|external links|most awarded|criticism|controvers|history|broadcast|hosts?|discontinued|other awards)\b/i;

async function wikitext(title) {
  const u = 'https://en.wikipedia.org/w/api.php?action=parse&prop=wikitext&format=json&formatversion=2&redirects=1&page=' + encodeURIComponent(title);
  let j = null;
  for (let t = 0; t < 8 && !j; t++) {
    const r = await fetch(u, { headers: { 'User-Agent': 'kpopuniverse-awards/1.0 (K-pop data; polite crawler)' } });
    const body = await r.text();
    try { j = JSON.parse(body); } catch { await new Promise(res => setTimeout(res, 15000 * (t + 1))); }
  }
  if (!j) throw new Error('위키 응답 없음(요청 제한)');
  return j.parse ? { title: j.parse.title, text: j.parse.wikitext } : null;
}

// 셀 하나: 'rowspan="2" style=…|내용' → {span, text}. 속성부와 내용을 가르는 '|'는 [[링크|표기]]의 '|'와 다르다.
function splitCell(raw) {
  let s = raw;
  let span = 1;
  const sm = /rowspan\s*=\s*"?(\d+)/i.exec(s);
  if (sm) span = +sm[1];
  // 속성|내용 — 내용에 [[ ]]나 공백이 오기 전의 첫 '|'까지가 속성(링크 안 '|'는 제외)
  const pi = s.indexOf('|');
  if (pi >= 0 && !s.slice(0, pi).includes('[[') && /[=]/.test(s.slice(0, pi))) s = s.slice(pi + 1);
  return { span, text: s.trim() };
}

// {| … |} 표 → 행렬(rowspan은 아래 행으로 전달)
function parseTable(lines) {
  const rows = [];
  let cur = [];            // 이번 행의 셀 텍스트들
  const carry = [];        // col index → {left, text}
  const flush = () => {
    if (!cur.length && !carry.some(c => c && c.left > 0)) return;
    // carry를 열 위치에 맞춰 끼워넣기
    const eff = [];
    let gi = 0;
    for (let col = 0; col < cur.length + carry.filter(c => c && c.left > 0).length; col++) {
      if (carry[col] && carry[col].left > 0) { eff.push(carry[col].text); carry[col].left--; }
      else if (gi < cur.length) { eff.push(cur[gi].text); if (cur[gi].span > 1) carry[col] = { left: cur[gi].span - 1, text: cur[gi].text }; gi++; }
    }
    if (eff.length) rows.push(eff);
    cur = [];
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\|-/.test(line)) { flush(); continue; }
    if (/^\|\+/.test(line)) continue;                 // 캡션
    if (/^!/.test(line)) {                            // 머리글 — scope="row"(회차 칸)만 데이터로
      if (/scope\s*=\s*"row"/i.test(line)) cur.push(splitCell(line.replace(/^!+\s*/, '')));
      continue;
    }
    if (/^\|/.test(line)) {
      for (const part of line.replace(/^\|\s*/, '').split('||')) cur.push(splitCell(part));
    }
  }
  flush();
  return rows;
}

// 본문 전체 → { year → [{en, daesang, winners:[{name,target}]}…] }
export function parseMainArticle(text) {
  const t = clean(text);
  const lines = t.split(/\r?\n/);
  const byYear = new Map();
  let head = '';
  let buf = null;     // 표 안 줄들
  const NOT_WINNER = /^(not awarded|none|n\/a|—|–|-|tba|cancelled)$/i;
  const flushTable = () => {
    if (!buf) return;
    const rows = parseTable(buf); buf = null;
    if (!head || SKIP_HEAD.test(head)) return;
    const daesang = /daesang|grand prize|grand award/i.test(head);
    const en = plain(head).replace(/\s*\((?:Daesang|Bonsang|Grand Prize)\)\s*/gi, ' ').replace(/\s*\(.*?award.*?\)\s*/gi, ' ').trim();
    for (const cells of rows) {
      // 연도 칸: 'YYYY' 단독(링크 제거 후). 회차('13th')는 건너뜀
      let yi = -1, year = 0;
      for (let i = 0; i < cells.length && i < 4; i++) {
        const p = plain(cells[i]);
        const ym = /^((?:19|20)\d{2})$/.exec(p);
        if (ym) { yi = i; year = +ym[1]; break; }
      }
      if (!year) continue;
      const winners = [];
      for (let i = yi + 1; i < cells.length; i++) {
        // 작품(앨범 ''…''·곡 "…")은 수상자가 아니다 — 그 표기 안의 링크는 지우고 수상자 링크만 남긴다
        const cell = cells[i].replace(/''[^'][\s\S]*?''/g, ' ').replace(/"[^"]*"/g, ' ');
        const p = plain(cell);
        if (!p || NOT_WINNER.test(p)) continue;
        const re = /\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g; let x;
        while ((x = re.exec(cell))) {
          const name = plain(x[2] || x[1]);
          if (!name || /^#|list of|discograph/i.test(x[1])) continue;
          winners.push({ target: x[1], name });
        }
        // 링크 없는 셀: 작품명·따옴표 곡명이 많아 수상자로는 안 담는다(사람 이름이면 위키가 보통 링크를 건다)
      }
      if (!winners.length) continue;
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push({ en, daesang, winners });
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const hm = /^(={2,4})\s*(.+?)\s*\1\s*$/.exec(line);
    if (hm) { flushTable(); if (hm[1].length <= 3) head = hm[2]; else if (!/current|previous|format/i.test(hm[2])) head = hm[2]; continue; }
    if (/^\{\|/.test(line)) { flushTable(); buf = []; continue; }
    if (buf !== null) { if (/^\|\}/.test(line)) { flushTable(); } else buf.push(line); }
  }
  flushTable();
  return byYear;
}

function buildDoc(id, def, year, cats, pageTitle) {
  let linked = 0, ext = 0;
  const categories = cats.map(c => {
    const winners = [];
    for (const n of c.winners) {
      const r = resolveEn(n);
      if (r && r.gko) { winners.push({ name: n.name, gko: r.gko }); linked++; }
      else if (r && r.id) { winners.push({ name: n.name, id: r.id }); linked++; }
      else { winners.push({ name: n.name, ext: true }); ext++; }
    }
    const seen = new Set();
    const uniq = winners.filter(w => { const k = w.name + '|' + (w.gko || w.id || ''); if (seen.has(k)) return false; seen.add(k); return true; });
    const koName = koCategory(c.en);
    return { ko: koName || c.en, en: c.en, ...(koName ? { koAuto: true } : {}), tier: tierOf(c.en, c.daesang), winners: uniq };
  }).filter(c => c.winners.length);
  // 같은 부문명이 표 2개(현재/예전 형식)에서 두 번 나오면 수상자 합치기
  const merged = [];
  for (const c of categories) {
    const prev = merged.find(m => m.en === c.en);
    if (prev) { const seen = new Set(prev.winners.map(w => w.name + '|' + (w.gko || w.id || ''))); for (const w of c.winners) { const k = w.name + '|' + (w.gko || w.id || ''); if (!seen.has(k)) prev.winners.push(w); } }
    else merged.push(c);
  }
  return {
    doc: {
      id, edition: String(year), name: def.name, nameEn: def.nameEn, dates: [String(year)], venue: '',
      src: ['https://en.wikipedia.org/wiki/' + encodeURIComponent(pageTitle.replace(/ /g, '_'))], autoSource: 'wikipedia-main', collectedAt: new Date().toISOString().slice(0, 10),
      note: '위키백과 영문판 메인 문서 연도표 자동 수집(수상자만·회차 문서 없음). 사람이 확인한 정본이 생기면 교체.',
      categories: merged,
    }, linked, ext,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--')), force = process.argv.includes('--force');
  const id = args[0]; const years = [];
  for (const a of args.slice(1)) { const m = /^(\d{4})-(\d{4})$/.exec(a); if (m) for (let y = +m[1]; y <= +m[2]; y++) years.push(y); else years.push(+a); }
  const def = DEFS[id];
  if (!def || !years.length) { console.log('사용: node tools/awards_wiki_main.mjs <id> <연도|시작-끝>...  (id: ' + Object.keys(DEFS).join(', ') + ')'); process.exit(1); }
  const page = await wikitext(def.page);
  if (!page) { console.log('메인 문서 없음: ' + def.page); process.exit(1); }
  const byYear = parseMainArticle(page.text);
  console.log(`${def.page}: 표에서 찾은 연도 ${[...byYear.keys()].sort().join(' ')}`);
  for (const y of years) {
    const out = path.join(ROOT, 'awards', `${id}-${y}.json`);
    if (fs.existsSync(out)) { const cur = JSON.parse(fs.readFileSync(out, 'utf8')); if (!cur.autoSource || !force) { console.log(`${id}-${y}: 이미 있음(건너뜀)`); continue; } }
    const cats = byYear.get(y);
    if (!cats || !cats.length) { console.log(`${id}-${y}: 표에 그 연도 없음`); continue; }
    const { doc, linked, ext } = buildDoc(id, def, y, cats, page.title);
    fs.writeFileSync(out, JSON.stringify(doc, null, 1) + '\n');
    console.log(`${id}-${y}: ${doc.categories.length}부문 · 연결 ${linked} · 미등록 ${ext}`);
  }
}
