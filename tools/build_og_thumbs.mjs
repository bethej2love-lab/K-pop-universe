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

// A안(2026-09-01, 사용자 요청): 대표 썸네일을 "갱신마다 랜덤"으로 돌린다 — 단 예능·커버가 안 걸리게
// MV·라이브(무대)만 후보로. 완전 무작위면 조회수 적은 구석 영상이 걸릴 수 있어, 인기 상위 TOPN개
// 중에서 랜덤으로 뽑아 품질은 지키면서 매번 다른 게 나오게 한다. (mv/live가 하나도 없으면 better()로 폴백)
const ELIGIBLE = new Set(['mv', 'live', 'performance']);
const TOPN = 20;
function randomEligible(cands, fallbackRow) {
  if (cands && cands.length) {
    const top = cands.slice().sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, TOPN);
    return top[Math.floor(Math.random() * top.length)];
  }
  return fallbackRow || null;
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

const groupPick = {};             // 그룹명 → row (mv/live 없을 때 폴백용 best)
const memberPick = {};            // "그룹|이름" → row (폴백)
const memberAny = {};             // "이름" → row  (겸임/타그룹 영상 폴백)
const groupCands = {};            // 그룹명 → [row,...]  MV·라이브·무대 후보(이 중 랜덤)
const memberCands = {};           // "그룹|이름" → [...]
const memberAnyCands = {};        // "이름" → [...]

const gkos = Object.keys(groups);
// ⚠️ 솔로 아티스트는 groups.json에 없다 — 영상의 group_ko가 **본인 이름**이다
// (shared.js `_ytGroupKoFor`: 실존 그룹이면 그룹명, 아니면 a.name.ko). 그래서 groups.json 키만 돌던
// 예전 루프는 솔로 영상을 **한 건도 조회하지 않았고**, 결과적으로 솔로 341명 중 339명의 공유 미리보기가
// 일반 og-image.png로 떨어졌다(2026-09-11 사용자 제보: "솔로 가수는 링크 복사하면 영상 썸네일이 안 뜬다").
// 그룹/그룹멤버는 멀쩡했던 이유도 같다 — 그쪽 키는 groups.json에 있으니까.
const soloKeys = [...new Set(artists.filter(a => a && a.group && a.name && !groups[a.group.ko]).map(a => a.name.ko))];
const soloPick = {};   // "이름" → row (폴백용 best)
const soloCands = {};  // "이름" → [row,...] MV·라이브 후보
const queryKeys = [...gkos.map(k => ({ key: k, solo: false })), ...soloKeys.map(k => ({ key: k, solo: true }))];
console.log(`[og-thumbs] 그룹 ${gkos.length}개 + 솔로 ${soloKeys.length}명 = ${queryKeys.length}키 조회 시작 (키당 최대 ${PER_GROUP}행)`);

let done = 0;
for (const { key: gko, solo } of queryKeys) {
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
    const elig = ELIGIBLE.has(v.category);
    if (solo) {
      // 솔로 카드는 그룹 카드가 아니라 **멤버 페이지**(member/{이름}/)로 공유된다 — groupOut이 아니라
      // 아래 memberOut에서 쓴다. 솔로 영상은 members가 비어 있는 게 정상이라(group_ko 자체가 본인이라
      // 굳이 태깅하지 않는다) members 루프에 기대면 안 되고, 조회 키 자체를 그 사람으로 본다.
      soloPick[gko] = better(soloPick[gko], v);
      if (elig) (soloCands[gko] ??= []).push(v);
    } else {
      groupPick[gko] = better(groupPick[gko], v);
      if (elig) (groupCands[gko] ??= []).push(v);
    }
    for (const mname of (v.members || [])) {
      const k = gko + '|' + mname;
      memberPick[k] = better(memberPick[k], v);
      memberAny[mname] = better(memberAny[mname], v);
      if (elig) { (memberCands[k] ??= []).push(v); (memberAnyCands[mname] ??= []).push(v); }
    }
  }
  if (++done % 40 === 0) console.log(`  … ${done}/${queryKeys.length}`);
}

