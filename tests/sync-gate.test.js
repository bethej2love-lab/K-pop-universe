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

const UNITS_PER_SYNC = 350;      // 공식 채널 playlistItems ~222 + 외부 채널 ~60 + 조회수 갱신 ~70
const DAILY_ROUTINE_RUNS = 8;    // daily-routine.yml: cron '0 */3 * * *'
const QUOTA = 10000;             // YouTube Data API 일일 한도
const used = (maxRunsPerDay + DAILY_ROUTINE_RUNS) * UNITS_PER_SYNC;

console.log(`   동기화 최대 ${maxRunsPerDay}회/일 + 루틴 ${DAILY_ROUTINE_RUNS}회 = ${used.toLocaleString()} units / 한도 ${QUOTA.toLocaleString()}`);
need(used <= QUOTA, `쿼터 예산 안에 들어옴 (${Math.round(used / QUOTA * 100)}% 사용)`);

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

console.log(pass ? '\n✅ 동기화 게이트 테스트 통과' : '\n❌ 실패 항목 있음');
process.exit(pass ? 0 : 1);
