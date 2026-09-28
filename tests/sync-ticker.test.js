// 동기화 티커·워치독 배선 테스트 (2026-09-28)
//
// 왜: "매시간 동기화"가 GitHub cron 드랍으로 실제론 하루 6~7회였고(96발 중), 외부 채널이 1주일간 멈춘
// 걸 아무 알림 없이 사용자가 먼저 발견했다. 그 두 구멍을 막는 배선(티커 체인·워치독)이 조용히 풀리면
// 같은 사고가 다시 난다 — 워크플로 YAML은 실행해볼 수 없으니 구조를 고정한다.
const fs = require('fs');
const path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let pass = true;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };

const ticker = R('.github/workflows/sync-ticker.yml');
need(/actions:\s*write/.test(ticker), '티커가 workflow_dispatch를 쏠 권한(actions: write)을 가짐');
need(/node tools\/sync_gate\.mjs/.test(ticker), '티커가 간격 판정을 게이트에 맡김(정책을 두 곳에 두지 않음)');
need(/gh workflow run sync-hourly\.yml[^\n]*-f force=true/.test(ticker), '게이트 통과 시 sync-hourly를 force로 발사(게이트가 방금 남긴 표식에 스스로 막히지 않게)');
need(/gh workflow run sync-ticker\.yml/.test(ticker), '끝날 때 자기 자신을 다시 발사(체인)');
need(/schedule:[\s\S]*cron:/.test(ticker), '체인이 끊겼을 때 되살리는 예비 cron이 있음');
need(/cancel-in-progress:\s*false/.test(ticker), '티커 동시성: 도는 티커를 끊지 않음');
const loopMin = Number(/\+ (\d+)\*60 \)\)/.exec(ticker)?.[1] || 999);
const tmo = Number(/timeout-minutes:\s*(\d+)/.exec(ticker)?.[1] || 0);
need(loopMin + 10 <= tmo && tmo <= 360, `루프(${loopMin}분)가 잡 타임아웃(${tmo}분) 안에서 끝나 자기 재발사까지 도달`);
need(/sleep 300/.test(ticker), '5분 틱 — 게이트 간격(48/60분)을 5분 오차 안에서 지킴');
need(/gh workflow run sync-watchdog\.yml/.test(ticker), '티커가 워치독을 발사');

const hourly = R('.github/workflows/sync-hourly.yml');
need(/concurrency:\s*\n\s*group: sync-hourly\s*\n\s*cancel-in-progress: false/.test(hourly),
  'sync-hourly가 돌고 있는 동기화를 다음 발화로 끊지 않음(cancel-in-progress: false)');
need(/force:/.test(hourly), 'sync-hourly가 force 입력을 받음(티커 발사용)');

const wd = R('.github/workflows/sync-watchdog.yml');
need(/issues:\s*write/.test(wd), '워치독이 이슈를 쓸 권한을 가짐');
need(/schedule:[\s\S]*cron:/.test(wd), '워치독 자체 예비 cron — 티커가 죽으면 동기화도 멈추므로 감시자가 티커에만 기대면 안 됨');
need(/KPU_YT_API_KEY/.test(wd) && /WATCHDOG_API:\s*auto/.test(wd), '유튜브 실물 대조가 하루 1회 자동으로 돎');

// 워치독이 "동기화가 일부러 버리는 제목"을 누락으로 오판하지 않게 — admin.js _ytClassify 'skip' 규칙과 짝
const admin = R('admin.js');
const wdSrc = R('tools/sync_watchdog.mjs');
const skipRe = new RegExp(/const SKIP_TITLE_RE = \/(.+)\/i;/.exec(wdSrc)[1], 'i');
const classify = admin.slice(admin.indexOf('function _ytClassify('), admin.indexOf('function _ytClassify(') + 1500);
const skipLines = classify.split('\n').filter(l => /return\s*'skip'/.test(l));
need(skipLines.length > 0, `_ytClassify의 skip 규칙 ${skipLines.length}줄 확인`);
for (const s of ['OFFICIAL AUDIO', '공식 음원', 'TEASER', '티저'])
  need(skipRe.test(`[${s}] 테스트`) === skipLines.some(l => new RegExp(/\/(.+?)\/\.test/.exec(l)[1]).test(`[${s}] 테스트`)),
    `skip 판정 일치: "${s}"`);
const admStrict = /const _EXT_STRICT_TIERS=new Set\(\[([^\]]*)\]\)/.exec(admin)[1].replace(/['\s]/g, '').split(',').sort().join(',');
const wdStrict = /const STRICT_TIERS = new Set\(\[([^\]]*)\]\)/.exec(wdSrc)[1].replace(/['\s]/g, '').split(',').sort().join(',');
need(admStrict === wdStrict, `워치독 strict tier가 admin.js _EXT_STRICT_TIERS와 같음(${wdStrict})`);
need(/createRequire\(import\.meta\.url\)\('\.\/matcher_harness\.cjs'\)/.test(wdSrc), '워치독이 실제 동기화 매처(하네스)로 판정 — 규칙 사본을 따로 두지 않음');
need(/_admSyncReport\('last_official_sync'/.test(admin) && /_admSyncReport\('last_ext_sync'/.test(admin),
  '공식·외부 동기화가 워치독용 리포트를 남김');
need(/meta\('last_official_sync'\)/.test(wdSrc) && /meta\('last_ext_sync'\)/.test(wdSrc), '워치독이 같은 키를 읽음');

console.log(pass ? '\n✅ 티커·워치독 배선 테스트 통과' : '\n💥 티커·워치독 배선 테스트 실패');
process.exit(pass ? 0 : 1);
