#!/usr/bin/env node
// StagePick(stagepick.co.kr) 공연 캘린더 → kpop_events (2026-10-09 신설)
//
// 왜 StagePick인가:
//   KOPIS는 정부 등록 공연만 커버하여 뉴진스·엔시티 등 주요 그룹이 0건.
//   NOL(robots.txt: Disallow: /), 멜론티켓(JS 렌더링)은 직접 스크레이핑 불가.
//   StagePick은 멜론티켓·인터파크/NOL 포함 케이팝 공연을 전부 집계하는 서드파티 캘린더.
//   robots.txt가 일반 봇 허용(AI 봇만 차단). 캘린더 HTML에 data-cal-perfs JSON이 내장돼 있어
//   Playwright 없이 단순 HTTP fetch로 파싱 가능.
//
// 사용법:
//   node tools/stagepick_concerts.mjs [--months=4] [--from=2026-10]
//     → 기본: 오늘 월 기준 4개월치 SQL을 stdout에 출력 (수동 확인 후 관리자 SQL로 적재)
//
//   SUPABASE_SERVICE_ROLE=<key> node tools/stagepick_concerts.mjs --direct
//     → Supabase에 직접 upsert (GitHub Actions 전용)
//
// 매칭 로직: kopis_events.mjs의 matchEvent()를 공유 — 그룹명·별칭·멤버 이름·KPOP_SIGNAL 방어 동일.
// on conflict (id) do nothing — 이미 있는 행은 건드리지 않는다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchEvent } from './kopis_events.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map(s => {
  const m = s.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [s, true];
}));

const DIRECT = !!args.direct;
const SB_URL = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;

if (DIRECT && !SB_KEY) {
  console.error('[stagepick] --direct 모드는 SUPABASE_SERVICE_ROLE 환경변수가 필요합니다.');
  process.exit(1);
}

const MONTHS = parseInt(args.months || '4', 10);
const now = new Date();
const fromYear = args.from ? parseInt(args.from.split('-')[0]) : now.getFullYear();
const fromMonth = args.from ? parseInt(args.from.split('-')[1]) : now.getMonth() + 1;

const unent = s => String(s || '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');

// "2026년 10월 23일 (27개)" → "2026-10-23"
function parseKoDate(title) {
  const m = title.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

// "DAY6 FANMEETING - 인천" → "인천"
function extractCity(title) {
  const m = title.match(/[-–—]\s*([가-힣]{2,5})\s*$/);
  return m ? m[1] : null;
}

async function fetchCalendar(year, month) {
  const url = `https://www.stagepick.co.kr/performances/calendar?year=${year}&month=${String(month).padStart(2, '0')}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' },
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

function parseCalendar(html) {
  const events = new Map(); // ID → { id, title, category, venue, href, dates: Set }
  const re = /data-cal-title="([^"]+)"\s+data-cal-perfs="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const date = parseKoDate(unent(m[1]));
    if (!date) continue;
    let perfs;
    try { perfs = JSON.parse(unent(m[2])); } catch { continue; }
    for (const p of perfs) {
      if (!events.has(p.ID)) {
        events.set(p.ID, { id: p.ID, title: p.Title, category: p.Category, venue: p.Venue, href: p.Href, dates: new Set() });
      }
      events.get(p.ID).dates.add(date);
    }
  }
  return events;
}

// ── 데이터 수집 ────────────────────────────────────────────────────────────────
const allEvents = new Map();

for (let i = 0; i < MONTHS; i++) {
  let y = fromYear, mo = fromMonth + i;
  while (mo > 12) { mo -= 12; y++; }
  process.stderr.write(`[stagepick] ${y}-${String(mo).padStart(2, '0')} 수집 중...\n`);
  try {
    const html = await fetchCalendar(y, mo);
    const evs = parseCalendar(html);
    for (const [id, ev] of evs) {
      if (!allEvents.has(id)) allEvents.set(id, ev);
      else for (const d of ev.dates) allEvents.get(id).dates.add(d);
    }
    process.stderr.write(`  → ${evs.size}건\n`);
  } catch (e) {
    process.stderr.write(`  ⚠️ 실패: ${e.message}\n`);
  }
}

process.stderr.write(`[stagepick] 총 ${allEvents.size}건 수집 완료, 매칭 중...\n`);

// ── 매칭 ──────────────────────────────────────────────────────────────────────
const rows = [];
const unmatchedList = [];

for (const ev of allEvents.values()) {
  // 내한공연은 외국 아티스트가 국내에 오는 공연 — K팝 그룹과 무관
  if (ev.category === '내한공연') continue;

  const result = matchEvent(ev.title);
  if (!result.groups.length) {
    unmatchedList.push({ title: ev.title, why: result.why.join(', ') });
    continue;
  }

  const dates = [...ev.dates].sort();
  rows.push({
    id: `sp_${ev.id}`,
    title: ev.title,
    groups: result.groups,
    date_start: dates[0],
    date_end: dates[dates.length - 1],
    venue: ev.venue || null,
    city: extractCity(ev.title),
    official_url: `https://www.stagepick.co.kr${ev.href}`,
  });
}

process.stderr.write(`[stagepick] 매칭: ${rows.length}건 / 미매칭: ${unmatchedList.length}건\n`);

// 미매칭 목록은 파일로 (매칭기 점검용)
if (!DIRECT) {
  const unmatchedPath = path.join(ROOT, 'tools', 'stagepick_unmatched.txt');
  fs.writeFileSync(unmatchedPath, unmatchedList.map(u => `${u.title}\t${u.why}`).join('\n') + '\n', 'utf8');
  process.stderr.write(`[stagepick] 미매칭 목록: tools/stagepick_unmatched.txt\n`);
}

// ── 출력 ──────────────────────────────────────────────────────────────────────
if (DIRECT) {
  // Supabase REST API로 직접 upsert
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const resp = await fetch(`${SB_URL}/rest/v1/kpop_events`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });
    if (!resp.ok) {
      const err = await resp.text();
      process.stderr.write(`⚠️ upsert 실패 [${i}~${i + chunk.length}]: ${resp.status} ${err.slice(0, 200)}\n`);
    } else {
      inserted += chunk.length;
    }
  }
  process.stderr.write(`[stagepick] Supabase upsert 완료: ${inserted}건\n`);
} else {
  // SQL 출력 (수동 적재용)
  const sq = s => s == null ? 'null' : "'" + String(s).replace(/'/g, "''") + "'";
  console.log(`-- StagePick 공연목록 → kpop_events`);
  console.log(`-- 생성: ${new Date().toISOString()}, 매칭 ${rows.length}건`);
  console.log();
  for (const r of rows) {
    console.log(
      `insert into kpop_events (id,title,groups,date_start,date_end,venue,city,official_url) values (` +
      `${sq(r.id)},${sq(r.title)},array[${r.groups.map(sq).join(',')}],` +
      `${sq(r.date_start)},${sq(r.date_end)},${sq(r.venue)},${sq(r.city)},${sq(r.official_url)}) on conflict (id) do nothing;`
    );
  }
  process.stderr.write(`[stagepick] SQL 생성 완료 — stdout에 ${rows.length}행 출력됨\n`);
}
