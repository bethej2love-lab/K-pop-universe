// 수집 워치독 — "동기화가 실제로 영상을 빠짐없이 넣고 있는가"를 동기화와 **독립적으로** 확인한다 (2026-09-28)
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────────────
// 2026-09-21~28, 외부 채널 동기화가 매 회차 오류 12건을 내며 음방 직캠·아이돌 개인 채널(슬기 등)을
// **1주일간 한 건도** 못 넣었다. 루틴 단계는 ✅, 워크플로는 초록, 알림은 없었다 — 사용자가 "직캠 TOP 20이
// 3개뿐"·"슬기 영상이 없다"를 눈으로 보고서야 알았다. 동기화가 자기 성공을 스스로 보고하는 구조는
// 동기화가 고장 나면 같이 고장 난다. 그래서 바깥에서 결과만 보고 판정하는 감시자를 둔다.
//
// ── 무엇을 보나 ─────────────────────────────────────────────────────────────
//  1) 동기화 리포트(admin_meta: last_official_sync / last_ext_sync — admin.js _admSyncReport가 씀)
//     · 낮 시간(KST 10~24시)에 리포트가 3시간 넘게 안 갱신됨 → 🔴 동기화 멈춤
//     · 리포트에 오류 채널이 있음 → 🔴 채널명 + 에러 원문
//  2) 실제 유튜브와 DB 대조(API 모드, 하루 1회 · 채널당 1유닛)
//     각 채널의 최신 업로드 5개를 받아, **동기화 회차가 그 업로드 이후에 완료됐는데도** DB에 없으면 누락.
//     "몇 시간 지났으면"같은 임의 임계값을 안 쓰는 이유: 새벽 무동기화(01~08시)·cron 드랍 때문에 정상
//     지연의 폭이 넓어 임계값은 오탐이거나 늦는다. 리포트 시각 기준이면 "돌았는데 못 넣었다"만 잡힌다.
//     · 공식 채널·아이돌 개인 채널(owner 있음) — 업로드가 전부 수집 대상이라 1건만 빠져도 🔴
//       (티저·공식 음원·밴 인물 제목은 동기화가 일부러 버리므로 제외 — admin.js _ytClassify와 같은 규칙)
//     · 음방·매체 채널(owner 없음) — 제목에 아는 아이돌이 있을 때만 넣는 게 정상이라, 빠진 영상을 **실제
//       동기화 매처(_m2ParseTitle)로 다시 판정**해 받아들여지는 제목인데 없으면 🔴(추정 없이 진짜 누락만).
//
// ── 알림 ────────────────────────────────────────────────────────────────────
// GitHub Issue 하나("🚨 [수집 감시]")를 열고 본문을 갱신한다. **새 문제가 생길 때만 댓글**을 달아 알림이
// 가게 하고(같은 문제로 매시간 알림 폭탄 방지), 전부 해소되면 댓글을 남기고 닫는다.
//
// 실행: node tools/sync_watchdog.mjs [--api] [--dry]
// env: KPU_YT_API_KEY(--api에 필요) · GH_TOKEN, GH_REPO(이슈) · SUPABASE_SERVICE_ROLE(선택, API 모드 표식)
//      WATCHDOG_API=auto → 마지막 API 점검 후 20시간 지났으면 자동으로 API 모드
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const U = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const WRITE_KEY = process.env.SUPABASE_SERVICE_ROLE;
const YT_KEY = process.env.KPU_YT_API_KEY;
const DRY = process.argv.includes('--dry');
const CACHE_FILE = process.env.WATCHDOG_CACHE || path.join(ROOT, '.cache', 'yt_uploads_ids.json');
const ISSUE_TITLE = '🚨 [수집 감시] 영상 동기화 이상';
const REPORT_STALE_H = 3;       // 낮 시간 리포트 무갱신 허용 폭
const GRACE_MIN = 60;           // 업로드 직후 ~ 회차 완료 사이 여유(병렬 채널 처리 중 올라온 영상)
const LOOKBACK_DAYS = 14;       // 이보다 오래된 업로드는 대조 안 함(백필 영역)

