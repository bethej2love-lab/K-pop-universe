// 외부 채널 동기화 공정성 테스트 (2026-09-28)
//
// 왜: 외부 채널은 이름순으로 돌았고 회차 예산(_ytBudgetLeft)이 바닥나면 거기서 접었다. 목록 앞쪽의
// 잡지·매체 12곳이 매 회차 오류로 북마크를 못 옮겨 40페이지씩 재스캔하자, 뒤쪽 채널(음방 직캠·
// 슬기 개인 채널 등)이 9/21부터 1주일간 **한 번도 차례가 오지 않았다**("주간 개인 직캠 TOP 20"이 3개).
// 지금 구조: 1단계에서 모든 채널의 신규만 얕게 보고, 과거 이어받기는 2단계(남은 예산)에서만.
//
// ⚠️ 실제 _ytSyncExtChannels 본문을 꺼내 가짜 API·localStorage를 물려 돌린다(소스 문자열 검사 아님).
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
let pass = true;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };

const start = src.indexOf('async function _ytSyncExtChannels(');
const end = src.indexOf('\n}\n', start);
need(start > 0 && end > start, '_ytSyncExtChannels 본문을 찾음');
const body = src.slice(start, end + 2);

function run({ channels, budget, ls = {}, fetchImpl, onProg }) {
  const store = { ...ls };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
  let calls = 0;
  const reports = {};
  const fetched = []; // {handle, resumeTok, maxPages, stopBefore, sinceId}
  const deps = {
    localStorage,
    _EXT_CHANNELS: channels,
    _ytApiKey: () => 'KEY',
    sb: { from: () => { const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: [] }) }; return q; } },
    _ytSetProg: m => { if (onProg) onProg(m); },
    _ytBudgetLeft: () => budget - calls,
    _ytBudgetSpent: () => calls,
    _ytGetUploadsId: async url => 'UU_' + url,
    _ytFetchNewVideos: async (uploadsId, key, sinceId, onProg, resumeTok, cutoff, maxPages, stopBefore) => {
      const handle = uploadsId.slice(3);
      fetched.push({ handle, resumeTok, maxPages, stopBefore, sinceId });
      const r = fetchImpl(handle, { resumeTok, maxPages, stopBefore, sinceId });
      calls += r.pages;
      return r;
    },
    _ytProbeShortsInline: async () => {},
    _extBuildRows: vids => ({ rows: vids.map(v => ({ ...v, group_ko: 'g' })), skipped: 0 }),
    _ytUpsertVideos: async () => ({ error: null }),
    _EXT_STRICT_TIERS: new Set(),
    _YT_TABLE: 't',
    _admSyncReport: (k, o) => { reports[k] = o; },
  };
  const names = Object.keys(deps);
  const fn = new Function(...names, `let _extSyncing=false;\n${body}; return _ytSyncExtChannels;`)(...names.map(n => deps[n]));
  return fn().then(() => ({ store, fetched, calls, reports }));
}

