// 가로→쇼츠 일괄 승격 — 서버 백그라운드 스윕 (2026-08-31)
//
// 브라우저 승격 버튼(admin.js _ytSweepPromoteShorts)과 같은 일을 하되, 회사님 탭을 켜놓고 기다릴
// 필요 없이 서버(GitHub Actions)에서 돈다. 브라우저는 같은 호스트(i.ytimg.com)에 동시 6개밖에 못
// 붙어 ~90분 걸렸는데, Node는 그 제한이 없어 동시 CONC개(기본 100)로 훨씬 빠르다.
//
// 판별(2026-09-14 전면 교체 — 아래 "왜 바꿨나" 참고): 1차로 youtube.com/shorts/<id>에 HEAD를 날려
//   200이면 쇼츠, 303(→ /watch 리다이렉트)이면 쇼츠 아님. 303일 때만 2차로 oardefault.jpg 비율을 본다
//   (3분 넘는 세로 영상은 쇼츠 URL로는 안 열려서 1차가 못 잡는다 — 2차가 그 구멍을 메운다).
//   둘 다 아니어야 가로로 확정한다.
// 표식: 확인한 행은 전부 short_probed_at을 채운다(shorts_probe_migration.sql) → 다음 실행은
//   short_probed_at IS NULL만 골라 재프로브 0. 후보가 0이 되면 자연 종료(밀린 것 다 처리됨).
// 안전: 강등(쇼츠→가로)은 안 한다. tags_manual 행은 건드리지 않는다(수동 편집 보호). 최신순으로
//   훑어 카드·Trend·favnew에 실제로 뜨는 최근 영상부터 여백이 사라지게 한다.
//
// ── 왜 판별을 바꿨나 (2026-09-14) ─────────────────────────────────────────────
// 기존 판별은 oardefault.jpg **한 장**에 전부를 걸었다. 그런데 유튜브가 요즘 쇼츠에 이 이미지를 안 주는
// 경우가 많고(404), 그러면 옛 코드는 그걸 "가로 확정"으로 읽어 short_probed_at까지 찍어버렸다 —
// **한 번 놓치면 영구히 후보에서 빠진다**. 실측(2026-09-14):
//   · 대조군 — 확실한 가로(MV) 40건: /shorts/ 303 37건 · is_short=true 40건: /shorts/ 200 40건 (판별 신뢰 확인)
//   · "가로로 확정됨" 표본 재검사 → 2021 5% · 2022 5% · 2023 3% · 2024 15% · 2025 3% · 2026 13%가 실제론 쇼츠
//   · 최근 유입분 300건 표본에선 18.7%(56건). 놓친 6건을 직접 열어보니 전부 1080x1920/2160x3840 세로였고
//     oardefault.jpg는 전부 404였다.
//   → 이미 프로브된 29만 건 중 대략 2만 건이 세로인데 가로로 박혀 있다는 뜻. 그래서 이 스윕은
//     "밀린 것 처리"가 아니라 **재검사**가 필요하다(shorts_reprobe_migration.sql).
// 비용도 오히려 싸다 — HEAD는 쇼츠/가로 양쪽 다 본문 0바이트고, 실측 동시 60개에서 93건/초(오류 0).
//
// ⚠️ 네트워크 오류/타임아웃은 **가로로 확정하지 않는다**(옛 코드는 catch에서 false를 돌려줘 가로로
//    찍었다 — 순간적인 네트워크 끊김 한 번이 그 행을 영구히 잘못된 값으로 굳히는 구조였다).
//    판정 불가는 short_probed_at도 안 찍고 넘겨서 다음 실행이 다시 본다.
//
// 실행: SUPABASE_SERVICE_ROLE=<service_role 키> node tools/shorts_promote.mjs
//   (service_role 키만 is_short 쓰기가 가능하다 — anon 키는 RLS에 막힘. GitHub Actions에서는
//    레포 Secrets의 SUPABASE_SERVICE_ROLE로 주입된다.)
// 옵션 env: MAX_PROMOTE(이번 실행 상한, 기본 무제한) · CONC(동시 프로브, 기본 60) · CHUNK(기본 500)

