#!/usr/bin/env node
// 나무위키 링크 전수 점검 — artists.json 의 links.namu 가 실재하는 문서를 가리키는지 확인.
//
//  깨진 링크는 "이름" 단독 / "이름(가수)" / "이름(영문그룹명)" 후보로 회수하되,
//  ⚠ 단독명은 동음이의 문서일 수 있으므로(렌·JR·소유·지코 등) **그룹명이 문서에 언급되고
//    동음이의 문서가 아닐 때만** 채택한다. 판단이 안 서면 손대지 않고 목록으로 남긴다.
//
// 사용법: node tools/namu_link_sweep.mjs [--apply] [--limit N]

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const CACHE = path.join(os.homedir(), 'Downloads', 'melon_solo_audit', 'namu_sweep');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const APPLY = process.argv.includes('--apply');
const LIMIT = (() => { const i = process.argv.indexOf('--limit'); return i >= 0 ? Number(process.argv[i + 1]) : 0; })();

fs.mkdirSync(CACHE, { recursive: true });

const missing = h => !h || h.length < 5000 || /문서를 찾을 수 없습니다/.test(h);
// ⚠ 나무위키는 연속 요청에 스로틀링을 건다. 1,714명 전수 첫 실행에서 "없는 문서" 판정이
//    뒤로 갈수록 2%→16% 로 늘었는데, 실제로는 다니엘(NewJeans)·키(샤이니)처럼 존재하는 문서였다.
//    없다고 결론내기 전에 반드시 딜레이+재시도로 재확인할 것.
const sleepSync = ms => { const t = Date.now(); while (Date.now() - t < ms); };
// 동음이의 **문서**인지 판정. ⚠ "동음이의"라는 낱말이 있는지로 보면 안 된다 — 나무위키는 동명이의
// 문서를 가진 **정상 문서 맨 위에 안내 문장**을 단다("동음이의어에 대한 내용은 ○○ 문서를 참고하십시오").
// 그래서 원래 판정은 /w/원필·/w/문별처럼 멀쩡한 멤버 문서를 전부 "동음이의"로 걷어차고 있었고, 그 때문에
// 회수 가능한 링크 41건이 통째로 "불명"에 갇혀 있었다(2026-09-04 실측으로 원인 확정).
// 그 안내 문장을 먼저 지운 뒤에 본다 — 안내를 빼고도 남으면 그건 진짜 동음이의 문서다.
const HATNOTE = /[^.]{0,80}?에 대한 내용은[^.]{0,120}?문서를 참고하십시오\.?/g;
const disamb = h => {
  const t = h.replace(/<[^>]+>/g, ' ').slice(0, 20000).replace(HATNOTE, ' ');
  return /동음이의|다음을 찾으시나요|여러 뜻/.test(t);
};

let fetched = 0;
// 존재 확인만 할 땐 앞부분(60KB)만 받는다 — 없는 문서는 통째로 35KB 라 이 안에 다 들어오고,
// 1,700명 전수를 통짜로 받으면 1.7GB 가 되어버린다. 후보 검증(그룹명 언급 확인)만 전체를 받는다.
function fetchDoc(url, key, { partial = false } = {}) {
  const f = path.join(CACHE, `${encodeURIComponent(key)}${partial ? '.part' : ''}.html`);
  if (!fs.existsSync(f) || fs.statSync(f).size < 500) {
    const args = ['-skL', '--max-time', '40', '-A', UA];
    if (partial) args.push('--range', '0-61440');
    args.push(encodeURI(decodeURI(url)), '-o', f);
    for (let i = 0; i < 3; i++) {
      try { execFileSync('curl', args, { stdio: 'ignore' }); fetched++; } catch { /* 재시도 */ }
      const h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      if (!missing(h)) break;
      sleepSync(900 * (i + 1));
    }
  }
  const h = fs.readFileSync(f, 'utf8');
  return missing(h) ? '' : h;
}

const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

let targets = artists.filter(a => a?.links?.namu);

