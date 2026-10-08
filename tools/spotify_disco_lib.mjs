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
  // 맨 꼬리표 `- EP` / `- Single` / `- Album` (2026-09-16). 우리는 종류를 배지로 따로 표기하므로
  // 제목에 또 들어가면 중복이고, 무엇보다 **dedupKey가 달라져 같은 앨범이 두 번 들어온다** —
  // 실제로 베이비복스 `NEW BABY VOX 2025 : THE BEST OF BEST`가 멜론분(`… - EP`)과 스포티파이분으로
  // 두 장이 돼 있었다. 기존 데이터 287건도 같은 규칙으로 한 번 정리했다.
  // ⚠️ 대시 **앞의 공백을 필수**로 둔다. 없으면 `2016 Re-ALBUM`이 `2016 Re`로 잘린다(실측 오탐 1건).
  .replace(/\s+[-–—]\s*(EP|Single|Album)\s*$/i, '')
  .trim();

export const norm = s => stripSuffix(s).toLowerCase()
  .replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ')
  .replace(/\b(mini|single|full|repackage|special|deluxe|edition|ver|version)\b/g, ' ')
  .replace(/[^0-9a-z가-힣]/g, '').trim();

// ── 중복 판정 키 ────────────────────────────────────────────────────────────
// ⚠️ norm()을 중복 판정에 그대로 쓰면 안 된다(2026-09-15). 괄호를 통째로 지우므로
//    `What You Want`와 `What You Want (feat. Teezo Touchdown)`가 **둘 다 whatyouwant**가 되고,
//    회차가 갈리면(코르티스 실제 사례: 원곡 8/18, feat.판 8/22) 나중에 나온 feat.판이
//    "이미 있음"으로 조용히 버려진다. feat.판은 우리 데이터에 49장 있는 정식 별도 발매다.
//    같은 뿌리의 버그를 toEntry의 타이틀곡 판정에서 먼저 고쳤는데(원문 우선 비교) 여기 남아 있었다.
// feat./with 부분만 키에 되살린다 — `(Special Ver.)` 같은 건 계속 지워서 중복으로 본다.
export function dedupKey(s) {
  const raw = String(s || '');
  const feat = (raw.match(/\((?:feat\.?|with)[^)]*\)/ig) || [])
    .map(x => x.toLowerCase().replace(/[^0-9a-z가-힣]/g, '')).join('');
  const base = norm(raw);
  return base ? (feat ? `${base}|${feat}` : base) : '';
}

// ── 변형판 걸러내기 ──────────────────────────────────────────────────────────
// 스포티파이는 한 발매를 여러 엔트리로 쪼개 놓는다. 실측(에스파 58장)에서 본 것들:
//   LEMONADE - The 2nd Album (WINTER Special Version)   ← 멤버별 스페셜 4장
//   LEMONADE (Zedd Remix) / (2Spade Remix) / (Zedd Extended Mix)
//   Whiplash (English Version) / Rich Man (English Version)
//   Rich Man (Remixes) / Dirty Work (Remixes)
// 이걸 그대로 넣으면 디스코그래피가 리믹스로 도배된다. 우리 데이터는 멜론 기준의 "발매 단위"라
// 이런 변형판은 애초에 없다 — 그 성격을 유지한다.
// ⚠️ 일본어·중국어판은 **여기서 빼야 한다**(2026-09-15). 우리 데이터엔 일본어판 30장·한국어판 15장이
//    이미 정식 발매로 들어와 있는데(아이브 `LOVE DIVE -Japanese version-` 등) 필터가 막고 있어서
//    앞으로 나올 일본어판이 안 들어오고 있었다 — 관례와 코드가 정반대였다. 수집은 하되 화면에서
//    기본 노출을 뺄 수 있게 detectRegion()이 region을 달아준다(사용자 결정: 케밥 토글로 보기).
// ⚠️ feat./with도 막지 않는다 — 우리 데이터에 49장 있는 정식 별도 발매다(코르티스 `MOTION (feat.
//    Juicy J)`). 리믹스·라이브·인스트만 거른다. 라이브는 전례 0장이라 추가했다.
const VARIANT = /(english\s+ver|inst\.?\b|instrumental|remix|mix\)|acoustic\s+ver|sped\s+up|slowed|a\s+cappella|live\s+(version|ver\.?)|\(live\)|live\s+session)/i;
// ⚠️ "(… Ver.)" 꼬리는 **기본이 변형판**이고 언어명일 때만 예외다(2026-09-15 백필에서 드러남).
//    예전엔 `special version`만 막았는데, 실제로 들어온 건 그 형태가 아니었다:
//      엔하이픈 `THE SIN : BLISS (SUNGHOON Ver.)`  ← 멤버별 버전이 **정규 앨범**으로 들어갔다
//      몬스타엑스 `The Phase (Deluxe Ver.)`         ← 디럭스판이 별도 정규로
//      유니스 `mwah...(EN Ver.)`                    ← 영어판(`english ver`엔 안 걸리는 약칭)
//    멤버 이름·수식어는 끝이 없으니 막을 것을 열거하는 대신 **통과시킬 것만 열거**한다.
const LANG_VER = /\((?:korean|japanese|chinese|kr|jp|cn)\s*(?:ver\.?|version)\s*\)/i;
const ANY_VER = /\([^)]*\bver(?:\.|sion)?\s*\)/i;
export function isVariant(name) {
  const s = String(name || '');
  if (VARIANT.test(s)) return true;                 // 리믹스·인스트·라이브는 언어와 무관하게 제외
  if (LANG_VER.test(s)) return false;               // 한국어·일본어·중국어판은 수집 대상(region으로 구분)
  return ANY_VER.test(s);
}

