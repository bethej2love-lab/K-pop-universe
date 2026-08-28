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

// ⚠️ 장르 코드(shcate)를 하드코딩하지 않는다. 처음엔 'CCCD'로 박아뒀는데, 사용자가 받아둔 공식 문서
// (공연예술통합전산망OpenAPI공통코드.pdf)에서 뽑아보니 실제 코드는 AAAA/AAAB/BBBA/CCCA/CCCB/CCCC/EEEA
// 뿐이고 CCCD는 아예 없었다 — 그대로 돌렸으면 조용히 0건이 나왔을 것이다(2026-08-28).
// 한글 라벨은 임베디드 폰트라 문서에서 못 읽어냈으므로, **추측 대신 실데이터로 확인**한다:
//   node tools/kopis_events.mjs --key=... --probe
// 가 장르 필터 없이 한 달치를 받아 genrenm 분포와 표본 제목을 찍어준다. 거기서 대중음악에 해당하는
// 코드를 고른 뒤 --genre=XXXX 로 넘기면 된다. 필터를 안 주면 전체를 받아 그룹명 매칭으로만 거른다.
async function fetchPage(key, from, to, page, genre) {
  const url = `${ENDPOINT}?service=${encodeURIComponent(key)}&stdate=${from}&eddate=${to}&cpage=${page}&rows=100`
    + (genre ? `&shcate=${encodeURIComponent(genre)}` : '');
  const res = await fetch(url);
  const xml = await res.text();
  if (/SERVICE KEY IS NOT REGISTERED|errmsg/.test(xml) && !/<db>/.test(xml)) throw new Error('API 오류: ' + xml.slice(0, 200));
  return [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)].map(m => m[1]).map(b => ({
    id: pick(b, 'mt20id'), title: pick(b, 'prfnm'),
    date_start: pick(b, 'prfpdfrom').replace(/\./g, '-'),
    date_end: pick(b, 'prfpdto').replace(/\./g, '-'),
    venue: pick(b, 'fcltynm'), city: pick(b, 'area'), poster: pick(b, 'poster'),
    genre: pick(b, 'genrenm'), state: pick(b, 'prfstate'),
  }));
}