const U = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const TABLE = 'yt_channel_videos';
const CONC = Number(process.env.CONC) || 60; // 실측 93건/초·오류 0 (2026-09-14). 올려도 이득이 적고 429 위험만 는다.
const CHUNK = Number(process.env.CHUNK) || 1000; // PostgREST가 1000행에서 자른다(max-rows) — 더 키워도 1000만 온다
const MAX = Number(process.env.MAX_PROMOTE) || Infinity; // 이번 실행에서 스캔할 최대 건수(0/미지정=무제한)
// ── 옛 판별기로 찍힌 표식을 무효로 보는 기준선 (2026-09-14) ────────────────────────
// 판별기를 교체했으므로 이 시각 **이전에** 찍힌 short_probed_at은 믿을 수 없다(oardefault 404를
// "가로 확정"으로 읽던 시절의 표식이라 약 2만 건이 세로인데 가로로 굳어 있다).
// ⚠️ 처음엔 `UPDATE ... SET short_probed_at=NULL`로 표식을 지우는 마이그레이션을 쓰려 했는데,
//    29만 행짜리 UPDATE라 Supabase SQL 에디터에서 게이트웨이 타임아웃으로 못 돌린다
//    ("upstream timeout", 사용자 실측). 기준선을 코드에 두면 **SQL을 아예 안 돌려도 된다** —
//    재프로브한 행은 새 시각으로 표식이 갱신되어 자연히 기준선 위로 올라가고, 전량이 올라가면
//    이 조건은 아무것도 안 잡는다(= 스스로 끝난다).
const REPROBE_BEFORE = process.env.REPROBE_BEFORE || '2026-09-14T00:00:00Z';
// DRY_RUN=1: 판별만 해보고 DB에 아무것도 안 쓴다. 판별 로직을 바꿨을 때 실제 데이터로 맞는지 확인하는 용도
// (2026-09-14 판별기 교체 때 쓴 경로). 읽기는 RLS가 열려 있어 공개 anon 키로도 되므로 service_role이 없어도 된다.
const DRY = process.env.DRY_RUN === '1';
const READ_KEY = KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';

