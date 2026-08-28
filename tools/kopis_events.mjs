#!/usr/bin/env node
// KOPIS(공연예술통합전산망) 공연목록 → kpop_events INSERT SQL (2026-08-28 신설)
//
// 왜 KOPIS인가 (2026-08-28 조사 결과):
//  - NOL 티켓(tickets.interpark.com)은 robots.txt가 `User-Agent: * / Disallow: /` — 검색엔진 5종
//    외 전 경로 크롤링 금지다. 명시적 거부라 스크래핑 대상에서 제외했다.
//  - 멜론티켓은 robots.txt가 없지만 목록이 JS 렌더라 Playwright가 필요하고, 사이트 개편에 쉽게 깨진다.
//  - KOPIS는 문체부·예술경영지원센터의 공식 오픈API로 무료·구조화·안정적이다. 키는 공공데이터포털
//    https://www.data.go.kr/data/15097805/openapi.do 에서 **자동승인**으로 발급된다
//    (KOPIS 본 사이트의 "My통계"는 공연시설·기획제작사 전용이라 별개다 — 여기 걸리지 말 것).
//
// 이 스크립트는 **읽기 전용**이다. DB에 직접 쓰지 않고 SQL을 출력한다 —
// kpop_events는 admin 전용 RLS라 저장은 사용자가 admin 세션에서 직접 한다(프로젝트 경계).
//
// 사용법:
//   node tools/kopis_events.mjs --key=발급키 --from=20260101 --to=20261231 > events.sql
//   node tools/kopis_events.mjs --selftest        # 키 없이 매칭기만 점검
//
// 옵션: --endpoint=... (포털이 apis.data.go.kr 프록시를 주면 그쪽으로 교체)
//       --min-conf=strong|weak (기본 strong — 확실한 것만 SQL로, 나머지는 미매칭 목록)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = (() => { const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')); return g.groups || g; })();
const ARTISTS = (() => { const a = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8')); return Array.isArray(a) ? a : Object.values(a)[0]; })();

const args = Object.fromEntries(process.argv.slice(2).map(s => { const m = s.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [s, true]; }));

// ── 이름 매칭 ────────────────────────────────────────────────────────────────
// 영상 태깅의 _m2ParseTitle을 그대로 쓰지 않는 이유: 그건 유튜브 제목(해시태그·직캠·음방 표기)에
// 맞춰 조율돼 있고, 공연명은 문법이 다르다("2026 XXX CONCERT [투어명]"). 대신 **거기서 검증된
// 두 가지 방어만 가져온다**: ①흔한 단어형 이름은 단독 매칭 금지 ②동명이인(같은 이름 2인 이상)은
// 그룹 표시가 없으면 버린다. 이 둘이 없으면 "온"·"여름" 같은 이름이 아무 공연명에나 걸린다.
const NORM = s => ' ' + String(s || '').toUpperCase().replace(/[^가-힣A-Z0-9]/g, ' ').replace(/\s+/g, ' ') + ' ';
const hasTok = (nu, tok) => { const t = NORM(tok).trim(); return t.length >= 2 && nu.includes(' ' + t + ' '); };

// 흔한 단어라 단독으로는 못 믿는 토큰(영상 태깅 쪽에서 사고가 났던 계열 + 공연명에 흔한 일반어)
const COMMON = new Set(['ONE', 'LOVE', 'STAR', 'DAY', 'THE', 'SHOW', 'LIVE', 'TOUR', 'CONCERT', 'FANMEETING',
  'WORLD', 'SEOUL', 'KOREA', 'SPECIAL', 'BEST', 'NEW', 'IN', 'ON', 'UP', 'AND', 'GIRL', 'BOY',
  '콘서트', '팬미팅', '단독', '전국투어', '앙코르', '월드투어', '내한', '공연', '페스티벌']);

const memberIndex = (() => {
  const byName = new Map();
  for (const a of ARTISTS) {
    const ko = a?.name?.ko; if (!ko) continue;
    if (!byName.has(ko)) byName.set(ko, []);
    byName.get(ko).push(a);
  }
  return byName;
})();

function groupTokens(gko) {
  const g = GROUPS[gko] || {};
  return [gko, g.en, ...(g.altNames || [])].filter(Boolean);
}

// 공연명 → {groups:[...], confidence:'strong'|'weak', why}
export function matchEvent(title) {
  const nu = NORM(title);
  const hits = new Set(); const why = [];
  // ① 그룹명/영문명/별칭 직접 매칭 — 가장 신뢰도 높음
  for (const gko of Object.keys(GROUPS)) {
    for (const tok of groupTokens(gko)) {
      const T = tok.toUpperCase();
      if (COMMON.has(T)) continue;            // 흔한 단어형 그룹명은 단독 매칭 금지
      if (T.replace(/[^A-Z0-9가-힣]/g, '').length < 2) continue;
      if (hasTok(nu, tok)) { hits.add(gko); why.push(`group:${gko}(${tok})`); break; }
    }
  }
  if (hits.size) return { groups: [...hits], confidence: 'strong', why };

  // ② 멤버 이름 매칭(솔로 콘서트) — 동명이인이면 버린다. 그룹 표시가 없는 상황이라
  //    영상 태깅에서 "지유/지원/메이" 사고가 났던 것과 같은 위험이 그대로 있다.
  for (const [ko, people] of memberIndex) {
    if (ko.length < 2) continue;                       // 한 글자 이름은 위험(하이키 '키' 사고)
    if (COMMON.has(ko.toUpperCase())) continue;
    if (!hasTok(nu, ko)) continue;
    if (people.length >= 2) { why.push(`member:${ko}(동명이인 ${people.length}명 — 버림)`); continue; }
    return { groups: [ko], confidence: 'weak', why: why.concat(`member:${ko}`) };
  }
  return { groups: [], confidence: 'none', why };
}

// ── KOPIS 조회 ───────────────────────────────────────────────────────────────
const ENDPOINT = args.endpoint || 'http://www.kopis.or.kr/openApi/restful/pblprfr';
const pick = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''; };

async function fetchPage(key, from, to, page) {
  const url = `${ENDPOINT}?service=${encodeURIComponent(key)}&stdate=${from}&eddate=${to}&cpage=${page}&rows=100&shcate=CCCD`;
  const res = await fetch(url);
  const xml = await res.text();
  if (/SERVICE KEY IS NOT REGISTERED|errmsg/.test(xml) && !/<db>/.test(xml)) throw new Error('API 오류: ' + xml.slice(0, 200));
  return [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)].map(m => m[1]).map(b => ({
    id: pick(b, 'mt20id'), title: pick(b, 'prfnm'),
    date_start: pick(b, 'prfpdfrom').replace(/\./g, '-'),
    date_end: pick(b, 'prfpdto').replace(/\./g, '-'),
    venue: pick(b, 'fcltynm'), city: pick(b, 'area'), poster: pick(b, 'poster'),
  }));
}

