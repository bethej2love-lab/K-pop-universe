// 솔로 디스코 일괄 채우기 — 멜론에서 재수집해 artists.json의 `discography`에 병합 (2026-08-25 신설)
//
// 배경: `soloDiscography`(Apple Music 스크레이핑 구버전)는 2026-08-23에 **신뢰 불가 판정**을 받은
// 죽은 필드다(유령 앨범·동명이인 실측 사례). 화면은 `discography`만 읽으므로, 이 필드만 가진 사람은
// 카드에 앨범이 거의 안 뜬다(수지: 2장만 노출, 실제 21장). 방침은 "옮기지 말고 멜론에서 새로 긁기".
//
// ⚠️ 동명이인 방어가 이 도구의 핵심이다 — 예전 "멜론 이름검색 스윕"이 동명이인 오매칭을 대량 유발한
//    이력이 있다(준→JUNE래퍼, 소연(티아라)→전소연 디스코 통째 등). 그래서 검색 결과를 그대로 믿지 않고,
//    **후보 aid의 앨범 목록이 그 사람의 기존 discography 제목과 겹치는지**로 검증해 최고 점수만 채택한다.
//    겹치는 게 없으면 건너뛴다(=잘못 채우느니 안 채운다).
//
// ⚠️ 멜론 함정(실측):
//   - albumPaging.startIndex는 페이지 번호가 아니라 **행 인덱스(1-base)**
//   - 앨범유형은 **상세에 없고 목록의 `vdo_name`([싱글]/[EP]…)에만** 있음
//   - 멜론이 OST를 [싱글]로 표기하는 경우가 많음 → 제목의 'OST'로 재분류(type:'OST'+feat:true)
//   - 제목/트랙 공백이 raw U+00A0 → 정규화 필수
//   - 솔로 판별은 목록의 `class="play_artist"` aid (개인 페이지엔 그룹 앨범도 섞여 나옴)
//
// 실행: node tools/melon_solo_fill.mjs 솔라 휘인 태연        (이름 나열)
//       node tools/melon_solo_fill.mjs --top 8               (soloDiscography 격차 상위 N명)
//       node tools/melon_solo_fill.mjs --top 8 --dry         (파일 안 고치고 결과만)
//       node tools/melon_solo_fill.mjs 키=614026             (aid 직접 지정 — 자동검증 우회)
//
// aid 직접 지정이 필요한 경우: 기존 discography가 비었거나(검증 기준 없음), 멜론이 제목에 접미사를
// 붙여("Gasoline - The 2nd Album") 제목 겹침이 0으로 나오는 경우. 이때 aid는 tools/aid_probe 식으로
// **멜론 아티스트 상세의 소속그룹/유형을 눈으로 확인한 뒤** 넘길 것(자동검증을 끄는 옵션이라 위험).
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const topIdx = argv.indexOf('--top');
const TOP = topIdx !== -1 ? Number(argv[topIdx + 1] || 5) : 0;
const names = argv.filter(a => !a.startsWith('--') && a !== String(TOP));

// ⚠️ 멜론은 한 세션에서 요청이 많아지면 **HTTP 406에 정상 크기의 HTML 안내페이지**를 준다.
//    길이만 보고 성공으로 치면 파싱 결과가 0건이 되어 "멜론 후보 없음 — 건너뜀"으로 조용히 넘어간다
//    (실제로 겪음: 차단 중인데 대상 전원이 스킵돼 아무 일도 안 일어난 것처럼 보임).
//    그래서 상태코드를 같이 받아 200만 성공으로 보고, 차단이면 크게 알리고 중단한다.
let blocked = 0;
const get = url => {
  for (let t = 0; t < 3; t++) {
    try {
      const b = execFileSync('curl', ['-sk', '-L', '-m', '45', '-A', UA, '-w', '\\n@@HTTP:%{http_code}', url], { maxBuffer: 1 << 28, encoding: 'binary' });
      const s = Buffer.from(b, 'binary').toString('utf8');
      const i = s.lastIndexOf('\n@@HTTP:');
      const code = i === -1 ? 0 : Number(s.slice(i + 8).trim());
      const body = i === -1 ? s : s.slice(0, i);
      if (code === 200 && body.length > 400) { blocked = 0; return body; }
      if (code === 406 || code === 429) {
        if (++blocked >= 3) {
          console.error(`\n❌ 멜론이 요청을 차단 중(HTTP ${code}). 잠시 뒤 다시 실행할 것 — 지금 계속하면 전원 "후보 없음"으로 잘못 스킵된다.`);
          process.exit(3);
        }
        execFileSync('curl', ['-s', '-m', '10', '-o', process.platform === 'win32' ? 'NUL' : '/dev/null', 'https://www.melon.com/']); // 짧은 텀
      }
    } catch (e) { }
  }
  return '';
};
const dec = s => String(s || '').replace(/&nbsp;/gi, ' ').replace(/ /g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, ' ').trim();
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');

