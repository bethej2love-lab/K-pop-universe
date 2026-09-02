// 슬림 데이터 생성 — 초기 로드에서 discography를 떼어낸다 (2026-08-31)
//
// 원본(groups.json·artists.json)은 그대로 두고(수정 스크립트들이 계속 이 파일을 씀), 여기서 파생물만
// 만든다. sitemap/SEO 페이지를 build_group_pages.js가 자동 생성하는 것과 같은 "source→artifact" 구조.
//
// 생성물:
//   groups.slim.json / artists.slim.json  — discography·unitDiscography 뺀 초기 로드용(앱이 이걸 로드)
//   disco/g/{그룹}.json                    — 그룹 카드 열 때 로드({g:그룹앨범, m:{멤버:{d,u}}})
//   disco/a/{그룹}__{이름}.json            — 무소속 솔로 카드용({d,u})
//   tracks_index.json                      — 곡 검색(_buildSongIndex) + 피드 b-side(_groupBsideIndex) 공용.
//                                            트랙 제목만 담아 가볍다. 검색/피드 첫 사용 때 lazy 로드.
//
// ⚠️ tracks_index는 원본 트랙을 그대로 담는다(Inst./MR 필터는 런타임이 기존대로 적용). 앨범 상세의
//    커버·발매일·트랙번호 같은 무거운 필드는 disco/ 파일에만 있다.
// ⚠️ fileKey는 런타임(index.html)과 반드시 동일해야 한다 — 여기 규칙을 바꾸면 앱 쪽도 같이 바꿀 것.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const gz = s => zlib.gzipSync(Buffer.from(s)).length;
const kb = n => (n / 1024).toFixed(0) + 'KB';

// 파일명 안전화 — 경로 구분자만 치환하고 끝의 점/공백 정리(SEO 페이지 urlSafeKo와 같은 취지).
// 그 외 한글·괄호는 그대로 둔다(이 호스트는 이미 한글 경로 정적 파일 g/에스파/ 를 서빙함).
const fileKey = s => String(s).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');

const groups = rd('groups.json');           // 객체 {ko:{...,discography}}
const artists = rd('artists.json');          // 배열 [{name,group,discography?,unitDiscography?,...}]
if (!Array.isArray(artists)) throw new Error('artists.json이 배열이 아님 — 구조 확인 필요');

const discoDir = path.join(ROOT, 'disco');
fs.rmSync(discoDir, { recursive: true, force: true }); // 이전 생성물 정리(고아 파일 방지)
fs.mkdirSync(path.join(discoDir, 'g'), { recursive: true });
fs.mkdirSync(path.join(discoDir, 'a'), { recursive: true });

const groupBuckets = {};                     // gko -> {g:[]|null, m:{이름:{d,u}}}
const soloFiles = [];                        // {name, data}
const tracks = { groups: {}, members: {} };  // tracks_index 원자료
let trackCount = 0;
const pushTracks = (dest, disco) => {
  for (const al of (disco || [])) for (const t of (al.tracks || [])) {
    if (t && t.title) { dest.push([t.title, t.isTitle ? 1 : 0, al.title || '']); trackCount++; }
  }
};

// ── 그룹 ──
for (const gko of Object.keys(groups)) {
  const disco = groups[gko].discography;
  if (disco && disco.length) {
    (groupBuckets[gko] ??= { g: null, m: {} }).g = disco;
    pushTracks(tracks.groups[gko] ??= [], disco); // b-side는 그룹 트랙만 봄
  }
}

