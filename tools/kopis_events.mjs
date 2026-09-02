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
// 정규화된 제목에서 이 토큰이 **맨 앞**에 오는가(앞의 연도·회차 숫자는 건너뜀).
// "2026 HIGHLIGHT FAN CON" → HIGHLIGHT는 선두로 인정, "터치드 단독 콘서트 HIGHLIGHT" → 아님.
const isLeadToken = (nu, tok) => {
  const words = nu.trim().split(' ').filter(Boolean);
  let i = 0; while (i < words.length && /^[0-9]+$/.test(words[i])) i++;   // 앞의 연도/숫자 건너뛰기
  const t = NORM(tok).trim().split(' ').filter(Boolean);
  return t.every((w, k) => words[i + k] === w);
};

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
  return [gko, g.en, ...(g.altNames || [])].filter(Boolean)
    // ⚠️ 숫자만인 토큰 차단(2026-08-28 실측): 피프틴앤드의 en이 '15&'인데 정규화하면 '15'가 되어
    // "천체관측 vol.15", "July Festival in 고창 1" 같은 제목에 걸렸다. 숫자는 공연명에 널려 있다.
    .filter(t => !/^\s*[0-9]+\s*$/.test(String(t).replace(/[^0-9A-Za-z가-힣]/g, '')));
}

// 그룹명이 일상어와 겹쳐 단독으로는 못 믿는 것들(2026-08-28 실측 5,000건에서 나온 오탐 그대로).
// 메모리의 "흔한 단어형 그룹명" 목록을 공연 도메인에 맞게 확장했다 — 아동극·클래식·발레 제목에
// 그룹명과 같은 단어가 그대로 등장한다: "이상한 나라의 앨리스", "발레 시그니처", "퀸 엘리자베스
// 콩쿠르 위너 콘서트", "신카이 마코토 하이라이트 필름", "우리 신화 이야기", "다 내 아이들"…
// 이 이름들은 **K팝 공연이라는 별도 신호**가 같이 있어야만 인정한다.
const AMBIGUOUS_GROUPS = new Set(['앨리스', '시그니처', '아르테미스', '하이라이트', '위너', '네이처',
  '신화', '아이들', '레인보우', '시크릿', '트레저', '슈가', '위클리', '에이프릴', '인피니트', '티아라',
  '다이아', '펜타곤', '여자친구', '오마이걸', '드림', '뉴이스트', '빅스', '소녀시대']);

// ── 솔로 공연 화이트리스트 (2026-08-28, 사용자 눈검사로 확정) ────────────────────
// 멤버 이름 매칭은 원리적으로 위험하다: 로스터 **안**의 동명이인은 거를 수 있지만 로스터 **밖**의
// 동명 가수는 못 잡는다(실측: "신유 콘서트"=트로트 가수, "이승환 어쿠스틱"=가수 이승환,
// "크리스탈 티 단독 콘서트"=밴드 크리스탈 티, "김준수 X 두번째달"=국악 가수 김준수).
// 그래서 자동 판정을 쓰지 않고 **사람이 확인한 이름만** 통과시킨다. 후보는
//   A등급 그룹(pri=4) + 3글자 이상 이름 + 이름이 제목 맨 앞  → 97건/34명
// 으로 좁혀서 뽑았고, 그중 사용자가 19명을 확정했다(65건). 새 이름을 넣을 땐 같은 방식으로
// 후보를 뽑아 눈으로 확인한 뒤 이 목록에 추가할 것 — 자동 확장하면 위 오탐들이 그대로 들어온다.
const SOLO_WHITELIST = new Set((() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'solo_whitelist.json'), 'utf8')); }
  catch (e) { return []; }
})());

// K팝 공연 제목에 붙는 관용 표현. 아동극·클래식 제목엔 거의 안 나온다.
const KPOP_SIGNAL = /FAN\s?CON|FANCON|FAN\s?MEETING|FANMEETING|팬미팅|팬콘|단독\s?콘서트|WORLD\s?TOUR|ASIA\s?TOUR|CONCERT\s?TOUR|TOUR\s?:|LIVE\s?TOUR|쇼케이스|SHOWCASE|COMEBACK|데뷔\s?\d|주년\s?(단독|콘서트)|ANNIVERSARY\s?(TOUR|CONCERT)/i;

