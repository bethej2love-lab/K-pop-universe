#!/usr/bin/env node
// 나무위키 "공연 및 행사" → kpop_events 후보 (2026-08-28 신설)
//
// 왜 필요한가: KOPIS는 **연계된 티켓판매시스템을 통한 공연** 위주라 구멍이 크다. 실측 —
//   블랙핑크: KOPIS 4건 = 우리가 가져온 4건(100%)  ← 매처는 안 놓친다
//   뉴진스  : KOPIS 0건 (검색해도 "뉴진스님" 개그공연 1건뿐)
// A등급 114개 그룹 중 23개가 공연 0건이다. 자체 플랫폼(위버스샵 등) 판매분과 해외 공연이 통째로 빠진다.
// 나무위키의 "{이름}/공연 및 행사" 문서엔 날짜·행사명·장소가 표로 있고 **해외 공연도 포함**된다.
//
// ⚠️ **공연 0건인 대상에만 돌린다.** 이게 사용자가 제안한 기준인데, 중복 문제를 통째로 없앤다 —
//    KOPIS에서 0건인 그룹/멤버라면 나무위키에서 뭘 가져오든 기존 행과 겹칠 수가 없다.
//    (KOPIS와 나무위키는 공연장 표기가 달라서 — "올림픽공원" vs "KSPO 돔" — 일반적으로는
//     (title,date_start,venue) 중복 판정이 안 통한다. 0건 대상만 노려서 그 문제를 피한다.)
//
// 수집 대상 섹션: **콘서트**와 **팬미팅**만.
//   · "합동 콘서트"는 제외 — KCON·MAMA·가요대전·시상식이라 그 그룹의 공연이 아니다.
//   · 쇼케이스·팬사인회·기타도 제외(사용자 결정: 공연 = 콘서트 + 팬미팅).
//
// 사용법:
//   node tools/namu_events.mjs --targets=파일   # 한 줄에 하나씩 "이름<TAB>종류" 목록
//   node tools/namu_events.mjs --one=NewJeans   # 한 건만 시험
// 출력: events.namu.json (검수용) — DB 적재는 사람이 목록을 확인한 뒤에 한다.

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(s => { const m = s.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [s, true]; }));

function fetchOne(title) {
  const url = 'https://namu.wiki/w/' + encodeURIComponent(title);
  try {
    return execSync(`curl -k -s -m 25 -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "${url}"`,
      { maxBuffer: 40 * 1024 * 1024, encoding: 'utf8' });
  } catch (e) { return ''; }
}
// ⚠️ 나무위키 문서명은 우리 로스터의 한글명과 다를 때가 많다(위너→WINNER, 워너원→Wanna One,
// 뉴진스→NewJeans). 한글명만 시도하면 조용히 0건이 되므로 en·altNames까지 순서대로 시도한다.
// 어느 이름으로 찾았는지는 결과에 남겨서 나중에 문서를 되짚을 수 있게 한다.
function fetchDoc(name, aliases) {
  // 문서명 후보 × 하위문서 후보. WINNER처럼 콘서트가 별도 문서로 빠진 경우가 있다.
  const subs = ['/공연 및 행사', '/콘서트'];
  for (const base of [name, ...(aliases || [])].filter(Boolean))
  for (const sub of subs) {
    const cand = base + sub;
    const html = fetchOne(cand);
    // ⚠️ 원본 HTML에선 편집 표시가 &#91;편집&#93; 로 인코딩돼 있어 "편집]"으로 찾으면 못 잡는다
    //    (이걸로 판정했다가 되던 뉴진스까지 0건이 됐다). 엔티티까지 허용해서 본다.
    if (html && html.length > 60000 && /(&#91;|\[)편집(&#93;|\])/.test(html)) return { html, used: cand };
  }
  return { html: '', used: null };
}

// 표를 행 단위로 복원한다. 셀 경계는 |, 행 경계는 개행.
function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<\/t[dh]>/gi, ' | ').replace(/<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/[ \t]+/g, ' ');
}

