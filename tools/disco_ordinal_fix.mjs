#!/usr/bin/env node
// 정규·미니 N집 차수 — **근거가 데이터 안에 있는 것만** 고친다(2026-11-02, disco_ordinal_audit.mjs 후속).
//   A. 제목에 차수가 적힌 앨범(3rd MINI ALBUM·The 1st Album·미니 3집): type을 그 번호로. 제목에 Repackage/리패키지가 있으면 "N집 리패키지".
//      (Chapter·Vol.·Take·Special Edition처럼 한 차수의 일부인 것도 같은 번호 — 한 정규의 나눠 낸 판)
//   B. 양쪽에 번호 있는 앨범 사이의 빈칸: 앞 번호 a, 뒤 번호 b, 그 사이 번호 없는 본판이 정확히 b-a-1개면 a+1…로 채움.
//      맨 끝(마지막 번호 뒤)·맨 앞은 채우지 않는다 — 데이터에 빠진 앨범이나 싱글이 미니로 잘못 들어온 경우(예: 에스파 Dirty Work)에 번호가 밀린다.
// 일본 발매(region jp·제목 Japanese/JP ver)·변형판(variant)·데뷔 전 프로그램(program)은 건드리지 않는다.
// 사용: node tools/disco_ordinal_fix.mjs [--apply]   (⚠️ --apply 후 node tools/build_slim_data.mjs)
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const APPLY = process.argv.includes('--apply');
const JP_RE = /[-–(\[]\s*japan(?:ese)?\s*(?:ver\.?|version|ed(?:ition)?|ep|single|album)?\s*[-–)\]]|japanese\s+(?:ver\.?|version)|\bjp\s*ver\b|japan(?:ese)?\s+(?:ep|single|album|mini)/i;
const SIDE_RE = /remix|instrumental|inst\.|deluxe|packages|extended|acoustic|sped|slowed|\bost\b|japanese|japan|\bver\b|version/i;
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
function titleOrdinal(t) {
  t = String(t || '');
  let m = t.match(/(\d+)\s*(?:st|nd|rd|th)\s*(mini|ep|full|studio|regular|album)/i);
  if (m) return { n: +m[1], fam: /mini|ep/i.test(m[2]) ? '미니' : '정규' };
  m = t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(mini|ep|full|studio|album)/i);
  if (m) return { n: ORD[m[1].toLowerCase()], fam: /mini|ep/i.test(m[2]) ? '미니' : '정규' };
  m = t.match(/(미니|정규)\s*(\d+)\s*집/);
  if (m) return { n: +m[2], fam: m[1] };
  return null;
}
const famOf = type => /^(미니|EP)/.test(type || '') ? '미니' : /^정규/.test(type || '') ? '정규' : null;
const numOf = type => { const m = String(type || '').match(/^(?:미니|정규|EP)\s*(\d+)\s*집/); return m ? +m[1] : null; };
const isJp = a => a.region === 'jp' || JP_RE.test(a.title || '');
const changes = [];
function fix(owner, disco) {
  if (!Array.isArray(disco)) return;
  // A
  for (const a of disco) {
    if (isJp(a) || a.program) continue;
    const f = famOf(a.type), to = titleOrdinal(a.title);
    if (!f || !to || to.fam !== f) continue;
    const re = /repackage|리패키지|edition|special ver/i.test(a.title) || /리패키지/.test(a.type); // Special/Deluxe/Grand Edition = 재발매(리패키지)
    const want = `${f} ${to.n}집${re ? ' 리패키지' : ''}`;
    if (a.type !== want) { changes.push({ owner, kind: 'A', date: a.releaseDate, title: a.title, from: a.type, to: want }); if (APPLY) a.type = want; }
  }
  // B
  for (const fam of ['미니', '정규']) {
    const main = disco.filter(a => famOf(a.type) === fam && !a.variant && !a.program && !/리패키지/.test(a.type) && !isJp(a) && !SIDE_RE.test(a.title || ''))
      .sort((x, y) => String(x.releaseDate).localeCompare(String(y.releaseDate)));
    for (let i = 0; i < main.length; i++) {
      if (numOf(main[i].type) == null) continue;
      let j = i + 1; while (j < main.length && numOf(main[j].type) == null) j++;
      if (j >= main.length) break;
      const a = numOf(main[i].type), b = numOf(main[j].type), gap = main.slice(i + 1, j);
      if (gap.length && b - a - 1 === gap.length) gap.forEach((x, k) => { const want = `${fam} ${a + 1 + k}집`; changes.push({ owner, kind: 'B', date: x.releaseDate, title: x.title, from: x.type, to: want }); if (APPLY) x.type = want; });
      i = j - 1;
    }
  }
}
function run(file, iter) {
  const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const indent = (raw.match(/^[\[{]\r?\n( +)/) || [, '  '])[1];
  const data = JSON.parse(raw);
  iter(data);
  if (APPLY) { let out = JSON.stringify(data, null, indent); if (raw.includes('\r\n')) out = out.replace(/\n/g, '\r\n'); if (/\r?\n$/.test(raw)) out += raw.includes('\r\n') ? '\r\n' : '\n'; fs.writeFileSync(path.join(ROOT, file), out); }
}
run('groups.json', G => { for (const [g, info] of Object.entries(G)) fix(g, info.discography); });
run('artists.json', A => { for (const a of (Array.isArray(A) ? A : Object.values(A))) fix(`${a.name.ko}(${a.group && a.group.ko})`, a.discography); });
console.log(`${APPLY ? '반영' : '[dry]'} A(제목 근거) ${changes.filter(c => c.kind === 'A').length}건 · B(양쪽 번호 사이) ${changes.filter(c => c.kind === 'B').length}건`);
changes.forEach(c => console.log(`  ${c.kind} ${c.owner} ${c.date} ${c.title.slice(0, 50)} : ${c.from} → ${c.to}`));