// 공연명 → {groups:[...], confidence:'strong'|'weak', why}
export function matchEvent(title) {
  const nu = NORM(title);
  const hits = new Set(); const why = [];
  // 내한(공연)은 외국 아티스트가 한국에 오는 공연 — K팝 그룹엔 없는 개념이다. 제목 맨 앞 단어가 우연히
  // K팝 이름과 겹쳐(스텔라 도넬리→스텔라, 스텔라 콜→스텔라, 알레시아 카라→카라) 그룹에 오배정되던 것을
  // 원천 차단한다(2026-09-02 제보 "하츠투하츠 스텔라 공연"). 내한이 KPOP_SIGNAL(내한·공연)로도 잡혀
  // 게이트를 통과했었다 — 그 신호보다 먼저, 강하게 끊는다.
  if (/내한/.test(title)) return { groups: [], confidence: 'none', why: ['skip:내한(외국 아티스트 공연)'] };
  const kpopish = KPOP_SIGNAL.test(title);
  // ① 그룹명/영문명/별칭 직접 매칭 — 가장 신뢰도 높음
  for (const gko of Object.keys(GROUPS)) {
    for (const tok of groupTokens(gko)) {
      const T = tok.toUpperCase();
      if (COMMON.has(T)) continue;            // 흔한 단어형 그룹명은 단독 매칭 금지
      if (T.replace(/[^A-Z0-9가-힣]/g, '').length < 2) continue;
      if (!hasTok(nu, tok)) continue;
      // 일상어와 겹치는 그룹명은 K팝 공연 신호(투어·팬콘·단독 콘서트 등)가 같이 있을 때만 인정한다.
      // ⚠️ 처음엔 "영문 표기로 걸리면 예외"로 뒀는데(ARTMS 같은 건 일상어가 아니니까) **그 가정이
      //    틀렸다** — 실측에서 WINNER("I AM Winner 마티네 콘서트")·NATURE("Nature Sounds Temple")·
      //    TREASURE("The Treasure Box")·Sugar("PINK SUGAR CLUB")가 전부 en으로 새어나갔다.
      //    영문 그룹명도 일상 영단어인 경우가 흔하다. 예외를 없애고 ko/en 구분 없이 신호를 요구한다.
      //    (ARTMS는 "ARTMS World Tour"처럼 신호가 같이 오므로 그대로 통과한다.)
      if (AMBIGUOUS_GROUPS.has(gko) && !kpopish) {
        why.push(`skip:${gko}(흔한단어 · K팝 신호 없음)`); continue;
      }
      // ⚠️ 신호만으로는 부족했다(2026-08-28 2차 실측). 신호가 있어도 그룹명이 **부제**로 쓰이면 샜다:
      //   "터치드 단독 콘서트: HIGHLIGHT Ⅲ", "WAX 25주년 콘서트: HIGHLIGHT",
      //   "김윤아 단독 콘서트, April is the Cruelest Month", "유인원 단독 콘서트: Our Nature",
      //   "시나 쓰는 앨리스 9th 단독콘서트"(밴드명에 '앨리스'가 들어감).
      // K팝 공연명은 거의 항상 **아티스트명으로 시작한다**("HIGHLIGHT FAN CON", "TREASURE TOUR",
      // "ARTMS World Tour", "aespa LIVE TOUR"). 그래서 흔한단어형은 맨 앞 토큰일 때만 인정한다.
      // 앞의 연도("2026 …")는 건너뛴다.
      if (AMBIGUOUS_GROUPS.has(gko) && !isLeadToken(nu, tok)) {
        why.push(`skip:${gko}(흔한단어 · 맨 앞이 아님=부제 취급)`); continue;
      }
      hits.add(gko); why.push(`group:${gko}(${tok})`); break;
    }
  }
  if (hits.size) return { groups: [...hits], confidence: 'strong', why };

  // ①.5 확정된 솔로 아티스트 — 사람이 확인한 이름만(위 SOLO_WHITELIST 주석 참고).
  // 이름이 **제목 맨 앞**일 때만 인정한다: 솔로 공연명은 거의 항상 아티스트명으로 시작하고
  // ("이창섭 단독콘서트: SPACE", "류수정 첫 단독 콘서트"), 뒤쪽에 나오면 게스트·부제일 확률이 높다.
  for (const ko of SOLO_WHITELIST) {
    if (!hasTok(nu, ko) || !isLeadToken(nu, ko)) continue;
    return { groups: [ko], confidence: 'strong', why: why.concat(`solo:${ko}(화이트리스트)`) };
  }

  // ② 멤버 이름 매칭(솔로 콘서트) — 동명이인이면 버린다. 그룹 표시가 없는 상황이라
  //    영상 태깅에서 "지유/지원/메이" 사고가 났던 것과 같은 위험이 그대로 있다.
  // ⚠️ **K팝 신호를 반드시 요구한다**(2026-08-28). 그룹 쪽에만 게이트를 걸었더니 "이상한 나라의
  //    앨리스"가 그룹 '앨리스'에선 막히고 **멤버 '앨리스'로 새어나갔다**. 이름 하나만으로 공연 전체를
  //    한 사람에게 배정하는 건 원래 가장 약한 근거라, 신호 없이는 아예 시도하지 않는 게 맞다.
  if (!kpopish) return { groups: [], confidence: 'none', why: why.concat('skip:member(K팝 신호 없음)') };
  for (const [ko, people] of memberIndex) {
    if (ko.length < 2) continue;                       // 한 글자 이름은 위험(하이키 '키' 사고)
    if (COMMON.has(ko.toUpperCase())) continue;
    if (!hasTok(nu, ko)) continue;
    // 그룹 쪽 게이트를 두 번 다 멤버 쪽에도 걸어야 했다(2026-08-28). "시나 쓰는 앨리스 9th 단독콘서트"가
    // 그룹 '앨리스'에선 막히고 **멤버 '앨리스'로** 또 새어나갔다 — 같은 이름은 같은 위험을 갖는다.
    if (AMBIGUOUS_GROUPS.has(ko) && !isLeadToken(nu, ko)) { why.push(`skip:member ${ko}(흔한단어 · 맨 앞 아님)`); continue; }
    if (people.length >= 2) { why.push(`member:${ko}(동명이인 ${people.length}명 — 버림)`); continue; }
    return { groups: [ko], confidence: 'weak', why: why.concat(`member:${ko}`) };
  }
  return { groups: [], confidence: 'none', why };
}

