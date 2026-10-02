// 신보 선반(albums_recent.json) 멤버 항목의 주인 = 정확히 그 아티스트인가 (2026-10-02 신설)
//
// 왜: 무소속 솔로의 앨범은 g(소속)가 null로 나간다. 앱이 이름만으로 주인을 찾으면 동명이인 중 첫 번째에
// 붙는다 — TAN 출신 솔로 지성(a1570)의 "을"·"23° : The Age of Us"가 엔시티 드림 지성 즐겨찾기 선반에
// 뜨고, 클릭하면 엔시티 드림 지성 카드로 갔다(나나·지원도 같은 꼴). 데이터는 맞는데 화면이 틀려서
// "앨범을 잘못 수집했다"로 보였다. 그래서 빌더가 아티스트 id(i)를 넣고 앱은 _albumOwnerArt로 i부터 찾는다.
//
// 확인:
//  ① albums_recent.json의 모든 멤버 항목에 i가 있고, 그 id의 아티스트 이름이 o와 같다
//  ② 앱의 _albumOwnerArt를 index.html에서 꺼내 실제로 실행 → 모든 멤버 항목이 i의 아티스트로 풀린다
//  ③ 앱에 이름만으로 앨범 주인을 찾는 코드(x.name.ko===a.o)가 _albumOwnerArt 밖에 남아 있지 않다
// 실행: node tests/albums-recent-owner.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const ARTISTS = rd('artists.json');
const ALBUMS = rd('albums_recent.json');
let fail = 0;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { fail++; console.log(`❌ ${m}`); };

const byId = new Map(ARTISTS.map(a => [a.id, a]));
const mem = ALBUMS.filter(a => a.k === 'm');

// ①
const noId = mem.filter(a => !a.i);
const wrong = mem.filter(a => a.i && (!byId.get(a.i) || byId.get(a.i).name.ko !== a.o));
if (noId.length) bad(`i 없는 멤버 항목 ${noId.length}개 — build_slim_data.mjs 재실행 필요 (예: ${noId.slice(0, 3).map(a => a.o + '/' + a.t).join(', ')})`);
else if (wrong.length) bad(`i의 아티스트 이름이 o와 다름 ${wrong.length}개 (예: ${wrong.slice(0, 3).map(a => a.o + '≠' + a.i).join(', ')})`);
else ok(`멤버 항목 ${mem.length}개 전부 i 있음 · 이름 일치`);

// ②
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const m = html.match(/function _albumOwnerArt\(a\)\{[\s\S]*?\n\}/);
if (!m) bad('index.html에서 _albumOwnerArt를 못 찾음(이름이 바뀌었으면 이 테스트도 같이 고칠 것)');
else {
  const owner = new Function('ARTISTS', m[0] + '\nreturn _albumOwnerArt;')(ARTISTS);
  const mis = mem.filter(a => { const x = owner(a); return !x || x.id !== a.i; });
  if (mis.length) bad(`앱이 다른 아티스트로 풀어냄 ${mis.length}개 (예: ${mis.slice(0, 3).map(a => a.o + '/' + a.t).join(', ')})`);
  else {
    const amb = mem.filter(a => ARTISTS.filter(x => x.name && x.name.ko === a.o).length > 1);
    ok(`앱 _albumOwnerArt가 전부 정확한 주인으로 풀어냄 (동명이인 항목 ${amb.length}개 포함)`);
  }
}

// ③
const outside = html.replace(/function _albumOwnerArt\(a\)\{[\s\S]*?\n\}/, '');
const leaks = (outside.match(/x\.name\.ko===a\.o/g) || []).length;
if (leaks) bad(`_albumOwnerArt 밖에 이름만으로 앨범 주인을 찾는 코드 ${leaks}곳 — _albumOwnerArt(a)를 쓸 것`);
else ok('이름만으로 앨범 주인을 찾는 코드 없음');

if (fail) { console.log(`\n${fail}건 실패`); process.exit(1); }
console.log('\n전부 통과');