// ── 발매 지역(일본어·중국어판) 추론 ─────────────────────────────────────────
// 앱은 이 값으로 기본 목록에서 빼고 케밥 토글로 보여준다. 그래서 **틀리면 앨범이 사라진 것처럼 보인다**
// — 재현율보다 정확도가 중요하다.
//
// ⚠️ 검증 결과(손으로 태깅한 64장을 정답셋으로): 글자로 잡을 수 있는 건 일부뿐이다.
//   · "트랙에 표식이 하나라도 있으면" 규칙은 재현 41/64였지만 **한국 앨범을 오분류했다** —
//     엑소 `THE WAR`, 티아라 `So Good`은 수록곡 하나가 `(Chinese Ver.)`일 뿐인 한국 발매다.
//   · 그래서 과반 규칙으로 바꿨다. 오분류 0이 됐고 재현은 18/64로 떨어졌다. 이 맞바꿈이 맞다.
//   · 못 잡는 46장은 `PADO`·`Make you happy`처럼 **제목이 영어/로마자인 일본 발매**라 글자에 단서가
//     없다. 웨이션브이(중국 활동 유닛)는 10장 전부가 이 경우다. 이건 앨범이 아니라 **아티스트 단위**로
//     지정해야 풀리는 문제고, 여기서 억지로 잡으려 들면 정확도만 잃는다.
// 못 잡은 건 region 없이 들어가 기본 목록에 남는다 — 안 들어오는 것보단 낫다.
const KANA = /[぀-ゟ゠-ヿ]/;   // 히라가나·가타카나
// 약칭도 본다 — 실측(유니스 `GimmeSummer☆(JP Ver.)`): `japanese`로만 찾으면 이런 게 region 없이 들어간다.
const JP_MARK = /(japanese\s*(ver|version)|\bjp\s*(ver\.?|version)|[-–—]\s*japanese\s*version|日本語)/i;
const CN_MARK = /(chinese\s*(ver|version)|\bcn\s*(ver\.?|version)|mandarin|中文)/i;
export function detectRegion(albumTitle, trackTitles) {
  const at = String(albumTitle || '');
  // 앨범 제목에 표식이 있으면 그 발매 전체가 그 언어판이다 — 트랙을 볼 것도 없다.
  if (JP_MARK.test(at) || KANA.test(at)) return 'jp';
  if (CN_MARK.test(at)) return 'cn';
  const tt = (trackTitles || []).filter(Boolean);
  if (!tt.length) return null;
  const jp = tt.filter(t => JP_MARK.test(t) || KANA.test(t)).length;
  const cn = tt.filter(t => CN_MARK.test(t)).length;
  if (jp / tt.length >= 0.5 && jp >= cn) return 'jp';
  if (cn / tt.length >= 0.5 && cn > jp) return 'cn';
  return null;
}

