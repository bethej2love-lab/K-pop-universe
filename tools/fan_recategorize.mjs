// 팬채널 영상 category='fan' 재분류 SQL 생성 (2026-09-01)
//
// 문제: tier='fans' 팬채널 영상이 이미 동기화됐지만 category가 'other'/'live'로 들어가(동기화가 내용
// 기준 분류) 'fan'이 아니라서 카드 "by {팬덤}" 탭이 안 뜬다. source_handle이 비어 있어 DB만으로는
// 어떤 영상이 팬채널 것인지 못 고른다 → 유튜브에서 팬채널의 실제 업로드 영상 ID를 가져와 그 ID들만
// category='fan'으로 UPDATE 한다(다른 태깅·컬럼은 안 건드림). 재동기화는 ignoreDuplicates라 category가
// 안 바뀌므로 이 경로가 필요.
//
// 실행: node tools/fan_recategorize.mjs   → fan_recategorize.sql 생성(회사가 Supabase서 실행)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const U = 'https://dukgguehegnembimqvkm.supabase.co';
const K = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 공개 anon(읽기)
const H = { apikey: K, Authorization: `Bearer ${K}` };
const curl = (u, opts = []) => { try { return execFileSync('curl', ['-sL', '-m', '20', '-A', 'Mozilla/5.0', ...opts, u], { maxBuffer: 1 << 27, encoding: 'utf8' }); } catch (e) { return ''; } };

// 채널 핸들 → 전체 업로드 영상 ID (youtubei 연속 페이지)
function channelUploads(handle) {
  const page = curl(`https://www.youtube.com/@${handle}/videos`);
  const key = (page.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
  const ids = new Set();
  [...page.matchAll(/"videoId":"([\w-]{11})"/g)].forEach(m => ids.add(m[1]));
  let tok = (page.match(/"continuationCommand":\{"token":"([^"]+)"/) || [])[1];
  for (let p = 0; p < 40 && tok && key; p++) {
    const body = JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00' } }, continuation: tok });
    const res = curl(`https://www.youtube.com/youtubei/v1/browse?key=${key}`, ['-X', 'POST', '-H', 'Content-Type: application/json', '-d', body]);
    const before = ids.size;
    [...res.matchAll(/"videoId":"([\w-]{11})"/g)].forEach(m => ids.add(m[1]));
    tok = (res.match(/"continuationCommand":\{"token":"([^"]+)"/) || [])[1];
    if (ids.size === before) break; // 새 영상 없으면 끝
    execFileSync('sleep', ['0.4']);
  }
  return [...ids];
}

// DB에서 이 ID들의 현재 상태(존재/카테고리) 조회
async function dbState(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const url = `${U}/rest/v1/yt_channel_videos?id=in.(${slice.map(x => `"${x}"`).join(',')})&select=id,category,group_ko`;
    const r = await fetch(url, { headers: H });
    if (r.ok) out.push(...await r.json());
  }
  return out;
}

const chans = await (await fetch(`${U}/rest/v1/ext_channels?tier=eq.fans&select=handle,name,owner_gko,owner_mko`, { headers: H })).json();
console.log(`팬채널 ${chans.length}개:`, chans.map(c => '@' + c.handle).join(', '));

const toUpdate = new Set();
for (const c of chans) {
  const ids = channelUploads(c.handle);
  const state = await dbState(ids);
  const inDb = new Set(state.map(v => v.id));
  const notFan = state.filter(v => v.category !== 'fan');
  notFan.forEach(v => toUpdate.add(v.id));
  const catDist = {};
  state.forEach(v => { catDist[v.category || 'null'] = (catDist[v.category || 'null'] || 0) + 1; });
  console.log(`\n@${c.handle} (${c.owner_mko || c.owner_gko}) — 유튜브 ${ids.length}개 · DB존재 ${inDb.size} · fan아님 ${notFan.length}`);
  console.log('  현재 카테고리:', JSON.stringify(catDist));
}

// SQL 생성 — category만 'fan'으로(다른 컬럼 불변). id 200개씩 나눠 IN.
const ids = [...toUpdate];
let sql = `-- 팬채널 영상 category='fan' 재분류 (${new Date().toISOString().slice(0, 10)})\n`
  + `-- 등록된 tier='fans' 채널들의 실제 업로드 영상(유튜브에서 수집) 중 아직 'fan'이 아닌 것만 category='fan'으로.\n`
  + `-- ⚠️ category 컬럼만 바꾼다(members·content_flag 등 태깅은 안 건드림). 대상 ${ids.length}건.\n`
  + `-- 재실행 안전(이미 'fan'이면 조건에서 빠짐).\n\n`;
for (let i = 0; i < ids.length; i += 200) {
  const slice = ids.slice(i, i + 200);
  sql += `UPDATE yt_channel_videos SET category='fan' WHERE category IS DISTINCT FROM 'fan' AND id IN (${slice.map(x => `'${x}'`).join(',')});\n`;
}
sql += `\n-- 확인: SELECT count(*) FROM yt_channel_videos WHERE category='fan';  -- ${ids.length} 이상이어야 함\n`;
fs.writeFileSync(path.join(ROOT, 'fan_recategorize.sql'), sql);
console.log(`\n✅ fan_recategorize.sql 생성 — 총 ${ids.length}건 category='fan'으로 바꿀 UPDATE`);
