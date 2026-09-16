// 스포티파이 신보 일일 수집 (2026-09-15)
//
// 하는 일: 우리 로스터를 우선순위 순으로 돌며 "스포티파이엔 있는데 우리 데이터엔 없는 앨범"을 찾아
// groups.json / artists.json에 넣는다. 파생물(disco/·slim·tracks_index) 재생성은 이 커밋이
// rebuild-disco-artifacts.yml을 깨워 자동으로 이어진다.
//
// ── 왜 '예산 + 커서'인가 ─────────────────────────────────────────────────────
// 호출 횟수가 1급 제약이다(spotify_auth.mjs 실측: /artists/{id}/albums 약 100회에 24시간 잠김).
// "388팀을 매일 다 훑는다"는 순진한 설계는 쓸 수 없다. 그래서:
//   · 한 회차에 BUDGET(기본 80)회만 쓰고 멈춘다
//   · 어디까지 봤는지 spotify_sync_state.json에 남겨 다음 회차가 이어받는다
//   · 순서는 `안 본 날 수 × 등급 가중치`가 큰 순 — A등급이 자주 돌지만 하위도 굶지 않는다
//     (등급을 1차 정렬 키로 쓰면 A 114팀이 예산을 매번 다 먹어 C·솔로가 영영 안 돌아간다. 아래 targets() 주석)
//   · 긴 429가 뜨면 기다리지 않고 그 회차를 접는다(진행분은 이미 파일에 반영돼 있다)
//   · 네트워크 오류는 커서를 찍지 않고 다음 회차로 넘긴다(아래 NET_ERR — 안 그러면 한 바퀴가 통째로 날아간다)
// 하루 2회차(KST 18:11/00:11) × 80 = 160콜. 대상 535팀이라 전체 한 바퀴에 3~4일.
// 지난해 구멍은 대상마다 한 번씩 훑는 과거연도 백필이 따로 메운다(아래 BACKFILL_YEARS).
//
// ⚠️ 이 스크립트는 **원본(groups.json/artists.json)만** 고친다. 파생물은 건드리지 않는다.
// ⚠️ 이미 있는 앨범은 절대 덮어쓰지 않는다 — 사람이 고쳐둔 값(타이틀곡·집 번호·커버)을 자동 수집이
//    되돌리면 안 된다. 이 프로젝트의 tags_manual 원칙과 같은 취지다.
//
// 실행: node tools/spotify_disco_sync.mjs [--dry] [--budget N] [--only 에스파,아이브] [--years 2024-2026]
// env: SPOTIFY_CLIENT_ID/SECRET (또는 .spotify.key) · BUDGET · BACKFILL_YEARS(기본 '2025', 빈 값이면 끔)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RateLimited } from './spotify_auth.mjs';
import { dedupKey, isVariant, parseTypeFromTitle, searchAlbums, resolveArtist, toEntry } from './spotify_disco_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const rd = f => JSON.parse(fs.readFileSync(P(f), 'utf8'));

