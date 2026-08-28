#!/usr/bin/env node
// events.matched.json → kpop_events INSERT SQL (2026-08-28 신설)
//
// 왜 별도 파일인가: 수집은 몇 분씩 걸리는데 SQL 형식은 실제 스키마를 보고 정해야 했다.
// 형식을 바꿀 때마다 다시 긁는 건 낭비라, 수집(kopis_events.mjs)과 SQL 생성을 분리했다.
//
// 실제 스키마(2026-08-28 확인):
//   id           uuid        NOT NULL  default gen_random_uuid()   ← **직접 넣지 않는다**
//   title        text        NOT NULL
//   type         text        NOT NULL  (기본값 없음 — 반드시 채워야 함)
//   date_start   date        NOT NULL
//   date_end     date        NULL
//   venue        text        NOT NULL
//   city         text        NULL
//   country      text        NOT NULL  default '대한민국'
//   groups       text[]      NOT NULL  default '{}'
//   poster_url   text        NULL      ← KOPIS가 포스터를 주므로 채운다(UI는 아직 안 씀)
//   official_url text        NULL
//
// ⚠️ **중복 방지**: id가 uuid라 `on conflict (id)`는 무의미하다(매번 새 uuid). 유니크 제약도
//    없으므로 `where not exists`로 (title, date_start, venue) 조합이 이미 있으면 건너뛴다.
//    같은 SQL을 여러 번 실행해도 안전하다. 나중에 정기 수집을 붙이면 그때 유니크 인덱스를 고려.
//
// 사용법: node tools/kopis_sql.mjs [--type-map] > events.sql

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(s => { const m = s.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [s, true]; }));

const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'events.matched.json'), 'utf8'));
const sq = s => `'${String(s ?? '').replace(/'/g, "''")}'`;

// type은 NOT NULL인데 기본값이 없어 반드시 넣어야 한다.
// ⚠️ **기존 행의 어휘를 그대로 따른다**(2026-08-28 실측: 콘서트7 · 팬미팅2 · 팬콘1 · 페스티벌1).
//    처음엔 영문('concert','fanmeeting'…)으로 넣을 뻔했는데, 그러면 같은 뜻이 두 어휘로 갈려
//    나중에 type으로 거르는 화면이 절반만 보게 된다. 스키마만 맞추고 **어휘를 안 맞추는 것**도
//    같은 종류의 사고다.
// ⚠️ 기존 데이터가 팬미팅과 팬콘을 **따로** 두고 있어 추론기도 둘을 나눈다(원래는 뭉뚱그렸다).
// ⚠️⚠️ **type에는 CHECK 제약이 걸려 있다.** 처음엔 '쇼케이스'를 "기존에 없지만 자연스러운 확장"이라며
//    새로 만들어 넣었다가 `kpop_events_type_check` 위반으로 전체가 실패했다 — 바로 위에서 "어휘를
//    맞춰야 한다"고 써놓고 스스로 어긴 것이다. 허용값을 모르는 상태에서 새 값을 만들면 안 된다.
//    그래서 **DB에 존재가 확인된 4개 값으로만** 제한한다(콘서트·팬미팅·팬콘·페스티벌).
//    쇼케이스류는 콘서트로 접는다. 나중에 제약을 넓히면 그때 분리하면 된다.
const FIXED_TYPE = typeof args.type === 'string' ? args.type : null;
const inferType = t =>
  /팬\s?콘\b|FAN[-\s]?CON(?!CERT)|FANCON/i.test(t) ? '팬콘'
    : /팬미팅|FAN\s?MEETING|FANMEETING/i.test(t) ? '팬미팅'
      // ⚠️ 'Festival'이 투어·앨범 이름의 일부인 경우가 많다 — "Red Velvet SPECIAL LIVE, The ReVe
      //    Festival", "GOT7 CONCERT: NESTFEST"는 그룹 자기 콘서트지 페스티벌이 아니다.
      //    제목에 CONCERT/LIVE/TOUR가 같이 있으면 그쪽이 실체라 콘서트로 둔다.
      : (/페스티벌|FESTIVAL|FEST\b/i.test(t) && !/CONCERT|콘서트|LIVE|TOUR|투어/i.test(t)) ? '페스티벌'
        : '콘서트';   // 쇼케이스도 여기로 접는다(위 CHECK 제약 주석 참고)
// 안전망: 추론 결과가 허용값 밖이면 절대 내보내지 않는다. 값을 하나 더 늘리고 싶으면
// 먼저 DB의 CHECK 제약을 넓히고 이 목록에 추가할 것 — 순서를 반대로 했다가 전체가 실패했다.
const ALLOWED_TYPES = new Set(['콘서트', '팬미팅', '팬콘', '페스티벌']);

