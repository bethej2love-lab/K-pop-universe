// 태깅 정확도 감사 — 수동 수정분을 정답지로 삼아 매처(_m2ParseTitle)를 채점한다 (2026-09-15)
//
// 목표: "제목에서 함께한 멤버·원곡을 95% 이상 정확히 뽑는다"는 목표에 지금 얼마나 와 있는지를
// **감이 아니라 숫자로** 알기. 그리고 틀리는 방식을 유형별로 갈라 우선순위를 정하기.
//
// 정답지: tags_manual=true 행(사람이 직접 태그를 고치거나 확정한 것). 완벽한 정답은 아니다 —
//   "고쳤다"와 "보고 맞다고 확인했다"가 같은 플래그를 쓰기 때문이다. 그래도 사람 판단이 들어간
//   유일한 대량 코퍼스이고, 아래 집계는 그 한계를 전제로 읽어야 한다.
//
// ⚠️ 매처는 tools/matcher_harness.cjs로 **실제 배포 코드를 잘라내** 돌린다(복붙 아님).
// ⚠️ 이 도구는 **아무것도 쓰지 않는다**. 읽고 세고 표를 뿌릴 뿐이다.
//
// 실행: node tools/tagging_audit.cjs [--limit N] [--out 파일.json]

const fs = require('fs');
const path = require('path');
const { _m2ParseTitle, GROUPS, ARTISTS } = require('./matcher_harness.cjs');

const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const arg = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const LIMIT = Number(arg('--limit') || 0) || Infinity;
const OUT = arg('--out');

const eq = (a, b) => {
  const A = [...new Set(a || [])].sort(), B = [...new Set(b || [])].sort();
  return A.length === B.length && A.every((x, i) => x === B[i]);
};
const norm = s => String(s || '').trim();

// ⚠️ **ORDER BY를 붙이지 않는다.** tags_manual은 인덱스가 없어서 정렬을 걸면 PK/정렬 인덱스를
//    45만 행 훑다가 statement timeout(57014)이 난다. 실측(2026-09-15, limit 1000):
//      order=id → 13.9초(부하 있으면 500)  ·  order=group_ko → 30초 타임아웃  ·  정렬 없음 → 0.59초
//    (같은 함정을 tools/shorts_promote.mjs에서 먼저 겪었다 — 그쪽 머리 주석 참고.)
// 정렬이 없으면 페이지 경계가 이론상 흔들릴 수 있어 **id로 중복 제거**하고, 최종 건수를 같이 찍는다.
async function fetchAll(qs) {
  const seen = new Set(), rows = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SB}?${qs}&limit=1000&offset=${off}`, { headers: H });
    if (!r.ok) throw new Error(`조회 실패 ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    for (const v of j) if (v.id && !seen.has(v.id)) { seen.add(v.id); rows.push(v); }
    if (j.length < 1000 || rows.length >= LIMIT) break;
  }
  return rows.slice(0, LIMIT === Infinity ? undefined : LIMIT);
}

