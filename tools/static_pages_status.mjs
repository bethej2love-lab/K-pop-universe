// 정적 페이지 현황 집계 (2026-11-16 사용자 "정적 페이지가 얼마나 어떤 식으로 생성돼 있는지 한눈에")
// 레포의 생성물(index.html)을 종류별·언어별로 세고 사이트맵 등록 수·마지막 생성 시각까지 보여준다. 읽기만 한다.
// 실행: node tools/static_pages_status.mjs                 → 표 출력
//       node tools/static_pages_status.mjs --json out.json → 같은 내용을 JSON으로(문서·어드민 화면용)
// 영어 페이지는 같은 경로 앞에 en/ 이 붙는다(en/g/…, en/member/…, en/p/…). 아래 규칙은 en/ 을 뗀 경로로 판별.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.audit-worktrees', 'audit-materials', 'tests', 'tools', 'docs', 'sql', 'supabase', 'icons', 'events_sql', 'album_videos', 'sitemaps']);

// [종류, 경로 규칙(en/ 뗀 뒤), 설명, 묶음] — 위에서부터 먼저 맞는 것
const KINDS = [
  ['그룹', /^g\/[^/]+\/index\.html$/, '그룹 프로필(멤버·디스코그래피·영상·수상)', '아티스트'],
  ['멤버 프로필(그룹 소속)', /^g\/[^/]+\/[^/]+\/index\.html$/, '멤버 프로필(나이·직캠·크레딧)', '아티스트'],
  ['솔로 프로필', /^member\/[^/]+\/index\.html$/, '그룹 없는 솔로 아티스트 프로필', '아티스트'],
  ['직캠 전체(멤버)', /^(g\/[^/]+\/[^/]+|member\/[^/]+)\/fancams\/index\.html$/, '멤버 개인 직캠을 곡별로 모은 페이지(+TOP 10 순위)', '직캠·곡'],
  ['멤버×곡 직캠', /^(g\/[^/]+\/[^/]+|member\/[^/]+)\/s\/[^/]+\/index\.html$/, '멤버 한 명의 한 곡 직캠 모음', '직캠·곡'],
  ['작사·작곡 크레딧', /^(g\/[^/]+\/[^/]+|member\/[^/]+)\/credits\/index\.html$/, '멤버의 작사·작곡 곡 목록', '직캠·곡'],
  ['곡 페이지', /^g\/[^/]+\/s\/[^/]+\/index\.html$/, '곡 하나(무대·직캠 모음)', '직캠·곡'],
  ['앨범 페이지', /^g\/[^/]+\/a\/[^/]+\/index\.html$/, '앨범 하나(수록곡·영상)', '직캠·곡'],
  ['예능 출연', /^p\//, '예능·프로그램 출연(프로그램, 프로그램×그룹)', '콘텐츠'],
  ['음방 회차', /^show\//, '음악방송 회차별 무대', '콘텐츠'],
  ['음방 1위', /^wins\//, '음악방송 1위 기록', '콘텐츠'],
  ['직캠 순위', /^rank\//, '전체·성별·연도별 직캠 TOP 100', '콘텐츠'],
  ['Chemistry', /^chem\//, '그룹·멤버 조합 페이지', '콘텐츠'],
  ['커버·원곡', /^cover\//, '커버곡 허브', '콘텐츠'],
  ['소속사', /^agency\//, '소속사별 아티스트', '목록·허브'],
  ['아이돌 목록', /^idols\//, '아이돌 목록', '목록·허브'],
  ['그룹 목록', /^g\/index\.html$/, '전체 그룹 목록', '목록·허브'],
  ['공유 경로', /^share_routes\//, '앱 링크 공유용', '목록·허브'],
];
const kindOf = rel => { const r = rel.replace(/^en\//, ''); for (const [k, re] of KINDS) if (re.test(r)) return k; return null; };

function walk(dir, rel, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (rel === '' && SKIP.has(e.name)) continue; if (e.name.startsWith('.')) continue; walk(path.join(dir, e.name), rel ? rel + '/' + e.name : e.name, out); }
    else if (e.name === 'index.html' && rel) out.push(rel + '/index.html');
  }
}
const files = []; walk(ROOT, '', files);
const rows = {}, other = {}; let stubs = 0; const stubBy = {};
const fd = Buffer.alloc(900);
for (const f of files) {
  const k = kindOf(f); const lang = /^en\//.test(f) ? 'en' : 'ko';
  if (!k) { const top = f.replace(/^en\//, '').split('/')[0]; other[top] = (other[top] || 0) + 1; continue; }
  const r = rows[k] || (rows[k] = { ko: 0, en: 0, stub: 0 }); r[lang]++;
  // 넘김 페이지(기준 아래로 내려간 옛 주소 — noindex + 자동 이동): 파일 앞 900바이트만 본다
  try { const h = fs.openSync(path.join(ROOT, f), 'r'); const n = fs.readSync(h, fd, 0, 900, 0); fs.closeSync(h); const head = fd.toString('utf8', 0, n); if (/http-equiv="refresh"|name="robots" content="noindex/.test(head)) { r.stub++; stubs++; stubBy[k] = (stubBy[k] || 0) + 1; } } catch { }
}
// 사이트맵(검색엔진에 알린 주소 수)
const smDir = path.join(ROOT, 'sitemaps'); const sm = [];
if (fs.existsSync(smDir)) for (const f of fs.readdirSync(smDir).sort()) if (/\.xml$/.test(f)) sm.push({ file: f, urls: (fs.readFileSync(path.join(smDir, f), 'utf8').match(/<url>/g) || []).length });
const git = c => { try { return execSync(c, { cwd: ROOT }).toString().trim(); } catch { return ''; } };
const total = files.length;
const byKind = Object.fromEntries(KINDS.map(([k, , desc, grp]) => [k, { ...(rows[k] || { ko: 0, en: 0, stub: 0 }), total: (rows[k] ? rows[k].ko + rows[k].en : 0), desc, group: grp }]));
const result = {
  built: new Date().toISOString(), totalPages: total, stubPages: stubs, stubByKind: stubBy, byKind, uncategorized: other,
  sitemap: { files: sm.length, urls: sm.reduce((n, x) => n + x.urls, 0), list: sm },
  lastStaticCommit: git('git log -1 --format=%cI -- g'), lastPageBuildCommit: git('git log -1 --format=%cI -- g/index.html'),
};
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(result, null, 1));
console.log(`정적 페이지 ${total.toLocaleString()}개(한국어 ${Object.values(rows).reduce((n, x) => n + x.ko, 0).toLocaleString()} · 영어 ${Object.values(rows).reduce((n, x) => n + x.en, 0).toLocaleString()}) · 사이트맵 ${result.sitemap.files}개 파일, URL ${result.sitemap.urls.toLocaleString()}개 · 마지막 정적 생성 커밋 ${result.lastStaticCommit || '?'}`);
const grp = {};
for (const [k, v] of Object.entries(byKind)) (grp[v.group] || (grp[v.group] = {}))[k] = { 한국어: v.ko, 영어: v.en, 합계: v.total, '넘김(검색 제외)': v.stub || 0 };
console.log(`넘김·noindex 페이지(옛 주소 안내용, 검색에 안 올림) ${stubs.toLocaleString()}개 / 검색에 올라갈 수 있는 페이지 ${(total - stubs).toLocaleString()}개`);
for (const [g, t] of Object.entries(grp)) { console.log('\n■ ' + g); console.table(t); }
if (Object.keys(other).length) console.log('\n종류 미분류(최상위 폴더별):', JSON.stringify(other));