const sq = s => `'${String(s || '').replace(/'/g, "''")}'`;

async function main() {
  if (args.selftest) return selftest();
  const key = args.key || process.env.KOPIS_KEY;
  if (!key) { console.error('키가 필요합니다: --key=... (또는 KOPIS_KEY 환경변수)\n발급: https://www.data.go.kr/data/15097805/openapi.do (자동승인)'); process.exit(1); }
  const from = args.from || '20260101', to = args.to || '20261231';
  const minConf = args['min-conf'] || 'strong';

  const rows = [];
  for (let page = 1; page <= 50; page++) {
    const got = await fetchPage(key, from, to, page);
    if (!got.length) break;
    rows.push(...got);
    process.stderr.write(`\r[kopis] ${from}~${to} ${rows.length}건 수집…`);
    await new Promise(r => setTimeout(r, 250));       // 예의상 간격 — 공식 API라도 몰아치지 않는다
  }
  process.stderr.write('\n');

  const matched = [], unmatched = [];
  for (const r of rows) {
    const m = matchEvent(r.title);
    if (m.groups.length && (minConf === 'weak' || m.confidence === 'strong')) matched.push({ ...r, ...m });
    else unmatched.push({ ...r, ...m });
  }

  console.log(`-- KOPIS 공연목록 → kpop_events (${from}~${to})`);
  console.log(`-- 수집 ${rows.length}건 / 매칭 ${matched.length}건 / 미매칭 ${unmatched.length}건`);
  console.log(`-- ⚠️ official_url(예매 링크)은 KOPIS가 제공하지 않아 비워 둔다(사용자 결정, 2026-08-28).`);
  console.log('-- ⚠️ 실행 전 미매칭 목록(stderr)을 훑어볼 것 — 매칭기가 놓친 게 있으면 그게 더 중요하다.\n');
  for (const e of matched) {
    console.log(`insert into kpop_events (id,title,groups,date_start,date_end,venue,city,official_url) values (` +
      `${sq('kopis_' + e.id)},${sq(e.title)},array[${e.groups.map(sq).join(',')}],` +
      `${sq(e.date_start)},${sq(e.date_end)},${sq(e.venue)},${sq(e.city)},null) on conflict (id) do nothing;`);
  }
  console.error(`\n미매칭 ${unmatched.length}건 (앞 40개):`);
  unmatched.slice(0, 40).forEach(u => console.error(`  · ${u.title}  [${u.venue}]  ${u.why.join(' ') || '단서 없음'}`));
}

