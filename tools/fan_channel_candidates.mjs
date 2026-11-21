// 팬 채널 후보 찾기 (2026-11-21 사용자 "팬채널 등록도 꽤 보강해야" — 클로즈유어아이즈 팬콘 영상이 미등록 팬 채널에만 있었다)
// 유튜브 검색 결과(공개 페이지)에서 그 그룹 직캠을 올린 채널을 모아, **이미 등록된 채널(ext_channels)과 방송사·공식 채널을 뺀** 후보를 보여준다.
// 읽기 전용 — 아무것도 등록하지 않는다. 등록은 어드민 화면(또는 --sql로 뽑은 초안을 확인 후 실행)에서.
//
// 사용: node tools/fan_channel_candidates.mjs 클로즈유어아이즈 [검색어 더…]     예) … 클로즈유어아이즈 "클유아 팬콘"
//       node tools/fan_channel_candidates.mjs 클로즈유어아이즈 --alias=클유아 --sql   줄임말 포함 + 등록 SQL 초안(2건 이상 올린 채널만)
// 프록시 환경이면 NODE_USE_ENV_PROXY=1 을 붙인다. 유튜브가 페이지 구조를 바꾸면 ytInitialData 파싱부터 볼 것.
// ⚠️ 후보는 '그 검색어로 그 그룹 영상을 올린 채널'일 뿐이다 — 여러 그룹을 찍는 채널(잡덕 채널)은 owner_gko 하나로 묶을 수 없으니 등록 전에 채널을 열어 볼 것.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const SB = 'https://dukgguehegnembimqvkm.supabase.co', KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const args = process.argv.slice(2), wantSql = args.includes('--sql');
const [gko, ...extraQ] = args.filter(a => !a.startsWith('--'));
if (!gko || !GROUPS[gko]) { console.error('그룹 이름(groups.json 키)을 주세요. 예: node tools/fan_channel_candidates.mjs 클로즈유어아이즈'); process.exit(1); }
const g = GROUPS[gko];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function search(q, latest) {
  const u = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + (latest ? '&sp=CAI%253D' : '');
  let h = ''; for (let i = 0; i < 3 && !h; i++) { try { h = await (await fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko' } })).text(); } catch (e) { if (i === 2) throw e; await sleep(2000); } }
  const m = h.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/); if (!m) return [];
  const out = []; const walk = o => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.videoRenderer) out.push(o.videoRenderer); Object.values(o).forEach(walk); } };
  walk(JSON.parse(m[1]));
  return out.map(v => { const ob = ((v.ownerText || v.longBylineText || {}).runs || [{}])[0], ep = (ob.navigationEndpoint || {}).browseEndpoint || {};
    let handle = String(ep.canonicalBaseUrl || '').replace(/^\/@?/, ''); try { handle = decodeURIComponent(handle); } catch (e) {}
    return { vid: v.videoId, title: ((v.title || {}).runs || []).map(r => r.text).join(''), ch: ob.text || '', chId: ep.browseId || '', handle, pub: (v.publishedTimeText || {}).simpleText || '' }; });
}
// --alias=클유아,CYE : 팬들이 쓰는 줄임말(groups.json에 없는 것)도 그 그룹 영상으로 센다
const alias = (args.find(a => a.startsWith('--alias=')) || '').slice(8).split(',').map(x => x.trim()).filter(Boolean);
const names = [gko, g.en, ...(g.altNames || []), ...alias].filter(Boolean);
const norm = t => String(t).toLowerCase().replace(/\s+/g, '');
const hit = t => { const s = String(t).toLowerCase().replace(/\s+/g, ''); return names.some(n => s.includes(String(n).toLowerCase().replace(/\s+/g, ''))); };
const queries = [...new Set([`${gko} 직캠`, `${gko} 직캠 4K`, `${g.en || gko} fancam`, ...extraQ])];
const rows = [];
for (const q of queries) for (const latest of [false, true]) { try { rows.push(...await search(q, latest)); } catch (e) { console.error('검색 실패', q, e.message); } await sleep(1500); }
// 등록된 채널 전부(팬·방송사·공식) — 핸들 소문자로 비교
const reg = new Map();
for (let off = 0; ; off += 1000) { const r = await (await fetch(`${SB}/rest/v1/ext_channels?select=handle,tier,owner_gko&order=handle&limit=1000&offset=${off}`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })).json(); if (!Array.isArray(r)) break; r.forEach(x => reg.set(String(x.handle).toLowerCase(), x)); if (r.length < 1000) break; }
const by = new Map();
for (const r of rows) { if (!r.handle || r.handle.startsWith('channel/') || !hit(r.title)) continue; // 핸들 없는 채널(공식 채널이 이렇게 나온다)은 뺀다
  if ([gko, g.en].filter(Boolean).some(n => norm(r.ch) === norm(n))) continue; // 채널 이름이 그룹 이름 = 공식 채널
  const k = r.handle.toLowerCase();
  if (!by.has(k)) by.set(k, { ...r, vids: new Map() }); by.get(k).vids.set(r.vid, r); }
const cands = [...by.values()].filter(c => !reg.has(c.handle.toLowerCase())).sort((a, b) => b.vids.size - a.vids.size);
const known = [...by.values()].filter(c => reg.has(c.handle.toLowerCase()));
console.log(`\n[${gko}] 검색어 ${queries.length}개 · 영상 ${rows.length}건 · 채널 ${by.size}곳 — 이미 등록 ${known.length}곳, 미등록 후보 ${cands.length}곳\n`);
for (const c of cands) { const v = [...c.vids.values()]; console.log(`${String(v.length).padStart(2)}건  @${c.handle}  (${c.ch})\n       ${v.slice(0, 2).map(x => x.title.slice(0, 70) + (x.pub ? ' · ' + x.pub : '')).join('\n       ')}`); }
if (wantSql) {
  const esc = s => String(s).replace(/'/g, "''"); const pick = cands.filter(c => c.vids.size >= 2);
  console.log(`\n-- 등록 SQL 초안(2건 이상 올린 ${pick.length}곳) — 채널을 열어 그 그룹 전담인지 확인한 뒤 실행. 여러 그룹을 찍는 채널은 빼기.`);
  for (const c of pick) console.log(`insert into public.ext_channels (handle,url,name,tier,owner_gko) values ('${esc(c.handle)}','https://www.youtube.com/@${esc(c.handle)}','${esc(c.ch)}','fans','${esc(gko)}') on conflict (handle) do nothing;`);
}