// 섹션 경계 — "2. 콘서트 [편집]" 형태. 합동 콘서트는 별도 소절이라 따로 잡아 제외한다.
function sections(txt) {
  const re = /(\d+(?:\.\d+)*)\.\s*([^\[\n|]{1,20}?)\s*\[편집\]/g;
  return [...txt.matchAll(re)].map(m => ({ num: m[1], name: m[2].trim(), at: m.index }));
}

// ⚠️ 섹션 이름이 문서마다 제각각이라 **완전일치로 잡으면 안 된다**(2026-08-28 실측):
//   걸스데이 2.콘서트 → 2.1.국내 콘서트 / 2.2.해외 콘서트   씨스타 4.콘서트 및 팬미팅
//   WINNER 는 '공연 및 행사'에 페스티벌·대학축제만 있고 콘서트는 'WINNER/콘서트' 별도 문서.
// 그래서 '콘서트'나 '팬미팅'을 **포함**하면 채택하되, 합동·축제·쇼케이스류는 이름에서 배제한다.
const WANT = /콘서트|팬미팅|팬 미팅|팬콘/;
const SKIP = /합동|시상식|음악\s?방송|팬사인회|팬싸인회|쇼케이스|기타|출연|행사|축제|페스티벌|대학|여담|관련 문서/;

// ⚠️ 섹션 이름만으로는 부족하다(2026-08-28 사용자 지시: 페스티벌·시상식·KCON·쇼케이스 전부 제외).
// "콘서트" 섹션 안에도 합동 무대가 섞여 들어오고, 문서마다 소절 구성이 제각각이라 제목으로 한 번 더
// 거른다. 여기 걸리는 건 **여러 아티스트가 나오는 행사**라 특정 그룹의 공연으로 볼 수 없다.
// (나중에 넣고 싶어지면 이 목록만 풀면 된다 — 데이터를 버리는 게 아니라 이 단계에서 안 뽑는 것.)
const TITLE_EXCLUDE = new RegExp([
  '페스티벌', 'FESTIVAL', 'FEST\\b', 'KCON', '드림\\s?콘서트', '뮤직뱅크', '음악중심', '인기가요',
  '가요대전', '가요대축제', '가요제', '시상식', 'AWARDS?\\b', 'MAMA\\b', '골든\\s?디스크', 'MMA\\b',
  '멜론\\s?뮤직', 'SUMMER\\s?SONIC', 'LOLLAPALOOZA', '잼버리', '쇼케이스', 'SHOWCASE',
  '올림픽', '엑스포', '박람회', '컨벤션', '스페셜\\s?스테이지', 'WEVERSE\\s?CON', '더팩트',
  '방송', '녹화', '사전녹화',
].join('|'), 'i');

// "2024/06/26 ~ 06/27", "10.01", "2022. 08. 01." 등 → {start,end}
function parseDate(cell, curYear) {
  const c = cell.replace(/\s/g, '');
  let m = c.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})(?:~(?:(\d{4})[./])?(\d{1,2})[./](\d{1,2}))?$/);
  if (m) {
    const y = +m[1], s = `${y}-${p2(m[2])}-${p2(m[3])}`;
    const e = m[5] ? `${m[4] ? +m[4] : y}-${p2(m[5])}-${p2(m[6])}` : s;
    return { start: s, end: e, year: y };
  }
  m = c.match(/^(\d{1,2})[.](\d{1,2})(?:~(\d{1,2})[.](\d{1,2}))?$/);
  if (m && curYear) {
    const s = `${curYear}-${p2(m[1])}-${p2(m[2])}`;
    const e = m[3] ? `${curYear}-${p2(m[3])}-${p2(m[4])}` : s;
    return { start: s, end: e, year: curYear };
  }
  return null;
}
const p2 = n => String(+n).padStart(2, '0');