// ── 앨범 타입 ────────────────────────────────────────────────────────────────
// 우리 스키마의 type은 "정규 2집" "미니 5집" "싱글"처럼 **집 번호까지** 들어간다. 스포티파이의
// album_type(album/single/compilation)으로는 절대 만들 수 없다 — 실측상 6트랙짜리 미니앨범
// `Rich Man - The 6th Mini Album`이 album_type=single로 온다. 즉 album_type은 믿을 수 없다.
// 다행히 **제목 꼬리에 정답이 적혀 있다**. 거기서 못 읽으면 트랙 수로 보수적으로 떨어뜨린다.
const ORD = { '1': 1, '2': 2, '3': 3 };
export function parseTypeFromTitle(name, totalTracks, albumType) {
  // ⚠️ 리패키지·스페셜을 '정규'로 넣으면 안 된다(2026-09-15). 번호 채우기(tools/disco_number_fill.mjs)가
  //    정규 계열을 발매순으로 세어 번호를 매기는데, 여기 섞이면 **뒤 앨범 번호가 전부 하나씩 밀린다**.
  //    실측: 엔시티 127 `Favorite - The 3rd Album Repackage`가 '정규'로 들어가 '정규 4집' 후보가 됐다
  //    (실제로는 정규 3집의 리패키지). 기존 데이터에 이미 '리패키지'(16장)·'스페셜'(9장) 어휘가 있다.
  if (/\brepackage\b/i.test(String(name || ''))) return '리패키지';
  if (/\bspecial\s+album\b/i.test(String(name || ''))) return '스페셜';
  const m = /[-–—]\s*(?:the\s+)?(\d+)(?:st|nd|rd|th)\s+(mini\s+)?album/i.exec(String(name || ''));
  if (m) return `${m[2] ? '미니' : '정규'} ${Number(m[1])}집`;
  if (/[-–—]\s*(?:the\s+)?(?:1st|first)\s+(mini\s+)?album/i.test(name)) return /mini/i.test(name) ? '미니 1집' : '정규 1집';
  if (/special\s+(digital\s+)?single/i.test(name)) return '싱글';
  // 꼬리가 없을 때: 트랙 수로 본다. K팝 관행상 1~3=싱글, 4~9=미니, 10+=정규.
  // albumType('album'/'single'/…)은 믿을 수 없다(주석 참고) — 트랙 수만 본다.
  // 번호는 붙이지 않는다 — 근거 없이 "미니 7집"이라고 적으면 나중에 고치기가 더 어렵다.
  if ((totalTracks || 0) <= 3) return '싱글';
  if ((totalTracks || 0) >= 10) return '정규';
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
  // OST는 기존 데이터의 관례를 따른다: type 'OST' · isMain false(→ 기본 목록이 아니라 '더보기'로).
  // 이걸 안 하면 드라마 OST 참여곡이 정규 앨범들과 같은 줄에 서서 디스코그래피가 지저분해진다.
  const isOst = /\bOST\b/i.test(album.name);
  let one = tracks.length === 1 ? tracks[0] : null;
  if (!one) {
    // ⚠️ 먼저 **원문 그대로** 비교한다. norm()은 괄호를 지우므로 정규화로 비교하면
    //    `LEMONADE`와 `LEMONADE (feat. Becky G)`가 똑같아져 후보가 2개가 되고 기각된다
    //    (실측: aespa LEMONADE 11트랙 앨범에서 실제로 그렇게 놓쳤다). 원문 비교면 정확히 하나다.
    const raw = String(title).trim().toLowerCase();
    let same = tracks.filter(t => String(t.title).trim().toLowerCase() === raw);
    if (same.length !== 1) { const k = norm(title); same = k ? tracks.filter(t => norm(t.title) === k) : []; }
    if (same.length === 1) one = same[0];
  }
  if (one) one.isTitle = true;
  // 일본어·중국어판 표식. 못 잡으면 undefined로 두고 넣지 않는다 — 빈 값을 박아두면 나중에
  // "이미 판정했는데 없음"과 "판정을 못 함"이 구분되지 않는다.
  const region = detectRegion(album.name, tracks.map(t => t.title));
  return {
    entry: {
      title,
      type: isOst ? 'OST' : parseTypeFromTitle(album.name, album.total_tracks, album.album_type),
      isMain: !isOst,
      cover: (album.images && album.images[0] && album.images[0].url) || null,
      releaseDate: String(album.release_date || '').slice(0, 10).replace(/-/g, '.'),
      trackCount: album.total_tracks || tracks.length,
      titleTrack: one ? one.title : null,
      ...(region ? { region } : {}),
      tracks,
      src: 'spotify',            // 출처 표식 — 나중에 자동 수집분만 감사할 수 있게
      spotifyId: album.id,
      // 저작권 표기(무료 — /albums 응답에 이미 들어온다). 이름 도용 업로드를 가려내는 데 가장
      // 판별력이 높다: 정상은 회사명이고(에스파 `2026 SM Entertainment` · 있지 `JYP Entertainment` ·
      // 키스오브라이프 `Nippon Columbia Co., Ltd.`), 도용분은 개인명이다
      // (베이비복스에 붙었던 가짜 싱글 8건은 전부 `2026 ARAMBULA EDWARD`, 2026-09-16 실측).
      // ⚠️ `label` 필드는 이 앱 토큰으로 안 내려온다(전부 undefined) — 그래서 copyright를 쓴다.
      // 자동 차단 기준으로는 아직 안 쓴다(HYBE·ADOR처럼 회사 토큰이 없는 이름이 있어 오탐이 난다).
      // 지금은 저장만 해두고, 차단은 아래 sync의 "같은 날 1트랙 무더기" 신호가 맡는다.
      // ⚠️ 2026-09-30 정정: 예전엔 `album.copyrights`(검색 결과 객체)에서 읽었는데 **검색 결과엔 copyrights가
      //    아예 없다** — 실측 713장 중 0장 저장. 위 주석의 판별 신호가 한 번도 안 쌓이고 있었다. 상세(full)에서 읽는다.
      ...((((full.copyrights || album.copyrights) || [])[0] || {}).text ? { copyright: String((full.copyrights || album.copyrights)[0].text).slice(0, 120) } : {}),
    },
    needsTitleTrack: !one,
    precision: album.release_date_precision,
  };
}

