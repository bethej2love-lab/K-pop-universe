// 자동 수집 앨범의 출처 불변식 (2026-09-30)
//
// 배경: 스포티파이 일일 수집이 "대조할 앨범이 0장"인 대상에서 신원 검증을 통째로 건너뛰어, 솔로 27명이
// 동명이인 앨범 201장을 받았다(티오원 치훈 → 재즈 계정 CHIHOON 30장, 렌타 → Renaud Capuçon,
// 앤 → Anne-Marie, 김재이 → TAEYEON …). 수집 코드의 게이트는 고쳤지만, 게이트는 **코드 경로마다** 있어야
// 해서 새 경로(수동 --only 실행, 다른 수집 도구, 손으로 고친 매핑)가 생기면 또 뚫릴 수 있다.
// 그래서 **데이터 자체의 불변식**으로 CI에서 잡는다 — 어떤 경로로 들어왔든 결과가 틀리면 빨간불:
//
//  ① src:'spotify' 앨범의 주인은 spotify_artist_map.json에 매핑이 있어야 한다
//  ② 그 매핑은 rejected가 아니어야 한다(사람이 "다른 사람"으로 판정한 계정)
//  ③ 솔로는 confidence:'high'(앨범 겹침·영상 대조·사람 확인 중 하나를 통과)여야 한다
//  ④ 그룹은 high이거나, 스포티파이 이름이 우리 그룹명(영문/한글/별칭)과 정확히 같아야 한다
//  ⑤ 앨범의 spotifyId는 **서로 다른 솔로 두 명**에게 동시에 있을 수 없다(동명이인 교차 오배정)
//
// ⚠️ 실패하면 테스트를 고치지 말고 데이터를 볼 것: 틀린 매핑이면 앨범을 지우고 rejected:true,
//    맞는 사람이면 근거를 why에 적고 confidence:'high'.
//
// 실행: node tests/disco-provenance.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const groups = rd('groups.json');
const artists = rd('artists.json');
const map = rd('spotify_artist_map.json');

const nn = s => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const errors = [];
let albums = 0;

function check(ko, kind, list, groupNames) {
  const sp = (list || []).filter(d => d && d.src === 'spotify');
  if (!sp.length) return;
  albums += sp.length;
  const m = map[ko];
  const sample = sp.slice(0, 2).map(d => `${d.releaseDate} ${d.title}`).join(', ');
  if (!m) return errors.push(`① ${ko}(${kind}) — 매핑 없이 스포티파이 앨범 ${sp.length}장 (${sample})`);
  if (m.rejected) return errors.push(`② ${ko}(${kind}) — rejected 매핑(${m.spotifyName})의 앨범 ${sp.length}장이 남아 있음 (${sample})`);
  if (m.confidence === 'high') return;
  if (kind === 'group' && groupNames.some(n => nn(n) && nn(n) === nn(m.spotifyName))) return;
  errors.push(`${kind === 'solo' ? '③' : '④'} ${ko}(${kind}) — 미검증 매핑(${m.spotifyName}, ${m.confidence})으로 들어온 앨범 ${sp.length}장 (${sample})`);
}

for (const [ko, g] of Object.entries(groups)) check(ko, 'group', g.discography, [ko, g.en, ...(g.altNames || [])]);
// 솔로 수집 대상과 같은 기준: 소속이 실존 그룹이 아닌 레코드(그룹 소속 멤버의 솔로는 그룹 쪽으로 커버)
for (const a of artists) if (!groups[a.group?.ko]) check(a.name?.ko, 'solo', a.discography, []);

// ⑤ 같은 스포티파이 앨범이 서로 다른 솔로 두 명에게
const owner = new Map();
for (const a of artists) for (const d of a.discography || []) {
  if (!d || d.src !== 'spotify' || !d.spotifyId) continue;
  const prev = owner.get(d.spotifyId);
  if (prev && prev.id !== a.id) errors.push(`⑤ 같은 앨범(${d.title})이 ${prev.name.ko}(${prev.id})·${a.name.ko}(${a.id}) 두 명에게 — 동명이인 오배정 의심`);
  else owner.set(d.spotifyId, a);
}

// rejected 매핑 목록 자체도 보여준다(무엇을 막고 있는지 CI 로그에서 보이게)
const rejected = Object.entries(map).filter(([, m]) => m.rejected).map(([k]) => k);
console.log(`스포티파이 수집 앨범 ${albums}장 점검 · 차단 매핑 ${rejected.length}개`);
if (errors.length) {
  errors.forEach(e => console.log('❌ ' + e));
  console.log(`\n❌ 출처 불변식 위반 ${errors.length}건`);
  process.exit(1);
}
console.log('✅ 모든 자동 수집 앨범이 검증된 매핑에서 왔음');
