#!/usr/bin/env node
// 같은 발매 중복 전수 정리 — 출처 무관(멜론·스포티파이·레거시), 그룹·멤버·유닛 디스코 전부 (2026-10-15)
//
// 왜: 도경수 BLISS가 두 장(레거시 'BLISS' + 멜론 'The 1st full album [BLISS]')이었다(사용자 제보). 기존 테스트
// (tests/disco-cross-source-dupes.test.js)는 "멜론 항목 ↔ 다른 출처, 트랙 수 같음"만 봐서 그 밖의 조합은 못 잡는다.
// 판정: 같은 주인 디스코 · 발매일 ±1일 · 변형판끼리가 아님, 그리고
//   (a) 같은 멜론 번호(melonAlbumId·melonVia·커버 주소 번호 중 겹침) — 단 melonVia는 '그 곡이 든 본 앨범' 연결이라 via끼리만으론 안 묶음
//   (b) 수록곡 제목이 짧은 쪽 기준 80% 이상 겹침
//   (c) 제목이 서로를 포함(괄호·따옴표 벗긴 핵심) + 곡이 1개 이상 겹치거나 둘 다 곡 목록 없음
// 예외: 둘 다 feat. 표기인데 피처링 라틴 표기가 다르면 별개 버전(르세라핌 BOOMPALA, 기존 테스트와 같은 규칙).
// 처리: 남길 항목 = 멜론 > 레거시(출처 없음) > 스포티파이. 지우는 쪽의 spotifyId·melonAlbumId·cover·titleTrack·곡 번호를 옮긴다
//   (spotifyId를 옮겨야 다음 스포티파이 수집이 다시 안 넣는다). 제목은 멜론 제목이 레거시 제목을 감싸기만 한 경우
//   ("The 1st full album [BLISS]"·"3rd Mini Album 'INSIDE ME'") 레거시 쪽, 아니면(레거시가 잘린 'LAY 02 SHE') 멜론 쪽.
// 실행: node tools/disco_dupe_merge.mjs [--apply]  → 뒤에 build_slim_data → validate
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const APPLY = process.argv.includes('--apply');
const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const tnorm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^0-9a-z가-힣]/g, '');
const core = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^0-9a-z가-힣]/g, '');
const VER_RE = /\b(clean|explicit|extended|remix(es)?|inst(rumental)?|sped\s*up|slowed|acoustic|chinese|english|japanese|korean|spanish|special(?!\s*(?:single|album))|deluxe|repackage|edition|ver\.?|version|tv\s*size|live|mr)\b|리패키지|스페셜|버전/gi;
const verTags = s => [...new Set((String(s || '').match(VER_RE) || []).map(x => x.toLowerCase().replace(/\s+/g, '')))].sort().join(',') + '|' + (/feat\.?/i.test(s || '') ? 'f' : '');
// 핵심 제목 — '- N집' 꼬리표·', Vol. 1'·따옴표 감싸기를 벗긴다
const base = s => core(String(s || '').replace(/\s*-\s*\d+(\.\d+)?\s*집.*$/, '').replace(/,?\s*vol\.?\s*\d+\s*$/i, ''));
const day = s => { const p = String(s || '').split(/[.\-]/).map(Number); return p[0] ? Date.UTC(p[0], (p[1] || 1) - 1, p[2] || 1) / 864e5 : NaN; };
const coverId = al => ((al.cover || '').match(/cdnimg\.melon\.co\.kr\/cm2?\/album\/images\/\d+\/\d+\/\d+\/(\d+)_/) || [])[1];
const srcRank = al => al.src === 'melon' || (al.melonAlbumId && al.src !== 'spotify') ? 0 : !al.src ? 1 : 2;
const featOf = s => ((String(s).match(/feat\.?\s*([^)\]]+)/i) || [])[1] || '').trim();
const latin = s => /^[\x00-\x7f]+$/.test(s);
function same(a, b) {
  if (a === b || !a || !b || typeof a !== 'object' || typeof b !== 'object') return null;
  if (a.variant && b.variant) return null;
  const da = day(a.releaseDate), db = day(b.releaseDate);
  if (isNaN(da) || isNaN(db) || Math.abs(da - db) > 1) return null;
  const fa = featOf(a.title), fb = featOf(b.title);
  if (fa && fb && latin(fa) && latin(fb) && tnorm(fa) !== tnorm(fb)) return null;
  // 버전이 다르면 별개 발매(Clean·Extended·Chinese Ver.·Special Edition·리패키지 등) — 65쌍 1차 결과에서 대부분이 이것이었다
  if (verTags(a.title) !== verTags(b.title)) return null;
  // 라이브 앨범은 세트리스트가 겹친다(FNC 2020.09.01 일괄 디지털 발매) — 멜론 번호가 같을 때만
  const live = x => x.type === '라이브' || /^live\b/i.test(x.title || '');
  const ida = [a.melonAlbumId, coverId(a)].filter(Boolean), idb = [b.melonAlbumId, coverId(b)].filter(Boolean);
  const ta = (a.tracks || []).map(t => tnorm(t && t.title || t)).filter(Boolean), tb = new Set((b.tracks || []).map(t => tnorm(t && t.title || t)).filter(Boolean));
  const ov = ta.filter(x => tb.has(x)).length, mn = Math.min(ta.length, tb.size);
  // 멜론 번호가 서로 다르면 멜론에서도 별개 발매다(우영 R.O.S.E 일본반/한국어판, 수현 '월간 더 스테이지' 두 싱글)
  if (a.melonAlbumId && b.melonAlbumId && a.melonAlbumId !== b.melonAlbumId) return null;
  // 권 번호가 다르면 별개(B1A4 Miracle Radio vol.1~5)
  const vol = s => (String(s || '').match(/vol\.?\s*(\d+)/i) || [])[1];
  if (vol(a.title) && vol(b.title) && vol(a.title) !== vol(b.title)) return null;
  const ba = base(a.title), bb = base(b.title);
  const related = ba && bb && (ba === bb || ((ba.includes(bb) || bb.includes(ba)) && Math.min(ba.length, bb.length) >= 3));
  const tracksAgree = mn === 0 || ov >= mn / 2; // 한쪽이 곡 목록 없음 또는 절반 이상 겹침
  // (a) 멜론 번호 — 제목이 관련 있고 곡이 어긋나지 않을 때(빅뱅 'BIGBANG' 정규↔'BigBang Is V.I.P' 싱글은 커버 번호만 같고 곡 0 겹침,
  //     제로베이스원 AFTERGLOW↔CINEMA PARADISE는 번호가 잘못 붙음)
  if (ida.some(x => idb.includes(x)) && ((related && tracksAgree) || (mn > 0 && ov >= mn / 2))) return 'melon번호';
  if (live(a) || live(b)) return null;
  // (b) 곡 겹침 — 출처가 다른 경우만(같은 출처끼리 곡만 겹치는 건 별개 싱글일 수 있다: 박정민 Love sick/태어나줘서 고마워)
  if (srcRank(a) !== srcRank(b) && mn > 0 && ov >= Math.max(1, Math.ceil(mn * 0.8)) && Math.abs(ta.length - tb.size) <= Math.max(2, mn * 0.5)) return `곡 ${ov}/${mn}`;
  // (c) 제목 — 'N집' 꼬리표만 다르면 같은 앨범(S.E.S. Love / LOVE - 3집). 같은 출처끼리는 핵심 제목이 정확히 같을 때만
  //     (SM THE BALLAD 'Breath'/'Breath Set Me Free', 오렌지캬라멜 OST Part.8/Vol.2는 포함 관계일 뿐 별개)
  if (ba && ba === bb && tracksAgree) return '제목';
  if (related && ov > 0 && srcRank(a) !== srcRank(b)) return '제목';
  // 1~2곡 싱글은 곡 제목 표기가 한/영으로 갈려 안 겹친다(현아 '못 (Mrs. Nail)'/'Mrs. Nail') — 출처가 다르고 곡 수가 같으면 같은 발매
  if (related && srcRank(a) !== srcRank(b) && ta.length && ta.length === tb.size && ta.length <= 2) return '제목·싱글';
  return null;
}
function merge(keep, drop) {
  for (const k of ['spotifyId', 'melonAlbumId', 'cover', 'titleTrack', 'trackCount']) if (!keep[k] && drop[k]) keep[k] = drop[k];
  if (drop.isMain && !keep.isMain) keep.isMain = true;
  // 차수: 멜론 타입이 '정규'뿐이고 지우는 쪽이 '정규 1집'이면 숫자를 살린다(도경수 BLISS)
  if (keep.type && drop.type && /^\D+$/.test(keep.type) && new RegExp(`^${keep.type}\\s*\\d+집$`).test(drop.type)) keep.type = drop.type;
  if ((drop.tracks || []).length > (keep.tracks || []).length && srcRank(keep) > 0) keep.tracks = drop.tracks;
  else for (const t of keep.tracks || []) { if (t.songId) continue; const h = (drop.tracks || []).find(x => x.songId && tnorm(x.title) === tnorm(t.title)); if (h) t.songId = h.songId; }
  // 제목: 멜론 제목이 레거시 제목을 따옴표·괄호로 감싸기만 했으면 깔끔한 쪽
  const m = srcRank(keep) === 0 ? keep : drop, o = m === keep ? drop : keep;
  if (m !== o && o.title && core(o.title).length >= 2) {
    const esc = o.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`['′‘’"“”\\[「]\\s*${esc}\\s*['′‘’"“”\\]」]`, 'i').test(m.title)) keep.title = o.title;
  }
}
const log = []; let pairs = 0;
function scan(list, who) {
  if (!Array.isArray(list)) return list;
  const drop = new Set();
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (drop.has(i) || drop.has(j)) continue;
    const why = same(list[i], list[j]); if (!why) continue;
    const [k, d] = srcRank(list[i]) <= srcRank(list[j]) ? [i, j] : [j, i];
    const before = list[k].title;
    log.push(`${who} | ${list[k].releaseDate} 남김[${list[k].src || '레거시'}] ${before}  ✕  지움[${list[d].src || '레거시'}] ${list[d].title}  (${why})`);
    merge(list[k], list[d]); if (list[k].title !== before) log[log.length - 1] += `  → 제목 '${list[k].title}'`;
    drop.add(d); pairs++;
  }
  return list.filter((_, i) => !drop.has(i));
}
for (const [ko, g] of Object.entries(groups)) if (g.discography) g.discography = scan(g.discography, ko);
for (const a of artists) {
  const who = `${a.name.ko}(${a.group.ko})`;
  if (a.discography) a.discography = scan(a.discography, who);
  for (const u of a.unitDiscography || []) if (u.albums) u.albums = scan(u.albums, who + '/' + u.unitName);
}
console.log(log.join('\n'));
console.log(`\n중복 ${pairs}쌍${APPLY ? ' · 저장함' : ' · 읽기 전용'}`);
if (APPLY && pairs) {
  const keep = f => ((/^[[{]\r?\n([ \t]+)/.exec(fs.readFileSync(P(f), 'utf8')) || [])[1] || '  ').length;
  fs.writeFileSync(P('groups.json'), JSON.stringify(groups, null, keep('groups.json')) + '\n');
  fs.writeFileSync(P('artists.json'), JSON.stringify(artists, null, keep('artists.json')) + '\n');
}