(async () => {
  console.log('[audit] 수동 수정분(tags_manual=true) 조회 중…');
  const rows = await fetchAll('select=id,group_ko,title,members,with_members,with_groups,cover_of_members,cover_of_groups,category,source_handle,published_at&tags_manual=eq.true');
  console.log(`[audit] ${rows.length.toLocaleString()}건 확보\n`);

  // 매처 결과를 DB 스키마(members/with_members)와 같은 모양으로 편다.
  // _m2ParseTitle → {primaryGroup, withGroups[], membersByGroup:{그룹:[이름]}, confidence}
  const toTags = (r, selfGko) => {
    if (!r) return { members: [], withMembers: [], withGroups: [] };
    const mine = (r.membersByGroup && r.membersByGroup[selfGko]) || [];
    const withM = [];
    for (const [g, list] of Object.entries(r.membersByGroup || {})) {
      if (g === selfGko) continue;
      for (const n of list) withM.push(`${n}(${g})`); // DB의 with_members 표기 규약
    }
    return { members: mine, withMembers: withM, withGroups: r.withGroups || [] };
  };

  const stat = {
    total: 0, parsed: 0, nullOut: 0,
    memExact: 0, memMiss: 0, memExtra: 0, memBoth: 0,
    wmExact: 0, wmMiss: 0, wmExtra: 0, wmBoth: 0,
  };
  const buckets = {};                      // 유형 → [{id,title,...}]
  const add = (k, o) => { (buckets[k] = buckets[k] || []).push(o); };

  for (const v of rows) {
    stat.total++;
    let out = null;
    try { out = _m2ParseTitle(v.title, v.group_ko, undefined, v.published_at); }
    catch (e) { add('매처 예외', { id: v.id, title: v.title, why: e.message }); continue; }
    if (!out) stat.nullOut++; else stat.parsed++;
    const got = toTags(out, v.group_ko);
    const want = { members: v.members || [], withMembers: v.with_members || [] };

    // ── members(본 그룹 출연자) ──
    const mMissing = want.members.filter(x => !got.members.includes(x));   // 사람은 넣었는데 매처가 못 뽑음
    const mExtra = got.members.filter(x => !want.members.includes(x));     // 매처가 넣었는데 사람이 지움
    if (!mMissing.length && !mExtra.length) stat.memExact++;
    else {
      if (mMissing.length && mExtra.length) stat.memBoth++;
      else if (mMissing.length) stat.memMiss++;
      else stat.memExtra++;
      add(mMissing.length && mExtra.length ? 'members: 서로 다름'
        : mMissing.length ? 'members: 매처가 놓침(사람이 추가)'
          : 'members: 매처가 과다(사람이 제거)',
        { id: v.id, g: v.group_ko, title: v.title, want: want.members, got: got.members, miss: mMissing, extra: mExtra, src: v.source_handle, cat: v.category });
    }

    // ── with_members(콜라보 출연자) ──
    const wMissing = want.withMembers.filter(x => !got.withMembers.includes(x));
    const wExtra = got.withMembers.filter(x => !want.withMembers.includes(x));
    if (!wMissing.length && !wExtra.length) stat.wmExact++;
    else {
      if (wMissing.length && wExtra.length) stat.wmBoth++;
      else if (wMissing.length) stat.wmMiss++;
      else stat.wmExtra++;
      add(wMissing.length && wExtra.length ? 'with_members: 서로 다름'
        : wMissing.length ? 'with_members: 매처가 놓침(사람이 추가)'
          : 'with_members: 매처가 과다(사람이 제거)',
        { id: v.id, g: v.group_ko, title: v.title, want: want.withMembers, got: got.withMembers, miss: wMissing, extra: wExtra, src: v.source_handle, cat: v.category });
    }
  }

  const pct = (n, d) => d ? (n / d * 100).toFixed(1) + '%' : '-';
  console.log('## 매처 vs 사람 수정 — 일치율\n');
  console.log('| 항목 | 정확히 일치 | 놓침 | 과다 | 둘 다 |');
  console.log('|---|---|---|---|---|');
  console.log(`| members | ${stat.memExact} (${pct(stat.memExact, stat.total)}) | ${stat.memMiss} | ${stat.memExtra} | ${stat.memBoth} |`);
  console.log(`| with_members | ${stat.wmExact} (${pct(stat.wmExact, stat.total)}) | ${stat.wmMiss} | ${stat.wmExtra} | ${stat.wmBoth} |`);
  console.log(`\n매처가 아무것도 못 뽑은 행(null): ${stat.nullOut} (${pct(stat.nullOut, stat.total)})`);

  console.log('\n## 불일치 유형별 규모\n');
  console.log('| 유형 | 건수 |');
  console.log('|---|---|');
  for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1].length - a[1].length)) console.log(`| ${k} | ${v.length} |`);

  // 채널(source_handle)별 집중도 — 특정 채널이 유독 많이 틀리면 "채널 규칙"으로 풀 수 있다는 신호.
  const byChan = {};
  for (const [k, list] of Object.entries(buckets)) {
    for (const o of list) { const s = o.src || '(공식/미상)'; byChan[s] = byChan[s] || { n: 0, kinds: {} }; byChan[s].n++; byChan[s].kinds[k] = (byChan[s].kinds[k] || 0) + 1; }
  }
  console.log('\n## 불일치가 몰린 채널 상위 15\n');
  console.log('| 채널 | 불일치 | 대표 유형 |');
  console.log('|---|---|---|');
  Object.entries(byChan).sort((a, b) => b[1].n - a[1].n).slice(0, 15).forEach(([s, o]) => {
    const top = Object.entries(o.kinds).sort((x, y) => y[1] - x[1])[0];
    console.log(`| ${s} | ${o.n} | ${top[0]} ${top[1]} |`);
  });

  if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ stat, buckets }, null, 1)); console.log(`\n상세 저장: ${OUT}`); }
  else {
    for (const k of Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length).slice(0, 3)) {
      console.log(`\n### 표본 — ${k}`);
      buckets[k].slice(0, 8).forEach(o => console.log(`  · [${o.g}] ${String(o.title).slice(0, 62)}\n      사람=${JSON.stringify(o.want)} 매처=${JSON.stringify(o.got)}`));
    }
  }
})();