// --recheck: 앞선 실행에서 "회수/불명" 으로 분류된 사람만 캐시를 비우고 다시 확인(스로틀링 오판 제거)
if (process.argv.includes('--recheck')) {
  const rep = path.join(os.homedir(), 'Downloads', 'melon_solo_audit', 'namu_link_report.txt');
  const txt = fs.readFileSync(rep, 'utf8');
  const names = new Set();
  for (const m of txt.matchAll(/^ {3}(\S.*?)\((.*?)\)/gm)) names.add(`${m[1]}|${m[2]}`);
  targets = targets.filter(a => names.has(`${a.name.ko}|${a.group?.ko || ''}`));
  for (const a of targets) {
    for (const f of fs.readdirSync(CACHE)) {
      if (decodeURIComponent(f).startsWith(`${a.name.ko}_${a.group?.ko || ''}_`)) fs.rmSync(path.join(CACHE, f));
    }
  }
  console.log(`[재확인] ${targets.length}명 (캐시 비움)`);
}

if (LIMIT) targets = targets.slice(0, LIMIT);
console.log(`[나무위키 링크 점검] 대상 ${targets.length}명`);

const ok = [], recovered = [], broken = [];
let done = 0;

for (const a of targets) {
  const ko = a.name.ko, gk = a.group?.ko || '';
  const cur = fetchDoc(a.links.namu, `${ko}_${gk}_cur`, { partial: true });
  if (cur) { ok.push(a); }
  else {
    const en = groups[gk]?.en;
    const cands = [
      [`https://namu.wiki/w/${ko}`, 'bare'],
      [`https://namu.wiki/w/${ko}(가수)`, 'singer'],
      en ? [`https://namu.wiki/w/${ko}(${en})`, 'en'] : null,
    ].filter(Boolean);
    let found = null;
    for (const [url, tag] of cands) {
      const h = fetchDoc(url, `${ko}_${gk}_${tag}`);
      if (!h) continue;
      const txt = h.replace(/<[^>]+>/g, ' ');
      if (!txt.includes(gk) || disamb(h)) continue;   // 동명이인 문서 방지
      found = url;
      break;
    }
    if (found) recovered.push({ a, url: decodeURI(found) });
    else broken.push(a);
  }
  if (++done % 100 === 0) console.log(`  ...${done}/${targets.length} | 신규요청 ${fetched} | 정상 ${ok.length} 회수 ${recovered.length} 불명 ${broken.length}`);
}

console.log(`\n정상 ${ok.length} | 회수 ${recovered.length} | 불명 ${broken.length}`);
const L = [];
L.push(`나무위키 링크 전수 점검 — 대상 ${targets.length}명`);
L.push(`정상 ${ok.length} / 회수 가능 ${recovered.length} / 불명 ${broken.length}`);
L.push('');
L.push('[회수]');
for (const r of recovered) L.push(`   ${r.a.name.ko}(${r.a.group?.ko})\n      현재: ${decodeURI(r.a.links.namu)}\n      정상: ${r.url}`);
L.push('');
L.push('[불명 — 손대지 않음]');
for (const b of broken) L.push(`   ${b.name.ko}(${b.group?.ko}) — ${decodeURI(b.links.namu)}`);
fs.writeFileSync(path.join(os.homedir(), 'Downloads', 'melon_solo_audit', 'namu_link_report.txt'), L.join('\n'));

if (APPLY && recovered.length) {
  for (const r of recovered) r.a.links.namu = r.url;
  // ⚠️ artists.json 은 **들여쓰기 1칸**이다(라운드트립으로 확인: indent 1이면 원본과 바이트 일치).
  //    여기서 indent 2로 쓰면 링크 몇 줄 고치는 커밋이 4MB 파일 전체 재포맷(+930KB)이 되어, 실제 변경이
  //    diff 속에 파묻히고 다른 세션과 충돌한다(2026-09-04 발견 — --apply 하기 전에 잡았다).
  //    assign_ids.mjs 는 2칸으로 쓰고 있으니 그쪽도 손볼 때 같이 확인할 것.
  let s = JSON.stringify(artists, null, 1);
  if (s.endsWith('\n')) s = s.slice(0, -1);
  fs.writeFileSync(path.join(ROOT, 'artists.json'), s);
  console.log('artists.json 저장 완료');
} else console.log('[dry] 저장 안 함');
