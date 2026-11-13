// 인스타 과거 게시물 채우기 — Business Discovery 페이지 넘기기(2026-11-13)
//
// 왜: 카드 인스타 줄은 계정마다 최신 몇 개만 받아 덮어써서, 지난 게시물·관리자가 멤버를 태깅한 사진이 사라졌다
//     (사용자: "그럴 거면 사진 태깅이 무슨 의미가 있어"). 게시물은 이제 ig_media에 쌓고, 여기서 과거 쪽을 끝까지 채운다.
// 규모(11-13 실측): 계정 1,161개 · 게시물 약 102만. 호출 1번 = 50개 → 약 2만 번. 앱 한도 시간당 ~200번을
//     최신 수집(ig_business_discovery.mjs, 짝수 시)과 나눠 쓰려고 홀수 시에 돈다(ig-backfill.yml). 사용량 헤더 80%에서 멈춘다.
// 순서: 관리자가 태깅한 사진이 있는 계정 → 그룹 공식 계정 → 멤버 계정 → 매거진 계정. 계정 안에선 최신 → 과거.
// 저장은 가볍게(줄당 ~0.5KB): 사진 주소는 4~5일이면 만료라 저장하지 않고(화면은 게시물 코드로 다시 띄운다),
//   본문은 앞 300자, 캐러셀은 사진별 id·종류만(태그 식별용). 이미 있는 게시물(최신 수집분)은 덮어쓰지 않는다.
// 매거진 계정은 본문에 우리 아이돌 공식 계정(@핸들)을 태그한 글만 남긴다(최신 수집과 같은 규칙).
//
// 실행: META_IG_TOKEN=… SUPABASE_SERVICE_ROLE=… node tools/ig_backfill.mjs [--max=180] [--only=핸들] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.META_IG_TOKEN, SKEY = process.env.SUPABASE_SERVICE_ROLE;
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1';
const IG_USER = '17841420475472395', GRAPH = 'https://graph.facebook.com/v26.0';
const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const MAX = +(arg('max') || process.env.IG_BF_MAX || 180);
const ONLY = arg('only')?.trim().toLowerCase();
const DRY = process.argv.includes('--dry-run');
const STOP_PCT = 80;
if (!TOKEN || !SKEY) { console.error('META_IG_TOKEN / SUPABASE_SERVICE_ROLE 없음'); process.exit(1); }

const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const handleOf = u => { const m = String(u || '').match(/instagram\.com\/([A-Za-z0-9._]+)/i); return m ? m[1].toLowerCase() : null; };
const excluded = new Set((readJson('ig_excluded_accounts.json').accounts || []).map(x => String(x.h || '').toLowerCase()));
const groups = readJson('groups.json'), artistsRaw = readJson('artists.json');
const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);
const groupHandles = new Set(Object.values(groups).map(g => handleOf(g.links && g.links.instagram)).filter(h => h && !excluded.has(h)));
const memberHandles = new Set(artists.map(a => handleOf(a.links && a.links.instagram)).filter(h => h && !excluded.has(h)));
const artistHandles = new Set([...groupHandles, ...memberHandles]);
const MAG = new Set((readJson('ig_media_accounts.json').accounts || []).map(x => String(x.h || '').toLowerCase()).filter(h => h && !excluded.has(h)));
const mentionsOf = cap => [...new Set((String(cap || '').match(/@([A-Za-z0-9._]+)/g) || []).map(x => x.slice(1).toLowerCase().replace(/\.+$/, '')))].filter(h => artistHandles.has(h));

const SBH = { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'application/json' };
async function sbGetAll(qs) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/${qs}`, { headers: { ...SBH, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error('DB 조회 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json(); out.push(...d); if (d.length < 1000) return out;
  }
}
async function sbWrite(method, qs, body, prefer) {
  if (DRY) return;
  const r = await fetch(`${SB}/${qs}`, { method, headers: { ...SBH, Prefer: prefer || 'return=minimal' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${qs} 저장 실패 ${r.status} ${(await r.text()).slice(0, 300)}`);
}

// 서버 함수 ig-fresh(지난 글 열 때 새 주소)가 쓸 인스타 키 — 잠긴 칸 app_secrets에(2026-11-13). 방문자는 못 읽는다.
await sbWrite('POST', 'app_secrets?on_conflict=k', [{ k: 'meta_ig_token', v: TOKEN, updated_at: new Date().toISOString() }], 'resolution=merge-duplicates,return=minimal');
const accts = await sbGetAll('ig_accounts?select=handle,status,media_count,bf_cursor,bf_done,bf_count&status=eq.ok&order=handle');
const tagged = new Set((await sbGetAll('ig_photo_tags?select=handle')).map(r => r.handle));
const rank = h => tagged.has(h) ? 0 : groupHandles.has(h) ? 1 : memberHandles.has(h) ? 2 : MAG.has(h) ? 3 : 9;
const queue = accts.filter(a => !a.bf_done && rank(a.handle) < 9 && (!ONLY || a.handle === ONLY))
  .sort((a, b) => rank(a.handle) - rank(b.handle) || (a.media_count || 0) - (b.media_count || 0));
