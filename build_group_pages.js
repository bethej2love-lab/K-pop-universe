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

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));

// index.html에 이미 있는 소속사 한/영 매핑표를 그대로 재사용(중복 유지보수 방지) — 신뢰할 수 있는
// 내 파일에서 안전하게 추출하는 것이므로 정규식으로 블록을 잘라 eval.
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const {agencySource} = require('./tools/seo_inputs_unchanged.cjs');
const agencyBlock = agencySource(indexSrc);
const AGENCY_EN = agencyBlock ? new Function('return ' + agencyBlock.replace(/^const _AGENCY_EN=/, ''))() : {};
// 페이지 보강(2026-10-16) — 음방 1위·인기 직캠(DB)과 투어·대상·밀리언·작사작곡(정적 파일). tools/seo_extra.js 주석 참고.
const SEO = require('./tools/seo_extra.js');
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
  if (/maxresdefault/.test(url)) return { w: 1280, h: 720 };
  if (/hqdefault/.test(url)) return { w: 480, h: 360 };
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
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : `${SITE}/og-image.png`;
}

// ── 소개 문단 생성 (2026-10-13) ─────────────────────────────────────────────
// 기존 SEO 페이지는 메타데이터+목록만 있어 Google이 "텍스트 없는 페이지"로 판정 — 자연스러운 문장을
// 한 단락 넣어 색인 품질을 높인다.
function groupIntroHtml(ko, info, members, discogItems, lang) {
  const isEn = lang === 'en';
  const name = isEn ? (info.en || ko) : ko;
  const memCount = members.length;
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
  const active = a.active !== false;
  let text;
  if (isEn) {
    let s = `${name} is a${active ? '' : ' former'} K-pop idol`;
    if (nat) s += ` of ${nat} nationality`;
    if (bdayYear) s += `, born in ${bdayYear}`;
    s += '.';
    if (grpNames.length) s += ` Member of ${grpNames.join(', ')}.`;
    text = s;
  } else {
    const parts = [];
    if (grpNames.length) parts.push(grpNames.join(', ') + ' 멤버');
    if (nat) parts.push(`${nat} 출신`);
    if (bdayYear) parts.push(`${bdayYear}년생`);
    if (!active) parts.push('활동 종료');
    text = parts.join('. ') + '.';
  }
  return `<p class="intro">${escHtml(text)}</p>`;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const pages = []; // {loc, alt: {ko,en}} for sitemap + hreflang bookkeeping

const groupKos = Object.keys(groups);
// DB 보강 데이터를 받은 뒤에 만들도록 함수로 감쌌다(2026-10-16) — 메인(파일 끝)에서 prefetch 후 호출
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
      const former = !!info.disbanded
                  || !!(ge && (ge.left || ge.active === false))
                  || a.active === false
                  || (a.group && a.group.ko === ko && !!a.left);
      const name = lang === 'en' ? (a.name.en || a.name.ko) : ((ge && ge.name) || a.name.ko);
      const mPath = memberPagePath(a, lang); // 해시 딥링크가 아니라 그 멤버의 정적 페이지로
      const activeTag = former ? (lang === 'en' ? ' <span class="tag">former</span>' : ' <span class="tag">전멤버</span>') : '';
      return `<li><a href="${SITE}/${mPath}">${escHtml(name)}</a>${activeTag}</li>`;
    }).join('\n      ');
    return `
    <h2>${lang === 'en' ? 'Members' : '멤버'}</h2>
    <ul class="member-list">
      ${items}
    </ul>`;
  }

  function discogHtml(lang) {
    if (!discogItems.length) return '';
    const items = discogItems.map(a => {
      const yr = (a.releaseDate || '').slice(0, 4);
      const typeLabel = lang === 'en' ? typeEn(a.type) : a.type;
      return `<li>${escHtml(a.title)}${yr ? ` <span class="yr">(${yr})</span>` : ''}${typeLabel ? ` <span class="tag">${escHtml(typeLabel)}</span>` : ''}</li>`;
    }).join('\n      ');
    return `
    <h2>${lang === 'en' ? 'Discography' : '디스코그래피'}</h2>
    <ul class="discog-list">
      ${items}
    </ul>`;
  }

  function pageHtml(lang) {
    const isEn = lang === 'en';
    const displayName = isEn ? en : ko;
    const subName = isEn ? (ko !== en ? ko : '') : (info.en && info.en !== ko ? info.en : '');
    const agency = isEn ? agencyEn(info.co) : info.co;
    const debutLabel = isEn ? 'Debut' : '데뷔';
    const agencyLabel = isEn ? 'Agency' : '소속사';
    const fandomLabel = isEn ? 'Fandom' : '팬덤명';
    // 제목·설명은 실제 검색어에 맞춘다(2026-10-16) — '아이브(IVE) 멤버·음방 1위·직캠·투어 기록'. 설명엔 이 그룹만의 숫자(1위 N회·대상·최대 투어)
    const xg = SEO.groupExtra(ko, lang, EX, ST);
    const bits = isEn ? ['Members', ...xg.titleBits] : ['멤버', ...xg.titleBits];
    const title = isEn
      ? `${en}${ko !== en ? ` (${ko})` : ''} ${bits.join(', ')} | K-POP UNIVERSE`
      : `${ko}${info.en && info.en !== ko ? `(${info.en})` : ''} ${bits.join('·')} 기록 | K-POP UNIVERSE`;
    const factLine = xg.facts.length ? (isEn ? ' ' + xg.facts.join(', ') + '.' : ' ' + xg.facts.join(', ') + '.') : '';
    const desc = isEn
      ? `${en}: members, debut ${info.debut || ''}, ${agencyEn(info.co) || ''}.${factLine} Fancams, stages and discography on K-POP UNIVERSE.`
      : `${ko} 멤버·데뷔일(${info.debut || '-'})·소속사(${info.co || '-'}).${factLine} 직캠·무대 영상과 디스코그래피를 K-POP UNIVERSE에서.`;
    const selfUrl = isEn ? enUrl : koUrl;
    const altUrl = isEn ? koUrl : enUrl;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'MusicGroup',
      name: displayName,
      alternateName: subName || undefined,
      genre: 'K-pop',
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
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="${ogSizeFor(ogImage).w}">
<meta property="og:image:height" content="${ogSizeFor(ogImage).h}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(displayName)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;}
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
  .tag{font-size:10px;color:rgba(150,175,255,0.6);}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:30px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#09091a 62%,rgba(9,9,26,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  .intro{font-size:14px;line-height:1.75;color:rgba(200,215,255,0.78);margin:0 0 22px;}
  ${SEO.EXTRA_CSS}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.replace(/\/$/,'').split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <h1>${escHtml(displayName)}</h1>
  ${subName ? `<div class="sub">${escHtml(subName)}</div>` : ''}
  <img class="cover" src="${ogImage}" alt="${escHtml(displayName)}" loading="lazy">
  <div class="meta">
    ${debutIso ? `<span><b>${debutLabel}</b> ${escHtml(info.debut)}</span>` : ''}
    ${agency ? `<span><b>${agencyLabel}</b> ${escHtml(agency)}</span>` : ''}
    ${info.fandom && info.fandom.ko ? `<span><b>${fandomLabel}</b> ${escHtml(isEn ? (info.fandom.en || info.fandom.ko) : info.fandom.ko)}</span>` : ''}
  </div>
  ${groupIntroHtml(ko, info, members, discogItems, lang)}
  ${memberListHtml(lang)}
  ${xg.html}
  ${songLinksHtml(ko, lang)}
  ${discogHtml(lang)}
  ${(() => { const rel = relatedGroups(ko); return rel.length ? `
    <h2>${isEn ? 'Related groups' : '함께 보면 좋은 그룹'}</h2>
    <ul class="member-list rel">
      ${rel.map(k => `<li><a href="${SITE}/${groupPagePath(k, lang)}">${escHtml(isEn ? (groups[k].en || k) : k)}</a></li>`).join('\n      ')}
    </ul>` : ''; })()}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/${deepLinkHash}">${isEn ? 'View videos in the Universe →' : '직캠·영상 아카이브 보기 →'}</a></div>
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
    const items = a.songs.slice(0, 20).map(s => {
      const withTag = s.with && s.with.length ? ` <span class="tag">feat. ${escHtml(s.with.join(', '))}</span>` : '';
      return `<li>${escHtml(s.t)}${withTag}</li>`;
    }).join('\n      ');
    return `
    <h2>${lang === 'en' ? 'Featured Videos' : '대표 영상'}</h2>
    <ul class="discog-list">
      ${items}
    </ul>`;
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
    const statusLabel = a.active === false
      ? (isEn ? (a.left ? `Inactive (left ${a.left})` : 'Inactive') : (a.left ? `활동종료(${a.left} 탈퇴)` : '활동종료'))
      : (isEn ? 'Active' : '활동중');
    const debutLabel = isEn ? 'Birthday' : '생일';
    const groupLabel = isEn ? 'Group' : '소속';
    const agencyLabel = isEn ? 'Agency' : '소속사';
    const statusLbl = isEn ? 'Status' : '상태';
    // 제목·설명(2026-10-16) — '장원영(아이브) 프로필·나이·직캠'. 설명엔 생년·데뷔 나이·작사작곡·솔로 1위 같은 이 사람만의 숫자
    const xm = SEO.memberExtra(a, isSolo ? ko : primaryGko, lang, EX, ST);
    const ag = SEO.ages(a, (a.groups && a.groups.length ? a.groups : [a.group]).map(g => groups[g.ko]));
    const who = isEn ? `${en}${groupDisplay ? ` (${groupDisplay})` : ''}` : `${ko}${groupDisplay ? `(${groupDisplay})` : ''}`;
    const title = isEn
      ? `${who} Profile, Age, ${xm.titleBits.length ? 'Fancams, ' : ''}Birthday | K-POP UNIVERSE`
      : `${who} 프로필·나이·${xm.titleBits.length ? '직캠·' : ''}생일 | K-POP UNIVERSE`;
    const ageBits = isEn
      ? [bdayIso ? `born ${a.bday}` : '', ag.debutAge ? `debuted at ${ag.debutAge}` : '', ...xm.facts].filter(Boolean).join(', ')
      : [bdayIso ? `${a.bday} 생` : '', ag.debutAge ? `${ag.debutAge}세 데뷔` : '', ...xm.facts].filter(Boolean).join(', ');
    const desc = isEn
      ? `${en}${groupDisplay ? ` of ${groupDisplay}` : ''}: ${ageBits || 'profile'}. Fancams, stages and connections on K-POP UNIVERSE.`
      : `${ko}${groupDisplay ? `(${groupDisplay})` : ''}: ${ageBits || '프로필'}. 직캠·무대 영상과 함께한 아이돌을 K-POP UNIVERSE에서.`;
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
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="${ogSizeFor(ogImage).w}">
<meta property="og:image:height" content="${ogSizeFor(ogImage).h}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(displayName)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;}
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
  .tag{font-size:10px;color:rgba(150,175,255,0.6);}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:30px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#09091a 62%,rgba(9,9,26,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  .intro{font-size:14px;line-height:1.75;color:rgba(200,215,255,0.78);margin:0 0 22px;}
  ${SEO.EXTRA_CSS}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.replace(/\/$/,'').split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <h1>${escHtml(displayName)}</h1>
  ${subName ? `<div class="sub">${escHtml(subName)}</div>` : ''}
  <img class="cover" src="${ogImage}" alt="${escHtml(displayName)}" loading="lazy">
  <div class="meta">
    ${groupDisplay ? `<span><b>${groupLabel}</b> ${escHtml(groupDisplay)}</span>` : ''}
    ${bdayIso ? `<span><b>${debutLabel}</b> ${escHtml(a.bday)}${ag.age && a.active !== false ? (isEn ? ` (age ${ag.age})` : ` (만 ${ag.age}세)`) : ''}</span>` : ''}
    ${ag.debutAge ? `<span><b>${isEn ? 'Debut age' : '데뷔 나이'}</b> ${isEn ? ag.debutAge : ag.debutAge + '세'}</span>` : ''}
    ${agency ? `<span><b>${agencyLabel}</b> ${escHtml(agency)}</span>` : ''}
    <span><b>${statusLbl}</b> ${escHtml(statusLabel)}</span>
  </div>
  ${memberIntroHtml(a, affiliations, lang)}
  ${affiliationHtml(lang)}
  ${xm.html}
  ${songsHtml(lang)}
  ${memberDiscogHtml(lang)}
  ${linksHtml(lang)}
  ${(() => { const y = String(a.bday || '').slice(0, 4); const peers = (byBirthYear[y] || []).filter(x => x !== a && x.name.ko !== ko).sort((p, q) => (+(groups[q.group.ko]?.pri || 0)) - (+(groups[p.group.ko]?.pri || 0))).slice(0, 10); return peers.length ? `
    <h2>${isEn ? `Other idols born in ${y}` : `${y}년생 아이돌`}</h2>
    <ul class="member-list rel">
      ${peers.map(p => `<li><a href="${SITE}/${memberPagePath(p, lang)}">${escHtml(isEn ? (p.name.en || p.name.ko) : p.name.ko)}</a>${groups[p.group.ko] ? ` <span class="tag">${escHtml(isEn ? (groups[p.group.ko].en || p.group.ko) : p.group.ko)}</span>` : ''}</li>`).join('\n      ')}
    </ul>` : ''; })()}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/${deepLinkHash}">${isEn ? 'View fancams & videos →' : '직캠·무대 영상 보기 →'}</a></div>
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
<meta property="og:image" content="${ogImageForMember(list[0].a)}">
<style>body{font-family:system-ui,sans-serif;background:#0b0f20;color:#dfe7ff;padding:40px 20px;max-width:560px;margin:auto}a{color:#9fb8ff}li{margin:10px 0}</style>
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
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="${sz.w}">
<meta property="og:image:height" content="${sz.h}">
<meta http-equiv="refresh" content="0; url=${url}">
</head><body><a href="${url}">${escHtml(nm)}</a></body></html>
`);
        redir++;
      }
    }
  }
  if (redir || kept) console.log(`옛 멤버 페이지 정리: 새 주소로 넘김 ${redir}개 · 그대로 둠(주소 못 찾음·동명이인) ${kept}개`);
}

// ── 그룹 색인 허브(2026-08-31) ────────────────────────────────────────────────
// 그룹 페이지가 위로 거는 링크는 `SITE/`(3D 앱) 하나뿐인데 그 홈은 SPA라 크롤러가 읽을 링크가 없다.
// 그래서 그룹 페이지들도 멤버 페이지와 똑같이 sitemap에만 존재하는 고아였다. 이 허브가 그래프를 닫는다:
//   sitemap → /g/ (허브) → 그룹 페이지 → 멤버 페이지 → 소속 그룹으로 되돌아감
// 순수 텍스트 목록이라 가볍고, 데뷔연도를 같이 실어 "2015년 데뷔 걸그룹" 류 쿼리도 받는다.
function hubPageHtml(lang, relLinks) {
  const isEn = lang === 'en';
  const selfUrl = `${SITE}/${isEn ? 'en/g/' : 'g/'}`;
  const altUrl = `${SITE}/${isEn ? 'g/' : 'en/g/'}`;
  const title = isEn ? 'All K-pop Groups — Profiles, Members & Videos | K-POP UNIVERSE' : '케이팝 그룹 전체 목록 — 멤버·데뷔일·직캠 | K-POP UNIVERSE';
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
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:760px;margin:0 auto;padding:32px 20px 80px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;}
  h1{font-size:26px;margin:14px 0 6px;color:#fff;}
  h2{font-size:15px;margin:30px 0 10px;color:rgba(200,220,255,0.9);}
  .sub{font-size:14px;color:rgba(180,200,255,0.6);margin-bottom:22px;}
  ul{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;}
  li{background:rgba(150,175,255,0.08);border:0.5px solid rgba(150,175,255,0.18);border-radius:10px;padding:6px 12px;font-size:13.5px;}
  a{color:rgba(210,225,255,0.95);text-decoration:none;}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.replace(/\/$/,'').split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <h1>${isEn ? 'All Groups' : '그룹 전체 목록'}</h1>
  <div class="sub">${escHtml(desc)}</div>
  <ul>
      ${items}
  </ul>
${(relLinks && relLinks.length) ? `
  <h2>${isEn ? 'Collaborations & covers' : '콜라보 · 커버'}</h2>
  <ul>
      ${relLinks.map(r => `<li><a href="${r.href}">${escHtml(r.label)}</a> <span class="yr">${r.n}</span></li>`).join('\n      ')}
  </ul>` : ''}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
</div>
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
  const filter = 'or=(with_groups.neq.%7B%7D,cover_of_groups.neq.%7B%7D)';
  const out = [];
  let last = '';
  for (let i = 0; i < 20; i++) {
    const q = `${SB_URL}/rest/v1/yt_channel_videos?select=${cols}&${filter}&order=id&limit=1000${last ? `&id=gt.${encodeURIComponent(last)}` : ''}`;
    const res = await fetch(q, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    out.push(...rows);
    last = rows[rows.length - 1].id;
    if (rows.length < 1000) break;
  }
  return out.filter(r => !r.content_flag && groups[r.group_ko]);
}

function relPageHtml(o) {
  const { lang, title, desc, h1, sub, sections, selfPath, altPath } = o;
  const isEn = lang === 'en';
  const selfUrl = `${SITE}/${selfPath}`;
  const altUrl = `${SITE}/${altPath}`;
  const secHtml = sections.filter(s => s.items.length).map(s => `
    <h2>${escHtml(s.h)} <span class="yr">${s.items.length}</span></h2>
    <ul class="vid-list">
      ${s.items.map(v => `<li><a href="https://www.youtube.com/watch?v=${escHtml(v.id)}" target="_blank" rel="noopener">${escHtml(v.title)}</a>${v.note ? ` <span class="yr">${escHtml(v.note)}</span>` : ''}</li>`).join('\n      ')}
    </ul>`).join('\n');
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
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;}
  h1{font-size:24px;margin:14px 0 4px;color:#fff;}
  .sub{font-size:14px;color:rgba(180,200,255,0.6);margin-bottom:8px;}
  .sub a{color:rgba(190,210,255,0.9);}
  h2{font-size:15px;margin:26px 0 8px;color:rgba(200,220,255,0.9);}
  .vid-list{list-style:none;padding:0;margin:0;}
  .vid-list li{padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);font-size:13.5px;}
  .vid-list a{color:rgba(210,225,255,0.95);text-decoration:none;}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:28px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#09091a 62%,rgba(9,9,26,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:36px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var s=location.pathname.replace(/\/$/,'').split('/').filter(Boolean),i=s[0]==='en'?1:0,type=s.length-i>=3?'member':s.length-i===2&&s[i]==='g'?'group':s.length-i===2?'explore':'group_list',entity=(document.querySelector('h1')||{}).textContent||'';gtag('event','seo_land',{entity_name:entity.trim(),page_type:type});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:entity.trim(),page_type:type});});});</script>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <a class="brand" href="${SITE}/${isEn ? 'en/g/' : 'g/'}" style="margin-left:10px;">${isEn ? 'All groups' : '그룹 전체'}</a>
  <h1>${escHtml(h1)}</h1>
  <div class="sub">${sub}</div>
${secHtml}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/">${isEn ? 'Explore in the Universe →' : '더 알아보기 →'}</a></div>
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
  const vid = (r, note) => ({ id: r.id, title: r.title || '', note });

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
        title: isEn ? `${A} × ${B} — videos together | K-POP UNIVERSE` : `${A} × ${B} 같이 나온 영상 ${vs.length}개 | K-POP UNIVERSE`,
        desc: isEn ? `${vs.length} videos featuring both ${A} and ${B}.` : `${A}${josa(A, '와/과')} ${B}${josa(B, '이/가')} 함께 나온 영상 ${vs.length}개를 모았어요.`,
        h1: `${A} × ${B}`,
        sub: isEn ? `${glink(a, lang)} and ${glink(b, lang)} appeared together` : `${glink(a, lang)} · ${glink(b, lang)} 함께 나온 영상`,
        sections: [{ h: isEn ? 'Videos together' : '같이 나온 영상', items: vs.slice(0, 60).map(r => vid(r, (r.published_at || '').slice(0, 4))) }],
        selfPath, altPath,
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
        title: isEn ? `${N} cover songs & covered by others | K-POP UNIVERSE` : `${N} 커버곡 · ${N} 곡 커버 영상 | K-POP UNIVERSE`,
        desc: isEn ? `${mine.length} songs covered by ${N}, and ${theirs.length} covers of ${N} songs by other artists.`
                   : `${N}${josa(N, '이/가')} 커버한 곡 ${mine.length}개와, 다른 아티스트가 커버한 ${N} 곡 ${theirs.length}개.`,
        h1: isEn ? `${N} — covers` : `${N} 커버`,
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

// 실패해도 나머지 빌드는 그대로 — 기존 관계 페이지를 스캔해 sitemap 항목만 유지한다
function existingRelPages() {
  const out = [];
  for (const base of ['collab', 'cover', 'en/collab', 'en/cover']) {
    const dir = path.join(ROOT, base);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'index.html')))
        out.push({ loc: `${SITE}/${base}/${e.name}/`, priority: '0.5' });
    }
  }
  return out;
}

// ── 곡별 정적 페이지(2026-10-16, 검색노출 2단계) ─────────────────────────────────────────────
// "LOVE DIVE 직캠"·"아이브 LOVE DIVE 무대"처럼 사람들은 곡 이름으로 찾는다. 그룹·멤버 페이지만으론 그 검색어에
// 닿을 자리가 없었다. 곡 목록·영상 묶기는 tools/seo_extra.js buildSongs(앱과 같은 shared.js 규칙) — 영상 4개 이상인 곡만.
// 경로: g/{그룹}/s/{곡 기본형}/ · en/g/{slug}/s/{곡 기본형}/ (기본형 = _songBase, 소문자·기호 제거라 주소에 안전)
let SONGS = {};
let songPageCount = 0;
function songPagePath(gko, b, lang) {
  const gp = groupPagePath(gko, lang);
  return gp ? `${gp}s/${b}/` : null;
}
function songLinksHtml(gko, lang) {
  const list = SONGS[gko] || [];
  if (!list.length) return '';
  const isEn = lang === 'en';
  return `
    <h2>${isEn ? 'Fancams & stages by song' : '곡별 직캠·무대'}</h2>
    <ul class="member-list rel">
      ${list.slice(0, 40).map(s => `<li><a href="${SITE}/${songPagePath(gko, s.b, lang)}">${escHtml(s.title)}</a></li>`).join('\n      ')}
    </ul>`;
}
function buildSongPages() {
  const credit = (arr) => (arr || []).map(x => Array.isArray(x) ? x[0] : x).filter(Boolean);
  for (const gko of Object.keys(SONGS)) {
    const info = groups[gko]; if (!info) continue;
    const members = membersOf(gko);
    const memByName = new Map();
    members.forEach(a => { memByName.set(a.name.ko, a); const ge = (a.groups || []).find(g => g && g.ko === gko); if (ge && ge.name) memByName.set(ge.name, a); });
    const all = SONGS[gko];
    all.forEach(s => {
      const date = String(s.date || '').replace(/-/g, '.');
      const yr = date.slice(0, 4);
      // 출연 멤버: 이 곡 영상에 태그된 횟수 순(직캠이 많은 멤버가 앞)
      const cnt = new Map();
      s.vids.forEach(v => (v.members || []).forEach(n => { const a = memByName.get(n); if (a) cnt.set(a, (cnt.get(a) || 0) + 1); }));
      const featured = [...cnt.entries()].sort((x, y) => y[1] - x[1]).map(x => x[0]);
      const top = s.vids.slice(0, 30);
      const cr = s.cr || {};
      const L = credit(cr.l), C = credit(cr.c), A = credit(cr.a);
      const others = all.filter(o => o.b !== s.b).slice(0, 16);
      const page = (lang) => {
        const isEn = lang === 'en';
        const gName = isEn ? (info.en || gko) : gko;
        const gFull = isEn ? gName : `${gko}${info.en && info.en !== gko ? `(${info.en})` : ''}`;
        const selfPath = songPagePath(gko, s.b, lang), altPath = songPagePath(gko, s.b, isEn ? 'ko' : 'en');
        const selfUrl = `${SITE}/${selfPath}`, altUrl = `${SITE}/${altPath}`, koUrl = `${SITE}/${songPagePath(gko, s.b, 'ko')}`;
        const title = isEn ? `${s.title} Fancams & Stages - ${gName} | K-POP UNIVERSE` : `${s.title} 직캠·무대 모음 - ${gFull} | K-POP UNIVERSE`;
        const facts = [];
        if (s.album) facts.push(isEn ? `from ${s.album}${yr ? ` (${yr})` : ''}` : `${s.album}${yr ? `(${yr})` : ''} 수록`);
        if (s.isTitle) facts.push(isEn ? 'title track' : '타이틀곡');
        if (s.wins) facts.push(isEn ? `${s.wins} music show wins` : `음악방송 1위 ${s.wins}회`);
        const desc = isEn
          ? `${gName} "${s.title}" — ${facts.join(', ')}. ${s.vids.length} fancams and stage videos, most viewed first${L.length ? `, lyrics by ${L.slice(0, 3).join(', ')}` : ''}.`
          : `${gko} '${s.title}' — ${facts.join(', ')}. 직캠·무대 영상 ${s.vids.length}개를 조회수 순으로${L.length ? `, 작사 ${L.slice(0, 3).join(', ')}` : ''}.`;
        const ogImage = top[0] ? `https://i.ytimg.com/vi/${top[0].id}/hqdefault.jpg` : ogImageForGroup(gko, info);
        const jsonLd = {
          '@context': 'https://schema.org', '@type': 'MusicRecording', name: s.title, url: selfUrl,
          byArtist: { '@type': 'MusicGroup', name: gName, url: `${SITE}/${groupPagePath(gko, lang)}` },
          inAlbum: s.album ? { '@type': 'MusicAlbum', name: s.album } : undefined,
          datePublished: s.date ? String(s.date).replace(/\./g, '-').slice(0, 10) : undefined,
          lyricist: L.length ? L.map(n => ({ '@type': 'Person', name: n })) : undefined,
          composer: C.length ? C.map(n => ({ '@type': 'Person', name: n })) : undefined,
        };
        const lbl = isEn ? { rel: 'Release', al: 'Album', w: 'Music show wins', l: 'Lyrics', c: 'Composition', a: 'Arrangement', v: 'Most viewed fancams & stages', m: 'Members in these videos', o: `More songs by ${gName}` }
                         : { rel: '발매', al: '앨범', w: '음악방송 1위', l: '작사', c: '작곡', a: '편곡', v: '조회수 많은 직캠·무대', m: '영상에 나온 멤버', o: `${gko}의 다른 곡` };
        const crRow = (k, arr) => arr.length ? `<span><b>${lbl[k]}</b> ${escHtml(arr.slice(0, 6).join(', '))}</span>` : '';
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
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="K-POP UNIVERSE">
<meta property="og:title" content="${escHtml(`${s.title} - ${gName}`)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${selfUrl}">
<meta property="og:image" content="${ogImage}">
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 20px;}
  .brand{font-size:12px;letter-spacing:.08em;color:rgba(150,175,255,0.6);text-decoration:none;}
  h1{font-size:28px;margin:14px 0 2px;color:#fff;}
  .sub{font-size:15px;color:rgba(180,200,255,0.6);margin-bottom:18px;}
  .sub a{color:inherit;}
  .meta{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:13px;color:rgba(190,210,255,0.75);margin-bottom:24px;}
  .meta b{color:rgba(220,230,255,0.95);font-weight:600;}
  .cover{width:100%;max-width:400px;border-radius:12px;display:block;margin-bottom:20px;background:rgba(255,255,255,0.05);}
  h2{font-size:16px;margin:28px 0 10px;color:rgba(200,220,255,0.9);}
  .member-list{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:8px;}
  .member-list li{background:rgba(150,175,255,0.08);border:0.5px solid rgba(150,175,255,0.18);border-radius:10px;padding:6px 12px;font-size:13.5px;}
  .member-list a{color:rgba(210,225,255,0.95);text-decoration:none;}
  .yr{color:rgba(150,175,255,0.55);font-size:12px;}
  .cta-dock{position:sticky;bottom:0;z-index:5;margin-top:30px;padding:14px 0 calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,#09091a 62%,rgba(9,9,26,0));}
  .cta{display:block;text-align:center;padding:13px 22px;border-radius:24px;background:rgba(140,165,255,0.2);border:0.5px solid rgba(150,175,255,0.42);color:#fff;text-decoration:none;font-size:14.5px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
  ${SEO.EXTRA_CSS}
</style>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');document.addEventListener('DOMContentLoaded',function(){var e=((document.querySelector('h1')||{}).textContent||'').trim();gtag('event','seo_land',{entity_name:e,page_type:'song'});var c=document.querySelector('.cta');c&&c.addEventListener('click',function(){gtag('event','seo_cta_click',{entity_name:e,page_type:'song'});});});</script>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1>${escHtml(s.title)}</h1>
  <div class="sub"><a href="${SITE}/${groupPagePath(gko, lang)}">${escHtml(gName)}</a>${s.isTitle ? (isEn ? ' · Title track' : ' · 타이틀곡') : ''}</div>
  ${top[0] ? `<img class="cover" src="${ogImage}" alt="${escHtml(`${gName} ${s.title}`)}" loading="lazy">` : ''}
  <div class="meta">
    ${date ? `<span><b>${lbl.rel}</b> ${escHtml(date)}</span>` : ''}
    ${s.album ? `<span><b>${lbl.al}</b> ${escHtml(s.album)}</span>` : ''}
    ${s.wins ? `<span><b>${lbl.w}</b> ${s.wins}${isEn ? '' : '회'}</span>` : ''}
    ${crRow('l', L)}${crRow('c', C)}${crRow('a', A)}
  </div>
  <h2>${lbl.v}</h2>
  <ol class="vid-list">
      ${top.map(v => `<li><a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">${escHtml(v.title)}</a> <span class="yr">${SEO.fmtViews(v.view_count, isEn)}${v.published_at ? ' · ' + String(v.published_at).slice(0, 4) : ''}</span></li>`).join('\n      ')}
  </ol>
  ${s.vids.length > top.length ? `<p class="note">${isEn ? `Top ${top.length} of ${s.vids.length} videos` : `영상 ${s.vids.length}개 중 상위 ${top.length}개`}</p>` : ''}
  ${featured.length ? `
  <h2>${lbl.m}</h2>
  <ul class="member-list">
      ${featured.map(a => { const ge = (a.groups || []).find(g => g && g.ko === gko); const nm = isEn ? (a.name.en || a.name.ko) : ((ge && ge.name) || a.name.ko); return `<li><a href="${SITE}/${memberPagePath(a, lang)}">${escHtml(nm)}</a></li>`; }).join('\n      ')}
  </ul>` : ''}
  ${others.length ? `
  <h2>${lbl.o}</h2>
  <ul class="member-list rel">
      ${others.map(o => `<li><a href="${SITE}/${songPagePath(gko, o.b, lang)}">${escHtml(o.title)}</a></li>`).join('\n      ')}
  </ul>` : ''}
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
  <div class="cta-dock"><a class="cta" href="${SITE}/#g=${hashEsc(gko)}">${isEn ? 'View videos in the Universe →' : '직캠·영상 아카이브 보기 →'}</a></div>
</div>
</body>
</html>
`;
      };
      for (const lang of ['ko', 'en']) {
        const rel = songPagePath(gko, s.b, lang);
        const dir = path.join(ROOT, rel);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'index.html'), page(lang));
        pages.push({ loc: `${SITE}/${rel}`, priority: '0.6' });
      }
      songPageCount++;
    });
  }
}

(async () => {
  // 1) DB 보강(음방 1위·인기 직캠) → 2) 그룹·멤버 페이지. DB가 안 되면(회사망 등) 정적 정보만으로 만든다.
  try {
    EX = await SEO.prefetch({ SB_URL, SB_KEY, groupKos });
    console.log(`보강 데이터: 1위 기록 ${Object.keys(EX.wins).length}그룹 · 인기 영상 ${Object.keys(EX.top).length}그룹`);
  } catch (e) { console.warn('⚠️ DB 보강 건너뜀:', e.message); }
  // 곡 페이지용 영상 — 그룹 페이지에 곡 링크를 실어야 하므로 그룹 페이지보다 먼저
  try {
    const vids = await SEO.prefetchGroupVideos({ SB_URL, SB_KEY, groupKos });
    const emptyVidGroups = groupKos.filter(g => !vids[g] || !vids[g].length);
    if (emptyVidGroups.length) console.warn(`⚠️ 영상 0개 그룹 ${emptyVidGroups.length}개: ${emptyVidGroups.slice(0, 10).join(', ')}${emptyVidGroups.length > 10 ? ' ...' : ''}`);
    SONGS = SEO.buildSongs({ ROOT, groups, artists, EX, vids });
    console.log(`곡 데이터: ${Object.keys(SONGS).length}그룹 · ${Object.values(SONGS).reduce((n, l) => n + l.length, 0)}곡`);
  } catch (e) { console.warn('⚠️ 곡 페이지 건너뜀:', e.message); }
  buildGroupPages();
  buildMemberPages();
  redirectStaleMemberPages();
  writeSoloDisambigPages();
  buildSongPages();
  console.log(`곡 페이지 ${songPageCount}곡 × 2개 언어`);
  let relPages = [], hubLinks = { ko: [], en: [] };
  try {
    const r = await buildRelationPages();
    relPages = r.sitemap; hubLinks = r.hubLinks;
    console.log(`관계 페이지 ${relPageCount}개 생성 (/collab/, /cover/ · 양 언어)`);
  } catch (e) {
    relPages = existingRelPages();
    console.warn(`⚠️ 관계 페이지 건너뜀 (${e.message}) — 기존 ${relPages.length}개를 sitemap에만 유지`);
    console.warn('   회사망이면 NODE_TLS_REJECT_UNAUTHORIZED=0 node build_group_pages.js 로 재실행');
  }

  // 허브는 관계 페이지 목록을 실어야 하므로 여기서 쓴다(위 pages.push는 sitemap 기록용)
  const byN = (a, b) => b.n - a.n;
  fs.mkdirSync(path.join(ROOT, 'g'), { recursive: true });
  fs.mkdirSync(path.join(ROOT, 'en', 'g'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'g', 'index.html'), hubPageHtml('ko', hubLinks.ko.sort(byN)));
  fs.writeFileSync(path.join(ROOT, 'en', 'g', 'index.html'), hubPageHtml('en', hubLinks.en.sort(byN)));

  // sitemap.xml — 루트 + 허브 + 그룹별/멤버별 + 관계 페이지 전부
  const sitemapUrls = [{ loc: `${SITE}/`, priority: '1.0' },
    ...pages.map(p => ({ loc: p.loc, priority: p.priority || '0.7' })),
    ...relPages];
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY_ISO}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemapXml);

  console.log(`완료: 그룹 ${groupKos.length}개 + 멤버 ${memberPageCount}명 × 2개 언어 = ${pages.length}개 정적 페이지 생성`);
  console.log(`sitemap.xml 갱신 (총 ${sitemapUrls.length}개 URL)`);
})();