// ── 합작 앨범 수집 ─────────────────────────────────────────────────────────────
// appears_on 앨범 = 이 아티스트가 공동 발매한 앨범(DIMOLLY 같은 합작 프로젝트 포함).
// Various Artists 컴필레이션은 제외. 2~4명이 같이 낸 것만 합작으로 본다.
//
// ⚠️ /artists/{id}/albums 는 하루 ~100회에 잠기는 엔드포인트다(spotify_auth.mjs 실측).
//    그래서 이 함수는 **대상당 한 번만** 호출하고 state.collabSwept에 기록해야 한다.
//    매일 전체를 돌리면 rate limit에 걸린다.
export async function getAppearsOn(artistId) {
  const VARIOUS = /various\s*artists?/i;
  const results = [];
  let url = `/artists/${artistId}/albums?include_groups=appears_on&market=KR&limit=50`;
  // 페이지네이션(보통 1~2페이지)
  while (url) {
    const j = await api(url);
    for (const al of j.items || []) {
      const arts = al.artists || [];
      // 2~4명, various artists 없음, 해당 아티스트 포함
      if (arts.length < 2 || arts.length > 4) continue;
      if (arts.some(a => VARIOUS.test(a.name))) continue;
      if (!arts.some(a => a.id === artistId)) continue;
      results.push(al);
    }
    url = j.next ? j.next.replace('https://api.spotify.com/v1', '') : null;
  }
  return results;
}

