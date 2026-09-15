// 스포티파이 ↔ 우리 디스코그래피 변환·대조 공용 로직 (2026-09-15)
//
// 매핑 도구(spotify_map_artists.mjs)와 일일 수집(spotify_disco_sync.mjs)이 같은 규칙을 써야 해서
// 여기로 모았다. 규칙이 갈리면 "매핑은 맞다는데 수집이 딴 앨범을 가져오는" 상태가 된다.
//
// ⚠️ 설계를 지배하는 제약은 **호출 횟수**다(tools/spotify_auth.mjs 머리 주석의 실측 참고).
//    그래서 발견은 `/artists/{id}/albums`(하루 ~100회면 24시간 잠김)가 아니라
//    `/search?type=album`(같은 시각에 멀쩡했던 엔드포인트)으로 한다. 아티스트당 1회면 된다.

import { api } from './spotify_auth.mjs';

// ── 제목 정규화 ──────────────────────────────────────────────────────────────
// 스포티파이의 한국 발매 제목은 "본제목 - The Nth Mini Album" 꼴이 흔하다(실측: `LEMONADE - The 2nd
// Album`, `Whiplash - The 5th Mini Album`). 우리 데이터는 본제목만 갖고 있으므로 꼬리를 떼야 맞는다.
// 이건 단순한 정리가 아니라 **집 번호의 출처**이기도 하다 — parseTypeFromTitle이 같은 꼬리를 읽는다.
export const stripSuffix = s => String(s || '')
  .replace(/\s*[-–—]\s*(the\s+)?\d+(st|nd|rd|th)\s+(mini\s+)?album.*$/i, '')
  .replace(/\s*[-–—]\s*(the\s+)?(1st|first)\s+(mini\s+)?album.*$/i, '')
  .replace(/\s*[-–—]\s*\d{0,4}\s*special\s+(digital\s+)?single.*$/i, '')
  .replace(/\s*[-–—]\s*(the\s+)?\d+(st|nd|rd|th)\s+single(\s+album)?.*$/i, '')
  .trim();

export const norm = s => stripSuffix(s).toLowerCase()
  .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
  .replace(/\b(mini|single|full|repackage|special|deluxe|edition|ver|version)\b/g, ' ')
  .replace(/[^0-9a-z가-힣]/g, '').trim();

// ── 변형판 걸러내기 ──────────────────────────────────────────────────────────
// 스포티파이는 한 발매를 여러 엔트리로 쪼개 놓는다. 실측(에스파 58장)에서 본 것들:
//   LEMONADE - The 2nd Album (WINTER Special Version)   ← 멤버별 스페셜 4장
//   LEMONADE (Zedd Remix) / (2Spade Remix) / (Zedd Extended Mix)
//   Whiplash (English Version) / Rich Man (English Version)
//   Rich Man (Remixes) / Dirty Work (Remixes)
// 이걸 그대로 넣으면 디스코그래피가 리믹스로 도배된다. 우리 데이터는 멜론 기준의 "발매 단위"라
// 이런 변형판은 애초에 없다 — 그 성격을 유지한다.
const VARIANT = /(english\s+ver|japanese\s+ver|chinese\s+ver|inst\.?\b|instrumental|remix|mix\)|acoustic\s+ver|sped\s+up|slowed|special\s+version|a\s+cappella)/i;
export const isVariant = name => VARIANT.test(String(name || ''));

