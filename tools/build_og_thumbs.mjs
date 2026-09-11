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
// ⚠️ 커버 무대는 대표 썸네일로 쓰지 않는다(2026-09-11, 사용자 제보로 발견).
// 태연의 공유 미리보기가 **성한빈이 태연 곡 'INVU'를 부른 영상**이었다 — 그 행은 `group_ko='태연'`,
// `members=['태연']`로 **태깅 자체가 틀려 있고**(공연자는 성한빈, 원곡자가 공연자 자리에 들어감),
// 그래서 이 스크립트 입장에선 "태연 영상"으로 보였다. 태깅 오배정은 별도로 다뤄야 할 문제지만,
// 그게 고쳐지기 전에도 **대표 이미지가 남의 무대가 되는 일은 막아야 한다**.
// 제목에 원곡 크레딧이 있거나 cover_of_*가 붙은 행은 후보에서 뺀다 — 자기 곡을 자기가 부른 정상
// 커버여도(CORTIS의 JoyRide 등) 대표 이미지로는 MV·직캠이 낫고, 후보는 어차피 넉넉하다.
const COVER_CREDIT = /원곡|\bcover(ed)?\b|original\s+(song\s+)?by|歌ってみた/i;
const isCoverish = v => COVER_CREDIT.test(v.title || '')
  || (v.cover_of_members || []).length > 0 || (v.cover_of_groups || []).length > 0;
const dirtyIds = new Set(); // 예전 캐시가 이런 영상을 물고 있으면 --keep-existing이어도 새로 뽑는다

const soloKeys = [...new Set(artists.filter(a => a && a.group && a.name && !groups[a.group.ko]).map(a => a.name.ko))];
const soloPick = {};   // "이름" → row (폴백용 best)
const soloCands = {};  // "이름" → [row,...] MV·라이브 후보
const queryKeys = [...gkos.map(k => ({ key: k, solo: false })), ...soloKeys.map(k => ({ key: k, solo: true }))];
console.log(`[og-thumbs] 그룹 ${gkos.length}개 + 솔로 ${soloKeys.length}명 = ${queryKeys.length}키 조회 시작 (키당 최대 ${PER_GROUP}행)`);

