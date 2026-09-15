// 디스코그래피 신선도 감시 (2026-09-15)
//
// "앨범 수집이 멈췄다"를 **아무도 안 보고 있어도** 알아채게 하는 장치다.
// 발견 계기: 2026-09-15에 groups.json의 최신 발매일이 2026.09.02였다 — 13일이 비어 있었고, 9월
// 수집분은 2장뿐이었다(평소 월 ~60장). 알려주는 게 아무것도 없어서 사용자가 눈으로 눈치챘다.
//
// 이 스크립트는 두 가지를 본다.
//  ① 절대 신선도 — 데이터에서 가장 최근 발매일이 며칠 전인가.
//     임계값 근거(실측 2026-09-15): 2026년 고유 발매일 179개의 연속 간격은 중앙 1일, 90퍼센타일 2일,
//     최대 9일. 즉 6일 넘게 비는 건 179번 중 1번뿐인 이례적 상황이고, 그 1번(9일)조차 수집 누락으로
//     의심된다. → 기본 임계 6일.
//  ② 교차검증 — **유튜브에는 신보 MV가 들어왔는데 앨범 데이터엔 없는** 그룹.
//     스포티파이 동기화가 주 수집이지만 한국 발매가 며칠 늦게 올라오거나 아티스트가 아예 없을 수
//     있다. 유튜브 공식 채널 동기화는 이미 매시간 돌고 있으므로, 그 데이터로 "나왔는데 안 들어온 것"을
//     공짜로 잡는다. 두 소스가 서로의 구멍을 메우는 구조.
//
// 알림 방식: 임계를 넘으면 **exit 1** — GitHub Actions가 빨개지고 기본 설정이면 메일이 온다.
// 새 알림 인프라를 만들지 않는 게 요점이다(안 보는 대시보드를 하나 더 만드는 게 제일 나쁘다).
//
// 실행: node tools/disco_freshness.mjs
// env: STALE_DAYS(기본 6) · MV_WINDOW_DAYS(기본 21) · SUPABASE_ANON_KEY(교차검증용, 없으면 ① 만)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STALE_DAYS = Number(process.env.STALE_DAYS) || 6;
const MV_WINDOW = Number(process.env.MV_WINDOW_DAYS) || 21;
const SB_URL = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';

const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const groups = rd('groups.json');
const artists = rd('artists.json');

// "2026.09.02" → Date. 데이터의 유일한 날짜 표기다(멜론 표기를 그대로 쓴다).
const parseD = s => { const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(String(s || '')); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; };
const days = ms => Math.floor(ms / 86400000);
const now = Date.now();

// ── 모든 앨범을 (그룹/아티스트, 발매일)로 펼친다 ────────────────────────────
const albums = [];               // {owner, date}
const latestBy = new Map();      // owner -> 최신 발매일(Date)
const push = (owner, list) => {
  for (const al of list || []) {
    const d = parseD(al && al.releaseDate);
    if (!d) continue;
    albums.push({ owner, date: d });
    const cur = latestBy.get(owner);
    if (!cur || d > cur) latestBy.set(owner, d);
  }
};
for (const [ko, g] of Object.entries(groups)) push(ko, g.discography);
for (const a of artists) {
  const owner = (a.name && a.name.ko) || null;
  if (!owner) continue;
  push(owner, a.discography);
  for (const u of a.unitDiscography || []) push(owner, u && u.albums);
}

const lines = [];
const say = s => { lines.push(s); console.log(s); };

// ── ① 절대 신선도 ────────────────────────────────────────────────────────────
albums.sort((x, y) => x.date - y.date);
const newest = albums.length ? albums[albums.length - 1].date : null;
const ageDays = newest ? days(now - newest.getTime()) : Infinity;
const cnt = d => albums.filter(a => a.date.getTime() >= now - d * 86400000).length;
const per30 = cnt(30), per90 = cnt(90);

say(`## 디스코그래피 신선도`);
say('');
say(`- 앨범 총 **${albums.length.toLocaleString()}장** · 최신 발매일 **${newest ? newest.toISOString().slice(0, 10) : '없음'}** (${ageDays}일 전)`);
say(`- 최근 30일 수집 **${per30}장** · 최근 90일 **${per90}장** (90일 일평균 ${(per90 / 90).toFixed(1)}장)`);

let bad = false;
if (ageDays > STALE_DAYS) {
  bad = true;
  say('');
  say(`> ⚠️ **최신 앨범이 ${ageDays}일 전입니다** (임계 ${STALE_DAYS}일). 2026년 실측 발매 간격은 중앙 1일·90퍼센타일 2일이라, 이 정도로 비는 건 수집이 멈춘 신호입니다.`);
}