const H = k => ({ apikey: k, Authorization: `Bearer ${k}` });
const kstHour = () => (new Date().getUTCHours() + 9) % 24;
async function sbGet(q, key = ANON) {
  const r = await fetch(`${U}/rest/v1/${q}`, { headers: H(key) });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function meta(key) {
  const rows = await sbGet(`atm_exception_rules?select=value&type=eq.admin_meta&key=eq.${key}`);
  return rows[0] ? rows[0].value : null;
}
async function setMeta(key, value) {
  if (!WRITE_KEY || DRY) return;
  await fetch(`${U}/rest/v1/atm_exception_rules?on_conflict=type,key`, {
    method: 'POST',
    headers: { ...H(WRITE_KEY), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ type: 'admin_meta', key, value }),
  }).catch(() => {});
}

// 동기화가 일부러 버리는 제목 — admin.js _ytClassify의 'skip' 규칙과 같다(짝이다 — 거기 바꾸면 여기도).
const SKIP_TITLE_RE = /OFFICIAL\s+AUDIO|공식\s*음원|\bTEASER\b|티저/i;
// 수집 채널 판정은 실제 동기화 매처로 — tools/matcher_harness.cjs가 admin.js 실코드를 잘라 실행한다(단일 출처).
const { _m2ParseTitle } = createRequire(import.meta.url)('./matcher_harness.cjs');
// admin.js _EXT_STRICT_TIERS와 짝(tests/sync-ticker.test.js가 일치를 본다)
const STRICT_TIERS = new Set(['variety', 'magazine', 'idol', 'grpsub', 'show', 'fans']);

// ── 1) 동기화 리포트 점검 ────────────────────────────────────────────────────
async function checkReports(problems) {
  const [off, ext, lastRoutine, lastAttempt] = await Promise.all([
    meta('last_official_sync'), meta('last_ext_sync'), meta('last_routine'), meta('last_sync_attempt'),
  ]);
  const out = { off, ext, lastRoutine: Number(lastRoutine) || 0, lastAttempt: Number(lastAttempt) || 0 };
  const h = kstHour();
  const active = h >= 10 || h === 0; // 새벽 01~08시 무동기화 + 09시 첫 회차 여유
  for (const [name, rep] of [['공식 채널', off], ['외부 채널', ext]]) {
    if (!rep || !rep.ts) continue; // 리포트 도입 전(첫 배포 직후) — 판정 보류
    const ageH = (Date.now() - rep.ts) / 3600000;
    if (active && ageH > REPORT_STALE_H)
      problems.push({ key: `stale:${name}`, sev: '🔴', text: `${name} 동기화 리포트가 ${ageH.toFixed(1)}시간째 갱신 안 됨 — 동기화가 안 돌고 있음(cron 드랍·루틴 실패 의심)` });
    for (const e of rep.errChannels || [])
      problems.push({ key: `err:${e.h || e.ko}:${(e.msg || '').slice(0, 40)}`, sev: '🔴', text: `${name} 오류 — **${e.name || e.ko}**: \`${e.msg}\`` });
    if (rep.budgetStopped && rep.reached < rep.total)
      problems.push({ key: `budget:${name}`, sev: '🟠', text: `${name} 회차 예산 소진 — ${rep.total}곳 중 ${rep.reached}곳만 확인(다음 회차가 이어받지만, 계속되면 예산/폭주 채널 점검)` });
  }
  return out;
}

