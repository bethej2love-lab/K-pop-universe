// 라이브(무대) 탭 제외 조건 일원화 회귀 테스트 (2026-08-27)
//
// 배경: 사용자 요청 "영상 제목에 '비하인드'/'behind' 들어가면 카드 내 영상 live 탭에서 제외".
// 손대보니 라이브 탭 조건이 **네 군데에 복붙**돼 있었다 — 대표영상 선정 / 그리드 목록 / 탭 노출 판정
// / 편집 후 클라이언트 재확인(patchItem). 게다가 **탭 노출 판정에는 기존 제외 조건(엠카드림·[live])이
// 통째로 빠져** 있어서 "탭은 보이는데 열면 빈 목록"이 될 수 있었다.
// 그래서 커버 탭의 _COVER_EXCLUDE/_applyCoverExcludeQuery와 같은 방식으로 _LIVE_EXCLUDE 배열 +
// _applyLiveTabQuery(q) 하나로 묶고, 이 테스트가 그 대응을 고정한다.
//
// 이 프로젝트에서 "같은 정의가 여러 곳에 흩어져 한쪽만 고쳐지는" 사고가 반복됐다(루틴 vs 버튼,
// 커버 섹션 vs 탭 노출, 검수 큐 vs 홈 카운트). 그래서 정의가 하나인지를 소스에서 직접 검사한다.
//
// 실행: node tests/live-tab.test.js

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = true;
const ok = m => console.log(`✅ ${m}`);
const bad = m => { pass = false; console.log(`❌ ${m}`); };
const need = (c, m) => c ? ok(m) : bad(m);

// ── 제외 목록이 한 곳에 있고 요청한 키워드가 들어있는가 ────────────────────────────────
const listMatch = html.match(/const _LIVE_EXCLUDE=\[([^\]]*)\];/);
need(!!listMatch, '_LIVE_EXCLUDE 목록이 존재');
const list = listMatch ? listMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [];
for (const k of ['비하인드', 'behind', '엠카드림'])
  need(list.includes(k), `  · 제외 키워드에 '${k}' 포함`);
// title_norm은 NFKC+소문자라 대문자가 섞여 있으면 절대 매칭되지 않는다 — 조용히 안 먹는 버그가 된다.
need(list.every(k => k === k.toLowerCase()),
  `  · 전부 소문자(title_norm이 소문자 정규화라 대문자면 영영 안 걸림) — ${JSON.stringify(list)}`);