// ── KOPIS 조회 ───────────────────────────────────────────────────────────────
const ENDPOINT = args.endpoint || 'http://www.kopis.or.kr/openApi/restful/pblprfr';
// ⚠️ HTML 엔티티를 풀어준다(2026-08-28 실측): API가 제목을 "&amp;TEAM CONCERT", "Red &amp; Velvet",
// "N.Flying LIVE, &amp;CON5"처럼 인코딩해서 준다. 안 풀면 ①DB에 &amp;가 그대로 저장돼 화면에 그렇게
// 보이고 ②그룹명 매칭에서 "&TEAM"(앤팀 별칭 andTEAM)이 어긋난다. 이중 인코딩(&amp;amp;)도 있어 2회 푼다.
const unent = s => String(s || '')
  .replace(/&amp;/g, '&').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, ' ');
const pick = (xml, tag) => { const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return m ? unent(m[1].replace(/<!\[CDATA\[|\]\]>/g, '')).trim() : ''; };

// ── 장르 코드 실측표 (2026-08-28, --genres 로 직접 조회해 확정) ────────────────────
//   AAAA 연극        BBBC 무용(서양/한국무용)   BBBE 대중무용
//   CCCA 서양음악(클래식)  CCCC 한국음악(국악)   CCCD 대중음악  ← K팝은 여기
//   EEEA 복합        EEEB 서커스/마술          GGGA 뮤지컬
// ⚠️ CCCD가 정답이었다. 처음에 CCCD를 박았다가 공통코드 PDF 추출 목록에 없어서 뺐는데, **그 PDF
//   추출이 불완전했던 것**이지 코드가 틀린 게 아니었다. 문서에서 못 읽으면 추측으로 되돌리지 말고
//   이렇게 실측할 것 — 그래서 --genres 를 남겨둔다(코드 체계가 바뀌면 다시 재면 된다).
// 팬미팅·팬콘은 '복합'(EEEA)으로 등록되는 경우가 있어 --genre=CCCD,EEEA 처럼 여러 개를 줄 수 있다.
const GENRE_LABEL = { AAAA: '연극', BBBC: '무용', BBBE: '대중무용', CCCA: '클래식', CCCC: '국악', CCCD: '대중음악', EEEA: '복합', EEEB: '서커스/마술', GGGA: '뮤지컬' };

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

