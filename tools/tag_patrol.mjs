// 태그 순찰 — 사용자가 제보하기 전에 오태깅 유형을 먼저 찾는다 (2026-09-29)
//
// 왜: 2026-09-29 하루에만 제보 3건(제임스 안·아사히 맥주·한승우→스키즈 한)이 전부 "같은 유형이 수십~수백 건"이었다.
// mistag_rank.mjs는 "이름이 어디에도 없는 태그"만 봐서, **근거가 있긴 한데 약한** 태그(HAN SEUNG WOO의 han,
// YOON SEO RYEONG의 yoon, Jay Park의 jay)는 못 봤다. 여기선 두 가지를 더 본다.
//
//  A. 재판정 불일치 — 지금 태그를 **현재 매처**(자체 채널 매칭+외부 역추론)로 다시 돌렸을 때 어느 쪽도 그 사람을
//     안 잡는 태그. 코드는 고쳤는데 데이터에 남은 옛 오태깅(9/29 82건 같은 것)이 여기 뜬다.
//  B. 약한 근거 — 매처는 잡지만, 근거가 **짧은 영문 토큰 하나뿐**인 태그(한글 이름·#해시태그·그룹명이 제목/설명
//     어디에도 없음). 새 오태깅 유형의 씨앗이 여기 뜬다(9/29 기준 스키즈 한·스테이씨 윤·러블리즈 JIN·엔하이픈 제이가 상위).
//
// 제외: 주인 채널(source_tier idol·fans·grpsub), 수동 편집(tags_manual), 숨김/무관/보류(이미 화면에 없음).
// ⚠️ 읽기 전용. DB에 아무것도 쓰지 않는다. 결과는 "의심"이다 — 표본을 보고 원인을 확인한 뒤 고칠 것(TAGGING.md 추적표).
//
// 실행: node tools/tag_patrol.mjs [--days 30] [--top 12] [--json out.json] [--md]
//   회사망: NODE_TLS_REJECT_UNAUTHORIZED=0 을 앞에 붙일 것.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { _m2ParseTitle, ARTISTS, GROUPS, _PROJECT_UNITS } = require('./matcher_harness.cjs');
// 그 사람이 속한 유닛 이름(드림캐쳐 유아유 "UAU")도 강한 근거 — 9/28 이 유닛을 "근거 없음"으로 보고 동명 그룹이라
// 추측해 멀쩡한 태그를 지운 사고가 있었다(mistag_rank와 같은 처리).
const unitNamesOf = (ko, g) => Object.values(_PROJECT_UNITS || {}).filter(u => (u.members || []).some(m => m.mko === ko && m.gko === g)).flatMap(u => u.names || []);
const M2 = require('./m2_harness.js').load();

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const U = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const K = process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const H = { apikey: K, Authorization: 'Bearer ' + K };
const OWNER_TIERS = new Set(['idol', 'fans', 'grpsub']);
const ag = a => a.groups || [a.group];
const rosterCache = new Map();
const rosterFor = g => {
  if (!rosterCache.has(g)) rosterCache.set(g, ARTISTS.filter(a => ag(a).some(x => x.ko === g)).map(a => {
    const e = ag(a).find(x => x.ko === g) || {};
    return { ko: a.name.ko, en: a.name.en, left: (e.left !== undefined ? e.left : a.left), aliases: a.matchAliases };
  }));
  return rosterCache.get(g);
};
const findArtist = (ko, g) => ARTISTS.find(a => a.name.ko === ko && (ag(a).some(x => x.ko === g) || a.name.ko === g));
const has = (res, name) => JSON.stringify(res || {}).includes(`"${name}"`);
const syl = w => { // 로마자 음절 수(0=안 쪼개짐) — admin.js _atmKoSylCount와 같은 규칙
  const s = String(w || '').toLowerCase(); if (!/^[a-z]+$/.test(s)) return 0;
  const re = /^(?:kk|tt|pp|ss|jj|ch|sh|g|k|n|d|t|r|l|m|b|p|s|j|h|y|w)?(?:yae|yeo|wae|ae|ya|eo|ye|wa|oe|yo|wo|we|wi|yu|eu|ui|oo|ee|a|e|o|u|i)(?:ng|n|k|l|m|p|t)?/;
  const best = new Array(s.length + 1).fill(Infinity); best[0] = 0;
  for (let i = 0; i < s.length; i++) { if (best[i] === Infinity) continue; for (let j = i + 1; j <= Math.min(s.length, i + 7); j++) { const m = s.slice(i, j).match(re); if (m && m[0].length === j - i) best[j] = Math.min(best[j], best[i] + 1); } }
  return best[s.length] === Infinity ? 0 : best[s.length];
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function tagPatrol({ days = +arg('--days', 30), top = +arg('--top', 12) } = {}) {
  const day = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const rows = [];
  for (let d = days; d > 0; d -= 3) {
    const from = day(d), to = day(Math.max(d - 3, -1));
    for (let off = 0; ; off += 1000) {
      const q = `select=id,title,description,group_ko,members,with_members,source_tier,tags_manual,content_flag`
        + `&published_at=gte.${from}&published_at=lt.${to}&order=id&offset=${off}&limit=1000`;
      const got = await (await fetch(`${U}?${q}`, { headers: H })).json();
      if (!Array.isArray(got)) throw new Error('조회 실패: ' + JSON.stringify(got).slice(0, 200));
      rows.push(...got.filter(v => (v.members || []).length || (v.with_members || []).length));
      if (got.length < 1000) break;
    }
  }
  const A = new Map(), B = new Map(); // key "이름(그룹)" → {n,bad,samples}
  const bump = (mp, key, sample, isBad) => {
    if (!mp.has(key)) mp.set(key, { key, n: 0, bad: 0, samples: [] });
    const s = mp.get(key); s.n++; if (isBad) { s.bad++; if (s.samples.length < 4) s.samples.push(sample); }
  };
  let scanned = 0;
  for (const v of rows) {
    if (v.tags_manual || v.content_flag || OWNER_TIERS.has(v.source_tier)) continue;
    scanned++;
    const text = `${v.title}\n${v.description || ''}`;
    const tu = text.toUpperCase();
    const own = GROUPS[v.group_ko] ? M2._atmResolveMembers(v.title, v.description || '', rosterFor(v.group_ko), v.group_ko) : [];
    const ext = _m2ParseTitle(v.title, undefined, false);
    const tags = [...(v.members || []).map(m => ({ m, g: v.group_ko })),
      ...(v.with_members || []).map(w => { const x = w.match(/^(.+)\((.+)\)$/); return x ? { m: x[1], g: x[2] } : null; }).filter(Boolean)];
    for (const { m, g } of tags) {
      const key = `${m}(${g})`;
      const sample = `${v.id} ${v.title.slice(0, 70)}`;
      const supported = own.includes(m) || has(ext, m);
      bump(A, key, sample, !supported);
      if (!supported) continue;
      // B: 근거 세기 — 한글 이름 단독·해시태그·그룹명 중 하나라도 있으면 강함
      const a = findArtist(m, g);
      const G = GROUPS[g];
      const strong = new RegExp(`(?<![가-힣])${esc(m)}`).test(text)
        || (a && a.name.en && new RegExp(`#${esc(a.name.en.replace(/\s+/g, ''))}\\b`, 'i').test(text))
        || (G && [g, G.en].filter(x => x && x.length >= 2).some(x => tu.includes(x.toUpperCase())))
        || (a && (a.matchAliases || []).some(al => al && text.includes(al)))
        || unitNamesOf(m, g).some(u => u && tu.includes(String(u).toUpperCase()));
      const en = a && a.name.en && /^[A-Za-z]+$/.test(a.name.en) ? a.name.en : null;
      const weakTok = en && (en.length <= 4 || syl(en) === 1);
      bump(B, key, sample, !strong && !!weakTok);
    }
  }
  const rank = (mp, minBad) => [...mp.values()].filter(s => s.bad >= minBad).map(s => ({ ...s, ratio: s.bad / s.n }))
    .sort((x, y) => y.bad - x.bad).slice(0, top);
  return { days, scanned, since: day(days), A: rank(A, 3), B: rank(B, 5) };
}

export function patrolMarkdown(res) {
  const tbl = list => ['| 멤버(그룹) | 의심 / 전체 | 표본 |', '|---|---|---|',
    ...list.map(s => `| ${s.key} | **${s.bad}**/${s.n} | ${s.samples.slice(0, 2).map(x => x.replace(/\|/g, '/')).join('<br>')} |`)].join('\n');
  return [`최근 ${res.since} 이후 태그 달린 영상 ${res.scanned.toLocaleString()}건 순찰 (주인 채널·수동편집·숨김 제외)`, '',
    '**A. 재판정 불일치** — 현재 매처로 다시 돌리면 안 잡히는 태그(코드는 고쳤는데 데이터에 남은 것)', '',
    res.A.length ? tbl(res.A) : '없음 ✅', '',
    '**B. 약한 근거** — 짧은 영문 토큰 하나만 근거(한글 이름·해시태그·그룹명 없음). 새 오태깅 유형 후보', '',
    res.B.length ? tbl(res.B) : '없음 ✅', '',
    '확인·수정 절차는 TAGGING.md "오태깅 추적표". 결과는 의심이므로 표본을 먼저 볼 것.'].join('\n');
}

if (/tag_patrol\.mjs$/.test(process.argv[1] || '')) {
  const res = await tagPatrol();
  if (process.argv.includes('--md')) console.log(patrolMarkdown(res));
  else {
    console.log(`순찰 ${res.scanned}건 (since ${res.since})`);
    for (const [name, list] of [['A 재판정 불일치', res.A], ['B 약한 근거', res.B]]) {
      console.log(`\n== ${name}`);
      for (const s of list) { console.log(`${String(s.bad).padStart(4)}/${String(s.n).padEnd(5)} ${s.key}`); s.samples.slice(0, 3).forEach(x => console.log('         ' + x)); }
    }
  }
  const out = arg('--json'); if (out) fs.writeFileSync(out, JSON.stringify(res, null, 1));
}