// ⚠️ 원본 파일의 들여쓰기를 **보존해서** 쓴다. groups.json은 2칸인데 artists.json은 **1칸**이라,
//    둘 다 `JSON.stringify(x, null, 2)`로 쓰면 artists.json 20만 줄이 통째로 리포맷된 diff가 된다.
//    자동 수집이 매일 그런 커밋을 만들면 실제로 뭐가 추가됐는지 아무도 못 본다(리뷰가 불가능해진다).
//    스타일은 2번째 줄의 선행 공백에서 읽고, 끝 개행 유무도 원본을 따른다.
function writeJsonKeepingStyle(file, obj) {
  const raw = fs.readFileSync(P(file), 'utf8');
  const m = /^[\[{]\r?\n([ \t]+)/.exec(raw);
  const indent = m ? m[1] : 2;
  const eol = raw.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(P(file), JSON.stringify(obj, null, indent) + eol);
}

const DRY = process.argv.includes('--dry');
const argOf = k => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const BUDGET = Number(argOf('--budget') || process.env.BUDGET || 80);
// 같은 날 1트랙 싱글이 이만큼 몰리면 이름 도용 업로드로 보고 보류한다(아래 2-c 주석).
const BULK_SINGLE_MIN = Number(process.env.BULK_SINGLE_MIN || 3);
const ONLY = argOf('--only') ? new Set(argOf('--only').split(',')) : null;

const groups = rd('groups.json');
const artists = rd('artists.json');
const MAP_F = 'spotify_artist_map.json';
const STATE_F = 'spotify_sync_state.json';
const map = fs.existsSync(P(MAP_F)) ? rd(MAP_F) : {};
const state = fs.existsSync(P(STATE_F)) ? rd(STATE_F) : { checked: {}, runs: 0 };
state.checked = state.checked || {};

// ── 대상 목록과 순서 ─────────────────────────────────────────────────────────
// ⚠️⚠️ 두 번 틀렸던 자리다(2026-09-16 실측으로 발견).
//
// ① groups.json의 `pri`는 **'A'/'B'/'C' 문자가 아니라 숫자 가중치**다(A=4 · B=1.5 · C=0.6 —
//    라벨 LOD가 쓰는 값, tools/bake_group_priority.mjs가 굽는다). 그런데 여기서 `{A:0,B:1,C:2}`로
//    읽고 있어서 전부 `?? 3`으로 떨어졌다 — 즉 **우선순위가 한 번도 작동한 적이 없었다**
//    (실측: 대상 535팀 전원 pri 3).
// ② 그렇다고 등급을 **1차 정렬 키**로 쓰면 하위 등급이 굶는다. A등급만 114팀이라 하루 예산
//    160콜(80×2회) 중 114를 매번 A가 먼저 다 먹고, C등급 14팀과 솔로 328명은 **영영 차례가 안 온다**.
//    (원래 주석의 "하위 등급도 반드시 언젠가 돈다"는 그 구조에선 성립하지 않는다.)
//
// 그래서 등급은 **문(gate)이 아니라 가중치**로 쓴다: `안 본 날 수 × 등급 가중치`가 큰 순.
// A는 C보다 6.7배 자주 도는데, 오래 방치된 하위 대상은 날짜가 쌓이면서 결국 A를 추월한다 → 굶지 않는다.
// 한 번도 안 본 대상은 가장 큰 방치일수를 줘서 최우선으로 끌어온다.
const PRI_LETTER = { A: 4, B: 1.5, C: 0.6 };   // 옛 표기(문자)도 혹시 섞여 있으면 같은 뜻으로 읽는다
const SOLO_W = 1;                              // 솔로는 그룹 B등급보다 조금 낮게(= 중립)
const priWeight = v => (typeof v === 'number' && v > 0 ? v : (PRI_LETTER[v] ?? SOLO_W));
const NEVER_DAYS = 3650;                       // 한 번도 안 본 대상
function staleDays(ko) {
  const d = state.checked[ko];
  if (!d) return NEVER_DAYS;
  const t = Date.parse(d + 'T00:00:00Z');
  if (!Number.isFinite(t)) return NEVER_DAYS;
  return Math.max(0.25, (Date.now() - t) / 86400000);  // 같은 날 두 번째 회차도 0이 되지 않게 하한
}
function targets() {
  const out = [];
  for (const [ko, g] of Object.entries(groups)) {
    if (g.disbanded) continue;                       // 해체 그룹은 신보가 없다
    out.push({ ko, kind: 'group', names: [g.en, ko, ...(g.altNames || [])].filter(Boolean), w: priWeight(g.pri) });
  }
  for (const a of artists) {
    const ko = a.name?.ko, gko = a.group?.ko;
    if (!ko || !gko || groups[gko]) continue;        // 실존 그룹 소속은 그룹으로 커버
    if (a.active === false) continue;
    out.push({ ko, kind: 'solo', names: [a.name?.en, ko].filter(Boolean), w: SOLO_W });
  }
  const seen = new Set();
  return out.filter(t => (seen.has(t.ko) ? false : seen.add(t.ko)))
    .map(t => ({ ...t, due: staleDays(t.ko) * t.w }))
    .sort((x, y) => y.due - x.due);
}

// 그 대상이 이미 갖고 있는 앨범 (정규화 제목 집합 + 발매 연도 목록)
// ⚠️ 연도가 중요하다 — 매핑 검증을 "우리가 실제로 앨범을 가진 연도"로 해야 한다(자세한 건
//    spotify_disco_lib.mjs의 resolveArtist 주석). 최신 연도부터 내림차순으로 준다.
function owned(t) {
  const set = new Set(), years = new Set();
  // ⚠️ years는 **그 주체 본인의 디스코에서만** 모은다. 멤버 솔로 앨범까지 섞으면 검증이 무너진다 —
  //    실측(펜타곤): 그룹 최신 앨범은 2023년인데 멤버 솔로가 2025·2026에 있어서 연도가 2026,2025로
  //    잡혔고, 그 연도로 그룹을 검색하니 당연히 겹침 0 → 정답 매핑이 "미검증"으로 보류됐다.
  //    titles 쪽은 반대로 멤버 것까지 넣는 게 맞다(중복 삽입 방지가 목적이라 넓을수록 안전).
  const add = (list, countYear) => {
    for (const al of list || []) {
      const k = dedupKey(al.title); if (k) set.add(k);
      if (!countYear) continue;
      const y = Number(String(al.releaseDate || '').slice(0, 4)); if (y > 1990) years.add(y);
    }
  };
  if (t.kind === 'group') {
    add(groups[t.ko]?.discography, true);
    for (const a of artists) if (a.group?.ko === t.ko) add(a.discography, false); // 멤버 솔로: 중복 방지용으로만
  } else {
    for (const a of artists) {
      if (a.name?.ko !== t.ko) continue;
      add(a.discography, true);
      for (const u of a.unitDiscography || []) add(u?.albums, true);
    }
  }
  return { titles: set, years: [...years].sort((a, b) => b - a) };
}

// 새 앨범을 원본에 꽂는다(발매일 내림차순 유지 — 기존 파일이 그 순서다)
function insert(t, entry) {
  const push = list => {
    list.push(entry);
    list.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
  };
  if (t.kind === 'group') { groups[t.ko].discography = groups[t.ko].discography || []; push(groups[t.ko].discography); return true; }
  const a = artists.find(x => x.name?.ko === t.ko && !groups[x.group?.ko]);
  if (!a) return false;
  a.discography = a.discography || [];
  push(a.discography);
  return true;
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
// 평소(일일 수집)엔 올해만 본다. 연도 하나가 곧 대상당 1콜이라, 안 볼 연도를 보는 건 그만큼
// 커서 진행을 늦추는 것과 같다.
// --years는 **사람이 일회성 백필을 돌 때만** 쓴다(예: `--years 2025` 로 과거 구멍 점검,
// `--years 2024-2026` 로 범위). CI에는 붙이지 않는다 — 붙이면 매일 그 배수만큼 콜을 쓴다.
const year = new Date().getFullYear();
const month = new Date().getMonth() + 1;
function parseYears(spec) {
  const m = /^(\d{4})\s*-\s*(\d{4})$/.exec(spec.trim());
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
    // 최신 연도부터 본다 — 예산이 중간에 끊겨도 최근 것부터 들어와 있게.
    return Array.from({ length: b - a + 1 }, (_, i) => b - i);
  }
  const ys = spec.split(',').map(s => Number(s.trim())).filter(y => y > 1990 && y <= year + 1);
  if (!ys.length) { console.error(`오류: --years 형식이 잘못됐습니다: ${spec}  (예: 2025 · 2024,2026 · 2024-2026)`); process.exit(1); }
  return [...new Set(ys)].sort((a, b) => b - a);
}
// 1월 초엔 지난해 말 발매가 아직 "신보"다 — 그때만 연도를 하나 더 본다(평소엔 콜을 안 쓴다).
const YEARS = argOf('--years') ? parseYears(argOf('--years')) : (month === 1 ? [year, year - 1] : [year]);

// ── 과거 연도 1회 백필 (2026-09-16) ───────────────────────────────────────────
// 일일 수집이 **올해만** 보기 때문에 지난해 구멍은 시간이 지나도 저절로 안 메워진다.
// 실측(2026-09-16): A등급 15팀 중 11팀만 훑었는데 2025년 누락이 12장이었다 —
// 에스파 미니 6집 `Rich Man`, 아이브 `REBEL HEART`, 있지 정규 `Collector` 같은 **주력 발매**가 빠져 있었다.
// 지금까진 사람이 `--years 2025`로 일회성 백필을 돌아야만 했는데, 그런 "기억해야 도는 절차"는 결국 안 돈다.
// → 대상마다 과거 연도를 **딱 한 번** 훑고 그 사실을 state.swept에 남긴다. 첫 바퀴에만 대상당 +1콜이
//   들고(535팀 = 535콜, 하루 160콜이면 3~4일) 그 뒤엔 다시 올해만 본다.
//   다 메워졌으면 레포 변수 BACKFILL_YEARS를 빈 값으로 두면 꺼진다. 더 과거로 넓히려면 '2022,…'를 추가.
// 범위를 2023까지로 잡은 근거(실측 2026-09-16): A등급 8팀 표본의 2023·2024를 재보니 16개 조합에서 26장이
//   비어 있었다(팀·연도당 평균 1.6장 — 아이들 `Wife`·`I DO`처럼 주력 발매도 포함). 2022 이전은 표본에서
//   누락이 급감하고 OST·`Spotify Singles` 같은 주변 발매 비중이 커져 오탐이 늘어 일단 제외했다.
//   첫 바퀴 비용은 대상당 +3콜(535팀 = 약 1,600콜 ≈ 13일). 커서가 있어 중간에 끊겨도 이어진다.
// ⚠️ `--years`로 사람이 직접 돌릴 땐 이 경로를 끈다 — 그 명령이 이미 연도를 명시했으므로 중복이다.
const BACKFILL_YEARS = (process.env.BACKFILL_YEARS ?? '2023,2024,2025')
  .split(',').map(s => Number(s.trim())).filter(y => y > 1990 && y < year);
state.swept = state.swept || {};
const pendingBackfill = ko => (argOf('--years') ? [] : BACKFILL_YEARS.filter(y => !(state.swept[ko] || []).includes(y)));

// 네트워크성 오류 판정 — 이건 "그 대상의 문제"가 아니라 "지금 망이 안 되는 것"이라 커서를 찍지 않는다.
const NET_ERR = /fetch failed|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|UND_ERR|network/i;
const NET_FAIL_ABORT = 5;   // 연속 이만큼이면 망이 죽은 것으로 보고 회차를 접는다
let netFails = 0;
let calls = 0, checked = 0, added = 0, mapped = 0, backfilled = 0;
const addedList = [], reviewList = [], problems = [];
let stoppedBy = null;

const list = ONLY ? targets().filter(t => ONLY.has(t.ko)) : targets();
console.log(`[disco-sync] 대상 ${list.length} · 예산 ${BUDGET}콜 · 연도 ${YEARS.join(',')}${DRY ? ' · DRY' : ''}`);

for (const t of list) {
  if (calls >= BUDGET) { stoppedBy = '예산 소진'; break; }
  try {
    const own = owned(t);
    // 1) 매핑이 없으면 먼저 해석한다(여기서도 콜을 쓰므로 같은 예산에서 깎는다)
    let m = map[t.ko];
    if (!m || !m.id) {
      const r = await resolveArtist({ names: t.names, ourTitles: own.titles, ourYears: own.years });
      calls += r.calls;
      if (!r.ok) { problems.push(`${t.ko} — 매핑 실패(${r.reason})`); state.checked[t.ko] = new Date().toISOString().slice(0, 10); continue; }
      m = map[t.ko] = { id: r.id, spotifyName: r.name, kind: t.kind, confidence: r.confidence, why: r.why, evidence: { titleOverlap: r.overlap }, checkedAt: new Date().toISOString().slice(0, 10) };
      mapped++;
      if (r.confidence === 'low') reviewList.push(`매핑 확인 필요: ${t.ko} → ${r.name} (${r.why}, 겹침 ${r.overlap})`);
    }

    // 2) 올해(1월이면 작년까지) 앨범을 검색해 우리에 없는 것만 고른다
    const newOnes = [];
    const sweptNow = [];
    for (const y of [...YEARS, ...pendingBackfill(t.ko)]) {
      if (calls >= BUDGET) { stoppedBy = '예산 소진'; break; }
      const items = await searchAlbums(m.spotifyName || t.names[0], y, m.id);
      calls++;
      // ⚠️ **실제로 호출이 끝난 연도만** 훑었다고 기록한다. 예산이 끊겨 못 본 연도를 찍으면 그 대상은
      //    영영 백필이 안 된다(다음 회차가 이어받아야 하는데 "이미 봤다"로 넘어가 버린다).
      if (BACKFILL_YEARS.includes(y)) sweptNow.push(y);
      for (const al of items) {
        const key = dedupKey(al.name);
        if (!key || own.titles.has(key)) continue;            // 이미 있음
        if (isVariant(al.name)) continue;                     // 리믹스·영어버전·멤버별 스페셜
        if (String(al.release_date_precision) !== 'day') { problems.push(`${t.ko} — 발매일 정밀도 ${al.release_date_precision}: ${al.name}`); continue; }
        newOnes.push(al);
      }
    }

    // 2-b) ⚠️ **같은 회차 안의 중복**을 접는다(2026-09-15). own.titles는 회차 시작 시점의 보유 목록이라
    //      이번에 새로 찾은 것끼리는 서로를 못 본다. 스포티파이는 같은 발매를 선공개 1트랙 + 본편으로
    //      쪼개 올리는 일이 잦다(실측: 투어스 `SODA SODA` 2026.08.03 1트랙 / 08.04 3트랙 → 두 장이
    //      그대로 들어갔다).
    //      다만 **제목이 같다고 무조건 합치면 안 된다** — 투어스 `Hollow`는 선공개 싱글(6/11)과
    //      미니앨범(6/18)이고 멜론 기준으로도 별개 발매다. 그래서 "제목 + 종류"가 둘 다 같을 때만
    //      한 장으로 보고, 트랙이 많은 쪽(=본편)을 남긴다.
    if (newOnes.length > 1) {
      const pick = new Map();
      for (const al of newOnes) {
        const k = `${dedupKey(al.name)}${parseTypeFromTitle(al.name, al.total_tracks, al.album_type)}`;
        const prev = pick.get(k);
        if (!prev) { pick.set(k, al); continue; }
        const keep = (al.total_tracks || 0) > (prev.total_tracks || 0) ? al : prev;
        const drop = keep === al ? prev : al;
        pick.set(k, keep);
        problems.push(`${t.ko} — 같은 발매로 보여 합침: ${drop.name} (${drop.release_date}, ${drop.total_tracks}트랙) → ${keep.name} (${keep.release_date}) 채택`);
      }
      newOnes.length = 0;
      newOnes.push(...pick.values());
    }

    // 2-c) 이름 도용 업로드 차단 — **같은 날 1트랙 싱글 무더기**(2026-09-16).
    //   실제 사고: 베이비복스 아티스트 페이지에 2026.08.13에 1트랙 싱글 5개, 09.14에 3개가 한꺼번에
    //   붙었다. 전부 저작권자가 `2026 ARAMBULA EDWARD`(소속사와 무관한 개인명)이고 재생시간이
    //   179·179·180초로 거의 같은, 양산 업로드였다. 스포티파이는 이런 걸 정식 아티스트 페이지에
    //   그대로 붙여준다 — 우리가 걸러야 한다.
    //   신호를 "같은 날 1트랙 싱글 N건"으로 잡은 이유: 정식 발매는 한 아티스트가 하루에 별개 싱글을
    //   3장 이상 내지 않는다(전수 스캔 결과 이 패턴에 걸리는 건 베이비복스뿐이었다 — 오탐 0).
    //   ⚠️ 이미 갖고 있는 앨범까지 합쳐서 센다. 한 건씩 나눠 들어오면 회차마다 1건이라 안 걸린다.
    //   ⚠️ 저작권자(개인명 여부)로 막지 않는 이유는 spotify_disco_lib.mjs의 copyright 주석 참고.
    if (newOnes.length) {
      const oneTrackByDate = {};
      const bump = list => { for (const al of list || []) if (al && al.trackCount === 1 && al.releaseDate) oneTrackByDate[al.releaseDate] = (oneTrackByDate[al.releaseDate] || 0) + 1; };
      if (t.kind === 'group') bump(groups[t.ko]?.discography);
      else for (const a of artists) if (a.name?.ko === t.ko) bump(a.discography);
      for (const al of newOnes) {
        if ((al.total_tracks || 0) !== 1) continue;
        const d = String(al.release_date || '').slice(0, 10).replace(/-/g, '.');
        if (d) oneTrackByDate[d] = (oneTrackByDate[d] || 0) + 1;
      }
      const bulkDates = new Set(Object.entries(oneTrackByDate).filter(([, n]) => n >= BULK_SINGLE_MIN).map(([d]) => d));
      if (bulkDates.size) {
        // ⚠️ 걸린 **날짜의 것만** 뺀다. 예전 초안은 newOnes를 통째로 비워서, 같은 회차에 찾은 정상 신보까지
        //    같이 날아갈 수 있었다(이 가드가 오히려 수집을 망치는 모양).
        const keep = newOnes.filter(al => !bulkDates.has(String(al.release_date || '').slice(0, 10).replace(/-/g, '.')));
        const heldCount = newOnes.length - keep.length;
        if (heldCount) {
          newOnes.length = 0;
          newOnes.push(...keep);
          reviewList.push(`⛔ 이름 도용 의심으로 보류: ${t.ko} — 같은 날 1트랙 싱글이 ${BULK_SINGLE_MIN}건 이상 몰렸습니다(${[...bulkDates].join(', ')}). ${heldCount}장을 넣지 않았습니다. 정상 발매가 맞다면 손으로 추가하세요.`);
        }
      }
    }
    // 3) ⚠️ 검증 게이트 — **확인 안 된 매핑으로는 앨범을 넣지 않는다.**
    //    confidence가 'medium'인 건 "이름이 유일하게 일치"만 본 것이라 동명이인일 수 있다. 평소엔
    //    검증 비용을 안 쓰다가, **실제로 넣을 게 생겼을 때만** 우리가 앨범을 가진 연도로 대조한다.
    //    신보는 하루 2장 수준이라 이 비용은 사실상 없는 것과 같고, 엉뚱한 사람의 앨범이 쌓이는 건 막는다.
    if (newOnes.length && m.confidence !== 'high' && own.years.length && calls < BUDGET) {
      let ov = 0;
      for (const y of own.years.slice(0, 2)) {
        if (calls >= BUDGET) break;
        const items = await searchAlbums(m.spotifyName, y, m.id);
        calls++;
        for (const al of items) if (own.titles.has(dedupKey(al.name))) ov++;
        if (ov >= 1) break;
      }
      m.evidence = { ...(m.evidence || {}), verifyOverlap: ov, verifyYears: own.years.slice(0, 2) };
      if (ov >= 1) { m.confidence = 'high'; m.why = (m.why || '') + ` · 수집 전 검증 통과(겹침 ${ov})`; }
      else {
        reviewList.push(`⛔ 매핑 미검증이라 보류: ${t.ko} → ${m.spotifyName} — 우리가 앨범을 가진 연도(${own.years.slice(0, 2).join(',')})에 겹치는 앨범이 0. 신보 ${newOnes.length}장을 넣지 않았습니다.`);
        newOnes.length = 0;
      }
    }

    // 4) 넣기
    for (const al of newOnes) {
      if (calls >= BUDGET) { stoppedBy = '예산 소진'; break; }
      const { entry, needsTitleTrack } = await toEntry(al);
      calls++;
      if (DRY) { addedList.push(`[DRY] ${t.ko} · ${entry.releaseDate} · ${entry.type} · ${entry.title}${needsTitleTrack ? ' (타이틀곡 미상)' : ''}`); }
      else if (insert(t, entry)) {
        added++;
        own.titles.add(dedupKey(al.name));
        addedList.push(`${t.ko} · ${entry.releaseDate} · ${entry.type} · ${entry.title}${needsTitleTrack ? ' (타이틀곡 미상)' : ''}`);
        if (needsTitleTrack) reviewList.push(`타이틀곡 미상: ${t.ko} — ${entry.title} (${entry.trackCount}트랙)`);
      } else problems.push(`${t.ko} — 넣을 대상을 못 찾음`);
    }
    if (sweptNow.length) {
      state.swept[t.ko] = [...new Set([...(state.swept[t.ko] || []), ...sweptNow])].sort();
      backfilled += sweptNow.length;
    }
    netFails = 0;
    state.checked[t.ko] = new Date().toISOString().slice(0, 10);
    checked++;
  } catch (e) {
    if (e instanceof RateLimited) { stoppedBy = `레이트리밋 (${e.message})`; break; }
    problems.push(`${t.ko} — ${e.message}`);
    // ⚠️ **네트워크 실패를 "봤다"로 기록하면 안 된다.** 실제로 사고를 냈다(2026-09-16): 프록시 때문에
    //    535팀이 전부 `fetch failed`로 떨어졌는데 커서는 전원 "오늘 확인함"으로 찍혔다 — 아무것도 못
    //    봤는데 한 바퀴를 건너뛴 셈이고, 리포트만 보면 "문제 535건"이라 원인은 보이지만 커서 오염은
    //    조용하다. 네트워크성 오류는 그 대상을 **다음 회차로 넘기고**, 연달아 나면 회차를 접는다
    //    (망이 죽은 상태에서 남은 예산을 다 태울 이유가 없다).
    if (NET_ERR.test(e.message || '')) {
      if (++netFails >= NET_FAIL_ABORT) { stoppedBy = `네트워크 오류 ${netFails}연속 — 회차 중단(커서 보존)`; break; }
      continue;
    }
    netFails = 0;
    state.checked[t.ko] = new Date().toISOString().slice(0, 10);
  }
}

// ── 저장 ─────────────────────────────────────────────────────────────────────
if (!DRY) {
  if (added) {
    writeJsonKeepingStyle('groups.json', groups);
    writeJsonKeepingStyle('artists.json', artists);
  }
  const sortedMap = {}; for (const k of Object.keys(map).sort()) sortedMap[k] = map[k];
  fs.writeFileSync(P(MAP_F), JSON.stringify(sortedMap, null, 2) + '\n');
  state.runs = (state.runs || 0) + 1;
  state.lastRunAt = new Date().toISOString();
  fs.writeFileSync(P(STATE_F), JSON.stringify(state, null, 2) + '\n');
}

// ── 리포트 ───────────────────────────────────────────────────────────────────
const out = [];
const say = s => { out.push(s); console.log(s); };
say(`## 스포티파이 신보 수집`);
say('');
// 대상을 다 훑었으면 예산을 조금 넘겼어도 "완주"다 — 예산은 하드 컷이 아니라 회차당 상한선이고,
// 한 대상을 처리하다 몇 콜 넘기는 건 정상이다(중간에 끊으면 그 대상만 어중간해진다).
const done = checked >= list.length;
say(`- 훑은 대상 **${checked}** / ${list.length} · 콜 **${calls}**/${BUDGET} · 새 매핑 ${mapped}건`);
// 과거 연도 백필이 얼마나 남았는지 매 회차 보여준다 — 안 보면 "끝났는지" 알 수가 없다(끄는 시점 판단용).
if (BACKFILL_YEARS.length) {
  const remain = list.filter(t => pendingBackfill(t.ko).length).length;
  say(`- 과거연도 백필(${BACKFILL_YEARS.join(',')}) 이번 회차 ${backfilled}건 · 남은 대상 **${remain}**/${list.length}${remain ? '' : ' — 완료(레포 변수 BACKFILL_YEARS를 비우면 끕니다)'}`);
}
say(`- 추가한 앨범 **${added}장**${done ? ' · 대상 전부 완주' : ` · 중단: ${stoppedBy || '알 수 없음'} (다음 회차가 이어받음)`}`);
if (addedList.length) { say(''); addedList.slice(0, 40).forEach(s => say(`  - ${s}`)); if (addedList.length > 40) say(`  - … 외 ${addedList.length - 40}장`); }
if (reviewList.length) { say(''); say(`<details><summary>사람이 볼 것 ${reviewList.length}건</summary>`); say(''); reviewList.slice(0, 40).forEach(s => say(`  - ${s}`)); say(''); say('</details>'); }
if (problems.length) { say(''); say(`<details><summary>문제 ${problems.length}건</summary>`); say(''); problems.slice(0, 40).forEach(s => say(`  - ${s}`)); say(''); say('</details>'); }
if (DRY) say('\n[--dry] 파일은 쓰지 않았습니다.');

if (process.env.GITHUB_STEP_SUMMARY) { try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n'); } catch { } }
// 레이트리밋으로 접힌 건 **실패가 아니다** — 설계된 동작이고 다음 회차가 이어받는다.
// 진짜 실패(인증 오류 등)는 위에서 예외로 터져 나간다.