// ── 앨범 타입 ────────────────────────────────────────────────────────────────
// 우리 스키마의 type은 "정규 2집" "미니 5집" "싱글"처럼 **집 번호까지** 들어간다. 스포티파이의
// album_type(album/single/compilation)으로는 절대 만들 수 없다 — 실측상 6트랙짜리 미니앨범
// `Rich Man - The 6th Mini Album`이 album_type=single로 온다. 즉 album_type은 믿을 수 없다.
// 다행히 **제목 꼬리에 정답이 적혀 있다**. 거기서 못 읽으면 트랙 수로 보수적으로 떨어뜨린다.
const ORD = { '1': 1, '2': 2, '3': 3 };
export function parseTypeFromTitle(name, totalTracks, albumType) {
  const m = /[-–—]\s*(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+(mini\s+)?album/i.exec(String(name || ''));
  if (m) return `${m[2] ? '미니' : '정규'} ${Number(m[1])}집`;
  if (/[-–—]\s*(?:the\s+)?(?:1st|first)\s+(mini\s+)?album/i.test(name)) return /mini/i.test(name) ? '미니 1집' : '정규 1집';
  if (/special\s+(digital\s+)?single/i.test(name)) return '싱글';
  // 꼬리가 없을 때: 트랙 수로 본다. 멜론 관행상 1~3트랙은 싱글, 그 이상은 미니로 보는 게 무난하다.
  // 번호는 **붙이지 않는다** — 근거 없이 "미니 7집"이라고 적으면 나중에 사람이 고치기가 더 어렵다.
  if ((totalTracks || 0) <= 3) return '싱글';
  if (albumType === 'album' || (totalTracks || 0) >= 7) return '정규';
  return '미니';
}

// ── 앨범 검색(발견) ──────────────────────────────────────────────────────────
// `artist:` + `year:` 필터. 아티스트 id로 한 번 더 걸러 동명이인을 막는다(검색의 artist: 필터는
// 이름 기반이라 그것만 믿으면 안 된다 — 앨범 객체에 artists[].id가 같이 오는 게 다행이다).
export async function searchAlbums(artistName, year, artistId) {
  const q = `artist:${artistName} year:${year}`;
  const j = await api(`/search?q=${encodeURIComponent(q)}&type=album&market=KR&limit=10`);
  const items = j.albums?.items || [];
  return artistId ? items.filter(a => (a.artists || []).some(x => x.id === artistId)) : items;
}

// ── 아티스트 해석(매핑) ──────────────────────────────────────────────────────
// 호출을 아끼는 게 목적이라 단계적으로 간다:
//   1) 아티스트 검색 1회. 정규화한 이름이 정확히 일치하는 후보가 **딱 하나면** 그걸로 끝(1콜).
//   2) 0개거나 2개 이상이면 그때만 앨범 대조로 가른다(후보당 1콜, 최대 3명).
// 예전 설계는 무조건 후보 8명을 전부 앨범 대조했는데(11콜/대상), 388대상이면 4천 콜이라 못 쓴다.
// ⚠️ ourYears가 핵심이다. 처음엔 대조 연도를 "올해/작년"으로 잡았는데 **전부 겹침 0으로 나왔다**
//    — 당연하다. 우리 데이터에 올해 앨범이 없는 게 수집을 만드는 이유인데, 없는 연도로 대조하면
//    정답 아티스트도 0으로 떨어진다(실측: 에스파·펜타곤 둘 다 오탐). 대조는 **우리가 실제로 앨범을
//    갖고 있는 연도**로 해야 한다. 그래서 호출부가 ourYears(최신 발매 연도부터)를 넘긴다.
export async function resolveArtist({ names, ourTitles, ourYears, verifyMax = 3 }) {
  const queries = [...new Set(names.filter(Boolean))];
  const seen = new Map();
  let calls = 0;
  for (const q of queries) {
    const j = await api(`/search?q=${encodeURIComponent(q)}&type=artist&market=KR&limit=10`);
    calls++;
    (j.artists?.items || []).forEach((a, i) => {
      if (!seen.has(a.id)) seen.set(a.id, { a, rank: i });
      else seen.get(a.id).rank = Math.min(seen.get(a.id).rank, i);
    });
    if (seen.size) break; // 첫 질의(보통 영문명)에서 결과가 나오면 추가 질의를 안 한다 — 콜 절약
  }
  if (!seen.size) return { ok: false, reason: '검색 결과 없음', calls };

  const cands = [...seen.values()].sort((x, y) => x.rank - y.rank);
  const exact = cands.filter(c => queries.some(q => norm(q) === norm(c.a.name)));

  if (exact.length === 1) {
    const c = exact[0];
    // 이름이 유일하게 일치 = 대개 정답. 다만 앨범 대조를 안 했으므로 확신은 medium으로 남긴다
    // (첫 수집 때 겹침이 0으로 나오면 그때 드러난다 — 아래 sync가 그걸 보고한다).
    return { ok: true, id: c.a.id, name: c.a.name, confidence: 'medium', overlap: null, calls, why: '이름 유일 일치' };
  }

  // 모호한 경우에만 앨범 대조. 이름 일치 후보를 먼저, 없으면 검색 상위 순.
  const toCheck = (exact.length ? exact : cands).slice(0, verifyMax);
  const years = (ourYears && ourYears.length ? ourYears : [new Date().getFullYear()]).slice(0, 2);
  let best = null;
  for (const c of toCheck) {
    let overlap = 0;
    try {
      for (const y of years) {
        const items = await searchAlbums(c.a.name, y, c.a.id);
        calls++;
        for (const al of items) if (ourTitles.has(norm(al.name))) overlap++;
        if (overlap >= 2) break;
      }
    } catch { /* 이 후보만 실패 — 점수에서 밀린다 */ }
    const score = overlap * 100 + Math.max(0, 8 - c.rank);
    if (!best || score > best.score) best = { c, overlap, score };
  }
  if (!best) return { ok: false, reason: '후보 없음', calls };
  const confidence = best.overlap >= 2 ? 'high' : best.overlap >= 1 ? 'medium' : 'low';
  return { ok: true, id: best.c.a.id, name: best.c.a.name, confidence, overlap: best.overlap, calls, why: exact.length > 1 ? `동명 후보 ${exact.length}명 중 앨범 대조` : '이름 불일치 — 앨범 대조' };
}

// ── 앨범 상세 → 우리 스키마 엔트리 ───────────────────────────────────────────
// 우리 스키마: {title, type, isMain, cover, releaseDate, trackCount, titleTrack, tracks[{no,title,isTitle}]}
// ⚠️ titleTrack은 스포티파이가 안 알려준다. 원래는 트랙 popularity로 추론하려 했는데 신규 앱엔
//    popularity 필드가 아예 안 와서 그 길이 막혔다. 그래서 **근거가 있는 두 경우만** 채운다:
//      ① 트랙이 1개면 자명하다(신보 대부분이 여기 해당 — 우리 2,457장 중 742장이 싱글)
//      ② 앨범 제목과 같은 트랙이 딱 하나 있으면 그게 타이틀곡이다. K팝에서 앨범명=타이틀곡명은
//         거의 규칙에 가깝다(실측: 샤이니 `Atmos` 1번 트랙이 `Atmos`, aespa `LEMONADE`도 동일).
//         "딱 하나"를 요구하는 게 중요하다 — 같은 이름이 둘이면(Inst. 등) 근거가 안 된다.
//    그 외에는 null로 두고 리뷰 목록에 올린다. 근거 없이 1번 트랙을 타이틀로 박으면 틀린 값이
//    조용히 굳는다(이 프로젝트에서 반복된 실패 모드다).
export async function toEntry(album) {
  const full = await api(`/albums/${album.id}?market=KR`);
  const tracks = (full.tracks?.items || []).map(t => ({ no: t.track_number, title: t.name, isTitle: false }));
  const title = stripSuffix(album.name);
  let one = tracks.length === 1 ? tracks[0] : null;
  if (!one) {
    const k = norm(title);
    const same = tracks.filter(t => norm(t.title) === k);
    if (k && same.length === 1) one = same[0];
  }
  if (one) one.isTitle = true;
  return {
    entry: {
      title,
      type: parseTypeFromTitle(album.name, album.total_tracks, album.album_type),
      isMain: true,
      cover: (album.images && album.images[0] && album.images[0].url) || null,
      releaseDate: String(album.release_date || '').slice(0, 10).replace(/-/g, '.'),
      trackCount: album.total_tracks || tracks.length,
      titleTrack: one ? one.title : null,
      tracks,
      src: 'spotify',            // 출처 표식 — 나중에 자동 수집분만 감사할 수 있게
      spotifyId: album.id,
    },
    needsTitleTrack: !one,
    precision: album.release_date_precision,
  };
}