// ── 흔한단어 그룹명 2차 필터 (2026-08-28, 716건 전수 눈검사) ─────────────────────
// 수집기(kopis_events.mjs)의 AMBIGUOUS 목록은 1차 표본(5,000건)에서 만든 거라, 2018년까지 넓힌
// 26,705건에서 새 오탐이 더 나왔다. 재수집은 10분씩 걸리므로 여기서 **조이는 방향으로만** 거른다
// (조이기만 하니 놓친 건 새로 안 생긴다 — 느슨하게 하려면 그땐 재수집해야 한다).
//
// 판별 규칙은 수집기와 같다: 그룹명이 일상어면 **제목 맨 앞**에 와야 그 그룹의 공연이다.
//   "안치환 콘서트, HISTORY" → 히스토리 ❌   "HISTORY 단독 콘서트" → 히스토리 ✅
// ⚠️ 반대로 "어썸스테이지, N.Flying", "라이브온, 비투비 x 엔플라잉"처럼 **출연자 나열**은 정당해서
//    살려야 한다. 그래서 전면 금지가 아니라 "일상어인 이름만" 맨 앞을 요구한다.
const AMBIGUOUS2 = new Set([
  // 1차 목록
  '앨리스', '시그니처', '아르테미스', '하이라이트', '위너', '네이처', '신화', '아이들', '레인보우',
  '시크릿', '트레저', '슈가', '위클리', '에이프릴', '인피니트', '티아라', '다이아', '펜타곤', '여자친구',
  // 2차(2018~2026 확대 수집에서 새로 나온 것). 각각 실제로 걸렸던 오탐:
  '히스토리',      // "안치환 콘서트, HISTORY" / "브레이킹 히스토리"
  '템페스트',      // "심규선 단독 콘서트, 요란: Tempest" / "장계현과 템페스트 파워 디너 콘서트"
  '슈퍼노바',      // "너드커넥션 단독 공연: SUPERNOVA!" / "제이림 슈퍼노바 페스티벌"
  '세븐틴',        // "노들인디션 크리스피 단독공연: Seventeen"(숫자 17)
  '세이마이네임',  // "KAVE 단독 콘서트 투어: Say My Name"
  '스텔라',        // "... Fan Concert In Asia: Stellar Time"
  '유니티',        // "바닐라 유니티 컴백기념 단독 콘서트"
  '클라씨',        // "12월의 블랜딩 노트, Classy jazz"
  '앤팀',          // en이 '&TEAM'인데 정규화하면 'TEAM' → "TEAM 노지훈"
  '온앤오프',      // "이대원의 온앤오프 스테이지"
  '빌리',          // "현대카드 슈퍼콘서트, 빌리 아일리시"
  '배틀',          // "네미시스 BATTLE II, 노승호"
  '피에스타',      // "인천 월드뮤직 피에스타"
  '아홉',          // "제972회 목요예술무대: 아홉 번째 파장"
  'god',           // "예레미 모비딕 콘서트, my rock n roll & my God"
]);
const GROUPS_JSON = (() => { const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')); return g.groups || g; })();
const NORM2 = s => ' ' + String(s || '').toUpperCase().replace(/[^가-힣A-Z0-9]/g, ' ').replace(/\s+/g, ' ') + ' ';
const isLead2 = (nu, tok) => {
  const w = nu.trim().split(' ').filter(Boolean);
  let i = 0; while (i < w.length && /^[0-9]+$/.test(w[i])) i++;
  const t = NORM2(tok).trim().split(' ').filter(Boolean);
  return t.every((x, k) => w[i + k] === x);
};

// ── 이벤트 성격 필터 (2026-08-28, 716건 눈검사에서 나온 것) ─────────────────────
// 이름 매칭 문제가 아니라 **이 행이 애초에 "공연"인가**의 문제라 여기서 거른다(재수집 불필요).
const dropped = [];
const keep = rows.filter(e => {
  // ① 상영회 — 콘서트 실황을 극장에서 트는 것. 공연이 아니다.
  //    "Surround Viewing, Red Velvet 1st Concert Red Room", "EXO PLANET #2 ... SHORT VERSION"
  if (/Surround\s?Viewing|LIVE\s?VIEWING|라이브\s?뷰잉|상영회|극장\s?상영/i.test(e.title)) {
    dropped.push(['상영회', e.title]); return false;
  }
  // ② 기간이 비상식적으로 긴 것 — KOPIS가 재상영/장기 등록을 한 행으로 묶어놓은 경우다.
  //    "SUPER SHOW 6" 2015-08-21~2020-04-05(4.6년), "TVXQ! CONCERT: CIRCLE" 1.4년.
  //    이런 행은 D-day·날짜 표기가 무의미해져 화면에서 오히려 해가 된다.
  //    ⚠️ 진짜 장기 투어(TXT 일본 투어 50일)는 살려야 하므로 180일로 넉넉히 잡는다.
  if (e.date_end) {
    const days = (new Date(e.date_end) - new Date(e.date_start)) / 86400000;
    if (days > 180) { dropped.push([`기간 ${Math.round(days)}일`, e.title]); return false; }
  }
  // ③ 흔한단어 그룹명이 제목 맨 앞이 아닌 경우(위 AMBIGUOUS2 주석 참고)
  const g = e.groups[0];
  if (AMBIGUOUS2.has(g)) {
    const nu = NORM2(e.title);
    const toks = [g, (GROUPS_JSON[g] || {}).en, ...((GROUPS_JSON[g] || {}).altNames || [])].filter(Boolean);
    const hit = toks.find(t => nu.includes(' ' + NORM2(t).trim() + ' '));
    if (hit && !isLead2(nu, hit)) { dropped.push([`흔한단어 ${g}`, e.title]); return false; }
  }
  return true;
});
if (dropped.length) {
  console.error(`제외 ${dropped.length}건:`);
  dropped.forEach(([why, t]) => console.error(`  · [${why}] ${t.slice(0, 70)}`));
}

const out = [];
out.push(`-- KOPIS 공연목록 → kpop_events  (생성 ${keep.length}건 / 매칭 ${rows.length}건 중 ${dropped.length}건 제외)`);
out.push(`-- 스키마 확인 후 재생성: id는 DB가 만든다(gen_random_uuid), 중복은 (title,date_start)로 막는다.`);
out.push(`-- 여러 번 실행해도 안전하다(이미 있으면 건너뜀).`);
out.push(`-- 출처: 공연예술통합전산망(KOPIS) 오픈API`);
out.push('');
// ⚠️ 행마다 `insert … where not exists (select … title='…' and date_start='…' and venue='…')`를
// 반복하면 제목·날짜·공연장이 **두 번씩** 들어가 파일이 두 배로 커진다(376KB → 27개 파일로 쪼개야
// 했다). VALUES 목록 하나로 묶고 not exists는 그 목록을 참조하면 텍스트가 절반 아래로 줄고, 붙여넣기
// 횟수도 그만큼 준다. 중복 방지 동작은 완전히 같다(같은 title+date_start면 건너뜀).
// ⚠️ 키에서 venue를 뺐다(2026-08-28). 공연장 이름을 홀 단위로 표준화하면서 DB의
//    '올림픽공원 체조경기장'과 KOPIS 목록 API의 '올림픽공원'이 안 맞게 됐고, venue가 키에 있으면
//    같은 공연이 매 수집마다 새 행으로 다시 들어간다. 같은 팀이 같은 날 두 공연장에 설 수는 없다.
const BATCH = 60;
const typeCount = {};
const vals = [];
for (const e of keep) {
  const type = FIXED_TYPE || inferType(e.title);
  if (!ALLOWED_TYPES.has(type)) { console.error(`허용되지 않은 type "${type}" — 중단합니다: ${e.title}`); process.exit(1); }
  typeCount[type] = (typeCount[type] || 0) + 1;
  const overseas = e.city === '해외';
  vals.push(`(${sq(e.title)},${sq(type)},${sq(e.date_start)},${e.date_end ? sq(e.date_end) : 'null'},` +
    `${sq(e.venue)},${e.city ? sq(e.city) : 'null'},${overseas ? sq('해외') : sq('대한민국')},` +
    `array[${e.groups.map(sq).join(',')}],${e.poster ? sq(e.poster) : 'null'},${e.relate ? sq(e.relate) : 'null'})`);
}
for (let i = 0; i < vals.length; i += BATCH) {
  const chunk = vals.slice(i, i + BATCH);
  out.push(
    `insert into kpop_events (title,type,date_start,date_end,venue,city,country,groups,poster_url,official_url)\n` +
    `select v.title,v.type,v.date_start::date,v.date_end::date,v.venue,v.city,v.country,v.groups::text[],v.poster_url,v.official_url\n` +
    `from (values\n${chunk.join(',\n')}\n) as v(title,type,date_start,date_end,venue,city,country,groups,poster_url,official_url)\n` +
    `where not exists (select 1 from kpop_events k where k.title=v.title and k.date_start=v.date_start::date);`
  );
}
console.log(out.join('\n'));
console.error(`type 분포: ${Object.entries(typeCount).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.error(`포스터 있는 행: ${keep.filter(r => r.poster).length}/${keep.length}`);
console.error(`해외 공연: ${keep.filter(r => r.city === '해외').length}건`);
