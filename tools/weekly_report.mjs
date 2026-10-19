// tools/weekly_report.mjs
// weekly-report.yml이 매주 월요일 KST 09:00에 호출.
// Supabase에서 지난 7일 통계를 조회해 GitHub Issue로 발행 → GitHub가 이메일 알림 발송.
//
// 필요 환경변수: SUPABASE_SERVICE_ROLE, GH_TOKEN, GH_REPO
// SUPABASE_URL은 선택(기본값 내장).

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SB_URL = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;
const GH_TOKEN = process.env.GH_TOKEN;
const GH_REPO = process.env.GH_REPO;

if (!SB_KEY) { console.error('SUPABASE_SERVICE_ROLE 없음'); process.exit(1); }
if (!GH_TOKEN) { console.error('GH_TOKEN 없음'); process.exit(1); }
if (!GH_REPO) { console.error('GH_REPO 없음'); process.exit(1); }

const sb = createClient(SB_URL, SB_KEY);

function fmt(n) { return n == null ? '?' : n.toLocaleString(); }

// ── 데이터 건강 체크 (groups.json + artists.json 기준, 외부 요청 없음) ────────
function dataHealthMd() {
  try {
    const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
    const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
    const arts = Array.isArray(A) ? A : Object.values(A);
    const gks = Object.keys(G);
    const hasV = v => v && (typeof v === 'string' ? v.trim() : (v.ko || v.en));

    // 멤버 기본정보 갭 (활동 중만)
    let noBday = 0, noNat = 0;
    const activeArts = arts.filter(a => a.active !== false);
    for (const a of activeArts) {
      if (!a.bday) noBday++;
      if (!hasV(a.nat)) noNat++;
    }

    // 그룹 기본정보 갭 (미해산)
    let noFandom = 0, noInsta = 0;
    const activeGroups = gks.filter(k => !G[k].disbanded);
    for (const k of activeGroups) {
      const g = G[k];
      if (!hasV(g.fandom)) noFandom++;
      if (!g.links?.instagram) noInsta++;
    }

    // 신보 누락 의심 (미해산 + 마지막 앨범 14개월+)
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 14);
    const stale = [];
    for (const k of activeGroups) {
      const disco = G[k].discography;
      if (!disco?.length) continue;
      const dates = disco.map(d => d.releaseDate).filter(Boolean).sort().reverse();
      if (!dates[0]) continue;
      const last = new Date(dates[0].replace(/\./g, '-'));
      if (last < cutoff) {
        const mo = Math.round((Date.now() - last) / (30 * 86400000));
        stale.push({ k, mo });
      }
    }
    stale.sort((a, b) => b.mo - a.mo);
    const staleTop = stale.slice(0, 5).map(x => `${x.k}(${x.mo}개월)`).join(' · ');

    // 3인이상 동명이인 (그룹 구분 없이 전체 기준)
    const byKo = {};
    for (const a of arts) { const k = a.name?.ko; if (k) byKo[k] = (byKo[k] || 0) + 1; }
    const tripleNames = Object.values(byKo).filter(c => c >= 3).length;

    // 로스터 이상: 멤버 이름이 자기 그룹 트랙 제목과 정확히 일치
    const rosterBugs = [];
    const trackTitlesOf = {};
    for (const k of gks) {
      const disco = G[k].discography || [];
      const titles = new Set();
      for (const d of disco) for (const t of (d.tracks || [])) if (t.title) titles.add(t.title.trim());
      trackTitlesOf[k] = titles;
    }
    for (const a of arts) {
      if (a.active === false) continue;
      const ko = a.name?.ko || '';
      const grps = a.groups ? a.groups.map(g => g.ko) : [a.group?.ko];
      for (const g of grps) {
        if (g && trackTitlesOf[g]?.has(ko)) rosterBugs.push(`${ko}(${g})`);
      }
    }

    let lines = `| 항목 | 수치 |
|---|---|
| 활동 멤버 생일 없음 | ${noBday}명 |
| 활동 멤버 국적 없음 | ${noNat}명 |
| 미해산 그룹 팬덤명 없음 | ${noFandom}개 |
| 미해산 그룹 인스타 없음 | ${noInsta}개 |
| 신보 14개월+ 의심 | ${stale.length}개 |
| 3인이상 동명이인 | ${tripleNames}건 |`;
    if (stale.length) lines += `\n\n상위: ${staleTop}`;
    if (rosterBugs.length) lines += `\n\n> ⚠️ 로스터 이상(멤버명=트랙명): ${rosterBugs.join(' · ')}`;
    return lines;
  } catch (e) {
    return `_(데이터 건강 체크 실패: ${e.message})_`;
  }
}