// ── 2) 유튜브 실물 대조 ──────────────────────────────────────────────────────
function loadCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) { return {}; } }
function saveCache(c) { try { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(c)); } catch (e) {} }
let ytCalls = 0;
async function yt(url) {
  ytCalls++;
  const r = await fetch(url + `&key=${YT_KEY}`);
  const d = await r.json().catch(() => null);
  if (!r.ok) {
    const reason = d?.error?.errors?.[0]?.reason || r.status;
    const err = new Error(`YouTube ${reason}`); err.reason = reason; throw err;
  }
  return d;
}
async function uploadsId(url, cache) {
  if (cache[url]) return cache[url];
  // ⚠️ 해석 규칙은 admin.js _ytGetUploadsId와 **같아야** 한다 — 다르면 동기화는 잘 받는 채널을 "못 찾음"으로
  //    오판한다(첫 실행에서 위너·아이유·god 등 5곳이 그랬다: @ 없는 옛 커스텀 URL, forHandle 실패→forUsername).
  let id = null;
  const cm = url.match(/youtube\.com\/channel\/(UC[^/?#]+)/);
  const hm = url.match(/@([^/?#]+)/);
  const um = url.match(/youtube\.com\/(?:c\/|user\/)?([^/@?#\s]+)/);
  const slug = hm ? hm[1] : (um ? um[1] : null);
  const tryParam = async p => (await yt(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&${p}`)).items?.[0]?.contentDetails?.relatedPlaylists?.uploads || null;
  if (cm) id = 'UU' + cm[1].slice(2);
  else if (slug) id = await tryParam(`forHandle=${encodeURIComponent(slug)}`) || await tryParam(`forUsername=${encodeURIComponent(slug)}`);
  if (id) cache[url] = id;
  return id;
}
function channelList(extRows) {
  const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
  const artistsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
  const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);
  const list = [];
  // 공식 채널 — 해체 그룹은 제외(하루 1회만 폴링 + 해체일 이후 영상은 일부러 안 넣음, 기여 0.5%)
  for (const [ko, v] of Object.entries(groups)) if (v?.links?.youtube && !v.disbanded) list.push({ name: ko, url: v.links.youtube, kind: 'official', src: 'official' });
  const seen = new Set();
  for (const a of artists) {
    if (!a?.links?.youtube || groups[a.group?.ko] || seen.has(a.name?.ko)) continue;
    seen.add(a.name.ko); list.push({ name: a.name.ko, url: a.links.youtube, kind: 'official', src: 'official' });
  }
  for (const c of extRows) list.push({ name: c.name, url: c.url, handle: c.handle, kind: (c.owner_mko || c.owner_gko) ? 'owner' : 'collect', tier: c.tier, src: 'ext' });
  return list;
}
async function checkYouTube(problems, rep) {
  if (!YT_KEY) { console.log('[watchdog] KPU_YT_API_KEY 없음 — 유튜브 대조 생략'); return null; }
  const extRows = await sbGet('ext_channels?select=handle,name,url,tier,owner_mko,owner_gko');
  const chans = channelList(extRows);
  const cache = loadCache();
  // 판정 기준 시각 — 그 종류의 동기화가 마지막으로 **완료된** 시각. 리포트가 없으면(도입 전) 루틴 표식.
  const baseTs = { official: rep.off?.ts || rep.lastRoutine, ext: rep.ext?.ts || rep.lastRoutine };
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
  const stats = { channels: chans.length, checked: 0, missing: 0, apiErr: 0 };
  let quotaDead = false;
  const work = [...chans];
  async function worker() {
    while (work.length && !quotaDead) {
      const ch = work.shift();
      try {
        const up = await uploadsId(ch.url, cache);
        if (!up) { problems.push({ key: `nochan:${ch.url}`, sev: '🟠', text: `채널을 못 찾음 — **${ch.name}** (${ch.url}) · 링크가 바뀌었거나 삭제됨` }); continue; }
        const d = await yt(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=5&playlistId=${up}`);
        const base = baseTs[ch.src] || 0;
        const items = (d.items || []).map(it => ({ id: it.snippet?.resourceId?.videoId, title: it.snippet?.title || '', ts: it.snippet?.publishedAt || '' }))
          .filter(x => x.id && x.ts >= since && Date.parse(x.ts) < base - GRACE_MIN * 60000);
        stats.checked++;
        if (!items.length) continue;
        const have = new Set((await sbGet(`yt_channel_videos?select=id&id=in.(${items.map(x => x.id).join(',')})`)).map(r => r.id));
        const miss = items.filter(x => !have.has(x.id));
        if (!miss.length) continue;
        if (ch.kind === 'collect') {
          // 수집 채널은 "제목에 아는 아이돌이 있을 때만" 넣는 게 정상이라, 빠진 영상을 **실제 동기화 매처로
          // 다시 판정**한다 — 매처가 받아들이는 제목인데 DB에 없으면 그건 진짜 누락이다(추정 없음).
          // 첫 실행에서 "최신 5개 전멸" 추정은 오탐 18건(예능·대학방송·로스터 밖 인물)이었다.
          const lost = miss.filter(x => { try { const r = _m2ParseTitle(x.title, undefined, STRICT_TIERS.has(ch.tier), x.ts.slice(0, 10)); return !!(r && (r.primaryGroup || r.hold)); } catch (e) { return false; } })
            .filter(x => !SKIP_TITLE_RE.test(x.title));
          if (!lost.length) continue;
          stats.missing += lost.length;
          problems.push({ key: `collect:${ch.handle}:${lost[0].id}`, sev: '🔴', text: `**${ch.name}**(${ch.tier}) 매칭되는 영상 ${lost.length}개 누락 — ` + lost.slice(0, 3).map(x => `"${x.title.slice(0, 40)}" (${x.ts.slice(0, 10)}, https://youtu.be/${x.id})`).join(' · ') });
          continue;
        }
        const real = miss.filter(x => !SKIP_TITLE_RE.test(x.title));
        if (!real.length) continue;
        stats.missing += real.length;
        problems.push({ key: `miss:${ch.name}:${real[0].id}`, sev: '🔴', text: `**${ch.name}** ${ch.kind === 'owner' ? '개인 채널' : '공식 채널'} 영상 ${real.length}개 누락 — ` + real.slice(0, 3).map(x => `"${x.title.slice(0, 40)}" (${x.ts.slice(0, 10)}, https://youtu.be/${x.id})`).join(' · ') });
      } catch (e) {
        if (e.reason === 'quotaExceeded' || e.reason === 'dailyLimitExceeded') { quotaDead = true; break; }
        stats.apiErr++;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  saveCache(cache);
  if (quotaDead) problems.push({ key: 'quota', sev: '🟠', text: `유튜브 대조 중 쿼터 초과 — ${stats.checked}/${stats.channels}곳까지만 확인(쿼터가 바닥났다는 것 자체가 신호: 동기화도 같이 멈췄을 수 있음)` });
  stats.ytCalls = ytCalls;
  return stats;
}

// ── 알림(이슈) ──────────────────────────────────────────────────────────────
async function gh(method, p, body) {
  const r = await fetch(`https://api.github.com/repos/${process.env.GH_REPO}${p}`, {
    method, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`GitHub ${method} ${p} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}
async function publish(problems, info) {
  const stamp = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ') + ' KST';
  const keys = problems.map(p => p.key);
  const body = [
    `마지막 점검: ${stamp}${info.yt ? ` · 유튜브 대조 ${info.yt.checked}/${info.yt.channels}곳 (${info.yt.ytCalls}유닛)` : ' · 리포트만 점검'}`,
    '', ...problems.map(p => `- ${p.sev} ${p.text}`), '',
    '<details><summary>이 이슈는 tools/sync_watchdog.mjs가 자동으로 관리해요</summary>', '',
    '새 문제가 생기면 댓글로 알리고, 전부 해소되면 스스로 닫혀요. 판정 기준은 파일 머리 주석 참고.', '',
    `<!-- keys:${JSON.stringify(keys)} -->`, '</details>',
  ].join('\n');
  console.log(`\n[watchdog] 문제 ${problems.length}건\n` + problems.map(p => `  ${p.sev} ${p.text}`).join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## 수집 워치독\n\n${problems.length ? body : `✅ 이상 없음 (${stamp})`}\n`);
  if (DRY || !process.env.GH_TOKEN || !process.env.GH_REPO) return;
  const open = (await gh('GET', `/issues?state=open&per_page=50`)).find(i => i.title === ISSUE_TITLE && !i.pull_request);
  if (!problems.length) {
    if (open) {
      await gh('POST', `/issues/${open.number}/comments`, { body: `✅ 전부 해소됨 (${stamp}) — 이슈를 닫아요.` });
      await gh('PATCH', `/issues/${open.number}`, { state: 'closed' });
    }
    return;
  }
  if (!open) { await gh('POST', `/issues`, { title: ISSUE_TITLE, body }); return; }
  const prev = JSON.parse((open.body || '').match(/<!-- keys:(.*?) -->/)?.[1] || '[]');
  const fresh = problems.filter(p => !prev.includes(p.key));
  await gh('PATCH', `/issues/${open.number}`, { body });
  if (fresh.length) await gh('POST', `/issues/${open.number}/comments`, { body: `새 문제 ${fresh.length}건 (${stamp})\n\n` + fresh.map(p => `- ${p.sev} ${p.text}`).join('\n') });
}

async function main() {
  const problems = [];
  const rep = await checkReports(problems);
  let wantApi = process.argv.includes('--api');
  if (!wantApi && process.env.WATCHDOG_API === 'auto') {
    const last = Number(await meta('last_watchdog_api')) || 0;
    wantApi = Date.now() - last > 20 * 3600000 && kstHour() >= 11; // 하루 1회, 오전 동기화가 몇 번 돈 뒤
  }
  let yt = null;
  if (wantApi) { yt = await checkYouTube(problems, rep); if (yt) await setMeta('last_watchdog_api', Date.now()); }
  await publish(problems, { yt });
}
main().catch(e => { console.error('[watchdog] 실패:', e.message); process.exit(1); });