// 목록 API는 공연장을 시설 단위로만 준다('올림픽공원'). 상세 API의 fcltynm 은 홀까지 준다
// ('올림픽공원 (핸드볼경기장)'). 정규화 규칙은 kopis_venue.mjs 한 곳에만 두고 여기선 갖다 쓴다 —
// 규칙이 두 곳에 갈라지면 수집분과 손입력분이 서로 다른 이름으로 들어간다.
async function normalizeVenues(events, key) {
  if (!events.length) return;
  const { canonical } = await import('./kopis_venue.mjs');
  let done = 0, changed = 0;
  const CONC = 4;
  for (let i = 0; i < events.length; i += CONC) {
    await Promise.all(events.slice(i, i + CONC).map(async e => {
      try {
        const res = await fetch(`${ENDPOINT}/${encodeURIComponent(e.id)}?service=${encodeURIComponent(key)}`);
        const fclty = pick(await res.text(), 'fcltynm');
        const c = fclty && canonical(fclty);
        if (c && c !== e.venue) { e.venue = c; changed++; }
      } catch (err) { /* 한 건 실패해도 목록 API가 준 이름이 남으므로 치명적이지 않다 */ }
    }));
    done += Math.min(CONC, events.length - i);
    process.stderr.write(`\r[venue] ${done}/${events.length} 홀 이름 복구… (교정 ${changed})`);
    await new Promise(r => setTimeout(r, 120));
  }
  process.stderr.write(`\n[venue] 공연장 이름 ${changed}건 홀 단위로 교정\n`);
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

  // --genres: 장르 코드↔이름 대응을 **추측 대신 실측**한다. 공통코드 PDF의 한글 라벨이 임베디드
  // 폰트라 안 읽혀서(2026-08-28), 코드를 하나씩 넣어보고 돌아오는 genrenm을 본다.
  if (args.genres) {
    // 1차 실측(2026-08-28): AAAA=연극 / CCCA=서양음악(클래식) / CCCC=한국음악(국악) / EEEA=복합 /
    // GGGA=뮤지컬. **대중음악이 안 잡혔다.** CCC 계열이 음악이고 A=클래식·C=국악이니 대중음악은
    // CCCD·CCCB 쪽일 공산이 크다(처음에 CCCD를 넣었다가 PDF 추출 목록에 없어서 뺐는데, 그 추출이
    // 불완전했을 수 있다). 추측을 더 하지 말고 후보를 넓혀 한 번에 쓸어본다.
    const CODES = args.all
      ? 'A B C D E F G'.split(' ').flatMap(x => 'A B C D E'.split(' ').map(y => x.repeat(3) + y))
      : ['AAAA', 'AAAB', 'AAAC', 'BBBA', 'BBBB', 'BBBC', 'BBBD', 'BBBE',
        'CCCA', 'CCCB', 'CCCC', 'CCCD', 'CCCE', 'DDDA', 'EEEA', 'EEEB', 'FFFA', 'GGGA', 'GGGB'];
    console.log('장르 코드 실측 (각 코드로 1페이지씩 조회해 genrenm 확인):');
    for (const c of CODES) {
      try {
        const p = await fetchPage(key, from, from.slice(0, 6) + '28', 1, c);
        const names = [...new Set(p.map(r => r.genre).filter(Boolean))];
        console.log(`  ${c}  ${String(p.length).padStart(3)}건  ${names.join(', ') || '(없음)'}`);
      } catch (e) { console.log(`  ${c}  실패: ${e.message.slice(0, 60)}`); }
      await new Promise(r => setTimeout(r, 300));
    }
    return;
  }

  // --find=검색어: 공연명 검색(shprfnm)으로 "이 데이터에 K팝 공연이 실제로 들어있나"를 확인한다.
  // 이게 이 데이터소스를 계속 쓸지 말지를 가르는 질문이라, 수집을 짜기 전에 먼저 답해야 한다.
  if (typeof args.find === 'string') {
    const to2 = args.to || '20261231';
    const url = `${ENDPOINT}?service=${encodeURIComponent(key)}&stdate=${from}&eddate=${to2}&cpage=1&rows=50&shprfnm=${encodeURIComponent(args.find)}`;
    const xml = await (await fetch(url)).text();
    const got = [...xml.matchAll(/<db>([\s\S]*?)<\/db>/g)].map(m => m[1]).map(b => ({
      title: pick(b, 'prfnm'), genre: pick(b, 'genrenm'), venue: pick(b, 'fcltynm'),
      from: pick(b, 'prfpdfrom'), to: pick(b, 'prfpdto'),
    }));
    console.log(`"${args.find}" 검색 (${from}~${to2}) — ${got.length}건`);
    got.slice(0, 25).forEach(g => console.log(`  · [${g.genre}] ${g.title}  @${g.venue}  ${g.from}~${g.to}`));
    if (!got.length) console.log('  (0건 — 이 이름의 공연이 KOPIS에 등록돼 있지 않거나 공연명 표기가 다릅니다)');
    return;
  }

  // 장르는 쉼표로 여러 개 줄 수 있다(예: --genre=CCCD,EEEA). API가 한 번에 여러 코드를 받는지
  // 불확실해서 코드별로 따로 순회한다 — 확실하고, 진행 상황도 장르별로 보인다.
  // 안 주면 필터 없이 전체(=null 한 번)를 돈다. ⚠️ 그 경우 50페이지(5,000건) 상한에 쉽게 걸린다.
  const genres = genre ? String(genre).split(',').map(s => s.trim()).filter(Boolean) : [null];
  const rows = []; const seen = new Set();
  // ⚠️ **월 단위로 쪼개서 조회한다**(2026-08-28). 2년치를 한 번에 요청했더니 페이지 상한(50p=5,000건)에
  // 걸려 오래된 쪽이 통째로 잘렸다 — 요청은 2025-01~2026-12였는데 결과는 2025-10~2026-10만 들어왔다.
  // 조용한 누락이라 눈치채기 어렵다(개수만 보면 5,639건이라 많아 보인다). 기간을 잘게 나누면 각 구간이
  // 상한 아래로 떨어져 전 구간이 온전히 들어온다.
  const months = [];
  for (let y = +from.slice(0, 4), m = +from.slice(4, 6); y * 100 + m <= +to.slice(0, 4) * 100 + +to.slice(4, 6);) {
    const s = `${y}${String(m).padStart(2, '0')}01`;
    const last = new Date(y, m, 0).getDate();
    months.push([s, `${y}${String(m).padStart(2, '0')}${last}`]);
    if (++m > 12) { m = 1; y++; }
  }
  for (const g of genres) {
    for (const [ms, me] of months) {
      for (let page = 1; page <= 50; page++) {
        const got = await fetchPage(key, ms, me, page, g);
        if (!got.length) break;
        for (const r of got) { if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); } }
        if (got.length === 100 && page === 50) console.error(`\n⚠️ ${ms} ${g}: 한 달인데도 상한 도달 — 누락 가능성`);
        await new Promise(r => setTimeout(r, 200));   // 예의상 간격 — 공식 API라도 몰아치지 않는다
      }
      process.stderr.write(`\r[kopis] ${g ? GENRE_LABEL[g] || g : '전체'} ${ms.slice(0, 6)} — 누적 ${rows.length}건…   `);
    }
    process.stderr.write('\n');
  }

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

  // 공연장 이름을 홀 단위까지 살린다(2026-08-28). 목록 API의 prfplcnm 은 시설 단위라 '올림픽공원'
  // 하나에 체조경기장·올림픽홀·핸드볼경기장이 뒤섞인다 — 그대로 두면 장소별 모아보기가 뭉개지고,
  // 나중에 고치려 들면 이미 들어간 행을 전부 다시 매칭해야 해서 훨씬 비싸다. 매칭된 것만 상세를
  // 부르므로 요청 수는 매칭 건수만큼이다.
  await normalizeVenues(matched, key);

  // 매칭 결과를 JSON으로도 남긴다(2026-08-28). 수집은 몇 분씩 걸리는데 SQL 형식(컬럼·중복키 처리)은
  // 실제 스키마를 보고 정해야 해서, 형식을 바꿀 때마다 다시 긁는 건 낭비다. 이 파일이 있으면
  // --from-json 으로 재수집 없이 즉시 다시 뽑을 수 있다.
  const jsonFile = path.join(ROOT, 'events.matched.json');
  fs.writeFileSync(jsonFile, JSON.stringify(matched, null, 1));
  console.error(`매칭 ${matched.length}건 → ${jsonFile} (재수집 없이 SQL 재생성용)`);

  console.log(`-- KOPIS 공연목록 → kpop_events (${from}~${to})`);
  console.log(`-- 수집 ${rows.length}건 / 매칭 ${matched.length}건 / 미매칭 ${unmatched.length}건`);
  console.log(`-- ⚠️ official_url(예매 링크)은 KOPIS가 제공하지 않아 비워 둔다(사용자 결정, 2026-08-28).`);
  console.log('-- ⚠️ 실행 전 미매칭 목록(stderr)을 훑어볼 것 — 매칭기가 놓친 게 있으면 그게 더 중요하다.\n');
  for (const e of matched) {
    console.log(`insert into kpop_events (id,title,groups,date_start,date_end,venue,city,official_url) values (` +
      `${sq('kopis_' + e.id)},${sq(e.title)},array[${e.groups.map(sq).join(',')}],` +
      `${sq(e.date_start)},${sq(e.date_end)},${sq(e.venue)},${sq(e.city)},${e.relate ? sq(e.relate) : 'null'}) on conflict (id) do nothing;`);
  }
  // 미매칭은 **전량을 파일로** 남긴다. 앞 40개만 찍었더니 "놓친 게 있나" 감사가 표본 부족으로
  // 무의미했다(2026-08-28). 매칭기를 고칠 때 이 파일이 유일한 근거다.
  const unmFile = path.join(ROOT, 'events.unmatched.txt');
  fs.writeFileSync(unmFile, unmatched.map(u => `${u.title}\t${u.venue}\t${u.genre || ''}\t${u.why.join(' ') || '단서없음'}`).join('\n'));
  console.error(`\n미매칭 ${unmatched.length}건 전량 → ${unmFile}`);
  console.error('앞 25개:');
  unmatched.slice(0, 25).forEach(u => console.error(`  · ${u.title}  [${u.venue}]  ${u.why.join(' ') || '단서 없음'}`));
}

