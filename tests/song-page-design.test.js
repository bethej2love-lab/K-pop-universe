// 곡·멤버×곡 정적 페이지 (2026-10-30 사용자 "'성현 acai'만 검색해도 나오게", "곡 페이지가 텍스트만 많고 이미지가 하나라 안 끌린다")
//  ① 멤버×곡 페이지: 개인 직캠(members가 그 멤버 한 명) MEMBER_SONG_MIN개 이상, 경로 {멤버 페이지}s/{곡}/, 제목 "성현 ACAI 직캠 모음"
//  ② 화면: 대표 영상 크게 + 썸네일 카드 그리드 + 멤버 얼굴 + 앨범 커버 타일, 스타일은 공용 song-page.css(페이지마다 넣으면 3만 쪽 × 5KB)
//  ③ 카드·얼굴 칸은 span이라 display:block이 없으면 aspect-ratio가 안 먹어 제목이 다음 줄과 겹쳤다(첫 빌드에서 실제로 겹침)
// 실제 빌드는 DB가 필요해 CI(rebuild-seo-pages)에서 — 여기선 빌더 소스·스타일 파일만 본다.
// 실행: node tests/song-page-design.test.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const b = fs.readFileSync(path.join(ROOT, 'build_group_pages.js'), 'utf8');
const css = fs.existsSync(path.join(ROOT, 'song-page.css')) ? fs.readFileSync(path.join(ROOT, 'song-page.css'), 'utf8') : '';
const ex = fs.readFileSync(path.join(ROOT, 'tools/seo_extra.js'), 'utf8');
let fail = 0;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) fail++; };

need(/const MEMBER_SONG_MIN = \d+;/.test(b) && /m\.length !== 1/.test(b), '① 개인 직캠 기준(멤버 한 명만 태깅) + 최소 개수');
need(/function memberSongPagePath\(a, b, lang\) \{ return `\$\{memberPagePath\(a, lang\)\}s\/\$\{b\}\/`; \}/.test(b), '① 경로 = 멤버 페이지 아래 s/곡/');
need(/\$\{mName\} \$\{s\.title\} 직캠 모음 - /.test(b), '① 한국어 제목 "멤버 곡 직캠 모음"');
need(/computeMemberSongs\(\);/.test(b) && b.indexOf('computeMemberSongs();') < b.indexOf('buildMemberPages();'), '① 멤버 페이지보다 먼저 계산(멤버 페이지에 곡별 직캠 링크)');
need(/\$\{memberSongLinksHtml\(a, lang\)\}/.test(b), '① 멤버 페이지에 곡별 직캠 칸');
need(/song-page\.css\?v=\$\{SONG_CSS_V\}/.test(b) && !/SONG_PAGE_CSS/.test(b) && css.length > 1000, '② 공용 스타일 파일(song-page.css)');
need(/class="hero"/.test(b) && /class="grid"/.test(b) && /class="faces"/.test(b) && /class="sp-tiles"/.test(b), '② 대표 영상·카드 그리드·얼굴·커버 타일');
need(/cover: al\.cover/.test(ex) || /m\.cover = al\.cover/.test(ex), '② 곡 타일용 앨범 커버');
need(/\.card-th\{[^}]*display:block[^}]*aspect-ratio:16\/9/.test(css) && /\.face-img\{[^}]*display:block/.test(css) && /\.card-y\{[^}]*display:block/.test(css), '③ span 칸 display:block(비율 유지)');

// ④ 멤버 페이지 '성현 직캠 모음'(2026-10-30): 개인 직캠 MEMBER_FANCAM_MIN개 이상이면 제목 맨 앞 '{이름} 직캠 모음·프로필 - {그룹} {이름}', 맨 위 썸네일 그리드
need(/const MEMBER_FANCAM_MIN = \d+;/.test(b) && b.includes('function memberFancams(a, gko)') && b.includes('직캠 모음·프로필 - ') && b.includes('mf-grid') && ex.includes('.mf-grid{'), '④ 멤버 페이지 직캠 모음 제목·그리드');
// ⑤ 그룹 직캠·무대 모음·직캠 순위 페이지·사이트맵 분할(2026-10-30)
need(b.includes('function groupStageVids(gko)') && b.includes("직캠·무대 모음 - ${bits") && !b.includes("join('·')} 기록 | K-POP UNIVERSE`)"), '⑤ 그룹 페이지 "코르티스(CORTIS) 직캠·무대 모음 - 멤버·…"');
need(b.includes('function buildRankPages()') && b.includes('buildRankPages();') && b.includes('rank/fancam/') && css.includes('.rank-n{'), '⑤ 직캠 조회수 순위 페이지');
need(b.includes('<sitemapindex') && b.includes('sitemaps/') && b.includes('const SM_MAX = 40000;'), '⑤ 사이트맵 목록+분할(파일당 4만)');
const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/rebuild-seo-pages.yml'), 'utf8');
need(wf.includes(' rank en/rank ') && wf.includes(' sitemaps '), '⑤ CI가 rank·sitemaps 폴더도 커밋');
console.log(fail ? `\n❌ ${fail}개 실패` : '\n✅ 곡 페이지 테스트 통과');
process.exit(fail ? 1 : 0);