// ── 아티스트 ──
const collisions = [];
for (const a of artists) {
  const nm = a.name?.ko, gko = a.group?.ko;
  const d = a.discography, u = a.unitDiscography;
  const hasD = d && d.length, hasU = u && u.length;
  if (!hasD && !hasU) continue;
  if (!nm || !gko) { collisions.push('이름/그룹 없는 아티스트: ' + JSON.stringify(a.name)); continue; }
  if (hasD) pushTracks(tracks.members[nm + '\u0000' + gko] ??= [], d); // 검색은 솔로 discography만(unitDiscography는 인덱스 안 함)
  if (groups[gko]) {                          // 실존 그룹 → 그룹 파일에 번들
    const b = (groupBuckets[gko] ??= { g: null, m: {} });
    if (b.m[nm]) collisions.push('그룹 내 동명 멤버: ' + gko + '/' + nm);
    b.m[nm] = { d: d || null, u: u || null };
  } else {                                    // 무소속 솔로 → 개별 파일
    soloFiles.push({ name: fileKey(gko) + '__' + fileKey(nm), data: { d: d || null, u: u || null } });
  }
}
if (collisions.length) { console.error('⚠️ 키 충돌/이상:\n  ' + collisions.join('\n  ')); process.exit(1); }

// ── 파일 쓰기 ──
let gFiles = 0, aFiles = 0, discoBytes = 0;
const wr = (p, obj) => { const s = JSON.stringify(obj); fs.writeFileSync(p, s); discoBytes += Buffer.byteLength(s); };
for (const gko of Object.keys(groupBuckets)) { wr(path.join(discoDir, 'g', fileKey(gko) + '.json'), groupBuckets[gko]); gFiles++; }
for (const s of soloFiles) { wr(path.join(discoDir, 'a', s.name + '.json'), s.data); aFiles++; }

// 슬림 원본(discography·unitDiscography 제거)
const groupsSlim = JSON.parse(JSON.stringify(groups));
for (const k of Object.keys(groupsSlim)) delete groupsSlim[k].discography;
const artistsSlim = JSON.parse(JSON.stringify(artists));
for (const a of artistsSlim) { delete a.discography; delete a.unitDiscography; }

// ── 집계·시각화용 파생 필드 (2026-09-02) ────────────────────────────────────
// 원본 co/nat/disbanded는 그대로 두고 여기서 파생만 붙인다. 화면은 원본을 쓰고(_dispAgency·
// _getNatKo·_groupEndDate가 이미 세 필드의 표기 흔들림을 각자 흡수하고 있다), 집계는 이 필드를 쓴다.
// 원본을 고치고 사용처 ~85곳을 따라가는 것보다 파생을 얹는 쪽이 안전하다.

// coKey: 소속사 집계 키. co가 "자회사 / 모회사"면 앞이 레이블, 뒤가 모회사(coParent).
//   "빅히트 뮤직 / HYBE" → coKey:'빅히트뮤직'  coParent:'HYBE'
//   "SM엔터테인먼트"      → coKey:'SM'         coParent 없음
// ⚠️ 표기 흔들림만 흡수한다(공백·'엔터테인먼트'·대소문자). 이름이 비슷한 다른 회사를 합치지
//    않으려면 여기 규칙을 넓히지 말 것 — 실제 표기 통일은 원본 co에서 이미 끝냈다.
const coNorm = s => String(s || '').replace(/\s+/g, '')
  .replace(/엔터테인먼트|엔터|ENTERTAINMENT|ENT\.?/gi, '').replace(/주식회사|㈜/g, '').toUpperCase();
