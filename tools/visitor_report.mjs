// tools/visitor_report.mjs — 주간 보고(weekly_report.mjs)의 '방문자' 절(2026-11-19 사용자 "방문자 지표 분석·목표·관리자 보고").
// 관리자 화면 Daily(get_app_core)는 관리자 로그인으로만 열려 CI가 못 부른다 → 여기서는 표를 직접 읽어 단순 집계만 낸다.
// 기준이 Daily와 조금 다르다(관리자 본인 포함, '신규'는 가입일이 아니라 지난 14일 안 첫 기록) — 추세를 보는 용도.
// DB 부담: created_at 색인으로 14일만, 필요한 ev만, 1000행씩 최대 60쪽.
const DAY = 86400e3;
const APP_EVS = ['view_group', 'view_member', 'video_play', 'favorite_group', 'favorite_member', 'save_scrap', 'save_collection', 'explore_open', 'search'];
const SAVE_EVS = new Set(['favorite_group', 'favorite_member', 'save_scrap', 'save_collection']);
const BOT_RE = /(bot|spider|crawl|yeti|daumoa|slurp|bytespider|gpt|perplexity|claude|preview|inspection|mediapartners|headless)/i;
const kstDay = ts => new Date(Date.parse(ts) + 9 * 3600e3).toISOString().slice(0, 10);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) + '%' : '-');

// appRows: [{user_id, ev, k, created_at}], seoRows: [{ev, page_type, src, did, ua, created_at}] — 둘 다 지난 14일치
export function summarize(appRows, seoRows, now = Date.now()) {
  const cut = now - 7 * DAY;
  const app = { cur: mkApp(), prev: mkApp() };
  function mkApp() { return { users: new Set(), play: new Set(), save: new Set(), explore: new Set(), days: new Map() }; }
  const firstSeen = new Map();
  for (const r of appRows || []) {
    const t = Date.parse(r.created_at); if (!isFinite(t) || !r.user_id) continue;
    if (!firstSeen.has(r.user_id) || t < firstSeen.get(r.user_id)) firstSeen.set(r.user_id, t);
    const b = t >= cut ? app.cur : app.prev;
    b.users.add(r.user_id);
    if (r.ev === 'video_play') b.play.add(r.user_id);
    if (r.ev === 'explore_open') b.explore.add(r.user_id);
    if (SAVE_EVS.has(r.ev) && (r.ev.startsWith('save_') || r.k === 'add' || r.k == null)) b.save.add(r.user_id);
    if (!b.days.has(r.user_id)) b.days.set(r.user_id, new Set());
    b.days.get(r.user_id).add(kstDay(r.created_at));
  }
  const appOut = k => {
    const b = app[k];
    return { users: b.users.size, play: b.play.size, save: b.save.size, explore: b.explore.size, multiDay: [...b.days.values()].filter(s => s.size >= 2).length };
  };
  // 지난주에 왔던 사람 중 이번 주에도 온 사람
  const back = [...app.prev.users].filter(u => app.cur.users.has(u)).length;
  const fresh = [...app.cur.users].filter(u => firstSeen.get(u) >= cut).length;

  const seo = { cur: mkSeo(), prev: mkSeo() };
  function mkSeo() { return { land: new Set(), play: new Set(), toApp: new Set(), src: new Map(), type: new Map() }; }
  const acted = new Set((seoRows || []).filter(r => ['play', 'eng', 'cta', 'to_app', 'yt', 'fav'].includes(r.ev)).map(r => r.did));
  for (const r of seoRows || []) {
    const t = Date.parse(r.created_at); if (!isFinite(t) || !r.did || BOT_RE.test(r.ua || '')) continue;
    if (!(r.src || acted.has(r.did))) continue; // 사람으로 보는 기준 = 서버 _kpu_viewer_rows와 같다(바깥 출처가 있거나 뭔가 눌렀다)
    const b = t >= cut ? seo.cur : seo.prev;
    b.land.add(r.did);
    if (r.ev === 'play' || r.ev === 'yt') b.play.add(r.did);
    if (r.ev === 'to_app' || r.ev === 'cta') b.toApp.add(r.did);
    if (r.ev === 'land') {
      const s = r.src || '(출처 없음)'; if (!b.src.has(s)) b.src.set(s, new Set()); b.src.get(s).add(r.did);
      const p = r.page_type || 'other'; if (!b.type.has(p)) b.type.set(p, new Set()); b.type.get(p).add(r.did);
    }
  }
  const top = m => [...m.entries()].map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const seoOut = k => { const b = seo[k]; return { land: b.land.size, play: b.play.size, toApp: b.toApp.size, src: top(b.src), type: top(b.type) }; };
  return { app: { cur: appOut('cur'), prev: appOut('prev'), back, fresh }, seo: { cur: seoOut('cur'), prev: seoOut('prev') } };
}

