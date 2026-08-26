// 공유 미리보기(og:image)용 대표 영상 썸네일 수집기 (2026-08-26)
//
// 왜: 정적 SEO 페이지의 og:image가 groups.json/artists.json의 songs[0]에서만 나오는데 그 필드가
// 그룹 14개·아티스트 56명에만 있어서, 그룹 페이지 96%·멤버 페이지 97%가 전부 같은 일반 이미지로
// 폴백하고 있었다. 영상은 전부 Supabase에 있으므로 여기서 그룹/멤버별 대표 영상을 골라
// og_thumbs.json에 캐시하고, build_group_pages.js가 그걸 읽어 쓴다.
//
// 왜 캐시로 분리했나: SEO 리빌드 Action(rebuild-seo-pages.yml)은 데이터가 바뀔 때마다 도는데,
// 거기서 매번 DB를 37만 행 뒤지면 느리고 네트워크 장애에 취약해진다. 수집은 가끔 수동으로 돌리고
// 빌드는 캐시만 읽는다.
//
// 실행: node tools/build_og_thumbs.mjs [--limit N] [--no-probe]
//   --no-probe : maxresdefault 존재 확인(HEAD)을 건너뛰고 hqdefault로 고정(빠름)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 앱에 이미 공개돼 있는 anon 키
const OUT = path.join(ROOT, 'og_thumbs.json');

const args = process.argv.slice(2);
const PER_GROUP = Number((args.find(a => a.startsWith('--limit=')) || '').split('=')[1]) || 1500;
const PROBE = !args.includes('--no-probe');

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

// 대표성 우선순위: 뮤비 > 무대/직캠 > 그 외. 같은 등급이면 조회수, 조회수 없으면 최신순.
const CAT_RANK = { mv: 0, live: 1, performance: 1, dance: 2, cover: 3, variety: 4, show: 4 };
const rank = v => (CAT_RANK[v.category] ?? 5);
function better(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? a : b;
  const av = a.view_count || 0, bv = b.view_count || 0;
  if (av !== bv) return av > bv ? a : b;
  return (a.published_at || '') >= (b.published_at || '') ? a : b;
}

async function fetchJson(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise(r => setTimeout(r, 400 * attempt));
    }
  }
}

const groupPick = {};             // 그룹명 → row
const memberPick = {};            // "그룹|이름" → row
const memberAny = {};             // "이름" → row  (겸임/타그룹 영상 폴백)

const gkos = Object.keys(groups);
console.log(`[og-thumbs] 그룹 ${gkos.length}개 조회 시작 (그룹당 최대 ${PER_GROUP}행)`);

let done = 0;
for (const gko of gkos) {
  const q = new URLSearchParams({
    select: 'id,category,members,view_count,published_at,content_flag',
    group_ko: 'eq.' + gko,
    order: 'published_at.desc',
    limit: String(PER_GROUP),
  });
  let rows = [];
  try { rows = await fetchJson(SB + '?' + q); } catch (e) { console.warn(`  ! ${gko} 조회 실패: ${e.message}`); }
  for (const v of rows) {
    if (!v.id) continue;
    if (v.content_flag === 'hidden' || v.content_flag === 'irrelevant') continue; // 숨김/무관 처리분 제외
    groupPick[gko] = better(groupPick[gko], v);
    for (const mname of (v.members || [])) {
      const k = gko + '|' + mname;
      memberPick[k] = better(memberPick[k], v);
      memberAny[mname] = better(memberAny[mname], v);
    }
  }
  if (++done % 40 === 0) console.log(`  … ${done}/${gkos.length}`);
}

// 멤버별 최종 선택: 소속 그룹 영상 우선, 없으면 이름 기준 폴백(겸임 멤버가 다른 그룹 영상에만 잡힌 경우)
const memberOut = {};
let memHit = 0, memFallback = 0, memMiss = 0;
for (const a of artists) {
  const key = a.group.ko + '|' + a.name.ko;
  const pick = memberPick[key] || memberAny[a.name.ko];
  if (!pick) { memMiss++; continue; }
  if (memberPick[key]) memHit++; else memFallback++;
  memberOut[key] = pick.id;
}
const groupOut = {};
for (const gko of gkos) if (groupPick[gko]) groupOut[gko] = groupPick[gko].id;

console.log(`\n[og-thumbs] 그룹 ${Object.keys(groupOut).length}/${gkos.length} · 멤버 ${Object.keys(memberOut).length}/${artists.length} (소속영상 ${memHit} · 타그룹폴백 ${memFallback} · 없음 ${memMiss})`);

// maxresdefault(1280×720)가 있으면 그걸, 없으면 hqdefault(480×360)
const ids = [...new Set([...Object.values(groupOut), ...Object.values(memberOut)])];
const maxres = {};
if (PROBE) {
  console.log(`[og-thumbs] maxresdefault 존재 확인 ${ids.length}건…`);
  let i = 0, ok = 0;
  const worker = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        const r = await fetch(`https://img.youtube.com/vi/${id}/maxresdefault.jpg`, { method: 'HEAD' });
        if (r.ok) { maxres[id] = true; ok++; }
      } catch (e) { /* 실패 시 hqdefault로 */ }
    }
  };
  await Promise.all(Array.from({ length: 24 }, worker));
  console.log(`  maxres 사용 가능 ${ok}/${ids.length} (${(ok / ids.length * 100).toFixed(0)}%)`);
}
const urlFor = id => `https://img.youtube.com/vi/${id}/${maxres[id] ? 'maxresdefault' : 'hqdefault'}.jpg`;

const out = {
  _generated: 'tools/build_og_thumbs.mjs',
  _note: '공유 미리보기용 대표 영상 썸네일. build_group_pages.js가 읽는다. 갱신하려면 이 스크립트를 다시 실행.',
  groups: Object.fromEntries(Object.entries(groupOut).map(([k, v]) => [k, urlFor(v)])),
  members: Object.fromEntries(Object.entries(memberOut).map(([k, v]) => [k, urlFor(v)])),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\n✅ ${path.relative(ROOT, OUT)} 저장 — 그룹 ${Object.keys(out.groups).length} · 멤버 ${Object.keys(out.members).length}`);