function listAlbums(aid) {
  const rows = []; const seen = new Set();
  for (let idx = 1, g = 0; g < 30; g++, idx += 50) {
    const html = get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${idx}&pageSize=50&orderBy=ISSUE_DATE&artistId=${aid}`);
    const blocks = html.split('<li class="album11_li">').slice(1);
    if (!blocks.length) break;
    let added = 0;
    for (const b of blocks) {
      const id = (b.match(/goAlbumDetail\('(\d+)'/) || [])[1];
      if (!id || seen.has(id)) continue; seen.add(id); added++;
      rows.push({
        id,
        type: dec((b.match(/class="vdo_name">\[([^\]]+)\]/) || [])[1] || ''),
        title: dec((b.match(/goAlbumDetail\('\d+'\);"[^>]*class="ellipsis"[^>]*title="([^"]*?) - 페이지 이동"/) || [])[1] || ''),
        date: dec((b.match(/class="cnt_view">([\d.]+)</) || [])[1] || ''),
        titleTrack: dec((b.match(/class="songname12">([^<]*)</) || [])[1] || ''),
        aids: [...new Set([...b.matchAll(/goArtistDetail\('(\d+)'\);"[^>]*class="play_artist"/g)].map(m => m[1]))],
      });
    }
    if (!added) break;
  }
  return rows;
}

// 검색 → 후보 aid들 → 기존 discography 제목 겹침으로 검증
function resolveAid(a) {
  const q = encodeURIComponent(a.name.ko);
  const html = get(`https://www.melon.com/search/total/index.htm?q=${q}&section=&searchGnbYn=Y&kkoSpl=Y&kkoDpType=`);
  const cands = [...new Set([...html.matchAll(/goArtistDetail\('?(\d+)/g)].map(m => m[1]))].slice(0, 6);
  const known = new Set((a.discography || []).map(d => norm(d.title)).filter(t => t.length >= 2));
  let best = null;
  for (const aid of cands) {
    const rows = listAlbums(aid);
    if (!rows.length) continue;
    const hit = rows.filter(r => known.has(norm(r.title))).length;
    if (!best || hit > best.hit) best = { aid, rows, hit };
    if (hit >= 2) break; // 충분히 확실하면 조기 종료(요청 절약)
  }
  return best;
}

function build(rows, aid) {
  const solo = rows.filter(r => r.aids.length === 1 && r.aids[0] === aid)
    .sort((x, y) => x.date.localeCompare(y.date));
  for (const r of solo) {
    const h = get(`https://www.melon.com/album/detail.htm?albumId=${r.id}`);
    r.cover = (h.match(/https:\/\/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/[^"?\s]+/) || [])[0] || '';
    r.tracks = [...h.matchAll(/title="([^"]*?) 곡 선택"/g)].map(m => dec(m[1]));
  }
  return solo.map(r => {
    const ost = /OST/i.test(r.title) || r.type === 'OST';
    const rec = {
      title: r.title,
      type: ost ? 'OST' : (r.type === 'EP' ? '미니' : (r.type === '정규' ? '정규' : '싱글')),
      releaseDate: r.date,
      trackCount: r.tracks.length,
      isMain: true,
      titleTrack: r.titleTrack || '',
      cover: r.cover || '',
      tracks: r.tracks.map((t, i) => ({ no: i + 1, title: t, isTitle: t === r.titleTrack })),
    };
    if (ost) rec.feat = true;
    return rec;
  });
}

// ── 실행 ──────────────────────────────────────────────────────────────────
const raw = fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8');
const A = JSON.parse(raw);
if (JSON.stringify(A, null, 2) !== raw) { console.error('❌ artists.json 포맷 가정이 깨짐 — 중단(그냥 쓰면 전 파일이 재포맷됨)'); process.exit(2); }

let targets = names;
if (TOP) {
  targets = A.filter(a => (a.soloDiscography || []).length > (a.discography || []).length)
    .sort((x, y) => ((y.soloDiscography || []).length - (y.discography || []).length) - ((x.soloDiscography || []).length - (x.discography || []).length))
    .slice(0, TOP).map(a => a.name.ko);
}
console.log('대상:', targets.join(', '), DRY ? '(dry-run)' : '');

const keyOf = x => `${(x.releaseDate || '').replace(/[.\-]/g, '')}|${norm(x.title)}`;
const summary = [];
for (const spec of targets) {
  const [ko, forcedAid] = String(spec).split('=');
  const a = A.find(x => x.name.ko === ko);
  if (!a) { summary.push(`⚠️ ${ko}: 로스터에 없음`); continue; }
  process.stderr.write(`\n[${ko}] 멜론 조회…${forcedAid ? ` (aid ${forcedAid} 수동 지정)` : ''}\n`);
  const found = forcedAid
    ? (r => r.length ? { aid: forcedAid, rows: r, hit: -1 } : null)(listAlbums(forcedAid))
    : resolveAid(a);
  if (!found) { summary.push(`⚠️ ${ko}: 멜론 후보 없음 — 건너뜀`); continue; }
  if (found.hit === 0) { summary.push(`⚠️ ${ko}: aid ${found.aid} 검증 실패(기존 앨범과 제목 겹침 0) — 동명이인 위험, 건너뜀`); continue; }
  const built = build(found.rows, found.aid);
  const before = (a.discography || []).length;
  const have = new Set((a.discography || []).map(keyOf));
  // ⚠️ 같은 앨범인데 제목 표기가 달라 중복되는 사례가 많다(실측):
  //    기존 "[미니 6집] Letter To Myself" vs 멜론 "[미니] Letter To Myself - The 6th Mini Album".
  //    키가 다르니 위 have 체크를 통과해 카드에 같은 앨범이 두 번 뜬다.
  //    → 같은 발매일 + 기존 제목이 멜론 제목에 통째로 들어있으면 같은 앨범으로 보고 버린다.
  //      (기존 쪽이 '몇 집'까지 있어 정보량이 많으므로 기존을 남긴다)
  const sameDay = {};
  (a.discography || []).forEach(d => {
    const k = (d.releaseDate || '').replace(/[.\-]/g, '');
    (sameDay[k] = sameDay[k] || []).push(norm(d.title));
  });
  const isRestated = r => (sameDay[(r.releaseDate || '').replace(/[.\-]/g, '')] || [])
    .some(t => t.length >= 2 && norm(r.title).includes(t));
  const add = built.filter(r => !have.has(keyOf(r)) && !isRestated(r));
  a.discography = [...(a.discography || []), ...add]
    .sort((x, y) => String(y.releaseDate || '').replace(/[.\-]/g, '').localeCompare(String(x.releaseDate || '').replace(/[.\-]/g, '')));
  const hadSolo = (a.soloDiscography || []).length;
  if (add.length) delete a.soloDiscography; // 방침: 손댄 사람은 죽은 필드 제거
  summary.push(`✅ ${ko}: ${before} → ${a.discography.length}장 (+${add.length}, aid ${found.aid}, 검증 겹침 ${found.hit}, soloDisco ${hadSolo}장 제거)`);
}
if (!DRY) fs.writeFileSync(path.join(ROOT, 'artists.json'), JSON.stringify(A, null, 2));
console.log('\n=== 결과 ===');
summary.forEach(s => console.log('  ' + s));
console.log(DRY ? '\n(dry-run — 파일 안 고침)' : '\n저장 완료');