if (!KEY && !DRY) {
  console.error('오류: SUPABASE_SERVICE_ROLE 환경변수가 없습니다. service_role 키가 있어야 is_short를 쓸 수 있어요(anon은 RLS에 막힘).');
  console.error('      판별만 확인해보려면 DRY_RUN=1 로 실행하세요(쓰기 없음).');
  process.exit(1);
}
const H = { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` };

// ── JPEG 크기 판독(의존성 없이) — SOF 마커에서 height/width를 읽는다 ──────────────
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null; // SOI 아님
  let o = 2;
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xFF) { o++; continue; }
    let marker = buf[o + 1];
    while (marker === 0xFF && o + 1 < buf.length) { o++; marker = buf[o + 1]; } // 패딩 0xFF 건너뜀
    o += 2;
    if (marker === 0xD8 || marker === 0xD9) continue;              // SOI/EOI: 길이 없음
    if (marker >= 0xD0 && marker <= 0xD7) continue;                // RSTn: 길이 없음
    // SOF0~SOF15 중 실제 프레임 헤더(허프만/산술 테이블 마커 C4/C8/CC 제외)
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      const height = (buf[o + 3] << 8) | buf[o + 4];
      const width = (buf[o + 5] << 8) | buf[o + 6];
      return { width, height };
    }
    const len = (buf[o] << 8) | buf[o + 1]; // 세그먼트 길이(자기 2바이트 포함)
    if (len < 2) return null;
    o += len;
  }
  return null;
}

// ── 1차 판별: 쇼츠 URL 응답 코드 ────────────────────────────────────────────
// youtube.com/shorts/<id>는 쇼츠면 그대로 200을 주고, 아니면 303으로 /watch?v=로 되돌린다.
// HEAD라 본문은 양쪽 다 0바이트다(실측: 쇼츠 GET 1.6MB vs HEAD 0B). 'short' | 'not-short' | null(판정불가).
async function shortsUrlOnce(id) {
  try {
    const r = await fetch(`https://www.youtube.com/shorts/${id}`, {
      method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(9000),
    });
    if (r.status === 200) return 'short';
    if (r.status === 303 || r.status === 302 || r.status === 301) return 'not-short';
    return null; // 404(삭제/비공개)·429·5xx 등 — 확정하지 않고 다음 실행에 다시 본다
  } catch { return null; }
}
// 'not-short'는 한 번 나오면 그 행이 **영구히 가로로 굳는** 판정이다(short_probed_at이 찍혀 다음
// 스윕 후보에서 빠진다). 그래서 303일 때만 한 번 더 확인해서 두 번 다 303일 때만 인정한다.
// 200(쇼츠)은 오탐 방향이 아니라 재확인이 필요 없다.
// ⚠️ 응답 자체는 안정적이다 — 같은 400건을 동시 20/60/200으로 3회 교차 실측했을 때 갈린 id는 0건
//    (2026-09-14). 이 재확인은 성능 손해가 거의 없어서(400건 기준 5초→5초) 넣어두는 보험이지,
//    관측된 흔들림을 막는 장치가 아니다. 스윕 결과 숫자가 실행마다 조금씩 달라 보이는 건 판별이
//    아니라 **표본이 달라서**다 — published_at이 날짜(시분초 없음)라 동률이 많아 `order=published_at
//    .desc&limit=N` 창이 매번 다른 행을 집는다. 이 스윕에선 전량을 훑으므로 문제가 안 된다.
async function shortsUrlSays(id) {
  const a = await shortsUrlOnce(id);
  if (a !== 'not-short') return a;
  await new Promise(r => setTimeout(r, 120));
  const b = await shortsUrlOnce(id);
  return b === 'not-short' ? 'not-short' : b; // 재확인이 200이면 쇼츠, null이면 판정 보류
}