// 멤버별 최종 선택: 소속 그룹 영상 우선, 없으면 이름 기준 폴백(겸임 멤버가 다른 그룹 영상에만 잡힌 경우)
const memberOut = {};
let memHit = 0, memFallback = 0, memMiss = 0, memSolo = 0;
for (const a of artists) {
  const key = a.group.ko + '|' + a.name.ko;
  // ⚠️ 키는 `a.group.ko|이름`("솔로|아이유") 그대로 둔다 — build_group_pages.js의 ogImageForMember가
  //    정확히 그 형태로 찾는다. 조회만 본인 이름(_ytGroupKoFor)으로 했을 뿐이라 둘을 혼동하면 안 된다.
  const isSolo = !groups[a.group.ko];
  let pick = isSolo ? randomEligible(soloCands[a.name.ko], soloPick[a.name.ko]) : null;
  if (pick) memSolo++;
  if (!pick) { pick = randomEligible(memberCands[key], memberPick[key]); if (pick) memHit++; } // 소속 그룹의 MV/라이브 중 랜덤
  if (!pick) { pick = randomEligible(memberAnyCands[a.name.ko], memberAny[a.name.ko]); if (pick) memFallback++; } // 겸임/타그룹 폴백
  if (!pick) { memMiss++; continue; }
  memberOut[key] = pick.id;
}
const groupOut = {};
for (const gko of gkos) { const p = randomEligible(groupCands[gko], groupPick[gko]); if (p) groupOut[gko] = p.id; }

console.log(`\n[og-thumbs] 그룹 ${Object.keys(groupOut).length}/${gkos.length} · 멤버 ${Object.keys(memberOut).length}/${artists.length} (솔로 본인키 ${memSolo} · 소속영상 ${memHit} · 타그룹폴백 ${memFallback} · 없음 ${memMiss})`);

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

let groupsOut = Object.fromEntries(Object.entries(groupOut).map(([k, v]) => [k, urlFor(v)]));
let membersOut = Object.fromEntries(Object.entries(memberOut).map(([k, v]) => [k, urlFor(v)]));
// --keep-existing: 이미 값이 있는 키는 그대로 두고 **비어 있던 키만** 채운다(2026-09-11).
// 이 스크립트는 매 실행마다 대표 썸네일을 랜덤으로 돌리는 게 기본 동작이라(주간 로테이션), 빠진 곳
// 하나를 메우려고 돌리면 멀쩡한 수백 개까지 싹 바뀐다. 그때 쓰는 플래그.
if (args.includes('--keep-existing') && fs.existsSync(OUT)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    let kept = 0, added = 0;
    for (const [field, next] of [['groups', groupsOut], ['members', membersOut]]) {
      for (const k of Object.keys(next)) {
        if (prev[field] && prev[field][k]) { next[k] = prev[field][k]; kept++; }
        else added++;
      }
      // 이번 실행에서 못 구한 키라도 예전 값이 있으면 남긴다(영상이 일시적으로 조회 안 된 경우 대비)
      for (const k of Object.keys(prev[field] || {})) if (!next[k]) { next[k] = prev[field][k]; kept++; }
    }
    console.log(`[og-thumbs] --keep-existing: 기존 값 ${kept}개 유지 · 새로 채운 키 ${added}개`);
  } catch (e) { console.warn('[og-thumbs] 기존 파일 병합 실패 — 전체 새로 씀:', e.message); }
}
const out = {
  _generated: 'tools/build_og_thumbs.mjs',
  _note: '공유 미리보기용 대표 영상 썸네일(MV·라이브 인기 상위 중 랜덤 — 실행할 때마다 바뀜). build_group_pages.js가 읽는다. 주간 자동갱신: .github/workflows/rotate-og-thumbs.yml · 빠진 곳만 메우려면 --keep-existing',
  groups: groupsOut,
  members: membersOut,
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\n✅ ${path.relative(ROOT, OUT)} 저장 — 그룹 ${Object.keys(out.groups).length} · 멤버 ${Object.keys(out.members).length}`);
