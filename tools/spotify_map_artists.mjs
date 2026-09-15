// 우리 그룹/솔로 ↔ 스포티파이 아티스트 id 매핑 (2026-09-15)
//
// 일일 앨범 수집(spotify_disco_sync.mjs)이 "누구의 신보인지" 알려면 먼저 아티스트를 특정해야 한다.
// 이름 검색은 동명이인·유사명이 흔해서 **그냥 믿으면 안 된다**. 그래서 여기서는 검색만 하지 않고
// 후보마다 **앨범 제목 대조**로 스스로 채점한다:
//
//   우리 데이터엔 이미 그 그룹의 앨범이 평균 수십 장 있다(groups.json). 후보 아티스트의 스포티파이
//   앨범 목록을 받아 제목이 얼마나 겹치는지 보면, 같은 아티스트인지 거의 확실하게 갈린다.
//   이름만 같고 앨범이 하나도 안 겹치면 다른 사람이다. 이 신호는 **우리가 이미 가진 데이터에서
//   공짜로 나오는 것**이라 사람 검수보다 싸고 일관적이다.
//
// 산출물 spotify_artist_map.json은 **레포에 커밋한다** — 매핑이 눈에 보여야 나중에 이상한 수집이
// 생겼을 때 원인을 찾을 수 있고, 매번 다시 검색하지 않아도 된다(검색은 흔들리지만 id는 안 흔들린다).
//
// 사용법:
//   node tools/spotify_map_artists.mjs            # 아직 매핑 안 된 대상만(증분)
//   node tools/spotify_map_artists.mjs --all      # 전부 다시
//   node tools/spotify_map_artists.mjs --only 에스파,아이브
//   node tools/spotify_map_artists.mjs --dry      # 파일 안 쓰고 결과만
//
// ⚠️ 이 도구는 groups.json/artists.json을 **건드리지 않는다**. 매핑 파일만 만든다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, sleep } from './spotify_auth.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_FILE = path.join(ROOT, 'spotify_artist_map.json');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 && process.argv[i + 1] ? new Set(process.argv[i + 1].split(',')) : null; })();

const groups = rd('groups.json');
const artists = rd('artists.json');

// ── 제목 정규화 — 대조의 정확도를 좌우한다 ──────────────────────────────────
// 같은 앨범인데 표기가 갈리는 지점: 공백·구두점, 괄호 안 부제/버전, 대소문자,
// "1st Mini Album" 같은 수식어. 그것들을 걷어낸 뒤 비교한다.
const norm = s => String(s || '')
  .toLowerCase()
  .replace(/\[[^\]]*\]/g, ' ')                  // [Special Edition] 류
  .replace(/\([^)]*\)/g, ' ')                   // (Deluxe), (feat. …)
  .replace(/\b(the\s+)?\d+(st|nd|rd|th)\s+(mini\s+)?album\b/g, ' ')
  .replace(/\b(mini|single|full|repackage|special|deluxe|edition|ver|version)\b/g, ' ')
  .replace(/[^0-9a-z가-힣]/g, '')                // 공백·구두점·이모지 제거
  .trim();

// 우리 데이터의 앨범 제목 집합(대조용)
function ourTitles(names) {
  const set = new Set();
  for (const n of names) {
    const g = groups[n];
    if (g) for (const al of g.discography || []) { const k = norm(al.title); if (k) set.add(k); }
    for (const a of artists) {
      if (!a.name || a.name.ko !== n) continue;
      for (const al of a.discography || []) { const k = norm(al.title); if (k) set.add(k); }
      for (const u of a.unitDiscography || []) for (const al of (u && u.albums) || []) { const k = norm(al.title); if (k) set.add(k); }
    }
  }
  return set;
}

// 후보 아티스트의 앨범 제목(최대 50장이면 대조엔 차고 넘친다)
async function spotifyTitles(id) {
  const j = await api(`/artists/${id}/albums?include_groups=album,single&market=KR&limit=50`);
  return { titles: new Set((j.items || []).map(a => norm(a.name)).filter(Boolean)), total: (j.items || []).length };
}

