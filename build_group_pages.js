#!/usr/bin/env node
// 그룹+멤버별 정적 SEO 페이지 생성 스크립트 (2026-08-19 그룹 페이지 신설, 2026-08-21 멤버 페이지 추가
// — 해시 라우팅(#g=...)은 검색엔진이 아예 못 읽어서 그룹/멤버 249개+1600명 데이터가 있어도 검색엔진엔
// "페이지 1개"로만 보이던 문제 해결. 멤버 페이지는 Fable 자문 세션에서 확인한 방향 — 롱테일 검색
// ("OO 직캠", "OO 몇 년 데뷔") 진입점으로 그룹 페이지보다 전략적 우선순위가 높음).
// groups.json/artists.json을 읽어 그룹당 정적 HTML 2장(한국어 g/{ko}/index.html, 영어
// en/g/{slug}/index.html), 멤버당 2장(그룹 소속은 g/{그룹}/{멤버}/, en/g/{그룹}/{멤버}/ 중첩 —
// 동명이인이 다른 그룹에 있을 수 있어 그룹으로 구분 필수. GROUPS에 없는 솔로는 member/{이름}/,
// en/member/{이름}/ 최상위)를 만든다. index.html(진짜 앱)은 전혀 안 건드림 — 이 정적 페이지들은
// 검색엔진·SNS 미리보기 전용 "착지 페이지"이고, "우주에서 보기" 버튼으로만 실제 앱(해시 딥링크)에
// 연결된다(자동 리디렉트 없음 — 검색엔진이 "콘텐츠 없는 리디렉트 페이지"로 오판하는 것 방지).
//
// ── "우주에서 보기" 버튼을 화면 하단에 고정(.cta-dock, 2026-09-08) ─────────────────────────
// 이 페이지엔 성격이 다른 두 방문자가 같이 떨어진다. **검색으로 온 사람**은 정보를 읽으러 온 거라
// 지금 구조가 맞지만, **공유 링크를 누른 사람**은 이미 뭘 볼지 알고 온 거라 스크롤이 순수 마찰이다.
// 실측(390x844 모바일, 2026-09-08 사용자 제보로 측정): CTA가 에스파 1.11 · 소녀시대 1.35 · 세븐틴 1.58 ·
// 방탄소년단 1.61 화면 아래에 있어 **전 그룹이 첫 화면에서 안 보였다**(그룹이 클수록 디스코가 길어져 더 밀림).
//
// `position:sticky; bottom:0`으로 스크롤 내내 화면 하단에 떠 있다가 문서 끝에서 제자리에 앉는다.
//   · fixed가 아닌 이유: 마지막엔 본문 흐름으로 돌아와 언어 전환 링크를 안 가린다(실측 확인).
//   · JS가 필요 없다 — 정적 SEO 페이지에 스크립트를 늘리지 않는다.
//   · `.wrap`의 하단 여백을 80→20px로 줄였다. sticky는 자기 흐름상 위치에 정착하므로, 여백이 크면
//     문서 끝에서 버튼이 그만큼 붕 떠 보이는 자리로 앉는다.
// ⚠️ 그래도 **자동 리디렉트는 안 한다**(위 문단). 사람만 앱으로 넘기려면 UA 분기가 필요한데 클로킹으로
//    읽힐 수 있고, 검색 유입자에겐 이 페이지 자체가 착지점이라 SEO 가치를 스스로 버리는 셈이다.
// ⚠️ 근거 주석을 CSS 안에 쓰지 말 것 — 이 템플릿은 4,000장에 그대로 복제된다(한 번 그렇게 넣었다가
//    페이지당 ~1.2KB, 합계 ~4.7MB가 불어서 여기로 옮겼다).
//
// 실행: node build_group_pages.js (GitHub Actions가 artists.json/groups.json push마다 자동
// 실행+커밋하도록 이미 세팅돼있음, 2026-08-21 — .github/workflows/rebuild-seo-pages.yml. 로컬에서
// 수동 실행할 땐 g/, en/g/, member/, en/member/, sitemap.xml을 결과물과 함께 GitHub에 업로드.)

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SITE = 'https://kpop-universe.kr';
// 화면 맨 위 안내 문장(<p class="lead">서술형 한 줄)은 전 템플릿에서 뺐다(2026-11-19 사용자 "정적페이지 서술형 안내 문장 아예 빼") — 같은 내용은
// <meta name="description">에 남아 검색엔 그대로 쓰인다. '… 전체 보기 →' 같은 링크 줄(.lead 안의 a)은 이동 수단이라 유지.
// Match index.html automation detection before the Google tag can execute.
const SEO_GA_TAG = `<script>
try{if(navigator.webdriver||/headless|bot|crawl|spider|lighthouse|playwright|puppeteer/i.test(navigator.userAgent||''))window['ga-disable-G-Z5NTV6X3YF']=true;}catch(e){}
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>`;
// 영상 목록 공유 링크(2026-11-02) — 앱의 "이 목록 공유"는 그룹·멤버 정적 페이지 주소 + #…&vf=… 로 나간다. 블로그·메신저는 # 뒤를 무시하고
// 이 페이지의 미리보기(그 사람 썸네일)를 쓰고(예전 kpop-universe.kr/#… 는 늘 사이트 기본 그림), 사람은 바로 앱의 그 목록으로 넘어간다.
const LIST_FWD = `<script>(function(){var h=location.hash;if(/(^#|&)vf=/.test(h))location.replace('${SITE}/'+h);})();</script>`;

// 검색/AI 답변이 다른 언어 URL을 골라도 첫 화면에서 대응 언어로 이동할 수 있게 한다.
// 경로는 각 템플릿의 altUrl을 재사용해 동명이인·곡·프로그램 문맥을 보존한다.
function languageNav(isEn, altUrl) {
  const target = isEn ? 'ko' : 'en';
  // 2026-11-19 사용자(폰 스크린샷) "View in English 버튼 너무 크고 구림 — 테두리 없애고, 그 줄로 K-POP UNIVERSE 글자를 올려줘":
  // 알약 버튼 → 테두리·바탕 없는 작은 글자. float:right라 바로 뒤의 브랜드 줄(.brand)이 같은 줄 왼쪽으로 올라온다(영상 썸네일도 그만큼 위로).
  return `<nav class="language-nav" aria-label="${isEn ? 'Language' : '언어 선택'}" style="float:right;margin:0 0 0 12px"><a href="${escHtml(altUrl)}" lang="${target}" hreflang="${target}" style="display:inline-block;line-height:20px;padding:8px 2px;margin:-8px 0;color:rgba(170,190,240,.82);font-size:12.5px;text-decoration:none">${isEn ? '한국어' : 'English'}</a></nav>`; // 글자도 짧게 — 그룹 페이지는 윗줄에 링크가 셋(브랜드·그룹 전체·모아보기)이라 폰 폭에 'View in English'까지는 안 들어간다
}

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

// index.html에 이미 있는 소속사 한/영 매핑표를 그대로 재사용(중복 유지보수 방지) — 신뢰할 수 있는
// 내 파일에서 안전하게 추출하는 것이므로 정규식으로 블록을 잘라 eval.
const indexSrc = require('./tools/index_source.cjs').readIndexSource();
const {agencySource} = require('./tools/seo_inputs_unchanged.cjs');
const agencyBlock = agencySource(indexSrc);
const AGENCY_EN = agencyBlock ? new Function('return ' + agencyBlock.replace(/^const _AGENCY_EN=/, ''))() : {};
// 페이지 보강(2026-10-16) — 음방 1위·인기 직캠(DB)과 투어·대상·밀리언·작사작곡(정적 파일). tools/seo_extra.js 주석 참고.
const SEO = require('./tools/seo_extra.js');
const membershipLib = (() => { const vm = require('vm'), ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + '\nthis.aff=_artistAffiliation;this.status=_artistMembershipStatus;', ctx); return ctx; })();
const affiliationFor = (a,ko) => membershipLib.aff(a,ko);
const membershipStatus = (a,ko) => membershipLib.status(a,ko,groups[ko]);
// 동명이인 솔로 주소 규칙은 앱과 같은 함수(shared.js _soloPageSuffix)를 쓴다(2026-10-19)
const _soloPageSuffix = (() => { const vm = require('vm'); const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + '\nthis.f=_soloPageSuffix;', ctx); return ctx.f; })();
const _suffixCache = new Map();
const soloSuffix = a => { if (!_suffixCache.has(a)) _suffixCache.set(a, _soloPageSuffix(a, artists, groups)); return _suffixCache.get(a); };
const ST = SEO.loadStatic(ROOT);
let EX = { wins: {}, memberWins: {}, top: {} }; // DB 보강분 — 메인에서 prefetch로 채운 뒤 페이지를 만든다
// 같은 소속사·같은 해 데뷔 그룹(내부 링크 — 검색엔진이 페이지 사이를 돌고, 사람도 "비슷한 그룹"으로 이어 본다)
function relatedGroups(ko) {
  const me = groups[ko]; if (!me) return [];
  const coKey = c => String(c || '').split('/').pop().trim();
  const y = String(me.debut || '').slice(0, 4);
  const pick = Object.keys(groups).filter(k => k !== ko && !groups[k].disbanded && ((me.co && coKey(groups[k].co) === coKey(me.co)) || (y && String(groups[k].debut || '').slice(0, 4) === y)));
  return pick.sort((a, b) => (+(groups[b].pri || 0)) - (+(groups[a].pri || 0))).slice(0, 8);
}
function agencyEn(co) {
  if (!co) return co;
  if (AGENCY_EN[co]) return AGENCY_EN[co];
  return co.replace(/\s*엔터테인먼트$/, ' Ent.');
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 화면 머리(h1·소속 줄)용 — 괄호 없이 한 칸 띄어 '코르티스 CORTIS'(2026-11-20 사용자 "괄호 떼고 띄어쓰기 한 칸"). 앱 카드의 '한글명 영문명' 표기와 같다.
// 검색 제목(<title>)·설명·목록 글자는 bilingualLabel(괄호) 그대로 — docs/NAMING.md.
function spacedLabel(primary, alternate) {
  const a=String(primary||'').trim(),b=String(alternate||'').trim();
  return a && b && a.toLocaleLowerCase()!==b.toLocaleLowerCase() ? `${a} ${b}` : (a||b);
}
function bilingualLabel(primary, alternate) {
  const a=String(primary||'').trim(),b=String(alternate||'').trim();
  // 이름 표기(2026-11-11 사용자 확정): 한글(영문) — '영재(Youngjae)', 영문 페이지는 'Youngjae(영재)'. 규칙 전체는 docs/NAMING.md
  return a && b && a.toLocaleLowerCase()!==b.toLocaleLowerCase() ? `${a}(${b})` : (a||b);
}
// 앱의 _hashEsc와 동일 규칙(index.html 참고) — 해시 구분자로 실제 쓰이는 문자만 최소 이스케이프,
// 한글은 그대로 둬서 딥링크가 지저분해지지 않게 함.
function hashEsc(s) { return String(s).replace(/[ &=#%+]/g, encodeURIComponent); }
function slugify(en, fallbackKo) {
  const base = (en || fallbackKo || '').toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'group';
}
// 그룹명 끝에 마침표/공백이 있으면(H.O.T., S.E.S.) Windows가 폴더 생성 시 이를 자동으로 잘라내서,
// 로컬(Node)이 만든 실제 폴더명과 git.exe가 인식하는 경로가 어긋나 "could not open directory"로
// 조용히 커밋에서 누락되는 문제가 있었음(2026-08-19, git 클론 기반 배포로 전환하며 실측 발견 — git
// add -A 실행 시 이 두 그룹만 경고와 함께 통째로 빠짐). 폴더/URL 경로에서만 끝 마침표·공백을 제거하고,
// 화면 표시 텍스트나 앱 내부 딥링크 해시(#g=...)는 원래 이름(H.O.T. 그대로) 그대로 써야 앱의 GROUPS
// 키와 어긋나지 않는다.
function urlSafeKo(ko) {
  return ko.replace(/[.\s]+$/, '');
}

// ── 한국어 조사 자동 선택 (2026-09-15) ──────────────────────────────────────
// 공유 미리보기 설명이 이름과 무관하게 `${ko}가`로 고정돼 있어서 "종현가 다른 케이팝 아이돌들…"
// 처럼 틀린 문장이 나왔다(사용자 제보). 받침 유무로 이/가·은/는·을/를·와/과를 고른다.
//
// ⚠️ 이름이 한글로만 끝나지 않는다. 실측(2026-09-15) 그룹·멤버 이름 중 46개가 한글 음절이
//    아닌 문자로 끝난다 — `엔시티 127`, `2PM`, `CL`, `H.O.T.`, `B.I`, `god` 등. 그래서
//    ①끝의 마침표·괄호를 떼고 ②숫자·알파벳은 **한국어 읽기의 종성**으로 판정한다.
//      숫자: 0 영·1 일·3 삼·6 육·7 칠·8 팔 → 받침 O / 2 이·4 사·5 오·9 구 → X
//      알파벳: l 엘·m 엠·n 엔·r 알 → 받침 O / 나머지는 X (f는 '에프'라 받침 없음 — 흔한 착각)
//    → `엔시티 127이`, `2PM이`, `CL이`, `NRG가`, `H.O.T.가`처럼 맞게 나온다.
// ⚠️ 글자를 하나씩 읽지 않고 단어로 읽는 이름은 예외로 둔다(god = "갓"). 발음 사전이 없으면
//    일반 규칙으로는 못 맞히는 부류라, 발견될 때마다 여기에 추가하는 게 정직하다.
const JOSA_READ_AS_WORD = { god: true }; // 단어로 읽어서 받침이 생기는 이름
const JOSA_DIGIT_FINAL = new Set(['0', '1', '3', '6', '7', '8']);
const JOSA_ALPHA_FINAL = new Set(['l', 'm', 'n', 'r']);
function hasFinalConsonant(word) {
  const s = String(word || '').trim().replace(/[^0-9A-Za-z가-힣]+$/, ''); // "H.O.T." → "H.O.T"
  if (!s) return false;
  if (JOSA_READ_AS_WORD[s.toLowerCase()] !== undefined) return JOSA_READ_AS_WORD[s.toLowerCase()];
  const c = s.slice(-1);
  if (c >= '가' && c <= '힣') return (c.charCodeAt(0) - 0xAC00) % 28 !== 0; // 종성 인덱스 0 = 받침 없음
  if (c >= '0' && c <= '9') return JOSA_DIGIT_FINAL.has(c);
  if (/[A-Za-z]/.test(c)) return JOSA_ALPHA_FINAL.has(c.toLowerCase());
  return false; // 판단 못 하면 받침 없는 쪽(가/는/를/와) — 어느 쪽이든 하나는 틀리므로 기본값을 고정해둔다
}
// josa('종현', '이/가') → '이' · josa('아이유', '이/가') → '가'
// ⚠️ 표를 쓰는 이유: 조사쌍마다 "받침 있을 때 오는 쪽"의 관용 표기 순서가 다르다. 이/가·은/는·을/를은
//    받침 있는 쪽이 앞이지만 **와/과는 반대**다(받침 있으면 '과'). 인자를 앞/뒤로 해석하게 짰더니
//    `josa(x,'와/과')`가 "종현와"를 뱉었다. 표기 순서와 무관하게 정답이 나오도록 쌍을 등록해둔다.
const JOSA_TABLE = {
  '이/가': ['이', '가'], '가/이': ['이', '가'],
  '은/는': ['은', '는'], '는/은': ['은', '는'],
  '을/를': ['을', '를'], '를/을': ['을', '를'],
  '과/와': ['과', '와'], '와/과': ['과', '와'],
};
function josa(word, pair) {
  const t = JOSA_TABLE[pair];
  if (!t) throw new Error(`josa: 모르는 조사쌍 "${pair}" — JOSA_TABLE에 등록하세요`);
  return hasFinalConsonant(word) ? t[0] : t[1];
}
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// 디스코그래피 앨범 종류(멜론 원 표기, 한국어)를 EN 페이지용으로 번역 — "미니 3집"처럼 숫자가 붙은
// 표기는 서수로("3rd EP"), 나머지는 고정 매핑.
function typeEn(type) {
  if (!type) return type;
  const numMatch = type.match(/^(미니|정규)\s*(\d+)집$/);
  if (numMatch) return `${ordinal(+numMatch[2])} ${numMatch[1] === '미니' ? 'EP' : 'Album'}`;
  const FIXED = {
    '싱글': 'Single', '디지털싱글': 'Digital Single', '스페셜싱글': 'Special Single',
    '미니': 'EP', '정규': 'Album', '정규 리패키지': 'Repackage', '리패키지': 'Repackage',
    '스페셜': 'Special', 'OST': 'OST', '라이브': 'Live', '컴필레이션': 'Compilation',
    '옴니버스': 'Compilation', '앤솔러지': 'Anthology', '리믹스': 'Remix',
  };
  return FIXED[type] || type;
}
function isoDate(d) {
  const m = String(d || '').match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : (String(d || '').match(/^\d{4}$/) ? `${d}-01-01` : null);
}
function membersOf(ko) {
  return artists.filter(a => (a.group && a.group.ko === ko) || (a.groups || []).some(g => g.ko === ko));
}
// ── 정적 페이지끼리의 내부 링크(2026-08-31) ────────────────────────────────────
// 예전엔 그룹→멤버, 멤버→소속그룹 링크가 전부 앱 딥링크 해시(`/#g=에스파&m=카리나`)였다. 그래서
// **정적 페이지 3,999개가 서로를 전혀 안 가리키는 고아 상태**였고, sitemap.xml 말고는 크롤러가 들어올
// 경로가 없었다(실측: 그룹 페이지의 href에 멤버 정적 경로가 0건).
// 사이트맵만으론 크롤링 우선순위도 낮고 내부 링크로 오는 신호가 아예 없다 — 페이지를 두껍게 만들기
// 전에 이걸 먼저 고친다. 앱으로 보내는 CTA("우주에서 보기 →")는 해시 그대로 둔다(그건 의도된 딥링크).
// ⚠️ 아래 경로 규칙은 groupPath/memberPath 생성부와 **반드시 같아야 한다** — 어긋나면 404 링크가 3,999개
//    페이지에 박힌다. 한 곳에서 만들어 양쪽이 같이 쓰도록 뺐다.
function groupPagePath(gko, lang) {
  const info = groups[gko];
  if (!info) return null;
  return lang === 'en'
    ? `en/g/${slugify(info.en || gko, gko)}/`
    : `g/${urlSafeKo(gko)}/`;
}
function memberPagePath(a, lang) {
  const ko = a.name.ko;
  const primaryGko = a.group.ko;
  const isSolo = !groups[primaryGko];
  if (lang === 'en') {
    const slug = slugify(a.name.en || ko, ko);
    if (isSolo) return `en/member/${slug}${soloSuffix(a).en}/`;
    return `en/g/${slugify(groups[primaryGko].en || primaryGko, primaryGko)}/${slug}/`;
  }
  return isSolo ? `member/${urlSafeKo(ko)}${soloSuffix(a).ko}/` : `g/${urlSafeKo(primaryGko)}/${urlSafeKo(ko)}/`;
}
// 공유 미리보기용 대표 영상 썸네일 캐시(2026-08-26, tools/build_og_thumbs.mjs가 생성).
// 왜: 아래 ogImageFor()는 groups.json/artists.json의 songs[0]에서만 썸네일을 뽑는데 그 필드가
// 그룹 14개·아티스트 56명에만 있어서, 실측 결과 그룹 페이지의 96%·멤버 페이지의 97%가 전부 같은
// 일반 og-image.png로 폴백하고 있었다(=어떤 링크를 공유해도 미리보기가 똑같음). 영상은 Supabase에
// 있으므로 거기서 그룹/멤버별 대표 영상을 골라 캐시해두고 여기서 읽는다.
// 캐시가 없으면 기존 동작(songs[0] → 일반 이미지)으로 조용히 폴백하므로 빌드는 항상 성공한다.
let OG_THUMBS = { groups: {}, members: {} };
try {
  OG_THUMBS = JSON.parse(fs.readFileSync(path.join(ROOT, 'og_thumbs.json'), 'utf8'));
} catch (e) {
  console.warn('[build] og_thumbs.json 없음 — 대표 썸네일 없이 진행(node tools/build_og_thumbs.mjs로 생성)');
}
// maxresdefault는 1280×720, hqdefault는 480×360 — 크롤러가 큰 카드로 렌더하려면 크기 메타가 필요하다
function ogSizeFor(url) {
  if (/wsrv\.nl/.test(url)) return { w: 720, h: 720 };
  if (/maxresdefault|hq720/.test(url)) return { w: 1280, h: 720 };
  if (/mqdefault/.test(url)) return { w: 320, h: 180 };
  if (/hqdefault/.test(url)) return { w: 480, h: 360 };
  // 앨범 커버(멜론 _500.jpg·스포티파이 640·애플)는 정사각인데 아래 기본값 1200×630으로 선언돼 있었다(11-17) — 실제 크기로
  if (/cdnimg\.melon\.co\.kr/.test(url)) return { w: 500, h: 500 };
  if (/i\.scdn\.co/.test(url)) return { w: 640, h: 640 };
  if (/mzstatic\.com/.test(url)) return { w: 600, h: 600 };
  if (/supabase\.co\/storage/.test(url)) return { w: 600, h: 600 }; // 등록 프로필 사진(영상이 없을 때의 대체, 대개 정사각)
  return { w: 1200, h: 630 }; // 자체 og-image.png
}
function ogImageForGroup(ko, info) { return (OG_THUMBS.groups && OG_THUMBS.groups[ko]) || ogImageFor(info); }
function ogImageForMember(a) {
  const k = a.group.ko + '|' + a.name.ko;
  // 멤버 영상·프로필 사진이 다 없으면 그룹 대표 썸네일(2026-10-19) — 기본 이미지보다 그 그룹이 보이는 게 낫다
  // 솔로 키(group='솔로')인 예전 멤버는 소속 이력(groups) 중 썸네일 있는 첫 그룹(스피드 김유환 → 스피드)
  const gk = [a.group, ...(a.groups || [])].map(g => g && g.ko).find(x => x && OG_THUMBS.groups && OG_THUMBS.groups[x]);
  // 동명이인 솔로(레나·현아 등)는 영상·사진 키가 이름뿐이라 둘이 같은 값을 나눠 갖는다 → 각자 예전 그룹 썸네일로(2026-10-19)
  if (!groups[a.group.ko] && (soloSuffix(a).ko || soloSuffix(a).en) && gk) return OG_THUMBS.groups[gk];
  return (OG_THUMBS.members && OG_THUMBS.members[k]) || (gk && OG_THUMBS.groups[gk]) || ogImageFor(a);
}
function ogImageFor(info) {
  const song = (info.songs || [])[0];
  if (!song || !song.u) return `${SITE}/og-image.png`;
  const m = song.u.match(/(?:v=|shorts\/)([\w-]{6,15})/);
  return m ? wideThumb(m[1]) : `${SITE}/og-image.png`;
}
// ── 공유 미리보기·검색 썸네일은 16:9로(2026-11-11 사용자: 네이버 "송승호 직캠" 결과에서 우리 썸네일만 정사각형 안에 가로 사각형이
// 위아래 검은 띠째 갇혀 보였다). hqdefault(480×360)는 4:3이라 16:9 영상의 위아래에 검은 띠가 그림에 박혀 있다.
// maxresdefault(1280×720)·hq720은 없는 영상이 있어 빌드 때 HEAD로 확인하고 결과를 og_wide.json에 쌓아 둔다(다음 빌드는 새 영상만 확인).
// 확인 못 한 영상은 mqdefault(320×180, 항상 있고 16:9) — 띠보다는 작은 게 낫다. 값: x=maxresdefault, 7=hq720, m=mqdefault.
const WIDE_FILE = path.join(ROOT, 'og_wide.json');
let WIDE = {};
try { WIDE = JSON.parse(fs.readFileSync(WIDE_FILE, 'utf8')); } catch (e) { /* 첫 빌드 */ }
const WIDE_Q = { x: 'maxresdefault', 7: 'hq720', m: 'mqdefault' };
// 11-17 네이버에서 위아래 검은 띠 — 확인 대상이 곡·멤버×곡·직캠 허브 영상뿐이라 케미(2,607)·프로그램(761)·음방·커버 등 ~3,600쪽의 대표 영상은
// 한 번도 확인이 안 돼 320×180(mqdefault)로 나갔다. 확인 안 된 영상을 여기 모아 두었다가 빌드 끝에 확인하고 og_wide.json에 쌓는다(다음 빌드부터 반영).
const WIDE_MISS = new Set();
function sqOg(url){const m=/i\.ytimg\.com\/vi\/([^/?]+)\//.exec(url||"");return m?`https://wsrv.nl/?url=i.ytimg.com/vi/${m[1]}/maxresdefault.jpg&w=720&h=720&fit=cover&a=attention&output=jpg&q=80`:url;}
function wideThumb(id) { if (id && !WIDE[id]) WIDE_MISS.add(id); return `https://i.ytimg.com/vi/${id}/${WIDE_Q[WIDE[id]] || 'mqdefault'}.jpg`; }
async function probeWide(ids) {
  const max = +(process.env.OG_WIDE_MAX || 8000);
  const todo = [...new Set(ids)].filter(id => id && !WIDE[id]).slice(0, max);
  if (!todo.length) return;
  let i = 0, big = 0, done = 0, netFail = 0;
  const head = async (id, q) => { const r = await fetch(`https://i.ytimg.com/vi/${id}/${q}.jpg`, { method: 'HEAD' }); return r.ok; };
  const worker = async () => {
    while (i < todo.length) {
      const id = todo[i++];
      try {
        const v = (await head(id, 'maxresdefault')) ? 'x' : (await head(id, 'hq720')) ? '7' : 'm';
        WIDE[id] = v; done++; if (v !== 'm') big++;
      } catch (e) { netFail++; if (netFail > 50 && !done) { i = todo.length; } } // 네트워크가 막힌 환경(회사망 등)이면 곧 포기 — 저장 안 함
    }
  };
  await Promise.all(Array.from({ length: 32 }, worker));
  const sorted = Object.fromEntries(Object.keys(WIDE).sort().map(k => [k, WIDE[k]]));
  fs.writeFileSync(WIDE_FILE, JSON.stringify(sorted, null, 0).replace(/,"/g, ',\n"') + '\n');
  console.log(`16:9 썸네일 확인 ${done}/${todo.length}개(1280px ${big}) · 누적 ${Object.keys(WIDE).length}${netFail ? ` · 실패 ${netFail}` : ''}`);
}

// ── 소개 문단 생성 (2026-10-13) ─────────────────────────────────────────────
// 기존 SEO 페이지는 메타데이터+목록만 있어 Google이 "텍스트 없는 페이지"로 판정 — 자연스러운 문장을
// 한 단락 넣어 색인 품질을 높인다.
function groupIntroHtml(ko, info, members, discogItems, lang) {
  const isEn = lang === 'en';
  const name = isEn ? (info.en || ko) : ko;
  // 추모 멤버가 있는 그룹은 활동 인원과 공식 멤버 정의가 다를 수 있어 단정적인 N인조 문구를 생략한다.
  const memCount = members.some(a => a.died) ? 0 : members.filter(a => membershipStatus(a,ko) !== 'former').length;
  const gender = info.gender === 'f' ? (isEn ? 'girl group' : '걸그룹') : info.gender === 'm' ? (isEn ? 'boy group' : '보이그룹') : (isEn ? 'K-pop group' : '케이팝 그룹');
  const agency = isEn ? agencyEn(info.co) : info.co;
  const debutYear = String(info.debut || '').slice(0, 4);
  const recent = discogItems.slice(0, 3);
  const disbanded = !!info.disbanded;
  let text;
  if (isEn) {
    let s = `${name} is`;
    if (disbanded) s = `${name} was`;
    if (memCount) s += ` a ${memCount}-member`;
    s += ` K-pop ${gender}`;
    if (agency) s += ` under ${agency}`;
    if (debutYear) s += `, debuting in ${debutYear}`;
    s += '.';
    if (!disbanded && info.fandom && (info.fandom.en || info.fandom.ko)) s += ` Fan club: ${info.fandom.en || info.fandom.ko}.`;
    if (recent.length) s += ` Recent releases: ${recent.map(a => `${a.title} (${String(a.releaseDate||'').slice(0,4)})`).join(', ')}.`;
    text = s;
  } else {
    const parts = [];
    if (memCount) parts.push(`${memCount}인조 ${gender}`); else parts.push(gender);
    if (agency) parts.push(agency);
    if (debutYear) parts.push(`${debutYear}년 데뷔`);
    if (disbanded) parts.push('해체');
    if (!disbanded && info.fandom && info.fandom.ko) parts.push(`팬덤명 ${info.fandom.ko}`);
    if (recent.length) parts.push(`대표 앨범 ${recent.map(a => `${a.title}(${String(a.releaseDate||'').slice(0,4)})`).join(', ')}`);
    text = parts.join('. ') + '.';
  }
  return `<p class="intro">${escHtml(text)}</p>`;
}

const ISO_COUNTRY = { KR:'South Korean', JP:'Japanese', CN:'Chinese', TH:'Thai', TW:'Taiwanese',
  US:'American', AU:'Australian', HK:'Hong Kong', CA:'Canadian', MY:'Malaysian', PH:'Philippine',
  VN:'Vietnamese', ID:'Indonesian', NZ:'New Zealand', GB:'British', SG:'Singaporean', MX:'Mexican' };
function memberIntroHtml(a, affiliations, lang) {
  const isEn = lang === 'en';
  const name = isEn ? (a.name.en || a.name.ko) : a.name.ko;
  const natRaw = a.nat ? (isEn ? (a.nat.en || a.nat.ko) : a.nat.ko) : null;
  const nat = (isEn && natRaw) ? (ISO_COUNTRY[natRaw] || natRaw) : natRaw;
  const bdayYear = String(a.bday || '').slice(0, 4);
  const grpNames = affiliations.map(g => isEn ? (groups[g.ko] && (groups[g.ko].en || g.ko)) : g.ko).filter(Boolean);
  const entry = affiliationFor(a,a.group.ko) || {};
  const paused = !!entry.pausedFrom && !entry.left;
  const active = a.active !== false || paused;
  let text;
  if (isEn) {
    let s = `${name} is a${active ? '' : ' former'} K-pop idol`;
    if (nat) s += ` of ${nat} nationality`;
    if (bdayYear) s += `, born in ${bdayYear}`;
    s += '.';
    if (grpNames.length) s += ` Member of ${grpNames.join(', ')}.`;
    if (paused) s += ' Currently on hiatus.';
    text = s;
  } else {
    const parts = [];
    if (grpNames.length) parts.push(grpNames.join(', ') + ' 멤버');
    if (nat) parts.push(`${nat} 출신`);
    if (bdayYear) parts.push(`${bdayYear}년생`);
    if (paused) parts.push('활동 중단'); else if (!active) parts.push('활동 종료');
    text = parts.join('. ') + '.';
  }
  return `<p class="intro">${escHtml(text)}</p>`;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const pages = []; // {loc, alt: {ko,en}} for sitemap + hreflang bookkeeping

const groupKos = Object.keys(groups);
// DB 보강 데이터를 받은 뒤에 만들도록 함수로 감쌌다(2026-10-16) — 메인(파일 끝)에서 prefetch 후 호출
// ── 정적 '이어서 보기' 카드 — 그룹·앨범·케미·멤버 직캠 허브(2026-11-17 사용자: "앱 로딩이 느려 이탈 — 정적으로 되는 건 정적끼리, 새 페이지는 만들지 말고 있는 정적 페이지를 잇기") ──
// 영상을 눌러 재생 화면이 뜨면 아래에 나오는 카드(seo_play.js가 <script id="kpu-next">를 읽는다). 이 템플릿들엔 그게 없어서 기본 카드(앱으로 가는 '더 둘러보기')가 떴다.
// 아래 카드는 전부 **이미 만들어지는 정적 페이지**로만 잇는다(곡·멤버 직캠·앨범·그룹·케미). 모양은 nextItemsJson과 같다({k,t,s,img|im,h,m}).
// 카드 계산이 던져도 빌드 전체가 죽지 않게(2026-11-17) — 정적 빌드는 DB가 필요해 로컬 전체 실행이 어려워, 새 카드 코드의 예외 한 번이 모든 정적 페이지 갱신을 막는 걸 피한다.
function safeNext(fn) { try { return nextCardsJson(fn()); } catch (e) { console.warn('[이어서 보기] 카드 건너뜀: ' + e.message); return ''; } }
function nextCardsJson(items) {
  const arr = (items || []).filter(Boolean).slice(0, 5);
  return arr.length ? `<script type="application/json" id="kpu-next">${JSON.stringify(arr).split('<').join(String.fromCharCode(92) + 'u003c')}</script>` : '';
}
const _topVidId = vs => { const v = (vs || []).slice().sort((p, q) => (q.view_count || 0) - (p.view_count || 0))[0]; return v ? (v.id || v.v || '') : ''; };
const _nmOf = (x, isEn) => isEn ? (x.name.en || x.name.ko) : (x.displayName || x.name.ko);
// ── 커버 원곡(2026-11-17 사용자 "에잇턴 Love Dive는 아이브 원곡인데 정적 페이지에 티가 안 난다") ─────────────────────────────────────────
// 서바이벌 경연 앨범(disco의 contest:true — 로드 투 킹덤·킹덤·PEAK TIME 등)의 수록곡 중, **다른 그룹이 더 먼저 정규 발매한 같은 곡**이 딱 한 팀으로 특정되면 그 곡은 그 팀의 커버다.
// 정확도 근거(전 그룹 실측): 경연 앨범 수록곡만 쓴다. 컴필레이션(THE BEST·ALL TIME BEST·ONE 등 자기 베스트 앨범)까지 넣으면 2PM 'CRUSH'·'FLASHLIGHT'(2PM 자기 곡)이 다른 그룹 곡명과 같다는
// 이유로 커버로 오인된다 — 컴필은 뺀다. 기본형 4글자 미만·원곡 후보가 2팀 이상(모호)·이미 본인 정규 발매가 있는 곡은 제외. 크레딧(작사·작곡) 대조는 경연 곡에 크레딧이 없어 못 한다.
const COVER_ORIGIN = new Map(); // 'g|b' → {og, ob, otitle, year}   (커버한 쪽 → 원곡)
const COVERED_BY = new Map();   // 'og|ob' → [{g, b, title, program}] (원곡 쪽 → 커버한 팀들)
function computeCoverOrigins() {
  COVER_ORIGIN.clear(); COVERED_BY.clear();
  const norm = d => String(d || '').replace(/\./g, '-').slice(0, 10);
  const fileKey = s => String(s).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');
  const REG = al => !al.contest && !/컴필레이션|리믹스|OST|라이브|베스트|프로젝트/.test(al.type || '') && !/\b(live|concert|remix|best|ost)\b|라이브|콘서트/i.test(al.title || '');
  const owners = new Map(), cand = [];
  for (const g of Object.keys(groups)) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, 'disco/g', fileKey(g) + '.json'), 'utf8')); } catch (e) { continue; }
    const albums = [...Object.values(d.g || {}), ...Object.values(d.m || {}).flatMap(x => [...(x.d || []), ...(x.u || []).flatMap(u => (u && u.albums) || [])])];
    for (const al of albums) for (const t of (al.tracks || [])) {
      if (!t || !t.title) continue; const b = _CRED_SB(t.title); if (!b || b.length < 4) continue;
      if (REG(al)) { if (!owners.has(b)) owners.set(b, []); owners.get(b).push({ g, title: String(t.title).replace(/\s*[\(\[].*$/, '').trim() || t.title, date: norm(al.releaseDate) }); }
      else if (al.contest) cand.push({ g, b, title: String(t.title).replace(/\s*[\(\[].*$/, '').trim() || t.title, date: norm(al.releaseDate), program: al.program || '' });
    }
  }
  for (const c of cand) {
    const all = owners.get(c.b) || [];
    if (all.some(o => o.g === c.g) || COVER_ORIGIN.has(c.g + '|' + c.b)) continue;
    const os = all.filter(o => o.date && c.date && o.date < c.date);
    const og = [...new Set(os.map(o => o.g))]; if (og.length !== 1) continue;
    const o = os.slice().sort((x, y) => x.date.localeCompare(y.date))[0];
    COVER_ORIGIN.set(c.g + '|' + c.b, { og: og[0], ob: c.b, otitle: o.title, year: o.date.slice(0, 4) });
    const k = og[0] + '|' + c.b; if (!COVERED_BY.has(k)) COVERED_BY.set(k, []);
    COVERED_BY.get(k).push({ g: c.g, b: c.b, title: c.title, program: c.program });
  }
}
// 곡 페이지 정보 칩 — 원곡(이 곡이 커버일 때) / 커버(다른 팀이 이 곡을 경연에서 커버했을 때). 링크는 그 곡 페이지가 있으면 곡 페이지, 없으면 그룹 페이지, 그것도 없으면 글자만.
function coverChipsHtml(gko, s, lang) {
  try { return _coverChips(gko, s, lang); } catch (e) { return ''; } // 칩 계산이 던져도 페이지는 만든다
}
function _coverChips(gko, s, lang) {
  const isEn = lang === 'en', out = [];
  const gn = g => isEn ? ((groups[g] && groups[g].en) || g) : g;
  const songUrl = (g, b) => (SONGS[g] || []).some(x => x.b === b) ? `${SITE}/${songPagePath(g, b, lang)}` : (groups[g] ? `${SITE}/${groupPagePath(g, lang)}` : '');
  const link = (url, text) => url ? `<a href="${url}">${escHtml(text)}</a>` : escHtml(text);
  const co = COVER_ORIGIN.get(gko + '|' + s.b);
  if (co) out.push(`<li><b>${isEn ? 'Original' : '원곡'}</b>${link(songUrl(co.og, co.ob), `${gn(co.og)} · ${co.otitle}${co.year ? ` (${co.year})` : ''}`)}</li>`);
  const cb = COVERED_BY.get(gko + '|' + s.b);
  if (cb && cb.length) {
    const shown = cb.slice(0, 3).map(x => link(songUrl(x.g, x.b), `${gn(x.g)}${x.program ? ` (${x.program.replace(/\s*[:：].*$/, '')})` : ''}`)).join(', ');
    out.push(`<li><b>${isEn ? 'Covered by' : '커버'}</b>${shown}${cb.length > 3 ? (isEn ? ` +${cb.length - 3}` : ` 외 ${cb.length - 3}팀`) : ''}</li>`);
  }
  return out.join('');
}
function grpCard(gko, lang) {
  const info = groups[gko]; if (!info) return null; const isEn = lang === 'en';
  const gi = groupFaceUrl(gko) || ogImageForGroup(gko, info);
  return { k: isEn ? 'Group' : '그룹', t: isEn ? (info.en || gko) : gko, s: isEn ? 'Stages · MVs · members' : '무대 · 뮤비 · 멤버', im: /og-image\.png$/.test(gi) ? '' : gi.replace('/maxresdefault.', '/mqdefault.').replace('/hq720.', '/mqdefault.'), h: SITE + '/' + groupPagePath(gko, lang) };
}
function groupNextJson(gko, lang) {
  try {
    const isEn = lang === 'en', info = groups[gko]; if (!info) return '';
    const songs = (SONGS[gko] || []).slice().sort((p, q) => q.vids.length - p.vids.length);
    const songItem = s => ({ k: isEn ? 'Song fancams' : '곡별 직캠·무대', t: s.bilingualTitle || s.title, s: isEn ? `${s.vids.length} videos` : `영상 ${s.vids.length}개`, img: _topVidId(s.vids), m: s.title, h: `${SITE}/${songPagePath(gko, s.b, lang)}` });
    const mems = membersOf(gko).map(a => ({ a, hub: FANCAM_HUB.get(a) })).filter(x => x.hub && x.hub.length).sort((p, q) => q.hub.length - p.hub.length);
    const memItem = x => ({ k: isEn ? 'Member fancams' : '멤버 직캠', t: _nmOf(x.a, isEn), s: isEn ? `${x.hub.length} fancams` : `직캠 ${x.hub.length}개`, img: x.hub[0].id || '', h: `${SITE}/${memberFancamPagePath(x.a, lang)}` });
    const als = albumsFor(gko).slice().sort((p, q) => String(q.al.releaseDate || '').localeCompare(String(p.al.releaseDate || '')));
    const albItem = x => ({ k: isEn ? 'Album' : '앨범', t: x.al.title, s: isEn ? `${(x.al.tracks || []).length} tracks` : `수록곡 ${(x.al.tracks || []).length}곡`, im: x.al.cover || '', h: `${SITE}/${albumPagePath(gko, x.slug, lang)}` });
    const out = [];
    [songs[0] && songItem(songs[0]), mems[0] && memItem(mems[0]), als[0] && albItem(als[0]), songs[1] && songItem(songs[1]), mems[1] && memItem(mems[1])].forEach(x => x && out.push(x));
    return safeNext(() => out);
  } catch (e) { return ''; }
}
function albumNextJson(g, al, slug, i, list, songB, lang) {
  try {
    const isEn = lang === 'en', info = groups[g]; if (!info) return '';
    const gd = isEn ? (info.en || g) : g;
    const out = [];
    const tt = al.titleTrack || ((al.tracks || []).find(t => t.isTitle) || {}).title || '';
    const tb = tt ? _CRED_SB(tt) : '';
    if (tb && songB.has(tb)) out.push({ k: isEn ? 'Title track' : '타이틀곡', t: tt, s: isEn ? 'Fancams & stages' : '직캠·무대 모음', im: al.cover || '', m: tt, h: `${SITE}/${songPagePath(g, tb, lang)}` });
    out.push({ k: isEn ? 'Group' : '그룹', t: gd, s: isEn ? 'Stages · MVs · members' : '무대 · 뮤비 · 멤버', im: al.cover || '', h: `${SITE}/${groupPagePath(g, lang)}` });
    [list[i - 1], list[i + 1]].forEach(x => x && out.push({ k: isEn ? 'Album' : '앨범', t: x.al.title, s: isEn ? `${(x.al.tracks || []).length} tracks` : `수록곡 ${(x.al.tracks || []).length}곡`, im: x.al.cover || '', h: `${SITE}/${albumPagePath(g, x.slug, lang)}` }));
    return safeNext(() => out);
  } catch (e) { return ''; }
}
function chemNextJson(p, lang, byMember) {
  try {
    const isEn = lang === 'en', out = [];
    const hubItem = a => { const hub = FANCAM_HUB.get(a); return hub && hub.length ? { k: isEn ? 'Member fancams' : '멤버 직캠', t: _nmOf(a, isEn), s: isEn ? `${hub.length} fancams` : `직캠 ${hub.length}개`, img: hub[0].id || '', h: `${SITE}/${memberFancamPagePath(a, lang)}` } : null; };
    out.push(hubItem(p.a), hubItem(p.b));
    const G = isEn ? (groups[p.g].en || p.g) : p.g;
    out.push({ k: isEn ? 'Group' : '그룹', t: G, s: isEn ? 'Stages · MVs · members' : '무대 · 뮤비 · 멤버', img: (p.v && p.v[0] && p.v[0].id) || '', h: `${SITE}/${groupPagePath(p.g, lang)}` });
    [...new Set([...(byMember.get(p.a) || []), ...(byMember.get(p.b) || [])])].filter(o => o !== p).sort((x, y) => y.n - x.n).slice(0, 2).forEach(o => out.push({ k: isEn ? 'Another pair' : '다른 조합', t: `${_nmOf(o.a, isEn)} × ${_nmOf(o.b, isEn)}`, s: isEn ? `${o.n} videos together` : `함께 나온 영상 ${o.n}개`, img: (o.v && o.v[0] && o.v[0].id) || '', h: `${SITE}/${chemPagePath(o.g, o.a, o.b, lang)}` }));
    return safeNext(() => out.filter(Boolean));
  } catch (e) { return ''; }
}
function buildGroupPages() {
groupKos.forEach(ko => {
  const info = groups[ko];
  const en = info.en || ko;
  const slug = slugify(en, ko);
  const members = membersOf(ko);
  const koPath = `g/${urlSafeKo(ko)}/`;
  const enPath = `en/g/${slug}/`;
  const koUrl = `${SITE}/${koPath}`;
  const enUrl = `${SITE}/${enPath}`;
  const ogImage = ogImageForGroup(ko, info);
  const debutIso = isoDate(info.debut);
  const deepLinkHash = '#g=' + hashEsc(ko);

  const discogItems = (info.discography || [])
    .filter(a => a.isMain !== false)
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
    .filter((a, i, arr) => arr.findIndex(b => b.title === a.title) === i)
    .slice(0, 30);

  function memberListHtml(lang) {
    if (!members.length) return '';
    const items = members.map(a => {
      // ⚠️ 이 그룹 안에서의 정보는 **그 그룹 항목(groups[])** 에서 읽는다. 최상위 a.active/a.name만 보면
      //    그룹을 떠나 솔로로 활동 중인 사람이 전부 어긋난다(2026-09-16 발견):
      //      · 전멤버 태그: a.active===false로 판정했더니 승한(라이즈 전멤버, 솔로로 active:true)에 태그가
      //        안 붙었다. 우즈(active:false)만 우연히 맞던 것.
      //      · 표기 이름: groups[].name은 "그 그룹에서 쓴 활동명"이다(제롬/성민, 예담/디모 렉스).
      //        그걸 안 보면 트레저 페이지에 개명 후 이름이 뜬다.
      // 판정은 index.html의 _isFormerOf와 **같은 네 갈래 OR**이다(거기 주석에 근거 정리) — 어느 하나만
      // 보면 각각 다른 집단이 빠진다: ①해체(구구단 강미나) ②groups[] 항목의 left(라이즈 승한 — 최상위
      // active는 true라 ③으로 안 잡힘) ③최상위 active:false(옛 기준, 겸임 그룹 페이지까지 덮음)
      // ④주 소속+최상위 left. 실측으로 ②를 추가하면 437건이 새로 붙고 잃는 건 0건이다.
      const ge = (a.groups || []).find(g => g && g.ko === ko);
      const status = membershipStatus(a,ko);
      const former = status === 'former';
      const name = lang === 'en' ? (a.name.en || a.name.ko) : ((ge && ge.name) || a.name.ko);
      const mPath = memberPagePath(a, lang); // 해시 딥링크가 아니라 그 멤버의 정적 페이지로
      const img = memberFaceUrl(a, ko); // 프로필 사진(2026-11-18 사용자 "멤버 위로·사진 포함")
      const activeTag = former ? (lang === 'en' ? ' <span class="tag">former</span>' : ' <span class="tag">전멤버</span>') : status === 'paused' ? (lang === 'en' ? ' <span class="tag">on hiatus</span>' : ' <span class="tag">활동 중단</span>') : '';
      return `<a class="face" href="${SITE}/${mPath}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ` class="pf"` : ``} src="${img}" alt="${escHtml(name)}" loading="lazy">` : ``}</span><span class="face-nm">${escHtml(name)}${activeTag}</span></a>`;
    }).join('\n      ');
    return `
    <h2 id="members">${lang === 'en' ? 'Members' : '멤버'}</h2>
    <div class="faces">
      ${items}
    </div>`;
  }

  // 디스코그래피 = 앨범 커버 격자(2026-11-19 사용자 "디스코그라피에 앨범 커버 이미지" — 여러 번 요청). 예전엔 제목만 적힌 줄 목록 + 바로 위에
  // 같은 앨범들의 '앨범·수록곡' 칩 줄이 따로 있어 같은 정보가 두 번이었다 → 커버 한 격자로 합치고, 앨범 페이지가 있으면 커버가 그 링크.
  function discogHtml(lang) { return discogTilesHtml(ko, discogItems, lang); }

  function pageHtml(lang) {
    const isEn = lang === 'en';
    const displayName = isEn ? en : ko;
    const subName = isEn ? (ko !== en ? ko : '') : (info.en && info.en !== ko ? info.en : '');
    const agency = isEn ? agencyEn(info.co) : info.co;
    const debutLabel = isEn ? 'Debut' : '데뷔';
    const agencyLabel = isEn ? 'Agency' : '소속사';
    const fandomLabel = isEn ? 'Fandom' : '팬덤명';
    // 제목·설명은 실제 검색어에 맞춘다(2026-10-16) — '아이브(IVE) 멤버·음방 1위·직캠·투어 기록'. 설명엔 이 그룹만의 숫자(1위 N회·대상·최대 투어)
    const stageVids = groupStageVids(ko);
    const hasStage = stageVids.length >= GROUP_STAGE_MIN;
    const xg = SEO.groupExtra(ko, lang, EX, ST, { hideTop: hasStage }); // 위 직캠·무대 썸네일 그리드와 같은 영상이면 TOP 10 생략
    const bits = isEn ? ['Members', ...xg.titleBits] : ['멤버', ...xg.titleBits];
    // 현재 멤버 이름(2026-10-30 사용자 — '멤버'라는 일반어 대신 실제 이름이 검색에 걸린다). 6명 이하면 제목에, 넘으면 '멤버 N명'+설명에
    const curMembers = members.filter(a => membershipStatus(a,ko) !== 'former')
      .map(a => { const e = (a.groups || []).find(g => g && g.ko === ko) || {}; return isEn ? (e.nameEn || a.name.en || a.name.ko) : (e.name || a.displayName || a.name.ko); });
    const memTitle = curMembers.length && curMembers.length <= 6 ? curMembers.join('·') : ([curMembers.length ? (isEn ? `${curMembers.length} members` : `멤버 ${curMembers.length}명`) : '', ...bits.filter(b => !['멤버', 'Members', '직캠', 'Fancams'].includes(b))].filter(Boolean).join(isEn ? ', ' : '·') || (isEn ? 'Members' : '멤버'));
    const title = hasStage
      // '코르티스(CORTIS) 직캠·무대 모음 - 멤버·음방 1위·투어'(2026-10-30 사용자 — 예전 '… - 코르티스(CORTIS) 멤버·음방 1위 기록'은 그룹명이 두 번·'기록'이 어색)
      ? (isEn ? `${en}${ko !== en ? ` (${ko})` : ''} Fancams & Stages - ${memTitle} | K-POP UNIVERSE` : `${ko}${info.en && info.en !== ko ? `(${info.en})` : ''} 직캠·무대 모음 - ${memTitle} | K-POP UNIVERSE`)
      : isEn
      ? `${en}${ko !== en ? ` (${ko})` : ''} ${bits.join(', ')} | K-POP UNIVERSE`
      : `${ko}${info.en && info.en !== ko ? `(${info.en})` : ''} ${bits.join('·')} 기록 | K-POP UNIVERSE`;
    const factLine = xg.facts.length ? (isEn ? ' ' + xg.facts.join(', ') + '.' : ' ' + xg.facts.join(', ') + '.') : '';
    const desc = (hasStage ? (isEn ? `${stageVids.length} ${en} fancams and stages, most viewed first${curMembers.length > 6 ? ` (${curMembers.join(', ')})` : ''}. ` : `${ko} 직캠·무대 영상 ${stageVids.length}개를 조회수 순으로${curMembers.length > 6 ? `(${curMembers.join('·')})` : ''}. `) : '') + (isEn
      ? `${en}: members, debut ${info.debut || ''}, ${agencyEn(info.co) || ''}.${factLine} Fancams, stages and discography on K-POP UNIVERSE.`
      : `${ko} 멤버·데뷔일(${info.debut || '-'})·소속사(${info.co || '-'}).${factLine} 직캠·무대 영상과 디스코그래피를 K-POP UNIVERSE에서.`);
    const selfUrl = isEn ? enUrl : koUrl;
    const altUrl = isEn ? koUrl : enUrl;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: displayName,
      alternateName: subName || undefined,
      genre: 'K-pop',
      // 소개 문장은 화면에서 뺐다(2026-11-19 사용자 "서술 문단 삭제 — 중복 정보·서술형 어미 싫음, 눈으로 보여주기"). 검색·AI용으로 구조화 데이터에만 남긴다.
      description: groupIntroHtml(ko, info, members, discogItems, lang).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'") || undefined,
      foundingDate: debutIso || undefined,
      url: selfUrl,
      image: ogImage,
      // 구조화 데이터의 멤버 이름도 "그 그룹에서 쓴 활동명"(groups[].name)을 따른다 — 위 memberListHtml과 같은 이유.
      member: members.map(a => {
        const ge = (a.groups || []).find(g => g && g.ko === ko);
        return { '@type': 'Person', name: isEn ? (a.name.en || a.name.ko) : ((ge && ge.name) || a.name.ko) };
      }),
    };
    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
${LIST_FWD}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(displayName)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${sqOg(ogImage)}">
<meta property="og:image:width" content="${ogSizeFor(sqOg(ogImage)).w}">
<meta property="og:image:height" content="${ogSizeFor(sqOg(ogImage)).h}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(displayName)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#0a0a0d;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;white-space:nowrap;}
  h1{font-size:28px;margin:14px 0 2px;color:#fff;}
  .sub{font-size:15px;color:rgba(180,200,255,0.6);margin-bottom:18px;}
  .meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:rgba(190,210,255,0.75);margin-bottom:24px;}
  .meta b{color:rgba(220,230,255,0.95);font-weight:600;}
  .cover{width:100%;max-width:400px;border-radius:12px;display:block;margin-bottom:20px;background:rgba(255,255,255,0.05);}
  h2{font-size:16px;margin:28px 0 10px;color:rgba(200,220,255,0.9);}
  .member-list,.discog-list{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;}
  .member-list li,.discog-list li{background:rgba(150,175,255,0.08);border:0.5px solid rgba(150,175,255,0.18);border-radius:10px;padding:6px 12px;font-size:13.5px;}
  .discog-list{display:block;}
  .discog-list li{display:block;margin-bottom:6px;background:none;border:none;padding:0 0 6px;border-bottom:0.5px solid rgba(255,255,255,0.06);border-radius:0;}
  .member-list a{color:rgba(210,225,255,0.95);text-decoration:none;}
  .more-songs{margin-top:10px;}.more-songs summary{cursor:pointer;color:rgba(160,190,255,0.9);font-size:13.5px;padding:8px 0;min-height:40px;display:flex;align-items:center;}.more-songs[open] summary{margin-bottom:6px;}
  .tag{font-size:10px;color:rgba(150,175,255,0.6);}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:30px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#0a0a0d 62%,rgba(10,10,13,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  a{text-decoration:none;transition:color .15s,text-shadow .15s;}a:not(.cta):not(.brand):hover{color:#fff;text-shadow:0 0 10px rgba(150,175,255,0.55);}
  .intro{font-size:14px;line-height:1.75;color:rgba(200,215,255,0.78);margin:0 0 22px;}
  .hub-more{margin:14px 0 0;}.hub-top{margin-bottom:14px;}
  .hub-more a{display:inline-flex;align-items:center;padding:4px 12px;border-radius:10px;background:rgba(150,175,255,0.07);border:0.5px solid rgba(150,175,255,0.2);color:rgba(190,210,255,0.75);text-decoration:none;font-size:12.5px;}
  ${SEO.EXTRA_CSS}
</style>
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/all/' : 'all/'}" style="margin-left:10px;">${isEn ? 'Browse all' : '모아보기'}</a>
  <div class="top2">
    <h1>${escHtml(spacedLabel(displayName,subName))}</h1>
    ${(() => { const pic = groupFaceUrl(ko); return pic ? `<img class="cover avatar" src="${pic}" alt="${escHtml(displayName)}" loading="eager" width="240" height="240">` : `<img class="cover" src="${ogImage}" alt="${escHtml(displayName)}" loading="lazy">`; })()}
    <div class="meta">
      ${debutIso ? `<span><b>${debutLabel}</b> ${escHtml(info.debut)}</span>` : ''}
      ${agency ? `<span><b>${agencyLabel}</b> ${escHtml(agency)}</span>` : ''}
      ${info.fandom && info.fandom.ko ? `<span><b>${fandomLabel}</b> ${escHtml(isEn ? (info.fandom.en || info.fandom.ko) : info.fandom.ko)}</span>` : ''}
    </div>
    ${snsRowHtml(info.links, isEn)}
    ${factsTag(pageFacts({ vids: VIDS[ko], wins: EX.wins[ko], isEn }))}
  </div>
  ${(() => { const e2 = lang === 'en'; const parts = [[songLinksHtml(ko, lang), 'songs', e2 ? 'Songs' : '곡별 직캠'], [discogHtml(lang), 'albums', e2 ? 'Albums' : '앨범']].filter(x => x[0]); return parts.length ? `<ul class="member-list jump" style="margin:4px 0 16px">${parts.map(x => `<li><a href="#${x[1]}">${x[2]}</a></li>`).join('')}</ul>` : ''; })()}
  ${memberListHtml(lang)}
  ${hasStage ? `
  <h2>${isEn ? `${escHtml(en)} fancams & stages` : `${escHtml(ko)} 직캠·무대`}</h2>
  <div class="mf-grid">${vidCardsHtml(stageVids.slice(0, 24), isEn)}</div>${stageVids.length > 24 ? `<p class="note">${isEn ? `Top 24 of ${stageVids.length} videos` : `영상 ${stageVids.length}개 중 상위 24개`}</p>` : ''}` : ''}
  ${xg.html}
  ${songLinksHtml(ko, lang)}
  ${discogHtml(lang)}
  ${(() => { const rel = relatedGroups(ko); return rel.length ? `
    <h2>${isEn ? 'Related groups' : '함께 보면 좋은 그룹'}</h2>
    <div class="faces rel-faces">
      ${rel.map(k => { const pic = groupFaceUrl(k), img = pic || ogImageForGroup(k, groups[k]); return `<a class="face" href="${SITE}/${groupPagePath(k, lang)}"><span class="face-img">${img ? `<img${pic ? ' class="pf"' : ''} src="${img}" alt="" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(isEn ? (groups[k].en || k) : k)}</span></a>`; }).join('\n      ')}
    </div>` : ''; })()}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/${deepLinkHash}">${isEn ? 'View videos in the Universe →' : '직캠·영상 아카이브 보기 →'}</a></div>
  ${groupNextJson(ko, lang)}
</div>
</body>
</html>
`;
  }

  const koDir = path.join(ROOT, koPath);
  const enDir = path.join(ROOT, enPath);
  fs.mkdirSync(koDir, { recursive: true });
  fs.mkdirSync(enDir, { recursive: true });
  fs.writeFileSync(path.join(koDir, 'index.html'), pageHtml('ko'));
  fs.writeFileSync(path.join(enDir, 'index.html'), pageHtml('en'));

  pages.push({ loc: koUrl, priority: '0.7' }, { loc: enUrl, priority: '0.7' });
});
}

// ── 멤버별 정적 SEO 페이지 (2026-08-21, 사용자 요청 — Fable 자문 세션에서 확인: 그룹 249개보다 멤버
// 1,649명 개별 진입점이 롱테일 검색("OO 직캠", "OO 몇 년 데뷔")에서 훨씬 유리하고, 검색 결과 미리보기
// 단계에서부터 "이 사람에 대한 정보가 펼쳐져 있다"는 걸 보여줘야 클릭 이후 실제로 탐험까지 이어진다는
// 방향 확인). 실제 그룹 소속 멤버는 그 그룹 페이지 밑에 중첩(g/{그룹}/{멤버}/) — 동명이인이 서로 다른
// 그룹에 있을 수 있어(드림캐쳐 지유/키키 지유 실제 오배정 사고 있었음) 반드시 그룹으로 구분해야 함.
// GROUPS에 없는 솔로 아티스트(보아·이영지 등, group.ko="솔로"는 서로 무관한 사람들이 공유하는
// placeholder)는 member/{이름}/ 최상위에 둔다.
let memberPageCount = 0;
// 같은 해 태어난 현역 아이돌(멤버 페이지 내부 링크용) — 연도별 목록을 한 번만 만든다
const byBirthYear = {};
const bornAllCount = {}; // 생년 페이지가 있는 해(전체 5명 이상)인지 — 멤버 페이지 '2009년생 아이돌' 제목을 그 페이지 링크로(2026-10-30)
artists.forEach(x => { const y = String(x.bday || '').slice(0, 4); bornAllCount[y] = (bornAllCount[y] || 0) + 1; });
artists.forEach(x => { const y = String(x.bday || '').slice(0, 4); if (/^\d{4}$/.test(y) && x.active !== false) (byBirthYear[y] = byBirthYear[y] || []).push(x); });
function buildMemberPages() {
artists.forEach(a => {
  const ko = a.name.ko;
  const en = a.name.en || ko;
  const primaryGko = a.group.ko;
  const isSolo = !groups[primaryGko];
  const groupInfo = isSolo ? null : groups[primaryGko];
  // 겸임(이중소속)이면 groups 배열 전부 — GROUPS에 실존하는 그룹만(placeholder '솔로' 등 제외)
  const affiliations = (a.groups && a.groups.length ? a.groups : [a.group]).filter(g => groups[g.ko]);
  const slug = slugify(en, ko);

  const koPath = memberPagePath(a, 'ko'); // 동명이인 솔로 꼬리 포함(같은 함수로 — 링크·정리 코드와 주소가 갈리지 않게)
  const enGroupSlug = isSolo ? null : slugify(groupInfo.en || primaryGko, primaryGko);
  const enPath = memberPagePath(a, 'en');
  const koUrl = `${SITE}/${koPath}`;
  const enUrl = `${SITE}/${enPath}`;
  const ogImage = ogImageForMember(a);
  const bdayIso = isoDate(a.bday);
  const deepLinkHash = isSolo ? '#m=' + hashEsc(ko) : '#g=' + hashEsc(primaryGko) + '&m=' + hashEsc(ko);
  const memberIdParam = isSolo && a.id && artists.some(x => x !== a && x.name.ko === ko && !groups[x.group.ko]) ? '&mid=' + hashEsc(a.id) : '';

  const discogItems = (a.discography || [])
    .filter(al => al.isMain !== false)
    .sort((x, y) => (y.releaseDate || '').localeCompare(x.releaseDate || ''))
    .filter((al, i, arr) => arr.findIndex(b => b.title === al.title) === i)
    .slice(0, 30);

  function affiliationHtml(lang) {
    if (!affiliations.length) return '';
    const items = affiliations.map(g => {
      const gname = lang === 'en' ? (groups[g.ko].en || g.ko) : g.ko;
      const gPath = groupPagePath(g.ko, lang); // 해시 딥링크가 아니라 그 그룹의 정적 페이지로
      return `<li><a href="${SITE}/${gPath}">${escHtml(gname)}</a></li>`;
    }).join('\n      ');
    return `
    <h2>${lang === 'en' ? 'Groups' : '소속 그룹'}</h2>
    <ul class="member-list">
      ${items}
    </ul>`;
  }

  function songsHtml(lang) {
    if (!a.songs || !a.songs.length) return '';
    // 썸네일 카드로(2026-11-10 사용자 — 제목 줄만 있던 게 이상). 유튜브 주소 없는 항목은 카드가 안 되니 뺀다.
    const ytIdOf = u => { const m = /(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/.exec(u || ''); return m ? m[1] : null; };
    const cards = a.songs.map(s => ({ id: ytIdOf(s.u), title: s.t, sub: s.with && s.with.length ? `feat. ${s.with.join(', ')}` : '' })).filter(v => v.id).slice(0, 20);
    if (!cards.length) return '';
    return `
    <h2>${lang === 'en' ? 'Featured Videos' : '대표 영상'}</h2>
    <div class="mf-grid">${SEO.vidCards(cards, lang === 'en')}</div>`;
  }

  function memberDiscogHtml(lang) {
    if (!discogItems.length) return '';
    const items = discogItems.map(al => {
      const yr = (al.releaseDate || '').slice(0, 4);
      const typeLabel = lang === 'en' ? typeEn(al.type) : al.type;
      return `<li>${escHtml(al.title)}${yr ? ` <span class="yr">(${yr})</span>` : ''}${typeLabel ? ` <span class="tag">${escHtml(typeLabel)}</span>` : ''}</li>`;
    }).join('\n      ');
    return `
    <h2>${lang === 'en' ? 'Solo Discography' : '개인 디스코그래피'}</h2>
    <ul class="discog-list">
      ${items}
    </ul>`;
  }

  function linksHtml(lang) {
    const ig = a.links && a.links.instagram;
    const namu = a.links && a.links.namu;
    if (!ig && !namu) return '';
    const items = [];
    if (ig) items.push(`<li><a href="${escHtml(ig)}" target="_blank" rel="noopener noreferrer">Instagram</a></li>`);
    if (namu) items.push(`<li><a href="${escHtml(namu)}" target="_blank" rel="noopener noreferrer">${lang === 'en' ? 'Namuwiki' : '나무위키'}</a></li>`);
    return `
    <h2>${lang === 'en' ? 'Links' : '링크'}</h2>
    <ul class="member-list">
      ${items.join('\n      ')}
    </ul>`;
  }

  function memberPageHtml(lang) {
    const isEn = lang === 'en';
    const displayName = isEn ? en : ko;
    const subName = isEn ? (ko !== en ? ko : '') : (a.name.en && a.name.en !== ko ? a.name.en : '');
    const groupDisplay = isSolo ? '' : (isEn ? (groupInfo.en || primaryGko) : primaryGko);
    const agency = isEn ? agencyEn(a.co) : a.co;
    const primaryEntry = affiliationFor(a,a.group.ko) || {};
    const onHiatus = primaryEntry.pausedFrom && !primaryEntry.left;
    const statusLabel = onHiatus ? (isEn ? 'On hiatus' : '활동 중단') : a.active === false
      ? (isEn ? (a.left ? `Inactive (left ${a.left})` : 'Inactive') : (a.left ? `활동종료(${a.left} 탈퇴)` : '활동종료'))
      : (isEn ? 'Active' : '활동중');
    const debutLabel = isEn ? 'Birthday' : '생일';
    const groupLabel = isEn ? 'Group' : '소속';
    const agencyLabel = isEn ? 'Agency' : '소속사';
    const statusLbl = isEn ? 'Status' : '상태';
    // 제목·설명(2026-10-16) — '장원영(아이브) 프로필·나이·직캠'. 설명엔 생년·데뷔 나이·작사작곡·솔로 1위 같은 이 사람만의 숫자
    const fancams = isSolo ? memberFancamsAll(a) : memberFancams(a, primaryGko); // 솔로도 전 그룹+본인 키 직캠(2026-11-15)
    const hasFancams = fancams.length >= MEMBER_FANCAM_MIN;
    // 직캠 전체 페이지(fancams/)가 있으면 '직캠 모음'은 그 페이지 제목이 맡는다 — 프로필과 같은 검색어로 경쟁하지 않게(2026-11-11)
    const hubUrl = FANCAM_HUB.has(a) ? `${SITE}/${memberFancamPagePath(a, lang)}` : '';
    const _crHref = creditsFor(a) && creditPagePath(a, lang) ? `${SITE}/${creditPagePath(a, lang)}` : '';
    // 인기 영상도 솔로 키 + (솔로 아티스트면) 전 그룹 개인 영상까지 — 앱 멤버 카드(own=[그룹키,솔로키])와 같은 범위(2026-11-15)
    const _sk = soloKoOf(a);
    const _extraTop = [];
    if (_sk && _sk !== primaryGko) _extraTop.push(...(EX.top[_sk] || []));
    if (isSolo) for (const g of (a.groups || []).map(x => x && x.ko).filter(k => k && groups[k])) for (const v of EX.top[g] || []) { if (Array.isArray(v.members) && v.members.includes(a.name.ko)) _extraTop.push(v); }
    const xm = SEO.memberExtra(a, isSolo ? ko : primaryGko, lang, EX, ST, creditsFor(a), { hideTop: hasFancams, creditHref: _crHref, extraTop: _extraTop });
    const ag = SEO.ages(a, (a.groups && a.groups.length ? a.groups : [a.group]).map(g => groups[g.ko] ? ({...groups[g.ko],joined:affiliationFor(a,g.ko)?.joined}) : null));
    const identityKo=[isSolo?'':primaryGko,ko].filter(Boolean).join(' '),identityEn=[isSolo?'':(groupInfo.en||primaryGko),en].filter(Boolean).join(' ');
    const who = isEn ? bilingualLabel(identityEn,identityKo) : bilingualLabel(identityKo,identityEn);
    // 개인 직캠이 MEMBER_FANCAM_MIN개 이상이면 제목 맨 앞을 '성현 직캠 모음'으로(2026-10-30) — 동명이인이 많아 그룹 이름도 같이
    const title = hasFancams && !hubUrl
      ? `${who} ${isEn ? 'Fancams & Profile' : '직캠 모음·프로필'} | K-POP UNIVERSE`
      : hubUrl ? (isEn ? `${who} Profile, Age, Fancams, Birthday | K-POP UNIVERSE` : `${who} 프로필·나이·직캠·생일 | K-POP UNIVERSE`)
      : isEn
      ? `${who} Profile, Age, ${xm.titleBits.length ? 'Fancams, ' : ''}Birthday | K-POP UNIVERSE`
      : `${who} 프로필·나이·${xm.titleBits.length ? '직캠·' : ''}생일 | K-POP UNIVERSE`;
    const ageBits = isEn
      ? [bdayIso ? `born ${a.bday}` : '', ag.debutDate ? `debuted ${ag.debutDate}` : '', ...xm.facts].filter(Boolean).join(', ')
      : [bdayIso ? `${a.bday} 생` : '', ag.debutDate ? `${ag.debutDate} 데뷔` : '', ...xm.facts].filter(Boolean).join(', ');
    const desc = (hasFancams ? (isEn ? `${fancams.length} ${en}${isSolo ? '' : ` (${groupInfo.en || primaryGko})`} fancams, most viewed first. ` : `${isSolo ? '' : primaryGko + ' '}${ko} 직캠 ${fancams.length}개를 조회수 순으로. `) : '') + (isEn
      ? `${en}${groupDisplay ? ` of ${groupDisplay}` : ''}: ${ageBits || 'profile'}. Fancams, stages and connections on K-POP UNIVERSE.`
      : `${ko}${groupDisplay ? `(${groupDisplay})` : ''}: ${ageBits || '프로필'}. 직캠·무대 영상과 함께한 아이돌을 K-POP UNIVERSE에서.`);
    const selfUrl = isEn ? enUrl : koUrl;
    const altUrl = isEn ? koUrl : enUrl;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: displayName,
      alternateName: subName || undefined,
      birthDate: bdayIso || undefined,
      nationality: a.nat ? (isEn ? a.nat.en : a.nat.ko) : undefined,
      url: selfUrl,
      image: ogImage,
      memberOf: affiliations.length ? affiliations.map(g => ({ '@type': 'MusicGroup', name: isEn ? (groups[g.ko].en || g.ko) : g.ko })) : undefined,
      sameAs: [a.links && a.links.instagram, a.links && a.links.namu].filter(Boolean),
    };
    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
${LIST_FWD}
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(displayName)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${sqOg(ogImage)}">
<meta property="og:image:width" content="${ogSizeFor(sqOg(ogImage)).w}">
<meta property="og:image:height" content="${ogSizeFor(sqOg(ogImage)).h}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(displayName)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#0a0a0d;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;white-space:nowrap;}
  h1{font-size:28px;margin:14px 0 2px;color:#fff;}
  .sub{font-size:15px;color:rgba(180,200,255,0.6);margin-bottom:18px;}
  .meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:rgba(190,210,255,0.75);margin-bottom:24px;}
  .meta b{color:rgba(220,230,255,0.95);font-weight:600;}
  .cover{width:100%;max-width:400px;border-radius:12px;display:block;margin-bottom:20px;background:rgba(255,255,255,0.05);}
  h2{font-size:16px;margin:28px 0 10px;color:rgba(200,220,255,0.9);}
  .member-list,.discog-list{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;}
  .member-list li,.discog-list li{background:rgba(150,175,255,0.08);border:0.5px solid rgba(150,175,255,0.18);border-radius:10px;padding:6px 12px;font-size:13.5px;}
  .discog-list{display:block;}
  .discog-list li{display:block;margin-bottom:6px;background:none;border:none;padding:0 0 6px;border-bottom:0.5px solid rgba(255,255,255,0.06);border-radius:0;}
  .member-list a{color:rgba(210,225,255,0.95);text-decoration:none;}
  .more-songs{margin-top:10px;}.more-songs summary{cursor:pointer;color:rgba(160,190,255,0.9);font-size:13.5px;padding:8px 0;min-height:40px;display:flex;align-items:center;}.more-songs[open] summary{margin-bottom:6px;}
  .tag{font-size:10px;color:rgba(150,175,255,0.6);}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:30px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#0a0a0d 62%,rgba(10,10,13,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  a{text-decoration:none;transition:color .15s,text-shadow .15s;}a:not(.cta):not(.brand):hover{color:#fff;text-shadow:0 0 10px rgba(150,175,255,0.55);}
  .intro{font-size:14px;line-height:1.75;color:rgba(200,215,255,0.78);margin:0 0 22px;}
  .hub-more{margin:14px 0 0;}.hub-top{margin-bottom:14px;}
  .hub-more a{display:inline-flex;align-items:center;padding:4px 12px;border-radius:10px;background:rgba(150,175,255,0.07);border:0.5px solid rgba(150,175,255,0.2);color:rgba(190,210,255,0.75);text-decoration:none;font-size:12.5px;}
  ${SEO.EXTRA_CSS}
</style>
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/all/' : 'all/'}" style="margin-left:10px;">${isEn ? 'Browse all' : '모아보기'}</a>
  <div class="top2">
    <h1>${escHtml(spacedLabel(displayName,subName))}</h1>
    ${(() => { const pic = memberPicUrl(a), ig = memberPicInstagram(a); const img = pic ? `<img class="cover avatar" src="${pic}" alt="${escHtml(displayName)}" loading="eager" width="240" height="240">` : ''; return pic ? (ig ? `<a class="avatar-link" href="${escHtml(ig)}" target="_blank" rel="noopener noreferrer" title="Instagram">${img}</a>` : img) : `<img class="cover" src="${ogImage}" alt="${escHtml(displayName)}" loading="lazy">`; })()}
    <div class="meta">
      ${groupDisplay ? `<span><b>${groupLabel}</b> ${escHtml(spacedLabel(groupDisplay,isEn?primaryGko:groupInfo.en))}</span>` : ''}
      ${bdayIso ? `<span><b>${debutLabel}</b> ${escHtml(a.bday)}</span>` : ''}
      ${ag.debutDate ? `<span><b>${isEn ? 'Debut' : '데뷔'}</b> ${ag.debutDate}</span>` : ''}
      ${agency ? `<span><b>${agencyLabel}</b> ${escHtml(agency)}</span>` : ''}
    </div>
    ${snsRowHtml(a.links, isEn)}
    ${factsTag(pageFacts({ vids: (VIDS[primaryGko] || []).filter(v => (v.members || []).includes(a.name.ko)).concat(VIDS[soloKoOf(a)] || []), wins: (EX.wins[primaryGko] || []).filter(w => w.member_ko === a.name.ko), fancams, isEn }))}
  </div>
  ${hasFancams ? `
  <h2>${isEn ? `${escHtml(en)} fancams` : `${escHtml(ko)} 직캠`}</h2>
  ${hubUrl ? `<p class="hub-more hub-top"><a href="${hubUrl}">${isEn ? `All ${fancams.length} fancams by song →` : `직캠 전체 ${fancams.length}개 곡별로 보기 →`}</a></p>` : ''}
  <div class="mf-grid">
    ${fancams.slice(0, 24).map(v => `<a class="mf-card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="mf-th"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"></span><span class="mf-t">${escHtml(v.title)}</span><span class="mf-y">${[v.published_at ? String(v.published_at).slice(0, 10).replace(/-/g, '.') : '', v.view_count ? SEO.fmtVC(v.view_count) : ''].filter(Boolean).join(' · ')}</span></a>`).join('\n    ')}
  </div>${hubUrl ? '' : fancams.length > 24 ? `<p class="note">${isEn ? `Top 24 of ${fancams.length} fancams` : `직캠 ${fancams.length}개 중 상위 24개`}</p>` : ''}` : ''}
  ${memberIntroHtml(a, affiliations, lang)}
  ${xm.hasCredits ? '' : creditLinkHtml(a, lang)}
  ${affiliationHtml(lang)}
  ${xm.html}
  ${songsHtml(lang)}
  ${memberSongLinksHtml(a, lang)}
  ${memberDiscogHtml(lang)}
  ${(() => { const y = String(a.bday || '').slice(0, 4); const peers = (byBirthYear[y] || []).filter(x => x !== a && x.name.ko !== ko).sort((p, q) => (+(groups[q.group.ko]?.pri || 0)) - (+(groups[p.group.ko]?.pri || 0))).slice(0, 10); return peers.length ? `
    <h2>${(bornAllCount[y] || 0) >= 5 ? `<a href="${SITE}/${yearPagePath('born', y, lang)}">${isEn ? `Other idols born in ${y}` : `${y}년생 아이돌`} ›</a>` : (isEn ? `Other idols born in ${y}` : `${y}년생 아이돌`)}</h2>
    <div class="faces rel-faces">
      ${peers.map(p => { const img = memberFaceUrl(p, p.group.ko); return `<a class="face" href="${SITE}/${memberPagePath(p, lang)}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ' class="pf"' : ''} src="${img}" alt="" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(isEn ? (p.name.en || p.name.ko) : p.name.ko)}</span>${groups[p.group.ko] ? `<span class="face-n">${escHtml(isEn ? (groups[p.group.ko].en || p.group.ko) : p.group.ko)}</span>` : ''}</a>`; }).join('\n      ')}
    </div>` : ''; })()}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  ${nextItemsJson(a, lang)}
  <div class="cta-dock"><a class="cta" href="${SITE}/${deepLinkHash}${memberIdParam}">${isEn ? 'View profile, fancams & stages →' : '프로필·직캠·무대 영상 보기 →'}</a></div>
</div>
</body>
</html>
`;
  }

  const koDir = path.join(ROOT, koPath);
  const enDir = path.join(ROOT, enPath);
  fs.mkdirSync(koDir, { recursive: true });
  fs.mkdirSync(enDir, { recursive: true });
  fs.writeFileSync(path.join(koDir, 'index.html'), memberPageHtml('ko'));
  fs.writeFileSync(path.join(enDir, 'index.html'), memberPageHtml('en'));

  pages.push({ loc: koUrl, priority: '0.6' }, { loc: enUrl, priority: '0.6' });
  memberPagesMade.add(koPath); memberPagesMade.add(enPath);
  memberPageCount++;
});
}

// ── 옛 멤버 페이지 정리(2026-10-19) ──────────────────────────────────────────────────────────
// 멤버가 그룹 소속 → 솔로 키로 옮겨지면(스텔라 가영 → member/가영) 새 주소에 페이지를 쓰지만 **옛 g/<그룹>/<멤버>/는 그대로
// 남았다** — 사이트맵엔 없지만 옛 링크로 공유하면 기본 이미지·옛 내용이 떴다(실측 44곳). 관계 페이지 정리와 같은 방식으로,
// 이번에 안 만든 멤버 폴더는 **그 사람의 지금 주소로 넘겨주는 안내 페이지**로 바꾼다(같은 썸네일·canonical·즉시 이동).
// 그룹 index.html·곡 폴더(s/)는 건드리지 않는다.
const memberPagesMade = new Set();
// 동명이인 솔로가 같이 쓰던 옛 주소(member/레나/)는 "누구의 페이지인지 고르는" 안내 페이지로(2026-10-19) — 옛 링크가 길을 잃지 않게
function writeSoloDisambigPages() {
  const by = new Map(); // 옛 경로 → [{a, now}]
  for (const a of artists) {
    if (!a || !a.name || !a.group || groups[a.group.ko]) continue;
    const s = soloSuffix(a);
    if (s.ko) { const k = `member/${urlSafeKo(a.name.ko)}/`; (by.get(k) || by.set(k, []).get(k)).push({ a, now: memberPagePath(a, 'ko'), lang: 'ko' }); }
    if (s.en) { const k = `en/member/${slugify(a.name.en || a.name.ko, a.name.ko)}/`; (by.get(k) || by.set(k, []).get(k)).push({ a, now: memberPagePath(a, 'en'), lang: 'en' }); }
  }
  let n = 0;
  for (const [rel, list] of by) {
    if (memberPagesMade.has(rel)) continue; // 꼬리 없는 진짜 페이지가 있는 주소는 건드리지 않는다
    const en = list[0].lang === 'en';
    const name = en ? (list[0].a.name.en || list[0].a.name.ko) : list[0].a.name.ko;
    const items = list.map(({ a, now }) => {
      const g = (a.groups || []).map(y => y && y.ko).find(k => k && groups[k]);
      const gl = g ? (en ? (groups[g].en || g) : g) : '';
      return `<li><a href="${SITE}/${now}">${escHtml(en ? (a.name.en || a.name.ko) : a.name.ko)}${gl ? ' — ' + escHtml(gl) : ''}</a></li>`;
    }).join('\n');
    const dir = path.join(ROOT, rel);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="${en ? 'en' : 'ko'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(name)} — K-POP UNIVERSE</title>
<meta name="robots" content="noindex,follow">
<meta property="og:title" content="${escHtml(name)} — K-POP UNIVERSE">
<meta property="og:image" content="${sqOg(ogImageForMember(list[0].a))}">
<style>body{font-family:system-ui,sans-serif;background:#101013;color:#dfe7ff;padding:40px 20px;max-width:560px;margin:auto}a{color:#9fb8ff;text-decoration:none}a:hover{color:#fff;text-shadow:0 0 10px rgba(150,175,255,.55)}li{margin:10px 0}</style>
</head><body><h1>${escHtml(name)}</h1><p>${en ? 'Several artists share this name:' : '같은 이름의 아티스트가 여러 명이에요:'}</p><ul>
${items}
</ul></body></html>
`);
    n++;
  }
  if (n) console.log(`동명이인 솔로 안내 페이지 ${n}개`);
}
function redirectStaleMemberPages() {
  const target = new Map(); // 옛 경로 → {a, lang}
  for (const a of artists) {
    if (!a || !a.name || !a.group) continue;
    const slug = slugify(a.name.en || a.name.ko, a.name.ko);
    for (const g of [a.group, ...(a.groups || [])]) {
      if (!g || !g.ko || !groups[g.ko]) continue;
      target.set(`g/${urlSafeKo(g.ko)}/${urlSafeKo(a.name.ko)}/`, { a, lang: 'ko' });
      target.set(`en/g/${slugify(groups[g.ko].en || g.ko, g.ko)}/${slug}/`, { a, lang: 'en' });
      // 옛 영문 이름(prevEn, 2026-11-04 — 공식 표기로 고친 Roon→Lune·Eaji→E.JI·Yul→Ryul): 옛 슬러그 주소도 지금 페이지로 넘긴다.
      // 예전엔 지금 이름의 경로만 알아서, 이름을 고치면 옛 페이지가 낡은 내용 그대로 남았다(중복·옛 표기 노출).
      for (const pe of (a.prevEn || [])) {
        const ps = slugify(pe, a.name.ko);
        if (ps && ps !== slug) target.set(`en/g/${slugify(groups[g.ko].en || g.ko, g.ko)}/${ps}/`, { a, lang: 'en', prev: true });
      }
    }
  }
  // 동명이인 솔로 둘이 같은 member/<이름>/을 나눠 쓰는 경우(프리스틴·공원소녀 레나, 포미닛·나인뮤지스 현아 — 빌더의 별도 문제)는
  // 넘기면 남의 페이지로 갈 수 있어 그대로 둔다. 지금 주소를 못 찾는 옛 페이지(개명 등)도 지우지 않고 둔다(옛 링크가 404가 되지 않게).
  const pathUsers = new Map();
  for (const a of artists) if (a && a.name && a.group) for (const l of ['ko', 'en']) { const q = memberPagePath(a, l); pathUsers.set(q, (pathUsers.get(q) || 0) + 1); }
  let redir = 0, removed = 0, kept = 0;
  for (const base of ['g', 'en/g']) {
    const root = path.join(ROOT, base);
    if (!fs.existsSync(root)) continue;
    for (const gd of fs.readdirSync(root, { withFileTypes: true })) {
      if (!gd.isDirectory()) continue;
      for (const md of fs.readdirSync(path.join(root, gd.name), { withFileTypes: true })) {
        if (!md.isDirectory() || md.name === 's') continue;
        const rel = `${base}/${gd.name}/${md.name}/`;
        if (memberPagesMade.has(rel)) continue;
        const dir = path.join(root, gd.name, md.name);
        if (!fs.existsSync(path.join(dir, 'index.html'))) continue;
        const t = target.get(rel);
        const now = t && memberPagePath(t.a, t.lang);
        if (!now || now === rel || !memberPagesMade.has(now) || pathUsers.get(now) > 1) { kept++; continue; }
        const url = `${SITE}/${now}`, img = ogImageForMember(t.a), sz = ogSizeFor(img);
        const nm = t.lang === 'en' ? (t.a.name.en || t.a.name.ko) : t.a.name.ko;
        fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html>
<html lang="${t.lang}"><head><meta charset="utf-8">
<title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${url}">
<meta name="robots" content="noindex">
<meta property="og:title" content="${escHtml(nm)} — K-POP UNIVERSE">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${sqOg(img)}">
<meta property="og:image:width" content="${sz.w}">
<meta property="og:image:height" content="${sz.h}">
<meta http-equiv="refresh" content="0; url=${url}">
</head><body><a href="${url}">${escHtml(nm)}</a></body></html>
`);
        redir++;
        // 옛 영문 이름 주소 아래 멤버×곡 페이지(…/roon/s/곡/)도 같은 곡의 새 주소로(없으면 멤버 페이지로) 넘긴다
        if (t.prev) {
          const sDir = path.join(dir, 's');
          if (fs.existsSync(sDir)) for (const sd of fs.readdirSync(sDir, { withFileTypes: true })) {
            if (!sd.isDirectory() || !fs.existsSync(path.join(sDir, sd.name, 'index.html'))) continue;
            const nowSong = `${now}s/${sd.name}/`;
            const su = fs.existsSync(path.join(ROOT, nowSong, 'index.html')) ? `${SITE}/${nowSong}` : url;
            fs.writeFileSync(path.join(sDir, sd.name, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${su}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${su}">
</head><body><a href="${su}">${escHtml(nm)}</a></body></html>
`);
            redir++;
          }
        }
      }
    }
  }
  // 이름이 바뀌어 자동 매칭이 못 찾는 옛 주소(2026-11-13 Codex — 옛 '결경'·'Swan' 주소의 언어 전환이 다른 멤버(카일라·박지은)로 갔다).
  // tools/data/stale_member_aliases.json에 적은 것만, 그 사람의 지금 주소로 넘긴다. songs:true면 그 아래 곡 페이지도 같은 사람 곡으로.
  const redirectPage = (url, nm, lang) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${url}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
</head><body><a href="${url}">${escHtml(nm)}</a></body></html>
`;
  let aliasList = [];
  try { aliasList = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/stale_member_aliases.json'), 'utf8')).list || []; } catch (e) {}
  for (const o of aliasList) {
    const a = artists.find(x => x && x.id === o.id); if (!a) continue;
    const now = memberPagePath(a, o.lang), dir = path.join(ROOT, o.rel);
    if (!now || now === o.rel || !memberPagesMade.has(now) || !fs.existsSync(path.join(dir, 'index.html'))) continue;
    const nm = o.lang === 'en' ? (a.name.en || a.name.ko) : a.name.ko;
    fs.writeFileSync(path.join(dir, 'index.html'), redirectPage(`${SITE}/${now}`, nm, o.lang)); redir++;
    const sDir = path.join(dir, 's');
    if (o.songs && fs.existsSync(sDir)) for (const sd of fs.readdirSync(sDir, { withFileTypes: true })) {
      if (!sd.isDirectory() || !fs.existsSync(path.join(sDir, sd.name, 'index.html'))) continue;
      const nowSong = `${now}s/${sd.name}/`;
      fs.writeFileSync(path.join(sDir, sd.name, 'index.html'), redirectPage(fs.existsSync(path.join(ROOT, nowSong, 'index.html')) ? `${SITE}/${nowSong}` : `${SITE}/${now}`, nm, o.lang)); redir++;
    }
  }
  // 그룹 영문명이 바뀐 경우(groups.json prevEn — 다이몬 DAIMON → DXMON): 옛 en/g/<옛 슬러그>/ 아래 전부를 지금 주소의 같은 자리로
  for (const g of Object.keys(groups)) {
    const cur = groupPagePath(g, 'en'); if (!cur) continue;
    for (const pe of (groups[g].prevEn || [])) {
      const oldRel = `en/g/${slugify(pe, g)}/`, oldDir = path.join(ROOT, oldRel);
      if (oldRel === cur || !fs.existsSync(oldDir)) continue;
      const nm = groups[g].en || g;
      const walk = (dirAbs, relTail) => {
        for (const e of fs.readdirSync(dirAbs, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          const sub = path.join(dirAbs, e.name), tail = relTail + e.name + '/';
          if (fs.existsSync(path.join(sub, 'index.html'))) {
            const to = fs.existsSync(path.join(ROOT, cur + tail, 'index.html')) ? `${SITE}/${cur}${tail}` : `${SITE}/${cur}`;
            fs.writeFileSync(path.join(sub, 'index.html'), redirectPage(to, nm, 'en')); redir++;
          }
          walk(sub, tail);
        }
      };
      if (fs.existsSync(path.join(oldDir, 'index.html'))) { fs.writeFileSync(path.join(oldDir, 'index.html'), redirectPage(`${SITE}/${cur}`, nm, 'en')); redir++; }
      walk(oldDir, '');
    }
  }
  if (redir || kept) console.log(`옛 멤버 페이지 정리: 새 주소로 넘김 ${redir}개 · 그대로 둠(주소 못 찾음·동명이인) ${kept}개`);
}

// ── 그룹 색인 허브(2026-08-31) ────────────────────────────────────────────────
// 그룹 페이지가 위로 거는 링크는 `SITE/`(3D 앱) 하나뿐인데 그 홈은 SPA라 크롤러가 읽을 링크가 없다.
// 그래서 그룹 페이지들도 멤버 페이지와 똑같이 sitemap에만 존재하는 고아였다. 이 허브가 그래프를 닫는다:
//   sitemap → /g/ (허브) → 그룹 페이지 → 멤버 페이지 → 소속 그룹으로 되돌아감
// 순수 텍스트 목록이라 가볍고, 데뷔연도를 같이 실어 "2015년 데뷔 걸그룹" 류 쿼리도 받는다.
function relationHubSection(lang, relLinks) {
  if (!relLinks?.length) return '';
  return `\n  <h2>${lang === 'en' ? 'Collaborations & covers' : '콜라보 · 커버'}</h2>
  <ul>
      ${relLinks.map(r => `<li><a href="${r.href}">${escHtml(r.label)}</a>${r.n == null ? '' : ` <span class="yr">${r.n}</span>`}</li>`).join('\n      ')}
  </ul>`;
}
function hubPageHtml(lang, relLinks) {
  const isEn = lang === 'en';
  const selfUrl = `${SITE}/${isEn ? 'en/g/' : 'g/'}`;
  const altUrl = `${SITE}/${isEn ? 'g/' : 'en/g/'}`;
  const title = isEn ? 'All K-pop Groups — Profiles, Members & Videos | K-POP UNIVERSE' : '케이팝 그룹 전체 목록 — 멤버·데뷔일·직캠 | All K-pop Groups | K-POP UNIVERSE';
  const desc = isEn
    ? `Browse all ${groupKos.length} K-pop groups on K-POP UNIVERSE. Each group page includes debut date, member profiles, discography, and fancam archive.`
    : `K-POP UNIVERSE에서 케이팝 그룹 ${groupKos.length}팀의 데뷔일·멤버 프로필·디스코그래피·직캠을 한눈에 탐험하세요.`;
  const sorted = [...groupKos].sort((a, b) => String(groups[a].debut || '').localeCompare(String(groups[b].debut || '')));
  const items = sorted.map(gko => {
    const info = groups[gko];
    const name = isEn ? (info.en || gko) : gko;
    const yr = String(info.debut || '').slice(0, 4);
    return `<li><a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(name)}</a>${yr ? ` <span class="yr">${yr}</span>` : ''}</li>`;
  }).join('\n      ');
  return `<!doctype html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${SITE}/g/">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#0a0a0d;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;white-space:nowrap;}
  h1{font-size:26px;margin:14px 0 6px;color:#fff;}
  h2{font-size:15px;margin:30px 0 10px;color:rgba(200,220,255,0.9);}
  .sub{font-size:14px;color:rgba(180,200,255,0.6);margin-bottom:22px;}
  ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;}
  li{background:rgba(150,175,255,0.08);border:0.5px solid rgba(150,175,255,0.18);border-radius:10px;padding:6px 12px;font-size:13.5px;}
  a{color:rgba(210,225,255,0.95);text-decoration:none;}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  a{text-decoration:none;transition:color .15s,text-shadow .15s;}a:not(.cta):not(.brand):hover{color:#fff;text-shadow:0 0 10px rgba(150,175,255,0.55);}
</style>
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/all/' : 'all/'}" style="margin-left:10px;">${isEn ? 'Browse all' : '모아보기'}</a>
  <h1>${isEn ? 'All Groups' : '그룹 전체 목록'}</h1>
  <div class="sub">${escHtml(desc)}</div>
  <ul>
      ${items}
  </ul>
${RANK_LINKS[lang].length ? `  <h2>${isEn ? 'Fancam rankings' : '직캠 조회수 순위'}</h2>
  <ul>
      ${RANK_LINKS[lang].map(l => `<li><a href="${l.href}">${escHtml(l.label)}</a></li>`).join('')}
  </ul>
` : ''}${YEAR_LINKS.born.length ? `  <h2>${isEn ? 'Idols by birth year' : '생년별 아이돌'}</h2>
  <ul>
      ${YEAR_LINKS.born.slice().reverse().map(y => `<li><a href="${SITE}/${yearPagePath('born', y, lang)}">${isEn ? `Born in ${y}` : `${y}년생`}</a></li>`).join('')}
  </ul>
  <h2>${isEn ? 'Groups by debut year' : '데뷔연도별 그룹'}</h2>
  <ul>
      ${YEAR_LINKS.debut.slice().reverse().map(y => `<li><a href="${SITE}/${yearPagePath('debut', y, lang)}">${isEn ? `Debuted ${y}` : `${y}년 데뷔`}</a></li>`).join('')}
  </ul>
` : ''}${AGENCY_LINKS.length ? `  <h2>${isEn ? 'By agency' : '소속사별 아이돌'}</h2>
  <ul>
      ${AGENCY_LINKS.map(a => `<li><a href="${SITE}/${agencyPagePath(a.name, lang)}">${escHtml(isEn ? (agencyEn(a.name) || a.name) : a.name)}</a> <span class="yr">${a.n}</span></li>`).join('')}
  </ul>
` : ''}${WIN_YEARS.length ? `  <h2>${isEn ? 'Music show wins by year' : '연도별 음악방송 1위'}</h2>
  <ul>
      ${WIN_YEARS.slice().reverse().map(y => `<li><a href="${SITE}/${winsPagePath(y, lang)}">${isEn ? `${y} wins` : `${y} 음방 1위`}</a></li>`).join('')}
  </ul>
` : ''}${PROGRAM_LINKS[lang].length ? `  <h2>${isEn ? 'By show & series' : '프로그램별 모음'}</h2>
  <ul>
      ${PROGRAM_LINKS[lang].map(l => `<li><a href="${l.href}">${escHtml(l.label)}</a></li>`).join('')}
  </ul>
` : ''}${relationHubSection(lang, relLinks)}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
</div>
${safeNext(() => groupKos.slice().sort((p, q) => (+(groups[q].pri || 0)) - (+(groups[p].pri || 0))).slice(0, 5).map(g => grpCard(g, lang)))}
</body>
</html>
`;
}
// ⚠️ 허브 파일 쓰기는 아래 async 블록에서 한다 — 관계 페이지(/collab/, /cover/) 목록을 허브에 실어야
//    그 페이지들도 고아가 안 된다. 관계 데이터는 DB 조회라 비동기이므로 순서가 이럴 수밖에 없다.
pages.push({ loc: `${SITE}/g/`, priority: '0.9' }, { loc: `${SITE}/en/g/`, priority: '0.9' });

// ── 관계 페이지: /collab/ · /cover/ (2026-08-31) ──────────────────────────────
// 이 서비스만 가진 데이터로 만드는 페이지. 나무위키·kprofiles가 이미 점유한 "OO 프로필" 구간에서
// 이기는 건 어렵지만, "에스파 아이브 같이 나온 영상"·"방탄소년단 커버"는 **경쟁이 사실상 0**이고
// 우리에겐 태깅 36만 건이 있다.
//
// ⚠️ 관계 페이지는 **태깅 품질이 곧 콘텐츠 품질**이다. 실측(2026-08-31) 결과 콜라보 상위 쌍이
//    `아이들 × 제국의아이들`(54건)·`시크릿 × 시크릿넘버`(32건)였는데 둘 다 **부분문자열 오염**이다
//    (아이들 ⊂ 제국의 아이들). 그대로 만들면 오염을 검색엔진에 색인시키는 꼴이라, 이름이 서로
//    부분문자열인 쌍은 아예 제외한다. 실측상 3건 이상 264쌍 중 딱 이 2쌍만 걸린다.
// ⚠️ DB 조회가 실패하면(회사망 TLS·CI 네트워크) 관계 페이지를 **다시 만들지 않고 기존 것을 그대로
//    둔다** — 빈 페이지를 덮어쓰거나 sitemap에서 통째로 빠지는 게 더 나쁘다.
const SB_URL = 'https://dukgguehegnembimqvkm.supabase.co';
const SB_KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 앱(index.html)에 이미 공개된 anon 키
// ── 그룹·멤버 프로필 사진(2026-11-18 사용자 "그룹·아티스트 페이지는 프로필 사진 원, 앨범은 앨범 커버, 곡은 앨범 커버나 영상 썸네일") ──
// 앱 카드와 같은 원본: Supabase artist_pics(그룹은 ko_name='') — 스토리지 주소(고정)만 쓴다(인스타 fbcdn은 며칠 뒤 만료돼 정적 페이지에 못 박는다).
// 키는 그룹|이름(동명이인 125쌍 — 이름만 키로 쓰면 서로 사진을 나눠 가진다). 없으면 예전처럼 16:9 대표 영상 표지.
let PROFILE_PICS = new Map();
let PROFILE_PIC_SRC = new Map(); // 사진 출처(위버스·유튜브 등). 비어 있으면 대개 관리자가 인스타 프로필로 지정한 사진
const picKey = (g, n) => (g || '') + '|' + (n || '');
async function fetchProfilePics() {
  // ⚠️ PostgREST는 한 번에 1000행까지만 준다 — 처음엔 한 번만 받아 1,386장 중 1,000장(그룹 사진 188개 중 7개)만 들어왔다(2026-11-18 미리보기에서 발견).
  //    정렬을 고정하고 1000개씩 나눠 받는다(정렬 없이 나누면 중복·누락).
  const rows = [];
  for (let off = 0; off < 20000; off += 1000) {
    const res = await fetch(`${SB_URL}/rest/v1/artist_pics?select=ko_name,group_ko,pic_url,source_url&pic_url=like.*supabase.co/storage*&order=group_ko.asc,ko_name.asc&limit=1000&offset=${off}`, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const part = await res.json();
    rows.push(...part);
    if (part.length < 1000) break;
  }
  PROFILE_PICS = new Map(rows.filter(r => r.pic_url).map(r => [picKey(r.group_ko, r.ko_name), r.pic_url]));
  PROFILE_PIC_SRC = new Map(rows.filter(r => r.pic_url).map(r => [picKey(r.group_ko, r.ko_name), r.source_url || '']));
  console.log(`프로필 사진 ${PROFILE_PICS.size}장(그룹 ${rows.filter(r => !r.ko_name).length})`);
}
function groupPicUrl(gko) { return PROFILE_PICS.get(picKey(gko, '')) || null; }
// 등록 사진이 없는 그룹의 얼굴 — 영상 썸네일(멤버 한 명 직캠·예능 장면일 수 있다) 대신 최신 앨범 커버(2026-11-21 사용자 "미쓰에이·씨엔블루·아이덴티티처럼 프로필이 그룹 전체를 대변하지 못하는 경우").
// 커버는 그룹 전체의 얼굴이고 정사각이라 원형 칸에도 맞는다. OST·참여 앨범은 뺀다. 커버도 없으면 null(호출부가 영상 썸네일로).
function groupCoverUrl(gko) {
  const d = ((groups[gko] || {}).discography || []).filter(a => a && a.cover && !/ost/i.test(String(a.type || '')) && !/OST|Original Sound ?track/i.test(String(a.title || '')));
  if (!d.length) return null;
  d.sort((x, y) => String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')));
  return d[0].cover;
}
function groupFaceUrl(gko) { return groupPicUrl(gko) || groupCoverUrl(gko) || null; }
// 멤버 큰 원을 눌렀을 때 갈 인스타(2026-11-18 사용자 "카드 프로필 사진이 인스타 프로필인 경우 클릭하면 인스타로") —
// 개인 인스타 링크가 있고 사진 출처가 위버스·유튜브로 기록되지 않았을 때만(출처 빈칸 1,306장은 대개 인스타 프로필로 지정한 것).
function memberPicInstagram(a) {
  const ig = a.links && a.links.instagram; if (!ig || !memberPicUrl(a)) return null;
  const gs = [a.group, ...(a.groups || [])].map(g => g && g.ko).filter(Boolean);
  for (const g of gs) { if (PROFILE_PICS.has(picKey(g, a.name.ko))) { const s = PROFILE_PIC_SRC.get(picKey(g, a.name.ko)) || ''; return /weverse|youtube|ytimg/i.test(s) ? null : ig; } }
  return null;
}
function memberPicUrl(a) {
  const gs = [a.group, ...(a.groups || [])].map(g => g && g.ko).filter(Boolean);
  for (const g of gs) { const u = PROFILE_PICS.get(picKey(g, a.name.ko)); if (u) return u; }
  return null;
}
// 영상 이 수 이상인 관계만 페이지로. 3이면 264쌍이지만 노이즈가 섞인다 — 실측에서 `라이즈 × 방탄소년단`이
// 3건 남았는데 전부 `Fame MV bts 1`처럼 **bts=behind the scenes** 오탐이었다. 5로 올리면 그런 잔여 노이즈가
// 빠지고(콜라보 86쌍) 페이지도 두꺼워진다 — 얇은 페이지는 그 자체로 SEO에 마이너스라 둘 다 이득.
const REL_MIN = 5;

// 관계 페이지 URL 조각. 영문은 기존 slugify(a-z0-9+하이픈)를 그대로 쓰고, 한글은 파일시스템·URL에서
// 문제가 되는 문자만 턴다. ⚠️ `IZ*ONE`처럼 영문명에 `*`가 든 그룹이 있어서 그냥 쓰면 mkdir이 죽는다
// (2026-08-31 실제로 겪음 — Windows에서 `*`는 경로 금지 문자).
function relSeg(name, lang) {
  if (lang === 'en') return slugify(String(name), String(name));
  return urlSafeKo(String(name)).replace(/[\\/:*?"<>|#%&]+/g, '').trim() || 'x';
}
function pairKey(a, b) { return [a, b].sort(); }
// 두 그룹 이름(한/영)이 서로 부분문자열이면 오염 의심 — 위 주석 참고
function namesOverlap(a, b) {
  const n = s => String(s).toLowerCase().replace(/[\s.·\-]/g, '');
  const A = [a, groups[a] && groups[a].en].filter(Boolean).map(n);
  const B = [b, groups[b] && groups[b].en].filter(Boolean).map(n);
  return A.some(x => B.some(y => x !== y && (x.includes(y) || y.includes(x))));
}

async function fetchRelationRows() {
  const cols = 'id,title,group_ko,with_groups,cover_of_groups,content_flag,published_at';
  // 희소 OR를 만족하는 1000개를 찾느라 PK 전체를 훑던 조회가 Supabase 500/57014로
  // 실패했다. admin.js의 windowed 읽기와 동일하게 먼저 ID 구간을 정해 요청마다 5000행 상한.
  const read = async (select, after, end, limit, offset, filtered) => {
    const q = new URL(`${SB_URL}/rest/v1/yt_channel_videos`);
    q.searchParams.set('select', select);
    q.searchParams.set('order', 'id');
    q.searchParams.set('limit', String(limit));
    if (offset) q.searchParams.set('offset', String(offset));
    if (filtered) q.searchParams.set('or', '(with_groups.neq.{},cover_of_groups.neq.{})');
    if (after !== null) q.searchParams.append('id', `gt.${after}`);
    if (end !== null) q.searchParams.append('id', `lte.${end}`);
    const res = await fetch(q, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(45000) });
    if (!res.ok) {
      let why = ''; try { const body = await res.json(); why = body.code ? `/${body.code}: ${body.message}` : ''; } catch {}
      throw new Error(`Supabase ${res.status}${why}`);
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error('Supabase 관계 조회 응답이 배열이 아님');
    return rows;
  };
  const out = [];
  let cursor = null, windows = 0;
  for (;;) {
    const edge = await read('id', cursor, null, 1, 4999, false);
    const end = edge[0]?.id || null;
    let pageCursor = cursor;
    for (;;) {
      const rows = await read(cols, pageCursor, end, 1000, 0, true);
      out.push(...rows);
      if (rows.length < 1000) break;
      pageCursor = rows[rows.length - 1].id;
      await new Promise(r => setTimeout(r, 100)); // 전체 훑기 — 재생성 중 앱 조회가 숨 쉬게 사이사이 쉼(2026-11-17)
    }
    await new Promise(r => setTimeout(r, 100));
    if (++windows % 20 === 0) console.log(`  관계 후보 조회: ${windows}구간 · ${out.length}행`);
    if (end === null) break;
    cursor = end;
  }
  return out.filter(r => !r.content_flag && groups[r.group_ko]);
}

function relPageHtml(o) {
  const { lang, title, desc, h1, sub, sections, selfPath, altPath } = o;
  const isEn = lang === 'en';
  const selfUrl = `${SITE}/${selfPath}`;
  const altUrl = `${SITE}/${altPath}`;
  // 제목만 있는 텍스트 리스트 → 썸네일 카드 그리드(2026-11-15 사용자 "커버 페이지는 왜 영상 썸네일 없이 제목만") — 다른 정적 페이지와 같은 표기
  const secHtml = sections.filter(s => s.items.length).map(s => `
    <h2>${escHtml(s.h)} <span class="yr">${s.items.length}</span></h2>
    <div class="grid">
      ${s.items.map(v => `<a class="card" href="https://www.youtube.com/watch?v=${escHtml(v.id)}" target="_blank" rel="noopener"><span class="card-th"><img src="https://i.ytimg.com/vi/${escHtml(v.id)}/mqdefault.jpg" alt="" loading="lazy"></span><span class="card-t">${escHtml(v.title)}</span><span class="card-y">${[v.note || '', v.pa ? String(v.pa).slice(0, 10).replace(/-/g, '.') : ''].filter(Boolean).map(escHtml).join(' · ')}</span></a>`).join('\n      ')}
    </div>`).join('\n');
  return `<!doctype html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#0a0a0d;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;white-space:nowrap;}
  h1{font-size:24px;margin:14px 0 4px;color:#fff;}
  .sub{font-size:14px;color:rgba(180,200,255,0.6);margin-bottom:8px;}
  .sub a{color:rgba(190,210,255,0.9);}
  h2{font-size:15px;margin:26px 0 8px;color:rgba(200,220,255,0.9);}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 10px;}
  @media(min-width:620px){.grid{grid-template-columns:repeat(3,minmax(0,1fr));}}
  .card{display:block;min-width:0;text-decoration:none;}
  .card-th{display:block;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#17171a;}
  .card-th img{width:100%;height:100%;object-fit:cover;display:block;}
  .card-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.38;margin-top:7px;color:rgba(228,236,255,0.94);}
  .card-y{display:block;font-size:11.5px;color:rgba(160,180,230,0.6);margin-top:2px;}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:28px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#0a0a0d 62%,rgba(10,10,13,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:36px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  a{text-decoration:none;transition:color .15s,text-shadow .15s;}a:not(.cta):not(.brand):hover{color:#fff;text-shadow:0 0 10px rgba(150,175,255,0.55);}
</style>
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/all/' : 'all/'}" style="margin-left:10px;">${isEn ? 'Browse all' : '모아보기'}</a>
  <h1>${escHtml(h1)}</h1>
  <div class="sub">${sub}</div>
${secHtml}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/">${isEn ? 'Explore in the Universe →' : '더 알아보기 →'}</a></div>
  ${o.next || ''}
</div>
</body>
</html>
`;
}

let relPageCount = 0;
async function buildRelationPages() {
  const rows = await fetchRelationRows();
  const gname = (gko, lang) => (lang === 'en' ? (groups[gko] && groups[gko].en) || gko : gko);
  const glink = (gko, lang) => `<a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(gname(gko, lang))}</a>`;

  // 콜라보 쌍 — 같이 나온 영상
  // ⚠️ 검색엔진에 색인되는 페이지라 **DB 태그를 그대로 믿지 않는다.** 지금 매처로 다시 돌려서 그 관계가
  //    여전히 성립하는 것만 싣는다. 실측(2026-08-31)에서 `라이즈 × 방탄소년단` 22건이 상위에 떴는데
  //    제목이 `bts of RIIZING trailer`, 즉 **behind the scenes**였다 — 그대로 냈으면 오염을 색인시킬 뻔했다.
  //    보수적으로 가는 게 맞다: 지금 근거를 못 대는 관계는 페이지로 만들지 않는다(태깅이 좋아지면 다음
  //    빌드에서 자연히 살아난다). 판정 로직을 여기서 새로 짜지 않고 배포 매처를 그대로 부른다.
  let verify = null;
  try {
    const { load } = require('./tools/m2_harness');
    const M = load();
    verify = (r, other) => {
      try {
        const m = M._m2ParseTitle(r.title || '', r.group_ko, undefined, r.published_at);
        if (!m) return false;
        return [m.primaryGroup, ...(m.withGroups || [])].includes(other);
      } catch (e) { return false; }
    };
    console.log('  관계 페이지: 현재 매처로 재검증 켜짐');
  } catch (e) {
    console.warn(`  ⚠️ 매처 로드 실패(${e.message}) — 재검증 없이 DB 태그를 그대로 씁니다`);
  }
  const pairs = new Map();
  // 커버 — 그룹별 양방향(내가 커버한 곡 / 내 곡을 커버한 영상)
  const coverBy = new Map(), coverOf = new Map();
  for (const r of rows) {
    const a = r.group_ko;
    for (const b of (r.with_groups || [])) {
      if (!groups[b] || b === a || namesOverlap(a, b)) continue;
      if (verify && !verify(r, b)) continue; // 지금 매처가 근거를 못 대면 페이지에 안 실음
      const k = pairKey(a, b).join(' ');
      if (!pairs.has(k)) pairs.set(k, []);
      pairs.get(k).push(r);
    }
    for (const b of (r.cover_of_groups || [])) {
      if (!groups[b] || b === a) continue;
      if (verify && !verify(r, b)) continue; // 커버도 동일 — 지금 근거 없는 관계는 색인 안 함
      if (!coverBy.has(a)) coverBy.set(a, []);
      coverBy.get(a).push({ ...r, _origin: b });
      if (!coverOf.has(b)) coverOf.set(b, []);
      coverOf.get(b).push({ ...r, _origin: b });
    }
  }

  const relPages = [];
  const hubLinks = { ko: [], en: [] }; // 허브에 실어야 관계 페이지도 고아가 안 된다
  const vid = (r, note) => ({ id: r.id, title: r.title || '', note, pa: r.published_at }); // pa: 카드 날짜 표기용(2026-11-15 썸네일 카드 전환)

  // ⚠️ 콜라보 페이지는 **기본 비활성**(2026-08-31). 생성기는 완성됐지만 `with_groups` 태깅이 아직
  //    색인시킬 품질이 아니다 — 실측으로 확인한 잔여 오탐:
  //      `방탄소년단 × 위너` 6건 = "the Winner Is?"의 영어 단어 winner가 위너로 매칭
  //      `방탄소년단 × 유니스` 5건 = `@BTS` 멘션(콜라보가 아니라 그냥 언급)
  //      `라이즈 × 방탄소년단` = `Fame MV bts`의 bts(behind the scenes)
  //    반면 `cover_of`는 표본 검수 결과 깨끗해서(커버 댄스·원곡:X 등 명시적 근거) 커버 페이지만 낸다.
  //    with_ 태깅 정리가 끝나면 `REL_COLLAB=1 node build_group_pages.js`로 켜서 확인 후 기본값을 바꾼다.
  const COLLAB_ON = process.env.REL_COLLAB === '1';
  if (!COLLAB_ON) console.log('  콜라보 페이지: 비활성(with_ 태깅 품질 대기) — 커버 페이지만 생성');
  for (const [k, vs] of (COLLAB_ON ? pairs : new Map())) {
    if (vs.length < REL_MIN) continue;
    const [a, b] = k.split(' ');
    for (const lang of ['ko', 'en']) {
      const isEn = lang === 'en';
      const seg = `${relSeg(gname(a, lang), lang)}-${relSeg(gname(b, lang), lang)}`;
      const selfPath = `${isEn ? 'en/' : ''}collab/${seg}/`;
      const altLang = isEn ? 'ko' : 'en';
      const altSeg = `${relSeg(gname(a, altLang), altLang)}-${relSeg(gname(b, altLang), altLang)}`;
      const altPath = `${isEn ? '' : 'en/'}collab/${altSeg}/`;
      const A = gname(a, lang), B = gname(b, lang);
      const html = relPageHtml({
        lang,
        title: isEn ? `${A} × ${B} — videos together | K-POP UNIVERSE` : `${bilingualLabel(A, gname(a, 'en'))} × ${bilingualLabel(B, gname(b, 'en'))} 같이 나온 영상 ${vs.length}개 | K-POP UNIVERSE`,
        desc: isEn ? `${vs.length} videos featuring both ${A} and ${B}.` : `${A}${josa(A, '와/과')} ${B}${josa(B, '이/가')} 함께 나온 영상 ${vs.length}개를 모았어요.`,
        h1: `${A} × ${B}`,
        sub: isEn ? `${glink(a, lang)} and ${glink(b, lang)} appeared together` : `${glink(a, lang)} · ${glink(b, lang)} 함께 나온 영상`,
        sections: [{ h: isEn ? 'Videos together' : '같이 나온 영상', items: vs.slice(0, 60).map(r => vid(r, (r.published_at || '').slice(0, 4))) }],
        selfPath, altPath, next: safeNext(() => [grpCard(a, lang), grpCard(b, lang)]),
      });
      const dir = path.join(ROOT, selfPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      relPages.push({ loc: `${SITE}/${selfPath}`, priority: '0.5' });
      hubLinks[lang].push({ href: `${SITE}/${selfPath}`, label: `${A} × ${B}`, n: vs.length });
      relPageCount++;
    }
  }

  const coverGkos = new Set([...coverBy.keys(), ...coverOf.keys()]);
  for (const gko of coverGkos) {
    const mine = coverBy.get(gko) || [], theirs = coverOf.get(gko) || [];
    if (mine.length < REL_MIN && theirs.length < REL_MIN) continue;
    for (const lang of ['ko', 'en']) {
      const isEn = lang === 'en';
      const altLang = isEn ? 'ko' : 'en';
      const selfPath = `${isEn ? 'en/' : ''}cover/${relSeg(gname(gko, lang), lang)}/`;
      const altPath = `${isEn ? '' : 'en/'}cover/${relSeg(gname(gko, altLang), altLang)}/`;
      const N = gname(gko, lang);
      const html = relPageHtml({
        lang,
        title: isEn ? `${N} cover songs & covered by others | K-POP UNIVERSE` : `${bilingualLabel(N, gname(gko, 'en'))} 커버곡 · ${N} 곡 커버 영상 | K-POP UNIVERSE`,
        desc: isEn ? `${mine.length} songs covered by ${N}, and ${theirs.length} covers of ${N} songs by other artists.`
                   : `${N}${josa(N, '이/가')} 커버한 곡 ${mine.length}개와, 다른 아티스트가 커버한 ${N} 곡 ${theirs.length}개.`,
        h1: isEn ? `${N} — covers` : `${N} 커버`,
        // '이어서 보기' — 이 그룹 + 많이 커버한 원곡 그룹 2 + 많이 커버해 준 그룹 2 (전부 그룹 정적 페이지)
        next: safeNext(() => (() => {
          const top2 = (arr, f) => { const m = new Map(); arr.forEach(r => m.set(f(r), (m.get(f(r)) || 0) + 1)); return [...m.entries()].sort((x, y) => y[1] - x[1]).map(x => x[0]); };
          const gs = [gko, ...top2(mine, r => r._origin).slice(0, 2), ...top2(theirs, r => r.group_ko).slice(0, 2)].filter((g, i, a) => g && a.indexOf(g) === i);
          return gs.map(g => grpCard(g, lang));
        })()),
        sub: glink(gko, lang),
        sections: [
          { h: isEn ? `Covered by ${N}` : `${N}${josa(N, '이/가')} 커버한 곡`, items: mine.slice(0, 60).map(r => vid(r, `→ ${gname(r._origin, lang)}`)) },
          { h: isEn ? `${N} songs covered by others` : `다른 아티스트가 커버한 ${N} 곡`, items: theirs.slice(0, 60).map(r => vid(r, `by ${gname(r.group_ko, lang)}`)) },
        ],
        selfPath, altPath,
      });
      const dir = path.join(ROOT, selfPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), html);
      relPages.push({ loc: `${SITE}/${selfPath}`, priority: '0.5' });
      hubLinks[lang].push({ href: `${SITE}/${selfPath}`, label: isEn ? `${N} covers` : `${N} 커버`, n: mine.length + theirs.length });
      relPageCount++;
    }
  }
  // 이번에 안 만든 옛 관계 페이지는 지운다(2026-09-30). 예전엔 쓰기만 해서, 오태깅 청소로 커버 수가 REL_MIN 아래로
  // 떨어진 그룹(아이콘·하이라이트·온리원오프 — 흔한 단어형 이름이라 오탐 커버가 많았던 곳)의 페이지가 **허브에서 빠진
  // 채 디스크에 남아** 고아가 됐다(static-links 테스트가 이걸로 계속 빨간불). 틀린 데이터로 만든 페이지가 검색에
  // 남는 것도 막는다. ⚠️ 생성이 성공한 경우에만 여기까지 온다(실패 시 existingRelPages가 옛 목록을 보존).
  const made = new Set(relPages.map(p => p.loc.slice(SITE.length + 1)));
  for (const base of ['collab', 'cover', 'en/collab', 'en/cover']) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || made.has(`${base}/${e.name}/`)) continue;
      fs.rmSync(path.join(dir, e.name), { recursive: true, force: true });
      console.log(`  옛 관계 페이지 삭제: ${base}/${e.name}/`);
    }
  }
  return { sitemap: relPages, hubLinks };
}

// DB 실패 시 기존 관계 페이지와 허브 진입 링크를 함께 보존한다(수량은 재조회 없이 추정하지 않음).
function existingRelPages() {
  const out = [], hubLinks = { ko: [], en: [] };
  for (const base of ['collab', 'cover', 'en/collab', 'en/cover']) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'index.html'))) {
        const loc = `${SITE}/${base}/${e.name}/`;
        out.push({ loc, priority: '0.5' });
        const html = fs.readFileSync(path.join(dir, e.name, 'index.html'), 'utf8');
        const title = html.match(/<h1[^>]*>([^<]*)<\/h1>/i)?.[1] || e.name;
        // 빌더의 escHtml이 사용하는 엔티티만 역변환, 렌더 시 다시 이스케이프한다.
        const label = title.replace(/&(amp|lt|gt|quot|#39);/g, (_, k) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
        hubLinks[base.startsWith('en/') ? 'en' : 'ko'].push({ href: loc, label, n: null });
      }
    }
  }
  return { sitemap: out, hubLinks };
}

// ── 곡별 정적 페이지(2026-10-16, 검색노출 2단계) ─────────────────────────────────────────────
// "LOVE DIVE 직캠"·"아이브 LOVE DIVE 무대"처럼 사람들은 곡 이름으로 찾는다. 그룹·멤버 페이지만으론 그 검색어에
// 닿을 자리가 없었다. 곡 목록·영상 묶기는 tools/seo_extra.js buildSongs(앱과 같은 shared.js 규칙) — 영상 4개 이상인 곡만.
// 경로: g/{그룹}/s/{곡 기본형}/ · en/g/{slug}/s/{곡 기본형}/ (기본형 = _songBase, 소문자·기호 제거라 주소에 안전)
let SONGS = {};
let VIDS = {}; // 그룹별 영상(prefetchGroupVideos) — 멤버 페이지 "직캠 모음"(2026-10-30)
let songPageCount = 0;
function songPagePath(gko, b, lang) {
  const gp = groupPagePath(gko, lang);
  return gp ? `${gp}s/${b}/` : null;
}
// 곡·멤버×곡 페이지 영상 정렬/더 보기용 데이터(2026-11-17) — seo_vids.js 가 읽는다. [[id, 제목, 'yyyy-mm-dd', 조회수], …] 인기순 최대 400개.
// '<'는 </script> 를 못 닫게 < 로(백슬래시를 코드에 직접 안 쓰려고 charCode 사용).
function vidsDataScript(vids) {
  const arr = vids.slice(0, 400).map(v => [v.id, String(v.title || ''), v.published_at ? String(v.published_at).slice(0, 10) : '', v.view_count || 0]);
  const json = JSON.stringify(arr).split('<').join(String.fromCharCode(92) + 'u003c');
  return `<script type="application/json" id="kpu-vids">${json}</script>\n  <script src="/seo_vids.js" defer></script>`;
}
function songLinksHtml(gko, lang) {
  const list = SONGS[gko] || [];
  if (!list.length) return '';
  const isEn = lang === 'en';
  // 글자 목록 → 앨범 커버 타일(2026-11-20 사용자 "사진이 필요한데 글자만 있는 곳"). 처음 12곡만 펼쳐 두고 나머지는 접는다(폰 3칸이라 40곡이면 14줄).
  // 40곡 넘는 그룹(샤이니 96·세븐틴 95·방탄 84)의 나머지 곡은 접힌 안에서 글자 링크로 전부 잇는다(고아 페이지 583개 방지 — 예전 규칙 유지).
  const tile = s => `<a class="sp-tile" href="${SITE}/${songPagePath(gko, s.b, lang)}">${s.cover ? `<img src="${escHtml(s.cover)}" alt="" loading="lazy">` : `<span class="sp-tile-ph"></span>`}<span class="sp-tile-t">${escHtml(s.bilingualTitle || s.title)}</span></a>`;
  const FIRST = 12, rest = list.length - FIRST;
  return `
    <h2 id="songs">${isEn ? 'Fancams & stages by song' : '곡별 직캠·무대'}</h2>
    <div class="sp-tiles">
      ${list.slice(0, FIRST).map(tile).join('\n      ')}
    </div>${rest > 0 ? `
    <details class="more-songs"><summary>${isEn ? `${rest} more songs` : `나머지 ${rest}곡 더 보기`}</summary>
    <div class="sp-tiles" style="margin-top:12px">
      ${list.slice(FIRST, 40).map(tile).join('\n      ')}
    </div>${list.length > 40 ? `
    <ul class="member-list rel" style="margin-top:14px">
      ${list.slice(40).map(s => `<li><a href="${SITE}/${songPagePath(gko, s.b, lang)}">${escHtml(s.bilingualTitle || s.title)}</a></li>`).join('\n      ')}
    </ul>` : ''}</details>` : ''}`;
}
// ── 합쳐진 판본 곡 페이지 정리(2026-11-11) ────────────────────────────────────────────────────────────────
// 곡 목록에서 판본 곡('plot twist (Japanese ver.)')을 한국 원곡('첫 만남은 계획대로 되지 않아')에 합치면(shared.js _songAddNicks)
// 예전에 따로 만든 g/투어스/s/plottwist/·멤버×곡 …/s/plottwist/가 갱신 없이 남는다. 이번에 안 만든 곡 폴더 중 그 곡 이름이
// 지금 곡의 별칭이면(buildSongs aliasTo) 그 곡 페이지로 넘기는 안내 페이지로 바꾼다(noindex·canonical·즉시 이동). 못 찾으면 그대로 둔다.
let mergedSongRedirects = 0;
function redirectMergedSongPages() {
  const madeRel = new Set(pages.map(p => decodeURI(p.loc.slice(SITE.length + 1))));
  const page = (url, nm, lang) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${url}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
</head><body><a href="${url}">${escHtml(nm)}</a></body></html>
`;
  for (const gko of Object.keys(SONGS)) {
    const aliasTo = SONGS[gko].aliasTo; if (!aliasTo || !aliasTo.size) continue;
    const byB = new Map(SONGS[gko].map(s => [s.b, s]));
    for (const lang of ['ko', 'en']) {
      const gp = groupPagePath(gko, lang); if (!gp) continue;
      const fix = (sDir, relBase, toRel) => {
        if (!fs.existsSync(sDir)) return;
        for (const e of fs.readdirSync(sDir, { withFileTypes: true })) {
          if (!e.isDirectory()) continue;
          const rel = `${relBase}s/${e.name}/`;
          if (madeRel.has(rel) || !fs.existsSync(path.join(sDir, e.name, 'index.html'))) continue;
          const b = aliasTo.get(e.name); const s = b && byB.get(b); if (!s) continue;
          const to = toRel(s.b); if (!to || !madeRel.has(to)) continue;
          fs.writeFileSync(path.join(sDir, e.name, 'index.html'), page(`${SITE}/${to}`, s.bilingualTitle || s.title, lang));
          mergedSongRedirects++;
        }
      };
      fix(path.join(ROOT, gp, 's'), gp, b => songPagePath(gko, b, lang));
      for (const a of membersOf(gko)) { const mp = memberPagePath(a, lang); if (mp && mp.startsWith(gp)) fix(path.join(ROOT, mp, 's'), mp, b => madeRel.has(memberSongPagePath(a, b, lang)) ? memberSongPagePath(a, b, lang) : null); }
    }
  }
  if (mergedSongRedirects) console.log(`합쳐진 판본 곡 페이지 → 원곡으로 넘김 ${mergedSongRedirects}개`);
}
// 이번 빌드에서 안 만든 옛 곡 페이지 정리(2026-11-12 Codex 검수 — 2PM 'All I Wanna Do'·'Abandoned' 등 6곡 12주소가 11-09 태그 정정 뒤에도
// 11-05 생성본 그대로 200으로 남아 박재범 솔로·I-LAND 커버 링크를 보여줬다). 관계 페이지엔 이 정리가 있었는데(옛 관계 페이지 삭제) 곡 페이지엔 없었다.
// 지우면 검색 결과에서 404가 되므로 판본 합치기와 같은 방식 — noindex + 그룹(멤버×곡이면 멤버) 페이지로 넘김. 이미 넘김 페이지면 그대로.
// ⚠️ 이번 빌드에서 곡 목록을 만든 그룹만(SONGS[gko]가 있을 때) — 조회 실패로 곡이 비면 멀쩡한 페이지를 지우지 않는다.
let retiredSongPages = 0;
function retireStaleSongPages() {
  const madeRel = new Set(pages.map(p => decodeURI(p.loc.slice(SITE.length + 1))));
  const page = (url, nm, lang) => `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${url}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
</head><body><a href="${url}">${escHtml(nm)}</a></body></html>
`;
  const sweep = (sDir, relBase, toRel, nm, lang) => {
    if (!fs.existsSync(sDir)) return;
    for (const e of fs.readdirSync(sDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const f = path.join(sDir, e.name, 'index.html');
      if (madeRel.has(`${relBase}s/${e.name}/`) || !fs.existsSync(f)) continue;
      if (/http-equiv="refresh"/.test(fs.readFileSync(f, 'utf8').slice(0, 600))) continue; // 이미 넘김 페이지
      fs.writeFileSync(f, page(`${SITE}/${toRel}`, nm, lang));
      retiredSongPages++;
    }
  };
  for (const gko of Object.keys(SONGS)) {
    if (!Array.isArray(SONGS[gko]) || !SONGS[gko].length) continue;
    for (const lang of ['ko', 'en']) {
      const gp = groupPagePath(gko, lang); if (!gp) continue;
      const gName = lang === 'en' ? (groups[gko] && groups[gko].en) || gko : gko;
      sweep(path.join(ROOT, gp, 's'), gp, gp, gName, lang);
      for (const a of membersOf(gko)) { const mp = memberPagePath(a, lang); if (mp && mp.startsWith(gp)) sweep(path.join(ROOT, mp, 's'), mp, mp, lang === 'en' ? (a.name.en || a.name.ko) : a.name.ko, lang); }
    }
  }
  if (retiredSongPages) console.log(`이번에 안 만든 옛 곡 페이지 → 그룹·멤버 페이지로 넘김 ${retiredSongPages}개`);
}
// 이번 빌드에서 안 만든 하위 페이지 폴더(앨범 a/·조합 chem/)를 noindex + 상위 페이지 넘김으로(2026-11-13 Codex —
// 제로베이스원 'AFTERGLOW'(근거 없는 레코드 삭제)·조합 목록에서 빠진 9쌍이 옛 내용 그대로 200·색인 허용으로 남아 있었다).
// dir 아래 폴더 중 relBase+이름+'/'가 이번 빌드 pages에 없으면 넘김. 이미 넘김 페이지면 그대로.
function retireStaleDirs(dir, relBase, toUrl, nm, lang) {
  if (!fs.existsSync(dir)) return 0;
  const madeRel = new Set(pages.map(p => decodeURI(p.loc.slice(SITE.length + 1))));
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = path.join(dir, e.name, 'index.html');
    if (madeRel.has(relBase + e.name + '/') || !fs.existsSync(f)) continue;
    if (/http-equiv="refresh"/.test(fs.readFileSync(f, 'utf8').slice(0, 600))) continue;
    fs.writeFileSync(f, `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${toUrl}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${toUrl}">
</head><body><a href="${toUrl}">${escHtml(nm)}</a></body></html>
`);
    n++;
  }
  return n;
}
function buildSongPages() {
  const shareRoutes = Object.fromEntries(Object.keys(groups).map(g => [g, {g: [], m: {}}]));
  const memberRouteOwners = new Map();
  for (const gko of Object.keys(SONGS)) {
    const info = groups[gko]; if (!info) continue;
    const all = SONGS[gko];
    all.forEach(s => {
      shareRoutes[gko].g.push(s.b);
      const others = all.filter(o => o.b !== s.b).slice(0, 16);
      for (const lang of ['ko', 'en']) {
        const rel = songPagePath(gko, s.b, lang);
        const dir = path.join(ROOT, rel);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), songLikePageHtml({ gko, info, s, lang, others }));
        pages.push({ loc: `${SITE}/${rel}`, priority: '0.6' });
      }
      songPageCount++;
      // 멤버×곡 페이지(2026-10-30) — 이 곡에서 개인 직캠이 MEMBER_SONG_MIN개 이상인 멤버
      (MEMBER_SONGS_BY_SONG.get(gko + '|' + s.b) || []).forEach(ms => {
        if (ms.a.id) {
          const route = memberSongPagePath(ms.a, s.b, 'ko');
          const previous = memberRouteOwners.get(route);
          if (previous) shareRoutes[previous.gko].m[previous.id] = shareRoutes[previous.gko].m[previous.id].filter(b => b !== previous.b);
          memberRouteOwners.set(route, {gko, id: ms.a.id, b: s.b});
          const list = shareRoutes[gko].m[ms.a.id] || (shareRoutes[gko].m[ms.a.id] = []);
          list.push(s.b);
        }
        for (const lang of ['ko', 'en']) {
          const rel = memberSongPagePath(ms.a, s.b, lang);
          const dir = path.join(ROOT, rel);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'index.html'), songLikePageHtml({ gko, info, s, lang, others, member: ms }));
          pages.push({ loc: `${SITE}/${rel}`, priority: '0.5' });
        }
        memberSongPageCount++;
      });
    });
  }
  redirectMergedSongPages();
  retireStaleSongPages();
  const shareDir = path.join(ROOT, 'share_routes');
  fs.mkdirSync(shareDir, {recursive: true});
  for (const [gko, routes] of Object.entries(shareRoutes)) {
    const key = gko.replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');
    fs.writeFileSync(path.join(shareDir, key + '.json'), JSON.stringify(routes) + '\n');
  }
}

// ── 멤버×곡 페이지(2026-10-30, 사용자 "'성현 acai'만 검색해도 우리 성현 ACAI 직캠 모음이 나오게") ─────────────────────
// 곡 페이지(코르티스 ACAI)와 멤버 페이지(성현)는 있었지만 "멤버 이름 + 곡 이름"으로 찾는 사람이 닿을 페이지가 없었다.
// 개인 직캠 = 그 곡 영상 중 members가 그 멤버 한 명뿐인 것. 얇은 페이지가 대량으로 생기지 않게 MEMBER_SONG_MIN개 이상만.
// 경로: {멤버 페이지}s/{곡 기본형}/ — g/코르티스/성현/s/acai/ · en/g/cortis/seonghyeon/s/acai/
const MEMBER_SONG_MIN = 3;
const MEMBER_SONGS_BY_SONG = new Map(); // 'gko|b' → [{a, nm, vids}]
const MEMBER_SONGS_BY_ARTIST = new Map(); // artist → [{gko, s, n}]
let memberSongPageCount = 0;
// 멤버 개인 직캠(2026-10-30 사용자 "'성현 직캠'만 검색해도 우리 성현 직캠 모음 페이지로") — 그 멤버 한 명만 태깅 + 제목에 직캠 표시, 조회수 순
const MEMBER_FANCAM_MIN = 3;
const FANCAM_RE = /(직캠|페이스캠|얼빡|원픽캠|fan ?cam|face ?cam|focus(ed)?|unfiltered cam|세로캠|close-?up ?cam)/i;
// 음악 공연이 아닌 직캠(2026-11-12 Codex 검수 — 놀토·사전녹화 비하인드·공항 출국·출근길·포토월·셀프 리뷰·리액션·소감이 직캠 허브에).
// 제목 한 단어로 일괄 빼지 않게: '(+ Behind cam)' 붙은 챌린지 공연과 '#아돌라비하인드' 같은 프로그램 해시태그는 무시, 곡 이름 'Interview'·'Red Carpet'·
// '인천공항 스카이 페스티벌' 무대는 남는다. 10분 넘는 영상 기준은 콘서트 풀캠·메들리까지 빼서 쓰지 않는다. 표본 27개(Codex 제외 17·보존 10) 일치.
const FANCAM_NONPERF_RE = /(팬\s*싸인회|팬사인회|팬싸|fan\s*sign|비하인드|behind|출국|입국|공항\s*도착|출근길?|퇴근길(?!\s*live)|포토월|photo\s?wall|놀라운\s?토요일|놀토|셀프\s?리뷰|리액션|reaction|브이로그|vlog|소감|airport\s*(arrival|departure))/i;
// 레드카펫·포토타임(2026-11-13 Codex — 아이브 W Korea 'Love Your W Red Carpet'·TMA Red Carpet Focus가 직캠 허브에).
// 곡 'Red Carpet'(따옴표 안 — 에이핑크 'Nothing X Red Carpet')과 '더 시즌즈-이효리의 레드카펫' 무대는 남는다.
const RED_CARPET_RE = /(레드\s?카펫|red\s?carpet|포토\s?타임|photo\s?time)/i;
const redCarpetEvent = t => RED_CARPET_RE.test(String(t).replace(/['‘"“][^'’"”]*['’"”]/g, ' ').replace(/이효리의\s*레드\s?카펫/g, ' '));
const isPerfFancam = v => FANCAM_RE.test(v.title || '') && v.category !== 'variety'
  && !FANCAM_NONPERF_RE.test(String(v.title || '').replace(/\(\+\s*behind[^)]*\)/ig, ' ').replace(/#\S*비하인드\S*/g, ' '))
  && !redCarpetEvent(v.title || '');
// 악기 캠(드럼·기타·베이스·키보드 직캠)은 밴드 무대에 피처링한 사람까지 태그돼 있다(2026-11-12 Codex — 드래곤포니 고강훈 드럼캠이
// 피처링 더보이즈 선우 'AURA' 직캠으로). 악기 캠은 제목에 그 멤버 이름(한글·영문·그룹 활동명)이 있을 때만 그 사람 직캠으로.
const INSTR_CAM_RE = /(드럼|기타|베이스|키보드|drum|guitar|bass|keyboard)\s*(직캠|캠|cam)/i;
// 단체 풀캠도 같은 방식(2026-11-12 Codex — STUDIO CHOOM 하츠투하츠 'Full Focused'·ITZY 'Close-up CAM' 단체 안무가 예온·유나 개인 순위 2·3위).
// 솔로 'Full Focused'(카이 '음')는 제목에 이름이 있어 남는다.
const GROUP_CAM_RE = /(full\s*focus(ed)?|풀\s*캠|full\s*cam|close-?up\s*cam|(단체|전체)\s*(직캠|캠)|group\s*(fan)?cam)/i;
function memberNameInTitle(v, a, gko) {
  const t = String(v.title || ''), tu = t.toUpperCase();
  const ge = (a.groups || []).find(g => g && g.ko === gko);
  const ns = [a.name && a.name.ko, a.name && a.name.en, ge && ge.name, ge && ge.nameEn, a.displayName].filter(Boolean);
  const wordHit = n => { const w = String(n).toLowerCase().match(/[a-z0-9]+/g); return !!w && new RegExp('(^|[^a-z0-9])' + w.join('[\\s\\-.]*') + '(?![a-z0-9])', 'i').test(t); };
  return ns.some(n => /[A-Za-z]/.test(n) ? wordHit(n) : t.includes(n));
}
function camTargetOk(v, a, gko) {
  const t = String(v.title || '');
  if (!INSTR_CAM_RE.test(t) && !GROUP_CAM_RE.test(t)) return true;
  const ge = (a.groups || []).find(g => g && g.ko === gko);
  const ns = [a.name && a.name.ko, a.name && a.name.en, ge && ge.name, ge && ge.nameEn].filter(Boolean);
  const tu = t.toUpperCase();
  const wordHit = n => { const N = String(n).toUpperCase(); let i = tu.indexOf(N); while (i >= 0) { if (!/[A-Z0-9]/.test(tu[i - 1] || '') && !/[A-Z0-9]/.test(tu[i + N.length] || '')) return true; i = tu.indexOf(N, i + 1); } return false; };
  return ns.some(n => /[A-Za-z]/.test(n) ? wordHit(n) : t.includes(n));
}
// 솔로 키(2026-11-15) — 그룹 소속이어도 솔로 활동 영상은 group_ko=이름으로 들어온다(태민·츄 등).
// shared.js _ytGroupKoFor와 같은 규칙: 이름이 유일하거나 nameKeyOwner일 때만 이름 키 — 동명이인 남의 영상이 섞이지 않게.
// '이름#id' 폴백 키는 DB에 영상이 없으므로 조회하지 않는다(null 반환).
const _nameKoCnt = new Map();
artists.forEach(x => { if (x && x.name) _nameKoCnt.set(x.name.ko, (_nameKoCnt.get(x.name.ko) || 0) + 1); });
function soloKoOf(a) {
  if (!a || !a.name || !a.name.ko) return null;
  if ((_nameKoCnt.get(a.name.ko) || 0) > 1 && !a.nameKeyOwner) return null;
  return groups[a.name.ko] ? null : a.name.ko; // 이름이 그룹명과 겹치면 그룹 키를 침범하므로 제외
}
function memberFancams(a, gko) {
  const ge = (a.groups || []).find(g => g && g.ko === gko);
  const names = new Set([a.name.ko, ge && ge.name].filter(Boolean));
  const out = (VIDS[gko] || []).filter(v => Array.isArray(v.members) && v.members.length === 1 && names.has(v.members[0]) && isPerfFancam(v) && camTargetOk(v, a, gko));
  // 솔로 활동 직캠도 합친다(2026-11-15 "그룹 개인 직캠·솔로 활동 영상 다 한 페이지에") — 이름 키 영상은 전부 본인 것이라 members 필터 불필요
  const sk = soloKoOf(a);
  if (sk && sk !== gko) for (const v of VIDS[sk] || []) { if (isPerfFancam(v) && camTargetOk(v, a, sk)) out.push(v); }
  const seen = new Set();
  return out.filter(v => v && !seen.has(v.id) && seen.add(v.id)).sort((x, y) => (y.view_count || 0) - (x.view_count || 0));
}
// 솔로 아티스트(그룹 미등록)용 — 전 그룹 개인 직캠 + 본인 이름 키 영상 전부(선미=원더걸스+솔로, 아이유=솔로만)
function memberFancamsAll(a) {
  const out = [];
  for (const k of (a.groups || []).map(g => g && g.ko).filter(k => k && groups[k])) out.push(...memberFancams(a, k));
  const sk = soloKoOf(a);
  if (sk) for (const v of VIDS[sk] || []) { if (isPerfFancam(v) && camTargetOk(v, a, sk)) out.push(v); }
  const seen = new Set();
  return out.filter(v => v && !seen.has(v.id) && seen.add(v.id)).sort((x, y) => (y.view_count || 0) - (x.view_count || 0));
}
// 그룹 직캠·무대(2026-10-30 — '코르티스 직캠' 검색 착지) — 퍼포먼스 분류(live) 또는 제목에 직캠 표시, 뮤비 제외, 조회수 순
const GROUP_STAGE_MIN = 6;
function groupStageVids(gko) {
  return (VIDS[gko] || []).filter(v => (v.category === 'live' || FANCAM_RE.test(v.title || '')) && !/(\bM\/?V\b|뮤직비디오|music video)/i.test(v.title || ''))
    .sort((x, y) => (y.view_count || 0) - (x.view_count || 0));
}
// 썸네일 카드 그리드(멤버·그룹 페이지 공용, 스타일은 seo_extra EXTRA_CSS .mf-*)
function vidCardsHtml(list, isEn) {
  return list.map(v => `<a class="mf-card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="mf-th"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"></span><span class="mf-t">${escHtml(v.title)}</span><span class="mf-y">${[v.published_at ? String(v.published_at).slice(0, 10).replace(/-/g, '.') : '', v.view_count ? SEO.fmtVC(v.view_count) : ''].filter(Boolean).join(' · ')}</span></a>`).join('');
}
function memberSongPagePath(a, b, lang) { return `${memberPagePath(a, lang)}s/${b}/`; }
// 멤버×곡 페이지에 들어갈 개인 영상(2026-11-13 Codex — 윤호 'Guerrilla'에 일본 여행 브이로그, 지민 'Black Swan'에 비하인드, 로제
// 'Lovesick Girls'에 인터뷰감옥, 라비 'Radio'에 보이는 라디오, 가을 'Baddie'에 아이브 Full Focused 단체 안무). 직캠 표시가 없어도 되는 대신
// (솔로 무대·라이브 클립) 공연이 아닌 표시가 있으면 뺀다. 팬사인회 중 실제 개인 무대(모모 MOONLIGHT SUNRISE)는 남긴다.
const MEMBER_SONG_NONPERF_FMT = new Set(['브이로그', '비하인드', '인터뷰', '라디오']);
const MEMBER_SONG_NONPERF_RE = /(비하인드|behind|브이로그|vlog|인터뷰|interview|보이는\s?라디오|visual\s?radio|여행|녹음|예고편|출국|입국|공항|airport|출근길?|퇴근길(?!\s*live)|포토월|photo\s?wall|리액션|reaction|소감|teaser|티저|mood\s?sampler|무드\s?샘플러|promotion|프로모션|아는\s?형님|핫소스)/i;
function memberSongVidOk(v, a, gko, song) {
  if (v.category === 'variety') return false;
  if ((v.content_formats || []).some(x => MEMBER_SONG_NONPERF_FMT.has(x))) return false;
  const t = String(v.title || '').replace(/\(\+\s*behind[^)]*\)/ig, ' ').replace(/#\S*비하인드\S*/g, ' ');
  const ts = song && song.title && song.title.length > 1 ? t.split(song.title).join(' ') : t; // 곡 이름 자체('여행'·'Interview')는 신호가 아니다
  if (MEMBER_SONG_NONPERF_RE.test(ts) || redCarpetEvent(ts)) return false;
  // 개인 곡 페이지 = 그 멤버 개인 영상 — 제목에 그 멤버 이름(한글·영문·그룹 활동명)이 있어야 한다(2026-11-13 Codex — 예온 'Lemon Tang'에
  // 예온 한 명으로 잘못 태그된 단체 무대 9개·STUDIO CHOOM 단체 퍼포먼스가 대표로). 이름 없는 단체 무대는 그룹 곡 페이지에 그대로 있다.
  if (!memberNameInTitle(v, a, gko)) return false;
  return camTargetOk(v, a, gko);
}
function computeMemberSongs() {
  const made = new Set();
  for (const gko of Object.keys(SONGS)) {
    const members = membersOf(gko);
    const byName = new Map();
    members.forEach(a => { byName.set(a.name.ko, a); const ge = (a.groups || []).find(g => g && g.ko === gko); if (ge && ge.name) byName.set(ge.name, a); });
    for (const s of SONGS[gko]) {
      const solo = new Map();
      s.vids.forEach(v => { const m = v.members || []; if (m.length !== 1) return; const a = byName.get(m[0]); if (!a || !memberSongVidOk(v, a, gko, s)) return; if (!solo.has(a)) solo.set(a, []); solo.get(a).push(v); });
      const list = [];
      for (const [a, vids] of solo) {
        if (vids.length < MEMBER_SONG_MIN) continue;
        const key = memberSongPagePath(a, s.b, 'ko'); if (made.has(key)) continue; // 겸임 멤버가 두 그룹에 같은 곡 이름을 가진 드문 경우
        made.add(key);
        const ge = (a.groups || []).find(g => g && g.ko === gko);
        list.push({ a, nm: (ge && ge.name) || a.name.ko, nmEn: (ge && ge.nameEn) || a.name.en || a.name.ko, vids });
        if (!MEMBER_SONGS_BY_ARTIST.has(a)) MEMBER_SONGS_BY_ARTIST.set(a, []);
        MEMBER_SONGS_BY_ARTIST.get(a).push({ gko, s, n: vids.length });
      }
      if (list.length) MEMBER_SONGS_BY_SONG.set(gko + '|' + s.b, list.sort((x, y) => y.vids.length - x.vids.length));
    }
  }
  MEMBER_SONGS_BY_ARTIST.forEach(l => l.sort((x, y) => y.n - x.n));
}
// 멤버 페이지의 "곡별 직캠" 칸 — 앨범 커버 타일
// ── 재생 화면 '이어서' 카드 데이터(2026-11-11) ─────────────────────────────────────────────
// 멤버 페이지에 <script type="application/json" id="kpu-next">로 싣고 seo_play.js가 영상 밑에 그린다.
// 항목: 케미 상위 2명(함께 나온 영상 수) + 곡별 직캠 상위 2곡. 링크는 앱 딥링크(#chem= / #g=&m=&song=)라 누르면 그 화면이 바로 열린다.
// 재생 중인 영상 제목에 곡 이름이 있으면 seo_play.js가 그 곡 카드를 맨 앞으로 올린다(m: 맞춤 키).
let _chemByMember = null;
function chemPartnersOf(a) {
  if (!CHEM_RAW) return [];
  if (!_chemByMember) {
    _chemByMember = new Map();
    const byName = new Map();
    for (const g of groupKos) membersOf(g).forEach(x => { byName.set(g + '|' + x.name.ko, x); const ge = (x.groups || []).find(y => y && y.ko === g); if (ge && ge.name) byName.set(g + '|' + ge.name, x); });
    for (const p of CHEM_RAW) {
      if (!groups[p.g]) continue;
      const x = byName.get(p.g + '|' + p.a), y = byName.get(p.g + '|' + p.b);
      if (!x || !y || x === y) continue;
      [[x, y], [y, x]].forEach(([me, other]) => { if (!_chemByMember.has(me)) _chemByMember.set(me, []); _chemByMember.get(me).push({ g: p.g, other, n: p.n, v: (p.v || []).find(q => q && !q.s) || (p.v || [])[0] }); /* 가로 영상 썸네일 우선 */ });
    }
    _chemByMember.forEach(l => l.sort((u, w) => w.n - u.n));
  }
  return _chemByMember.get(a) || [];
}
function nextItemsJson(a, lang) {
  // 2026-11-11 사용자 "꼭 케미 제안할 필요 없음 — 다른 제안할 거 많다" → 종류를 섞는다(케미는 1개만):
  // ① 이 멤버 곡별 직캠 상위 곡 ② 같은 곡 다른 멤버 직캠 ③ 그룹 전체 ④ 케미 1명 ⑤ 두 번째 곡. 폰은 가로로 넘기고 넓은 화면은 앞 3개.
  const isEn = lang === 'en', gko = a.group && a.group.ko;
  if (!gko || !groups[gko]) return '';
  const nm = x => isEn ? (x.name.en || x.name.ko) : (x.displayName || x.name.ko);
  const vidId = v => (typeof v === 'string' ? v : v && (v.id || v.v)) || '';
  const topVid = vids => (vids || []).slice().sort((p, q) => (q.view_count || 0) - (p.view_count || 0))[0];
  const songs = (MEMBER_SONGS_BY_ARTIST.get(a) || []).filter(y => y.gko === gko);
  const songItem = x => { const ms = (MEMBER_SONGS_BY_SONG.get(gko + '|' + x.s.b) || []).find(y => y.a === a); const v = ms && topVid(ms.vids);
    return { k: isEn ? 'Every stage' : '모든 무대', t: x.s.title, s: isEn ? `${x.n} fancams of ${nm(a)}` : `${nm(a)} 직캠 ${x.n}개`, img: v ? v.id : '', m: x.s.title, h: `${SITE}/${memberSongPagePath(a, x.s.b, lang)}` }; };
  const items = [];
  if (songs[0]) items.push(songItem(songs[0]));
  if (songs[0]) { const mate = (MEMBER_SONGS_BY_SONG.get(gko + '|' + songs[0].s.b) || []).find(y => y.a !== a); if (mate) { const v = topVid(mate.vids);
    items.push({ k: isEn ? 'Same song' : '같은 곡', t: `${nm(mate.a)} · ${songs[0].s.title}`, s: isEn ? `${mate.vids.length} fancams` : `직캠 ${mate.vids.length}개`, img: v ? v.id : '', m: songs[0].s.title, h: `${SITE}/${memberSongPagePath(mate.a, songs[0].s.b, lang)}` }); } }
  { const G = isEn ? (groups[gko].en || gko) : gko; const gi = groupFaceUrl(gko) || ogImageForGroup(gko, groups[gko]);
    items.push({ k: isEn ? 'Group' : '그룹', t: G, s: isEn ? 'Stages · MVs · members' : '무대 · 뮤비 · 멤버', im: /og-image\.png$/.test(gi) ? '' : gi.replace('/maxresdefault.', '/mqdefault.').replace('/hq720.', '/mqdefault.'), h: `${SITE}/${groupPagePath(gko, lang)}` }); }
  const c = chemPartnersOf(a)[0];
  if (c) { const key = [a, c.other].map(x => x.name.ko + '~' + c.g).join(',');
    items.push({ k: isEn ? 'Chemistry' : '케미', t: `${nm(a)} × ${nm(c.other)}`, s: isEn ? `${c.n} videos together` : `함께 나온 영상 ${c.n}개`, img: vidId(c.v), h: (() => { const [p1, p2] = a.name.ko.localeCompare(c.other.name.ko, 'ko') > 0 ? [c.other, a] : [a, c.other]; const cp = chemPagePath(c.g, p1, p2, lang); return cp ? `${SITE}/${cp}` : `${SITE}/#chem=${encodeURIComponent(key)}`; })() }); }
  if (songs[1]) items.push(songItem(songs[1]));
  if (!items.length) return '';
  return `<script type="application/json" id="kpu-next">${JSON.stringify(items).replace(/</g, '\\u003c')}</script>`;
}
function memberSongLinksHtml(a, lang) {
  const list = MEMBER_SONGS_BY_ARTIST.get(a) || [];
  if (!list.length) return '';
  const isEn = lang === 'en';
  return `
    <h2>${isEn ? 'Fancams by song' : '곡별 직캠'}</h2>
    <div class="sp-tiles">
      ${list.slice(0, 24).map(x => `<a class="sp-tile" href="${SITE}/${memberSongPagePath(a, x.s.b, lang)}">${x.s.cover ? `<img src="${escHtml(x.s.cover)}" alt="" loading="lazy">` : `<span class="sp-tile-ph"></span>`}<span class="sp-tile-t">${escHtml(x.s.bilingualTitle || x.s.title)}</span><span class="sp-tile-n">${isEn ? `${x.n} fancams` : `직캠 ${x.n}`}</span></a>`).join('\n      ')}
    </div>`;
}

// ── 멤버 직캠 전체 페이지(2026-11-11, 사용자 — 네이버 "송승호 직캠" 검색) ─────────────────────────────────────────────
// "{멤버} 직캠"으로 찾는 사람은 그 멤버의 모든 직캠을 곡별로 보고 싶다. 프로필 페이지는 상위 24개뿐이고, 멤버×곡 페이지는 곡 하나뿐.
// 경로: {멤버 페이지}fancams/ — 맨 위 조회수 상위 + 곡별 묶음 전부(묶음 제목 → 멤버×곡 페이지) + 곡을 못 찾은 직캠.
// 프로필 페이지와 내용이 거의 같아지지 않게 직캠 FANCAM_HUB_MIN개 이상인 멤버만(그 아래는 프로필 페이지가 '직캠 모음' 제목을 유지).
const FANCAM_HUB_MIN = 10;
const FANCAM_HUB = new Map(); // artist → 개인 직캠(조회수 순)
let fancamPageCount = 0;
function memberFancamPagePath(a, lang) { return `${memberPagePath(a, lang)}fancams/`; }
function computeFancamHubs() {
  for (const a of artists) {
    if (!a || !a.name || !a.group) continue;
    // 솔로 아티스트도 직캠이 충분하면 허브 생성(2026-11-15 "그룹 곡이든 솔로 곡이든 직캠 어느 정도 있으면 정적 페이지")
    const f = groups[a.group.ko] ? memberFancams(a, a.group.ko) : memberFancamsAll(a);
    if (f.length >= FANCAM_HUB_MIN) FANCAM_HUB.set(a, f);
  }
}
function fancamCardHtml(v, isEn, rank) {
  return `<a class="card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="card-th"><img src="${ytThumb(v.id, 'mqdefault')}" alt="" loading="lazy">${rank ? `<span class="rk">${rank}</span>` : ''}</span><span class="card-t">${escHtml(v.title)}</span><span class="card-y">${[v.published_at ? String(v.published_at).slice(0, 10).replace(/-/g, '.') : '', v.view_count ? SEO.fmtVC(v.view_count) : ''].filter(Boolean).join(' · ')}</span></a>`;
}
// 곡별 묶음 — 곡 페이지와 같은 곡 데이터(SONGS)에서 그 영상이 속한 곡을 찾는다. 곡이 안 잡힌 직캠은 맨 아래 '그 밖의 직캠'
function fancamsBySong(a, gko, fancams) {
  const songOf = new Map();
  for (const s of SONGS[gko] || []) for (const v of s.vids) if (!songOf.has(v.id)) songOf.set(v.id, s);
  const by = new Map(), rest = [];
  for (const v of fancams) { const s = songOf.get(v.id); if (!s) { rest.push(v); continue; } if (!by.has(s)) by.set(s, []); by.get(s).push(v); }
  const msSet = new Set((MEMBER_SONGS_BY_ARTIST.get(a) || []).filter(x => x.gko === gko).map(x => x.s.b));
  const songs = [...by.entries()].map(([s, vids]) => ({ s, vids, page: msSet.has(s.b) })).sort((x, y) => y.vids.length - x.vids.length || (y.vids[0].view_count || 0) - (x.vids[0].view_count || 0));
  return { songs, rest };
}
const FANCAM_PER_SONG = 12;  // 멤버×곡 페이지가 있는 곡은 상위 12개 + '전체 보기', 없으면 그 곡 직캠 전부(MEMBER_SONG_MIN 미만이라 적다)
const FANCAM_TOP = 12;
const FANCAM_RANK_N = 10; // 직캠 전체 페이지 맨 위 TOP 순위 개수
const FANCAM_REST_MAX = 48;

// 프로필 맨 위 SNS 링크 줄(2026-11-18 사용자 "링크는 기본적으로 넣어줘야지 — 정적 페이지에서도 기본 정보 안내는 가능해야"). 그룹은 groups.json links,
// 멤버는 artists.json links(인스타는 개인 계정만 — 메모리 규칙, 데이터에 있는 것만). 작은 알약 한 줄, 새 창.

// 제목 아래 '살아 있는 줄'(2026-11-18 사용자 "정적 페이지가 너무 정적이라 딱딱하다 — n명이 다녀갔어요 줄이 비지 않게 데이터를 만들자,
// 지금까지 n명·이번 주 새 직캠 n개 같은 것"). 빌드할 때 그 페이지 영상·1위 기록으로 사실 몇 줄을 계산해 심어 두고(#kpu-facts),
// seo_play.js가 '이번 주 팬 n명'(30명↑일 때)과 함께 카드 상태 줄처럼 번갈아 보여 준다. 0인 항목은 안 넣는다(빈 식당처럼 보이지 않게).
function pageFacts({ vids, wins, fancams, isEn }) {
  const out = [];
  const fmt = n => Number(n).toLocaleString(isEn ? 'en-US' : 'ko-KR');
  const wk = new Date(Date.parse(TODAY_ISO) - 7 * 864e5).toISOString().slice(0, 10);
  const list = (vids || []).filter(v => v && v.id);
  const newWk = list.filter(v => String(v.published_at || '').slice(0, 10) >= wk).length;
  if (newWk) out.push(isEn ? `${fmt(newWk)} new video${newWk > 1 ? 's' : ''} this week` : `이번 주 새 영상 ${fmt(newWk)}개`);
  const ws = (wins || []).filter(w => w && w.win_date).sort((x, y) => String(y.win_date).localeCompare(String(x.win_date)));
  if (ws.length) { const w = ws[0], d = String(w.win_date).slice(0, 10).replace(/-/g, '.'); out.push(isEn ? `Latest music show win · ${w.song_title || ''} (${d})` : `최근 음방 1위 · ${w.song_title || ''} (${d})`); }
  if (ws.length > 1) out.push(isEn ? `${fmt(ws.length)} music show wins` : `음방 1위 ${fmt(ws.length)}회`);
  const fc = (fancams || []).length;
  if (fc) out.push(isEn ? `${fmt(fc)} fancams collected` : `모아둔 직캠 ${fmt(fc)}개`);
  else if (list.length >= 10) out.push(isEn ? `${fmt(list.length)} stages & videos collected` : `모아둔 무대·영상 ${fmt(list.length)}개`);
  const top = list.reduce((m, v) => (v.view_count || 0) > (m ? m.view_count || 0 : 0) ? v : m, null);
  if (top && top.view_count >= 1e5) out.push(isEn ? `Most viewed · ${SEO.fmtViews(top.view_count, true)} views` : `가장 많이 본 영상 · 조회수 ${SEO.fmtViews(top.view_count, false)}`);
  return out.slice(0, 5);
}
function factsTag(arr) {
  if (!arr || !arr.length) return '';
  return `<script type="application/json" id="kpu-facts">${JSON.stringify(arr).replace(/</g, '\\u003c')}</script>`;
}
function snsRowHtml(links, isEn) {
  if (!links) return '';
  const L = [['youtube', 'YouTube'], ['instagram', 'Instagram'], ['x', 'X'], ['tiktok', 'TikTok'], ['weverse', 'Weverse'], ['namu', isEn ? 'Namuwiki' : '나무위키']];
  const items = L.filter(([k]) => typeof links[k] === 'string' && /^https?:\/\//.test(links[k])).map(([k, t]) => `<a class="sns-${k}" href="${escHtml(links[k])}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  return items.length ? `<div class="sns">${items.join('')}</div>` : '';
}
// 대표 영상(맨 위 큰 썸네일) 정보 줄(2026-11-18 사용자 "직캠 페이지 썸네일 겁나 큰 대표 영상 — 제목·날짜·조회수 전혀 표기 안 됨"). 영상 카드와 같은 형식.
function heroCapHtml(v, isEn) {
  if (!v || !v.id) return '';
  const d = v.published_at ? String(v.published_at).slice(0, 10).replace(/-/g, '.') : '';
  const vc = v.view_count ? SEO.fmtViews(v.view_count, isEn) : '';
  return `<p class="hero-cap"><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${escHtml(v.title || '')}</a>${(d || vc) ? `<span>${[d, vc].filter(Boolean).join(' · ')}</span>` : ''}</p>`;
}
function fancamPageHtml(a, lang) {
  const isEn = lang === 'en';
  const gko = a.group.ko, info = groups[gko] || null; // 솔로 아티스트(그룹 미등록)도 허브 생성(2026-11-15) — 그룹 표기는 '솔로'로
  const fancams = FANCAM_HUB.get(a);
  const ge = (a.groups || []).find(g => g && g.ko === gko);
  const nm = (ge && ge.name) || a.name.ko, nmEn = (ge && ge.nameEn) || a.name.en || a.name.ko;
  const mName = isEn ? nmEn : nm;
  const mFull = isEn ? bilingualLabel(nmEn, nm) : bilingualLabel(nm, nmEn);
  const gName = info ? (isEn ? (info.en || gko) : gko) : (isEn ? 'Solo' : '솔로');
  const gFull = info ? (isEn ? bilingualLabel(gName, gko) : bilingualLabel(gko, info.en)) : (isEn ? 'Solo Artist' : '솔로 아티스트');
  const selfPath = memberFancamPagePath(a, lang), altPath = memberFancamPagePath(a, isEn ? 'ko' : 'en'), koPath = memberFancamPagePath(a, 'ko');
  const selfUrl = `${SITE}/${selfPath}`, altUrl = `${SITE}/${altPath}`, koUrl = `${SITE}/${koPath}`;
  const profileUrl = `${SITE}/${memberPagePath(a, lang)}`;
  const { songs, rest } = fancamsBySong(a, gko, fancams);
  const songLabel = s => s.bilingualTitle || s.title;
  const topSongs = songs.slice(0, 4).map(x => songLabel(x.s));
  // 제목의 대표 곡(2026-11-11 사용자 "'곡별 N개'는 구미가 안 당긴다 — 대표 곡을, 직캠 개수뿐 아니라 조회수도 고려해서"):
  // 그 멤버의 그 곡 직캠 **조회수 합**(= 개수 × 평균 조회수) 순 상위 2곡, 둘이 합쳐 길면 1곡. 개수(N)는 매주 바뀌어 제목에선 빼고 설명에만.
  // 영어 페이지는 영문 제목(bilingualTitle의 영문 부분)이 있으면 그걸로. 실측: 장원영 LOVE DIVE·ELEVEN, 김채원 ANTIFRAGILE·FEARLESS
  const shortName = s => { const ko = String(s.title || ''); if (!isEn) return ko; const bt = s.bilingualTitle || ''; return bt.startsWith(ko + ' ') ? bt.slice(ko.length + 1) : (bt || ko); };
  // 시간도(사용자 "대표곡이 너무 옛날 곡 2개면 좀 그렇다"): 첫 칸 = 조회수 합 1위, 둘째 칸 = 최근 1년 안에 나온 곡 중 조회수 합 1위
  // (첫 칸이 이미 최근 곡이면 그냥 2위). 두 곡이 합쳐 길면(26자 초과) 한 곡 — 첫 칸이 옛 곡이고 최근 곡이 있으면 최근 곡으로.
  const yearAgo = new Date(Date.parse(TODAY_ISO) - 365 * 864e5).toISOString().slice(0, 10);
  const isRecent = s => String(s.date || '').replace(/\./g, '-').slice(0, 10) >= yearAgo;
  const ranked = songs.map(x => ({ s: x.s, v: x.vids.reduce((n, v) => n + (v.view_count || 0), 0) })).sort((p, q) => q.v - p.v);
  const first = ranked[0], fresh = ranked.find(o => o !== first && isRecent(o.s));
  const second = first && isRecent(first.s) ? ranked[1] : (fresh || ranked[1]);
  let picks = [first, second].filter(Boolean).map(o => shortName(o.s));
  if (picks.join('').length > 26) picks = first && !isRecent(first.s) && fresh ? [shortName(fresh.s)] : picks.slice(0, 1);
  const idTitle = !info ? (isEn ? bilingualLabel(nmEn, nm) : bilingualLabel(nm, nmEn)) // 솔로는 이름만 — '솔로 선미' 같은 표기 방지
    : isEn ? bilingualLabel(`${gName} ${nmEn}`, `${gko} ${nm}`) : bilingualLabel(`${gko} ${nm}`, `${info.en || gko} ${nmEn}`); // 그룹+이름 영·한 같이 맨 앞(docs/NAMING.md)
  // 제목에 'TOP 10'(2026-11-16 사용자 "차트 노출 — 아티스트별 전체 직캠 페이지에 TOP 모음"): '직캠 모음'은 그대로 두고 뒤에만 붙인다
  const title = isEn
    ? `${idTitle} Fancams · Top 10${picks.length ? ` — ${picks.map(t => `"${t}"`).join(', ')} & more` : ''} | K-POP UNIVERSE`
    : `${idTitle} 직캠 모음·TOP 10${picks.length ? ` — ${picks.map(t => `'${t}'`).join('·')} 등` : ''} | K-POP UNIVERSE`;
  const _gPreEn = info ? `${gName} ` : '', _gPreKo = info ? `${gko} ` : ''; // 솔로는 그룹 접두 생략
  const desc = isEn
    ? `All ${fancams.length} ${_gPreEn}${mName} fancams and face cams, grouped by song${topSongs.length ? ` (${topSongs.join(', ')}…)` : ''}, with the most-viewed Top 10 ranking and this year's popular picks.`
    : `${_gPreKo}${mName} 직캠·페이스캠 ${fancams.length}개를 곡별로 모았어요${topSongs.length ? `(${topSongs.join(', ')} 등)` : ''}. 조회수 TOP 10 순위와 최근 1년 인기 직캠까지.`;
  const h1 = isEn ? `${mFull} Fancams` : `${mFull} 직캠`;
  const sub = isEn ? `${gFull} · ${fancams.length} fancams · ${songs.length} songs` : `${gFull} · 직캠 ${fancams.length}개 · ${songs.length}곡`;
  const hero = fancams[0];
  const ogImage = wideThumb(hero.id), ogSz = ogSizeFor(ogImage);
  const iso = d => { const t = Date.parse(d); return isNaN(t) ? null : new Date(t).toISOString(); };
  // 동영상 구조화 데이터(VideoObject) — 구글 동영상 결과용 시도. 영상 본체는 유튜브라 채택은 장담 못 함
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: selfUrl, description: desc, inLanguage: isEn ? 'en' : 'ko',
    about: { '@type': 'Person', name: mName, url: profileUrl, ...(info ? { memberOf: { '@type': 'MusicGroup', name: gName, url: `${SITE}/${groupPagePath(gko, lang)}` } } : {}) },
    mainEntity: { '@type': 'ItemList', numberOfItems: fancams.length, itemListElement: fancams.filter(v => iso(v.published_at)).slice(0, 10).map((v, i) => ({
      '@type': 'ListItem', position: i + 1, item: { '@type': 'VideoObject', name: v.title, description: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, embedUrl: `https://www.youtube.com/embed/${v.id}`,
        thumbnailUrl: [wideThumb(v.id), ytThumb(v.id, 'mqdefault')], /* 4:3 hqdefault는 빼고 16:9만(검은 띠) */ uploadDate: iso(v.published_at),
        interactionStatistic: v.view_count ? { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: v.view_count } : undefined } })) },
  };
  // TOP 10 순위(조회수 순, 번호 배지) + 최근 1년 안에 올라온 것 중 인기 상위(조회수는 누적이라 '최근 1년 업로드' 기준 — 기간 조회수 증가량 아님)
  const topGrid = fancams.slice(0, FANCAM_RANK_N).map((v, i) => fancamCardHtml(v, isEn, i + 1)).join('\n    ');
  const _yr = new Date(Date.parse(TODAY_ISO) - 365 * 864e5).toISOString().slice(0, 10);
  const topIds = new Set(fancams.slice(0, FANCAM_RANK_N).map(v => v.id));
  const recentTop = fancams.filter(v => String(v.published_at || '').slice(0, 10) >= _yr && !topIds.has(v.id)).slice(0, 6);
  const recentGrid = recentTop.length >= 3 ? recentTop.map(v => fancamCardHtml(v, isEn)).join('\n    ') : '';
  // 곡별 개수 — 도착(멤버×곡) 페이지가 있으면 그 페이지의 개수를 쓴다. 허브가 모은 직캠과 도착 페이지가 모은 영상의 기준이 달라 22↔24처럼 어긋났다(2026-11-17 Codex).
  const nOf = x => { if (!x.page) return x.vids.length; const m = (MEMBER_SONGS_BY_SONG.get(gko + '|' + x.s.b) || []).find(y => y.a === a); return m ? m.vids.length : x.vids.length; };
  const songNav = songs.length > 1 ? `<ul class="chips">${songs.map((x, i) => `<li><a href="#s${i}">${escHtml(songLabel(x.s))} <span>${nOf(x)}</span></a></li>`).join('')}</ul>` : '';
  const songSections = songs.map((x, i) => {
    const pageUrl = x.page ? `${SITE}/${memberSongPagePath(a, x.s.b, lang)}` : '';
    const shown = x.page ? x.vids.slice(0, FANCAM_PER_SONG) : x.vids;
    const label = isEn ? `${mName} "${songLabel(x.s)}" fancams` : `${mName} '${songLabel(x.s)}' 직캠`;
    return `
  <h2 id="s${i}">${pageUrl ? `<a href="${pageUrl}">${escHtml(label)} ›</a>` : escHtml(label)} <span class="h-n">${nOf(x)}</span></h2>
  <div class="grid">
    ${shown.map(v => fancamCardHtml(v, isEn)).join('\n    ')}
  </div>${pageUrl && nOf(x) > shown.length ? `
  <p class="lead"><a href="${pageUrl}">${isEn ? `All ${nOf(x)} "${songLabel(x.s)}" fancams →` : `'${songLabel(x.s)}' 직캠 ${nOf(x)}개 전체 보기 →`}</a></p>` : ''}`;
  }).join('\n');
  const restHtml = rest.length ? `
  <h2>${isEn ? 'Other fancams' : '그 밖의 직캠'} <span class="h-n">${rest.length}</span></h2>
  <div class="grid">
    ${rest.slice(0, FANCAM_REST_MAX).map(v => fancamCardHtml(v, isEn)).join('\n    ')}
  </div>${rest.length > FANCAM_REST_MAX ? `<p class="note">${isEn ? `Top ${FANCAM_REST_MAX} of ${rest.length}` : `${rest.length}개 중 상위 ${FANCAM_REST_MAX}개`}</p>` : ''}` : '';
  // 같은 그룹 다른 멤버의 직캠 전체 페이지(얼굴 줄)
  const mates = info ? membersOf(gko).filter(m => m !== a && FANCAM_HUB.has(m)).sort((p, q) => FANCAM_HUB.get(q).length - FANCAM_HUB.get(p).length) : []; // 솔로는 '같은 그룹 멤버' 줄 없음
  const matesHtml = mates.length ? `
  <h2>${isEn ? `Other ${gName} members' fancams` : `${gko} 다른 멤버 직캠`}</h2>
  <div class="faces">
    ${mates.map(m => { const mge = (m.groups || []).find(g => g && g.ko === gko); const mn = isEn ? ((mge && mge.nameEn) || m.name.en || m.name.ko) : ((mge && mge.name) || m.name.ko); const img = memberFaceUrl(m, gko);
      return `<a class="face" href="${SITE}/${memberFancamPagePath(m, lang)}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ' class="pf"' : ''} src="${img}" alt="${escHtml(mn)}" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(mn)}</span><span class="face-n">${isEn ? `${FANCAM_HUB.get(m).length} fancams` : `직캠 ${FANCAM_HUB.get(m).length}`}</span></a>`; }).join('\n    ')}
  </div>` : '';
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(title.replace(' | K-POP UNIVERSE', ''))}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${sqOg(ogImage)}">
<meta property="og:image:width" content="${ogSz.w}">
<meta property="og:image:height" content="${ogSz.h}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
<style>.h-n{font-size:12px;font-weight:400;color:rgba(160,180,230,0.6);margin-left:4px;}h2 a{color:inherit;text-decoration:none;}.chips a{color:inherit;text-decoration:none;}.chips a span{color:rgba(160,180,230,0.6);font-size:11px;}h2[id]{scroll-margin-top:12px;}.card-th{position:relative;}.rk{position:absolute;left:6px;top:6px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:rgba(10,14,32,0.82);color:#fff;font-size:12px;font-weight:700;line-height:22px;text-align:center;box-shadow:0 0 0 1px rgba(255,255,255,0.18);}</style>
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var e=((document.querySelector('h1')||{}).textContent||'').trim();gtag('event','seo_land',{entity_name:e,page_type:'member_fancams'});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:e,page_type:'member_fancams'});});});</script>
<script src="/seo_play.js" defer></script>
${LIST_FWD}
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="hero" href="https://www.youtube.com/watch?v=${hero.id}" target="_blank" rel="noopener"><img src="${wideThumb(hero.id)}" alt="${escHtml(hero.title)}"><span class="play"></span><span class="hero-txt"><h1>${escHtml(h1)}</h1><span class="sub">${escHtml(sub)}</span></span></a>
  ${heroCapHtml(hero, isEn)}
  ${factsTag(pageFacts({ vids: fancams, fancams, isEn }))}
  <div class="crumbs">${info ? `<a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(gName)}</a> › ` : ''}<a href="${profileUrl}">${escHtml(mName)}</a> › ${isEn ? 'Fancams' : '직캠'}</div>
  ${songNav}
  ${topGrid ? `
  <h2>${isEn ? `${mName} fancam ranking · Top ${Math.min(FANCAM_RANK_N, fancams.length)}` : `${mName} 직캠 순위 TOP ${Math.min(FANCAM_RANK_N, fancams.length)}`}</h2>
  <div class="grid">
    ${topGrid}
  </div>` : ''}${recentGrid ? `
  <h2>${isEn ? `${mName} fancams popular this year` : `${mName} 최근 1년 인기 직캠`}</h2>
  <div class="grid">
    ${recentGrid}
  </div>` : ''}
${songSections}
${restHtml}
${matesHtml}
  <p class="lead"><a href="${profileUrl}">${isEn ? `${mName} profile →` : `${mName} 프로필 →`}</a></p>
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/#g=${hashEsc(gko)}&m=${hashEsc(a.name.ko)}">${isEn ? 'View all videos in the Universe →' : '직캠·영상 아카이브 보기 →'}</a></div>
  ${nextItemsJson(a, lang)}
</div>
</body>
</html>
`;
}
function buildFancamPages() {
  for (const a of FANCAM_HUB.keys()) {
    for (const lang of ['ko', 'en']) {
      const rel = memberFancamPagePath(a, lang);
      fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
      fs.writeFileSync(path.join(ROOT, rel, 'index.html'), fancamPageHtml(a, lang));
      pages.push({ loc: `${SITE}/${rel}`, priority: '0.7' });
    }
    fancamPageCount++;
  }
  console.log(`멤버 직캠 전체 페이지 ${fancamPageCount}명 × 2개 언어`);
  // 이번에 기준(FANCAM_HUB_MIN) 아래로 내려간 멤버의 옛 직캠 페이지 → 멤버 페이지로 넘김(noindex)
  // (2026-11-12 Codex — 임나영 태그 정정 후에도 옛 /fancams/ 두 주소에 남의 영상 18개가 그대로). 영상 조회가 덜 된 빌드에선 하지 않는다.
  if (FANCAM_HUB.size < 200) { console.log(`직캠 허브 ${FANCAM_HUB.size}명 — 조회가 덜 된 것 같아 옛 허브 정리는 건너뜀`); return; }
  let retired = 0;
  for (const a of artists) {
    if (!a || !a.name || FANCAM_HUB.has(a)) continue;
    for (const lang of ['ko', 'en']) {
      const mp = memberPagePath(a, lang); if (!mp) continue;
      const f = path.join(ROOT, memberFancamPagePath(a, lang), 'index.html');
      if (!fs.existsSync(f) || /http-equiv="refresh"/.test(fs.readFileSync(f, 'utf8').slice(0, 600))) continue;
      const url = `${SITE}/${mp}`, nm = lang === 'en' ? (a.name.en || a.name.ko) : a.name.ko;
      fs.writeFileSync(f, `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><title>${escHtml(nm)} — K-POP UNIVERSE</title>
<link rel="canonical" href="${url}"><meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${url}">
</head><body><a href="${url}">${escHtml(nm)}</a></body></html>
`);
      retired++;
    }
  }
  if (retired) console.log(`기준 아래로 내려간 옛 직캠 페이지 → 멤버 페이지로 넘김 ${retired}개`);
}

// ── 곡·멤버×곡 페이지 공용 화면(2026-10-30 사용자 "썸네일은 하나고 텍스트가 너무 많아 눈에 안 들어온다 — 이미지가 많이 들어가야")
// 예전: 앨범 커버 1장 + 영상 제목 30줄 텍스트 목록. 지금: 대표 영상을 크게(제목을 그 위에), 정보는 칩 한 줄, 영상은 썸네일 카드 그리드,
// 출연 멤버는 얼굴 동그라미(멤버 대표 영상 썸네일), 다른 곡은 앨범 커버 타일. 검색엔진이 읽는 제목·설명·글 내용은 그대로 유지한다.
const ytThumb = (id, q) => `https://i.ytimg.com/vi/${id}/${q || 'hqdefault'}.jpg`;
// 얼굴 원(2026-11-18 사용자 결정) — 카드 프로필 사진으로 통일(어디서든 같은 얼굴로 알아보게). 사진이 없을 때만 대표 직캠 썸네일을 원으로 잘라 쓴다.
// 프로필 사진이면 '#pf' 꼬리표 → 아래 img에 class="pf"(직캠 썸네일용 1.5배 확대를 끈다)
function memberFaceUrl(a, gko) {
  const pf = memberPicUrl(a); if (pf) return pf + '#pf';
  const u = OG_THUMBS.members && (OG_THUMBS.members[`${gko}|${a.name.ko}`] || OG_THUMBS.members[`${a.group.ko}|${a.name.ko}`]);
  const id = u && (String(u).match(/\/vi\/([^/]+)\//) || [])[1];
  return id ? ytThumb(id, 'mqdefault') : null;
}
// 스타일은 저장소의 song-page.css 한 파일(페이지마다 넣으면 3만 쪽 × 5KB) — 바꾸면 SONG_CSS_V를 올릴 것
const SONG_CSS_V = 21;
function songShareVideo(vids) {
  return vids.find(v => (v.category === 'live' || FANCAM_RE.test(v.title || ''))
    && !/\bM\/?V\b|music\s*video|뮤직비디오|\bteaser\b|티저/i.test(v.title || '')) || vids[0];
}
function songLikePageHtml({ gko, info, s, lang, others, member }) {
  const credit = (arr) => (arr || []).map(x => Array.isArray(x) ? x[0] : x).filter(Boolean);
  const isEn = lang === 'en';
  const date = String(s.date || '').replace(/-/g, '.');
  const yr = date.slice(0, 4);
  const gName = isEn ? (info.en || gko) : gko;
  const gFull = isEn ? bilingualLabel(gName,gko) : bilingualLabel(gko,info.en);
  const songLabel = isEn ? (s.enTitle || s.bilingualTitle || s.title) : (s.bilingualTitle || s.title); // 영어 페이지는 영문 제목만(2026-11-12)
  const cr = s.cr || {};
  const L = credit(cr.l), C = credit(cr.c), A = credit(cr.a);
  const ms = member || null;
  const mName = ms ? (isEn ? ms.nmEn : ms.nm) : '';
  const mFull = ms ? (isEn ? bilingualLabel(ms.nmEn,ms.nm) : bilingualLabel(ms.nm,ms.nmEn)) : '';
  // 멤버×곡 '직캠 모음'은 직캠·무대가 먼저, 그 멤버 개인 버전 공식 MV(category mv)는 뒤로(2026-11-17 Codex 검수 — 하니 Hype Boy 대표가 개인 버전 MV(1,120만)라
  // 입덕직캠(395만)보다 위였다). 곡 페이지(그룹 단위)는 MV가 대표인 게 자연스러워 그대로. 조회수 순서는 각 묶음 안에서 유지.
  const vids = ms ? ms.vids.filter(v => v.category !== 'mv').concat(ms.vids.filter(v => v.category === 'mv')) : s.vids;
  const top = vids.slice(0, 30);
  const selfPath = ms ? memberSongPagePath(ms.a, s.b, lang) : songPagePath(gko, s.b, lang);
  const altPath = ms ? memberSongPagePath(ms.a, s.b, isEn ? 'ko' : 'en') : songPagePath(gko, s.b, isEn ? 'ko' : 'en');
  const koPath = ms ? memberSongPagePath(ms.a, s.b, 'ko') : songPagePath(gko, s.b, 'ko');
  const selfUrl = `${SITE}/${selfPath}`, altUrl = `${SITE}/${altPath}`, koUrl = `${SITE}/${koPath}`;
  const songUrl = `${SITE}/${songPagePath(gko, s.b, lang)}`;
  const facts = [];
  if (s.album) facts.push(isEn ? `from ${s.album}${yr ? ` (${yr})` : ''}` : `${s.album}${yr ? `(${yr})` : ''} 수록`);
  if (s.isTitle) facts.push(isEn ? 'title track' : '타이틀곡');
  if (s.wins) facts.push(isEn ? `${s.wins} music show wins` : `음악방송 1위 ${s.wins}회`);
  let title, desc, h1, sub;
  if (ms) {
    // 멤버 이름은 영·한 같이 맨 앞에(2026-11-11 — 네이버 결과에서 영문 페이지 제목이 'Youngjae …'만 보이고 한글 이름은 끝에서 잘렸다)
    // 그룹 + 이름(2026-11-11 사용자 — 영재는 갓세븐·B.A.P에도 있다. 음방 직캠 제목 관례 '투어스 영재 … (TWS YOUNGJAE FanCam)')
    const whoFull = isEn ? bilingualLabel(`${gName} ${ms.nmEn}`, `${gko} ${ms.nm}`) : bilingualLabel(`${gko} ${ms.nm}`, `${info.en || gko} ${ms.nmEn}`);
    title = isEn ? `${whoFull} - ${songLabel} Fancams | K-POP UNIVERSE` : `${whoFull} - ${songLabel} 직캠 모음 | K-POP UNIVERSE`;
    desc = isEn ? `${gFull} ${mFull} "${songLabel}" fancams and face cams — ${vids.length} videos, most viewed first. ${facts.join(', ')}.`
                : `${gko} ${mName} '${songLabel}' 직캠·페이스캠 ${vids.length}개를 조회수 순으로 모았어요. ${facts.join(', ')}.`;
    h1 = isEn ? `${mFull} "${songLabel}" Fancams` : `${mFull} '${songLabel}' 직캠`;
    sub = isEn ? `${gFull} · ${vids.length} fancams` : `${gFull} · 직캠 ${vids.length}개`;
  } else {
    // 아티스트가 먼저, 곡이 뒤(2026-11-17 사용자 "웬만하면 아티스트 - 곡"). 멤버×곡·앨범·그룹 제목은 이미 그 순서였고 곡 페이지만 반대였다.
    title = isEn ? `${gFull} - ${songLabel} Fancams & Stages | K-POP UNIVERSE` : `${gFull} - ${songLabel} 직캠·무대 모음 | K-POP UNIVERSE`;
    desc = isEn
      ? `${gName} "${songLabel}" — ${facts.join(', ')}. ${s.vids.length} fancams and stage videos, most viewed first${L.length ? `, lyrics by ${L.slice(0, 3).join(', ')}` : ''}.`
      : `${gko} '${songLabel}' — ${facts.join(', ')}. 직캠·무대 영상 ${s.vids.length}개를 조회수 순으로${L.length ? `, 작사 ${L.slice(0, 3).join(', ')}` : ''}.`;
    h1 = songLabel;
    sub = `${gFull}${s.isTitle ? (isEn ? ' · Title track' : ' · 타이틀곡') : ''}`;
  }
  // 본문 대표도 16:9로(2026-11-18 Codex — 네이버가 본문 hqdefault(4:3, 위아래 검은 띠)를 검색 썸네일로 집어 갔다. OG만 바꿨던 것)
  const heroImage = top[0] ? wideThumb(top[0].id) : ogImageForGroup(gko, info);
  const preview = songShareVideo(vids);
  // 대표 영상이 없을 때 예전엔 hqdefault(4:3, 16:9 영상은 위아래 검은 띠가 이미지에 박혀 있음)를 그대로 og:image로 썼다 — 16:9 썸네일로
  const ogImage = preview ? wideThumb(preview.id) : (top[0] ? wideThumb(top[0].id) : heroImage), ogSz = ogSizeFor(ogImage);
  const jsonLd = ms ? {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: selfUrl, description: desc,
    about: [{ '@type': 'Person', name: mName, url: `${SITE}/${memberPagePath(ms.a, lang)}` }, { '@type': 'MusicRecording', name: songLabel, url: songUrl, byArtist: { '@type': 'MusicGroup', name: gName } }],
    mainEntity: { '@type': 'ItemList', itemListElement: top.slice(0, 10).map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://www.youtube.com/watch?v=${v.id}`, name: v.title })) },
  } : {
    '@context': 'https://schema.org', '@type': 'MusicRecording', name: songLabel, url: selfUrl,
    byArtist: { '@type': 'MusicGroup', name: gName, url: `${SITE}/${groupPagePath(gko, lang)}` },
    inAlbum: s.album ? { '@type': 'MusicAlbum', name: s.album } : undefined,
    datePublished: s.date ? String(s.date).replace(/\./g, '-').slice(0, 10) : undefined,
    lyricist: L.length ? L.map(n => ({ '@type': 'Person', name: n })) : undefined,
    composer: C.length ? C.map(n => ({ '@type': 'Person', name: n })) : undefined,
  };
  // 출연 멤버 얼굴 줄 — 곡 페이지: 이 곡 영상에 태그된 횟수 순, 개인 직캠 페이지가 있으면 그리로. 멤버×곡 페이지: 같은 곡의 다른 멤버 직캠
  const msList = MEMBER_SONGS_BY_SONG.get(gko + '|' + s.b) || [];
  const msOf = new Map(msList.map(x => [x.a, x]));
  let faces = [];
  if (ms) faces = msList.filter(x => x.a !== ms.a).map(x => ({ a: x.a, nm: isEn ? x.nmEn : x.nm, href: `${SITE}/${memberSongPagePath(x.a, s.b, lang)}`, n: x.vids.length }));
  else {
    const byName = new Map(); membersOf(gko).forEach(a => { byName.set(a.name.ko, a); const ge = (a.groups || []).find(g => g && g.ko === gko); if (ge && ge.name) byName.set(ge.name, a); });
    const cnt = new Map(); s.vids.forEach(v => (v.members || []).forEach(n => { const a = byName.get(n); if (a) cnt.set(a, (cnt.get(a) || 0) + 1); }));
    faces = [...cnt.entries()].sort((x, y) => y[1] - x[1]).map(([a]) => { const x = msOf.get(a); const ge = (a.groups || []).find(g => g && g.ko === gko);
      return { a, nm: isEn ? ((ge && ge.nameEn) || a.name.en || a.name.ko) : ((ge && ge.name) || a.name.ko), href: x ? `${SITE}/${memberSongPagePath(a, s.b, lang)}` : `${SITE}/${memberPagePath(a, lang)}`, n: x ? x.vids.length : 0 }; });
  }
  const facesHtml = faces.length ? `
  <h2>${ms ? (isEn ? `Other members' "${songLabel}" fancams` : `다른 멤버 '${songLabel}' 직캠`) : (isEn ? 'Members in these videos' : '영상에 나온 멤버')}</h2>
  <div class="faces">
    ${faces.map(f => { const img = memberFaceUrl(f.a, gko); return `<a class="face" href="${f.href}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ' class="pf"' : ''} src="${img}" alt="${escHtml(f.nm)}" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(f.nm)}</span>${f.n ? `<span class="face-n">${isEn ? `${f.n} fancams` : `직캠 ${f.n}`}</span>` : ''}</a>`; }).join('\n    ')}
  </div>` : '';
  const chip = (k, v) => v ? `<li><b>${k}</b>${escHtml(v)}</li>` : '';
  // 앨범 이름은 그 앨범 페이지로 간다(2026-11-21 사용자 "앨범 이름 누르면 앨범 페이지 나와야지") — 앨범 페이지가 없는 앨범(제목 불일치)은 글자만
  const albumChip = (() => { if (!s.album) return ''; let h = ''; try { const x = albumsFor(gko).find(y => y.al.title === s.album); const pth = x && albumPagePath(gko, x.slug, lang); if (pth) h = SITE + '/' + pth; } catch (e) {} return h ? `<li><b>${isEn ? 'Album' : '앨범'}</b><a class="chip-go" href="${h}">${escHtml(s.album)}</a></li>` : chip(isEn ? 'Album' : '앨범', s.album); })();
  const chipsHtml = `<ul class="chips">
    ${chip(isEn ? 'Release' : '발매', date)}${albumChip}${s.wins ? `<li><b>${isEn ? 'Music show wins' : '음악방송 1위'}</b>${s.wins}${isEn ? '' : '회'}</li>` : ''}${coverChipsHtml(gko, s, lang)}
  </ul>`;
  // 크레딧(2026-11-12 사용자 "작사작곡은 뭔 기준? 작사인지 작곡인지 구분, 단독도 따로"): 예전엔 '작사 A, B…(6명) 작곡 A, B…(6명)'을 페이지 맨 아래
  // '다른 곡' 타일 밑에 붙여서 어느 곡 얘기인지, 누가 무엇을 했는지 안 읽혔다. 이제 이 곡 기준으로 사람마다 한 칩: 이름 + 역할(작사·작곡·편곡),
  // 그 역할을 혼자 했으면 '단독 작사'. 멜론 곡 크레딧(cr) 그대로, 제목 아래 정보 칩 바로 다음.
  const people = []; const pIdx = new Map();
  [['l', L], ['c', C], ['a', A]].forEach(([k, arr]) => arr.forEach(n => { if (!pIdx.has(n)) { pIdx.set(n, people.length); people.push({ n, r: new Set() }); } people[pIdx.get(n)].r.add(k); }));
  const RL = isEn ? { l: 'Lyrics', c: 'Music', a: 'Arrangement', solo: 'Sole ' } : { l: '작사', c: '작곡', a: '편곡', solo: '단독 ' };
  const soloOf = { l: L.length === 1, c: C.length === 1, a: A.length === 1 };
  const roleTxt = p => ['l', 'c', 'a'].filter(k => p.r.has(k)).map(k => (soloOf[k] ? RL.solo : '') + RL[k]).join(' · ');
  // 알약 테두리는 눌러지는 것처럼 보여서(2026-11-17 사용자) 역할별 한 줄 글자로. 우리 아티스트만 점선 밑줄 링크 → 그 사람 작사·작곡 곡 목록.
  const CR_PER = 8;
  const crName = n => { const ca = creditArtistFor(s.b, n); const href = ca ? creditPagePath(ca, lang) : ''; return href ? '<a class="cr-a" href="' + SITE + '/' + href + '">' + escHtml(n) + '</a>' : '<span>' + escHtml(n) + '</span>'; };
  const crRow = (k, arr) => arr.length ? '<p class="cr-row"><span class="cr-r">' + (soloOf[k] ? RL.solo : '') + RL[k] + '</span>' + arr.slice(0, CR_PER).map(crName).join(', ') + (arr.length > CR_PER ? (isEn ? ' +' + (arr.length - CR_PER) + ' more' : ' 외 ' + (arr.length - CR_PER) + '명') : '') + '</p>' : '';
  const creditsHtml = people.length ? '<div class="credits"><b class="credits-h">' + (isEn ? 'Credits' : '크레딧') + '</b>' + crRow('l', L) + crRow('c', C) + crRow('a', A) + '</div>' : '';
  const grid = top.slice(1).map(v => `<a class="card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="card-th"><img src="${ytThumb(v.id, 'mqdefault')}" alt="" loading="lazy"></span><span class="card-t">${escHtml(v.title)}</span><span class="card-y">${[v.published_at ? String(v.published_at).slice(0, 10).replace(/-/g, '.') : '', v.view_count ? SEO.fmtVC(v.view_count) : ''].filter(Boolean).join(' · ')}</span></a>`).join('\n    ');
  // 멤버×곡 페이지엔 '그룹의 다른 곡'을 싣지 않는다 — 곡 페이지에 있고, 1만 쪽에 같은 타일을 반복하면 용량만 커진다
  // 다른 곡 — 앨범별로 묶어 커버 한 번 + 그 아래 수록곡 목록(2026-11-12 사용자 "같은 커버가 10장씩 반복돼 정신 사납다, 앨범 썸네일 아래에 곡 정보 쭉").
  // 앨범 순서는 그 앨범 곡들의 영상 수 합, 앨범 안은 영상 많은 순(예전 타일 순서와 같은 기준).
  const albumGroups = [];
  if (!ms) {
    const byAl = new Map();
    // 2026-11-17 사용자 "검색한 곡이 아닌 같은 팀의 다른 곡 페이지가 뜬다" — 곡 페이지 본문이 짧은데(실측 위너 SOSO 1,274자) 같은 팀 곡 제목
    // 19개가 통째로 들어 있어 다른 곡 검색어에 걸렸다. 영상 많은 상위 OTHER_MAX곡만 싣고, 나머진 아래 '전체 곡' 링크(그룹 페이지)로 —
    // 그룹 페이지가 곡 페이지 대부분을 이미 링크하니(위너 24/31) 크롤 경로는 그대로다.
    const OTHER_MAX = 6;
    (others || []).slice().sort((p, q) => q.vids.length - p.vids.length).slice(0, OTHER_MAX).forEach(o => { const k = o.album || o.title; if (!byAl.has(k)) { byAl.set(k, { name: o.album || '', cover: o.cover || '', date: String(o.date || '').slice(0, 4), songs: [], n: 0 }); albumGroups.push(byAl.get(k)); } const g = byAl.get(k); g.songs.push(o); g.n += o.vids.length; if (!g.cover && o.cover) g.cover = o.cover; });
    albumGroups.sort((x, y) => y.n - x.n);
  }
  // 다른 곡 섹션의 앨범 커버·제목 → 그 앨범 트랙리스트 페이지(2026-11-17 사용자). 앨범 페이지가 실제로 만들어지는 목록(albumsFor)에서 앨범명으로 찾는다.
  const albumHref = name => { if (!name) return ''; try { const x = albumsFor(gko).find(y => y.al.title === name); return x ? SITE + '/' + albumPagePath(gko, x.slug, lang) : ''; } catch (e) { return ''; } };
  const songName = o => isEn ? (o.enTitle || o.bilingualTitle || o.title) : (o.bilingualTitle || o.title);
  const otherTiles = albumGroups.length ? '\n  <h2>' + (isEn ? 'More songs by ' + escHtml(gName) : escHtml(gko) + '의 다른 곡') + '</h2>\n  <div class="sp-albums">\n    '
    + albumGroups.map(g => { const aHref = albumHref(g.name), aOpen = aHref ? '<a class="sp-al-a" href="' + aHref + '">' : '', aClose = aHref ? '</a>' : ''; return '<div class="sp-al">' + aOpen + (g.cover ? '<img class="sp-al-c" src="' + escHtml(g.cover) + '" alt="' + escHtml(g.name) + '" loading="lazy">' : '<span class="sp-al-c sp-tile-ph"></span>') + aClose
      + '<div class="sp-al-h">' + (g.name ? aOpen + '<b>' + escHtml(g.name) + '</b>' + aClose : '') + (g.date ? '<span>' + g.date + '</span>' : '') + '</div><ol class="sp-al-l">'
      + g.songs.map(o => '<li><a href="' + SITE + '/' + songPagePath(gko, o.b, lang) + '"><span class="t">' + escHtml(songName(o)) + '</span><span class="n">' + (isEn ? o.vids.length + ' videos' : '영상 ' + o.vids.length) + '</span></a></li>').join('')
      + '</ol></div>'; }).join('\n    ') + '\n  </div>'
      + '\n  <p class="lead"><a href="' + SITE + '/' + groupPagePath(gko, lang) + '">' + (isEn ? 'All ' + escHtml(gName) + ' songs, fancams &amp; stages →' : escHtml(gko) + ' 전체 곡·직캠·무대 보기 →') + '</a></p>' : '';
  // 멤버×곡 ↔ 멤버 직캠 전체 페이지 오가기(2026-11-11) — 위에 '← 직캠 전체', 아래에 같은 멤버의 다른 곡 직캠
  const hubUrl = ms && FANCAM_HUB.has(ms.a) ? `${SITE}/${memberFancamPagePath(ms.a, lang)}` : '';
  const hubTotal = hubUrl ? FANCAM_HUB.get(ms.a).length : 0;
  const mySongs = ms ? (MEMBER_SONGS_BY_ARTIST.get(ms.a) || []).filter(x => x.s.b !== s.b) : [];
  const mySongsHtml = mySongs.length ? `
  <h2>${isEn ? `${mName}'s other fancams by song` : `${mName} 다른 곡 직캠`}</h2>
  <div class="sp-tiles">
    ${mySongs.slice(0, 16).map(x => `<a class="sp-tile" href="${SITE}/${memberSongPagePath(ms.a, x.s.b, lang)}">${x.s.cover ? `<img src="${escHtml(x.s.cover)}" alt="" loading="lazy">` : `<span class="sp-tile-ph"></span>`}<span class="sp-tile-t">${escHtml(x.s.bilingualTitle || x.s.title)}</span><span class="sp-tile-n">${isEn ? `${x.n} fancams` : `직캠 ${x.n}`}</span></a>`).join('\n    ')}
  </div>${hubUrl ? `
  <p class="lead"><a href="${hubUrl}">${isEn ? `All ${hubTotal} ${mName} fancams by song →` : `${mName} 직캠 전체 ${hubTotal}개 보기 →`}</a></p>` : ''}` : hubUrl ? `
  <p class="lead"><a href="${hubUrl}">${isEn ? `All ${hubTotal} ${mName} fancams by song →` : `${mName} 직캠 전체 ${hubTotal}개 보기 →`}</a></p>` : '';
  // '이어서' 카드(2026-11-12) — 정적 페이지 유입의 70%가 곡 페이지인데 재생 화면 '이어서'는 기본 카드 1개뿐이었다.
  // 멤버 페이지 nextItemsJson과 같은 모양({k,t,s,img|im,h,m}), 링크는 앱 딥링크라 누르면 그 화면이 바로 열린다.
  const songNext = (() => {
    const topV = vs => (vs || []).slice().sort((p, q) => (q.view_count || 0) - (p.view_count || 0))[0];
    const memItem = (x, title) => { const v = topV(x.vids); const nm = isEn ? x.nmEn : x.nm;
      return { k: isEn ? 'Member fancams' : '멤버 직캠', t: `${nm} · ${title}`, s: isEn ? `${x.vids.length} fancams` : `직캠 ${x.vids.length}개`, img: v ? v.id : '', m: title, h: `${SITE}/${memberSongPagePath(x.a, s.b, lang)}` }; };
    const grpItem = () => { const gi = groupFaceUrl(gko) || ogImageForGroup(gko, info);
      return { k: isEn ? 'Group' : '그룹', t: gName, s: isEn ? 'Stages · MVs · members' : '무대 · 뮤비 · 멤버', im: /og-image\.png$/.test(gi) ? '' : gi.replace('/maxresdefault.', '/mqdefault.').replace('/hq720.', '/mqdefault.'), h: `${SITE}/${groupPagePath(gko, lang)}` }; };
    const items = [];
    if (ms) {
      const mate = msList.filter(x => x.a !== ms.a).sort((p, q) => q.vids.length - p.vids.length)[0];
      if (mate) items.push(memItem(mate, s.title));
      const o = (MEMBER_SONGS_BY_ARTIST.get(ms.a) || []).filter(x => x.s.b !== s.b)[0];
      if (o) { const om = (MEMBER_SONGS_BY_SONG.get(gko + '|' + o.s.b) || []).find(y => y.a === ms.a); const v = om && topV(om.vids);
        items.push({ k: isEn ? 'Another song' : '다른 곡', t: `${mName} · ${o.s.title}`, s: isEn ? `${o.n} fancams` : `직캠 ${o.n}개`, img: v ? v.id : '', m: o.s.title, h: `${SITE}/${memberSongPagePath(ms.a, o.s.b, lang)}` }); }
      const sv = topV(s.vids);
      items.push({ k: isEn ? 'Whole song' : '곡 전체', t: s.title, s: isEn ? `${s.vids.length} fancams & stages` : `직캠·무대 ${s.vids.length}개`, img: sv ? sv.id : '', h: `${SITE}/${songPagePath(gko, s.b, lang)}` });
      items.push(grpItem());
    } else {
      msList.slice().sort((p, q) => q.vids.length - p.vids.length).slice(0, 2).forEach(x => items.push(memItem(x, s.title)));
      const o = (others || []).find(x => x.b !== s.b);
      if (o) items.push({ k: isEn ? 'Another song' : '다른 곡', t: o.title, s: isEn ? `${o.vids.length} videos` : `영상 ${o.vids.length}개`, im: o.cover || '', h: `${SITE}/${songPagePath(gko, o.b, lang)}` });
      items.push(grpItem());
    }
    return `<script type="application/json" id="kpu-next">${JSON.stringify(items).replace(/</g, '\\u003c')}</script>`;
  })();
  const crumbs = ms
    ? `<div class="crumbs crumbs-row"><span class="crumbs-path"><a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(gName)}</a> › <a href="${SITE}/${memberPagePath(ms.a, lang)}">${escHtml(mName)}</a> › <a href="${songUrl}">${escHtml(s.bilingualTitle || s.title)}</a></span>${hubUrl ? `<a class="hub-all" href="${hubUrl}">${isEn ? `← All ${mName} fancams (${hubTotal})` : `← ${mName} 직캠 전체 (${hubTotal})`}</a>` : ''}</div>`
    : `<div class="crumbs"><a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(gName)}</a> › ${(() => {
      // 곡 → 앨범 링크(2026-11-17 링크 점검: 앨범 페이지는 곡을 링크하는데 곡 페이지는 앨범을 안 링크했다 — 일방통행).
      // 이 곡이 수록된 앨범(같은 앨범명 우선, 없으면 첫 번째)의 트랙리스트 페이지로. 앨범 페이지가 실제로 만들어지는 목록(albumsFor)에서만 찾는다.
      try {
        const als = albumsFor(gko).filter(x => (x.al.tracks || []).some(t => t && t.title && _CRED_SB(t.title) === s.b));
        const alb = als.find(x => x.al.title === s.album) || als[0];
        return alb ? `<a href="${SITE}/${albumPagePath(gko, alb.slug, lang)}">${escHtml(alb.al.title)}</a> › ` : '';
      } catch (e) { return ''; }
    })()}${escHtml(s.title)}</div>`;
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="${ms ? 'website' : 'music.song'}">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(title.replace(' | K-POP UNIVERSE', ''))}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${sqOg(ogImage)}">
<meta property="og:image:width" content="${ogSz.w}">
<meta property="og:image:height" content="${ogSz.h}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var e=((document.querySelector('h1')||{}).textContent||'').trim();gtag('event','seo_land',{entity_name:e,page_type:'${ms ? 'member_song' : 'song'}'});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:e,page_type:'${ms ? 'member_song' : 'song'}'});});});</script>
<script src="/seo_play.js" defer></script>
${LIST_FWD}
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  ${crumbs}
  ${top[0] ? `<a class="hero" href="https://www.youtube.com/watch?v=${top[0].id}" target="_blank" rel="noopener"><img src="${heroImage}" alt="${escHtml(top[0].title)}"><span class="play"></span><span class="hero-txt"><h1>${escHtml(h1)}</h1><span class="sub">${escHtml(sub)}</span></span></a>${heroCapHtml(top[0], isEn)}`
           : `<h1>${escHtml(h1)}</h1>`}
  ${chipsHtml}
  ${facesHtml}
  ${top.length > 1 ? `
  <h2>${ms ? (isEn ? 'Most viewed fancams' : '조회수 많은 직캠') : (isEn ? 'Most viewed fancams & stages' : '조회수 많은 직캠·무대')}</h2>
  ${vids.length > 8 ? '<div class="kpu-sortbar" id="kpu-sortbar" style="display:none"></div>' : ''}
  <div class="grid"${vids.length > 8 ? ' id="kpu-grid"' : ''}>
    ${grid}
  </div>` : ''}
  ${vids.length > top.length ? `<p class="note" id="kpu-vnote">${isEn ? `Top ${top.length} of ${vids.length} videos` : `영상 ${vids.length}개 중 상위 ${top.length}개`}</p>` : ''}
  ${vids.length > 8 && top.length > 1 ? vidsDataScript(vids) : ''}
  ${ms ? `
  <h2>${isEn ? `All "${songLabel}" videos` : `'${songLabel}' 전체 영상`}</h2>
  <p class="lead"><a href="${songUrl}">${escHtml(isEn ? `${gName} "${songLabel}" fancams & stages (${s.vids.length})` : `${gko} '${songLabel}' 직캠·무대 모음 (${s.vids.length}개)`)} ›</a></p>${mySongsHtml}` : ''}
  ${creditsHtml}
  ${otherTiles}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/#g=${hashEsc(gko)}${ms ? '&m=' + hashEsc(ms.a.name.ko) : ''}&song=${hashEsc(s.title)}">${isEn ? 'View videos in the Universe →' : '직캠·영상 아카이브 보기 →'}</a></div>
</div>
${songNext}
</body>
</html>
`;
}

// ── 직캠 조회수 순위 페이지(2026-10-30, 검색 유입 — "아이돌 직캠 조회수 순위"·"2026 직캠 순위"·"여자 아이돌 직캠 순위") ────────────
// 개인 직캠 = 멤버 한 명만 태깅 + 제목에 직캠 표시(memberFancams와 같은 기준). 쇼츠는 VIDS에 없다(곡 페이지와 같은 데이터).
// 경로: rank/fancam/ · rank/fancam/girls/ · rank/fancam/boys/ · rank/fancam/{연도}/ (+ en/). 각 TOP 100, 카드에 순위·멤버(→멤버 직캠 모음)·조회수.
const RANK_TOP = 100;
let RANK_LINKS = { ko: [], en: [] }; // 허브(g/)에 싣는 순위 페이지 목록
function rankPagePath(slug, lang) { return `${lang === 'en' ? 'en/' : ''}rank/fancam/${slug ? slug + '/' : ''}`; }

// ── 정적 페이지 모아보기 /all/ (2026-11-18 사용자 "정적 페이지가 너무 많아 하나하나 보기 힘들다 — 다 한 데 정리한 페이지, 다른 유저도 보게, 나무위키 느낌,
//    디자인은 원래 정적 페이지처럼, 이미지 잘 활용해서"). 빌드 마지막에 실제로 만든 페이지 주소(pages·관계 페이지)를 종류별로 세고 묶는다 —
//    목록을 손으로 적지 않으니 새 종류가 생겨도 개수가 저절로 맞는다. 맨 위 인기 직캠(썸네일)·그룹(프로필 원형 사진)은 이미지로, 나머지는 칩 목록.
function buildAllIndexPages(relPages) {
  const allLocs = [...pages.map(x => x.loc), ...(relPages || []).map(x => x.loc)];
  for (const lang of ['ko', 'en']) {
    const isEn = lang === 'en', pre = SITE + '/' + (isEn ? 'en/' : '');
    const locs = allLocs.filter(u => u.startsWith(pre) && (isEn || !u.startsWith(SITE + '/en/')));
    const rel = u => decodeURIComponent(u.slice(pre.length));
    const pick = re => locs.map(u => { const m = re.exec(rel(u)); return m ? { u, m } : null; }).filter(Boolean);
    const cnt = re => locs.filter(u => re.test(rel(u))).length;
    const T = (ko, en) => isEn ? en : ko;
    const fmt = n => n.toLocaleString(isEn ? 'en-US' : 'ko-KR');
    // 종류별 묶음
    const groupKos = Object.keys(groups).filter(k => groups[k] && !groups[k].unit).sort((a, c) => ((groups[c].pri || 0) - (groups[a].pri || 0)) || a.localeCompare(c, 'ko'));
    const shows = pick(/^show\/([^/]+)\/$/), wins = pick(/^wins\/(\d{4})\/$/), born = pick(/^idols\/born\/(\d{4})\/$/);
    const agencies = pick(/^agency\/([^/]+)\/$/), progs = pick(/^p\/([^/]+)\/$/), covers = pick(/^cover\/([^/]+)\/$/), collabs = pick(/^collab\/([^/]+)\/$/);
    const awards = pick(/^awards\/([^/]+)\/$/);
    const nMember = cnt(/^g\/[^/]+\/[^/]+\/$/) + cnt(/^member\/[^/]+\/$/);
    const nSong = cnt(/\/s\/[^/]+\/$/), nAlbum = cnt(/\/a\/[^/]+\/$/), nFancam = cnt(/\/fancams\/$/), nCredit = cnt(/\/credits\/$/);
    const nChem = cnt(/^chem\//), nShowEp = cnt(/^show\/[^/]+\/\d{4}-\d\d-\d\d\/$/);
    const total = locs.length;
    const chipList = (arr, label, max) => `<ul class="all-chips">${arr.slice(0, max || 999).map(x => `<li><a href="${x.u}">${escHtml(label ? label(x) : x.m[1])}</a></li>`).join('')}${arr.length > (max || 999) ? `<li class="more">${T('외 ' + fmt(arr.length - max) + '개', '+' + fmt(arr.length - max) + ' more')}</li>` : ''}</ul>`;
    // 칩이 길게 늘어지는 섹션은 앞쪽만 보이고 나머지는 '더 보기'로 접는다(2026-11-21 사용자 "2025 밑으로는 더 보기, 생년도 89년생부터는 더 보기") — 스크립트 없이 <details>
    const foldChips = (items, render, keep) => { const li = x => `<li>${render(x)}</li>`; const head = items.filter(keep), rest = items.filter(x => !keep(x));
      return `<ul class="all-chips">${head.map(li).join('')}</ul>` + (rest.length ? `<details class="all-fold"><summary>${T('더 보기', 'More')} ${rest.length}</summary><ul class="all-chips">${rest.map(li).join('')}</ul></details>` : ''); };
    const sec = (id, title, sub, body, more) => `<section class="all-sec" id="${id}"><div class="all-sec-hd"><h2>${title}</h2>${sub ? `<span class="all-sec-n">${sub}</span>` : ''}${more ? `<a class="all-more" href="${more}">${T('전체 보기', 'View all')} ›</a>` : ''}</div>${body}</section>`;
    // 맨 위: 요즘 인기 직캠(최근 90일·그룹당 하나 — buildRankPages에서 고른다)
    const seen = new Set(), topCams = [];
    for (const x of RANK_TOP_FOR_ALL) { const k = x.gko + '|' + x.a.name.ko; if (seen.has(k)) continue; seen.add(k); topCams.push(x); if (topCams.length >= 8) break; }
    const camCards = topCams.map(x => { const ge = (x.a.groups || []).find(g => g && g.ko === x.gko); const nm = isEn ? ((ge && ge.nameEn) || x.a.name.en || x.a.name.ko) : ((ge && ge.name) || x.a.name.ko); const href = SITE + '/' + (FANCAM_HUB.has(x.a) ? memberFancamPagePath(x.a, lang) : memberPagePath(x.a, lang));
      return `<a class="card" href="${href}"><span class="card-th"><img src="${wideThumb(x.v.id)}" alt="" loading="lazy"></span><span class="card-t">${escHtml(nm)}</span><span class="card-m">${escHtml(isEn ? (groups[x.gko].en || x.gko) : x.gko)} · ${SEO.fmtViews(x.v.view_count, isEn)}</span></a>`; }).join('');
    // 그룹: 프로필 원형 사진(없으면 대표 썸네일)
    // 그룹 줄은 가나다순 앞 48팀이 아니라 만들 때마다 무작위 48팀(2026-11-21 사용자 "디폴트가 가나다순 — 랜덤이 어때") — 늘 같은 팀만 보이지 않게. 전체는 '전체 보기'(/g/)
    const gPick = groupKos.slice(); for (let i = gPick.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [gPick[i], gPick[j]] = [gPick[j], gPick[i]]; }
    const gFaces = gPick.slice(0, 48).map(k => { const img = groupFaceUrl(k) || ogImageForGroup(k, groups[k]); return `<a class="face" href="${SITE}/${groupPagePath(k, lang)}"><span class="face-img"><img src="${img}" alt="" loading="lazy"></span><span class="face-n">${escHtml(isEn ? (groups[k].en || k) : k)}</span></a>`; }).join('');
    const stats = [[fmt(groupKos.length), T('그룹', 'groups')], [fmt(nMember), T('멤버·솔로', 'artists')], [fmt(nSong), T('곡', 'songs')], [fmt(nAlbum), T('앨범', 'albums')], [fmt(nFancam), T('직캠 모음', 'fancam hubs')], [fmt(nShowEp), T('음방 회차', 'show episodes')]]
      .map(([n, l]) => `<li><b>${n}</b><span>${l}</span></li>`).join('');
    const nav = [['top-cams', T('최근 직캠', 'Recent')], ['groups', T('그룹', 'Groups')], ['ranks', T('직캠 순위', 'Fancam rankings')], ['shows', T('음악방송', 'Music shows')], ['wins', T('1위 기록', 'Wins')], ['born', T('생년', 'Birth years')], ['agency', T('기획사', 'Agencies')], ['programs', T('프로그램', 'Programs')], ['relations', T('커버·콜라보', 'Covers & collabs')], ['awards', T('시상식', 'Awards')]]
      .map(([id, l]) => `<li><a href="#${id}">${l}</a></li>`).join('');
    const h1 = T('K-POP UNIVERSE 모아보기', 'Browse K-POP UNIVERSE');
    const desc = T(`그룹 ${fmt(groupKos.length)}팀·멤버 ${fmt(nMember)}명·곡 ${fmt(nSong)}곡·직캠과 음악방송·1위 기록까지, K-POP UNIVERSE의 정적 페이지 ${fmt(total)}개를 종류별로 한눈에.`,
      `All ${fmt(total)} pages of K-POP UNIVERSE in one place — ${fmt(groupKos.length)} groups, ${fmt(nMember)} artists, ${fmt(nSong)} songs, fancams, music shows and wins.`);
    const selfUrl = pre + 'all/', altUrl = SITE + '/' + (isEn ? '' : 'en/') + 'all/';
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(h1)} | K-POP UNIVERSE</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${lang}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${SITE}/all/">
<meta property="og:type" content="website"><meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(h1)}"><meta property="og:description" content="${escHtml(desc)}"><meta property="og:url" content="${selfUrl}">
${topCams[0] ? `<meta property="og:image" content="${sqOg(wideThumb(topCams[0].v.id))}">` : ''}
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
<style>
  .all-stats{display:flex;flex-wrap:wrap;gap:10px 22px;list-style:none;padding:0;margin:4px 0 18px;}
  .all-stats li{display:flex;align-items:baseline;gap:6px;color:rgba(190,205,240,0.75);font-size:13.5px;}
  .all-stats b{color:#fff;font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;}
  .all-nav{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:0 0 10px;position:sticky;top:0;z-index:4;background:rgba(10,10,13,0.92);padding:10px 0;backdrop-filter:blur(8px);}
  .all-nav a{display:inline-block;font-size:13px;padding:6px 12px;border-radius:999px;background:rgba(150,175,255,0.08);border:0.5px solid rgba(150,175,255,0.2);color:rgba(210,222,255,0.9);text-decoration:none;}
  .all-sec{padding-top:26px;margin-top:8px;border-top:0.5px solid rgba(255,255,255,0.08);scroll-margin-top:56px;}
  .all-sec-hd{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;}
  .all-sec-hd h2{margin:0;font-size:19px;}
  .all-sec-n{color:rgba(160,180,230,0.65);font-size:13px;}
  .all-sec .card-t{font-weight:600;-webkit-line-clamp:1;}
  .all-sec .card-m{display:block;margin-top:2px;font-size:12px;color:rgba(160,180,230,0.66);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .all-more{margin-left:auto;font-size:13px;color:rgba(170,195,255,0.85);text-decoration:none;white-space:nowrap;}
  .all-chips{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0;margin:0;}
  .all-chips a{display:inline-block;font-size:13px;padding:5px 11px;border-radius:999px;background:rgba(150,175,255,0.07);border:0.5px solid rgba(150,175,255,0.16);color:rgba(210,222,255,0.88);text-decoration:none;}
  .all-chips a:hover,.all-nav a:hover{background:rgba(150,175,255,0.16);}
  .all-fold{margin-top:8px;}
  .all-fold summary{display:inline-block;list-style:none;cursor:pointer;font-size:13px;color:rgba(170,195,255,0.85);padding:6px 2px;}
  .all-fold summary::-webkit-details-marker{display:none;}
  .all-fold summary::after{content:" ›";}
  .all-fold[open] summary{display:none;}
  .all-chips .more{font-size:12.5px;color:rgba(160,180,230,0.6);padding:5px 4px;}
  .all-groups{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:16px 10px;}
  .all-groups .face{width:auto;}
  .all-groups .face-img{width:72px;height:72px;}
  .all-groups .face-img img{transform:none;}
  .face-n{display:block;font-size:12.5px;color:rgba(215,226,255,0.88);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .all-note{font-size:13px;color:rgba(170,188,230,0.7);margin:10px 0 0;}
  @media(max-width:700px){.all-nav{position:static;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;padding:6px 0 10px;}.all-nav li{flex:0 0 auto;}.all-groups{grid-template-columns:repeat(auto-fill,minmax(76px,1fr));}.all-groups .face-img{width:64px;height:64px;}}
</style>
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1 class="rank-h1">${escHtml(h1)}</h1>
  <ul class="all-stats">${stats}</ul>
  <ul class="all-nav">${nav}</ul>
  ${camCards ? sec('top-cams', T('최근 인기 직캠', 'Recent top fancams'), '', `<div class="grid">${camCards}</div>`, SITE + '/' + rankPagePath('', lang)) : ''}
  ${sec('groups', T('그룹', 'Groups'), T(fmt(groupKos.length) + '팀', fmt(groupKos.length) + ' groups'), `<div class="all-groups">${gFaces}</div><p class="all-note">${T('그룹 페이지마다 멤버·곡별 직캠·앨범·작사작곡 페이지로 이어져요. 멤버 페이지 ' + fmt(nMember) + '개 · 곡 ' + fmt(nSong) + ' · 앨범 ' + fmt(nAlbum) + ' · 작사·작곡 ' + fmt(nCredit), 'Each group page links to members, fancams by song, albums and credits.')}</p>`, SITE + '/' + (isEn ? 'en/' : '') + 'g/')}
  ${(RANK_LINKS[lang] || []).length ? sec('ranks', T('직캠 순위', 'Fancam rankings'), '', foldChips(RANK_LINKS[lang], x => `<a href="${x.href}">${escHtml(x.label.replace(/ \| .*/, ''))}</a>`, x => { const y = (String(x.label).match(/\b(20\d{2})\b/) || [])[1]; return !y || +y >= +TODAY_ISO.slice(0, 4) - 1; })) : ''}
  ${shows.length ? sec('shows', T('음악방송', 'Music shows'), T('회차 ' + fmt(nShowEp) + '개', fmt(nShowEp) + ' episodes'), chipList(shows), SITE + '/' + (isEn ? 'en/' : '') + 'show/') : ''}
  ${wins.length ? sec('wins', T('음악방송 1위 기록', 'Music show wins'), '', chipList(wins.sort((x, y) => y.m[1] - x.m[1]), x => x.m[1] + T('년', ''))) : ''}
  ${born.length ? sec('born', T('생년별 아이돌', 'Idols by birth year'), '', foldChips(born.sort((x, y) => y.m[1] - x.m[1]), x => `<a href="${x.u}">${escHtml(x.m[1] + T('년생', ''))}</a>`, x => +x.m[1] >= 1990)) : ''}
  ${agencies.length ? sec('agency', T('기획사', 'Agencies'), T(fmt(agencies.length) + '곳', fmt(agencies.length)), chipList(agencies, null, 80)) : ''}
  ${progs.length ? sec('programs', T('프로그램·코너', 'Programs'), T(fmt(progs.length) + '개', fmt(progs.length)), (PROGRAM_LINKS[lang] || []).length ? `<ul class="all-chips">${PROGRAM_LINKS[lang].map(x => `<li><a href="${x.href}">${escHtml(String(x.label).replace(/ 모음$| collection$/i, ''))}</a></li>`).join('')}</ul>` : chipList(progs, null, 80)) : ''}
  ${(covers.length || collabs.length) ? sec('relations', T('커버·콜라보', 'Covers & collabs'), T('커버 ' + fmt(covers.length) + ' · 콜라보 ' + fmt(collabs.length) + (nChem ? ' · 멤버 조합 ' + fmt(nChem) : ''), fmt(covers.length) + ' covers · ' + fmt(collabs.length) + ' collabs'), chipList(covers.concat(collabs), null, 60)) : ''}
  ${awards.length ? sec('awards', T('시상식', 'Awards'), '', chipList(awards)) : ''}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/">${T('K-POP UNIVERSE에서 탐험하기 →', 'Explore the K-POP UNIVERSE →')}</a></div>
</div>
</body>
</html>
`;
    const dir = path.join(ROOT, isEn ? 'en' : '', 'all');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html);
    pages.push({ loc: selfUrl, priority: '0.9' });
  }
  console.log('모아보기 페이지 /all/ · /en/all/');
}
let RANK_TOP_FOR_ALL = [];
function buildRankPages() {
  const all = [];
  for (const gko of Object.keys(VIDS)) {
    if (!groups[gko]) continue;
    const byName = new Map(); membersOf(gko).forEach(a => { byName.set(a.name.ko, a); const ge = (a.groups || []).find(g => g && g.ko === gko); if (ge && ge.name) byName.set(ge.name, a); });
    for (const v of VIDS[gko]) {
      if (!Array.isArray(v.members) || v.members.length !== 1 || !isPerfFancam(v)) continue; // 비공연(예능·비하인드·공항·리액션) 제외 — memberFancams와 같은 기준(2026-11-12)
      const a = byName.get(v.members[0]); if (!a || !camTargetOk(v, a, gko)) continue;
      all.push({ v, a, gko, g: groups[gko].gender });
    }
  }
  all.sort((x, y) => (y.v.view_count || 0) - (x.v.view_count || 0));
  // 모아보기(/all/) 맨 위 '요즘 인기 직캠' — 역대 조회수 순이면 늘 같은 몇 팀(방탄·블랙핑크)만 나온다(2026-11-21 사용자 "기간 고려해서 이런저런 영상이 돌아가며 보이게").
  // 최근 90일에 올라온 직캠을 조회수 순으로, 그룹당 하나씩. 모자라면 최근 1년 → 역대 순으로 채운다. 페이지가 다시 만들어질 때마다 기간이 밀려 자연히 바뀐다.
  {
    const sinceIso = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    const pa = x => String(x.v.published_at || '').slice(0, 10);
    const picked = [], seenG = new Set();
    for (const pool of [all.filter(x => pa(x) >= sinceIso(90)), all.filter(x => pa(x) >= sinceIso(365)), all]) {
      for (const x of pool) { if (picked.length >= 8) break; if (seenG.has(x.gko)) continue; seenG.add(x.gko); picked.push(x); }
      if (picked.length >= 8) break;
    }
    RANK_TOP_FOR_ALL = picked;
  }
  const thisYear = +TODAY_ISO.slice(0, 4);
  const defs = [
    { slug: '', ko: '아이돌 직캠 조회수 순위 TOP 100 (역대)', en: 'Most Viewed K-pop Fancams of All Time — TOP 100', koShort: '역대', enShort: 'All time', f: () => true },
    { slug: 'girls', ko: '여자 아이돌 직캠 조회수 순위 TOP 100', en: 'Most Viewed Girl Group Fancams — TOP 100', koShort: '여자 아이돌', enShort: 'Girl groups', f: x => x.g === 'f' },
    { slug: 'boys', ko: '남자 아이돌 직캠 조회수 순위 TOP 100', en: 'Most Viewed Boy Group Fancams — TOP 100', koShort: '남자 아이돌', enShort: 'Boy groups', f: x => x.g === 'm' },
  ];
  for (let y = thisYear; y >= thisYear - 7; y--) defs.push({ slug: String(y), ko: `${y} 아이돌 직캠 조회수 순위 TOP 100`, en: `Most Viewed K-pop Fancams of ${y} — TOP 100`, koShort: `${y}`, enShort: `${y}`, f: x => String(x.v.published_at || '').slice(0, 4) === String(y) });
  const built = defs.map(d => ({ d, list: all.filter(d.f).slice(0, RANK_TOP) })).filter(x => x.list.length >= 20);
  RANK_LINKS = { ko: built.map(({ d }) => ({ href: `${SITE}/${rankPagePath(d.slug, 'ko')}`, label: d.ko })), en: built.map(({ d }) => ({ href: `${SITE}/${rankPagePath(d.slug, 'en')}`, label: d.en })) };
  for (const { d, list } of built) {
    for (const lang of ['ko', 'en']) {
      const isEn = lang === 'en';
      const rel = rankPagePath(d.slug, lang);
      const selfUrl = `${SITE}/${rel}`, altUrl = `${SITE}/${rankPagePath(d.slug, isEn ? 'ko' : 'en')}`, koUrl = `${SITE}/${rankPagePath(d.slug, 'ko')}`;
      const h1 = isEn ? d.en : d.ko;
      const top = list[0];
      const nm = x => { const ge = (x.a.groups || []).find(g => g && g.ko === x.gko); return isEn ? ((ge && ge.nameEn) || x.a.name.en || x.a.name.ko) : ((ge && ge.name) || x.a.name.ko); };
      const gn = x => isEn ? (groups[x.gko].en || x.gko) : x.gko;
      const desc = isEn
        ? `${list.length} most viewed K-pop idol fancams${d.slug ? ` (${d.enShort})` : ''}. #1 ${nm(top)} (${gn(top)}) with ${SEO.fmtViews(top.v.view_count, true)} views. Updated weekly.`
        : `아이돌 개인 직캠 조회수 순위${d.slug ? `(${d.koShort})` : ''} TOP ${list.length}. 1위 ${gn(top)} ${nm(top)} ${SEO.fmtViews(top.v.view_count, false)}. 매주 갱신.`;
      const jsonLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: h1, url: selfUrl,
        itemListElement: list.slice(0, 20).map((x, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://www.youtube.com/watch?v=${x.v.id}`, name: x.v.title })) };
      const cards = list.map((x, i) => `<a class="card" href="https://www.youtube.com/watch?v=${x.v.id}" target="_blank" rel="noopener"><span class="card-th"><img src="https://i.ytimg.com/vi/${x.v.id}/mqdefault.jpg" alt="" loading="lazy"><span class="rank-n">${i + 1}</span></span><span class="card-t">${escHtml(x.v.title)}</span><span class="card-y">${escHtml(`${nm(x)} · ${gn(x)}`)} · ${[x.v.published_at ? String(x.v.published_at).slice(0, 10).replace(/-/g, '.') : '', SEO.fmtVC(x.v.view_count)].filter(Boolean).join(' · ')}</span></a>`).join('\n    ');
      // 같은 순위 표에서 1~20위 멤버의 직캠 모음 페이지로(내부 링크)
      const seen = new Set(), who = [];
      list.slice(0, 40).forEach(x => { const k = x.gko + '|' + x.a.name.ko; if (seen.has(k) || who.length >= 20) return; seen.add(k); who.push(x); });
      const tabs = built.map(({ d: o }) => o.slug === d.slug ? `<li class="on">${escHtml(isEn ? o.enShort : o.koShort)}</li>` : `<li><a href="${SITE}/${rankPagePath(o.slug, lang)}">${escHtml(isEn ? o.enShort : o.koShort)}</a></li>`).join('');
      const rankNext = safeNext(() => [
        ...who.filter(x => FANCAM_HUB.get(x.a)).slice(0, 3).map(x => ({ k: isEn ? 'Member fancams' : '멤버 직캠 모음', t: nm(x), s: gn(x), img: x.v.id, h: SITE + '/' + memberFancamPagePath(x.a, lang) })),
        ...built.filter(({ d: o }) => o.slug !== d.slug).slice(0, 2).map(({ d: o }) => ({ k: isEn ? 'Another ranking' : '다른 순위', t: isEn ? o.en : o.ko, h: SITE + '/' + rankPagePath(o.slug, lang) })),
      ]);
      const html = `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(isEn ? h1 : `${h1} | ${d.en}`)} | K-POP UNIVERSE</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(h1)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${sqOg(wideThumb(top.v.id))}">
<meta property="og:image:width" content="${ogSizeFor(wideThumb(top.v.id)).w}">
<meta property="og:image:height" content="${ogSizeFor(wideThumb(top.v.id)).h}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){gtag('event','seo_land',{entity_name:${JSON.stringify(h1)},page_type:'rank'});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1 class="rank-h1">${escHtml(h1)}</h1>
  <ul class="rank-tabs">${tabs}</ul>
  <div class="grid">
    ${cards}
  </div>
  <h2>${isEn ? 'Fancam collections of the ranked idols' : '순위에 오른 아이돌 직캠 모음'}</h2>
  <div class="faces">
    ${who.map(x => { const img = memberFaceUrl(x.a, x.gko); return `<a class="face" href="${SITE}/${FANCAM_HUB.has(x.a) ? memberFancamPagePath(x.a, lang) : memberPagePath(x.a, lang)}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ' class="pf"' : ''} src="${img}" alt="${escHtml(nm(x))}" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(nm(x))}</span><span class="face-n">${escHtml(gn(x))}</span></a>`; }).join('\n    ')}
  </div>
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/">${isEn ? 'Explore the K-POP UNIVERSE →' : 'K-POP UNIVERSE에서 더 보기 →'}</a></div>
  ${rankNext}
</div>
</body>
</html>
`;
      fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
      fs.writeFileSync(path.join(ROOT, rel, 'index.html'), html);
      pages.push({ loc: selfUrl, priority: d.slug ? '0.7' : '0.8' });
    }
  }
  console.log(`직캠 순위 페이지 ${built.length}종 × 2개 언어 (개인 직캠 ${all.length}개 중)`);
}

// ── 프로그램별 모음 페이지(2026-10-30, 검색 유입 ④ — "보이스캠 직캠"·"잇츠라이브 코르티스"·"아이돌라디오 직캠") ────────────────────
// 프로그램 목록은 앱의 _PROGRAM_COLLECTIONS를 app.js에서 그대로 읽는다(앱 모아보기와 같은 기준 — 두 벌로 갈리지 않게).
// 영상은 곡 페이지와 같은 VIDS(쇼츠 제외·공개). 제목을 앱과 같이 NFKC+소문자로 맞춰 키워드 포함이면 그 프로그램.
// 경로: p/{키}/ (프로그램 전체) · p/{키}/{그룹}/ (그 프로그램에 그 그룹 영상 PROGRAM_GROUP_MIN개 이상) + en/
const PROGRAM_GROUP_MIN = 5;
let PROGRAM_LINKS = { ko: [], en: [] };
function loadPrograms() {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const a = src.indexOf('const _PROGRAM_COLLECTIONS=['); if (a < 0) return [];
    const b = src.indexOf('\n];', a);
    const vm = require('vm'); const ctx = {}; vm.createContext(ctx);
    vm.runInContext(src.slice(a, b + 3).replace('const _PROGRAM_COLLECTIONS=', 'this.P='), ctx);
    return Array.isArray(ctx.P) ? ctx.P : [];
  } catch (e) { console.warn('[programs] 목록 읽기 실패:', e.message); return []; }
}
function programPagePath(key, gko, lang) { return `${lang === 'en' ? 'en/' : ''}p/${key}/${gko ? urlSafeKo(gko) + '/' : ''}`; }
function buildProgramPages() {
  const progs = loadPrograms();
  const norm = t => String(t || '').normalize('NFKC').toLowerCase();
  const hit = (p, t) => p.kw.some(k => t.includes(norm(k)));
  const built = [];
  for (const p of progs) {
    const rows = [];
    for (const gko of Object.keys(VIDS)) { if (!groups[gko]) continue; for (const v of VIDS[gko]) { const t = norm(v.title); if (hit(p, t)) rows.push({ v, gko }); } }
    if (rows.length < 8) continue;
    rows.sort((x, y) => (y.v.view_count || 0) - (x.v.view_count || 0));
    const byG = new Map(); rows.forEach(r => { if (!byG.has(r.gko)) byG.set(r.gko, []); byG.get(r.gko).push(r); });
    const teams = [...byG.entries()].sort((x, y) => y[1].length - x[1].length);
    const subs = teams.filter(([, l]) => l.length >= PROGRAM_GROUP_MIN).map(([g]) => g);
    built.push({ p, rows, teams, subs });
  }
  PROGRAM_LINKS = { ko: built.map(b => ({ href: `${SITE}/${programPagePath(b.p.key, null, 'ko')}`, label: `${b.p.label} 모음` })), en: built.map(b => ({ href: `${SITE}/${programPagePath(b.p.key, null, 'en')}`, label: `${b.p.en || b.p.label} collection` })) };
  let nSub = 0;
  for (const { p, rows, teams, subs } of built) {
    const subSet = new Set(subs);
    const render = (lang, gko) => {
      const isEn = lang === 'en';
      const pName = isEn ? (p.en || p.label) : p.label;
      const pFull = isEn ? pName : bilingualLabel(p.label, p.en); // 등록된 영문명이 있을 때만 병기(지어내지 않음)
      const list = gko ? rows.filter(r => r.gko === gko) : rows;
      const gName = gko ? (isEn ? (groups[gko].en || gko) : gko) : '';
      const gFull = gko ? (isEn ? gName : `${gko}${groups[gko].en && groups[gko].en !== gko ? `(${groups[gko].en})` : ''}`) : '';
      const rel = programPagePath(p.key, gko, lang);
      const selfUrl = `${SITE}/${rel}`, altUrl = `${SITE}/${programPagePath(p.key, gko, isEn ? 'ko' : 'en')}`, koUrl = `${SITE}/${programPagePath(p.key, gko, 'ko')}`;
      const h1 = gko ? (isEn ? `${gName} × ${pName}` : `${gko} ${p.label} 모음`) : (isEn ? `${pName} — K-pop idol videos` : `${p.label} 모음`);
      const title = gko
        ? (isEn ? `${gName} ${pName} Videos (${list.length}) | K-POP UNIVERSE` : `${gko} ${pFull} 모음 - ${gFull} ${p.label} 영상 ${list.length}개 | K-POP UNIVERSE`)
        : (isEn ? `${pName} — ${rows.length} K-pop Idol Videos | K-POP UNIVERSE` : `${pFull} 모음 - 아이돌 ${p.label} 영상 ${rows.length}개 | K-POP UNIVERSE`);
      const desc = gko
        ? (isEn ? `${list.length} ${pName} videos of ${gName}, most viewed first.` : `${gko}${josa(gko, '이/가')} 나온 ${p.label} 영상 ${list.length}개를 조회수 순으로 모았어요.`)
        : (isEn ? `${rows.length} ${pName} videos of ${teams.length} K-pop groups, most viewed first.` : `아이돌 ${teams.length}팀의 ${p.label} 영상 ${rows.length}개를 조회수 순으로. 팀별로도 볼 수 있어요.`);
      const top = list.slice(0, gko ? 36 : 48);
      const cards = top.map(r => `<a class="card" href="https://www.youtube.com/watch?v=${r.v.id}" target="_blank" rel="noopener"><span class="card-th"><img src="https://i.ytimg.com/vi/${r.v.id}/mqdefault.jpg" alt="" loading="lazy"></span><span class="card-t">${escHtml(r.v.title)}</span><span class="card-y">${gko ? '' : escHtml(isEn ? (groups[r.gko].en || r.gko) : r.gko) + ' · '}${[r.v.published_at ? String(r.v.published_at).slice(0, 10).replace(/-/g, '.') : '', r.v.view_count ? SEO.fmtVC(r.v.view_count) : ''].filter(Boolean).join(' · ')}</span></a>`).join('\n    ');
      const teamChips = gko ? '' : `
  <h2>${isEn ? 'By group' : '팀별로 보기'}</h2>
  <ul class="chips">
    ${teams.slice(0, 60).map(([g, l]) => { const nm = isEn ? (groups[g].en || g) : g; return subSet.has(g) ? `<li><a href="${SITE}/${programPagePath(p.key, g, lang)}"><b>${escHtml(nm)}</b>${l.length}</a></li>` : `<li><b>${escHtml(nm)}</b>${l.length}</li>`; }).join('\n    ')}
  </ul>`;
      const back = gko ? `<div class="crumbs"><a href="${SITE}/${programPagePath(p.key, null, lang)}">${escHtml(isEn ? `${pName} collection` : `${p.label} 모음`)}</a> › <a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(gName)}</a></div>` : '';
      const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: selfUrl, description: desc,
        mainEntity: { '@type': 'ItemList', itemListElement: top.slice(0, 10).map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `https://www.youtube.com/watch?v=${r.v.id}`, name: r.v.title })) } };
      const progNext = safeNext(() => gko ? [
        { k: isEn ? 'Collection' : '모음', t: isEn ? pName + ' collection' : pFull + ' 모음', s: isEn ? 'All groups' : '모든 팀', h: SITE + '/' + programPagePath(p.key, null, lang) },
        grpCard(gko, lang),
      ] : teams.slice(0, 4).map(([g, l]) => subSet.has(g)
        ? { k: isEn ? 'By group' : '팀별 영상', t: isEn ? (groups[g].en || g) : g, s: isEn ? l.length + ' videos' : '영상 ' + l.length + '개', img: (l[0] && l[0].v && l[0].v.id) || '', h: SITE + '/' + programPagePath(p.key, g, lang) }
        : grpCard(g, lang)));
      return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(h1)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${sqOg(wideThumb(list[0].v.id))}">
<meta property="og:image:width" content="${ogSizeFor(wideThumb(list[0].v.id)).w}">
<meta property="og:image:height" content="${ogSizeFor(wideThumb(list[0].v.id)).h}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){gtag('event','seo_land',{entity_name:${JSON.stringify(h1)},page_type:'${gko ? 'program_group' : 'program'}'});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1 class="rank-h1">${escHtml(h1)}</h1>
  ${back}
  <div class="grid">
    ${cards}
  </div>
  ${list.length > top.length ? `<p class="note">${isEn ? `Top ${top.length} of ${list.length} videos` : `영상 ${list.length}개 중 상위 ${top.length}개`}</p>` : ''}
  ${teamChips}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/${gko ? `#g=${hashEsc(gko)}` : ''}">${isEn ? 'Explore the K-POP UNIVERSE →' : (gko ? `${escHtml(gko)} 영상 아카이브 보기 →` : 'K-POP UNIVERSE에서 더 보기 →')}</a></div>
  ${progNext}
</div>
</body>
</html>
`;
    };
    for (const gko of [null, ...subs]) {
      for (const lang of ['ko', 'en']) {
        const rel = programPagePath(p.key, gko, lang);
        fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
        fs.writeFileSync(path.join(ROOT, rel, 'index.html'), render(lang, gko));
        pages.push({ loc: `${SITE}/${rel}`, priority: gko ? '0.5' : '0.7' });
      }
      if (gko) nSub++;
    }
  }
  console.log(`프로그램 모음 페이지 ${built.length}종 + 프로그램×그룹 ${nSub}개 × 2개 언어`);
}

// ── 생년·데뷔연도 페이지(2026-10-30, 검색 유입 ⑤ — "2009년생 아이돌"·"2025년 데뷔 아이돌") ─────────────────────────────────
// idols/born/{년}/ — 그 해 태어난 아이돌(그룹 소속·솔로) 얼굴 카드 → 각 멤버 페이지(직캠 모음). 5명 이상인 해만.
// idols/debut/{년}/ — 그 해 데뷔한 그룹 카드 → 그룹 페이지(직캠·무대 모음). 3팀 이상인 해만.
let YEAR_LINKS = { born: [], debut: [] };
function yearPagePath(kind, y, lang) { return `${lang === 'en' ? 'en/' : ''}idols/${kind}/${y}/`; }
function buildYearPages() {
  const gPri = gko => +(groups[gko] && groups[gko].pri || 0);
  const born = {}, debut = {};
  artists.forEach(a => { const y = String(a.bday || '').slice(0, 4); if (/^(19[7-9]\d|20[0-2]\d)$/.test(y)) (born[y] = born[y] || []).push(a); });
  groupKos.forEach(g => { const y = String(groups[g].debut || '').slice(0, 4); if (/^(19[89]\d|20[0-2]\d)$/.test(y)) (debut[y] = debut[y] || []).push(g); });
  const bornYs = Object.keys(born).filter(y => born[y].length >= 5).sort();
  const debutYs = Object.keys(debut).filter(y => debut[y].length >= 3).sort();
  YEAR_LINKS = { born: bornYs, debut: debutYs };
  const page = (lang, kind, y) => {
    const isEn = lang === 'en';
    const rel = yearPagePath(kind, y, lang);
    const selfUrl = `${SITE}/${rel}`, altUrl = `${SITE}/${yearPagePath(kind, y, isEn ? 'ko' : 'en')}`, koUrl = `${SITE}/${yearPagePath(kind, y, 'ko')}`;
    let h1, title, desc, cards, n;
    if (kind === 'born') {
      const list = born[y].slice().sort((p, q) => (q.active !== false) - (p.active !== false) || gPri(q.group.ko) - gPri(p.group.ko) || String(p.bday).localeCompare(String(q.bday)));
      n = list.length;
      const label = a => { const g = groups[a.group.ko]; const nm = isEn ? (a.name.en || a.name.ko) : (a.displayName || a.name.ko); return { nm, gn: g ? (isEn ? (g.en || a.group.ko) : a.group.ko) : (isEn ? 'Solo' : '솔로') }; };
      const top = list.slice(0, 6).map(a => { const l = label(a); return isEn ? `${l.nm} (${l.gn})` : `${l.gn} ${l.nm}`; });
      h1 = isEn ? `K-pop idols born in ${y}` : `${y}년생 아이돌`;
      title = isEn ? `K-pop Idols Born in ${y} — ${n} idols incl. ${top.slice(0, 3).join(', ')} | K-POP UNIVERSE` : `${y}년생 아이돌 - ${top.slice(0, 3).join('·')} 등 ${n}명 | K-pop Idols Born in ${y} | K-POP UNIVERSE`;
      desc = isEn ? `${n} K-pop idols born in ${y}: ${top.join(', ')} and more. Birthdays, groups and fancams.` : `${y}년에 태어난 아이돌 ${n}명 — ${top.join(', ')} 등. 생일·소속 그룹·직캠 모음으로 바로 가요.`;
      cards = list.map(a => { const l = label(a); const gk = groups[a.group.ko] ? a.group.ko : null; const img = memberFaceUrl(a, gk || a.group.ko);
        return `<a class="face" href="${SITE}/${memberPagePath(a, lang)}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ' class="pf"' : ''} src="${img}" alt="${escHtml(l.nm)}" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(l.nm)}</span><span class="face-n">${escHtml(l.gn)} · ${escHtml(String(a.bday).slice(5).replace('.', '/'))}</span></a>`; }).join('\n    ');
    } else {
      const list = debut[y].slice().sort((p, q) => gPri(q) - gPri(p) || String(groups[p].debut).localeCompare(String(groups[q].debut)));
      n = list.length;
      const nm = g => isEn ? (groups[g].en || g) : g;
      h1 = isEn ? `K-pop groups that debuted in ${y}` : `${y}년 데뷔 아이돌 그룹`;
      title = isEn ? `K-pop Groups Debuted in ${y} — ${list.slice(0, 3).map(nm).join(', ')} and more | K-POP UNIVERSE` : `${y}년 데뷔 아이돌 - ${list.slice(0, 4).map(nm).join('·')} 등 ${n}팀 | K-pop Groups Debuted in ${y} | K-POP UNIVERSE`;
      desc = isEn ? `${n} K-pop groups that debuted in ${y}: ${list.slice(0, 8).map(nm).join(', ')}. Debut dates, members and fancams.` : `${y}년에 데뷔한 아이돌 그룹 ${n}팀 — ${list.slice(0, 8).map(nm).join(', ')}. 데뷔일·멤버·직캠 모음.`;
      cards = list.map(g => { const t = OG_THUMBS.groups && OG_THUMBS.groups[g]; const id = t && (String(t).match(/\/vi\/([^/]+)\//) || [])[1];
        return `<a class="sp-tile" href="${SITE}/${groupPagePath(g, lang)}">${id ? `<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy" style="aspect-ratio:16/9">` : '<span class="sp-tile-ph" style="aspect-ratio:16/9"></span>'}<span class="sp-tile-t">${escHtml(nm(g))}</span><span class="sp-tile-n">${escHtml(String(groups[g].debut || ''))}</span></a>`; }).join('\n    ');
    }
    const ys = kind === 'born' ? bornYs : debutYs;
    // '이어서 보기' — 생년: 대표 멤버 3(직캠 허브가 있으면 허브, 없으면 프로필) / 데뷔년: 대표 그룹 3 / 앞뒤 연도 (2026-11-17)
    const yearNext = safeNext(() => (() => {
      const out = [], pri = g => +(groups[g] && groups[g].pri || 0);
      if (kind === 'born') {
        (born[y] || []).slice().sort((p, q) => (q.active !== false) - (p.active !== false) || pri(q.group && q.group.ko) - pri(p.group && p.group.ko)).slice(0, 3).forEach(a => {
          const hub = FANCAM_HUB.get(a), rel = hub && hub.length ? memberFancamPagePath(a, lang) : memberPagePath(a, lang);
          if (rel) out.push({ k: isEn ? 'Idol' : '멤버', t: _nmOf(a, isEn), s: a.group && groups[a.group.ko] ? (isEn ? (groups[a.group.ko].en || a.group.ko) : a.group.ko) : (isEn ? 'Solo' : '솔로'), img: hub && hub.length ? (hub[0].id || '') : '', h: SITE + '/' + rel });
        });
      } else {
        (debut[y] || []).slice().sort((p, q) => pri(q) - pri(p)).slice(0, 3).forEach(g => out.push(grpCard(g, lang)));
      }
      const i2 = ys.indexOf(y);
      [ys[i2 - 1], ys[i2 + 1]].filter(Boolean).forEach(o => out.push({ k: isEn ? 'Another year' : '다른 연도', t: kind === 'born' ? (isEn ? 'Idols born in ' + o : o + '년생 아이돌') : (isEn ? 'Groups debuted in ' + o : o + '년 데뷔 아이돌'), h: SITE + '/' + yearPagePath(kind, o, lang) }));
      return out;
    })());
    const tabs = ys.slice().reverse().map(o => o === y ? `<li class="on">${o}</li>` : `<li><a href="${SITE}/${yearPagePath(kind, o, lang)}">${o}</a></li>`).join('');
    return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(h1)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){gtag('event','seo_land',{entity_name:${JSON.stringify(h1)},page_type:'year_${kind}'});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1 class="rank-h1">${escHtml(h1)}</h1>
  <ul class="rank-tabs">${tabs}</ul>
  <div class="${kind === 'born' ? 'people' : 'sp-tiles'}">
    ${cards}
  </div>
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/">${isEn ? 'Explore the K-POP UNIVERSE →' : 'K-POP UNIVERSE에서 더 보기 →'}</a></div>
  ${yearNext}
</div>
</body>
</html>
`;
  };
  for (const [kind, ys] of [['born', bornYs], ['debut', debutYs]]) for (const y of ys) for (const lang of ['ko', 'en']) {
    const rel = yearPagePath(kind, y, lang);
    fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel, 'index.html'), page(lang, kind, y));
    pages.push({ loc: `${SITE}/${rel}`, priority: '0.6' });
  }
  console.log(`생년 페이지 ${bornYs.length}개 · 데뷔연도 페이지 ${debutYs.length}개 × 2개 언어`);
}

// ── 소속사 페이지(2026-10-30, 검색 유입 ⑥ — "SM 소속 아이돌"·"하이브 아이돌 그룹") ───────────────────────────────────────────
// groups.json co("빅히트 뮤직 / HYBE")를 '/'로 나눠 각 이름에 그룹을 넣는다(레이블과 모회사 둘 다). 표기 흔들림은 아래 표로 합친다.
// 3팀 이상인 소속사만. 경로: agency/{이름}/ (+ en/)
const AGENCY_ALIAS = { 'SM': 'SM엔터테인먼트', 'Cube': '큐브엔터테인먼트', 'Starship': '스타쉽엔터테인먼트', '플레디스 엔터테인먼트': '플레디스',
  'Modhaus': '모드하우스', 'Fantagio': '판타지오', 'High Up': '하이업엔터테인먼트', 'Loen Entertainment': '로엔엔터테인먼트', 'nCH엔터테인먼트': 'n.CH엔터테인먼트' };
const AGENCY_SKIP = new Set(['무소속']);
let AGENCY_LINKS = [];
function agencyPagePath(name, lang) { return `${lang === 'en' ? 'en/' : ''}agency/${urlSafeKo(name)}/`; }
function groupTileHtml(g, lang, sub) {
  const t = OG_THUMBS.groups && OG_THUMBS.groups[g]; const id = t && (String(t).match(/\/vi\/([^/]+)\//) || [])[1];
  const nm = lang === 'en' ? (groups[g].en || g) : g;
  return `<a class="sp-tile" href="${SITE}/${groupPagePath(g, lang)}">${id ? `<img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy" style="aspect-ratio:16/9">` : '<span class="sp-tile-ph" style="aspect-ratio:16/9"></span>'}<span class="sp-tile-t">${escHtml(nm)}</span><span class="sp-tile-n">${escHtml(sub || '')}</span></a>`;
}
function simplePageHtml({ lang, selfUrl, altUrl, koUrl, title, h1, desc, body, kind, ogImage, next }) {
  const isEn = lang === 'en';
  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'ko'}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${selfUrl}">
<link rel="alternate" hreflang="${isEn ? 'ko' : 'en'}" href="${altUrl}">
<link rel="alternate" hreflang="${isEn ? 'en' : 'ko'}" href="${selfUrl}">
<link rel="alternate" hreflang="x-default" href="${koUrl}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(h1)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
${ogImage ? `<meta property="og:image" content="${sqOg(ogImage)}">\n<meta property="og:image:width" content="${ogSizeFor(sqOg(ogImage)).w}">\n<meta property="og:image:height" content="${ogSizeFor(sqOg(ogImage)).h}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<link rel="preconnect" href="https://i.ytimg.com">
<link rel="stylesheet" href="${SITE}/song-page.css?v=${SONG_CSS_V}">
${SEO_GA_TAG}
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){gtag('event','seo_land',{entity_name:${JSON.stringify(h1)},page_type:'${kind}'});});</script>
<script src="/seo_play.js" defer></script>
</head>
<body>
<div class="wrap">
  ${languageNav(isEn, altUrl)}
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1 class="rank-h1">${escHtml(h1)}</h1>
${body}
${next || ''}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a> · <a href="${SITE}/about.html">${isEn ? 'About · removal requests' : '사이트 소개 · 삭제 요청'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/">${isEn ? 'Explore the K-POP UNIVERSE →' : 'K-POP UNIVERSE에서 더 보기 →'}</a></div>
</div>
</body>
</html>
`;
}
function writeSimple(rel, html, priority) {
  fs.mkdirSync(path.join(ROOT, rel), { recursive: true });
  fs.writeFileSync(path.join(ROOT, rel, 'index.html'), html);
  pages.push({ loc: `${SITE}/${rel}`, priority });
}
// ── 조합(Chemistry) 페이지(2026-11-02, 사용자 "조합 페이지 보류할 필요가 있나?" → 바로) ─────────────────────────────
// chem/{그룹}/{A}-{B}/ — 같은 그룹 멤버 둘이 함께 나온 영상(단체 영상 제외, 2~4명 출연)이 CHEM_MIN개 이상인 쌍. "성현 건호 케미"·"투샷" 검색 착지.
// 집계는 DB 함수 get_chem_pairs(sql/2026-11-02_chem_pairs_rpc.sql)가 한 번에(쌍 + 쌍마다 대표 영상 12개, 쇼츠 포함) — 앱 Chemistry와 같은 기준.
// ⚠️ 다른 그룹끼리는 아직 안 낸다 — 색인되는 페이지라 게스트 태그(with_members) 오탐이 정리된 뒤에(관계 페이지 원칙, 실측 예: 동명이인 쌍).
// 미리보기 = 대표 영상 썸네일, 사람이 #chem=…로 들어오면 앱의 Chemistry로 넘긴다(CHEM_FWD). 앱이 공유 주소를 고르도록 chem/index.json도 쓴다.
const CHEM_MIN = 10;
const CHEM_FWD = `<script>(function(){var h=location.hash;if(/(^#|&)chem=/.test(h))location.replace('${SITE}/'+h);})();</script>`;
function chemPagePath(g, a, b, lang) {
  if (lang === 'en') return `en/chem/${slugify(groups[g].en || g, g)}/${slugify(a.name.en || a.name.ko, a.name.ko)}-${slugify(b.name.en || b.name.ko, b.name.ko)}/`;
  return `chem/${urlSafeKo(g)}/${relSeg(a.name.ko, 'ko')}-${relSeg(b.name.ko, 'ko')}/`;
}
let CHEM_RAW = null; // get_chem_pairs 결과 — 메인에서 멤버 페이지 전에 받아 둔다(nextItems), 실패하면 buildChemPages가 다시 받는다
async function fetchChemPairs() {
  const res = await fetch(`${SB_URL}/rest/v1/rpc/get_chem_pairs`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_min: CHEM_MIN }), signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`get_chem_pairs ${res.status}`);
  const raw = await res.json();
  if (!Array.isArray(raw)) throw new Error('get_chem_pairs 응답이 배열이 아님');
  return raw;
}
async function buildChemPages() {
  const raw = CHEM_RAW || await fetchChemPairs();
  // 그룹 멤버 이름 → 아티스트(활동명·예전 이름 별칭 포함)
  const byName = new Map();
  for (const g of groupKos) membersOf(g).forEach(a => { byName.set(g + '|' + a.name.ko, a); const ge = (a.groups || []).find(x => x && x.ko === g); if (ge && ge.name) byName.set(g + '|' + ge.name, a); });
  const pairs = [];
  for (const p of raw) {
    if (!groups[p.g]) continue;
    let a = byName.get(p.g + '|' + p.a), b = byName.get(p.g + '|' + p.b);
    if (!a || !b || a === b) continue;
    if (a.name.ko.localeCompare(b.name.ko, 'ko') > 0) [a, b] = [b, a]; // 주소 순서 고정
    pairs.push({ g: p.g, a, b, n: p.n, only: p.only2, v: p.v || [] });
  }
  // 멤버별 조합(다른 조합 링크용)
  const byMember = new Map();
  pairs.forEach(p => [p.a, p.b].forEach(m => { if (!byMember.has(m)) byMember.set(m, []); byMember.get(m).push(p); }));
  const index = {};
  const nm = (a, isEn) => isEn ? (a.name.en || a.name.ko) : (a.displayName || a.name.ko);
  for (const p of pairs) {
    index[`${p.g}|${p.a.name.ko}|${p.b.name.ko}`] = chemPagePath(p.g, p.a, p.b, 'ko');
    for (const lang of ['ko', 'en']) {
      const isEn = lang === 'en';
      const rel = chemPagePath(p.g, p.a, p.b, lang), altRel = chemPagePath(p.g, p.a, p.b, isEn ? 'ko' : 'en');
      const A = nm(p.a, isEn), B = nm(p.b, isEn), G = isEn ? (groups[p.g].en || p.g) : p.g;
      const debut = String(groups[p.g].debut || '').slice(0, 7);
      const ya = String(p.a.bday || '').slice(0, 4), yb = String(p.b.bday || '').slice(0, 4);
      const facts = [];
      if (debut) facts.push([isEn ? 'Group' : '사이', isEn ? `${G}, debuted ${debut}` : `${debut} ${G} 데뷔`]);
      if (/^\d{4}$/.test(ya) && /^\d{4}$/.test(yb)) {
        if (ya === yb) facts.push([isEn ? 'Age' : '나이', isEn ? `Both born in ${ya}` : `${ya.slice(2)}라인 — ${ya}년생`]);
        else if (Math.abs(+ya - +yb) === 1) facts.push([isEn ? 'Age' : '나이', isEn ? `Born ${Math.min(+ya, +yb)}–${Math.max(+ya, +yb)}` : `${Math.min(+ya, +yb)}·${Math.max(+ya, +yb)}년생`]);
      }
      facts.push([isEn ? 'Together' : '같이 나옴', isEn ? `${p.n} videos · ${p.only} just the two` : `${p.n}개 · 둘만 ${p.only}개`]);
      const title = isEn ? `${A} & ${B} (${G}) — ${p.n} Videos Together | K-POP UNIVERSE` : `${bilingualLabel(A, nm(p.a, true))} ${bilingualLabel(B, nm(p.b, true))} 케미 - ${bilingualLabel(G, groups[p.g].en)} ${A}·${B} 함께 나온 영상 ${p.n}개 | K-POP UNIVERSE`;
      const h1 = `${A} × ${B}`;
      const desc = isEn ? `${p.n} videos with ${G}'s ${A} and ${B} together (group videos excluded), ${p.only} with just the two — fancams, stages, shorts and variety.`
        : `${G} ${A}·${B} 함께 나온 영상 ${p.n}개(단체 영상 제외), 둘만 나온 영상 ${p.only}개 — 직캠·무대·쇼츠·예능을 조회수 순으로.`;
      const face = a => { const img = memberFaceUrl(a, p.g); return `<a class="face" href="${SITE}/${memberPagePath(a, lang)}"><span class="face-img">${img ? `<img${/#pf$/.test(img) ? ' class="pf"' : ''} src="${img}" alt="${escHtml(nm(a, isEn))}" loading="lazy">` : ''}</span><span class="face-nm">${escHtml(nm(a, isEn))}</span></a>`; };
      const cards = p.v.map(v => `<a class="card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="card-th"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"></span><span class="card-t">${escHtml(v.t || '')}</span><span class="card-y">${[v.pa ? String(v.pa).replace(/-/g, '.') : '', v.vc ? SEO.fmtVC(v.vc) : ''].filter(Boolean).join(' · ')}</span></a>`).join('');
      const others = [...new Set([...(byMember.get(p.a) || []), ...(byMember.get(p.b) || [])])].filter(o => o !== p).sort((x, y) => y.n - x.n).slice(0, 8);
      const chemHash = `#chem=${encodeURIComponent(`${p.a.name.ko}~${p.g},${p.b.name.ko}~${p.g}`)}`;
      const body = `  <div class="faces" style="justify-content:center;align-items:center">${face(p.a)}<span aria-hidden="true" style="color:#FFB0D0;font-size:18px;margin:0 4px 22px">✦</span>${face(p.b)}</div>
  <ul class="chips" style="margin-top:14px">${facts.map(([k, v]) => `<li><b>${escHtml(k)}</b>${escHtml(v)}</li>`).join('')}</ul>
  <p><a class="cta" href="${SITE}/${chemHash}">${isEn ? `All videos of ${A} & ${B} in the app →` : `앱에서 ${A}·${B} 모든 영상 보기 →`}</a></p>
  <h2 class="rank-h">${isEn ? 'Top videos together' : '함께 나온 영상'}</h2>
  <div class="grid">${cards}</div>
  <p class="note"><a href="${SITE}/${groupPagePath(p.g, lang)}">${escHtml(G)}</a> · <a href="${SITE}/${memberPagePath(p.a, lang)}">${escHtml(A)}</a> · <a href="${SITE}/${memberPagePath(p.b, lang)}">${escHtml(B)}</a></p>
${others.length ? `  <h2 class="rank-h">${isEn ? 'More pairs' : '다른 조합'}</h2>
  <ul class="chips">${others.map(o => `<li><a href="${SITE}/${chemPagePath(o.g, o.a, o.b, lang)}">${escHtml(nm(o.a, isEn))} × ${escHtml(nm(o.b, isEn))}</a> ${o.n}</li>`).join('')}</ul>` : ''}`;
      const top = p.v[0];
      let html = simplePageHtml({ next: chemNextJson(p, lang, byMember), lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${altRel}`, koUrl: `${SITE}/${chemPagePath(p.g, p.a, p.b, 'ko')}`, title, h1, desc, body, kind: 'chem', ogImage: top ? wideThumb(top.id) : null });
      html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n' + CHEM_FWD);
      writeSimple(rel, html, '0.4');
    }
  }
  fs.mkdirSync(path.join(ROOT, 'chem'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'chem', 'index.json'), JSON.stringify(index));
  if (pairs.length >= 500) { // 조회가 덜 된 빌드(쌍이 적음)에선 멀쩡한 페이지를 넘기지 않는다
    let rc = 0;
    for (const g of groupKos) { if (!groups[g]) continue;
      for (const lang of ['ko', 'en']) {
        const base = lang === 'en' ? `en/chem/${slugify(groups[g].en || g, g)}/` : `chem/${urlSafeKo(g)}/`;
        rc += retireStaleDirs(path.join(ROOT, base), base, `${SITE}/${groupPagePath(g, lang)}`, lang === 'en' ? (groups[g].en || g) : g, lang);
      } }
    if (rc) console.log(`조합 목록에서 빠진 옛 조합 페이지 → 그룹 페이지로 넘김 ${rc}개`);
  }
  console.log(`조합 페이지 ${pairs.length}쌍 × 2개 언어 (함께 나온 영상 ${CHEM_MIN}개 이상, 같은 그룹)`);
}
// ── 작사·작곡 페이지(2026-11-04, 검색 유입 확대 ⑨) ───────────────────────────────────────────
// g/{그룹}/{멤버}/credits/ · en/…/credits/ — artist_credits.json(멜론 작사·작곡 크레딧, 키 = 이름\0그룹)으로 "윈터 작사 작곡 곡"·"RM 자작곡" 검색 착지.
// 같은 곡의 리믹스·버전은 곡 기본형(_songBase)으로 하나로 묶고, 그 곡 페이지(g/…/s/{기본형}/)가 있으면 잇는다. 작사+작곡 합쳐 CREDIT_MIN곡 이상인 사람만.
const CREDIT_MIN = 5;
const _CRED_SB = (() => { const vm = require('vm'); const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + ';this.B=_songBase;', ctx); return ctx.B; })();
let _CREDITS = null;
function creditsFor(a) {
  if (!_CREDITS) {
    _CREDITS = new Map();
    let raw = {}; try { raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'artist_credits.json'), 'utf8')); } catch (e) { return null; }
    for (const [k, v] of Object.entries(raw)) {
      const [n, g] = k.split(String.fromCharCode(0));
      const who = artists.find(x => x && x.name && x.name.ko === n && (x.group && x.group.ko === g || (x.groups || []).some(y => y && y.ko === g)));
      if (!who) continue;
      const pack = list => SEO.packCredits(list,_CRED_SB);
      const ly = pack(v.lyrics), co = pack(v.compose);
      if (ly.length + co.length >= CREDIT_MIN) _CREDITS.set(who, { ly, co });
    }
  }
  return _CREDITS.get(a) || null;
}
// 크레딧 이름 → 우리 유니버스 아티스트(2026-11-17). 이름만 같다고 잇지 않는다(동명이인) — 그 아티스트의 크레딧 목록(artist_credits.json)에
// **이 곡(b)이 실제로 들어 있고** 이름(한글·영문·표기명)이 같을 때만. 작사·작곡 곡 목록 페이지가 있는 사람(크레딧 CREDIT_MIN곡 이상)만 대상.
let _CREDIT_BY_SONG = null;
const _normCr = x => String(x || '').trim().toLowerCase();
function creditArtistFor(songB, name) {
  if (!_CREDIT_BY_SONG) {
    _CREDIT_BY_SONG = new Map();
    for (const a of artists) {
      const c = creditsFor(a); if (!c || !creditPagePath(a, 'ko')) continue;
      const names = [a.name && a.name.ko, a.name && a.name.en, a.displayName].filter(Boolean).map(_normCr);
      for (const s of [...c.ly, ...c.co]) for (const nm of names) { const k = s.b + '|' + nm; if (!_CREDIT_BY_SONG.has(k)) _CREDIT_BY_SONG.set(k, a); }
    }
  }
  return _CREDIT_BY_SONG.get(songB + '|' + _normCr(name)) || null;
}
function creditPagePath(a, lang) { const mp = memberPagePath(a, lang); return mp ? `${mp}credits/` : null; }
function creditLinkHtml(a, lang) {
  const c = creditsFor(a); if (!c) return '';
  const isEn = lang === 'en';
  return `<p class="note"><a href="${SITE}/${creditPagePath(a, lang)}">${isEn ? `Songs written or composed (${c.ly.length} lyrics · ${c.co.length} composition) →` : `작사 ${c.ly.length}곡 · 작곡 ${c.co.length}곡 보기 →`}</a></p>`;
}
function buildCreditPages() {
  let n = 0;
  // 곡 페이지 링크는 제목 기본형 + 멜론 곡 번호가 맞을 때만(2026-11-13 Codex — 소연이 JBJ에 써 준 'Say My Name'이 같은 그룹 미연 솔로
  // 'Say My Name' 페이지로, 창조 OST '안녕'이 틴탑 '안녕'으로 이어졌다). 그 곡 페이지 쪽 디스코에 번호가 하나도 없으면 예전처럼 제목만.
  const gbIds = new Map();
  const idsOf = g => { if (gbIds.has(g)) return gbIds.get(g); const m = new Map();
    let d = null; try { d = JSON.parse(fs.readFileSync(path.join(ROOT, 'disco/g', g.replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '') + '.json'), 'utf8')); } catch (e) {}
    const albums = d ? [...Object.values(d.g || {}), ...Object.values(d.m || {}).flatMap(x => [...(x.d || []), ...(x.u || []).flatMap(u => (u && u.albums) || [])])] : [];
    albums.forEach(al => (al && al.tracks || []).forEach(t => { if (!t || !t.title) return; const k = _CRED_SB(t.title); if (!m.has(k)) m.set(k, new Set()); if (t.songId) m.get(k).add(String(t.songId)); }));
    gbIds.set(g, m); return m; };
  const songHref = (a, s, lang) => { const b = s.b; for (const g of [a.group, ...(a.groups || [])]) { if (!g || !g.ko) continue; if (!(SONGS[g.ko] || []).some(x => x.b === b)) continue;
    const own = idsOf(g.ko).get(b); if (own && own.size && (s.ids || []).length && !(s.ids || []).some(i => own.has(i))) continue;
    return `${SITE}/${songPagePath(g.ko, b, lang)}`; } return null; };
  for (const a of artists) {
    const c = creditsFor(a); if (!c) continue;
    for (const lang of ['ko', 'en']) {
      const isEn = lang === 'en', rel = creditPagePath(a, lang); if (!rel) continue;
      const nm = isEn ? (a.name.en || a.name.ko) : a.name.ko;
      const gk = a.group && a.group.ko, gd = groups[gk] ? (isEn ? groups[gk].en || gk : gk) : '';
      const who = gd ? (isEn ? `${gd} ${nm}` : `${gd} ${nm}`) : nm;
      const both = new Set(c.ly.map(s => s.b).filter(b => c.co.some(s => s.b === b)));
      const li = s => { const h = songHref(a, s, lang); const t = escHtml(s.title); return `<li>${h ? `<a href="${h}">${t}</a>` : t}${both.has(s.b) ? (isEn ? ' <span class="yr">lyrics & music</span>' : ' <span class="yr">작사·작곡</span>') : ''}</li>`; };
      const h1 = isEn ? `${nm} — songs written & composed` : `${nm} 작사·작곡 곡`;
      const title = isEn ? `${who} Songwriting Credits — ${c.ly.length} Lyrics · ${c.co.length} Compositions | K-POP UNIVERSE` : `${bilingualLabel(who, `${groups[gk] ? (groups[gk].en || gk) : ''} ${a.name.en || a.name.ko}`.trim())} 작사·작곡 곡 목록 — 작사 ${c.ly.length}곡 · 작곡 ${c.co.length}곡 | K-POP UNIVERSE`;
      const top = [...new Set([...c.ly, ...c.co].map(s => s.title))].slice(0, 5).join(isEn ? ', ' : '·');
      const desc = isEn ? `${who} has ${c.ly.length} lyric and ${c.co.length} composition credits (Melon credits) — ${top}.` : `${who}${josa(nm, '이/가')} 작사에 참여한 곡 ${c.ly.length}곡, 작곡 ${c.co.length}곡(멜론 크레딧 기준) — ${top} 등.`;
      const mp = memberPagePath(a, lang);
      const body = `  <p class="note"><a href="${SITE}/${mp}">${isEn ? `${escHtml(nm)} fancams & profile →` : `${escHtml(nm)} 직캠·프로필 →`}</a></p>
  ${c.ly.length ? `<h2>${isEn ? `Lyrics (${c.ly.length})` : `작사 ${c.ly.length}곡`}</h2>
  <ul class="vid-list">${c.ly.map(li).join('')}</ul>` : ''}
  ${c.co.length ? `<h2>${isEn ? `Composition (${c.co.length})` : `작곡 ${c.co.length}곡`}</h2>
  <ul class="vid-list">${c.co.map(li).join('')}</ul>` : ''}
  <p class="note">${isEn ? 'Source: Melon songwriting credits. Remixes and versions of the same song are listed once.' : '출처: 멜론 작사·작곡 크레딧. 같은 곡의 리믹스·버전은 한 번만 적었어요.'}</p>`;
      const credNext = safeNext(() => [
        (() => { const hub = FANCAM_HUB.get(a); return hub && hub.length ? { k: isEn ? 'Member fancams' : '멤버 직캠', t: _nmOf(a, isEn), s: isEn ? hub.length + ' fancams' : '직캠 ' + hub.length + '개', img: hub[0].id || '', h: SITE + '/' + memberFancamPagePath(a, lang) } : null; })(),
        gk ? grpCard(gk, lang) : null,
        ...[...c.ly, ...c.co].filter((s, i, arr) => arr.findIndex(x => x.b === s.b) === i).map(s => ({ s, h: songHref(a, s, lang) })).filter(x => x.h).slice(0, 3).map(x => ({ k: isEn ? 'Song' : '곡', t: x.s.title, s: isEn ? 'Fancams & stages' : '직캠·무대 모음', m: x.s.title, h: x.h })),
      ]);
      writeSimple(rel, simplePageHtml({ next: credNext, lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${creditPagePath(a, isEn ? 'ko' : 'en')}`, koUrl: `${SITE}/${creditPagePath(a, 'ko')}`, title, h1, desc, body, kind: 'credits', ogImage: ogImageForMember(a) }), '0.5');
      n++;
    }
  }
  console.log(`작사·작곡 페이지 ${n / 2}명 × 2개 언어`);
}
// ── 앨범 페이지(2026-11-04, 검색 유입 확대 ⑧) ──────────────────────────────────────────────
// g/{그룹}/a/{앨범 기본형}/ · en/… — "에스파 Armageddon 수록곡"·"트랙리스트"·"타이틀곡" 검색 착지. groups.json 디스코의 미니·정규·리패키지·스페셜 **본판**만
// (변형판·싱글·OST·라이브·리믹스는 얇은 페이지가 돼서 뺀다), 수록곡 3곡 이상. 곡마다 멜론 작사·작곡(cr.l·cr.c), 곡 페이지가 있으면 잇는다.
const _ALBUM_KEEP = al => al && !al.variant && /^(미니|정규|리패키지|스페셜)/.test(al.type || '') && (al.tracks || []).length >= 3;
let _ALBUMS = null; // gko → [{al, slug}]
function albumsFor(gko) {
  if (!_ALBUMS) {
    _ALBUMS = {};
    for (const g of Object.keys(groups)) {
      const used = new Set(), out = [];
      for (const al of (groups[g].discography || []).filter(_ALBUM_KEEP).sort((x, y) => String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')))) {
        let slug = _CRED_SB(al.title || '') || 'album';
        if (used.has(slug)) slug += '-' + String(al.releaseDate || '').replace(/\D/g, '');
        if (used.has(slug)) continue; used.add(slug); out.push({ al, slug });
      }
      if (out.length) _ALBUMS[g] = out;
    }
  }
  return _ALBUMS[gko] || [];
}
function albumPagePath(gko, slug, lang) { const gp = groupPagePath(gko, lang); return gp ? `${gp}a/${slug}/` : null; }
const _ord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
function albumTypeEn(t) {
  const m = String(t || '').match(/(\d+)집/), n = m ? _ord(+m[1]) + ' ' : '';
  if (/리패키지/.test(t)) return n + (/정규/.test(t) ? 'Full Album ' : /미니/.test(t) ? 'Mini Album ' : '') + 'Repackage';
  if (/^정규/.test(t)) return n + 'Full Album'; if (/^미니/.test(t)) return n + 'Mini Album'; if (/^스페셜/.test(t)) return 'Special Album';
  return t;
}
// 그룹 페이지 디스코그래피 커버 격자 — 대표 앨범(discogItems) + 앨범 페이지가 있는 나머지(albumsFor)를 발매 최신순으로. 곡 타일(.sp-tiles)과 같은 모양.
// 스포티파이 커버는 640px 원본 대신 300px 판(같은 주소의 크기 코드만 다름)으로.
function discogTilesHtml(gko, discogItems, lang) {
  const isEn = lang === 'en';
  const slugOf = new Map(albumsFor(gko).map(x => [x.al, x.slug]));
  const seen = new Set(), list = [];
  [...discogItems, ...albumsFor(gko).map(x => x.al)].forEach(a => { if (!a || seen.has(a)) return; seen.add(a); list.push(a); });
  if (!list.length) return '';
  list.sort((a, b) => String(b.releaseDate || '').localeCompare(String(a.releaseDate || '')));
  const small = u => String(u || '').replace('/image/ab67616d0000b273', '/image/ab67616d00001e02');
  const items = list.slice(0, 48).map(a => {
    const yr = String(a.releaseDate || '').slice(0, 4), type = isEn ? typeEn(a.type) : a.type;
    const slug = slugOf.get(a), href = slug ? albumPagePath(gko, slug, lang) : null;
    const inner = `${a.cover ? `<img src="${escHtml(small(a.cover))}" alt="" loading="lazy">` : `<span class="sp-tile-ph"></span>`}<span class="sp-tile-t">${escHtml(a.title)}</span><span class="sp-tile-n">${escHtml([yr, type].filter(Boolean).join(' · '))}</span>`;
    return href ? `<a class="sp-tile" href="${SITE}/${href}">${inner}</a>` : `<div class="sp-tile">${inner}</div>`;
  }).join('\n      ');
  return `
    <h2 id="albums">${isEn ? 'Discography' : '디스코그래피'}</h2>
    <div class="sp-tiles dg-tiles">
      ${items}
    </div>`;
}
function albumLinksHtml(gko, lang) {
  const list = albumsFor(gko); if (!list.length) return '';
  const isEn = lang === 'en';
  return `
    <h2 id="albums">${isEn ? 'Albums & tracklists' : '앨범·수록곡'}</h2>
    <ul class="member-list rel">
      ${list.slice(0, 40).map(x => `<li><a href="${SITE}/${albumPagePath(gko, x.slug, lang)}">${escHtml(x.al.title)}</a> <span class="yr">${escHtml(String(x.al.releaseDate || '').slice(0, 4))}</span></li>`).join('\n      ')}
    </ul>`;
}
function buildAlbumPages() {
  let n = 0;
  for (const g of Object.keys(groups)) {
    const list = albumsFor(g); if (!list.length) continue;
    const songB = new Set((SONGS[g] || []).map(s => s.b));
    list.forEach(({ al, slug }, i) => {
      for (const lang of ['ko', 'en']) {
        const isEn = lang === 'en', rel = albumPagePath(g, slug, lang);
        const gd = isEn ? (groups[g].en || g) : g, date = String(al.releaseDate || ''), type = isEn ? albumTypeEn(al.type) : al.type;
        const names = arr => [...new Set((arr || []).map(x => Array.isArray(x) ? x[0] : x).filter(Boolean))].join(', ');
        const rows = (al.tracks || []).map(t => {
          const b = _CRED_SB(t.title || ''), href = b && songB.has(b) ? `${SITE}/${songPagePath(g, b, lang)}` : null;
          // 버전 곡(일본어·영어 버전·Inst. 등)은 원곡 페이지로 간다 — 누르기 전에 알 수 있게 작게 표기(2026-11-17 Codex: LUCID DREAM 'REBEL HEART -Japanese version-'이
          // 한국 원곡 MV·음방 페이지로 열리는데 표시가 없었다). 버전별 영상 아카이브는 없다.
          const isVer = !!href && /((japanese|korean|english|chinese)[ ]*ver|일본어|한국어|영어|중국어|버전|(^|[ (-])(ver[.]?|version)([ ).-]|$)|(^|[ (-])(inst[.]?|instrumental|remix|acoustic)([ ).-]|$))/i.test(t.title || '');
          const verTag = isVer ? ` <span class="yr">${isEn ? 'version · opens the original song page' : '버전 · 원곡 페이지로 이동'}</span>` : '';
          const cr = t.cr || {}, ly = names(cr.l), co = names(cr.c);
          // 작사·작곡 명단이 같으면 한 번만(2026-11-19 — 같은 열 몇 명이 두 번 반복돼 목록이 명단으로 뒤덮였다). 표시는 song-page.css가 작고 흐리게·두 줄까지만.
          const credit = ly && ly === co ? `${isEn ? 'Lyrics · Music' : '작사·작곡'} ${escHtml(ly)}`
            : [ly && `${isEn ? 'Lyrics' : '작사'} ${escHtml(ly)}`, co && `${isEn ? 'Music' : '작곡'} ${escHtml(co)}`].filter(Boolean).join(' · ');
          return `<li>${href ? `<a href="${href}">${escHtml(t.title)}</a>` : escHtml(t.title)}${verTag}${t.isTitle ? (isEn ? ' <b>(title)</b>' : ' <b>(타이틀)</b>') : ''}${credit ? `<br><span class="yr">${credit}</span>` : ''}</li>`;
        }).join('');
        const tt = al.titleTrack || ((al.tracks || []).find(t => t.isTitle) || {}).title || '';
        const h1 = isEn ? `${gd} — ${al.title}` : `${g} ${al.title}`;
        const title = isEn ? `${gd} '${al.title}' Tracklist — ${type} | K-POP UNIVERSE` : `${bilingualLabel(g, groups[g].en)} '${al.title}' 수록곡·트랙리스트 — ${type} | K-POP UNIVERSE`; // 발매일은 제목에서 뺌(11-17 사용자) — 설명에만
        const desc = isEn ? `${gd} ${type} '${al.title}' released ${date}${tt ? `, title track '${tt}'` : ''} — ${al.tracks.length} tracks with lyrics/music credits.` : `${g} ${type} '${al.title}'(${date} 발매)${tt ? ` 타이틀곡 '${tt}'` : ''} — 수록곡 ${al.tracks.length}곡과 곡별 작사·작곡.`;
        const nb = [list[i - 1], list[i + 1]].map((x, k) => x ? `<a href="${SITE}/${albumPagePath(g, x.slug, lang)}">${k ? '← ' : ''}${escHtml(x.al.title)}${k ? '' : ' →'}</a>` : '').filter(Boolean).join(' · ');
        const body = `  ${al.cover ? `<img class="sp-cover" src="${escHtml(al.cover)}" alt="${escHtml(al.title)}" loading="lazy" style="width:100%;max-width:320px;border-radius:12px;display:block;margin:4px 0 16px">` : ''}
  <p class="note"><a href="${SITE}/${groupPagePath(g, lang)}">${isEn ? `${escHtml(gd)} fancams & stages →` : `${escHtml(g)} 직캠·무대 모음 →`}</a></p>
  <h2>${isEn ? `Tracklist (${al.tracks.length})` : `수록곡 ${al.tracks.length}곡`}</h2>
  <ol class="vid-list">${rows}</ol>
  ${nb ? `<p class="note">${nb}</p>` : ''}
  <p class="note">${isEn ? 'Credits: Melon.' : '크레딧 출처: 멜론.'}</p>`;
        writeSimple(rel, simplePageHtml({ next: albumNextJson(g, al, slug, i, list, songB, lang), lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${albumPagePath(g, slug, isEn ? 'ko' : 'en')}`, koUrl: `${SITE}/${albumPagePath(g, slug, 'ko')}`, title, h1, desc, body, kind: 'album', ogImage: al.cover || undefined }), '0.5');
        n++;
      }
    });
  }
  console.log(`앨범 페이지 ${n / 2}장 × 2개 언어`);
}
function buildAgencyPages() {
  const by = {};
  groupKos.forEach(g => String(groups[g].co || '').split('/').map(s => s.trim()).filter(Boolean).forEach(a => {
    const n = AGENCY_ALIAS[a] || a; if (AGENCY_SKIP.has(n)) return; (by[n] = by[n] || new Set()).add(g);
  }));
  const gPri = g => +(groups[g].pri || 0);
  const list = Object.entries(by).filter(([, s]) => s.size >= 3).map(([n, s]) => [n, [...s].sort((p, q) => (groups[q].active !== false) - (groups[p].active !== false) || gPri(q) - gPri(p) || String(groups[q].debut || '').localeCompare(String(groups[p].debut || '')))]).sort((x, y) => y[1].length - x[1].length);
  AGENCY_LINKS = list.map(([n, gs]) => ({ name: n, n: gs.length }));
  for (const [name, gs] of list) for (const lang of ['ko', 'en']) {
    const isEn = lang === 'en';
    const nameEn = agencyEn(name) || name;
    const disp = isEn ? nameEn : name;
    const nm = g => isEn ? (groups[g].en || g) : g;
    const rel = agencyPagePath(name, lang);
    const h1 = isEn ? `${disp} K-pop groups` : `${name} 소속 아이돌`;
    const title = isEn ? `${disp} K-pop Groups — ${gs.slice(0, 4).map(nm).join(', ')} (${gs.length}) | K-POP UNIVERSE` : `${bilingualLabel(name, nameEn)} 소속 아이돌 - ${gs.slice(0, 4).map(nm).join('·')} 등 ${gs.length}팀 | K-POP UNIVERSE`;
    const desc = isEn ? `${gs.length} K-pop groups from ${disp}: ${gs.slice(0, 10).map(nm).join(', ')}. Members, debut dates and fancams.` : `${name} 소속(출신) 아이돌 그룹 ${gs.length}팀 — ${gs.slice(0, 10).map(nm).join(', ')}. 멤버·데뷔일·직캠 모음으로 바로 가요.`;
    const body = `  <div class="sp-tiles">
    ${gs.map(g => groupTileHtml(g, lang, `${String(groups[g].debut || '').slice(0, 4)}${groups[g].active === false ? (isEn ? ' · disbanded' : ' · 해체') : ''}`)).join('\n    ')}
  </div>`;
    writeSimple(rel, simplePageHtml({ next: safeNext(() => gs.slice(0, 5).map(g => grpCard(g, lang))), lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${agencyPagePath(name, isEn ? 'ko' : 'en')}`, koUrl: `${SITE}/${agencyPagePath(name, 'ko')}`, title, h1, desc, body, kind: 'agency' }), '0.6');
  }
  console.log(`소속사 페이지 ${list.length}개 × 2개 언어`);
}

// ── 음방 회차 페이지(2026-11-03, 사용자 "참고할 건 참고하자" — zzalbox의 '엠카 10/22 직캠 69개' 회차 묶음 참고) ───────────────
// show/{방송}/{yyyy-mm-dd}/ — 그 회차에 나온 팀별 무대·풀캠·직캠·페이스캠·앵콜. "인기가요 1101 직캠"·"엠카 출연진" 검색 착지 + 1위 기록 연결.
// 출처는 방송사 공식 채널 9개만(팬 업로드 섞지 않음). 회차 날짜 = ①제목 속 날짜(261030·2026.10.22·20261025)가 그 방송 요일과 맞을 때
// ②없으면 같은 방송 다른 영상에서 배운 'EP.번호→날짜' ③그래도 없으면 올린 날(KST) 기준 3일 안의 직전 방송일. 해외 특집(뮤직뱅크 인 바르셀로나 등)은 요일이 안 맞아 빠진다.
// 쇼츠·인터뷰·챌린지는 뺀다. 조회는 부분 인덱스 idx_ytv_music_show_ch(sql/music_show_episode_index_2026-11-03.sql)를 탄다 — 없으면 큰 채널이 시간 초과.
// 방송 목록·회차 묶기 규칙은 shared.js(_MS_SHOWS·_msGroupEpisodes) — 앱 회차 화면과 같은 함수
const { _MS_SHOWS: MSHOWS, _msGroupEpisodes, _MS_KIND_LABEL: MS_KIND } = (() => { const vm = require('vm'); const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + '\nthis.o={_MS_SHOWS,_msGroupEpisodes,_MS_KIND_LABEL};', ctx); return ctx.o; })();
const MS_MIN = 8; // 영상이 이보다 적은 회차는 안 낸다(수집이 덜 된 회차가 빈약한 페이지로 색인되는 것 방지)
let SHOW_EP = {}; // '방송|날짜' → 방송 (1위 연도 페이지에서 날짜를 회차 페이지로 잇는다)
function showPagePath(s, date, lang) { const isEn = lang === 'en'; return `${isEn ? 'en/' : ''}show/${isEn ? s.slug : s.key}/${date ? date + '/' : ''}`; }
async function fetchShowVideos() {
  const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const all = new Map();
  for (const h of [...new Set(MSHOWS.flatMap(s => s.h))]) {
    for (let off = 0; ; off += 1000) {
      const q = `yt_channel_videos?select=id,title,group_ko,members,published_ts,view_count,source_handle,content_flag&source_handle=eq.${encodeURIComponent(h)}&is_short=eq.false&published_ts=gte.${since}&order=published_ts,id&limit=1000&offset=${off}`;
      const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`${h} ${r.status}`);
      const j = await r.json(); j.forEach(v => all.set(v.id, v));
      if (j.length < 1000) break;
      await new Promise(r2 => setTimeout(r2, 100)); // 채널별 연속 조회도 쉬어가며(2026-11-17)
    }
  }
  return [...all.values()].filter(v => !['무관', '보류', 'hidden'].includes(v.content_flag) && v.group_ko);
}
function groupShowEpisodes(vids) { return _msGroupEpisodes(vids, MS_MIN); }
async function buildShowPages() {
  const vids = await fetchShowVideos();
  const eps = groupShowEpisodes(vids);
  const winsBy = {}; (EX.allWins || []).forEach(w => { const k = w.show + '|' + String(w.win_date).slice(0, 10); (winsBy[k] = winsBy[k] || []).push(w); });
  const byShow = {}; eps.forEach(e => (byShow[e.s.key] = byShow[e.s.key] || []).push(e));
  SHOW_EP = {}; eps.forEach(e => { SHOW_EP[e.s.key + '|' + e.date] = e.s; });
  const fmtD = (d, isEn) => isEn ? d : d.replace(/-/g, '.');
  const gName = (g, isEn) => isEn ? (groups[g] && groups[g].en || g) : g;
  // 그룹으로 묶되, 해체한 팀 이름으로 잡힌 솔로(워너원 → 김재환)는 사람 이름으로 보여준다
  const performer = (g, list, isEn) => {
    if (g.includes('|')) { const [gg, nm] = g.split('|'); const a = artists.find(x => x.name.ko === nm && ((x.groups || []).some(y => y && y.ko === gg) || (x.group && x.group.ko === gg))); return { name: a ? (isEn ? a.name.en || a.name.ko : a.name.ko) : nm, href: a && memberPagePath(a, isEn ? 'en' : 'ko') ? `${SITE}/${memberPagePath(a, isEn ? 'en' : 'ko')}` : '' }; }
    const ms = new Set(list.flatMap(r => r.v.members || []));
    if (groups[g] && groups[g].active === false && ms.size === 1) { const nm = [...ms][0]; const a = artists.find(x => x.name.ko === nm && (x.groups || []).some(y => y && y.ko === g)); return { name: a ? (isEn ? a.name.en || a.name.ko : a.displayName || a.name.ko) : nm, href: a ? `${SITE}/${memberPagePath(a, isEn ? 'en' : 'ko')}` : '' }; }
    return { name: gName(g, isEn), href: groups[g] ? `${SITE}/${groupPagePath(g, isEn ? 'en' : 'ko')}` : '' };
  };
  const ORDER = ['stage', 'encore', 'fullcam', 'fancam', 'facecam'];
  for (const e of eps) for (const lang of ['ko', 'en']) {
    const isEn = lang === 'en', s = e.s, sName = isEn ? s.en : s.key;
    const byG = new Map(); e.list.forEach(r => { if (!byG.has(r.v.group_ko)) byG.set(r.v.group_ko, []); byG.get(r.v.group_ko).push(r); });
    // 그 회차에 그룹 전체(멤버 비었거나 둘 이상) 영상이 하나도 없으면 멤버 한 명씩 따로 — 솔로 출연(2026-11-12 Codex: 샤오쥔이 WayV, 지수가 BLACKPINK, 워너원 한 칸에 김재환·박우진)
    const teams = new Map();
    for (const [g, l] of byG) {
      const groupWide = l.some(r => (r.v.members || []).length !== 1);
      if (groupWide) { teams.set(g, l); continue; }
      l.forEach(r => { const k = g + '|' + r.v.members[0]; if (!teams.has(k)) teams.set(k, []); teams.get(k).push(r); });
    }
    const wins = winsBy[s.key + '|' + e.date] || [];
    const winG = new Set(wins.flatMap(w => [w.group_ko, w.group_ko && w.member_ko ? w.group_ko + '|' + w.member_ko : null, w.member_ko]).filter(Boolean));
    const tl = [...teams.entries()].sort((x, y) => winG.has(y[0]) - winG.has(x[0]) || y[1].length - x[1].length);
    const cnt = k => e.list.filter(r => r.kind === k).length;
    const cams = cnt('fancam') + cnt('facecam') + cnt('fullcam');
    const names = tl.map(([g, l]) => performer(g, l, isEn).name);
    const list = byShow[s.key], i = list.indexOf(e), prev = list[i - 1], next = list[i + 1];
    const rel = showPagePath(s, e.date, lang);
    const h1 = isEn ? `${sName} ${e.date} — stages & fancams` : `${s.key} ${fmtD(e.date)} 무대·직캠 모아보기`;
    const title = isEn ? `${sName} ${e.date} Lineup — ${names.slice(0, 4).join(', ')} · ${cams} Fancams | K-POP UNIVERSE`
      : `${bilingualLabel(s.key, s.en)} ${e.date.slice(2).replace(/-/g, '')} 출연진·직캠 - ${names.slice(0, 4).join('·')} 등 ${tl.length}팀 | K-POP UNIVERSE`;
    const winTxt = wins.map(w => `${w.group_ko ? gName(w.group_ko, isEn) : (w.member_ko || '')} '${w.song_title}'`).join(', ');
    const desc = isEn ? `${sName} on ${e.date}: ${tl.length} acts (${names.slice(0, 8).join(', ')}), ${cnt('stage')} stages and ${cams} fancams from the official channel.${winTxt ? ` No.1: ${winTxt}.` : ''}`
      : `${fmtD(e.date)} ${s.key} 출연 ${tl.length}팀(${names.slice(0, 8).join(', ')}) — 공식 채널 무대 ${cnt('stage')}개·직캠 ${cams}개를 팀별로.${winTxt ? ` 1위: ${winTxt}.` : ''}`;
    const card = r => `<a class="card" href="https://www.youtube.com/watch?v=${r.v.id}" target="_blank" rel="noopener"><span class="card-th"><img src="https://i.ytimg.com/vi/${r.v.id}/mqdefault.jpg" alt="" loading="lazy"></span><span class="card-t">${escHtml(r.v.title)}</span><span class="card-y">${[MS_KIND[r.kind][isEn ? 1 : 0], r.kind !== 'stage' && r.kind !== 'encore' && (r.v.members || []).length === 1 ? r.v.members[0] : '', r.v.view_count ? SEO.fmtVC(r.v.view_count) : ''].filter(Boolean).map(escHtml).join(' · ')}</span></a>`;
    const sections = tl.map(([g, l], idx) => {
      const p = performer(g, l, isEn);
      l.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (b.v.view_count || 0) - (a.v.view_count || 0));
      const won = winG.has(g) ? (isEn ? ' 🏆 No.1' : ' 🏆 1위') : '';
      return `  <h2 class="rank-h" id="t${idx}">${p.href ? `<a href="${p.href}">${escHtml(p.name)}</a>` : escHtml(p.name)}${won} <span class="rank-n">${l.length}</span></h2>
  <div class="grid">${l.map(card).join('')}</div>`;
    }).join('\n');
    const nav = `<p class="note">${prev ? `<a href="${SITE}/${showPagePath(s, prev.date, lang)}">← ${fmtD(prev.date, isEn)}</a>` : ''}${prev && next ? ' · ' : ''}${next ? `<a href="${SITE}/${showPagePath(s, next.date, lang)}">${fmtD(next.date, isEn)} →</a>` : ''}</p>`;
    const body = `  <div class="crumbs"><a href="${SITE}/${isEn ? 'en/' : ''}show/">${isEn ? 'Music shows' : '음악방송'}</a> › <a href="${SITE}/${showPagePath(s, null, lang)}">${escHtml(sName)}</a></div>
  <ul class="chips">${wins.length ? `<li><b>${isEn ? 'No.1' : '1위'}</b>${escHtml(winTxt)}</li>` : ''}<li><b>${isEn ? 'Acts' : '출연'}</b>${tl.length}${isEn ? '' : '팀'}</li><li><b>${isEn ? 'Stages' : '무대'}</b>${cnt('stage')}</li><li><b>${isEn ? 'Fancams' : '직캠'}</b>${cams}</li></ul>
  <p><a class="cta" href="${SITE}/#show=${encodeURIComponent(s.key + '~' + e.date)}">${isEn ? 'Open this episode in the app →' : '앱에서 이 회차 보기 →'}</a></p>
  ${nav}
  <ul class="chips">${tl.map(([g, l], idx) => `<li><a href="#t${idx}">${escHtml(performer(g, l, isEn).name)}</a></li>`).join('')}</ul>
${sections}
  ${nav}
  <p class="note">${isEn ? `Videos from ${sName}'s official YouTube channels. ` : `${s.key} 공식 유튜브 채널 영상만 모았어요. `}<a href="${SITE}/${winsPagePath(e.date.slice(0, 4), lang)}">${isEn ? `${e.date.slice(0, 4)} music show wins` : `${e.date.slice(0, 4)} 음방 1위 목록`}</a></p>`;
    const top = e.list.find(r => r.kind === 'stage') || e.list[0];
    const epCard = (x, k) => x ? { k, t: sName + ' ' + fmtD(x.date, isEn), s: isEn ? x.list.length + ' videos' : '영상 ' + x.list.length + '개', img: ((x.list.find(r => r.kind === 'stage') || x.list[0] || {}).v || {}).id || '', h: SITE + '/' + showPagePath(s, x.date, lang) } : null;
    const showNext = safeNext(() => [
      ...tl.slice(0, 3).map(([g, l]) => { const pf = performer(g, l, isEn); return pf.href ? { k: isEn ? 'On this episode' : '이 회차 출연', t: pf.name, s: isEn ? l.length + ' videos' : '영상 ' + l.length + '개', img: _topVidId(l.map(r => r.v)), h: pf.href } : null; }),
      epCard(next, isEn ? 'Next episode' : '다음 회차'), epCard(prev, isEn ? 'Previous episode' : '지난 회차'),
    ].filter(Boolean));
    writeSimple(rel, simplePageHtml({ next: showNext, lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${showPagePath(s, e.date, isEn ? 'ko' : 'en')}`, koUrl: `${SITE}/${showPagePath(s, e.date, 'ko')}`, title, h1, desc, body, kind: 'show_ep', ogImage: wideThumb(top.v.id) }), '0.5');
  }
  // 방송별 목록 + 음방 허브 — og:image는 최근 회차 대표 영상(SHOWS_ONLY 빠른 경로엔 ensureOgImages 안전망이 없어 직접 넣는다, Codex 검수 11-03)
  const epOg = e => { const t = e && (e.list.find(r => r.kind === 'stage') || e.list[0]); return t ? wideThumb(t.v.id) : null; };
  for (const lang of ['ko', 'en']) {
    const isEn = lang === 'en';
    const showsWith = MSHOWS.filter(s => byShow[s.key]);
    for (const s of showsWith) {
      const list = byShow[s.key].slice().reverse(), sName = isEn ? s.en : s.key, rel = showPagePath(s, null, lang);
      const rowsHtml = list.map(e => { const w = winsBy[s.key + '|' + e.date] || []; const teams = new Set(e.list.map(r => r.v.group_ko)); return `<tr><td><a href="${SITE}/${showPagePath(s, e.date, lang)}">${fmtD(e.date, isEn)}</a></td><td>${teams.size}${isEn ? '' : '팀'}</td><td>${escHtml(w.map(x => `${x.group_ko ? gName(x.group_ko, isEn) : x.member_ko || ''} '${x.song_title}'`).join(', '))}</td></tr>`; }).join('\n    ');
      const h1 = isEn ? `${sName} — episodes` : `${s.key} 회차별 무대·직캠`;
      const desc = isEn ? `${list.length} ${sName} episodes with lineup, No.1 and every stage & fancam from the official channel.` : `${s.key} ${list.length}회차 — 회차마다 출연진·1위·공식 채널 무대와 직캠을 팀별로 모았어요.`;
      const showListNext = safeNext(() => [
        ...list.slice(0, 3).map(e => { const n = new Set(e.list.map(r => r.v.group_ko)).size; return { k: isEn ? 'Recent episode' : '최근 회차', t: sName + ' ' + fmtD(e.date, isEn), s: isEn ? n + ' acts' : n + '팀', img: ((e.list.find(r => r.kind === 'stage') || e.list[0] || {}).v || {}).id || '', h: SITE + '/' + showPagePath(s, e.date, lang) }; }),
        list[0] ? { k: isEn ? 'Music show wins' : '음방 1위', t: isEn ? list[0].date.slice(0, 4) + ' music show wins' : list[0].date.slice(0, 4) + ' 음악방송 1위', h: SITE + '/' + winsPagePath(list[0].date.slice(0, 4), lang) } : null,
      ].filter(Boolean));
      writeSimple(rel, simplePageHtml({ next: showListNext, lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${showPagePath(s, null, isEn ? 'ko' : 'en')}`, koUrl: `${SITE}/${showPagePath(s, null, 'ko')}`, title: `${h1} | K-POP UNIVERSE`, h1, desc, kind: 'show', ogImage: epOg(byShow[s.key][byShow[s.key].length - 1]),
        body: `  <div class="crumbs"><a href="${SITE}/${isEn ? 'en/' : ''}show/">${isEn ? 'Music shows' : '음악방송'}</a></div>
  <table class="win-tbl"><thead><tr><th>${isEn ? 'Date' : '날짜'}</th><th>${isEn ? 'Acts' : '출연'}</th><th>${isEn ? 'No.1' : '1위'}</th></tr></thead><tbody>
    ${rowsHtml}
  </tbody></table>` }), '0.6');
    }
    const rel = `${isEn ? 'en/' : ''}show/`;
    const h1 = isEn ? 'K-pop music shows — every episode' : '음악방송 회차별 모아보기';
    const desc = isEn ? 'Music Bank, Inkigayo, M Countdown, Show! Music Core, Show Champion, THE SHOW — lineup, No.1, stages and fancams per episode.' : '뮤직뱅크·인기가요·엠카운트다운·음악중심·쇼챔피언·더쇼 — 회차마다 출연진·1위·무대·직캠을 한 페이지에.';
    const showHubNext = safeNext(() => showsWith.slice(0, 5).map(s => { const l = byShow[s.key], e = l[l.length - 1]; const n = new Set(e.list.map(r => r.v.group_ko)).size; return { k: isEn ? s.en : s.key, t: (isEn ? s.en : s.key) + ' ' + fmtD(e.date, isEn), s: isEn ? 'Latest · ' + n + ' acts' : '최근 회차 · ' + n + '팀', img: ((e.list.find(r => r.kind === 'stage') || e.list[0] || {}).v || {}).id || '', h: SITE + '/' + showPagePath(s, e.date, lang) }; }));
    writeSimple(rel, simplePageHtml({ next: showHubNext, lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${isEn ? '' : 'en/'}show/`, koUrl: `${SITE}/show/`, title: `${h1} | K-POP UNIVERSE`, h1, desc, kind: 'show_hub', ogImage: epOg(eps[eps.length - 1]),
      body: showsWith.map(s => { const l = byShow[s.key].slice(-6).reverse(); return `  <h2 class="rank-h"><a href="${SITE}/${showPagePath(s, null, lang)}">${escHtml(isEn ? s.en : s.key)}</a> <span class="rank-n">${byShow[s.key].length}</span></h2>
  <ul class="chips">${l.map(e => `<li><a href="${SITE}/${showPagePath(s, e.date, lang)}">${fmtD(e.date, isEn)}</a> ${new Set(e.list.map(r => r.v.group_ko)).size}</li>`).join('')}</ul>`; }).join('\n') }), '0.7');
  }
  console.log(`음방 회차 페이지 ${eps.length}회차 × 2개 언어 (${MSHOWS.map(s => `${s.key} ${(byShow[s.key] || []).length}`).join(' · ')})`);
}

// ── 음악방송 1위 목록(2026-10-30, 검색 유입 ⑦ — "2026 음방 1위"·"음악방송 1위 목록") ────────────────────────────────────────────
// music_show_wins(매일 자동 수집)를 해마다 한 장: 1위 많은 아티스트 순 + 날짜순 전체 목록. 20회 이상인 해만. 경로: wins/{년}/ (+ en/)
let WIN_YEARS = [];
function winsPagePath(y, lang) { return `${lang === 'en' ? 'en/' : ''}wins/${y}/`; }
function buildWinsPages() {
  const all = (EX.allWins || []).filter(w => w.win_date && w.song_title);
  const byY = {};
  all.forEach(w => { const y = String(w.win_date).slice(0, 4); (byY[y] = byY[y] || []).push(w); });
  WIN_YEARS = Object.keys(byY).filter(y => byY[y].length >= 20).sort();
  const who = (w, isEn) => { const g = w.group_ko && groups[w.group_ko] ? w.group_ko : null;
    if (g) return { name: isEn ? (groups[g].en || g) : g, href: `${SITE}/${groupPagePath(g, isEn ? 'en' : 'ko')}` };
    const a = w.member_ko && artists.find(x => x.name.ko === w.member_ko);
    return { name: a ? (isEn ? (a.name.en || a.name.ko) : a.name.ko) : (w.member_ko || w.group_ko || ''), href: a ? `${SITE}/${memberPagePath(a, isEn ? 'en' : 'ko')}` : '' }; };
  for (const y of WIN_YEARS) for (const lang of ['ko', 'en']) {
    const isEn = lang === 'en';
    const list = byY[y].slice().sort((a, b) => String(b.win_date).localeCompare(String(a.win_date)));
    const cnt = new Map(); list.forEach(w => { const k = who(w, isEn); const key = k.name; const c = cnt.get(key) || { k, n: 0, songs: new Set() }; c.n++; c.songs.add(w.song_title); cnt.set(key, c); });
    const top = [...cnt.values()].sort((a, b) => b.n - a.n);
    const rel = winsPagePath(y, lang);
    const h1 = isEn ? `K-pop music show wins in ${y}` : `${y} 음악방송 1위 목록`;
    const title = isEn ? `${y} K-pop Music Show Wins — ${top.slice(0, 3).map(x => `${x.k.name} ${x.n}`).join(', ')} | K-POP UNIVERSE` : `${y} 음악방송 1위 목록 - ${top.slice(0, 3).map(x => `${x.k.name} ${x.n}회`).join('·')} | ${y} K-pop Music Show Wins | K-POP UNIVERSE`;
    const desc = isEn ? `All ${list.length} K-pop music show wins of ${y} (Music Bank, Inkigayo, M Countdown…). Most wins: ${top.slice(0, 5).map(x => `${x.k.name} (${x.n})`).join(', ')}.` : `${y}년 음악방송 1위 ${list.length}회 전체(뮤직뱅크·인기가요·엠카운트다운 등). 최다 1위: ${top.slice(0, 5).map(x => `${x.k.name} ${x.n}회`).join(', ')}.`;
    const link = (k, t) => k.href ? `<a href="${k.href}">${escHtml(t)}</a>` : escHtml(t);
    const body = `  <ul class="rank-tabs">${WIN_YEARS.slice().reverse().map(o => o === y ? `<li class="on">${o}</li>` : `<li><a href="${SITE}/${winsPagePath(o, lang)}">${o}</a></li>`).join('')}</ul>
  <h2>${isEn ? 'Most wins' : '1위 많이 한 아티스트'}</h2>
  <ol class="win-top">
    ${top.slice(0, 20).map(x => `<li>${link(x.k, x.k.name)} <b>${x.n}${isEn ? '' : '회'}</b> <span>${escHtml([...x.songs].slice(0, 3).join(', '))}</span></li>`).join('\n    ')}
  </ol>
  <h2>${isEn ? 'All wins by date' : '날짜별 전체 1위'}</h2>
  <table class="win-tbl"><thead><tr><th>${isEn ? 'Date' : '날짜'}</th><th>${isEn ? 'Show' : '방송'}</th><th>${isEn ? 'Artist' : '아티스트'}</th><th>${isEn ? 'Song' : '곡'}</th></tr></thead><tbody>
    ${list.map(w => { const k = who(w, isEn); const epS = SHOW_EP[w.show + '|' + String(w.win_date).slice(0, 10)]; const dTxt = escHtml(String(w.win_date).slice(5).replace('-', '.')); return `<tr><td>${epS ? `<a href="${SITE}/${showPagePath(epS, String(w.win_date).slice(0, 10), lang)}">${dTxt}</a>` : dTxt}</td><td>${escHtml(w.show || '')}</td><td>${link(k, k.name)}</td><td>${escHtml(w.song_title)}</td></tr>`; }).join('\n    ')}
  </tbody></table>`;
    const winsNext = safeNext(() => [
      ...top.slice(0, 3).filter(x => x.k.href).map(x => ({ k: isEn ? 'Most wins' : '1위 많이 한 아티스트', t: x.k.name, s: isEn ? x.n + ' wins' : x.n + '회', h: x.k.href })),
      ...[WIN_YEARS[WIN_YEARS.indexOf(y) - 1], WIN_YEARS[WIN_YEARS.indexOf(y) + 1]].filter(Boolean).map(o => ({ k: isEn ? 'Another year' : '다른 연도', t: isEn ? o + ' music show wins' : o + ' 음악방송 1위', h: SITE + '/' + winsPagePath(o, lang) })),
    ]);
    writeSimple(rel, simplePageHtml({ next: winsNext, lang, selfUrl: `${SITE}/${rel}`, altUrl: `${SITE}/${winsPagePath(y, isEn ? 'ko' : 'en')}`, koUrl: `${SITE}/${winsPagePath(y, 'ko')}`, title, h1, desc, body, kind: 'wins' }), y >= String(+TODAY_ISO.slice(0, 4) - 1) ? '0.7' : '0.5');
  }
  console.log(`음방 1위 연도 페이지 ${WIN_YEARS.length}개 × 2개 언어 (1위 기록 ${all.length}건)`);
}

// 빠른 모드(2026-11-03, 사용자 "최근 회차는 빨리") — 전체 4만 장 재빌드(주 1회·20분)를 기다리지 않고 음방 회차 페이지만 몇 분 안에.
// show-pages.yml이 매시간 SHOWS_ONLY=1로 돌린다. 사이트맵 목록(sitemap.xml)은 전체 빌드가 이미 shows.xml을 가리키므로 shows.xml만 다시 쓴다.
if (process.env.SHOWS_ONLY) (async () => {
  try { EX = await SEO.prefetch({ SB_URL, SB_KEY, groupKos }); } catch (e) { console.warn('⚠️ 1위 기록 건너뜀:', e.message); }
  await buildShowPages();
  const urls = pages.filter(p => /\/show\//.test(p.loc));
  fs.mkdirSync(path.join(ROOT, 'sitemaps'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'sitemaps', 'shows.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY_ISO}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority || '0.5'}</priority>\n  </url>`).join('\n')}
</urlset>
`);
  console.log(`sitemaps/shows.xml ${urls.length}개`);
})().catch(e => { console.error(e); process.exit(1); });
else (async () => {
  // 1) DB 보강(음방 1위·인기 직캠) → 2) 그룹·멤버 페이지. DB가 안 되면(회사망 등) 정적 정보만으로 만든다.
  // 솔로 키(group_ko=이름) 영상도 같이 긁는다(2026-11-15) — 멤버 페이지가 그룹 개인 직캠+솔로 활동을 다 싣도록(앱 멤버 카드와 같은 범위).
  // soloKoOf가 거르는 이름(동명이인·그룹명 충돌)은 제외, 대부분 빈 키라 요청당 인덱스 조회 1번씩.
  const soloKos = [...new Set(artists.map(soloKoOf).filter(Boolean))];
  const videoKos = groupKos.concat(soloKos);
  try {
    EX = await SEO.prefetch({ SB_URL, SB_KEY, groupKos: videoKos });
    console.log(`보강 데이터: 1위 기록 ${Object.keys(EX.wins).length}그룹 · 인기 영상 ${Object.keys(EX.top).length}키(솔로 키 ${soloKos.length}개 포함 조회)`);
  } catch (e) { console.warn('⚠️ DB 보강 건너뜀:', e.message); }
  // 곡 페이지용 영상 — 그룹 페이지에 곡 링크를 실어야 하므로 그룹 페이지보다 먼저
  try {
    const vids = await SEO.prefetchGroupVideos({ SB_URL, SB_KEY, groupKos: videoKos });
    const emptyVidGroups = groupKos.filter(g => !vids[g] || !vids[g].length);
    if (emptyVidGroups.length) console.warn(`⚠️ 영상 0개 그룹 ${emptyVidGroups.length}개: ${emptyVidGroups.slice(0, 10).join(', ')}${emptyVidGroups.length > 10 ? ' ...' : ''}`);
    VIDS = vids;
    SONGS = SEO.buildSongs({ ROOT, groups, artists, EX, vids });
    console.log(`곡 데이터: ${Object.keys(SONGS).length}그룹 · ${Object.values(SONGS).reduce((n, l) => n + l.length, 0)}곡`);
    try { computeCoverOrigins(); } catch (e) { console.warn('[커버 원곡] 건너뜀: ' + e.message); } // 곡 페이지 '원곡·커버' 칩 — 디스코 파일만 읽는다(DB 없음)
    computeMemberSongs(); // 멤버 페이지에 '곡별 직캠'을 실어야 하므로 멤버 페이지보다 먼저
    computeFancamHubs(); // 멤버·멤버×곡 페이지가 직캠 전체 페이지로 링크하므로 그보다 먼저
  } catch (e) { console.warn('⚠️ 곡 페이지 건너뜀:', e.message); }
  // 공유 미리보기 16:9 썸네일 확인(곡·멤버×곡·직캠 전체 페이지 대표 영상) — 실패해도 mqdefault로 빌드는 계속
  try {
    const ids = [];
    for (const gko of Object.keys(SONGS)) for (const s of SONGS[gko]) { const p = songShareVideo(s.vids); if (p) ids.push(p.id); (MEMBER_SONGS_BY_SONG.get(gko + '|' + s.b) || []).forEach(ms => { const q = songShareVideo(ms.vids); if (q) ids.push(q.id); }); }
    FANCAM_HUB.forEach(f => ids.push(f[0].id));
    await probeWide(ids);
  } catch (e) { console.warn('⚠️ 16:9 썸네일 확인 건너뜀:', e.message); }
  try { await fetchProfilePics(); } catch (e) { console.warn(`⚠️ 프로필 사진 미리 받기 실패 — 그룹·멤버 페이지는 예전 표지로: ${e.message}`); }
  try { CHEM_RAW = await fetchChemPairs(); } catch (e) { console.warn(`⚠️ 케미 쌍 미리 받기 실패 — 재생 화면 케미 카드 없이: ${e.message}`); }
  buildGroupPages();
  buildMemberPages();
  redirectStaleMemberPages();
  writeSoloDisambigPages();
  buildSongPages();
  buildFancamPages();
  buildRankPages();
  buildProgramPages();
  buildYearPages();
  buildAgencyPages();
  try { buildAlbumPages();
    let ra = 0;
    for (const g of Object.keys(groups)) { if (!albumsFor(g).length) continue;
      for (const lang of ['ko', 'en']) { const gp = groupPagePath(g, lang); if (gp) ra += retireStaleDirs(path.join(ROOT, gp, 'a'), `${gp}a/`, `${SITE}/${gp}`, lang === 'en' ? (groups[g].en || g) : g, lang); } }
    if (ra) console.log(`이번에 안 만든 옛 앨범 페이지 → 그룹 페이지로 넘김 ${ra}개`);
  } catch (e) { console.error('⚠️ 앨범 페이지 실패 — 이 단계만 건너뜀:', e.message); }
  try { buildCreditPages(); } catch (e) { console.error('⚠️ 작사·작곡 페이지 실패 — 이 단계만 건너뜀:', e.message); } // 새 단계라 실패해도 전체 빌드는 계속(2026-11-04)
  try { await buildShowPages(); } catch (e) { console.warn(`⚠️ 음방 회차 페이지 건너뜀: ${e.message}`); }
  buildWinsPages();
  try { await buildChemPages(); } catch (e) { console.warn(`⚠️ 조합 페이지 건너뜀(기존 페이지 유지): ${e.message}`); }
  // 위 페이지들이 쓴 대표 영상 중 16:9 확인 안 된 것 — 지금 확인해 og_wide.json에 저장(이번 빌드엔 mqdefault로 나갔고 다음 빌드부터 큰 이미지)
  try { if (WIDE_MISS.size) { console.log(`16:9 썸네일 미확인 영상 ${WIDE_MISS.size}개 — 확인해서 저장`); await probeWide([...WIDE_MISS]); } } catch (e) { console.warn('⚠️ 미확인 16:9 썸네일 확인 건너뜀:', e.message); }
  console.log(`곡 페이지 ${songPageCount}곡 · 멤버×곡 페이지 ${memberSongPageCount}개 × 2개 언어`);
  let relPages = [], hubLinks = { ko: [], en: [] };
  try {
    const r = await buildRelationPages();
    relPages = r.sitemap; hubLinks = r.hubLinks;
    console.log(`관계 페이지 ${relPageCount}개 생성 (/collab/, /cover/ · 양 언어)`);
  } catch (e) {
    const existing = existingRelPages();
    relPages = existing.sitemap; hubLinks = existing.hubLinks;
    console.warn(`⚠️ 관계 페이지 건너뜀 (${e.message}) — 기존 ${relPages.length}개와 허브 링크 유지`);
    console.warn('   인증서 오류면 node --use-system-ca build_group_pages.js 로 재실행');
  }

  // 허브는 관계 페이지 목록을 실어야 하므로 여기서 쓴다(위 pages.push는 sitemap 기록용)
  const byN = (a, b) => b.n - a.n;
  fs.mkdirSync(path.join(ROOT, 'g'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'en', 'g'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'g', 'index.html'), hubPageHtml('ko', hubLinks.ko.sort(byN)));
  fs.writeFileSync(path.join(ROOT, 'en', 'g', 'index.html'), hubPageHtml('en', hubLinks.en.sort(byN)));
  try { buildAllIndexPages(relPages); } catch (e) { console.warn('⚠️ 모아보기(/all/) 페이지 건너뜀: ' + e.message); }

  // 사이트맵 — 목록 파일(sitemap.xml) + 종류별 쪼갠 파일(sitemaps/*.xml)(2026-10-30). 구글 한도가 파일 하나에 URL 5만 개인데 곡·멤버×곡
  // 페이지로 3만 6천 개가 됐고 페이지 종류를 더 늘릴 계획이라 미리 나눈다. robots.txt·서치콘솔 등록 주소는 sitemap.xml 그대로(목록 파일도 받아준다).
  // 종류: core(루트·허브·그룹·멤버·관계) / songs(곡) / member-songs(멤버×곡) — 4만 개 넘으면 -2, -3 …으로 더 쪼갠다.
  const sitemapUrls = [{ loc: `${SITE}/`, priority: '1.0' },
    ...pages.map(p => ({ loc: p.loc, priority: p.priority || '0.7' })),
    ...relPages];
  const smKind = loc => {
    const p = decodeURI(loc.slice(SITE.length + 1));
    if (/^(en\/)?g\/[^/]+\/[^/]+\/s\/[^/]+\/$/.test(p)) return 'member-songs';
    if (/^(en\/)?g\/[^/]+\/[^/]+\/fancams\/$/.test(p)) return 'fancams';
    if (/^(en\/)?g\/[^/]+\/s\/[^/]+\/$/.test(p)) return 'songs';
    if (/^(en\/)?p\//.test(p)) return 'programs';
    if (/^(en\/)?show\//.test(p)) return 'shows';
    return 'core';
  };
  const SM_MAX = 40000;
  const smBuckets = {};
  sitemapUrls.forEach(u => { const k = smKind(u.loc); (smBuckets[k] = smBuckets[k] || []).push(u); });
  const smDir = path.join(ROOT, 'sitemaps');
  fs.rmSync(smDir, { recursive: true, force: true }); // 지난 빌드의 조각(개수가 줄었을 때 남는 -3 등) 정리
  fs.mkdirSync(smDir, { recursive: true });
  const smFiles = [];
  for (const k of ['core', 'songs', 'member-songs', 'fancams', 'programs', 'shows']) {
    const list = smBuckets[k] || [];
    for (let i = 0; i * SM_MAX < list.length; i++) {
      const name = `${k}${i ? '-' + (i + 1) : ''}.xml`;
      const chunk = list.slice(i * SM_MAX, (i + 1) * SM_MAX);
      fs.writeFileSync(path.join(smDir, name), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${chunk.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY_ISO}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`);
      smFiles.push({ name, n: chunk.length });
    }
  }
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${smFiles.map(f => `  <sitemap>\n    <loc>${SITE}/sitemaps/${f.name}</loc>\n    <lastmod>${TODAY_ISO}</lastmod>\n  </sitemap>`).join('\n')}
</sitemapindex>
`);

  console.log(`완료: 그룹 ${groupKos.length}개 + 멤버 ${memberPageCount}명 × 2개 언어 = ${pages.length}개 정적 페이지 생성`);
  // 공유 미리보기 안전망(2026-11-02) — 페이지 종류마다 빌더가 따로라 og:image가 빠진 페이지가 422개 있었다. 없는 페이지에만 넣는다
  { const r = require('./tools/ensure_og_images.cjs').ensureOgImages(ROOT); console.log(`og:image 안전망: ${r.fixed}개 보충`); }
  console.log(`sitemap.xml(목록) 갱신 — ${smFiles.map(f => `${f.name} ${f.n}`).join(' · ')} (총 ${sitemapUrls.length}개 URL)`);
})();
