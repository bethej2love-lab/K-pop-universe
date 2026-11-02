#!/usr/bin/env node
// 정규·미니 N집 차수 전수 점검(2026-11-02, 사용자 "앤팀·엑스러브만 틀린 게 아닐 텐데 전수 조사").
// 읽기 전용 — 고치지 않고 종류별로 보고만 한다. (disco_number_fill.mjs는 위치만 보고 채워서 일본 EP·리믹스·변형판에
// 번호를 주는 오답이 나와 쓰지 않는다: 예 "SWEAT -JAPANESE EP- → 미니 6집", 트레저 "3rd MINI ALBUM → 미니 5집")
//   ① title  : 제목에 차수가 적혀 있는데(3rd MINI ALBUM·The 1st Album·미니 3집) type 번호와 다름 — 제목이 증거라 확실
//   ② nonum  : type이 번호 없는 '미니'/'정규'/'EP'(한국 발매 본판만)
//   ③ seq    : 한국 본판 번호가 발매순으로 1,2,3…이 아님(중복·건너뜀·뒤바뀜)
//   ④ jpmix  : 일본 발매로 보이는데(region/제목) 한국 번호 줄에 끼어 있음 — 표시 확인용
// 사용: node tools/disco_ordinal_audit.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const JP_RE = /[-–(\[]\s*japan(?:ese)?\s*(?:ver\.?|version|ed(?:ition)?|ep|single|album)?\s*[-–)\]]|japanese\s+(?:ver\.?|version)|\bjp\s*ver\b|japan(?:ese)?\s+(?:ep|single|album|mini)/i;
const SIDE_RE = /remix|instrumental|inst\.|ver\.|version|edition|deluxe|repackage|리패키지|packages|extended|special|live|acoustic|sped|slowed|\bost\b|japanese|japan|\(.*ver/i;
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
function titleOrdinal(t) {
  t = String(t || '');
  let m = t.match(/(\d+)\s*(?:st|nd|rd|th)\s*(mini|ep|full|studio|regular|album)/i) || t.match(/the\s+(\d+)\s*(?:st|nd|rd|th)\s+(album)/i);
  if (m) return { n: +m[1], fam: /mini|ep/i.test(m[2]) ? '미니' : '정규' };
  m = t.match(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+(mini|ep|full|studio|album)/i);
  if (m) return { n: ORD[m[1].toLowerCase()], fam: /mini|ep/i.test(m[2]) ? '미니' : '정규' };
  m = t.match(/(미니|정규)\s*(\d+)\s*집/);
  if (m) return { n: +m[2], fam: m[1] };
  return null;
}
const famOf = type => /^(미니|EP)/.test(type || '') ? '미니' : /^정규/.test(type || '') ? '정규' : null;
const numOf = type => { const m = String(type || '').match(/^(?:미니|정규|EP)\s*(\d+)\s*집/); return m ? +m[1] : null; }; // "N집 리패키지"도 번호로
const isJp = a => a.region === 'jp' || JP_RE.test(a.title || '');
const out = { title: [], nonum: [], seq: [], jpmix: [] };
function audit(owner, disco) {
  if (!Array.isArray(disco) || !disco.length) return;
  for (const a of disco) {
    const f = famOf(a.type), n = numOf(a.type), to = titleOrdinal(a.title);
    if (to && f && to.fam === f && n != null && to.n !== n && !isJp(a)) out.title.push({ owner, date: a.releaseDate, title: a.title, type: a.type, should: `${to.fam} ${to.n}집` });
    if (to && f && to.fam === f && n == null && !isJp(a)) out.title.push({ owner, date: a.releaseDate, title: a.title, type: a.type, should: `${to.fam} ${to.n}집` });
  }
  for (const fam of ['미니', '정규']) {
    const main = disco.filter(a => famOf(a.type) === fam && !a.variant && !a.program && !/리패키지/.test(a.type) && !isJp(a));
    const noNum = main.filter(a => numOf(a.type) == null && !SIDE_RE.test(a.title || ''));
    noNum.forEach(a => out.nonum.push({ owner, fam, date: a.releaseDate, title: a.title, type: a.type }));
    const numbered = main.filter(a => numOf(a.type) != null).sort((x, y) => String(x.releaseDate).localeCompare(String(y.releaseDate)));
    const ns = numbered.map(a => numOf(a.type));
    const okSeq = ns.every((v, i) => v === i + 1);
    if (numbered.length && !okSeq) out.seq.push({ owner, fam, seq: numbered.map(a => `${numOf(a.type)}:${a.title}(${String(a.releaseDate).slice(0, 7)})`) });
    disco.filter(a => famOf(a.type) === fam && isJp(a) && numOf(a.type) != null && a.region !== 'jp').forEach(a => out.jpmix.push({ owner, fam, date: a.releaseDate, title: a.title, type: a.type }));
  }
}
for (const [g, info] of Object.entries(G)) audit(g, info.discography);
for (const a of (Array.isArray(A) ? A : Object.values(A))) { audit(`${a.name.ko}(${a.group && a.group.ko})`, a.discography); }
const owners = k => new Set(out[k].map(x => x.owner)).size;
console.log(`① 제목 차수와 다름 ${out.title.length}건(${owners('title')}팀) · ② 번호 없음 ${out.nonum.length}건(${owners('nonum')}팀) · ③ 순서 안 맞음 ${out.seq.length}줄(${owners('seq')}팀) · ④ 일본반이 한국 줄에 ${out.jpmix.length}건`);
const ji = process.argv.indexOf('--json');
if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify(out, null, 1));
else { for (const k of Object.keys(out)) { console.log('\n== ' + k); out[k].slice(0, 15).forEach(x => console.log(' ', JSON.stringify(x))); } }
