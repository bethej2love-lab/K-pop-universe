#!/usr/bin/env node
// 그룹 디스코 번호불일치 자동 수정 (group_disco_audit.mjs 의 ERROR [번호불일치] 대상)
//   - 나무위키 표기를 정본으로 groups.json 의 type 을 교체한다.
//   - 한 나무위키 항목에 json 앨범이 둘 이상 붙는 경우(오매칭 신호)는 건드리지 않는다.
//   - 실행 전 groups.json.bak-predisco 백업(최초 1회).
// 사용법: node tools/group_disco_fix.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const CACHE_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit', 'cache');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const APPLY = process.argv.includes('--apply');

const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
const missing = h => !h || h.length < 5000 || /문서를 찾을 수 없습니다/.test(h);
const flatten = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const normTitle = s => (s || '').normalize('NFKC').toLowerCase().replace(/[\s'’"“”()[\]!?.,\-_:&]/g, '');
const stripParen = s => (s || '').replace(/[(（[].*?[)）\]]/g, ' ');
const titleAgrees = (a, b) => {
  for (const [p, q] of [[a, b], [stripParen(a), stripParen(b)]]) {
    const x = normTitle(p), y = normTitle(q);
    if (!x || !y) continue;
    if (x === y) return true;
    if ((x.length >= 4 && y.length >= 4) && (x.includes(y) || y.includes(x))) return true;
  }
  return false;
};
const kindOf = t => {
  const m = (t || '').match(/^(정규|미니|싱글)\s*(\d+)?집?/);
  return m ? { kind: m[1], no: m[2] ? Number(m[2]) : null } : { kind: (t || '').trim(), no: null };
};

const NAMU_LABEL = '(?:정규|미니|싱글|EP|스페셜|리패키지|디지털 싱글|선공개 싱글|베스트|라이브|OST|리메이크)';
function parseNamuAlbums(text) {
  const out = [];
  const re = new RegExp(`([^\\]]{1,60}?)\\s+((?:${NAMU_LABEL})[^0-9]{0,12}(?:\\d+집)?(?:\\s*리패키지)?)\\s+(\\d{4})\\.\\s*(\\d{1,2})\\.\\s*(\\d{1,2})\\.?(?![0-9])`, 'g');
  let m;
  while ((m = re.exec(text))) {
    out.push({
      title: dec(m[1]).replace(/^.*?\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?\s*/, '').replace(/^[\s\W_]+/, '').trim(),
      label: dec(m[2]).replace(/\s+/g, ' ').trim(),
      date: `${m[3]}.${String(m[4]).padStart(2, '0')}.${String(m[5]).padStart(2, '0')}`,
      idx: m.index,
    });
  }
  const marks = [];
  for (const label of ['한국 음반', '일본 음반', '참여 음반', '음반 목록', '관련 문서', '디스코그래피']) {
    let i = -1;
    while ((i = text.indexOf(label, i + 1)) >= 0) marks.push({ i, label });
  }
  marks.sort((a, b) => a.i - b.i);
  for (const a of out) {
    let cur = null;
    for (const mk of marks) { if (mk.i < a.idx) cur = mk; else break; }
    a.section = cur?.label || '';
    a.jp = cur?.label === '일본 음반';
  }
  if (out.length >= 3) {
    const asc = out[1].date >= out[0].date;
    for (let i = 1; i < out.length; i++) {
      const back = asc ? out[i].date < out[i - 1].date : out[i].date > out[i - 1].date;
      if (back) { for (let j = i; j < out.length; j++) out[j].secondary = true; break; }
    }
  }
  return out.filter(n => !n.jp && !n.secondary && n.section !== '참여 음반');
}

function readNamu(gname, g) {
  const cands = [g.links?.namu, `https://namu.wiki/w/${gname}`, g.en ? `https://namu.wiki/w/${g.en}` : null].filter(Boolean);
  for (let i = 0; i < cands.length; i++) {
    const f = path.join(CACHE_DIR, `gnamu_${encodeURIComponent(gname)}_${i}.html`);
    if (fs.existsSync(f)) {
      const h = fs.readFileSync(f, 'utf8');
      if (!missing(h)) return h;
    }
  }
  return '';
}

const P = path.join(ROOT, 'groups.json');
const groups = JSON.parse(fs.readFileSync(P, 'utf8'));

const fixes = [], skips = [];
for (const [gname, g] of Object.entries(groups)) {
  if (!g.discography?.length) continue;
  const html = readNamu(gname, g);
  if (!html) continue;
  const namu = parseNamuAlbums(flatten(html));
  if (!namu.length) continue;

  // 한 나무위키 항목에 json 앨범이 여러 개 붙으면 오매칭이므로 그 항목은 통째로 제외
  const claims = new Map();
  for (const d of g.discography) {
    const hit = namu.find(n => titleAgrees(n.title, d.title));
    if (!hit) continue;
    if (!claims.has(hit)) claims.set(hit, []);
    claims.get(hit).push(d);
  }

  // ⚠ 매칭된 앨범만 번호를 바꾸면, 매칭 안 된 앨범이 들고 있는 옛 번호와 충돌한다(실제로 8건 발생).
  //    그래서 "그 그룹의 정규/미니가 전부 1:1로 매칭된 그룹"만 통째로 재번호한다.
  // 한 나무위키 항목에 json 앨범이 여러 장 붙는 그룹(에이프릴 "Dreaming" 중복 등)은
  // 번호 체계 자체를 신뢰할 수 없으므로 통째로 손대지 않는다.
  const ambiguous = [...claims.entries()].filter(([, list]) => list.length > 1);
  if (ambiguous.length) {
    skips.push(`${gname}: 나무위키 1항목에 json 여러 장이 매칭(${ambiguous.map(([h, l]) => `"${h.title}"×${l.length}`).join(', ')}) — 그룹 전체 건너뜀`);
    continue;
  }

  for (const [hit, list] of claims) {
    if (list.length > 1) { skips.push(`${gname}: 나무위키 "${hit.title}"[${hit.label}] 에 json ${list.length}장이 매칭 — 건너뜀`); continue; }
    const d = list[0];
    const cur = kindOf(d.type);
    if (!cur.no || (cur.kind !== '정규' && cur.kind !== '미니')) continue;
    const nk = kindOf(hit.label.replace(/^EP/, '미니'));
    if (!nk.no || (nk.kind !== '정규' && nk.kind !== '미니' && nk.kind !== '싱글')) continue;
    if (/리패키지/.test(hit.label)) continue;
    const next = nk.kind === '싱글' ? '싱글' : `${nk.kind} ${nk.no}집`;
    if (next === d.type) continue;

    // ⚠ 종류 자체가 바뀌는 건(정규→싱글 등) 오매칭일 때 피해가 크다.
    //    빅뱅 "MADE"(정규 3집)가 MADE 시리즈 싱글에 걸린 사례가 있어, 종류가 바뀔 땐 발매일도 맞아야 채택한다.
    if (nk.kind !== cur.kind) {
      const dd = Math.abs(new Date(d.releaseDate.replace(/\./g, '-')) - new Date(hit.date.replace(/\./g, '-'))) / 86400000;
      if (!(dd <= 31)) { skips.push(`${gname}: "${d.title}" ${cur.kind}→${nk.kind} 인데 발매일이 ${Math.round(dd)}일 차이(json ${d.releaseDate} vs 나무위키 ${hit.date}) — 건너뜀`); continue; }
    }
    fixes.push({ gname, title: d.title, date: d.releaseDate, from: d.type, to: next, ref: hit.label, d });
  }
}

// --- 적용 후 그룹 내부에서 번호가 겹치는지 시뮬레이션. 겹치는 그룹은 통째로 뺀다.
//     (매칭 안 된 앨범이 들고 있던 옛 번호로 재번호가 들어가면 중복이 생김)
const fixByGroup = {};
for (const f of fixes) (fixByGroup[f.gname] = fixByGroup[f.gname] || []).push(f);
const collided = new Set();
for (const [gname, list] of Object.entries(fixByGroup)) {
  const sim = new Map(list.map(f => [f.d, f.to]));
  const seen = new Map();
  for (const d of groups[gname].discography) {
    const t = sim.get(d) ?? d.type;
    const k = kindOf(t);
    if (!k.no || (k.kind !== '정규' && k.kind !== '미니')) continue;
    const key = `${k.kind} ${k.no}집`;
    if (seen.has(key)) {
      collided.add(gname);
      skips.push(`${gname}: 재번호하면 "${key}" 가 "${seen.get(key)}" 와 "${d.title}" 로 중복 — 그룹 전체 건너뜀(수동 재구성 필요)`);
      break;
    }
    seen.set(key, d.title);
  }
}
for (let i = fixes.length - 1; i >= 0; i--) if (collided.has(fixes[i].gname)) fixes.splice(i, 1);

console.log(`수정 대상 ${fixes.length}장 / 건너뜀 ${skips.length}건`);
const byGroup = {};
for (const f of fixes) (byGroup[f.gname] = byGroup[f.gname] || []).push(f);
for (const [g, list] of Object.entries(byGroup)) {
  console.log(`\n■ ${g} (${list.length}장)`);
  for (const f of list) console.log(`   "${f.title}" ${f.date}: ${f.from} → ${f.to}  (나무위키 "${f.ref}")`);
}
if (skips.length) { console.log('\n[건너뜀]'); skips.forEach(s => console.log('   ' + s)); }

if (!APPLY) { console.log('\n[dry] 저장 안 함 — --apply 로 반영'); process.exit(0); }
for (const f of fixes) f.d.type = f.to;
if (!fs.existsSync(P + '.bak-predisco')) fs.copyFileSync(P, P + '.bak-predisco');
fs.writeFileSync(P, JSON.stringify(groups, null, 2));
console.log(`\ngroups.json 저장 완료 (백업: groups.json.bak-predisco)`);