(async () => {
  // ── 1) 앞쪽 5곳이 매번 상한까지 폭주해도 뒤쪽 채널까지 1단계가 돈다 ─────────────
  {
    const channels = Array.from({ length: 30 }, (_, i) => ({ handle: 'c' + i, url: 'c' + i, name: 'c' + i, tier: 'music' }));
    const ls = {};
    channels.forEach(c => { ls['kpu_ext_last_' + c.handle] = 'old_' + c.handle; });
    const broken = new Set(['c0', 'c1', 'c2', 'c3', 'c4']);
    const { store, fetched, reports } = await run({
      channels, budget: 120, ls,
      fetchImpl: (h, o) => {
        if (broken.has(h) && !o.resumeTok) // 북마크를 못 만나는 채널 — 주어진 상한까지 다 씀
          return { vids: [{ id: h + '_new' }], done: false, interrupted: true, cappedOut: true, pages: o.maxPages || 40, resumeToken: 'tok_' + h, newestId: h + '_new' };
        if (o.resumeTok && h === 'c0') return { vids: [], done: false, interrupted: true, cappedOut: true, pages: 3, resumeToken: 'tok2_c0', newestId: null }; // 아직 덜 메움
        if (o.resumeTok) return { vids: [], done: true, interrupted: false, cappedOut: false, pages: 3, resumeToken: '', newestId: null };
        return { vids: [{ id: h + '_new' }], done: true, interrupted: false, cappedOut: false, pages: 1, resumeToken: '', newestId: h + '_new' };
      },
    });
    const p1 = fetched.filter(f => !f.resumeTok).map(f => f.handle);
    need(channels.every(c => p1.includes(c.handle)), `1단계가 30곳 전부 돎(${new Set(p1).size}/30) — 앞쪽 폭주가 꼬리를 못 굶긴다`);
    need(fetched.filter(f => !f.resumeTok).every(f => f.maxPages > 0 && f.maxPages <= 10), '1단계는 얕은 상한(≤10페이지)으로만 본다');
    need(store['kpu_ext_last_c29'] === 'c29_new', '맨 끝 채널 북마크도 최신으로 전진');
    need(store['kpu_ext_last_c0'] === 'c0_new', '폭주 채널도 북마크는 최신으로 옮김(같은 구간 재스캔 반복 방지)');
    const fl = JSON.parse(store['kpu_ext_floor_c0'] || 'null');
    need(fl && fl.id === 'old_c0' && /^\d{4}-\d{2}-\d{2}$/.test(fl.date), `공백 바닥을 옛 북마크+날짜로 남김(${JSON.stringify(fl)})`);
    const p2 = fetched.filter(f => f.resumeTok);
    need(p2.length > 0 && p2.every(f => f.sinceId && f.sinceId.startsWith('old_') && f.stopBefore), '2단계는 바닥 id/날짜에서 멈추도록 호출');
    need(store['kpu_ext_resume_c0'] === 'tok2_c0', '덜 메운 채널은 이어받기 지점을 전진시켜 보존');
    need(!store['kpu_ext_resume_c1'] && !store['kpu_ext_floor_c1'], '공백을 다 메우면 이어받기·바닥 정리');
    const rep = reports.last_ext_sync;
    need(rep && rep.reached === 30 && rep.total === 30 && rep.errors === 0, `결과 리포트를 워치독용으로 남김(${JSON.stringify(rep && { reached: rep.reached, total: rep.total, errors: rep.errors })})`);
  }

  // ── 1-b) 채널 오류는 리포트와 ❌ 판정 문구로 드러난다(예전엔 "오류 12건"이라 ✅였다) ──────
  {
    const channels = Array.from({ length: 6 }, (_, i) => ({ handle: 'c' + i, url: 'c' + i, name: 'n' + i, tier: 'music' }));
    let lastProg = '';
    const { reports } = await run({
      channels, budget: 100,
      fetchImpl: h => { if (h === 'c2') throw new Error('null value in column "group_ko"'); return { vids: [], done: true, interrupted: false, cappedOut: false, pages: 1, resumeToken: '', newestId: h + '_n' }; },
      onProg: m => { lastProg = m; },
    });
    const rep = reports.last_ext_sync;
    need(rep && rep.errors === 1 && rep.errChannels[0].h === 'c2' && /group_ko/.test(rep.errChannels[0].msg), '오류 채널·원문이 리포트에 남음');
    const STEP_FAIL_RE = new RegExp(src.match(/const _STEP_FAIL_RE=\/(.+)\/;/)[1]);
    need(STEP_FAIL_RE.test(lastProg), `마지막 진행 문구가 루틴의 ❌ 판정에 걸림("${lastProg.slice(0, 80)}")`);
  }

  // ── 2) 1단계가 예산에 걸리면 다음 회차는 그 근처부터 시작 ─────────────────────
  {
    const channels = Array.from({ length: 30 }, (_, i) => ({ handle: 'c' + i, url: 'c' + i, name: 'c' + i, tier: 'music' }));
    const ok1 = h => ({ vids: [], done: true, interrupted: false, cappedOut: false, pages: 1, resumeToken: '', newestId: h + '_n' });
    const r1 = await run({ channels, budget: 12, fetchImpl: ok1 });
    const rr = +r1.store['kpu_ext_rr'];
    need(rr > 0, `예산 소진 지점을 기억(kpu_ext_rr=${rr})`);
    const r2 = await run({ channels, budget: 12, ls: r1.store, fetchImpl: ok1 });
    const seen1 = new Set(r1.fetched.map(f => f.handle));
    need(r2.fetched[0].handle === 'c' + rr, `다음 회차는 c0가 아니라 멈춘 곳 근처부터(첫 채널 ${r2.fetched[0].handle})`);
    need(r2.fetched.filter(f => !seen1.has(f.handle)).length >= 5, '두 번째 회차가 첫 회차에 못 본 채널을 본다');
  }

  console.log(pass ? '\n✅ 외부 채널 공정성 테스트 통과' : '\n💥 외부 채널 공정성 테스트 실패');
  process.exit(pass ? 0 : 1);
})();
