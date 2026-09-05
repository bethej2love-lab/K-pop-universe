// 가로→쇼츠 일괄 승격 — 서버 백그라운드 스윕 (2026-08-31)
//
// 브라우저 승격 버튼(admin.js _ytSweepPromoteShorts)과 같은 일을 하되, 회사님 탭을 켜놓고 기다릴
// 필요 없이 서버(GitHub Actions)에서 돈다. 브라우저는 같은 호스트(i.ytimg.com)에 동시 6개밖에 못
// 붙어 ~90분 걸렸는데, Node는 그 제한이 없어 동시 CONC개(기본 100)로 훨씬 빠르다.
//
// 판별: 영상마다 oardefault.jpg(원본 비율 유지 썸네일)를 받아 세로(height>width)면 쇼츠
//   → is_short=true 승격. 세로가 아니거나 이미지가 없으면 가로로 확정.
// 표식: 확인한 행은 전부 short_probed_at을 채운다(shorts_probe_migration.sql) → 다음 실행은
//   short_probed_at IS NULL만 골라 재프로브 0. 후보가 0이 되면 자연 종료(밀린 것 다 처리됨).
// 안전: 강등(쇼츠→가로)은 안 한다. tags_manual 행은 건드리지 않는다(수동 편집 보호). 최신순으로
//   훑어 카드·Trend·favnew에 실제로 뜨는 최근 영상부터 여백이 사라지게 한다.
//
// 실행: SUPABASE_SERVICE_ROLE=<service_role 키> node tools/shorts_promote.mjs
//   (service_role 키만 is_short 쓰기가 가능하다 — anon 키는 RLS에 막힘. GitHub Actions에서는
//    레포 Secrets의 SUPABASE_SERVICE_ROLE로 주입된다.)
// 옵션 env: MAX_PROMOTE(이번 실행 상한, 기본 무제한) · CONC(동시 프로브, 기본 100) · CHUNK(기본 500)

const U = process.env.SUPABASE_URL || 'https://dukgguehegnembimqvkm.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE;
const TABLE = 'yt_channel_videos';
const CONC = Number(process.env.CONC) || 100;
const CHUNK = Number(process.env.CHUNK) || 500;
const MAX = Number(process.env.MAX_PROMOTE) || Infinity; // 이번 실행에서 스캔할 최대 건수(0/미지정=무제한)

if (!KEY) {
  console.error('오류: SUPABASE_SERVICE_ROLE 환경변수가 없습니다. service_role 키가 있어야 is_short를 쓸 수 있어요(anon은 RLS에 막힘).');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

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

// oardefault.jpg가 세로(쇼츠)인지 실측. 없거나(가로 확정) 판독 실패면 false.
// 크기 정보(SOF 마커)는 JPEG 앞부분에 있으므로 **첫 8KB만 Range로** 받아 판독한다(2026-09-05) — 세로
// 실제 썸네일을 통째로 받지 않아 대역폭·시간을 아낀다. i.ytimg.com이 Range를 지원함을 실측 확인.
// 드물게 SOF가 8KB 밖이면(진행형 JPEG·큰 EXIF) 판독 실패 → 전체를 다시 받아 정확성을 지킨다.
async function isPortrait(id) {
  const url = `https://i.ytimg.com/vi/${id}/oardefault.jpg`;
  try {
    let r = await fetch(url, { headers: { Range: 'bytes=0-8191' }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return false; // 404(oardefault 없음)=가로. 206/200이면 아래로.
    let s = jpegSize(Buffer.from(await r.arrayBuffer()));
    if (!s) { // SOF가 앞 8KB 밖(희귀) — 정확성 위해 전체 재요청
      r = await fetch(url, { signal: AbortSignal.timeout(9000) });
      if (!r.ok) return false;
      s = jpegSize(Buffer.from(await r.arrayBuffer()));
    }
    // 유튜브가 oardefault 없을 때 주는 120x90 회색 플레이스홀더 등은 가로라 자연히 false
    return !!(s && s.height > s.width);
  } catch { return false; }
}

// ── Supabase REST ────────────────────────────────────────────────────────────
async function fetchChunk() {
  // short_probed_at IS NULL AND is_short=false AND tags_manual=false, 최신순, 부분 인덱스가 커버
  const url = `${U}/rest/v1/${TABLE}?select=id`
    + `&is_short=eq.false&tags_manual=eq.false&short_probed_at=is.null`
    + `&order=published_at.desc&limit=${CHUNK}`;
  const r = await fetch(url, { headers: H });
  if (!r.ok) throw new Error(`조회 실패 ${r.status}: ${await r.text()}`);
  return r.json();
}
async function countRemaining() {
  const url = `${U}/rest/v1/${TABLE}?select=id&is_short=eq.false&tags_manual=eq.false&short_probed_at=is.null`;
  const r = await fetch(url, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') || '*/?';
  return cr.split('/')[1];
}
// id 목록에 대해 지정한 patch를 적용(URL 길이 때문에 100개씩 나눠 in()으로)
async function patchByIds(ids, patch) {
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

// 동시 CONC개로 프로브
async function probeAll(ids) {
  const portrait = [];
  let idx = 0;
  const worker = async () => {
    while (idx < ids.length) {
      const id = ids[idx++];
      if (await isPortrait(id)) portrait.push(id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONC, ids.length) }, worker));
  return portrait;
}

async function main() {
  const t0 = Date.now();
  let scanned = 0, promoted = 0;
  try { console.log(`[shorts-promote] 남은 후보 약 ${await countRemaining()}건 · 동시 ${CONC} · 청크 ${CHUNK}${MAX !== Infinity ? ` · 이번 상한 ${MAX}` : ''}`); } catch {}
  while (scanned < MAX) {
    const rows = await fetchChunk();
    if (!rows.length) { console.log('✅ 후보 0 — 전량 실측 완료. 더 처리할 게 없어요.'); break; }
    const ids = rows.map(r => r.id);
    const portrait = await probeAll(ids);
    // 각 id를 정확히 한 번씩만 PATCH한다(예전엔 승격분을 두 번 건드림). 세로=is_short+표식, 나머지=표식만.
    // 두 그룹은 서로 다른 행이라 동시에 보내도 안전 — 청크당 PATCH 왕복을 절반으로 줄인다.
    const now = new Date().toISOString();
    const portraitSet = new Set(portrait);
    const nonPortrait = ids.filter(id => !portraitSet.has(id));
    await Promise.all([
      portrait.length ? patchByIds(portrait, { is_short: true, short_probed_at: now }) : null,
      nonPortrait.length ? patchByIds(nonPortrait, { short_probed_at: now }) : null,
    ].filter(Boolean));
    scanned += ids.length;
    promoted += portrait.length;
    const rate = (scanned / ((Date.now() - t0) / 1000)).toFixed(0);
    console.log(`  +${portrait.length} 쇼츠 (누적 승격 ${promoted} · 스캔 ${scanned} · ${rate}건/초)`);
  }
  console.log(`[shorts-promote] 끝 — 스캔 ${scanned} · 승격 ${promoted} · ${((Date.now() - t0) / 1000).toFixed(0)}초`);
}

main().catch(e => { console.error('실패:', e.message); process.exit(1); });
