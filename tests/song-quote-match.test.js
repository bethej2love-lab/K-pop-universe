// 따옴표로 감싼 짧은 곡명 매칭(2026-11-17, Codex 검수 — 스트레이키즈 현진 '神메뉴' 9개 중 1개만 곡에 연결, 멤버 페이지 0개).
// 원인 두 겹: ①QUOTED_RE가 God's·Don't의 어포스트로피를 따옴표로 읽어 제목이 쪼개짐 ②따옴표 안 글자만 떼어 다시 찾을 때 따옴표를 벗겨서,
// 4글자 미만 곡명(神메뉴·HOT·Girls)을 믿지 않는 규칙에 걸려 '곡이 아님'으로 판정돼 영상이 버려짐. 실데이터 실측: 세븐틴 +199/-8(HOT 직캠·MV 수십 개), 에스파 +63(Girls).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
const SEO = require('../tools/seo_extra.js');
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8')), artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
let total = 0, failed = 0; const check = (n, f) => { total++; try { f(); } catch (e) { failed++; console.error('FAIL ' + n + ': ' + e.message); } };
const V = (id, title, category = 'live', members = []) => ({ id, title, category, members, content_formats: [], view_count: 1000, published_at: '2026-01-01' });
function songVids(g, rows, pat) {
  const out = SEO.buildSongs({ ROOT, groups, artists, EX: { wins: {}, top: {} }, vids: { [g]: rows }, minVids: 1 });
  const s = (out[g] || []).find(x => pat.test(x.b + ' ' + x.title)); return s ? new Set(s.vids.map(v => v.id)) : new Set();
}
check("스트레이키즈 '神메뉴' — 어포스트로피(God's)가 든 따옴표 제목이 전부 곡에 붙는다", () => {
  const rows = [
    V('a', "[페이스캠4K] 스트레이 키즈 현진 '神메뉴' (Stray Kids 'God's Menu' HYUNJIN FaceCam)│@SBS Inkigayo_2020", 'live', ['현진']),
    V('b', "[예능연구소] 스트레이 키즈 현진 직캠 '神메뉴(God's Menu)' (Stray Kids HYUNJIN FanCam) @Show!MusicCore", 'live', ['현진']),
    V('c', "[2020 가요대전] 스트레이키즈 현진 '神메뉴' 페이스캠 (Stray Kids HYUNJIN 'God's Menu' FaceCam)", 'live', ['현진']),
    V('d', '[월드이즈원 세로캠] 스트레이 키즈 현진 - 神메뉴(God\'s Menu) (Stray Kids HYUNJIN FanCam)', 'live', ['현진']),
  ];
  const ids = songVids('스트레이키즈', rows, /神메뉴/); ['a', 'b', 'c', 'd'].forEach(i => assert(ids.has(i), '붙어야 함: ' + i));
});
check("세븐틴 'HOT'(3글자) — 따옴표 MV·음방·직캠이 곡에 붙는다", () => {
  const rows = [V('h1', "SEVENTEEN (세븐틴) 'HOT' Official MV", 'mv'), V('h2', "SEVENTEEN (세븐틴) - 'HOT' @MUSIC STATION"), V('h3', "[입덕직캠] 세븐틴 원우 직캠 4K 'HOT' (SEVENTEEN WONWOO FanCam) | @MCOUNTDOWN_2022", 'live', ['원우'])];
  const ids = songVids('세븐틴', rows, /\bhot\b/i); ['h1', 'h2', 'h3'].forEach(i => assert(ids.has(i), '붙어야 함: ' + i));
});
check("에스파 'Girls' — 따옴표 무대·직캠이 곡에 붙는다", () => {
  const rows = [V('g1', "aespa 에스파 'Girls' Stage Video"), V('g2', "[MPD직캠] 에스파 카리나 직캠 4K 'Girls' (aespa KARINA FanCam) | @MCOUNTDOWN_2022", 'live', ['카리나'])];
  const ids = songVids('에스파', rows, /\bgirls\b/i); ['g1', 'g2'].forEach(i => assert(ids.has(i), '붙어야 함: ' + i));
});
check("해시태그 #highlight 예능 클립은 곡 Highlight의 진짜 무대가 있으면 곡 영상에서 빠진다(비공연 거르기)", () => {
  // 곡에 진짜 무대('Highlight' 직캠)가 하나라도 있어야 비공연이 빠진다 — 전부 비공연이면 빈 페이지를 막으려고 원래 목록을 쓴다.
  const x = { ...V('x', '우리 세븐틴 사랑합니다 가사 문맥 너무 찰떡이다 #highlight#놀라운토요일 | amazingsaturday EP.261', 'variety'), content_formats: ['variety'] };
  // 곡 페이지는 근거 강한 영상 2개↑부터(2026-11-18 8daa685) — 무대 2개
  const rows = [V('p', "세븐틴 'Highlight' 직캠 4K (SEVENTEEN FanCam)"), V('p2', "SEVENTEEN (세븐틴) - 'Highlight' @ Show! MusicCore"), x];
  const ids = songVids('세븐틴', rows, /highlight/i); assert(ids.has('p') && ids.has('p2') && !ids.has('x'), '무대는 남고 예능 클립은 빠져야 함: ' + [...ids].join(','));
});
check('어포스트로피만 있는 영어 제목은 따옴표로 오인하지 않는다(QUOTED_RE)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'seo_extra.js'), 'utf8'); const m = /const QUOTED_RE = (\/.*\/g);/.exec(src); assert(m, 'QUOTED_RE 없음');
  const re = eval(m[1]); const q = t => [...t.matchAll(re)].map(x => x[1]);
  assert.deepEqual(q("[x] 현진 '神메뉴' (Stray Kids 'God's Menu')"), ['神메뉴']);
  assert.deepEqual(q("Don't Stop 'Fate' stage"), ['Fate']);
});
console.log(total + ' checks / ' + failed + ' failed'); if (failed) process.exitCode = 1;