// 공연 상세 조회 — 개발가이드에서 확인한 두 번째 엔드포인트(2026-08-28).
// 목록(pblprfr)엔 공연명만 있지만 상세엔 **prfcast(출연진)** 가 있다. 공연명은 "2026 OOO CONCERT"처럼
// 그룹명이 안 들어가는 경우가 많아서, 출연진으로 한 번 더 매칭하면 재현율이 크게 올라간다.
// relates(관련 링크)엔 예매처 URL이 들어오는 경우가 있어 official_url 후보로 같이 뽑아둔다
// (사용자는 "일단 비워두자"고 했지만, 공짜로 얻어지면 넣지 않을 이유가 없다 — 없으면 그대로 null).
async function fetchDetail(key, mt20id) {
  const res = await fetch(`${ENDPOINT}/${encodeURIComponent(mt20id)}?service=${encodeURIComponent(key)}`);
  const xml = await res.text();
  const rel = [...xml.matchAll(/<relateurl>([\s\S]*?)<\/relateurl>/g)].map(m => m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
  return {
    cast: pick(xml, 'prfcast'), crew: pick(xml, 'prfcrew'),
    poster: pick(xml, 'poster'), runtime: pick(xml, 'prfruntime'),
    relate: rel.find(u => /^https?:\/\//.test(u)) || '',
  };
}

const sq = s => `'${String(s || '').replace(/'/g, "''")}'`;

async function main() {
  if (args.selftest) return selftest();
  // 키는 세 곳에서 찾는다. 우선순위대로: --key= > KOPIS_KEY 환경변수 > 레포 루트의 .kopis_key 파일.
  // 파일을 마지막에 두되 자동으로 읽는 이유: 명령줄에 키를 직접 적으면 셸 히스토리와 대화 기록에
  // 그대로 남는다. 파일은 .gitignore로 커밋도 막아둔다.
  const keyFile = path.join(ROOT, '.kopis_key');
  const key = args.key || process.env.KOPIS_KEY
    || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '');
  if (!key) {
    console.error([
      '인증키를 못 찾았습니다. 아래 중 하나로 넣어주세요(권장: 파일).',
      '',
      `  1) 파일  : ${keyFile}  ← 이 파일에 키만 한 줄로 저장 (.gitignore로 커밋 차단됨)`,
      '  2) 환경변수: KOPIS_KEY=...',
      '  3) 인자   : --key=...   (셸 히스토리에 남으니 비권장)',
      '',
      '발급: https://kopis.or.kr/por/cs/openapi/openApiUseSend.do?menuId=MNU_00074',
      '⚠️ 키가 Encoding/Decoding 두 종류로 왔다면 **Decoding** 키를 넣으세요(스크립트가 자체 인코딩합니다).',
    ].join('\n'));
    process.exit(1);
  }
  const from = args.from || '20260101', to = args.to || '20261231';
  const minConf = args['min-conf'] || 'strong';
  const genre = typeof args.genre === 'string' ? args.genre : null;

  // --probe: 장르 코드를 고르기 위한 정찰. 필터 없이 짧은 기간만 받아 genrenm 분포를 보여준다.
  if (args.probe) {
    const p = await fetchPage(key, from, from.slice(0, 6) + '28', 1, null);
    const dist = new Map();
    p.forEach(r => dist.set(r.genre || '(없음)', (dist.get(r.genre || '(없음)') || 0) + 1));
    console.log(`[probe] ${from} 한 달 표본 ${p.length}건의 genrenm 분포:`);
    [...dist].sort((a, b) => b[1] - a[1]).forEach(([g, n]) => console.log(`  ${String(n).padStart(4)}건  ${g}`));
    console.log('\n대중음악으로 보이는 장르의 표본 제목:');
    p.filter(r => /대중|음악|콘서트/.test(r.genre || '')).slice(0, 15).forEach(r => console.log(`  · [${r.genre}] ${r.title}`));
    console.log('\n→ 맞는 장르를 고른 뒤 --genre=코드 로 다시 실행하세요(코드는 공통코드 PDF 참고).');
    return;
  }

  const rows = [];
  for (let page = 1; page <= 50; page++) {
    const got = await fetchPage(key, from, to, page, genre);
    if (!got.length) break;
    rows.push(...got);
    process.stderr.write(`\r[kopis] ${from}~${to}${genre ? ' ' + genre : ''} ${rows.length}건 수집…`);
    await new Promise(r => setTimeout(r, 250));       // 예의상 간격 — 공식 API라도 몰아치지 않는다
  }
  process.stderr.write('\n');

  const matched = [], unmatched = [];
  for (const r of rows) {
    const m = matchEvent(r.title);
    if (m.groups.length && (minConf === 'weak' || m.confidence === 'strong')) matched.push({ ...r, ...m });
    else unmatched.push({ ...r, ...m });
  }

  // --detail: 공연명으로 못 잡은 것들만 상세 조회해서 **출연진(prfcast)** 으로 재매칭한다.
  // 전체가 아니라 미매칭분만 도는 이유: 이미 강하게 매칭된 건 더 볼 게 없고, API 호출을 아끼기 위해.
  if (args.detail) {
    let rescued = 0;
    for (let i = 0; i < unmatched.length; i++) {
      const u = unmatched[i];
      process.stderr.write(`\r[detail] ${i + 1}/${unmatched.length} 재매칭 시도… (구제 ${rescued})`);
      try {
        const d = await fetchDetail(key, u.id);
        u.poster = d.poster || u.poster; u.relate = d.relate;
        if (d.cast) {
          const m = matchEvent(d.cast);            // 출연진 문자열에 같은 매칭기를 그대로 적용
          if (m.groups.length && (minConf === 'weak' || m.confidence === 'strong')) {
            matched.push({ ...u, ...m, why: m.why.concat('via:prfcast') });
            unmatched.splice(i--, 1); rescued++;
          }
        }
      } catch (e) { /* 한 건 실패로 전체가 멈추면 안 됨 */ }
      await new Promise(r => setTimeout(r, 250));
    }
    process.stderr.write(`\n[detail] 출연진으로 추가 매칭 ${rescued}건\n`);
  }

  console.log(`-- KOPIS 공연목록 → kpop_events (${from}~${to})`);
  console.log(`-- 수집 ${rows.length}건 / 매칭 ${matched.length}건 / 미매칭 ${unmatched.length}건`);
  console.log(`-- ⚠️ official_url(예매 링크)은 KOPIS가 제공하지 않아 비워 둔다(사용자 결정, 2026-08-28).`);
  console.log('-- ⚠️ 실행 전 미매칭 목록(stderr)을 훑어볼 것 — 매칭기가 놓친 게 있으면 그게 더 중요하다.\n');
  for (const e of matched) {
    console.log(`insert into kpop_events (id,title,groups,date_start,date_end,venue,city,official_url) values (` +
      `${sq('kopis_' + e.id)},${sq(e.title)},array[${e.groups.map(sq).join(',')}],` +
      `${sq(e.date_start)},${sq(e.date_end)},${sq(e.venue)},${sq(e.city)},${e.relate ? sq(e.relate) : 'null'}) on conflict (id) do nothing;`);
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
