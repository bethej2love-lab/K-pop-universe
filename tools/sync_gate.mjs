// 동기화 실행 게이트 — "이번 cron 발화에서 실제로 동기화를 돌릴지" 결정한다 (2026-09-15)
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────────────
// sync-hourly.yml은 `cron: '30 * * * *'`로 **매시간**을 의도했는데, 실측(2026-09-14 06:50Z~23:20Z,
// 약 17시간) 실제 실행은 **4번**뿐이었다(06:50Z / 14:20Z 실패 / 19:32Z / 23:20Z). GitHub Actions의
// schedule 이벤트는 고부하 시 지연되거나 **통째로 드랍**된다 — 우리 쪽에서 고칠 수 없는 부분이다.
//
// 그래서 발상을 뒤집는다: **cron은 자주 쏘고(15분 간격 4회/시간), 실제 실행 여부는 이 게이트가 결정**.
// 4번 중 하나만 살아남아도 그 시간대의 동기화는 보장된다. 드랍 확률이 p라면 한 시간 통째로 놓칠
// 확률이 p에서 p⁴로 떨어진다.
//
// ── 쿼터가 상한이라 "무조건 자주"는 안 된다 ──────────────────────────────────
// 동기화 1회 ≈ 350 units(공식 채널 playlistItems ~222 + 외부 채널 ~60 + 조회수 갱신 ~70).
// YouTube Data API 하루 한도는 10,000. daily-routine(3시간마다 full) 8회 = 2,800을 빼면
// 동기화에 쓸 수 있는 건 **하루 20회 남짓**이다. 그러니 "몇 분마다"가 아니라 "최소 간격"으로 묶는다.
//
// ── 간격을 시간대별로 다르게 주는 근거(실측) ────────────────────────────────
// 최근 14일 3,928건의 업로드 시각(KST) 분포:
//   17시 447 · 18시 592 · 19시 462 · 20시 425 · 21시 361 · 22시 333   → 17~22시가 전체의 66%
//   00시  87 · 10~16시 합계 970                                        → 낮은 완만
//   03시   8 ·  04시 3 · 05시 0 · 06시 1 · 07시 7                       → 새벽 02~09시는 전체의 0.9%
// 쿼터 비용은 새 영상이 있든 없든 **폴링당 동일**하다(채널 수만큼 playlistItems). 그러니 새벽 폴링은
// 순손실이다. 아낀 쿼터를 저녁 피크에 몰아주면 같은 예산으로 체감 신선도가 올라간다.
//
// 상한 계산(최악의 경우):
//   17~23시(7h) ÷ 45분 ≤ 10 · 00시(1h) ÷ 60분 ≤ 1 · 09~16시(8h) ÷ 90분 ≤ 6 · 01~08시(8h) ÷ 240분 ≤ 2
//   합계 ≤ 19회/일 × 350 = 6,650 units. daily-routine 2,800을 더해도 9,450 < 10,000. ✅
//   (지금은 실측 4회/17시간 ≈ 6회/일이므로, 쿼터를 더 쓰지 않고도 실행 횟수가 3배가 된다.)
//
// ── 2026-09-17 재배분 ────────────────────────────────────────────────────────
// 위 9,450은 **여유가 550밖에 없다**는 뜻이기도 하다. 그래서 수동 버튼("조회수 순환 갱신" 2만개 =
// 400 units)을 누르면 그날 동기화가 한 번만 더 돌아도 quotaExceeded가 났다(사용자 제보: 50개만
// 저장되고 중단). 자동화가 지갑을 다 쓰고 사람 몫이 없던 것.
// 실측으로 낭비를 찾아 재배분했다:
//   · 해체 그룹 채널은 폴링 대상 222개 중 32개(14.4%)인데, 최근 90일 신규 영상 기여는
//     29,379건 중 154건(0.52%)뿐이었다. 폴링 비용은 새 영상 유무와 무관하게 채널당 1 unit이다.
//   · 그래서 해체 채널은 **하루 1회만** 폴링한다(admin.js _ytSyncAll의 last_disbanded_sync 게이트).
//     확보: 32 × 26회 ≈ 832 units/일. 대가는 해체 그룹 새 영상이 최대 하루 늦게 들어오는 것.
//   · 그 예산으로 조회수 순환 갱신을 루틴에서 **하루 1배치(400 units)** 자동 실행한다.
//     47만 건이 24일에 한 바퀴 — 사람이 월 1회 누르던 것보다 촘촘하다.
// 재배분 후: 동기화 (350−32)×19 ≈ 6,042 + 루틴 (350−32)×8 ≈ 2,544 + 해체 1회 32 + 순환 400 ≈ 9,018.
// 여유 ≈ 980 (이전 550). tests/yt-quota-budget.test.js가 이 구조를 고정한다.
//
// ── "마지막 실행 시각"을 어디서 읽나 ────────────────────────────────────────
// 루틴이 끝날 때마다 admin.js의 _admWriteLastRunDB가 atm_exception_rules(type='admin_meta',
// key='last_routine')에 epoch ms를 쓴다. full 루틴도 같은 값을 갱신하므로, daily-routine이 방금
// 돌았으면 이 게이트가 알아서 비켜준다(같은 채널을 두 번 폴링해 쿼터를 낭비하지 않는다).
//
// ⚠️ last_routine만 보면 구멍이 있다 — **루틴이 실패하면 그 값이 안 써진다**. 그러면 게이트가
//    매 발화를 통과시켜 15분마다 동기화를 시도하게 되고, 실패하는 동안 쿼터가 타들어간다. 그래서
//    게이트가 통과시킬 때마다 **자기 표식(last_sync_attempt)을 직접 남긴다**. 성공·실패와 무관하게
//    "시도했다"가 기록되므로 최소 간격이 항상 지켜진다.
//
// 실행: node tools/sync_gate.mjs   → GITHUB_OUTPUT에 run=true|false 를 쓴다.
// env: SUPABASE_SERVICE_ROLE(표식 쓰기용 · 없으면 읽기만 하고 표식은 생략) · FORCE=1(게이트 무시)