async function safeCount(query) {
  try { const { count } = await query; return count; } catch { return null; }
}
async function safeData(query) {
  try { const { data } = await query; return data; } catch { return null; }
}

async function main() {
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400 * 1000);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);
  const nowStr = now.toISOString().slice(0, 10);

  const [newVideos, heldVideos, hiddenVideos, queueCount, milestones, wins, totalVideos] = await Promise.all([
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString())),
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true }).eq('content_flag', '보류')),
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true }).eq('content_flag', 'hidden')),
    safeCount(sb.from('tag_review_queue').select('id', { count: 'exact', head: true }).is('resolved_at', null)),
    safeCount(sb.from('yt_view_milestones').select('id', { count: 'exact', head: true }).gte('crossed_at', weekAgoStr).eq('seeded', false)),
    safeCount(sb.from('music_show_wins').select('id', { count: 'exact', head: true }).gte('win_date', weekAgoStr)),
    safeCount(sb.from('yt_channel_videos').select('id', { count: 'exact', head: true })),
  ]);

  const routineMeta = await safeData(sb.from('atm_exception_rules').select('value').eq('type', 'admin_meta').eq('key', 'last_routine').maybeSingle());
  const cleanupMeta = await safeData(sb.from('atm_exception_rules').select('value').eq('type', 'admin_meta').eq('key', 'last_cleanup').maybeSingle());

  function ageStr(meta) {
    if (!meta?.value) return '기록 없음';
    const v = meta.value;
    const d = Number(v) > 0 ? new Date(Number(v)) : new Date(v);
    if (isNaN(d.getTime())) return '기록 없음';
    const diffH = Math.round((now - d) / 3600000);
    return diffH < 24 ? `${diffH}시간 전` : `${Math.round(diffH / 24)}일 전`;
  }

  // 오태깅 의심 순위(2026-09-28) — 사용자가 카드에서 발견하기 전에 먼저 보이게. 실패해도 보고는 나간다.
  let mistagMd = '';
  try {
    const { mistagRank, mistagMarkdown } = await import('./mistag_rank.mjs');
    mistagMd = mistagMarkdown(await mistagRank({ days: 90, min: 8, top: 10 }));
  } catch (e) { mistagMd = `_(집계 실패: ${e.message})_`; }
  // 태그 순찰(2026-09-29) — 재판정 불일치(고친 코드 기준 옛 오태깅)·약한 근거(새 유형 후보). 실패해도 보고는 나간다.
  let patrolMd = '';
  try {
    const { tagPatrol, patrolMarkdown } = await import('./tag_patrol.mjs');
    patrolMd = patrolMarkdown(await tagPatrol({ days: 30, top: 10 }));
  } catch (e) { patrolMd = `_(순찰 실패: ${e.message})_`; }

  const healthMd = dataHealthMd();

  const queueWarn = queueCount > 50 ? ` ⚠️ 50건 초과` : '';
  const heldWarn = heldVideos > 200 ? ` ⚠️` : '';

  const body = `## 주간 현황 (${weekAgoStr} ~ ${nowStr})

### 이번 주 활동
| 항목 | 수치 |
|---|---|
| 신규 영상 유입 | ${fmt(newVideos)}건 |
| 조회수 마일스톤 돌파 | ${fmt(milestones)}건 |
| 음방 1위 | ${fmt(wins)}건 |

### 현재 상태
| 항목 | 수치 |
|---|---|
| 전체 영상 | ${fmt(totalVideos)}건 |
| 보류 영상 누적 | ${fmt(heldVideos)}건${heldWarn} |
| 숨김 영상 누적 | ${fmt(hiddenVideos)}건 |
| 검수 큐 대기 | ${fmt(queueCount)}건${queueWarn} |

### 🏷️ 오태깅 의심 TOP 10
${mistagMd}

### 🔎 태그 순찰
${patrolMd}

### 📋 데이터 건강
${healthMd}

### 자동화 상태
- **마지막 일일 루틴**: ${ageStr(routineMeta)}
- **마지막 데이터 청소**: ${ageStr(cleanupMeta)}

${queueCount > 50 ? '> ⚠️ 검수 큐가 50건을 넘었습니다. 어드민에서 확인이 필요합니다.\n' : ''}\
> 자동 발행 — weekly-report.yml · ${now.toISOString()}
`;

  const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));
  const title = `📊 주간 현황 ${nowStr.slice(0, 7)} W${weekNum}`;

  const res = await fetch(`https://api.github.com/repos/${GH_REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${GH_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Issue 생성 실패:', res.status, err);
    process.exit(1);
  }

  const issue = await res.json();
  console.log(`✅ 주간 보고 발행: #${issue.number} ${issue.html_url}`);
}

main().catch(e => { console.error(e); process.exit(1); });
