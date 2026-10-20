// 유튜브 구독자 수 수집 (2026-10-20, 사용자 요청 — "인스타 팔로워를 표기했으면 유튜브 구독자 수도")
//
// 대상: 그룹 공식 채널(groups.json links.youtube) + 멤버 개인 채널(artists.json links.youtube, ext_channels tier=idol).
//   ⚠️ 소속사 통합 채널은 그룹 숫자가 아니라서 애초에 links.youtube에 넣지 않는 게 규칙이다(project_kpop_official_channel_gap).
// 출력: yt_subs.json — { updatedAt, ch: { "<키>": { id, s } } }. 키는 링크에서 뽑은 "@핸들"(소문자) 또는 채널 ID(UC…).
//   s=null이면 채널이 구독자 수를 숨긴 것(카드엔 아이콘만).
//
// 쿼터(하루 1만 유닛, 다른 작업과 같은 지갑 — project_kpop_youtube_quota_wallet):
//   · 핸들→채널 ID는 channels?forHandle= 로 1건당 1유닛이라 **처음 한 번만** 풀고 파일에 남긴다(다음부터 재사용).
//   · 구독자 수는 channels?part=statistics&id= 로 50개당 1유닛 → 채널 500개여도 하루 10유닛.
//   · 한 번에 새로 풀 핸들은 --resolve-max(기본 400)로 제한 — 첫 실행이 지갑을 다 쓰지 않게.
//
// 실행: KPU_YT_API_KEY=... node tools/yt_subscribers.mjs [--resolve-max 400] [--dry]
//   회사망: NODE_TLS_REJECT_UNAUTHORIZED=0 을 앞에 붙일 것.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'yt_subs.json');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const DRY = process.argv.includes('--dry');
const RESOLVE_MAX = +arg('--resolve-max', 400);
const KEY = process.env.KPU_YT_API_KEY;
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/';
const SB_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';

// 링크 → 키. 앱(index.html _ytSubKey)과 **같은 규칙**이어야 카드에서 찾는다.
export function ytSubKey(url) {
  const u = String(url || '').trim();
  const ch = u.match(/youtube\.com\/channel\/(UC[\w-]{20,})/i);
  if (ch) return ch[1];
  const at = u.match(/youtube\.com\/@([^/?#]+)/i);
  if (at) return '@' + decodeURIComponent(at[1]).toLowerCase();
  const usr = u.match(/youtube\.com\/user\/([^/?#]+)/i);
  if (usr) return 'user:' + decodeURIComponent(usr[1]).toLowerCase();
  const c = u.match(/youtube\.com\/c\/([^/?#]+)/i);
  if (c) return 'c:' + decodeURIComponent(c[1]).toLowerCase();
  return null;
}

export function collectUrls({ groups, artists, idolRows }) {
  const urls = new Set();
  for (const g of Object.values(groups || {})) if (g && g.links && g.links.youtube) urls.add(g.links.youtube);
  for (const a of artists || []) if (a && a.links && a.links.youtube) urls.add(a.links.youtube);
  for (const r of idolRows || []) if (r && r.url) urls.add(r.url);
  return [...urls];
}

// fetchJson(url) → JSON. 테스트에서 가짜로 갈아 끼운다.
export async function run({ urls, prev, fetchJson, resolveMax = RESOLVE_MAX, log = console.log }) {
  const ch = { ...(prev && prev.ch) };
  const keys = [...new Set(urls.map(ytSubKey).filter(Boolean))];
  let units = 0, resolved = 0, unresolvable = [];
  // 1) 키 → 채널 ID(처음 보는 키만)
  for (const k of keys) {
    if (ch[k] && ch[k].id) continue;
    if (k.startsWith('UC')) { ch[k] = { ...(ch[k] || {}), id: k }; continue; }
    if (k.startsWith('c:')) { unresolvable.push(k); continue; } // /c/ 커스텀 URL은 API로 못 푼다
    if (resolved >= resolveMax) continue;
    const q = k.startsWith('@') ? `forHandle=${encodeURIComponent(k)}` : `forUsername=${encodeURIComponent(k.slice(5))}`;
    const d = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?part=id&${q}`); units++; resolved++;
    const id = d && d.items && d.items[0] && d.items[0].id;
    if (id) ch[k] = { ...(ch[k] || {}), id }; else unresolvable.push(k);
  }
  // 2) 구독자 수(50개씩)
  const byId = new Map();
  for (const k of keys) if (ch[k] && ch[k].id) { if (!byId.has(ch[k].id)) byId.set(ch[k].id, []); byId.get(ch[k].id).push(k); }
  const ids = [...byId.keys()];
  let got = 0;
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50);
    const d = await fetchJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&maxResults=50&id=${part.join(',')}`); units++;
    for (const it of (d && d.items) || []) {
      const st = it.statistics || {};
      const s = st.hiddenSubscriberCount ? null : (st.subscriberCount != null ? +st.subscriberCount : null);
      for (const k of byId.get(it.id) || []) { ch[k] = { id: it.id, s }; got++; }
    }
  }
  // 링크에서 빠진 키는 버린다(그룹 링크를 바꾸면 옛 채널 숫자가 남지 않게)
  for (const k of Object.keys(ch)) if (!keys.includes(k)) delete ch[k];
  log(`[yt-subs] 링크 ${urls.length} · 채널 키 ${keys.length} · 새로 푼 핸들 ${resolved} · 숫자 받은 키 ${got} · 못 푼 키 ${unresolvable.length} · 사용 ${units}유닛`);
  if (unresolvable.length) log(`[yt-subs] 못 푼 키(앞 20): ${unresolvable.slice(0, 20).join(', ')}`);
  return { ch, units };
}

// 키별 한 줄 JSON — 매일 숫자만 바뀌니 diff가 읽히게
export function serialize(ch) {
  const keys = Object.keys(ch).sort();
  return '{\n  "updatedAt": "' + new Date().toISOString() + '",\n  "ch": {\n'
    + keys.map(k => `    ${JSON.stringify(k)}: ${JSON.stringify(ch[k])}`).join(',\n') + '\n  }\n}\n';
}

async function main() {
  if (!KEY) { console.log('[yt-subs] KPU_YT_API_KEY 없음 — 건너뜀'); return; }
  const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
  const artistsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
  const artists = Array.isArray(artistsRaw) ? artistsRaw : (artistsRaw.artists || Object.values(artistsRaw));
  let idolRows = [];
  try {
    const r = await fetch(`${SB}ext_channels?select=url&tier=eq.idol`, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (r.ok) idolRows = await r.json();
  } catch (e) { console.log('[yt-subs] ext_channels 조회 실패 — 그룹·artists 링크만', e.message); }
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const fetchJson = async url => {
    const r = await fetch(url + `&key=${KEY}`);
    if (!r.ok) throw new Error(`YouTube ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  const { ch } = await run({ urls: collectUrls({ groups, artists, idolRows }), prev, fetchJson });
  if (DRY) { console.log('[yt-subs] --dry: 파일 안 씀'); return; }
  fs.writeFileSync(OUT, serialize(ch));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
