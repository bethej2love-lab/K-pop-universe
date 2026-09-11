// 연결선 공유그룹 해석 회귀 테스트 (2026-09-11 신설)
//
// 왜 만들었나: 사용자 제보("연결 안 되도 될 때 이어져서 보이는 오류") 추적 결과, `type:'member'`
// 연결선이 **'솔로'를 공유 그룹으로 인정**하고 있었다. '솔로'는 실제 그룹이 아니라 서로 무관한 솔로
// 아티스트들이 공유하는 placeholder라 groups.json에 존재하지도 않는다.
//
// 왜 화면에 실제로 보였나(안 그려지고 끝난 게 아니다): 솔로 아티스트는 "무소속(솔로) 아티스트 배치"
// 루프에서 소속사 방향·데뷔연도로 우주에 흩뿌려지고, 그때 `_worldPositions`에 `groupKo:'솔로'`가
// 들어간다. 그래서 연결선이 좌표를 찾는 데 **성공**해서 행성도 없는 허공에 우주를 가로지르는 선을
// 그렸다. 게다가 `bubbleMeshes.find(b=>b.ko==='솔로')`가 undefined라 bmAlpha가 1로 고정 — 필터로
// 행성을 숨겨도 이 선들만 안 사라졌다.
//
// 실측(2026-09-11): 464건이 '솔로'로 잡히고 있었고, 그 전부가 부소속(groups[])을 보면 실존 그룹
// (네이처 45 · 파이브돌스 32 · 쥬얼리 29 · 애프터스쿨 28 …)에서 제대로 이어진다. 나나↔루시는 원래
// '우아' 관계인데 '솔로'로 이어지고 있었다.
//
// 이 테스트는 index.html의 해석 로직을 **소스에서 확인**하고, 데이터 기준으로 유령 그룹이 0인지
// 검증한다(3D 렌더 없이 판정 가능한 부분만 — 헤드리스는 THREE CDN이 필요해 망 환경을 탄다).
//
// 실행: node tests/conn-solo-ghost.test.js

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = (m, extra) => { pass = false; console.log(`❌ ${m}` + (extra ? `\n   → ${extra}` : '')); };

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8')));
const CONNS = JSON.parse(fs.readFileSync(path.join(ROOT, 'connections.json'), 'utf8')).filter(c => c.type === 'member');

// ── 1) 소스 가드가 살아 있는지 ────────────────────────────────────────────────
{
  const i = html.indexOf('// ── Connection lines ─');
  const block = i > 0 ? html.slice(i, i + 4000) : '';
  if (!block) bad('연결선 블록을 못 찾음 — 앵커 주석이 바뀌었는지 확인');
  else {
    // 주 소속 매칭에 실존 그룹 조건이 붙어 있어야 한다
    if (/b\.group\.ko===ca\.group\.ko&&grpData\[b\.group\.ko\]/.test(block))
      ok('주 소속 매칭이 실존 그룹(grpData)만 인정');
    else bad("주 소속 매칭에 grpData 조건이 없음 — '솔로' placeholder가 다시 샌다");

    if (/if\(!grpData\[shareKo\]\)return;/.test(block))
      ok('shareKo 최종 가드(행성 없는 그룹엔 안 그림) 존재');
    else bad('shareKo 최종 가드가 없음 — conn.group에 미등록 유닛이 오면 엉뚱한 자리에 그려진다');

    if (/_artistGroups\(ca\)/.test(block) && /break outer2/.test(block))
      ok('부소속(groups[])까지 넓히는 2차 매칭 존재 — 해체 그룹 관계선 보존');
    else bad('2차(부소속) 매칭이 없음 — 솔로 이관된 해체 그룹 멤버 464건의 선이 통째로 사라진다');
  }
}

// ── 2) 데이터 기준 해석 결과에 유령 그룹이 없는지 ──────────────────────────────
const byName = {};
ARTISTS.forEach(a => { if (a.name && a.name.ko) (byName[a.name.ko] = byName[a.name.ko] || []).push(a); });
const AG = a => (a.groups || [a.group]).filter(Boolean);

// index.html의 해석을 그대로 옮긴 것(수정본 기준)
function resolveShareKo(c) {
  const A = byName[c.a] || [], B = byName[c.b] || [];
  if (c.group) {
    for (const ca of A) {
      if (!AG(ca).some(g => g.ko === c.group)) continue;
      for (const cb of B) if (AG(cb).some(g => g.ko === c.group)) return c.group;
    }
    return null;
  }
  for (const ca of A) { const cb = B.find(b => b.group.ko === ca.group.ko && GROUPS[b.group.ko]); if (cb) return ca.group.ko; }
  for (const ca of A) for (const cb of B) for (const ga of AG(ca)) {
    if (!GROUPS[ga.ko]) continue;
    if (AG(cb).some(gb => gb.ko === ga.ko)) return ga.ko;
  }
  return null;
}

const resolved = CONNS.map(resolveShareKo).filter(Boolean);
const ghost = [...new Set(resolved.filter(k => !GROUPS[k]))];
// 최종 가드가 conn.group 경로의 유령까지 막으므로, 실제로 그려지는 선 기준으로는 0이어야 한다.
const drawn = resolved.filter(k => GROUPS[k]);

if (!resolved.includes('솔로')) ok("공유 그룹으로 '솔로'가 잡히는 엣지 0건");
else bad(`'솔로'로 잡히는 엣지가 ${resolved.filter(k => k === '솔로').length}건 남음`);

if (ghost.length) ok(`groups.json에 없는 shareKo ${ghost.length}종(${ghost.join(', ')})은 최종 가드가 막음 — 그려지는 선에서 제외`);
else ok('groups.json에 없는 shareKo 0종');

if (drawn.length >= 4800) ok(`그려지는 연결선 ${drawn.length}개 (수정 전 4,845개에서 소실 없음)`);
else bad(`그려지는 연결선이 ${drawn.length}개로 줄었다 — 수정 전 4,845개 기준 소실 발생`);

// 대표 회귀 케이스: 나나↔루시는 '우아', JR↔아론은 뉴이스트 계열 실존 그룹이어야 한다
{
  const nana = CONNS.find(c => (c.a === '나나' && c.b === '루시') || (c.a === '루시' && c.b === '나나'));
  if (!nana) console.log('   (참고) 나나↔루시 엣지가 데이터에 없어 건너뜀');
  else {
    const k = resolveShareKo(nana);
    if (k && k !== '솔로' && GROUPS[k]) ok(`나나↔루시 → '${k}'(실존 그룹)`);
    else bad(`나나↔루시가 '${k}'로 해석됨 — 실존 그룹이어야 함`);
  }
}
{
  const jr = CONNS.find(c => (c.a === 'JR' && c.b === '아론') || (c.a === '아론' && c.b === 'JR'));
  if (!jr) console.log('   (참고) JR↔아론 엣지가 데이터에 없어 건너뜀');
  else {
    const k = resolveShareKo(jr);
    if (k && GROUPS[k]) ok(`JR↔아론 → '${k}'(실존 그룹 — 솔로 허공이 아님)`);
    else bad(`JR↔아론이 '${k}'로 해석됨 — 실존 그룹이어야 함`);
  }
}

console.log(pass ? '\n✅ 연결선 공유그룹 해석 테스트 통과' : '\n❌ 실패 있음');
process.exit(pass ? 0 : 1);