// ── 쿼리 조립이 한 함수인가, 그리고 모든 사용처가 그 함수를 쓰는가 ────────────────────
need(/function _applyLiveTabQuery\(q\)\{/.test(html), '라이브 탭 쿼리 조립이 _applyLiveTabQuery 한 함수에 있음');
const fnBody = (html.match(/function _applyLiveTabQuery\(q\)\{[\s\S]*?\n\}/) || [''])[0];
// 제외 루프는 _applyLiveExclude 쪽에 있고 탭 쿼리는 그걸 감싸기만 한다(탐험 차트가 제외만 재사용
// 하려고 2026-08-27에 쪼갬) — 그래서 배열 사용 여부는 _applyLiveExclude 본문에서 확인한다.
const excBody = (html.match(/function _applyLiveExclude\(q\)\{[\s\S]*?\n\}/) || [''])[0];
need(/_LIVE_EXCLUDE/.test(excBody), '  · 제외 함수가 _LIVE_EXCLUDE를 사용(하드코딩 아님)');
need(/content_formats\.cs\.\{live\}/.test(fnBody), '  · category=live OR content_formats=live 조건 유지');
need(/리무진서비스/.test(fnBody), '  · 리무진서비스 제목 예외 유지');

// 라이브 탭 조건을 만드는 곳이 이 함수 밖에 남아 있으면 드리프트다.
const strayOr = [...html.matchAll(/category\.eq\.live,content_formats\.cs\.\{live\}/g)].length;
need(strayOr === 1, `라이브 OR 조건은 _applyLiveTabQuery 안 1곳뿐이어야 함 — 발견 ${strayOr}곳`);
const uses = (html.match(/_applyLiveTabQuery\(/g) || []).length;
need(uses >= 4, `_applyLiveTabQuery 사용처 ${uses}곳(정의 1 + 대표영상/목록/탭노출 3)`);
// 예전에 여기만 빠져 있던 자리 — 탭 노출 판정도 같은 함수를 쓰는지 명시적으로 확인
need(/else if\(v==='live'\)q=_applyLiveTabQuery\(q\)/.test(html),
  "탭 노출 판정(_chk)도 같은 조건 사용 — 예전엔 여기만 제외 조건이 통째로 빠져 있었다");

// ── 편집 직후 클라이언트 재확인도 같은 목록을 쓰는가 ──────────────────────────────────
need(/_LIVE_EXCLUDE\.some\(k=>t\.includes\(k\)\)/.test(html),
  'patchItem의 라이브 재확인이 _LIVE_EXCLUDE를 그대로 사용(엠카드림 하드코딩 제거)');
need(!/if\(t\.includes\('엠카드림'\)\)stillQualifies=false/.test(html),
  '  · 옛 하드코딩(엠카드림 단독 체크)이 남아있지 않음');
// 서버는 title_norm(NFKC+소문자)로 거르는데 클라이언트가 toLowerCase만 하면 스타일드 문자에서 갈린다
const patchLive = (html.match(/\}else if\(state\.filter==='live'\)\{[\s\S]*?\n      \}/) || [''])[0];
need(/_titleNorm\(newRow\.title\|\|''\)/.test(patchLive),
  '  · 비교 기준이 _titleNorm — 서버 title_norm과 같은 정규화');

// ── 탐험 패널의 라이브 차트도 같은 제외를 쓰는가 ──────────────────────────────────────
// 1차 수정 때 카드 탭만 고쳤더니 "탐험 패널의 이번주 직캠 TOP 같은 섹션엔 그대로 남는다"는 지적을
// 받았다(2026-08-27). 그 섹션들은 탭 조건이 아니라 category='live'를 직접 조회하므로, 제외 조각만
// 떼어낸 _applyLiveExclude를 쓰게 했다. category='live' 직접 조회가 하나라도 맨몸으로 남으면 실패.
need(/function _applyLiveExclude\(q\)\{/.test(html), '제외 조각이 _applyLiveExclude로 분리됨');
need(/return _applyLiveExclude\(q\.or\(/.test(html), '  · 탭 쿼리(_applyLiveTabQuery)도 그 조각을 재사용');
const bareLive = [];
html.split('\n').forEach((l, i) => {
  if (!/\.eq\('category','live'\)/.test(l)) return;
  // 체인 시작이 _applyLiveExclude(로 감싸져 있는지 — 같은 줄 또는 위 3줄 안에서 확인
  const near = html.split('\n').slice(Math.max(0, i - 3), i + 1).join('\n');
  if (!/_applyLiveExclude\(sb\.from/.test(near)) bareLive.push(`${i + 1}: ${l.trim().slice(0, 60)}`);
});
need(bareLive.length === 0,
  `category='live' 직접 조회가 전부 _applyLiveExclude로 감싸짐 — 누락 ${bareLive.length}건${bareLive.length ? '\n     ' + bareLive.join('\n     ') : ''}`);

// ── 예능(variety) 탭 제목 키워드도 한 곳인가 ─────────────────────────────────────────
// 라이브와 똑같이 네 군데에 복붙돼 있었다(대표영상·목록·탭 노출·patchItem).
const varMatch = html.match(/const _VARIETY_TITLE_KEYWORDS=\[([^\]]*)\];/);
need(!!varMatch, '_VARIETY_TITLE_KEYWORDS 목록이 존재');
const varList = varMatch ? varMatch[1].split(',').map(s => s.trim().replace(/^'|'$/g, '')) : [];
for (const k of ['놀면뭐하니', '놀면 뭐하니', '전참시', '라디오스타'])
  need(varList.includes(k), `  · 예능 키워드에 '${k}' 포함`);
need(varList.every(k => k === k.toLowerCase()), '  · 전부 소문자(title_norm 정규화 기준)');
need(/function _applyGenreTabQuery\(q,filter\)\{/.test(html), 'variety/show 탭 쿼리가 _applyGenreTabQuery 한 함수에 있음');
// 키워드가 함수 밖에 또 하드코딩돼 있으면 드리프트 — 정의 한 줄에만 나와야 한다.
const raKeyword = (html.match(/라디오스타/g) || []).length;
need(raKeyword === 1, `예능 키워드 하드코딩은 정의 1곳뿐이어야 함 — '라디오스타' 발견 ${raKeyword}곳`);
const genreUses = (html.match(/_applyGenreTabQuery\(/g) || []).length;
need(genreUses >= 5, `_applyGenreTabQuery 사용처 ${genreUses}곳(정의 1 + 대표영상/목록/탭노출 variety·show)`);
need(/_VARIETY_TITLE_KEYWORDS\.some\(k=>t\.includes\(k\)\)/.test(html),
  'patchItem의 예능 재확인도 같은 배열을 사용');

console.log(pass ? '\n✅ 라이브/예능 탭 조건 테스트 통과' : '\n❌ 라이브/예능 탭 조건 테스트 실패');
process.exit(pass ? 0 : 1);
