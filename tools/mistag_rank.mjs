// 오태깅 의심 순위 — 멤버별 "근거 없는 태그 비율" 전수 집계 (2026-09-28, LEARNING_LOOP P3)
//
// 왜: 오태깅은 사용자가 카드를 보다 발견해야만 드러났다(9/28 제이미 카드: "이미"가 든 영상 119건 중 대부분).
// 원인은 매번 달랐지만(흔한단어·동명이인·성 뗀 조각·로스터 밖 동명 가수) **흔적은 같다 — 태그된 사람의 이름이
// 제목·설명 어디에도 없다.** name_pollution_probe.mjs는 "위험해 보이는 이름" 후보만 표본으로 봐서, 후보 목록에
// 없는 새 유형(제이미의 "이미")은 못 잡았다. 여기선 후보를 정하지 않고 최근 90일 태그를 **전부** 센다.
//
// 근거 = 태그된 사람의 표기(정식명·영문명·별칭·매처가 실제로 쓰는 이름 변형)가 제목/설명에 있음.
// 제외 = 주인 채널(source_tier idol·fans·grpsub — 채널 자체가 그 사람이라 제목에 이름이 없는 게 정상),
//        수동 편집(tags_manual — 사람이 확인한 것), 숨김/무관/보류(이미 화면에 안 나옴).
// ⚠️ 비율이 높다 = "의심". 확정 아님 — 순위 상위의 표본 제목을 보고 원인을 찾을 것(TAGGING.md 추적표).
// ⚠️ 읽기 전용. DB에 아무것도 쓰지 않는다.
//
// 실행: node tools/mistag_rank.mjs [--days 90] [--min 8] [--top 20] [--json out.json] [--md]
//   회사망: NODE_TLS_REJECT_UNAUTHORIZED=0 을 앞에 붙일 것.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { _m2NameVariants, ARTISTS, GROUPS } = require('./matcher_harness.cjs');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const DAYS = +arg('--days', 90), MIN = +arg('--min', 8), TOP = +arg('--top', 20);
const U = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const K = process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const H = { apikey: K, Authorization: 'Bearer ' + K };
const OWNER_TIERS = new Set(['idol', 'fans', 'grpsub']);
const norm = s => String(s || '').toUpperCase().replace(/[^0-9A-Z가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function mistagRank({ days = DAYS, min = MIN, top = TOP } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  // ⚠️ 배열 조건(members.neq.{})+정렬+깊은 offset은 statement timeout(실측) — 날짜를 3일씩 잘라 받고
  //    "태그 있음" 판정은 여기서 한다(하루 업로드 ~250건이라 창 하나가 1,000행 안팎).
  const rows = [];
  const day = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  for (let d = days; d > 0; d -= 3) {
    const from = day(d), to = day(Math.max(d - 3, -1));
    for (let off = 0; ; off += 1000) {
      const q = `select=id,title,description,group_ko,members,with_members,source_tier,tags_manual,content_flag`
        + `&published_at=gte.${from}&published_at=lt.${to}&order=id&offset=${off}&limit=1000`;
      const r = await fetch(`${U}?${q}`, { headers: H });
      const got = await r.json();
      if (!Array.isArray(got)) throw new Error('조회 실패: ' + JSON.stringify(got).slice(0, 200));
      rows.push(...got.filter(v => (v.members || []).length || (v.with_members || []).length));
      if (got.length < 1000) break;
    }
  }
  // 사람 찾기: members는 group_ko 기준, with_members는 "이름(그룹)" 표기
  const byKey = new Map();
  for (const a of ARTISTS) for (const g of (a.groups || [a.group])) if (g?.ko) byKey.set(`${a.name.ko}|${g.ko}`, a);
  const byName = new Map(); for (const a of ARTISTS) if (!byName.has(a.name.ko)) byName.set(a.name.ko, a);
  // 근거 판정은 **관대하게** 한다 — 여기서 걸리는 건 "어떤 표기로도 이 사람이 안 보이는" 태그여야 한다.
  //  · 성 뗀 이름(시온·매튜)은 다른 사람과 겹쳐 매처 변형에선 빠져도 근거로는 인정(첫 실행 오탐: 박시온 #시온)
  //  · 영문은 띄어쓰기 무시 + 이름 부분만(YE CHAN = Yechan, Kim Soomin → SOOMIN)
  //  · 한글 2자↑는 붙어 있어도 인정(#소정환 ⊃ 정환, 승관아 ⊃ 승관) — 1자 이름은 부분일치 금지(진·온)
  const tokCache = new Map();
  const { _atmStripSurname } = require('./matcher_harness.cjs');
  const toks = a => {
    if (!tokCache.has(a)) {
      const en = norm(a.name.en), enParts = en.split(' ').filter(Boolean);
      const st = (() => { try { return _atmStripSurname([...a.name.ko]); } catch (e) { return null; } })();
      const raw = [..._m2NameVariants(a), ...(a.matchAliases || []), a.subName, a.displayName, st, en.replace(/ /g, ''), enParts.length > 1 ? enParts[enParts.length - 1] : null];
      tokCache.set(a, [...new Set(raw.filter(Boolean).map(norm).map(t => t.replace(/ /g, '')).filter(t => t.length >= 2 || /[가-힣]/.test(t)))]);
    }
    return tokCache.get(a);
  };
  const stat = new Map(); // key -> {name, group, n, bad, samples[]}
  const hit = (hay, compact, a) => toks(a).some(t => hay.includes(' ' + t + ' ')
    || (/[가-힣]/.test(t) ? t.length >= 2 && compact.includes(t) : t.length >= 4 && compact.includes(t)));
  for (const v of rows) {
    if (v.tags_manual || OWNER_TIERS.has(v.source_tier)) continue;
    if (['hidden', '무관', '보류'].includes(v.content_flag)) continue;
    const hay = ' ' + norm(v.title + ' ' + String(v.description || '').slice(0, 2500)) + ' ';
    const compact = hay.replace(/ /g, '');
    const tags = [...(v.members || []).map(m => [m, v.group_ko, 'm']),
      ...(v.with_members || []).map(w => { const m = /^(.*)\(([^()]*)\)$/.exec(w); return m ? [m[1], m[2], 'w'] : null; }).filter(Boolean)];
    for (const [name, gko, kind] of tags) {
      const a = byKey.get(`${name}|${gko}`) || byName.get(name);
      if (!a) continue;
      const key = `${name}(${gko})`;
      if (!stat.has(key)) stat.set(key, { key, name, group: gko, n: 0, bad: 0, samples: [] });
      const s = stat.get(key); s.n++;
      if (!hit(hay, compact, a)) { s.bad++; if (s.samples.length < 4) s.samples.push(`${kind === 'w' ? '[게스트] ' : ''}${v.title.slice(0, 70)} (${v.id})`); }
    }
  }
  const ranked = [...stat.values()].filter(s => s.n >= min).map(s => ({ ...s, ratio: s.bad / s.n }))
    .filter(s => s.ratio >= 0.3).sort((a, b) => b.bad * b.ratio - a.bad * a.ratio).slice(0, top);
  return { since, scanned: rows.length, people: stat.size, ranked };
}

export function mistagMarkdown(res) {
  if (!res.ranked.length) return `최근 ${res.since} 이후 태그 ${res.scanned}건 — 의심 없음 ✅`;
  return [`최근 ${res.since} 이후 태그 달린 영상 ${res.scanned.toLocaleString()}건 · 사람 ${res.people}명 중 **근거 없는 태그 비율 30%↑** (주인 채널·수동편집·숨김 제외)`, '',
    '| 멤버(그룹) | 근거 없음 / 전체 | 표본 |', '|---|---|---|',
    ...res.ranked.map(s => `| ${s.key} | **${s.bad}**/${s.n} (${Math.round(s.ratio * 100)}%) | ${s.samples.slice(0, 2).map(x => x.replace(/\|/g, '/')).join('<br>')} |`),
    '', '원인 찾는 법·유형별 방어선은 TAGGING.md "오태깅 추적표".'].join('\n');
}

if (/mistag_rank\.mjs$/.test(process.argv[1] || '')) { // 직접 실행일 때만(주간 보고가 import할 땐 안 돎)
  const res = await mistagRank();
  if (process.argv.includes('--md')) console.log(mistagMarkdown(res));
  else {
    console.log(`스캔 ${res.scanned}건 (since ${res.since}) · 사람 ${res.people}명`);
    for (const s of res.ranked) { console.log(`${String(s.bad).padStart(4)}/${String(s.n).padEnd(4)} ${Math.round(s.ratio * 100)}%  ${s.key}`); s.samples.slice(0, 3).forEach(x => console.log('        ' + x)); }
  }
  const out = arg('--json'); if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
}