// ── 셀프테스트: 키 없이 매칭기만 점검 ────────────────────────────────────────
// ⚠️ 아래 코퍼스는 **실제 KOPIS 데이터가 아니라** 실제 그룹명에 흔한 공연명 패턴을 씌운 합성 표본이다.
//    이름 추출부(가장 위험한 부분)의 정확도만 본다. 진짜 재현율은 키를 받은 뒤 실데이터로 다시 재야 한다.
function selftest() {
  // ⚠️ 합성 표본이 아니라 **실제 KOPIS 응답**에서 가져온 제목이다(tools/kopis_fixture.json).
  // 2025~2026 무필터 5,000건 수집분의 매칭 결과를 눈으로 확인해 라벨링했다 — 오탐이 절반이었다.
  // 정밀도(오탐 안 내기)와 재현율(진짜를 놓치지 않기)을 같이 본다. 새 오탐을 만나면 픽스처에 추가할 것.
  const fx = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "kopis_fixture.json"), "utf8")).cases;
  let tp = 0, fn = 0, fp = 0, tn = 0; const bad = [];
  for (const c of fx) {
    const m = matchEvent(c.t);
    if (c.expect) {
      if (m.groups.includes(c.expect)) tp++;
      else { fn++; bad.push("  ❌ 놓침  " + c.t + "\n         기대=" + c.expect + " 결과=" + JSON.stringify(m.groups)); }
    } else {
      if (!m.groups.length) tn++;
      else { fp++; bad.push("  ❌ 오탐  " + c.t + "\n         → " + JSON.stringify(m.groups) + "  (" + m.why.join(" ") + ")"); }
    }
  }
  const prec = (tp + fp) ? (tp / (tp + fp) * 100).toFixed(1) : "-";
  const rec = (tp + fn) ? (tp / (tp + fn) * 100).toFixed(1) : "-";
  console.log("실데이터 픽스처 " + fx.length + "건 (양성 " + (tp + fn) + " · 음성 " + (tn + fp) + ")\n");
  if (bad.length) console.log(bad.join("\n") + "\n");
  console.log("재현율 " + rec + "%  (" + tp + "/" + (tp + fn) + " 찾음)");
  console.log("정밀도 " + prec + "%  (오탐 " + fp + "건 / 음성 " + (tn + fp) + "건 중)");
  process.exit((fp || fn) ? 1 : 0);
}
main().catch(e => { console.error('[kopis] 실패:', e.message); process.exit(2); });
