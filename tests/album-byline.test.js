// 공동 앨범 표기(byline) 불변식 (2026-10-19)
// tools/melon_album_artists.mjs --apply가 멜론 앨범 아티스트 표기를 앨범에 byline으로 박는다. 지켜야 할 것:
//   · byline은 2명 이상일 때만, 각 항목에 이름(n)과 멜론 번호(aid)
//   · 피처링·리믹스·OST 제목엔 붙지 않는다(사용자: feat와 공동 앨범은 다르다)
//   · 기존 `artists` 칸(SM 프로젝트 앨범 등 참여자 문자열 목록)은 살아 있어야 한다 — 처음 반영 때 같은 이름으로 덮어 지웠던 사고
// 실행: node tests/album-byline.test.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const albums = [];
for (const [k, g] of Object.entries(groups)) (g.discography || []).forEach(al => albums.push([k, al]));
for (const a of artists) {
  [...(a.discography || []), ...(a.soloDiscography || [])].forEach(al => albums.push([a.name.ko, al]));
  (a.unitDiscography || []).forEach(u => ((u && u.albums) || []).forEach(al => albums.push([a.name.ko + '(유닛)', al])));
}
let pass = 0, fail = 0;
const need = (c, m, d) => { if (c) { pass++; console.log('✅ ' + m); } else { fail++; console.log('❌ ' + m + (d ? '\n   ' + d : '')); } };
const withB = albums.filter(([, al]) => al && al.byline);
const badShape = withB.filter(([, al]) => !Array.isArray(al.byline) || al.byline.length < 2 || al.byline.some(x => !x || !x.n || !x.aid));
need(!badShape.length, `byline 모양(2명 이상·이름·멜론 번호) — ${withB.length}곳`, badShape.slice(0, 3).map(([o, al]) => o + ' ' + al.title).join(' / '));
const featLike = withB.filter(([, al]) => /feat\.?|\bft\.|remix|\bOST\b/i.test(al.title || '') || al.feat);
need(!featLike.length, '피처링·리믹스·OST엔 byline 없음', featLike.slice(0, 3).map(([o, al]) => o + ' ' + al.title).join(' / '));
const unitB = albums.filter(([o, al]) => o.endsWith('(유닛)') && al && al.byline);
need(!unitB.length, '유닛 앨범엔 byline 없음(유닛명이 따로 있다)', unitB.slice(0, 3).map(([o, al]) => o + ' ' + al.title).join(' / '));
const legacy = albums.filter(([, al]) => al && Array.isArray(al.artists));
need(legacy.length >= 7, `기존 artists 칸 보존(${legacy.length}곳 ≥ 7)`);
const tt = albums.filter(([o, al]) => al && al.melonAlbumId === '14613791');
need(tt.length >= 2 && tt.every(([, al]) => (al.byline || []).map(x => x.n).join(', ') === '온유, 지코'), "Tic Tac Toe = '온유, 지코'(멜론 순서) 양쪽 디스코 모두");
// 이름으로 잇기는 소속 그룹이 확인될 때만 — 동명이인 오연결 사례(2026-10-19 표본)
const cache = JSON.parse(fs.readFileSync(path.join(ROOT, 'melon_album_artists.json'), 'utf8'));
const rawOf = (al, aid) => ((cache[al.melonAlbumId] || {}).a || []).find(r => r[0] === aid)?.[1] || '';
const wrong = [];
for (const [, al] of withB) for (const x of al.byline) {
  const raw = rawOf(al, x.aid);
  if (/^MJ \(써니사이드\)|^여름 \(헬로비너스\)|^INI$|^민서 \(MINSEO\)|^정승환$/.test(raw) && (x.ako || x.gko)) wrong.push(raw + '→' + x.ako);
}
need(!wrong.length, '동명이인을 우리 아티스트로 잇지 않음(MJ·여름·INI·민서·정승환)', wrong.slice(0, 5).join(', '));
// 외부 아티스트 모음(collab_ext.json) — 2장 이상·우리 쪽 사람 아님
const extPath = path.join(ROOT, 'collab_ext.json');
if (fs.existsSync(extPath)) {
  const ext = JSON.parse(fs.readFileSync(extPath, 'utf8'));
  const badExt = Object.entries(ext).filter(([, e]) => !e.w || e.w.length < 2 || e.w.some(w => !w.o || !w.o.length));
  need(!badExt.length, `collab_ext — ${Object.keys(ext).length}명 모두 2장 이상·주인 있음`, badExt.slice(0, 3).map(([k, e]) => e.n).join(', '));
}
console.log(fail ? `💥 공동 앨범 표기 테스트 실패 ${fail}건` : `✅ 공동 앨범 표기 테스트 통과 ${pass}건`);
process.exit(fail ? 1 : 0);