// ── 신원 확인 ②: 우리 영상 제목 대조 (2026-09-30) ─────────────────────────────
// 앨범 겹침 대조(①)는 **우리가 이미 앨범을 가진 대상**에만 쓸 수 있다. 전 멤버 솔로처럼 첫 앨범을 받는
// 대상은 대조할 게 없어서, 예전엔 그냥 통과됐다 → 솔로 27명이 동명이인 앨범 201장을 받은 사고
// (치훈→재즈 CHIHOON 30장, 렌타→Renaud Capuçon, 앤→Anne-Marie …).
// 대신 우리가 가진 **그 사람의 영상**(yt_channel_videos)을 증거로 쓴다: 진짜 본인이면 그 앨범의 곡으로
// 무대·MV·직캠이 있다. 실측(오수집 27 / 정답 16): 오수집은 전부 증거 0~1, 정답 그룹은 대부분 2 이상,
// 디모렉스 13. 조건을 이렇게 좁힌 이유(전부 실측 오탐):
//   · **곡 제목 자리**에 있을 때만 — 따옴표 안이나 ` - ` 뒤. 그냥 포함이면 해시태그 `#STEP`,
//     문장 `paint the town red`, 그룹명 `#로켓펀치 RocketPunch`가 걸린다.
//   · 커버 영상 제외 — `[COVER] TXT - Magic`이 박시영(미래소년)의 증거가 됐다.
//   · 우주 안 사람 이름 제외 — 트랙명 `Jisu`가 `TO1's DONG GEON, JI SU`에 걸렸다.
//   · **서로 다른 곡 2개 이상** — 오태깅된 영상 1건(`Minsu - Go for Love`가 티오원 민수로 태깅)이
//     그대로 통과시키지 않게.
// 반환: { hits:[{song, video}], checked:영상 수 } — 네트워크 실패는 예외로 던진다(호출부가 "미확인"으로 보류).
const SB_URL = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const GENERIC_SONG = new Set(['intro', 'outro', 'inst', 'instrumental', 'interlude', 'love', 'home', 'dream', 'blue', 'stay', 'star', 'light', 'night', 'summer', 'winter', 'spring', 'hello', 'forever', 'together', 'remix']);
const vnorm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^\p{L}\p{N}]/gu, '');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 곡 제목 자리: 여는 따옴표/대시 뒤 ~ 닫는 따옴표/괄호/구분자 앞. 공백·기호는 느슨하게.
const SLOT_OPEN = String.raw`(?:^|['"‘’“”「『]|\s[-–—:]\s*|\s[xX×]\s|,\s)`; // 콤마: THE SHOW 표기 "YEEUN, Cherry Coke (…"
const SLOT_CLOSE = String.raw`(?=\s*(?:['"‘’“”」』(\[|│,]|[-–—]\s|$))`;
const SLOT_GAP = String.raw`[^\p{L}\p{N}]*`;
function songSlotRe(song) {
  const core = String(song).replace(/\(.*?\)|\[.*?\]/g, ' ').trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(escRe).join(SLOT_GAP);
  if (!core) return null;
  return new RegExp(SLOT_OPEN + core + SLOT_CLOSE, 'iu');
}
export async function videoEvidence({ ko, kind, groupKeys = [], albums, personNames = new Set(), key }) {
  const K = key;
  const pg = s => `"${String(s).replace(/"/g, '\\"')}"`;
  let or;
  if (kind === 'group') or = [`group_ko.eq.${pg(ko)}`];
  else or = [`group_ko.eq.${pg(ko)}`, ...groupKeys.map(g => `and(group_ko.eq.${pg(g)},members.cs.{${pg(ko)}})`), ...groupKeys.map(g => `with_members.cs.{${pg(`${ko}(${g})`)}}`)];
  const r = await fetch(`${SB_URL}?select=title&or=(${encodeURIComponent(or.join(','))})&limit=3000`, { headers: { apikey: K, Authorization: `Bearer ${K}` } });
  if (!r.ok) throw new Error(`videoEvidence ${r.status}`);
  const titles = (await r.json()).map(x => x.title || '').filter(t => !/\bcover\b|커버|covered by/i.test(t));
  const hits = new Map();
  for (const al of albums) {
    for (const song of [al.title, ...(al.tracks || []).map(x => x.title)]) {
      const k = vnorm(song);
      if (k.length < 3 || GENERIC_SONG.has(k) || personNames.has(k) || hits.has(k)) continue;
      const re = songSlotRe(song); if (!re) continue;
      const v = titles.find(t => re.test(t));
      if (v) hits.set(k, { song, video: v.slice(0, 80) });
    }
  }
  return { hits: [...hits.values()], checked: titles.length };
}
export const VIDEO_EVIDENCE_MIN = 2;
