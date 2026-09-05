// 그룹 카드 첫 화면 오태깅 감사 (2026-09-05 신설, 읽기 전용 — 아무것도 안 고침)
//
// 전략 리포트 §9 "공유 가능 수준 게이트 ①: 상위 100그룹 첫 화면 오태깅 ≤2%"의 자동 프록시.
// 사람이 600건을 눈으로 보는 대신, **제목에 그 그룹 태그를 정당화할 근거가 있는지**를 객관 규칙으로 본다
// (name_pollution_probe.mjs의 근거 판정과 같은 계열). 근거 = 제목에 ①그룹명/영문/altNames ②소속 멤버
// 이름(한/영) 중 하나가 있거나, ③자체채널(source_tier official/idol — group_ko가 고정이라 신뢰).
// 셋 다 없으면 = 이름만으로 역추론됐을 오태깅 "의심". 확정이 아니라 사람이 볼 우선순위를 준다.
//
// "첫 화면"은 카드 기본 정렬(recommend)을 정확히 재현하기 어려워 **조회수 상위**를 프록시로 쓴다
// (제일 많이 보이는 = 틀렸을 때 타격 큰 것부터). 정렬을 바꾸려면 SORT 상수만 고치면 된다.
//
// 실행: NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/group_firstscreen_audit.mjs [상위그룹수=100] [그룹당표본=12]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const U = 'https://dukgguehegnembimqvkm.supabase.co';
const K = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const H = { apikey: K, Authorization: `Bearer ${K}` };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

const TOP_N = parseInt(process.argv[2] || '100', 10);
const PER = parseInt(process.argv[3] || '12', 10);
const SORT = 'view_count.desc';

const normEn = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
// 그룹별 근거 토큰 미리 준비 — 한글(그룹명·altNames·멤버 한글명)과 영문(normEn: 그룹en·멤버en)을 나눠 담는다.
const rosterByGroup = new Map();
A.forEach(a => {
  const gset = new Set();
  if (a.group && a.group.ko) gset.add(a.group.ko);
  (a.groups || []).forEach(g => { if (g && g.ko) gset.add(g.ko); });
  gset.forEach(gko => {
    if (!rosterByGroup.has(gko)) rosterByGroup.set(gko, []);
    rosterByGroup.get(gko).push(a);
  });
});
function basisTokens(gko) {
  const info = G[gko] || {};
  const ko = [gko, ...(info.altNames || [])].filter(Boolean);
  const en = [info.en, ...(info.altNames || [])].filter(Boolean).map(normEn).filter(x => x.length >= 2);
  (rosterByGroup.get(gko) || []).forEach(m => {
    if (m.name?.ko) ko.push(m.name.ko);
    if (m.displayName) ko.push(m.displayName);
    if (m.name?.en) { const e = normEn(m.name.en); if (e.length >= 2) en.push(e); }
  });
  return { ko: [...new Set(ko)], en: [...new Set(en)] };
}
function justified(title, tier, toks) {
  if (tier === 'official' || tier === 'idol' || tier === 'fans') return true; // 자체채널 = group_ko 고정, 신뢰
  const t = (title || '').toLowerCase();
  if (toks.ko.some(x => x && t.includes(x.toLowerCase()))) return true;
  const te = normEn(title);
  if (toks.en.some(x => te.includes(x))) return true;
  return false;
}

async function topVideos(gko) {
  const qs = new URLSearchParams();
  qs.set('select', 'title,source_tier,view_count,published_at');
  qs.set('group_ko', `eq.${gko}`);
  qs.set('order', SORT);
  qs.set('limit', String(PER));
  const r = await fetch(`${U}/rest/v1/yt_channel_videos?${qs}`, { headers: H });
  if (!r.ok) return [];
  return r.json();
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

(async () => {
  const groups = Object.entries(G).map(([ko, info]) => ({ ko, pri: info.pri || 0 }))
    .sort((a, b) => b.pri - a.pri).slice(0, TOP_N);
  console.log(`그룹 카드 첫 화면 오태깅 감사 (상위 ${groups.length}그룹 · 그룹당 조회수상위 ${PER}편 · 읽기 전용)\n`);

  const dYear = gko => { const d = G[gko]?.debut; const y = d && parseInt(String(d).split(/[.\-/]/)[0], 10); return Number.isFinite(y) ? y : null; };
  const rows = await mapLimit(groups, 8, async g => {
    const vids = await topVideos(g.ko).catch(() => []);
    const toks = basisTokens(g.ko);
    const dy = dYear(g.ko);
    const suspects = vids.filter(v => !justified(v.title, v.source_tier, toks)).map(v => {
      const vy = parseInt(String(v.published_at || '').slice(0, 4), 10);
      // 고신뢰: 근거도 없고 + 그룹 데뷔보다 3년+ 이전(존재 전) → 명백한 오배정(데뷔게이트와 교차)
      const hi = !!(dy && vy && vy < dy - 3);
      return { ...v, hi };
    });
    return { ko: g.ko, n: vids.length, suspects };
  });

  let totV = 0, totS = 0, totHi = 0;
  rows.forEach(r => { totV += r.n; totS += r.suspects.length; totHi += r.suspects.filter(s => s.hi).length; });
  const rate = totV ? (100 * totS / totV).toFixed(1) : '0';
  const rateHi = totV ? (100 * totHi / totV).toFixed(1) : '0';
  console.log(`전체: 표본 ${totV}편 중 근거없음(의심) ${totS}편 = ${rate}%  (게이트 기준 ≤2%)`);
  console.log(`  └ 그중 ⚠️고신뢰(근거없음+데뷔 3년+ 이전=존재 전 오배정) ${totHi}편 = ${rateHi}% — 오탐 거의 없는 층\n`);

  // 고신뢰 있는 그룹 먼저, 그다음 의심 많은 순
  const flagged = rows.filter(r => r.suspects.length)
    .sort((a, b) => (b.suspects.filter(s => s.hi).length - a.suspects.filter(s => s.hi).length) || (b.suspects.length - a.suspects.length));
  console.log(`── 의심 그룹 상위 ${Math.min(20, flagged.length)}개 (⚠️=고신뢰 오배정) ──`);
  for (const r of flagged.slice(0, 20)) {
    const hiN = r.suspects.filter(s => s.hi).length;
    console.log(`\n${String(r.suspects.length).padStart(2)}/${r.n}${hiN ? ` ⚠️${hiN}` : ''}  ${r.ko} (데뷔 ${G[r.ko]?.debut || '?'})`);
    for (const s of r.suspects.slice(0, 4)) {
      const yr = String(s.published_at || '').slice(0, 4);
      console.log(`      ${s.hi ? '⚠️' : '  '}${yr} ${String(s.title || '').slice(0, 72)}`);
    }
  }
  console.log(`\n※ "의심"=제목에 그룹명·멤버명 근거 없고 자체채널도 아님(이름 역추론 태깅 가능성). 오탐 있음(프리데뷔쇼·영문 스테이지명·자체채널 무표기).`);
  console.log(`※ ⚠️고신뢰는 데뷔게이트까지 겹친 것 — 그룹이 존재하기도 전 영상이라 거의 확실한 오배정. 여기부터 정정하면 효율적.`);
  console.log(`※ 정정은 어드민 "동명이인 오배정"·"자체 멤버 재검증" 버튼에서(사람 승인).`);
})();
