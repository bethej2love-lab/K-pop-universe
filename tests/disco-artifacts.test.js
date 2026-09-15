// 디스코그래피 파생물 무결성 테스트 (2026-09-15)
//
// disco/·groups.slim.json·artists.slim.json·tracks_index.json은 groups.json/artists.json에서
// tools/build_slim_data.mjs가 만드는 **파생물**이다. 그런데 이 빌드는 오랫동안 어떤 워크플로에도
// 안 붙어 있었다 — 앨범을 추가하고 빌드를 안 돌리면 원본만 바뀌고 사이트엔 반영이 안 되는데,
// 그 사실을 알려주는 장치가 하나도 없었다(2026-09-15 확인).
//
// 이 테스트가 지키는 것:
//  ① 파생물이 원본과 일치한다(--check — 파일은 안 쓴다)
//  ② 무소속 솔로 파일키 규칙이 빌더와 앱(index.html)에서 **똑같다**
//     ⚠️ 이게 어긋났을 때 증상은 "에러"가 아니라 **조용한 유실**이다. 실제로 동명이인 두 명이 같은
//        파일명을 써서 한쪽(공원소녀 출신 레나의 솔로 앨범 6장)이 통째로 안 보이고 있었다.
//
// ℹ️ ①이 잠깐 빨갛게 뜨는 건 정상일 수 있다: groups.json만 담긴 커밋을 push하면 CI가 먼저 돌고,
//    rebuild-disco-artifacts.yml이 파생물을 재생성해 뒤따라 커밋한다(1분쯤). 그 커밋의 CI는 초록이다.
//    빨간 게 계속 남아 있으면 그때가 진짜 문제다(재빌드 워크플로가 죽었거나 push가 막힌 것).
//
// 실행: node tests/disco-artifacts.test.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let pass = true;
const ok = m => console.log('✅ ' + m);
const bad = m => { pass = false; console.log('❌ ' + m); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── ① 파생물이 원본과 일치 ───────────────────────────────────────────────────
const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build_slim_data.mjs'), '--check'], { encoding: 'utf8' });
if (r.status === 0) ok('파생물이 원본과 일치 (build_slim_data.mjs --check)');
else {
  bad('파생물이 원본과 어긋남 — node tools/build_slim_data.mjs 를 돌리고 생성물까지 커밋하세요');
  console.log((r.stdout || '').split('\n').filter(l => l.includes('·') || l.includes('어긋')).slice(0, 12).map(l => '   ' + l).join('\n'));
  console.log((r.stderr || '').split('\n').slice(0, 12).map(l => '   ' + l).join('\n'));
}

// ── ② 솔로 파일키 규칙이 빌더 ↔ 앱에서 동일 ─────────────────────────────────
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.slim.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.slim.json'), 'utf8'));

// 앱 쪽 규칙을 index.html 소스에서 그대로 떼어 와 실행한다(재구현하면 "테스트만 맞는" 상태가 된다).
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const grab = name => {
  const i = src.indexOf(name);
  if (i < 0) return '';
  let d = 0, s = src.indexOf('{', i);
  for (let j = s; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (!d) return src.slice(i, j + 1); }
  }
  return '';
};
const keyFn = src.match(/const _discoFileKey=[^\n]+/);
const soloFn = grab('function _soloDiscoKey(');
need(!!keyFn && soloFn.length > 0, 'index.html에서 _discoFileKey / _soloDiscoKey를 찾음');
const appKey = new Function('ARTISTS', 'GROUPS', `
  ${keyFn[0]}
  let _soloDupKeys=null;
  ${soloFn}
  return _soloDiscoKey;`)(artists, groups);

// 빌더 규칙(build_slim_data.mjs의 soloFileName)과 같은 결과가 나오는지, 그리고 그 파일이 실제로 있는지.
const discoA = path.join(ROOT, 'disco', 'a');
const onDisk = new Set(fs.existsSync(discoA) ? fs.readdirSync(discoA) : []);
let checked = 0, missing = [], dupBase = {};
for (const a of artists) {
  const gko = a.group && a.group.ko, nm = a.name && a.name.ko;
  if (!gko || !nm || groups[gko]) continue;         // 실존 그룹 소속은 그룹 파일에 번들
  const base = String(gko).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '') + '__' + String(nm).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');
  (dupBase[base] = dupBase[base] || []).push(a);
}
for (const [base, list] of Object.entries(dupBase)) {
  for (const a of list) {
    const k = appKey(a);
    // 동명이인이면 id가 붙어야 하고, 아니면 안 붙어야 한다(양쪽 다 틀리면 파일을 못 찾는다)
    const want = list.length > 1 ? base + '__' + a.id : base;
    if (k !== want) { bad(`앱 키 규칙 불일치: ${a.name.ko}(${a.id}) → "${k}" (기대 "${want}")`); }
    checked++;
    // 디스코가 실제로 있는 아티스트만 파일이 존재한다. 파일이 있는데 앱이 다른 이름을 부르면 유실.
    if (onDisk.has(k + '.json')) { /* 정상 */ }
    else if (onDisk.has(base + '.json') && list.length > 1) missing.push(`${a.name.ko}(${a.id}) — 앱은 ${k}.json을 부르는데 디스크엔 ${base}.json만 있음`);
  }
}
need(missing.length === 0, missing.length ? missing.slice(0, 5).join(' / ') : `앱이 부르는 솔로 disco 경로가 전부 실제 파일과 맞음 (${checked}명 확인)`);

// 동명이인이 실제로 갈라졌는지 — 회귀의 표본을 직접 못 박는다.
const lena = artists.filter(a => a.name && a.name.ko === '레나' && a.group && a.group.ko === '솔로');
if (lena.length >= 2) {
  const keys = lena.map(appKey);
  need(new Set(keys).size === lena.length, `동명이인 레나 ${lena.length}명이 서로 다른 파일키 (${keys.join(' / ')})`);
} else ok('레나 동명이인 표본 없음 — 데이터가 바뀐 듯(검사 생략)');

// 고아 파일: 디스크에 있는데 어떤 아티스트도 안 부르는 것
const wanted = new Set();
for (const [base, list] of Object.entries(dupBase)) for (const a of list) wanted.add(appKey(a) + '.json');
const orphans = [...onDisk].filter(f => !wanted.has(f));
need(orphans.length === 0, orphans.length ? `고아 disco 파일 ${orphans.length}개: ${orphans.slice(0, 5).join(', ')}` : '고아 disco 파일 없음');

console.log(pass ? '\n✅ 디스코 파생물 테스트 통과' : '\n❌ 실패 항목 있음');
process.exit(pass ? 0 : 1);