import fs from 'node:fs';

const U = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const READ_KEY = WRITE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const TABLE = 'atm_exception_rules';
const FORCE = process.env.FORCE === '1';

// KST 시각(시) → 이번 동기화까지 비워야 할 최소 간격(분). 위 실측 분포 근거.
function minGapMin(kstHour) {
  if (kstHour >= 17 && kstHour <= 23) return 45;  // 저녁 피크 — 전체 업로드의 66%
  if (kstHour === 0) return 60;                   // 자정 직후에도 87건 — 한 시간 간격은 유지
  if (kstHour >= 9 && kstHour <= 16) return 90;   // 낮 — 완만(09시 20 · 10시 48 · … · 16시 265)
  return 240;                                     // 01~08시 새벽 — 14일간 총 29건(0.7%)
}

const H = k => ({ apikey: k, Authorization: `Bearer ${k}` });

async function readMarker(key) {
  const r = await fetch(`${U}/rest/v1/${TABLE}?select=value&type=eq.admin_meta&key=eq.${key}`, { headers: H(READ_KEY) });
  if (!r.ok) throw new Error(`표식 조회 실패 ${r.status}`);
  const rows = await r.json();
  const v = rows[0] && rows[0].value;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function writeMarker(key, ms) {
  if (!WRITE_KEY) return false; // service_role이 없으면 표식을 못 남긴다(RLS) — 게이트는 읽기만으로 동작
  const r = await fetch(`${U}/rest/v1/${TABLE}?on_conflict=type,key`, {
    method: 'POST',
    headers: { ...H(WRITE_KEY), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ type: 'admin_meta', key, value: ms }),
  });
  if (!r.ok) { console.warn(`  ⚠️ 표식 쓰기 실패 ${r.status}: ${(await r.text()).slice(0, 200)}`); return false; }
  return true;
}