// ⚠️ 스포티파이 API 제약 (2026-09-15 실측) ─────────────────────────────────────
// 신규 앱의 Client Credentials 토큰으로는 아티스트 객체에서 **followers·genres·popularity가
// 아예 안 온다**. 검색(`/search`)은 물론 상세(`/artists/{id}`)도 마찬가지로 다음 7개 필드만 준다:
//   external_urls, href, id, images, name, type, uri
// 그래서 "팔로워 많은 쪽" "장르가 k-pop인 쪽" 같은 흔한 순위 신호를 쓸 수 없다.
// → 판정을 **앨범 제목 겹침**에 전적으로 건다. 원래도 그게 주 신호였고(이름·장르는 보조), 결과적으로
//   이 제약이 설계를 바꾸지는 않았다. 보조 신호는 이름 일치와 **검색 관련도 순위**로 대체한다.
// (popularity가 없다는 건 나중에 "가장 인기 있는 트랙 = 타이틀곡" 추론도 못 쓴다는 뜻이다.)

// 한 대상(그룹 또는 솔로)에 대해 최적 스포티파이 아티스트를 고른다.
async function resolve(target) {
  const { ko, en, aliases } = target;
  const queries = [...new Set([en, ko, ...(aliases || [])].filter(Boolean))];
  const seen = new Map();                          // id -> {artist, rank} (rank = 검색 관련도 순위)
  for (const q of queries) {
    const j = await api(`/search?q=${encodeURIComponent(q)}&type=artist&market=KR&limit=10`);
    (j.artists?.items || []).forEach((a, idx) => {
      if (!seen.has(a.id)) seen.set(a.id, { a, rank: idx });
      else seen.get(a.id).rank = Math.min(seen.get(a.id).rank, idx); // 여러 질의 중 가장 앞선 순위
    });
    await sleep(60);
  }
  if (!seen.size) return { ko, ok: false, reason: '검색 결과 없음' };

  const mine = ourTitles([ko]);
  // 팔로워를 못 쓰니 **검색 관련도 순서**를 예선으로 쓴다(스포티파이의 순위는 꽤 쓸 만하다 —
  // 실측에서 'aespa' 질의의 1위가 정확히 aespa였다). 상위 8명만 실제 앨범 대조를 한다(호출 절약).
  const cands = [...seen.values()].sort((x, y) => x.rank - y.rank).slice(0, 8);
  const scored = [];
  for (const { a, rank } of cands) {
    const nameHit = queries.some(q => norm(q) === norm(a.name));
    let overlap = 0, spTotal = 0;
    if (mine.size) {
      try { const t = await spotifyTitles(a.id); spTotal = t.total; for (const k of t.titles) if (mine.has(k)) overlap++; }
      catch { /* 이 후보만 대조 실패 — 아래 점수에서 자연히 밀린다 */ }
      await sleep(60);
    }
    // 점수: 앨범 겹침이 압도적으로 중요하다(이름·순위는 겹침이 갈리지 않을 때의 타이브레이커).
    const score = overlap * 100 + (nameHit ? 12 : 0) + Math.max(0, 8 - rank);
    scored.push({ a, overlap, spTotal, nameHit, rank, score });
  }
  scored.sort((x, y) => y.score - x.score);
  const best = scored[0], second = scored[1];
  if (!best) return { ko, ok: false, reason: '후보 없음' };

  // 신뢰도. 겹치는 앨범이 여러 장이면 확실하다. 겹침이 0이면 — 이름이 같아도 — 사람이 봐야 한다.
  // ⚠️ 대조할 우리 앨범이 아예 없는 대상(mine.size===0)은 자동으로 확신할 방법이 없다. 장르로
  //    보강하던 길이 API 제약으로 막혔으므로 정직하게 low로 떨어뜨린다.
  let confidence;
  if (best.overlap >= 3) confidence = 'high';
  else if (best.overlap >= 1) confidence = 'medium';
  else confidence = 'low';

  return {
    ko, ok: true, confidence,
    id: best.a.id, name: best.a.name,
    overlap: best.overlap, ourAlbums: mine.size, spotifyAlbums: best.spTotal, rank: best.rank,
    runnerUp: second ? { id: second.a.id, name: second.a.name, overlap: second.overlap } : null,
  };
}