const coFields = co => {
  if (!co) return null;
  const parts = String(co).split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { coKey: coNorm(parts[0]), coParent: coNorm(parts.slice(1).join('/')) };
  return { coKey: coNorm(co) };
};
// natCodes: nat.en의 ISO 코드를 배열로. 복합 국적은 '·'로 이어져 있다("KR·US" → ['KR','US']).
// 이미 코드가 들어 있어 매핑 테이블이 필요 없다 — 흔들린 건 nat.ko 쪽('한국'/'대한민국')이고 그건 표시용.
const natCodes = nat => {
  const en = nat && nat.en;
  if (!en) return [];
  return String(en).split(/[·,]/).map(s => s.trim()).filter(Boolean);
};
// endDate/endPrecision: disbanded 3형식(YYYY.MM.DD / YYYY / true)을 하나로. _groupEndDate와 같은
// 관례 — 연도만이면 그 해 말일, 연·월이면 그 달 말일. true는 "해체는 맞는데 날짜 모름"이라 unknown.
const endFields = d => {
  if (d === undefined || d === null) return { endDate: null, endPrecision: 'active' };
  if (typeof d !== 'string') return { endDate: null, endPrecision: 'unknown' };
  const m = /^(\d{4})(?:\.(\d{1,2}))?(?:\.(\d{1,2}))?$/.exec(d.trim());
  if (!m) return { endDate: null, endPrecision: 'unknown' };
  const p2 = n => String(n).padStart(2, '0');
  if (!m[2]) return { endDate: `${m[1]}-12-31`, endPrecision: 'year' };
  if (!m[3]) return { endDate: `${m[1]}-${p2(m[2])}-${new Date(+m[1], +m[2], 0).getDate()}`, endPrecision: 'month' };
  return { endDate: `${m[1]}-${p2(m[2])}-${p2(m[3])}`, endPrecision: 'day' };
};
const unmappedNat = [];
for (const k of Object.keys(groupsSlim)) {
  Object.assign(groupsSlim[k], coFields(groupsSlim[k].co) || {}, endFields(groupsSlim[k].disbanded));
}
for (const a of artistsSlim) {
  Object.assign(a, coFields(a.co) || {});
  const codes = natCodes(a.nat);
  if (codes.length) a.natCodes = codes;
  for (const c of codes) if (!/^[A-Z]{2}$/.test(c)) unmappedNat.push(`${a.name?.ko}: ${c}`);
}
if (unmappedNat.length) console.log(`⚠️ ISO 2자리가 아닌 국적 코드 ${unmappedNat.length}건 — ${unmappedNat.slice(0, 5).join(', ')}`);

const gSlimStr = JSON.stringify(groupsSlim), aSlimStr = JSON.stringify(artistsSlim), tiStr = JSON.stringify(tracks);
fs.writeFileSync(path.join(ROOT, 'groups.slim.json'), gSlimStr);
fs.writeFileSync(path.join(ROOT, 'artists.slim.json'), aSlimStr);
fs.writeFileSync(path.join(ROOT, 'tracks_index.json'), tiStr);

// ── 무결성 검증 ──
let origTracks = 0;
for (const gko of Object.keys(groups)) for (const al of (groups[gko].discography || [])) origTracks += (al.tracks || []).filter(t => t && t.title).length;
for (const a of artists) for (const al of (a.discography || [])) origTracks += (al.tracks || []).filter(t => t && t.title).length;
const ok = origTracks === trackCount;

// ── 리포트 ──
const gOrig = fs.statSync(path.join(ROOT, 'groups.json')).size, aOrig = fs.statSync(path.join(ROOT, 'artists.json')).size;
console.log('── 슬림 데이터 생성 완료 ──');
console.log(`groups.json   ${kb(gOrig)}(gzip ${kb(gz(fs.readFileSync(path.join(ROOT,'groups.json'))))}) → slim ${kb(gSlimStr.length)}(gzip ${kb(gz(gSlimStr))})`);
console.log(`artists.json  ${kb(aOrig)}(gzip ${kb(gz(fs.readFileSync(path.join(ROOT,'artists.json'))))}) → slim ${kb(aSlimStr.length)}(gzip ${kb(gz(aSlimStr))})`);
console.log(`tracks_index.json  ${kb(tiStr.length)}(gzip ${kb(gz(tiStr))})  [lazy 로드]`);
console.log(`disco/ 파일: 그룹 ${gFiles} + 솔로 ${aFiles} = ${gFiles + aFiles}개 · 합 ${kb(discoBytes)}`);
console.log(`트랙 무결성: 원본 ${origTracks} vs 인덱스 ${trackCount} ${ok ? '✓ 일치' : '✗ 불일치!'}`);
if (!ok) process.exit(1);