const leftCalls = accts.filter(a => !a.bf_done && rank(a.handle) < 9).reduce((n, a) => n + Math.ceil(Math.max(0, (a.media_count || 0) - (a.bf_count || 0)) / 50), 0);
console.log(`과거 채우기 남은 계정 ${queue.length} · 남은 호출 약 ${leftCalls}회`);

const usagePct = h => { let m = 0; for (const k of ['x-app-usage', 'x-business-use-case-usage']) { const v = h.get(k); if (!v) continue; try { JSON.stringify(JSON.parse(v)).replace(/"(call_count|total_time|total_cputime)":(\d+)/g, (_, __, n) => { m = Math.max(m, +n); }); } catch { } } return m; };
const keyOf = p => (String(p || '').match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let calls = 0, saved = 0, finished = 0, stoppedBy = '';
outer:
for (const a of queue) {
  let cursor = a.bf_cursor || null, count = a.bf_count || 0, lim = 50; // 응답이 크면 메타가 "reduce the amount of data"로 거절 — 25·12로 줄여 같은 자리에서 다시
  while (calls < MAX) {
    const media = `media${cursor ? `.after(${cursor})` : ''}.limit(${lim}){id,media_type,permalink,timestamp,caption,like_count,comments_count,children{id,media_type}}`;
    const url = `${GRAPH}/${IG_USER}?fields=business_discovery.username(${encodeURIComponent(a.handle)}){${media}}&access_token=${encodeURIComponent(TOKEN)}`;
    let r, j;
    try { r = await fetch(url); j = await r.json(); } catch (e) { stoppedBy = '네트워크 ' + e.message; break outer; }
    calls++;
    if (j.error) {
      const c = j.error.code;
      if (c === 190) { console.error('❌ 토큰 만료/무효:', j.error.message); process.exitCode = 2; break outer; }
      if ([4, 17, 32, 613, 80002].includes(c)) { stoppedBy = `호출 한도(${c})`; break outer; }
      if (c === 200 && /access blocked/i.test(j.error.message || '')) { console.error('❌ 메타 앱 차단:', j.error.message); process.exitCode = 3; break outer; }
      if (/reduce the amount of data/i.test(j.error.message || '') && lim > 6) { lim = Math.floor(lim / 2); continue; }
      // 커서가 만료됐으면 처음부터 다시(이미 있는 글은 건너뛰니 손해는 호출 몇 번)
      if (cursor) { console.warn(`  ${a.handle}: 커서 오류 → 처음부터 (${String(j.error.message).slice(0, 80)})`); cursor = null; await sbWrite('PATCH', `ig_accounts?handle=eq.${encodeURIComponent(a.handle)}`, { bf_cursor: null }); continue; }
      console.warn(`  ${a.handle}: 건너뜀 (${String(j.error.message).slice(0, 120)})`); break;
    }
    const m = (j.business_discovery && j.business_discovery.media) || {};
    const isMag = MAG.has(a.handle);
    const rows = (m.data || []).map(x => {
      const post_key = keyOf(x.permalink); if (!post_key) return null;
      const kids = ((x.children && x.children.data) || []).slice(0, 20);
      const o = { post_key, handle: a.handle, media_id: x.id ? String(x.id) : null, t: x.timestamp || null, ty: x.media_type || null, p: x.permalink,
        u: null, c: null, mi: kids.length > 1 ? kids.map(k => ({ id: k.id ? String(k.id) : null, ty: k.media_type })) : null, n: kids.length > 1 ? kids.length : 1,
        cap: x.caption ? String(x.caption).slice(0, 300) : null, lk: x.like_count ?? null, cm: x.comments_count ?? null, m: null, src: 'backfill', pc: (cursor || '') + '|' + lim };
      if (isMag) { o.m = mentionsOf(x.caption); if (!o.m.length) return null; }
      return o;
    }).filter(Boolean);
    if (rows.length) await sbWrite('POST', 'ig_media?on_conflict=post_key', rows, 'resolution=ignore-duplicates,return=minimal');
    if (rows.length) await sbWrite('POST', 'ig_media?on_conflict=post_key&columns=post_key,handle,pc', rows.map(o => ({ post_key: o.post_key, handle: o.handle, pc: o.pc })), 'resolution=merge-duplicates,return=minimal');
    saved += rows.length; count += (m.data || []).length;
    const next = m.paging && m.paging.cursors && m.paging.cursors.after;
    // Business Discovery 안쪽 media는 paging.next 없이 cursors.after만 준다 — 커서가 없거나 빈 페이지일 때만 끝
    const done = !next || !(m.data || []).length;
    cursor = done ? null : next;
    await sbWrite('PATCH', `ig_accounts?handle=eq.${encodeURIComponent(a.handle)}`, { bf_cursor: cursor, bf_done: done, bf_count: count });
    if (done) { finished++; break; }
    if (r && usagePct(r.headers) >= STOP_PCT) { stoppedBy = `사용량 ${STOP_PCT}%`; break outer; }
    await sleep(300);
  }
  if (calls >= MAX) { stoppedBy = `회차 한도 ${MAX}회`; break; }
}
console.log(`과거 채우기 — 호출 ${calls}회 · 저장 ${saved}개 · 끝난 계정 ${finished}${stoppedBy ? ' · 중단: ' + stoppedBy : ''}`);
