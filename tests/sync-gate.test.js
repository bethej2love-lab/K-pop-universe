// 동기화 게이트 — 쿼터 상한 회귀 테스트 (2026-09-15)
//
// 왜 만들었나: tools/sync_gate.mjs의 시간대별 최소 간격은 **YouTube Data API 하루 한도(10,000)**를
// 넘지 않도록 역산해서 고른 값이다. 나중에 "좀 더 자주 돌리자"며 간격만 줄이면 상한을 조용히 넘고,
// 그 사실은 쿼터가 바닥나 동기화가 통째로 멈추는 날에야 드러난다(그때는 원인도 안 보인다).
// 그래서 간격표에서 하루 최대 실행 횟수를 다시 계산해 예산 안인지 여기서 확인한다.
//
// 실행: node tests/sync-gate.test.js

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'sync_gate.mjs'), 'utf8');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── 간격표를 소스에서 그대로 꺼내 쓴다 ────────────────────────────────────────
const i = src.indexOf('function minGapMin(');
need(i > 0, 'minGapMin 함수를 찾음');
let body = '';
{
  let d = 0, s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) { body = src.slice(i, j + 1); break; } }
  }
}
need(body.length > 0, '함수 파싱됨');
const minGapMin = new Function(`${body}; return minGapMin;`)();

// ── 1) 실측 분포와 간격의 방향이 맞는지 ──────────────────────────────────────
// 최근 14일 3,928건 기준 KST 시간대별 업로드: 저녁 17~23시가 66%, 새벽 02~08시는 0.7%.
// "업로드가 많은 시간대일수록 간격이 짧다"가 이 게이트의 전부다. 뒤집히면 설계가 무너진다.
const peak = [17, 18, 19, 20, 21, 22, 23].map(minGapMin);
const dawn = [2, 3, 4, 5, 6, 7, 8].map(minGapMin);
const day = [10, 12, 14, 16].map(minGapMin);
need(Math.max(...peak) < Math.min(...day), `저녁 피크(${Math.max(...peak)}분)가 낮(${Math.min(...day)}분)보다 촘촘함`);
need(Math.max(...day) < Math.min(...dawn), `낮(${Math.max(...day)}분)이 새벽(${Math.min(...dawn)}분)보다 촘촘함`);

// ── 2) 하루 최대 실행 횟수 → 쿼터 예산 ───────────────────────────────────────
// 한 시간(60분) 안에 최대 몇 번 통과할 수 있는지를 시간대별로 더한다. 실제로는 간격이 시간 경계를
// 걸치므로 이보다 적게 돌지만, **상한**을 보는 게 목적이라 낙관하지 않는다.
let maxRunsPerDay = 0;
for (let h = 0; h < 24; h++) maxRunsPerDay += 60 / minGapMin(h);
maxRunsPerDay = Math.ceil(maxRunsPerDay);

// ⚠️ 이 지갑은 동기화만 쓰는 게 아니다(2026-09-15). 관리자 "6채널 백필" 버튼이 search.list를
//    호출당 **100유닛**으로 태운다. 예전엔 동기화가 91%를 잡고 백필이 90회(9,000유닛)를 잡고 있어
//    둘이 같은 날 돌면 반드시 한쪽이 403(quotaExceeded)으로 죽는 구조였다.
//    그래서 ①매시간 동기화에서 조회수 갱신(~70)을 빼고(전체 루틴이 3시간마다 계속 갱신한다)
//          ②백필 예산을 15회(1,500유닛)로 낮췄다.
//    이 테스트는 그 배분이 유지되는지 본다 — 어느 한쪽을 다시 올리면 여기가 먼저 빨개진다.
const UNITS_PER_SYNC = 280;      // 공식 채널 playlistItems ~222 + 외부 채널 ~60 (조회수 갱신은 제외)
const UNITS_PER_FULL = 350;      // 전체 루틴은 조회수 갱신까지 포함
const DAILY_ROUTINE_RUNS = 8;    // daily-routine.yml: cron '0 */3 * * *'
const BACKFILL_RESERVE = 1500;   // admin.js _ytBackfillPriorityChannels의 TOTAL_BUDGET 15회 × 100유닛
const QUOTA = 10000;             // YouTube Data API 일일 한도
const used = maxRunsPerDay * UNITS_PER_SYNC + DAILY_ROUTINE_RUNS * UNITS_PER_FULL + BACKFILL_RESERVE;

console.log(`   동기화 ${maxRunsPerDay}회×${UNITS_PER_SYNC} + 루틴 ${DAILY_ROUTINE_RUNS}회×${UNITS_PER_FULL} + 백필 예약 ${BACKFILL_RESERVE} = ${used.toLocaleString()} / 한도 ${QUOTA.toLocaleString()}`);
// 한도에 딱 붙이면 안 된다 — 유닛 추정치에 오차가 있고, 재시도·재수집이 있는 날은 더 쓴다.
need(used <= QUOTA * 0.95, `쿼터 예산에 여유가 있음 (${Math.round(used / QUOTA * 100)}% 사용 · 상한 95%)`);

