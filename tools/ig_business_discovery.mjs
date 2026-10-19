// 인스타그램 공식 계정 정보 수집 — Business Discovery API (2026-10-19)
//
// 왜: 아이돌 인스타(그룹 253 + 멤버 1,247 링크)의 프로필 사진·팔로워·게시물 수를 공식 API로 받는다. 사진은 지금 관리자가
// 손으로 등록하고(artist_pics), 팔로워는 아예 없었다. 날짜별 팔로워를 쌓아 두면 증가·돌파 같은 소식을 만들 수 있다.
//
// 동작: 2시간마다(ig-stats.yml) **가장 오래전에 받은 계정부터** 회당 최대 180개. Business Discovery는 앱 기준 시간당 약 200회라
// 한 회차가 한 시간 몫을 넘지 않게 한다(응답 헤더 x-app-usage / x-business-use-case-usage가 90%를 넘으면 그 자리에서 멈춤).
// 하루 12회 × 180 = 2,160 > 1,500이라 하루에 한 바퀴 돈다 — 프로필 사진 주소(fbcdn, oe= 만료)가 상하기 전에 새로 받는 주기.
//
// 저장: Supabase ig_accounts(핸들별 최신) + ig_follower_daily(핸들·날짜별 팔로워) — sql/2026-10-19_ig_stats.sql.
//   핸들이 키라 동명이인 문제 없음(앱은 artists/groups의 links.instagram에서 핸들을 뽑아 조인한다).
// 설정값(계정 번호·필수 권한)은 메모리/CHANGELOG 참고 — 권한에 instagram_manage_insights·ads_read가 빠지면 (#10) 오류.
//
// 실행: META_IG_TOKEN=… SUPABASE_SERVICE_ROLE=… node tools/ig_business_discovery.mjs [--max=180] [--only=ivestarship]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = process.env.META_IG_TOKEN;
const SKEY = process.env.SUPABASE_SERVICE_ROLE;
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1';
const IG_USER = '17841420475472395'; // 우리 인스타 비즈니스 계정(Kpop-universe.kr 페이지에 연결)
const GRAPH = 'https://graph.facebook.com/v26.0';
const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const MAX = +(arg('max') || process.env.IG_MAX || 180);
const ONLY = arg('only');
if (!TOKEN || !SKEY) { console.error('META_IG_TOKEN / SUPABASE_SERVICE_ROLE 없음'); process.exit(1); }

const readJson = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const groups = readJson('groups.json'), artistsRaw = readJson('artists.json');
const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);
// 링크 → 핸들(소문자). 'instagram.com/<핸들>' 형식만(검사 결과 비정형 0건)
const handleOf = u => { const m = String(u || '').match(/instagram\.com\/([A-Za-z0-9._]+)/i); return m ? m[1].toLowerCase() : null; };
const handles = new Set();
for (const g of Object.values(groups)) { const h = handleOf(g.links && g.links.instagram); if (h) handles.add(h); }
for (const a of artists) { const h = handleOf(a.links && a.links.instagram); if (h) handles.add(h); }

const SBH = { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'application/json' };
async function sbGetAll(qs) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB}/${qs}`, { headers: { ...SBH, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error('DB 조회 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const d = await r.json(); out.push(...d);
    if (d.length < 1000) return out;
  }
}
async function sbUpsert(table, rows, conflict) {
  if (!rows.length) return;
  const r = await fetch(`${SB}/${table}?on_conflict=${conflict}`, { method: 'POST', headers: { ...SBH, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`${table} 저장 실패 ${r.status} ${(await r.text()).slice(0, 300)}`);
}

// 순서: 한 번도 안 받은 계정 → 오래전에 받은 계정
let prev = [];
try { prev = await sbGetAll('ig_accounts?select=handle,fetched_at&order=handle'); }
catch (e) { console.error(e.message + '\n→ sql/2026-10-19_ig_stats.sql을 먼저 실행해야 한다'); process.exit(1); }
const last = new Map(prev.map(r => [r.handle, r.fetched_at]));
let queue = ONLY ? [ONLY.toLowerCase()] : [...handles].sort((a, b) => String(last.get(a) || '').localeCompare(String(last.get(b) || '')));
queue = queue.slice(0, MAX);

const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // KST 날짜
const usagePct = h => { let m = 0; for (const k of ['x-app-usage', 'x-business-use-case-usage']) { const v = h.get(k); if (!v) continue; try { JSON.stringify(JSON.parse(v)).replace(/"(call_count|total_time|total_cputime)":(\d+)/g, (_, __, n) => { m = Math.max(m, +n); }); } catch { } } return m; };
const acc = [], daily = [];
let ok = 0, nf = 0, stoppedBy = '';
for (const h of queue) {
  const url = `${GRAPH}/${IG_USER}?fields=business_discovery.username(${encodeURIComponent(h)}){username,name,followers_count,media_count,profile_picture_url}&access_token=${encodeURIComponent(TOKEN)}`;
  let r, j;
  try { r = await fetch(url); j = await r.json(); } catch (e) { stoppedBy = '네트워크 ' + e.message; break; }
  if (j.error) {
    const c = j.error.code, sc = j.error.error_subcode;
    if (c === 190) { console.error('❌ 토큰 만료/무효 — META_IG_TOKEN을 새로 발급해 Secrets에 넣어야 한다:', j.error.message); process.exitCode = 2; break; }
    if ([4, 17, 32, 613, 80002].includes(c)) { stoppedBy = `호출 한도(${c})`; break; }
    if (c === 10 || c === 200) { console.error('❌ 권한 오류 — instagram_manage_insights·ads_read 등 권한이 빠진 토큰:', j.error.message); process.exitCode = 3; break; }
    // 계정 없음·개인 계정(비즈니스/크리에이터 아님)·연령 제한 → 기록만 남기고 다음 바퀴에 다시
    acc.push({ handle: h, status: 'not_found', note: String(j.error.message || '').slice(0, 200) + (sc ? ' #' + sc : ''), fetched_at: new Date().toISOString() });
    nf++;
  } else {
    const b = j.business_discovery || {};
    acc.push({ handle: h, ig_id: b.id || null, name: b.name || null, followers: b.followers_count ?? null, media_count: b.media_count ?? null, pic_url: b.profile_picture_url || null, status: 'ok', note: null, fetched_at: new Date().toISOString() });
    if (b.followers_count != null) daily.push({ handle: h, day, followers: b.followers_count });
    ok++;
  }
  if (r && usagePct(r.headers) >= 90) { stoppedBy = '사용량 90%'; break; }
  await sleep(300);
}
function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
await sbUpsert('ig_accounts', acc, 'handle');
await sbUpsert('ig_follower_daily', daily, 'handle,day');
console.log(`인스타 계정 ${handles.size}개 중 이번 ${acc.length}개 — 성공 ${ok} · 조회 불가 ${nf}${stoppedBy ? ' · 중단: ' + stoppedBy : ''}`);