// ── daily-routine이 지금 돌고 있는가 (2026-09-16) ────────────────────────────
// 예전엔 두 워크플로가 **같은 concurrency 그룹**을 써서 겹침을 막았다. 그런데 그 방식은 루틴이
// 길어질 때(실측 241·262분) 이 워크플로의 cron 발화를 **런 자체가 안 만들어진 채** 삼켜버렸다
// (48시간에 192발 의도 → 실제 런 11개). 그래서 그룹을 분리하고, 겹침은 여기서 막는다.
// 둘은 같은 크롬 프로필(체크포인트 kpu_yt_last_*)을 공유하므로 동시에 돌면 서로의 진행을 덮어쓴다.
// ⚠️ last_routine 표식으로는 이 판정을 할 수 없다 — 그 값은 루틴이 **끝날 때** 써지므로, 4시간짜리
//    루틴이 도는 내내 "오래전에 끝남"으로 보인다. 그래서 실행 상태를 직접 조회한다.
// 토큰이 없거나 조회가 실패하면 **막지 않는다**(fail-open) — 이 확인 때문에 동기화가 멈추면 안 된다.
async function routineRunning() {
  const token = process.env.GH_TOKEN, repo = process.env.GH_REPO;
  if (!token || !repo) return false;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/daily-routine.yml/runs?per_page=5`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return false;
    const j = await r.json();
    return (j.workflow_runs || []).some(x => x.status === 'in_progress' || x.status === 'queued' || x.status === 'waiting');
  } catch (e) { return false; }
}

function emit(run, reason) {
  console.log(`[sync-gate] ${run ? '▶ 실행' : '⏭ 건너뜀'} — ${reason}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\nreason=${reason}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `**동기화 게이트**: ${run ? '▶ 실행' : '⏭ 건너뜀'} — ${reason}\n\n`);
}

const now = Date.now();
const kstHour = new Date(now + 9 * 3600 * 1000).getUTCHours();
const gap = minGapMin(kstHour);

if (FORCE) { emit(true, `FORCE=1 (수동 실행)`); await writeMarker('last_sync_attempt', now); process.exit(0); }

// 루틴이 도는 중이면 비켜준다 — 표식은 남기지 않는다(다음 발화가 곧바로 다시 시도할 수 있게).
if (await routineRunning()) { emit(false, '매일 루틴이 실행 중 — 체크포인트 충돌을 피해 건너뜀'); process.exit(0); }

let last = 0, src = '';
try {
  const [routine, attempt] = await Promise.all([readMarker('last_routine'), readMarker('last_sync_attempt')]);
  last = Math.max(routine, attempt);
  src = routine >= attempt ? '루틴 완료' : '게이트 시도';
} catch (e) {
  // 표식을 못 읽으면 **통과시킨다**(fail-open). 신선도를 잃는 것보다 한 번 더 도는 게 낫고,
  // 아래에서 표식을 새로 남기므로 이 상태가 반복돼도 최소 간격이 곧 복구된다.
  emit(true, `표식 조회 실패(${e.message}) — 안전하게 실행`);
  await writeMarker('last_sync_attempt', now);
  process.exit(0);
}

const elapsedMin = last ? Math.round((now - last) / 60000) : Infinity;
const stamp = `KST ${String(kstHour).padStart(2, '0')}시 · 최소간격 ${gap}분 · 마지막 ${last ? `${elapsedMin}분 전(${src})` : '기록 없음'}`;

if (elapsedMin >= gap) {
  await writeMarker('last_sync_attempt', now); // 성공·실패와 무관하게 "시도했다"를 먼저 못 박는다
  emit(true, stamp);
} else {
  emit(false, `${stamp} — ${gap - elapsedMin}분 더 기다립니다`);
}