// 배분의 양쪽 끝을 코드에서 직접 확인한다(주석만 맞고 코드가 어긋나는 걸 막는다).
const adm = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const bf = /const TOTAL_BUDGET=(\d+)/.exec(adm);
need(bf && Number(bf[1]) * 100 <= BACKFILL_RESERVE, `백필 예산이 예약분 이내 (${bf ? bf[1] : '?'}회 × 100유닛)`);
need(/if\(!_syncOnly\)steps\.push\(\{name:'1-3\./.test(adm), '매시간 동기화(sync 모드)에선 조회수 갱신을 건너뜀');

// ── 3) 게이트가 자기 시도를 기록하는지 ───────────────────────────────────────
// 루틴이 실패하면 last_routine이 안 써진다. 그때 게이트가 자기 표식을 안 남기면 최소 간격이 풀려
// 15분마다 동기화를 시도하게 되고, 실패하는 동안 쿼터가 타들어간다(sync_gate.mjs 머리 주석의 ⚠️).
need(/writeMarker\('last_sync_attempt'/.test(src), "통과시킬 때 자기 표식(last_sync_attempt)을 남김");
need(src.includes("readMarker('last_routine')") && src.includes("readMarker('last_sync_attempt')"),
  '간격 계산에 루틴 완료 시각과 게이트 시도 시각을 둘 다 본다');

// ── 4) 실행 여부가 워크플로로 전달되는지 ─────────────────────────────────────
const wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'sync-hourly.yml'), 'utf8');
need(/id:\s*gate/.test(wf), '워크플로에 게이트 스텝(id: gate)이 있음');
const guarded = (wf.match(/if:\s*steps\.gate\.outputs\.run == 'true'/g) || []).length;
need(guarded >= 3, `게이트 판정을 따르는 스텝 ${guarded}개(크롬 설치·캐시 복원·동기화 실행)`);
need(/run=\$\{run\}/.test(src) || /run=\$\{/.test(src), '게이트가 GITHUB_OUTPUT에 run= 을 씀');

// ── 5) 매시간이 실제로 매시간이려면 (2026-09-16 실측으로 추가) ───────────────
// 증상: "1시간마다로 해뒀는데 새 영상이 바로 안 올라온다"(사용자 제보). 실측하니 적재 지연 중앙값이
// **4.0시간**이고 1시간 안에 적재되는 건 13%뿐이었다(최근 7일 업로드 997건).
// 원인: sync-hourly가 daily-routine과 **같은 concurrency 그룹**을 썼는데, 루틴이 한 번에 241·262분씩
// 그룹을 쥐는 바람에 이 워크플로의 cron 발화가 **런 자체가 안 만들어진 채** 사라졌다
// (시간당 4발 = 48시간에 192발을 의도했는데 실제 런은 11개). 아래가 그 재발을 막는다.
const droutine = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'daily-routine.yml'), 'utf8');
const grpOf = y => (/concurrency:\s*\r?\n\s*group:\s*(\S+)/.exec(y) || [])[1];
const gname = grpOf(wf), dname = grpOf(droutine);
need(!!gname && !!dname && gname !== dname,
  `동기화와 매일 루틴이 서로 다른 concurrency 그룹 (sync=${gname} · routine=${dname})`);
// 루틴이 자기 주기를 넘겨 돌면 그 자체로 다음 회차를 밀어낸다 — 잡 타임아웃이 주기보다 짧아야 한다.
const cronH = (/cron:\s*'0 \*\/(\d+) \* \* \*'/.exec(droutine) || [])[1];
const dto = Number((/timeout-minutes:\s*(\d+)/.exec(droutine) || [])[1]);
need(!!cronH && !!dto && dto < Number(cronH) * 60,
  `매일 루틴 잡 타임아웃(${dto}분)이 자기 주기(${cronH}시간)보다 짧음`);
const rtm = Number((/ROUTINE_TIMEOUT_MIN:\s*'(\d+)'/.exec(droutine) || [])[1]);
need(!!rtm && rtm < dto, `루틴이 잡 타임아웃보다 먼저 스스로 접음(${rtm}분 < ${dto}분)`);
// 그룹을 분리했으니 체크포인트 충돌은 게이트가 막아야 한다(둘은 같은 크롬 프로필을 공유한다).
need(/routineRunning/.test(src), '게이트가 매일 루틴 실행 여부를 확인함(routineRunning)');
need(/actions:\s*read/.test(wf), '워크플로가 게이트에 actions:read 권한을 줌(실행 상태 조회)');
need(/GH_TOKEN:/.test(wf) && /GH_REPO:/.test(wf), '게이트 스텝에 GH_TOKEN·GH_REPO가 전달됨');


console.log(pass ? '\n✅ 동기화 게이트 테스트 통과' : '\n❌ 실패 항목 있음');
process.exit(pass ? 0 : 1);