export function parseDoc(html, who) {
  const txt = toText(html);
  if (!txt || txt.length < 500) return { ok: false, reason: '문서 없음' };
  const secs = sections(txt);
  if (!secs.length) return { ok: false, reason: '섹션 없음' };

  const out = [];
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    if (!WANT.test(s.name) || SKIP.test(s.name)) continue;
    // 이 섹션의 범위 = 다음 섹션 시작까지. 단, 하위 소절(2.1 합동 콘서트)은 잘라낸다.
    // 하위 소절(2.콘서트 → 2.1 국내 / 2.2 해외)은 **포함**해야 한다. 다음 섹션에서 무조건 끊으면
    // 상위 섹션 본문이 헤더 한 줄로 끝나 0건이 된다(걸스데이가 그랬다).
    // 그래서 '내 번호로 시작하지 않는' 첫 섹션까지 확장한다.
    let end = txt.length;
    for (let j = i + 1; j < secs.length; j++) {
      if (!secs[j].num.startsWith(s.num + '.')) { end = secs[j].at; break; }
    }
    // 단, 그 안에 SKIP에 걸리는 소절(합동 콘서트 등)이 있으면 거기서 잘라낸다
    for (let j = i + 1; j < secs.length && secs[j].at < end; j++) {
      if (SKIP.test(secs[j].name)) { end = secs[j].at; break; }
    }
    const body = txt.slice(s.at, end);
    const type = /팬/.test(s.name) ? '팬미팅' : '콘서트';
    let curYear = null;
    for (const line of body.split('\n')) {
      // ⚠️ 연도 인식이 **길이 검사보다 먼저**여야 한다. 표가 이렇게 생겼다:
      //     2023년 |
      //     07.01 ~ 07.02 | Bunnies Camp | SK핸드볼경기장 | 첫 단독 팬미팅 |
      // 연도는 병합셀이라 **자기 줄 하나만 차지**한다. 길이 검사를 먼저 하면 그 줄이 통째로
      // 걸러져 curYear가 영영 null이 되고, "07.01" 같은 월일만 있는 날짜를 해석할 수 없어 0건이 된다.
      const cells = line.split('|').map(x => x.trim()).filter(Boolean);
      const ym = line.match(/(\d{4})\s*년/); if (ym) curYear = +ym[1];
      if (cells.length < 2) continue;
      const d = parseDate(cells[0].replace(/^\d{4}\s*년\s*/, ''), curYear)
        || parseDate(cells[1] || '', curYear);
      if (!d) continue;
      const rest = cells.slice(cells[0].match(/\d/) ? 1 : 2);
      const title = (rest[0] || '').replace(/\[\d+\]/g, '').trim();
      const venue = (rest[1] || '').replace(/\[\d+\]/g, '').trim();
      if (!title || title.length < 2) continue;
      if (TITLE_EXCLUDE.test(title)) continue;   // 페스티벌·시상식·KCON·쇼케이스 등 합동 행사 제외
      out.push({ who, type, title, venue, date_start: d.start, date_end: d.end, section: s.name });
    }
  }
  return { ok: true, events: out };
}

async function main() {
  const G = (() => { const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')); return g.groups || g; })();
  const A = (() => { const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8')); return Array.isArray(a) ? a : Object.values(a)[0]; })();
  // 로스터의 en·altNames를 문서명 후보로 쓴다(위 fetchDoc 주석 참고)
  const aliasOf = n => { const g = G[n]; if (g) return [g.en, ...(g.altNames || [])].filter(Boolean);
    const a = A.find(x => x.name && x.name.ko === n); return a && a.name.en ? [a.name.en] : []; };
  const targets = args.one ? [{ name: String(args.one) }]
    : fs.readFileSync(path.join(ROOT, String(args.targets)), 'utf8').split('\n')
      .map(l => l.trim()).filter(Boolean).map(l => ({ name: l.split('\t')[0], kind: l.split('\t')[1] }));
  targets.forEach(t => { t.aliases = aliasOf(t.name); });   // --one 경로에도 별칭이 붙어야 한다

  const all = [], missing = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    process.stderr.write(`\r[namu] ${i + 1}/${targets.length} ${t.name}  (수집 ${all.length}건)      `);
    const { html, used } = fetchDoc(t.name, t.aliases);
    const r = parseDoc(html, t.name);
    if (!r.ok || !r.events.length) { missing.push(t.name + (r.reason ? ' — ' + r.reason : ' — 0건')); }
    else all.push(...r.events.map(e => ({ ...e, kind: t.kind || '', doc: used })));
    await new Promise(r2 => setTimeout(r2, 900));   // 예의상 간격 — 위키에 부담 주지 않는다
  }
  process.stderr.write('\n');
  fs.writeFileSync(path.join(ROOT, 'events.namu.json'), JSON.stringify(all, null, 1));
  console.log(`수집 ${all.length}건 / 대상 ${targets.length}개 · 문서없음·0건 ${missing.length}개`);
  console.log('→ events.namu.json (검수 후 적재)');
  if (args.one) all.forEach(e => console.log(`  [${e.type}] ${e.date_start}~${e.date_end}  ${e.title}  @${e.venue}`));
}
main();
