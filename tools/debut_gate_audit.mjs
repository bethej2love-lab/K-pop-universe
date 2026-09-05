// 데뷔 이전 게이트 감사 — "그룹 데뷔보다 3년+ 이전에 올라온 영상"이 그 그룹에 붙어 있는 걸 실측한다.
// (2026-09-05 신설, 읽기 전용 — 아무것도 안 고친다. LEARNING_LOOP.md P0의 안전한 첫 단계.)
//
// 왜: 데뷔 게이트의 진짜 가치는 "옛날 영상 거르기"가 아니라 **부분문자열·동명이인 오배정 탐지**다
// (LEARNING_LOOP §2③: `아이들`(2018) ⊂ `제국의 아이들`, `B.I` ⊂ `B.I.G` 같은 충돌). 어떤 그룹에
// 그 그룹이 존재하기도 전(데뷔−3년)에 올라온 영상이 붙어 있으면 그 그룹일 수 없으므로 오태깅 의심이다.
// 이 스크립트는 그걸 그룹별로 세고 표본 제목을 보여줘, 어드민의 "동명이인 오배정" 정정 대상 후보를 준다.
//
// ⚠️ 매처를 바꾸지 않는다. 데이터도 안 고친다. 정정은 어드민 세션 버튼(사람 승인)에서 한다.
// 실행: NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/debut_gate_audit.mjs [여유년수(기본3)]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const U = 'https://dukgguehegnembimqvkm.supabase.co';
const K = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 공개 anon 키(index.html과 동일)
const H = { apikey: K, Authorization: `Bearer ${K}` };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));

const SLACK = parseInt(process.argv[2] || '3', 10); // 데뷔 − N년. 계획 권장값 3.
const YT_MIN_YEAR = 2005; // 유튜브 시작연도 — 컷오프가 이보다 앞이면 대상 영상이 없어 스킵.

// 그룹당 "데뷔−SLACK년 1월 1일 이전" 영상 수를 센다(count=exact, 본문 0바이트).
async function countBefore(ko, cutoff) {
  const qs = new URLSearchParams();
  qs.set('select', 'id');
  qs.set('group_ko', `eq.${ko}`);
  qs.set('published_at', `lt.${cutoff}`);
  const res = await fetch(`${U}/rest/v1/yt_channel_videos?${qs}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  });
  const cr = res.headers.get('content-range') || '*/0';
  return parseInt(cr.split('/')[1] || '0', 10) || 0;
}
// 상위 그룹 표본 제목 몇 개(연도·source_tier 함께 — 자체채널이면 정당한 예전영상일 수 있어 구분용).
async function samples(ko, cutoff, n = 4) {
  const qs = new URLSearchParams();
  qs.set('select', 'title,published_at,source_tier');
  qs.set('group_ko', `eq.${ko}`);
  qs.set('published_at', `lt.${cutoff}`);
  qs.set('order', 'published_at.asc');
  qs.set('limit', String(n));
  const res = await fetch(`${U}/rest/v1/yt_channel_videos?${qs}`, { headers: H });
  if (!res.ok) return [];
  return await res.json();
}

// groups.json debut → 연도. "YYYY.MM.DD" 또는 "YYYY".
function debutYear(info) {
  const d = info && info.debut;
  if (!d) return null;
  const y = parseInt(String(d).split(/[.\-/]/)[0], 10);
  return Number.isFinite(y) ? y : null;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

(async () => {
  const targets = Object.entries(G)
    .map(([ko, info]) => ({ ko, year: debutYear(info) }))
    .filter(t => t.year && (t.year - SLACK) > YT_MIN_YEAR); // 컷오프가 유튜브 시작 이후여야 대상 영상이 존재
  console.log(`데뷔 이전 게이트 감사 (데뷔 − ${SLACK}년, 읽기 전용)`);
  console.log(`대상 그룹 ${targets.length}개 / 전체 ${Object.keys(G).length}개 — 컷오프가 ${YT_MIN_YEAR + 1}년 이후인 그룹만\n`);

  const rows = await mapLimit(targets, 8, async t => {
    const cutoff = `${t.year - SLACK}-01-01`;
    const n = await countBefore(t.ko, cutoff).catch(() => 0);
    return { ...t, cutoff, n };
  });

  const hits = rows.filter(r => r.n > 0).sort((a, b) => b.n - a.n);
  const total = hits.reduce((s, r) => s + r.n, 0);
  console.log(`⚠️  데뷔 ${SLACK}년+ 이전 영상이 붙은 그룹: ${hits.length}개 / 의심 영상 합계 ${total}건\n`);

  const TOP = 25;
  console.log(`── 오배정 의심 상위 ${Math.min(TOP, hits.length)}개 (그룹 | 건수 | 데뷔 | 표본) ──`);
  for (const r of hits.slice(0, TOP)) {
    const info = G[r.ko] || {};
    const sm = await samples(r.ko, r.cutoff).catch(() => []);
    console.log(`\n${r.n.toString().padStart(4)}건  ${r.ko} (데뷔 ${info.debut})`);
    for (const s of sm) {
      const yr = String(s.published_at || '').slice(0, 4);
      const tier = s.source_tier ? `[${s.source_tier}]` : '';
      console.log(`        ${yr} ${tier} ${String(s.title || '').slice(0, 72)}`);
    }
  }
  console.log(`\n※ 자체채널([idol]/[fans]) 표본은 그룹이 나중에 올린 정당한 예전영상일 수 있음 — 정정 대상은 official/무표기 위주.`);
  console.log(`※ 정정은 어드민의 "동명이인 그룹 오배정" 스캔 버튼에서(사람 승인). 이 스크립트는 쓰기 안 함.`);
})();
