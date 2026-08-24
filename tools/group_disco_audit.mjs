#!/usr/bin/env node
// 그룹 디스코그래피 감사 (읽기 전용 — groups.json 수정 안 함)
//
// 8/23 에 시도한 "멜론 전체 diff"는 오탐 1,922건으로 신호가 약했음(멜론은 그룹 전 싱글·일본반까지
// 노출하고 groups.json 은 큐레이션이라 갭 != 누락). 그래서 여기서는 **타겟 검출**만 한다:
//   A) 내부 정합성 — 같은 번호 중복 / 같은 제목 중복 / 번호 불연속 / 한·영 이중등록
//   B) 나무위키 대조 — 종류·번호 오표기, json 에만 있는 유령 앨범, 나무위키 정규·미니 중 누락
//
// 출력: ~/Downloads/melon_solo_audit/group_disco_report.txt

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const OUT_DIR = path.join(os.homedir(), 'Downloads', 'melon_solo_audit');
const CACHE_DIR = path.join(OUT_DIR, 'cache');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

fs.mkdirSync(CACHE_DIR, { recursive: true });
const ONLY = (() => { const i = process.argv.indexOf('--groups'); return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null; })();

let reqCount = 0, cacheHits = 0;

const dec = s => (s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();

const namuMissing = h => !h || h.length < 5000 || /문서를 찾을 수 없습니다/.test(h);
function curlGet(url, cacheFile) {
  try { url = encodeURI(decodeURI(url)); } catch { url = encodeURI(url); }
  if (fs.existsSync(cacheFile)) {
    const h = fs.readFileSync(cacheFile, 'utf8');
    if (!namuMissing(h)) { cacheHits++; return h; }
    if (h.length > 5000) return '';
  }
  for (let i = 1; i <= 3; i++) {
    try {
      reqCount++;
      execFileSync('curl', ['-skL', '--max-time', '40', '-A', UA, url, '-o', cacheFile], { stdio: 'ignore' });
      const h = fs.readFileSync(cacheFile, 'utf8');
      if (!namuMissing(h)) return h;
      if (h.length > 5000) return '';
    } catch { /* 재시도 */ }
  }
  return '';
}

const flatten = h => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
                      .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

const NAMU_LABEL = '(?:정규|미니|싱글|EP|스페셜|리패키지|디지털 싱글|선공개 싱글|베스트|라이브|OST|리메이크)';
function parseNamuAlbums(text) {
  if (!text) return [];
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

  // ⚠ 섹션 헤더가 앨범 목록과 떨어져 있는 문서가 많다(TXT 등) — 헤더만으로는 일본/기타 음반을 못 가른다.
  //    한 섹션의 앨범은 날짜가 한 방향으로 흐르므로, 흐름이 되감기는 지점부터를 별도 구간으로 본다.
  //    (예: ... 미니 8집 2026.04.13 → 싱글 1집 2020.01.15 = 여기서부터 일본 음반)
  if (out.length >= 3) {
    const asc = out[1].date >= out[0].date;
    for (let i = 1; i < out.length; i++) {
      const back = asc ? out[i].date < out[i - 1].date : out[i].date > out[i - 1].date;
      if (back) { for (let j = i; j < out.length; j++) out[j].secondary = true; break; }
    }
  }
  return out;
}

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

/* ---------------------------------- main ---------------------------------- */

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
let names = Object.keys(groups).filter(k => groups[k].discography?.length);
if (ONLY) names = names.filter(n => ONLY.has(n));

const findings = [];   // {group, kind, severity, detail}
const push = (group, kind, severity, detail) => findings.push({ group, kind, severity, detail });

let noNamu = 0;
for (const gname of names) {
  const g = groups[gname];
  const disco = g.discography;

  /* ---- A) 내부 정합성 (수집 없이 즉시 판정 가능) ---- */

  // A1. 같은 종류·번호가 두 번 (에이프릴 "Dreaming" 미니1집/미니7집 류)
  // ⚠ 접두사(정규 1집)만 보면 "정규 1집 PART 2"·"정규 3집 Act 1/2" 같은 파트 앨범을 중복으로 오판한다.
  //    같은 번호를 의도적으로 쓰는 표기이므로 전체 문자열이 완전히 같을 때만 중복.
  const byType = {};
  for (const d of disco) {
    if (!/^(정규|미니)\s*\d+집$/.test(d.type)) continue;
    (byType[d.type] = byType[d.type] || []).push(d);
  }
  for (const [k, list] of Object.entries(byType)) {
    if (list.length > 1) push(gname, '번호중복', 'ERROR', `${k} 이 ${list.length}장 — ${list.map(d => `"${d.title}"(${d.releaseDate})`).join(' vs ')}`);
  }

  // A2. 같은 제목이 두 번
  const byTitle = {};
  for (const d of disco) (byTitle[normTitle(d.title)] = byTitle[normTitle(d.title)] || []).push(d);
  for (const [, list] of Object.entries(byTitle)) {
    if (list.length > 1) push(gname, '제목중복', 'ERROR', `"${list[0].title}" 이 ${list.length}번 — ${list.map(d => `${d.type}(${d.releaseDate})`).join(' vs ')}`);
  }

  // A3. 번호 불연속 (미니 1·2·4집 → 3집 빠짐)
  for (const kind of ['정규', '미니']) {
    const nos = disco.map(d => kindOf(d.type)).filter(x => x.kind === kind && x.no).map(x => x.no).sort((a, b) => a - b);
    if (nos.length < 2) continue;
    const miss = [];
    for (let i = 1; i <= nos[nos.length - 1]; i++) if (!nos.includes(i)) miss.push(i);
    if (miss.length) push(gname, '번호누락', 'WARN', `${kind} ${miss.join('·')}집 없음 (보유: ${nos.join(',')})`);
  }

  // A4. 한/영 이중등록 (같은 날짜에 제목만 다른 두 장)
  const byDate = {};
  for (const d of disco) if (d.releaseDate) (byDate[d.releaseDate] = byDate[d.releaseDate] || []).push(d);
  for (const [date, list] of Object.entries(byDate)) {
    if (list.length > 1) push(gname, '동일발매일', 'WARN', `${date} 에 ${list.length}장 — ${list.map(d => `"${d.title}"[${d.type}]`).join(' vs ')} (한/영 이중등록 의심)`);
  }

  /* ---- B) 나무위키 대조 ---- */
  // artists.json 과 마찬가지로 groups.json 의 나무위키 링크도 없는 문서를 가리키는 경우가 있어 폴백한다
  const cands = [g.links?.namu, `https://namu.wiki/w/${gname}`, g.en ? `https://namu.wiki/w/${g.en}` : null].filter(Boolean);
  let html = '', used = '';
  for (let i = 0; i < cands.length; i++) {
    html = curlGet(cands[i], path.join(CACHE_DIR, `gnamu_${encodeURIComponent(gname)}_${i}.html`));
    if (html) { used = cands[i]; if (i > 0 && g.links?.namu) push(gname, '나무위키링크오류', 'WARN', `현재 ${g.links.namu} → 정상 ${used}`); break; }
  }
  if (!html) { noNamu++; push(gname, '나무위키없음', 'INFO', `문서 수집 실패: ${cands.join(' , ')}`); continue; }
  const namu = parseNamuAlbums(flatten(html)).filter(n => !n.jp && !n.secondary && n.section !== '참여 음반');
  if (!namu.length) { push(gname, '나무위키파싱0', 'INFO', '음반 목록을 못 읽음 — 문서 형식 다름'); continue; }

  // B1. 종류/번호 오표기
  for (const d of disco) {
    const { kind, no } = kindOf(d.type);
    if (!no || (kind !== '정규' && kind !== '미니')) continue;
    const hit = namu.find(n => titleAgrees(n.title, d.title)) ||
                namu.find(n => n.date === d.releaseDate && titleAgrees(n.title, d.title));
    if (!hit) {
      push(gname, '유령앨범의심', 'WARN', `"${d.title}"[${d.type}] ${d.releaseDate} — 나무위키 음반 목록에 없음`);
      continue;
    }
    const nk = kindOf(hit.label.replace(/^EP/, '미니'));
    if (nk.no && (nk.kind !== kind || nk.no !== no)) {
      push(gname, '번호불일치', 'ERROR', `"${d.title}" — json ${d.type} vs 나무위키 ${hit.label} (${hit.date})`);
    }
  }

  // B2. 나무위키에 있는 정규/미니인데 json 에 없음
  for (const n of namu) {
    const nk = kindOf(n.label.replace(/^EP/, '미니'));
    if (!nk.no || (nk.kind !== '정규' && nk.kind !== '미니')) continue;
    if (/리패키지/.test(n.label)) continue;
    const hit = disco.find(d => titleAgrees(d.title, n.title));
    if (!hit) push(gname, '누락의심', 'WARN', `나무위키 ${n.label} "${n.title}" (${n.date}) — groups.json 에 없음`);
  }
}

/* --------------------------------- output --------------------------------- */

const order = { ERROR: 0, WARN: 1, INFO: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.group.localeCompare(b.group));

const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;

const L = [];
L.push('그룹 디스코그래피 감사 (읽기전용)');
L.push(`대상 ${names.length}개 그룹 / 앨범 ${names.reduce((s, n) => s + groups[n].discography.length, 0)}장 | 요청 ${reqCount} 캐시 ${cacheHits}`);
L.push(`검출 ${findings.length}건 — ERROR ${findings.filter(f => f.severity === 'ERROR').length} / WARN ${findings.filter(f => f.severity === 'WARN').length} / INFO ${findings.filter(f => f.severity === 'INFO').length}`);
L.push('');
L.push('[유형별]');
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) L.push(`  ${k}: ${v}건`);
L.push('');
for (const sev of ['ERROR', 'WARN', 'INFO']) {
  const list = findings.filter(f => f.severity === sev);
  if (!list.length) continue;
  L.push('='.repeat(70));
  L.push(`${sev} — ${list.length}건`);
  L.push('='.repeat(70));
  for (const f of list) L.push(`[${f.kind}] ${f.group}: ${f.detail}`);
  L.push('');
}
fs.writeFileSync(path.join(OUT_DIR, 'group_disco_report.txt'), L.join('\n'));
console.log(L.slice(0, 14).join('\n'));
console.log(`\n→ ${path.join(OUT_DIR, 'group_disco_report.txt')}`);
