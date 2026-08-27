// 프로필 사진이 "등록했는데 안 뜨는" 두 원인 (2026-08-27, 사용자 제보)
//   ① PostgREST 1,000행 제한에 프리워밍이 조용히 잘림 — 실측 artist_pics 1,111행 중 111행 누락,
//      하필 최근 등록분이라 증상이 "새로 등록한 사진만 안 뜬다"였다.
//   ② 애니버서리 스트립이 `if(a.links?.instagram)`으로 감싸여 있어, 인스타 없는 541명은 사진을
//      등록해도 조회 자체를 건너뛰었다(2026-08-14에 위버스 출처까지 확대했는데 이 조건만 안 고쳐짐).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

// ── ① 페이지네이션 ───────────────────────────────────────────────
const helper = /async function _sbSelectAll\(build\)\{[\s\S]*?\n\}/.exec(html);
ok(!!helper, '_sbSelectAll 헬퍼가 없음');
if (helper) {
  // 실제로 페이지를 넘기는지 가짜 빌더로 확인
  const _sbSelectAll = new Function(helper[0] + '; return _sbSelectAll;')();
  const make = total => {
    let calls = 0;
    const build = () => ({
      range: async (from, to) => {
        calls++;
        const all = Array.from({ length: total }, (_, i) => ({ i }));
        return { data: all.slice(from, to + 1), error: null };
      }
    });
    return { build, calls: () => calls };
  };
  return (async () => {
    for (const [total, expRows, expCalls] of [[0, 0, 1], [500, 500, 1], [1000, 1000, 2], [1111, 1111, 2], [2500, 2500, 3]]) {
      const m = make(total);
      const r = await _sbSelectAll(m.build);
      ok(r.data.length === expRows, `${total}행: ${r.data.length}행만 받아옴(기대 ${expRows})`);
      ok(m.calls() === expCalls, `${total}행: 요청 ${m.calls()}회(기대 ${expCalls})`);
    }
    // 에러가 나면 그때까지 받은 것과 error를 같이 돌려줘야 한다(조용한 전멸 방지)
    let n = 0;
    const errBuild = () => ({ range: async () => (++n === 1 ? { data: Array.from({ length: 1000 }, (_, i) => ({ i })), error: null } : { data: null, error: { message: 'boom' } }) });
    const er = await _sbSelectAll(errBuild);
    ok(er.error && er.data.length === 1000, '중간 실패 시 부분 결과+error를 안 돌려줌');

    finish();
  })();
}
finish();

function finish() {
  // ── 워밍 4곳이 전부 헬퍼를 거치는가 ───────────────────────────
  // 같은 함정이 또 생기는 걸 막는다 — 조용히 잘리는 종류라 안 잡으면 아무도 모른다.
  for (const [fn, table] of [
    ['_warmInstaPicCache', 'artist_pics'],
    ['_warmScrapCounts', 'video_scrap_counts'],
    ['_warmColLikes', 'collection_like_counts'],
    ['_warmPubCollections', 'public_collections'],
  ]) {
    const m = new RegExp(`async function ${fn}\\(\\)\\{[\\s\\S]*?\\n\\}`).exec(html);
    ok(!!m, `${fn}을 못 찾음`);
    if (!m) continue;
    const body = m[0];
    const raws = [...body.matchAll(/await sb\.from\('([^']+)'\)\.select\(/g)];
    ok(raws.length === 0,
      `${fn}에 _sbSelectAll을 안 거치는 select가 ${raws.length}곳 — 1,000행에서 조용히 잘림 (${raws.map(r => r[1]).join(',')})`);
    ok(body.includes('_sbSelectAll'), `${fn}이 _sbSelectAll을 안 씀 (${table})`);
    // 정렬이 없으면 페이지 경계에서 행이 새거나 겹친다
    const calls = [...body.matchAll(/_sbSelectAll\(\(\)=>[^\n]*/g)];
    calls.forEach(c => ok(/\.order\(/.test(c[0]), `${fn}의 _sbSelectAll 호출에 order가 없음 — 페이지 경계에서 행 누락/중복`));
  }

  // ── ② 인스타 게이트 제거 ──────────────────────────────────────
  ok(!/if\(a\.links\?\.instagram\)\{\s*\n?\s*_fetchInstaPicUrl/.test(html),
    '애니버서리 스트립이 아직 인스타 있는 멤버만 사진을 조회함');
  ok(/_fetchArtistPicAnyGroup\(a\)\.then\(picUrl=>\{if\(picUrl\)_setAnnivStripThumb/.test(html),
    '애니버서리가 _fetchArtistPicAnyGroup을 안 씀');
  const anyG = /async function _fetchArtistPicAnyGroup\(a\)\{[\s\S]*?\n\}/.exec(html);
  ok(!!anyG, '_fetchArtistPicAnyGroup이 없음');
  ok(anyG && /_artistGroups\(a\)/.test(anyG[0]),
    '_fetchArtistPicAnyGroup이 주 소속만 봄 — 겸임 멤버가 부소속에서 등록한 사진을 놓침');

  // 인스타 없는 멤버가 여전히 많다는 것 자체가 이 게이트가 왜 치명적이었는지의 근거
  const noInsta = ARTISTS.filter(a => !(a.links && a.links.instagram)).length;
  ok(noInsta > 300,
    `인스타 없는 멤버가 ${noInsta}명뿐 — 이 테스트의 전제가 바뀌었으면 위 검사도 재검토할 것`);

  // ── FAVORITES 레이스 ─────────────────────────────────────────
  // _instaPicCache는 비동기로 채워지는데 즐겨찾기 목록은 동기로 읽는다 — 워밍 전에 열면 빈 채로 굳었다.
  ok(/_picRetryKey/.test(html), '즐겨찾기 사진 지연 보정(_picRetryKey)이 없음');
  ok(/_instaPicPreloadP\.then\(\(\)=>\{[\s\S]{0,200}avatar\.replaceWith/.test(html),
    '워밍 완료 후 즐겨찾기 아바타를 다시 채우는 처리가 없음');

  console.log(`pic-warm: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