// ── 셀프테스트: 키 없이 매칭기만 점검 ────────────────────────────────────────
// ⚠️ 아래 코퍼스는 **실제 KOPIS 데이터가 아니라** 실제 그룹명에 흔한 공연명 패턴을 씌운 합성 표본이다.
//    이름 추출부(가장 위험한 부분)의 정확도만 본다. 진짜 재현율은 키를 받은 뒤 실데이터로 다시 재야 한다.
function selftest() {
  const gk = Object.keys(GROUPS);
  const pos = [
    ['2026 세이마이네임 단독 콘서트 [SAY MY NAME]', '세이마이네임'],
    ['에스파 2026 WORLD TOUR - SYNK : PARALLEL LINE - in SEOUL', '에스파'],
    ['2026 아이브 THE 1ST WORLD TOUR SHOW WHAT I HAVE', '아이브'],
    ['BOYNEXTDOOR FAN CONCERT 2026', '보이넥스트도어'],       // en 매칭
    ['제베원 팬미팅 2026', '제로베이스원'],                     // altNames 매칭
    ['비스트 콘서트 2026', '하이라이트'],                       // altNames(옛 그룹명) 매칭
  ];
  const neg = [
    '2026 신년음악회 - 서울시립교향악단',
    '뮤지컬 <원스> 앙코르 공연',
    '2026 THE LOVE CONCERT',        // 흔한 단어만 — 걸리면 안 됨
    '연극 <라이브> 서울 공연',        // '라이브' 흔한단어
  ];
  let ok = 0, bad = 0;
  console.log(`매칭기 셀프테스트 (그룹 ${gk.length}개 · 합성 표본 ${pos.length + neg.length}건)\n`);
  for (const [t, want] of pos) {
    const m = matchEvent(t);
    const hit = m.groups.includes(want);
    console.log(`${hit ? '✅' : '❌'} ${t}\n     → ${JSON.stringify(m.groups)} (${m.confidence}) 기대=${want}`);
    hit ? ok++ : bad++;
  }
  for (const t of neg) {
    const m = matchEvent(t);
    const clean = m.groups.length === 0;
    console.log(`${clean ? '✅' : '❌'} [음성] ${t}\n     → ${JSON.stringify(m.groups)} ${clean ? '' : '(오탐!)'}`);
    clean ? ok++ : bad++;
  }
  console.log(`\n${ok}/${ok + bad} 통과`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error('[kopis] 실패:', e.message); process.exit(2); });