// ── 대상 목록 ────────────────────────────────────────────────────────────────
// 1) 모든 그룹  2) 그룹에 안 속한 솔로(무소속) 중 디스코가 있는 사람
function targets() {
  const out = [];
  for (const [ko, g] of Object.entries(groups)) out.push({ kind: 'group', ko, en: g.en, aliases: g.altNames });
  for (const a of artists) {
    const ko = a.name?.ko, gko = a.group?.ko;
    if (!ko || !gko || groups[gko]) continue;                     // 실존 그룹 소속은 그룹으로 커버
    if (!((a.discography || []).length || (a.unitDiscography || []).length)) continue;
    out.push({ kind: 'solo', ko, en: a.name?.en, aliases: null, id: a.id });
  }
  return out;
}

const prev = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};
let list = targets();
if (ONLY) list = list.filter(t => ONLY.has(t.ko));
else if (!ALL) list = list.filter(t => !prev[t.ko] || prev[t.ko].confidence === 'low');

console.log(`[map] 대상 ${list.length}명/팀 ${ALL ? '(전체 재매핑)' : ONLY ? '(지정)' : '(증분 — 미매핑 + low만)'}`);

const result = { ...prev };
const stat = { high: 0, medium: 0, low: 0, fail: 0 };
const review = [];
let i = 0;
for (const t of list) {
  i++;
  let r;
  try { r = await resolve(t); }
  catch (e) { r = { ko: t.ko, ok: false, reason: e.message }; }
  if (!r.ok) { stat.fail++; review.push(`${t.ko} — 실패: ${r.reason}`); }
  else {
    stat[r.confidence]++;
    result[t.ko] = {
      id: r.id, spotifyName: r.name, kind: t.kind, confidence: r.confidence,
      // 판단 근거를 같이 남긴다 — 나중에 "이 매핑 왜 이래?"를 파일만 보고 알 수 있어야 한다.
      evidence: { titleOverlap: r.overlap, ourAlbums: r.ourAlbums, spotifyAlbums: r.spotifyAlbums, searchRank: r.rank },
      checkedAt: new Date().toISOString().slice(0, 10),
    };
    if (r.confidence !== 'high') review.push(`${t.ko} [${r.confidence}] → ${r.name} (겹침 ${r.overlap}/우리 ${r.ourAlbums}장)${r.runnerUp ? ` · 차순위 ${r.runnerUp.name}(겹침 ${r.runnerUp.overlap})` : ''}`);
  }
  if (i % 25 === 0 || i === list.length) console.log(`  ${i}/${list.length} · high ${stat.high} · medium ${stat.medium} · low ${stat.low} · 실패 ${stat.fail}`);
}

console.log(`\n[map] 결과 — high ${stat.high} · medium ${stat.medium} · low ${stat.low} · 실패 ${stat.fail}`);
if (review.length) {
  console.log(`\n사람이 봐야 할 것 ${review.length}건:`);
  review.slice(0, 60).forEach(s => console.log('  · ' + s));
  if (review.length > 60) console.log(`  · … 외 ${review.length - 60}건`);
}
if (DRY) { console.log('\n[--dry] 파일은 쓰지 않았습니다.'); }
else {
  // 키 정렬해서 저장 — diff가 읽히게(매핑이 바뀐 줄만 보이도록)
  const sorted = {};
  for (const k of Object.keys(result).sort()) sorted[k] = result[k];
  fs.writeFileSync(MAP_FILE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`\n저장: spotify_artist_map.json (${Object.keys(sorted).length}건)`);
}