let done = 0;
for (const { key: gko, solo } of queryKeys) {
  const q = new URLSearchParams({
    select: 'id,title,category,members,view_count,published_at,content_flag,cover_of_members,cover_of_groups',
    group_ko: 'eq.' + gko,
    order: 'published_at.desc',
    limit: String(PER_GROUP),
  });
  let rows = [];
  try { rows = await fetchJson(SB + '?' + q); } catch (e) { console.warn(`  ! ${gko} 조회 실패: ${e.message}`); }
  for (const v of rows) {
    if (!v.id) continue;
    if (v.content_flag === 'hidden' || v.content_flag === 'irrelevant') continue; // 숨김/무관 처리분 제외
    if (isCoverish(v)) { dirtyIds.add(v.id); continue; } // 커버 무대는 대표 썸네일 후보에서 제외(위 주석)
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

// ── 이름 키(솔로 활동분) 배치 조회 ──────────────────────────────────────────────
// ⚠️ 솔로 아티스트만의 문제가 아니다. **그룹에 속한 멤버도 솔로 활동 영상은 group_ko가 본인 이름**이다
//    (솔로 규약 — 태연·화사·지코처럼 병행하는 사람이 많다. CHANGELOG의 DECISIONS 실측: 병행 1,009명
//    ·솔로 키 영상 14,193건). 위 루프는 groups.json 키 + 소속이 없는 솔로만 돌아서 그 행들을 못 본다.
//    실제 피해: 태연의 공유 썸네일이 **성한빈이 태연 곡을 부른 영상**(group_ko='태연'으로 오배정된 행)
//    이었는데, 그 행이 조회조차 안 되니 커버 가드에도 안 걸려 교체되지 않았다(2026-09-11).
// ⚠️ 전 아티스트(1,700여 명)의 이름 키를 매번 조회하면 너무 느리다 — `group_ko=in.(…)`로 묶어봐도
//    이 컬럼 조건은 인덱스를 제대로 못 타서 실측 12분을 넘겨 중단했다(2026-09-11). 그래서 **검증 우선**
//    방식으로 바꿨다: 기존 캐시가 물고 있는 영상 id를 **PK로** 한 번에 조회해(빠르다) 커버인지 보고,
//    오염된 키의 주인만 이름 키로 재조회한다. 실제로 고쳐야 할 사람은 수십 명 수준이다.
const prevForAudit = (() => {
  try { return fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null; } catch (e) { return null; }
})();
if (prevForAudit) {
  const idOfUrl = url => (String(url || '').match(/\/vi\/([\w-]+)\//) || [])[1];
  const idToKeys = new Map(); // 영상 id → ["members|소녀시대|태연", …]
  for (const field of ['groups', 'members']) {
    for (const [k, url] of Object.entries(prevForAudit[field] || {})) {
      const id = idOfUrl(url); if (!id) continue;
      if (!idToKeys.has(id)) idToKeys.set(id, []);
      idToKeys.get(id).push(field + '|' + k);
    }
  }
  const ids = [...idToKeys.keys()];
  console.log(`[og-thumbs] 기존 캐시 ${ids.length}개 영상을 PK로 검증(커버 무대 가려내기)`);
  const reQuery = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    let rows = [];
    try { rows = await fetchJson(SB + '?' + new URLSearchParams({ select: 'id,title,cover_of_members,cover_of_groups', id: 'in.(' + batch.join(',') + ')', limit: '200' })); }
    catch (e) { console.warn(`  ! 캐시 검증 배치 실패: ${e.message}`); continue; }
    for (const v of rows) {
      if (!isCoverish(v)) continue;
      dirtyIds.add(v.id);
      for (const key of (idToKeys.get(v.id) || [])) {
        const name = key.startsWith('members|') ? key.split('|').pop() : null; // "members|소녀시대|태연" → 태연
        if (name && !groups[name]) reQuery.add(name);
      }
    }
  }
  console.log(`  커버로 판정된 기존 캐시 ${dirtyIds.size}개 · 재조회할 인물 ${reQuery.size}명`);
  // 오염된 키의 주인만 이름 키(솔로 활동분)로 다시 훑는다 — 그 사람 영상이 거기 있기 때문.
  let rq = 0;
  for (const name of reQuery) {
    const q = new URLSearchParams({
      select: 'id,title,category,members,view_count,published_at,content_flag,cover_of_members,cover_of_groups',
      group_ko: 'eq.' + name, order: 'published_at.desc', limit: String(PER_GROUP),
    });
    let rows = [];
    try { rows = await fetchJson(SB + '?' + q); } catch (e) { console.warn(`  ! ${name} 재조회 실패: ${e.message}`); continue; }
    for (const v of rows) {
      if (!v.id) continue;
      if (v.content_flag === 'hidden' || v.content_flag === 'irrelevant') continue;
      if (isCoverish(v)) { dirtyIds.add(v.id); continue; }
      soloPick[name] = better(soloPick[name], v);
      if (ELIGIBLE.has(v.category)) (soloCands[name] ??= []).push(v);
    }
    if (++rq % 20 === 0) console.log(`  … 재조회 ${rq}/${reQuery.size}`);
  }
}

// 멤버별 최종 선택: 소속 그룹 영상 우선, 없으면 이름 기준 폴백(겸임 멤버가 다른 그룹 영상에만 잡힌 경우)
const memberOut = {};
let memHit = 0, memFallback = 0, memMiss = 0, memSolo = 0;
for (const a of artists) {
  const key = a.group.ko + '|' + a.name.ko;
  // ⚠️ 키는 `a.group.ko|이름`("솔로|아이유") 그대로 둔다 — build_group_pages.js의 ogImageForMember가
  //    정확히 그 형태로 찾는다. 조회만 본인 이름(_ytGroupKoFor)으로 했을 뿐이라 둘을 혼동하면 안 된다.
  const isSolo = !groups[a.group.ko];
  // 솔로 아티스트는 본인 이름 키가 곧 본인 영상이라 1순위. 그룹 멤버는 소속 그룹 영상이 더 대표적이라
  // 그쪽이 1순위이고, 본인 이름 키(솔로 활동분)는 그다음 — 둘 다 "본인이 나온 영상"이므로 이름만
  // 같으면 걸리는 memberAny 폴백보다는 앞에 둔다.
  let pick = isSolo ? randomEligible(soloCands[a.name.ko], soloPick[a.name.ko]) : null;
  if (pick) memSolo++;
  if (!pick) { pick = randomEligible(memberCands[key], memberPick[key]); if (pick) memHit++; } // 소속 그룹의 MV/라이브 중 랜덤
  if (!pick && !isSolo) { pick = randomEligible(soloCands[a.name.ko], soloPick[a.name.ko]); if (pick) memSolo++; } // 그룹 멤버의 솔로 활동분
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
    let kept = 0, added = 0, replaced = 0;
    // 예전 값이 "커버 무대"를 물고 있으면 유지하지 않는다 — 그게 태연이 성한빈 무대로 떠 있던 이유다.
    const idOf = url => (String(url || '').match(/\/vi\/([\w-]+)\//) || [])[1];
    const isDirty = url => { const id = idOf(url); return !!id && dirtyIds.has(id); };
    for (const [field, next] of [['groups', groupsOut], ['members', membersOut]]) {
      for (const k of Object.keys(next)) {
        const old = prev[field] && prev[field][k];
        if (old && !isDirty(old)) { next[k] = old; kept++; }
        else if (old) replaced++;   // 커버를 물고 있던 키 → 이번에 새로 뽑은 값으로 교체
        else added++;
      }
      // 이번 실행에서 못 구한 키라도 예전 값이 있으면 남긴다(영상이 일시적으로 조회 안 된 경우 대비).
      // 단 커버를 물고 있던 값이면 차라리 비워서 기본 이미지로 — 남의 무대를 대표로 두는 것보다 낫다.
      for (const k of Object.keys(prev[field] || {})) {
        if (next[k]) continue;
        if (isDirty(prev[field][k])) { replaced++; continue; }
        next[k] = prev[field][k]; kept++;
      }
    }
    console.log(`[og-thumbs] --keep-existing: 기존 값 ${kept}개 유지 · 새로 채운 키 ${added}개 · 커버라서 교체 ${replaced}개`);
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
