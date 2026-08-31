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
