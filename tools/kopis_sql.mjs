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

// type은 NOT NULL인데 기본값이 없어 반드시 넣어야 한다. 기존 행이 쓰는 어휘와 어긋나면
// 필터링이 갈라지므로, 값은 --type=... 으로 바깥에서 받는다(기본은 제목에서 추론).
const FIXED_TYPE = typeof args.type === 'string' ? args.type : null;
const inferType = t =>
  /팬미팅|FAN\s?MEETING|FANMEETING|FAN[- ]?CON\b|FANCON|팬콘/i.test(t) ? 'fanmeeting'
    : /페스티벌|FESTIVAL/i.test(t) ? 'festival'
      : /쇼케이스|SHOWCASE/i.test(t) ? 'showcase'
        : 'concert';

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
  return true;
});
if (dropped.length) {
  console.error(`제외 ${dropped.length}건:`);
  dropped.forEach(([why, t]) => console.error(`  · [${why}] ${t.slice(0, 70)}`));
}

const out = [];
out.push(`-- KOPIS 공연목록 → kpop_events  (생성 ${keep.length}건 / 매칭 ${rows.length}건 중 ${dropped.length}건 제외)`);
out.push(`-- 스키마 확인 후 재생성: id는 DB가 만든다(gen_random_uuid), 중복은 (title,date_start,venue)로 막는다.`);
out.push(`-- 여러 번 실행해도 안전하다(이미 있으면 건너뜀).`);
out.push(`-- 출처: 공연예술통합전산망(KOPIS) 오픈API`);
out.push('');
const typeCount = {};
for (const e of keep) {
  const type = FIXED_TYPE || inferType(e.title);
  typeCount[type] = (typeCount[type] || 0) + 1;
  const overseas = e.city === '해외';
  out.push(
    `insert into kpop_events (title,type,date_start,date_end,venue,city,country,groups,poster_url,official_url)\n` +
    `select ${sq(e.title)},${sq(type)},${sq(e.date_start)},${e.date_end ? sq(e.date_end) : 'null'},` +
    `${sq(e.venue)},${e.city ? sq(e.city) : 'null'},${overseas ? sq('해외') : sq('대한민국')},` +
    `array[${e.groups.map(sq).join(',')}]::text[],${e.poster ? sq(e.poster) : 'null'},${e.relate ? sq(e.relate) : 'null'}\n` +
    `where not exists (select 1 from kpop_events where title=${sq(e.title)} and date_start=${sq(e.date_start)} and venue=${sq(e.venue)});`
  );
}
console.log(out.join('\n'));
console.error(`type 분포: ${Object.entries(typeCount).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.error(`포스터 있는 행: ${keep.filter(r => r.poster).length}/${keep.length}`);
console.error(`해외 공연: ${keep.filter(r => r.city === '해외').length}건`);
