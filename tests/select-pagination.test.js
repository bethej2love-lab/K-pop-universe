// PostgREST 1,000행 제한 전수 감사 (2026-08-27)
// 이 제한은 **에러도 경고도 없이 조용히 잘린다** — 테이블이 그 선을 넘기 전까지 아무도 모른다.
// 실제 사고: artist_pics가 32행이던 시절(2026-08-11) 만든 `.select()` 한 줄이 그대로 남아,
// 1,111행 중 111행이 누락됐다. 하필 잘리는 쪽이 최근 등록분이라 증상이 "새로 등록한 사진만
// 안 뜬다"로 나타나 원인을 찾기 어려웠다.
//
// 규칙: sb.from(X).select(...)는 아래 중 하나를 반드시 만족해야 한다.
//   ① _sbSelectAll / _sbFetchAll 로 감싸기(전량 조회)
//   ② .range() 직접
//   ③ .single() / .maybeSingle()
//   ④ .limit(n), n < 1000
//   ⑤ count/head 전용(본문을 안 받음)
//   ⑥ 단일 개체로 좁히는 필터 — 아래 ALLOW에 근거와 함께 등록
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// 단일 개체 필터라 구조적으로 1,000행에 못 닿는 곳 — "왜 안전한지"를 같이 적는다.
// 여기 추가할 땐 **행 수의 상한이 데이터가 아니라 구조로 정해지는지** 확인할 것.
const ALLOW = {
  'video_reaction_counts': '영상 1개의 이모지별 집계 — 상한은 이모지 종류 수(한 자릿수)',
  'video_reactions': '유저 1명 × 영상 1개의 리액션 — 상한 한 자릿수',
  'melon_yearly_top100': '그룹 1팀의 연도별 차트 진입분 (전체 799행, 그룹당 수십)',
  'spotify_streaming_milestones': '그룹 1팀의 마일스톤 (전체 455행, 그룹당 수십)',
  'kpop_events': '그룹/장소/id목록 1건 기준 (전체 11행)',
};

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.error('  ✗ ' + m); } };

const found = [];
for (const f of ['index.html', 'admin.js']) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const re = /sb\s*\.?\s*\n?\s*from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const start = m.index;
    let d = 0, end = src.length;
    for (let i = start; i < src.length; i++) {
      const c = src[i];
      if ('([{'.includes(c)) d++;
      else if (')]}'.includes(c)) { d--; if (d < 0) { end = i; break; } }
      else if (c === ';' && d === 0) { end = i; break; }
    }
    const chain = src.slice(start, Math.min(end, start + 900)).replace(/\s+/g, ' ');
    if (!/\.select\(/.test(chain)) continue; // insert/update/delete/upsert는 대상 아님
    const before = src.slice(Math.max(0, start - 140), start);
    found.push({
      file: f, line: src.slice(0, start).split('\n').length,
      table: m[2], chain, before,
    });
  }
}

ok(found.length > 20, `select 호출을 ${found.length}곳밖에 못 찾음 — 감사 정규식이 깨졌을 수 있음`);

for (const c of found) {
  const where = `${c.file}:${c.line} (${c.table})`;
  if (/_sbFetchAll|_sbSelectAll/.test(c.before) || /_sbFetchAll|_sbSelectAll/.test(c.chain)) {
    // 전량 조회는 정렬이 고정돼야 페이지 경계에서 행이 새거나 겹치지 않는다.
    ok(/\.order\(/.test(c.chain), `${where} — 페이지네이션했는데 order가 없음(경계에서 행 누락/중복)`);
    pass++; continue;
  }
  if (/\.range\(/.test(c.chain)) { pass++; continue; }
  if (/\.maybeSingle\(\)|\.single\(\)/.test(c.chain)) { pass++; continue; }
  if (/count:\s*['"]exact['"]|head:\s*true|_admHead\(\)/.test(c.chain)) { pass++; continue; }
  const lim = /\.limit\((\d+)\)/.exec(c.chain);
  if (lim) {
    ok(Number(lim[1]) < 1000, `${where} — limit(${lim[1]})가 1,000 이상이라 상한이 곧 PostgREST 제한과 같아짐`);
    continue;
  }
  // 남은 건 ALLOW에 근거가 등록돼 있어야 한다
  ok(!!ALLOW[c.table],
    `${where} — 상한 없는 select. _sbSelectAll로 감싸거나, 구조적으로 안전하면 ALLOW에 근거를 적을 것\n      ${c.chain.slice(0, 130)}`);
}

// 워밍 4곳은 반드시 페이지네이션(별도로 한 번 더 못 박음 — 여기가 실제로 터진 자리다)
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const fn of ['_warmInstaPicCache', '_warmScrapCounts', '_warmColLikes', '_warmPubCollections']) {
  const m = new RegExp(`async function ${fn}\\(\\)\\{[\\s\\S]*?\\n\\}`).exec(html);
  ok(!!m && /_sbSelectAll/.test(m[0]), `${fn}이 _sbSelectAll을 안 씀`);
}

console.log(`select-pagination: ${pass} passed, ${fail} failed  (검사한 select ${found.length}곳)`);
process.exit(fail ? 1 : 0);