// ── ② 유튜브 교차검증: 신보 MV는 들어왔는데 앨범이 없는 그룹 ──────────────
// 공식 MV만 남긴다. category='mv'에는 리액션·비하인드·커멘터리가 섞여 있어 그대로 쓰면 노이즈가
// 너무 많다(실측 최근 30일 107건 중 상당수). 제목으로 한 번 더 거른다.
const MV_YES = /(official\s+(music\s+video|mv)|\bm\/v\b|뮤직비디오)/i;
const MV_NO = /(reaction|리액션|sketch|스케치|commentary|커멘터리|teaser|티저|preview|behind|비하인드|making|메이킹|shoot|dance\s*practice|안무|연습|challenge|챌린지)/i;

try {
  const since = new Date(now - MV_WINDOW * 86400000).toISOString().slice(0, 10);
  const url = `${SB_URL}/rest/v1/yt_channel_videos?select=title,group_ko,members,published_at&category=eq.mv&published_at=gte.${since}&order=published_at.desc&limit=500`;
  const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`조회 실패 ${r.status}`);
  const vids = (await r.json()).filter(v => MV_YES.test(v.title || '') && !MV_NO.test(v.title || ''));

  // 그룹별로 "가장 최근 공식 MV"를 잡고, 그 무렵(±14일) 발매된 앨범이 데이터에 있는지 본다.
  const byGroup = new Map();
  for (const v of vids) {
    const g = v.group_ko; if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, v); // published_at desc라 첫 번째가 최신
  }
  const missing = [];
  for (const [g, v] of byGroup) {
    const mvDate = parseD(String(v.published_at || '').slice(0, 10).replace(/-/g, '.'));
    if (!mvDate) continue;
    // ⚠️ 그룹 채널에 올라온 MV가 **멤버 솔로 발매**인 경우가 많다(태민 'FLOAT'는 샤이니 채널,
    //    소연 '퇴사할게여'는 아이들 채널). 그 앨범은 그룹이 아니라 멤버 이름 밑에 들어가므로,
    //    그룹 디스코만 보면 전부 "누락"으로 잡힌다 — 처음에 11팀 중 11팀이 걸렸고 그중 4팀이
    //    이 경우였다. 영상에 태깅된 멤버까지 후보에 넣어야 신호가 쓸모 있어진다.
    const owners = new Set([g, ...(Array.isArray(v.members) ? v.members : [])]);
    const near = albums.some(a => owners.has(a.owner) && Math.abs(days(a.date.getTime() - mvDate.getTime())) <= 14);
    if (!near) missing.push({ g, d: v.published_at, t: v.title, last: latestBy.get(g) });
  }
  // ⚠️ 이 목록은 **실패 조건이 아니다**(참고용). 실측(2026-09-15)에서 11팀 중 11팀이 걸렸다 —
  //    정밀도가 사실상 0이라 빨간불로 쓰면 아무도 안 보게 된다. 전제였던 "MV 업로드일 ≈ 앨범
  //    발매일"이 성립하지 않기 때문이다:
  //      · 옛 곡의 홍보 포스트가 새로 올라온다(태민 'FLOAT'는 2023년 앨범인데 2026-08-31 "Out Now")
  //      · 기념일·행사 영상에 '뮤직비디오'가 들어간다(세븐틴 고려대 응원OT)
  //      · 일본 발매는 한국 앨범 데이터에 없다(네이즈 'I LIKE IT')
  //    제대로 된 교차검증은 스포티파이 동기화가 붙은 뒤에 "스포티파이엔 있는데 우리 데이터엔
  //    없는 앨범"으로 하는 게 맞다. 그게 붙을 때까지는 사람이 눈으로 훑는 힌트로만 둔다.
  say('');
  say(`- 최근 ${MV_WINDOW}일 공식 MV **${byGroup.size}팀** 중, 그 무렵 앨범이 데이터에 없는 팀 **${missing.length}팀** (참고용 · 오탐 많음)`);
  if (missing.length) {
    say('');
    say('<details><summary>목록 펼치기</summary>');
    say('');
    say('| 그룹 | MV 업로드 | 데이터상 최신 앨범 | 제목 |');
    say('|---|---|---|---|');
    missing.slice(0, 25).forEach(m => say(`| ${m.g} | ${m.d} | ${m.last ? m.last.toISOString().slice(0, 10) : '없음'} | ${String(m.t).replace(/\|/g, '·').slice(0, 60)} |`));
    if (missing.length > 25) say(`\n… 외 ${missing.length - 25}팀`);
    say('');
    say('</details>');
  }
} catch (e) {
  // 교차검증 실패로 감시 자체가 죽으면 안 된다 — ①만으로도 충분히 쓸모가 있다.
  say('');
  say(`- (유튜브 교차검증 건너뜀 — ${e.message})`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n'); } catch { }
}

// ⚠️ process.exit()가 아니라 exitCode다 — fetch가 남긴 핸들이 정리되기 전에 강제 종료하면
//    Windows에서 libuv assertion(UV_HANDLE_CLOSING)이 뜬다. 코드만 세워두고 자연 종료시킨다.
if (bad) {
  console.error('\n✗ 앨범 수집에 구멍이 있습니다 — 위 내용을 확인하세요.');
  process.exitCode = 1;
} else console.log('\n✓ 앨범 수집 신선도 정상');
