// Surf "함께한 멤버" 제목 인물 추출 회귀 테스트 (2026-09-29)
//
// 제목의 feat./ft./with/대문자 X 뒤 이름을 칩으로 쓴다(유니버스 밖 이름 포함 — 2026-09-28 사용자 결정).
// 실제 데이터에서 나온 제목으로 "뽑혀야 할 것"과 "뽑히면 안 되는 것"을 고정한다.
//  · 소문자 x는 같은 그룹 유닛("JIHOON x JUNKYU")이 대부분이라 안 읽는다.
//  · 'Me'·'LIVE' 같은 낱말은 사람이 아니다(첫 구현에서 "AND ME"가 칩으로 떴다).
// 실행: node tests/surf-title-people.test.js

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = src.indexOf('const _SURF_NOT_PERSON=');
const b = src.indexOf('\nfunction _surfPersonLabel(');
if (a < 0 || b < 0) { console.log('❌ _SURF_NOT_PERSON/_surfTitlePeople 블록을 못 찾음'); process.exit(1); }
const _surfTitlePeople = new Function(src.slice(a, b) + '\nreturn _surfTitlePeople;')();

let pass = true;
const eq = (title, want) => {
  const got = _surfTitlePeople(title);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) pass = false;
  console.log(`${ok ? '✅' : '❌'} ${title}\n    → ${JSON.stringify(got)}${ok ? '' : `  (기대 ${JSON.stringify(want)})`}`);
};

eq("방예담 (BANG YEDAM) X 윈터 (WINTER of aespa) ‘Officially Cool’ Official M/V", ['윈터']);
eq("DIMO REX (디모렉스) - 'On The Table' (feat. 식케이 (Sik-K)) M/V", ['식케이']);
eq('DUET WITH YOON X BANG YE DAM #2', ['YOON', 'BANG YE DAM', 'BANG YE DAM']);
eq("TREASURE : JIHOON x JUNKYU x MASHIHO x BANG YE DAM x PARK JEONG WOO - '왜요 (WAYO)' LIVE VIDEO", []);
eq('[리무진서비스 클립] 대낮에 한 이별 | 에스파 윈터 X 이무진 | aespa WINTER X LEE MU JIN', ['이무진', 'LEE MU JIN']);
eq('[4K] DIMO REX(디모렉스) “SAY MY NAME” Band LIVE | it\'s Live', []);
eq('Something (with Me) Official Audio', []);
// ' - ' 뒤는 곡명 — 사람 이름에 곡명이 붙어 칩이 "絢香 - にじいろ"가 되던 것(2026-09-29)
eq('白石麻衣 × 絢香 - にじいろ / THE FIRST TAKE powered by ASAHI SUPER DRY', ['絢香']);

// ── 커버 곡명 추출(_surfCoverSong) — 원곡 태그 없는 팝송 커버용(2026-09-29) ──────────────
// 커버 판정은 커버 탭 제외 키워드(_COVER_EXCLUDE)를 그대로 쓴다 — 그 상수 블록째 가져온다.
const c1 = src.indexOf('const _COVER_EXCLUDE='), c2 = src.indexOf('function _applyCoverExcludeQuery');
const s1 = src.indexOf('function _surfIsCoverTitle('), s2 = src.indexOf('async function _surfFetch(');
if (c1 < 0 || c2 < 0 || s1 < 0 || s2 < 0) { console.log('❌ _surfCoverSong 블록을 못 찾음'); process.exit(1); }
const _surfCoverSong = new Function(src.slice(c1, c2) +
  '\nfunction _titleNorm(t){return (t||"").normalize("NFKC").toLowerCase();}\n' + src.slice(s1, s2) + '\nreturn _surfCoverSong;')();
const song = (title, want) => {
  const got = _surfCoverSong(title);
  const ok = got === want;
  if (!ok) pass = false;
  console.log(`${ok ? '✅' : '❌'} [곡명] ${title}\n    → ${JSON.stringify(got)}${ok ? '' : `  (기대 ${JSON.stringify(want)})`}`);
};
song('TREASURE : BANG YE DAM - HONESTY (Pink Sweat$ Cover.)', 'HONESTY');
song("BABYMONSTER - RORA 'Someone You Loved' COVER (Clean Ver.)", 'Someone You Loved');
song("ROSÉ - 'Until I Found You (Stephen Sanchez)' Cover", 'Until I Found You');
song('[COVER] 민규 - Glimpse of Us (원곡 : Joji)', 'Glimpse of Us');
song('GOLDEN Covered by IVE ANYUJIN', 'GOLDEN');
// 커버가 아닌데 제목에 cover가 섞인 것 — 'Undercover' M/V
song("VERIVERY - 'Undercover' Official M/V (Original ver.)", null);
// 너무 짧은 곡명은 남의 곡까지 끌려오니 버린다
song("[Artist Of The Month] 'Bad' covered by ATEEZ WOOYOUNG(우영) | June 2021 (4K)", null);

console.log(pass ? '\n🎉 Surf 제목 인물 추출 테스트 통과' : '\n❌ Surf 제목 인물 추출 테스트 실패');
process.exit(pass ? 0 : 1);