export function toMarkdown(s, capped) {
  const a = s.app, e = s.seo, d = (c, p) => (p ? ` (지난주 ${p.toLocaleString()})` : '');
  const row = (label, c, p, extra = '') => `| ${label} | ${c.toLocaleString()}${d(c, p)}${extra} |`;
  const L = [];
  L.push('| 앱(지도·탐험·카드) | 이번 주 |', '|---|---|');
  L.push(row('온 사람', a.cur.users, a.prev.users));
  L.push(row('그중 처음 온 사람(지난 14일 기준)', a.fresh, 0));
  L.push(row('영상 재생한 사람', a.cur.play, a.prev.play, ` · 온 사람의 ${pct(a.cur.play, a.cur.users)}`));
  L.push(row('저장한 사람(하트·담기·컬렉션)', a.cur.save, a.prev.save, ` · ${pct(a.cur.save, a.cur.users)}`));
  L.push(row('이틀 이상 온 사람', a.cur.multiDay, a.prev.multiDay, ` · ${pct(a.cur.multiDay, a.cur.users)}`));
  L.push(row('지난주에 왔다가 또 온 사람', a.back, 0, ` · 지난주 방문자의 ${pct(a.back, a.prev.users)}`));
  L.push('', '| 검색으로 들어오는 페이지(정적) | 이번 주 |', '|---|---|');
  L.push(row('들어온 사람', e.cur.land, e.prev.land));
  L.push(row('영상 재생한 사람', e.cur.play, e.prev.play, ` · ${pct(e.cur.play, e.cur.land)}`));
  L.push(row('앱으로 넘어간 사람', e.cur.toApp, e.prev.toApp, ` · ${pct(e.cur.toApp, e.cur.land)}`));
  if (e.cur.src.length) L.push('', '- **어디서 왔나**: ' + e.cur.src.map(([k, n]) => `${k} ${n}`).join(' · '));
  if (e.cur.type.length) L.push('- **어떤 페이지로**: ' + e.cur.type.map(([k, n]) => `${k} ${n}`).join(' · '));
  L.push('', '_목표 보는 순서: ①정적→앱으로 넘어간 비율 ②저장한 사람 비율 ③또 온 사람 비율. 관리자 화면 Daily와 기준이 조금 달라(관리자 본인 포함) 숫자가 딱 맞지는 않는다._');
  if (capped) L.push('_⚠️ 기록이 많아 일부만 읽었다 — 숫자가 실제보다 작다._');
  return L.join('\n');
}

async function fetchAll(q, maxPages = 60) {
  const out = []; let capped = false;
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await q().range(i * 1000, i * 1000 + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return { rows: out, capped };
  }
  capped = true; return { rows: out, capped };
}

export async function visitorMarkdown(sb, now = Date.now()) {
  const since = new Date(now - 14 * DAY).toISOString();
  const [a, e] = await Promise.all([
    fetchAll(() => sb.from('app_events').select('user_id,ev,k,created_at').gte('created_at', since).in('ev', APP_EVS).order('id')),
    fetchAll(() => sb.from('seo_events').select('ev,page_type,src,did,ua,created_at').gte('created_at', since).order('id')),
  ]);
  return toMarkdown(summarize(a.rows, e.rows, now), a.capped || e.capped);
}