// ── 2차 판별: oardefault.jpg 비율 ───────────────────────────────────────────
// 쇼츠 URL이 아니라고 한 영상 중에도 **3분 넘는 세로 영상**이 있다(쇼츠로는 안 열리지만 9:16이라
// 카드에서는 세로로 떠야 한다). 그건 이 원본비율 썸네일로만 잡힌다.
// 크기 정보(SOF 마커)는 JPEG 앞부분에 있으므로 **첫 8KB만 Range로** 받아 판독한다(2026-09-05) — 세로
// 실제 썸네일을 통째로 받지 않아 대역폭·시간을 아낀다. i.ytimg.com이 Range를 지원함을 실측 확인.
// 드물게 SOF가 8KB 밖이면(진행형 JPEG·큰 EXIF) 판독 실패 → 전체를 다시 받아 정확성을 지킨다.
// 반환: true(세로) | false(가로 — 404 플레이스홀더 포함) | null(네트워크 오류 = 판정 불가)
async function oarIsPortrait(id) {
  const url = `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
  try {
    let r = await fetch(url, { headers: { Range: 'bytes=0-8191' }, signal: AbortSignal.timeout(9000) });
    if (r.status === 404) return false; // oardefault 자체가 없음 = 원본비율 근거 없음
    if (!r.ok && r.status !== 206) return null; // 429·5xx 등은 확정하지 않는다
    let s = jpegSize(Buffer.from(await r.arrayBuffer()));
    if (!s) { // SOF가 앞 8KB 밖(희귀) — 정확성 위해 전체 재요청
      r = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (r.status === 404) return false;
      if (!r.ok) return null;
      s = jpegSize(Buffer.from(await r.arrayBuffer()));
    }
    if (!s) return null; // 이미지는 받았는데 판독 실패 — 가로라고 우기지 않는다
    // 유튜브가 oardefault 없을 때 주는 120x90 회색 플레이스홀더 등은 가로라 자연히 false
    return s.height > s.width;
  } catch { return null; }
}

// 최종 판정: 'short' | 'landscape' | null(판정 불가 — 표식도 안 남기고 다음 실행에 재시도)
async function classify(id) {
  const a = await shortsUrlSays(id);
  if (a === 'short') return 'short';
  const b = await oarIsPortrait(id);
  if (b === true) return 'short';
  // 1차가 "쇼츠 아님"이라고 확실히 말했고 2차도 가로면 확정. 둘 중 하나라도 판정 불가면 보류한다.
  if (a === 'not-short' && b === false) return 'landscape';
  return null;
}

// ── Supabase REST ────────────────────────────────────────────────────────────
const BASE = `is_short=eq.false&tags_manual=eq.false`;
// ⚠️ 정렬은 **id**다(published_at 아님). 실측(2026-09-14, 컷오프 조건 + limit 1000):
//      published_at.desc → 13.5초/청크 (292k 전량이면 조회만 33분)
//      id               → 0.1초/청크  (전량 30초)
//    published_at에는 이 조건을 커버하는 인덱스가 없어 매 청크가 29만 행을 정렬한다. 원래 최신순으로
//    훑은 건 "카드에 실제로 뜨는 최근 영상부터 고치자"는 뜻이었는데, 그건 아래 1단계(신규 유입)가
//    이미 보장한다 — 백로그 순서까지 최신순일 이유는 없다(어차피 한 번 돌면 전량이 끝난다).
// 1단계: 아직 한 번도 안 본 행(신규 유입). 작아서 늘 먼저 끝난다 → 오늘 들어온 영상이 밀리지 않는다.
// 2단계: 옛 판별기 표식이 남은 행(백필). 1단계가 빌 때만 본다.
async function fetchChunk() {
  // DRY_RUN은 **이미 확정된 행**을 다시 보는 게 목적이라 표식 조건을 통째로 뺀다 — 옛 판별이 놓친 게
  // 얼마나 되는지 재는 용도. 쓰기는 어차피 안 일어난다.
  const where = DRY ? '' : `&short_probed_at=is.null`;
  let r = await fetch(`${U}/rest/v1/${TABLE}?select=id&${BASE}${where}&order=id&limit=${CHUNK}`, { headers: H });
  if (!r.ok) throw new Error(`조회 실패 ${r.status}: ${await r.text()}`);
  let rows = await r.json();
  if (rows.length || DRY) return { rows, phase: DRY ? 'dry' : '신규' };
  // 1단계가 비었으면 백필로 넘어간다
  r = await fetch(`${U}/rest/v1/${TABLE}?select=id&${BASE}&short_probed_at=lt.${REPROBE_BEFORE}&order=id&limit=${CHUNK}`, { headers: H });
  if (!r.ok) throw new Error(`조회 실패 ${r.status}: ${await r.text()}`);
  return { rows: await r.json(), phase: '백필' };
}
async function countRemaining() {
  const one = async qs => {
    const r = await fetch(`${U}/rest/v1/${TABLE}?select=id&${qs}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
    return Number((r.headers.get('content-range') || '*/0').split('/')[1]) || 0;
  };
  const [fresh, backfill] = await Promise.all([
    one(`${BASE}&short_probed_at=is.null`),
    one(`${BASE}&short_probed_at=lt.${REPROBE_BEFORE}`),
  ]);
  return { fresh, backfill, total: fresh + backfill };
}
// id 목록에 대해 지정한 patch를 적용(URL 길이 때문에 100개씩 나눠 in()으로)
async function patchByIds(ids, patch) {
  if (DRY) return; // 판별 확인용 실행 — DB는 건드리지 않는다
  for (let i = 0; i < ids.length; i += 100) {
    const slice = ids.slice(i, i + 100);
    const inList = `(${slice.map(x => `"${x}"`).join(',')})`;
    const url = `${U}/rest/v1/${TABLE}?id=in.${encodeURIComponent(inList)}`;
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
    if (!r.ok) throw new Error(`업데이트 실패 ${r.status}: ${await r.text()}`);
  }
}

// 동시 CONC개로 프로브. 판정 불가(unknown)는 어느 쪽에도 안 넣는다 — 표식조차 안 남겨서 다음 실행이 다시 본다.
async function probeAll(ids) {
  const portrait = [], landscape = [];
  let idx = 0;
  const worker = async () => {
    while (idx < ids.length) {
      const id = ids[idx++];
      const v = await classify(id);
      if (v === 'short') portrait.push(id);
      else if (v === 'landscape') landscape.push(id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, worker));
  return { portrait, landscape };
}

async function main() {
  const t0 = Date.now();
  let scanned = 0, promoted = 0;
  try {
    const c = await countRemaining();
    console.log(`[shorts-promote] 남은 후보 ${c.total.toLocaleString()}건 (신규 ${c.fresh.toLocaleString()} · 백필 ${c.backfill.toLocaleString()}) · 동시 ${CONC} · 청크 ${CHUNK}${MAX !== Infinity ? ` · 이번 상한 ${MAX}` : ''}`);
  } catch {}
  let unknownTotal = 0;
  // 판정 불가 행은 표식을 안 남기므로 다음 조회에 **또 뽑힌다** — 한 청크가 통째로 판정 불가면
  // 같은 청크를 무한히 돌 수 있다. 그래서 "이번 실행에서 아무 행도 확정하지 못한 청크"가 연속으로
  // 나오면 멈춘다(유튜브가 일시적으로 막고 있는 상황 — 다음 스케줄에 다시 온다).
  let barrenChunks = 0, lastPhase = '';
  while (scanned < MAX) {
    const { rows, phase } = await fetchChunk();
    if (!rows.length) { console.log('✅ 후보 0 — 전량 실측 완료. 더 처리할 게 없어요.'); break; }
    if (phase !== lastPhase) { console.log(`— ${phase} 단계 시작`); lastPhase = phase; }
    const ids = rows.map(r => r.id);
    const { portrait, landscape } = await probeAll(ids);
    const unknown = ids.length - portrait.length - landscape.length;
    // 각 id를 정확히 한 번씩만 PATCH한다(예전엔 승격분을 두 번 건드림). 세로=is_short+표식, 가로=표식만.
    // 두 그룹은 서로 다른 행이라 동시에 보내도 안전 — 청크당 PATCH 왕복을 절반으로 줄인다.
    const now = new Date().toISOString();
    await Promise.all([
      portrait.length ? patchByIds(portrait, { is_short: true, short_probed_at: now }) : null,
      landscape.length ? patchByIds(landscape, { short_probed_at: now }) : null,
    ].filter(Boolean));
    scanned += ids.length;
    promoted += portrait.length;
    unknownTotal += unknown;
    const rate = (scanned / ((Date.now() - t0) / 1000)).toFixed(0);
    console.log(`  +${portrait.length} 쇼츠 (누적 승격 ${promoted} · 스캔 ${scanned} · ${rate}건/초${unknown ? ` · 판정불가 ${unknown}` : ''})`);
    // DRY_RUN은 쓰기를 안 하므로 다음 조회가 같은 청크를 또 준다 — 한 청크만 재고 끝낸다.
    if (DRY) { console.log(`[DRY_RUN] 표본 ${ids.length}건 중 실제 쇼츠 ${portrait.length}건(${(portrait.length / ids.length * 100).toFixed(1)}%) · 가로 ${landscape.length} · 판정불가 ${unknown} — DB 변경 없음`); break; }
    if (portrait.length + landscape.length === 0) {
      if (++barrenChunks >= 3) { console.log('⚠️ 3청크 연속 아무것도 확정 못 함 — 유튜브 응답 이상으로 보고 중단합니다(다음 실행에 재시도).'); break; }
    } else barrenChunks = 0;
  }
  console.log(`[shorts-promote] 끝 — 스캔 ${scanned} · 승격 ${promoted}${unknownTotal ? ` · 판정불가 ${unknownTotal}(표식 안 남김, 다음 실행이 재시도)` : ''} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
