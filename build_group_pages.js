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
const agencyMatch = indexSrc.match(/const _AGENCY_EN=\{[\s\S]*?\n\};/);
const AGENCY_EN = agencyMatch ? new Function('return ' + agencyMatch[0].replace(/^const _AGENCY_EN=/, ''))() : {};
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
function ogImageFor(info) {
  const song = (info.songs || [])[0];
  if (!song || !song.u) return `${SITE}/og-image.png`;
  const m = song.u.match(/(?:v=|shorts\/)([\w-]{6,15})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : `${SITE}/og-image.png`;
}

const pages = []; // {loc, alt: {ko,en}} for sitemap + hreflang bookkeeping

const groupKos = Object.keys(groups);
groupKos.forEach(ko => {
  const info = groups[ko];
  const en = info.en || ko;
  const slug = slugify(en, ko);
  const members = membersOf(ko);
  const koPath = `g/${urlSafeKo(ko)}/`;
  const enPath = `en/g/${slug}/`;
  const koUrl = `${SITE}/${koPath}`;
  const enUrl = `${SITE}/${enPath}`;
  const ogImage = ogImageFor(info);
  const debutIso = isoDate(info.debut);
  const deepLinkHash = '#g=' + hashEsc(ko);

  const discogItems = (info.discography || [])
    .filter(a => a.isMain !== false)
    .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''))
    .slice(0, 30);

  function memberListHtml(lang) {
    if (!members.length) return '';
    const items = members.map(a => {
      const name = lang === 'en' ? (a.name.en || a.name.ko) : a.name.ko;
      const mHash = `#g=${hashEsc(ko)}&m=${hashEsc(a.name.ko)}`;
      const activeTag = a.active === false ? (lang === 'en' ? ' <span class="tag">former</span>' : ' <span class="tag">전멤버</span>') : '';
      return `<li><a href="${SITE}/${mHash}">${escHtml(name)}</a>${activeTag}</li>`;
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
    const title = isEn
      ? `${en}${ko !== en ? ` (${ko})` : ''} Members, Profile, Debut Date | K-POP UNIVERSE`
      : `${ko} 멤버 프로필·데뷔일·소속사 | K-POP UNIVERSE`;
    const desc = isEn
      ? `${en} member profiles, debut date, agency, and discography. Explore how ${en} connects with other K-pop idols on K-POP UNIVERSE.`
      : `${ko} 멤버 프로필, 데뷔일, 소속사, 디스코그래피 정보. ${ko}가 다른 케이팝 아이돌들과 어떻게 연결되는지 K-POP UNIVERSE에서 탐험해보세요.`;
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
      member: members.map(a => ({ '@type': 'Person', name: isEn ? (a.name.en || a.name.ko) : a.name.ko })),
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
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(displayName)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 80px;}
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
  .cta{display:inline-block;margin-top:30px;padding:11px 22px;border-radius:24px;background:rgba(140,165,255,0.16);border:0.5px solid rgba(150,175,255,0.35);color:#fff;text-decoration:none;font-size:14px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1>${escHtml(displayName)}</h1>
  ${subName ? `<div class="sub">${escHtml(subName)}</div>` : ''}
  <img class="cover" src="${ogImage}" alt="${escHtml(displayName)}" loading="lazy">
  <div class="meta">
    ${debutIso ? `<span><b>${debutLabel}</b> ${escHtml(info.debut)}</span>` : ''}
    ${agency ? `<span><b>${agencyLabel}</b> ${escHtml(agency)}</span>` : ''}
    ${info.fandom && info.fandom.ko ? `<span><b>${fandomLabel}</b> ${escHtml(isEn ? (info.fandom.en || info.fandom.ko) : info.fandom.ko)}</span>` : ''}
  </div>
  ${memberListHtml(lang)}
  ${discogHtml(lang)}
  <a class="cta" href="${SITE}/${deepLinkHash}">${isEn ? 'View in the Universe →' : '우주에서 보기 →'}</a>
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
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

// ── 멤버별 정적 SEO 페이지 (2026-08-21, 사용자 요청 — Fable 자문 세션에서 확인: 그룹 249개보다 멤버
// 1,649명 개별 진입점이 롱테일 검색("OO 직캠", "OO 몇 년 데뷔")에서 훨씬 유리하고, 검색 결과 미리보기
// 단계에서부터 "이 사람에 대한 정보가 펼쳐져 있다"는 걸 보여줘야 클릭 이후 실제로 탐험까지 이어진다는
// 방향 확인). 실제 그룹 소속 멤버는 그 그룹 페이지 밑에 중첩(g/{그룹}/{멤버}/) — 동명이인이 서로 다른
// 그룹에 있을 수 있어(드림캐쳐 지유/키키 지유 실제 오배정 사고 있었음) 반드시 그룹으로 구분해야 함.
// GROUPS에 없는 솔로 아티스트(보아·이영지 등, group.ko="솔로"는 서로 무관한 사람들이 공유하는
// placeholder)는 member/{이름}/ 최상위에 둔다.
let memberPageCount = 0;
artists.forEach(a => {
  const ko = a.name.ko;
  const en = a.name.en || ko;
  const primaryGko = a.group.ko;
  const isSolo = !groups[primaryGko];
  const groupInfo = isSolo ? null : groups[primaryGko];
  // 겸임(이중소속)이면 groups 배열 전부 — GROUPS에 실존하는 그룹만(placeholder '솔로' 등 제외)
  const affiliations = (a.groups && a.groups.length ? a.groups : [a.group]).filter(g => groups[g.ko]);
  const slug = slugify(en, ko);

  const koPath = isSolo ? `member/${urlSafeKo(ko)}/` : `g/${urlSafeKo(primaryGko)}/${urlSafeKo(ko)}/`;
  const enGroupSlug = isSolo ? null : slugify(groupInfo.en || primaryGko, primaryGko);
  const enPath = isSolo ? `en/member/${slug}/` : `en/g/${enGroupSlug}/${slug}/`;
  const koUrl = `${SITE}/${koPath}`;
  const enUrl = `${SITE}/${enPath}`;
  const ogImage = ogImageFor(a);
  const bdayIso = isoDate(a.bday);
  const deepLinkHash = '#g=' + hashEsc(primaryGko) + '&m=' + hashEsc(ko);

  const discogItems = (a.discography || [])
    .filter(al => al.isMain !== false)
    .sort((x, y) => (y.releaseDate || '').localeCompare(x.releaseDate || ''))
    .slice(0, 30);

  function affiliationHtml(lang) {
    if (!affiliations.length) return '';
    const items = affiliations.map(g => {
      const gname = lang === 'en' ? (groups[g.ko].en || g.ko) : g.ko;
      const gHash = '#g=' + hashEsc(g.ko);
      return `<li><a href="${SITE}/${gHash}">${escHtml(gname)}</a></li>`;
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
    const groupDisplay = isSolo ? (isEn ? 'Solo Artist' : '솔로 아티스트') : (isEn ? (groupInfo.en || primaryGko) : primaryGko);
    const agency = isEn ? agencyEn(a.co) : a.co;
    const statusLabel = a.active === false
      ? (isEn ? (a.left ? `Inactive (left ${a.left})` : 'Inactive') : (a.left ? `활동종료(${a.left} 탈퇴)` : '활동종료'))
      : (isEn ? 'Active' : '활동중');
    const debutLabel = isEn ? 'Birthday' : '생일';
    const groupLabel = isEn ? 'Group' : '소속';
    const agencyLabel = isEn ? 'Agency' : '소속사';
    const statusLbl = isEn ? 'Status' : '상태';
    const title = isEn
      ? `${en}${ko !== en ? ` (${ko})` : ''} Profile, Birthday, Group | K-POP UNIVERSE`
      : `${ko} 프로필, 생일, 소속 정보 | K-POP UNIVERSE`;
    const desc = isEn
      ? `${en}'s profile, birthday, group, and featured videos. Explore how ${en} connects with other K-pop idols on K-POP UNIVERSE.`
      : `${ko}의 프로필, 생일, 소속, 대표 영상 정보. ${ko}가 다른 케이팝 아이돌들과 어떻게 연결되는지 K-POP UNIVERSE에서 탐험해보세요.`;
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
<meta property="og:locale" content="${isEn ? 'en_US' : 'ko_KR'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(displayName)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="${SITE}/icons/icon-192.png" type="image/png">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Z5NTV6X3YF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-Z5NTV6X3YF');</script>
<style>
  :root{color-scheme:dark;}
  body{margin:0;background:#09091a;color:rgba(220,230,255,0.92);font-family:-apple-system,'Pretendard','Apple SD Gothic Neo',sans-serif;line-height:1.6;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 80px;}
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
  .cta{display:inline-block;margin-top:30px;padding:11px 22px;border-radius:24px;background:rgba(140,165,255,0.16);border:0.5px solid rgba(150,175,255,0.35);color:#fff;text-decoration:none;font-size:14px;font-weight:600;}
  .lang-switch{margin-top:40px;font-size:12px;}
  .lang-switch a{color:rgba(150,175,255,0.7);}
</style>
</head>
<body>
<div class="wrap">
  <a class="brand" href="${SITE}/">K-POP UNIVERSE</a>
  <h1>${escHtml(displayName)}</h1>
  ${subName ? `<div class="sub">${escHtml(subName)}</div>` : ''}
  <img class="cover" src="${ogImage}" alt="${escHtml(displayName)}" loading="lazy">
  <div class="meta">
    <span><b>${groupLabel}</b> ${escHtml(groupDisplay)}</span>
    ${bdayIso ? `<span><b>${debutLabel}</b> ${escHtml(a.bday)}</span>` : ''}
    ${agency ? `<span><b>${agencyLabel}</b> ${escHtml(agency)}</span>` : ''}
    <span><b>${statusLbl}</b> ${escHtml(statusLabel)}</span>
  </div>
  ${affiliationHtml(lang)}
  ${songsHtml(lang)}
  ${memberDiscogHtml(lang)}
  ${linksHtml(lang)}
  <a class="cta" href="${SITE}/${deepLinkHash}">${isEn ? 'View in the Universe →' : '우주에서 보기 →'}</a>
  <div class="lang-switch"><a href="${altUrl}">${isEn ? '한국어로 보기' : 'View in English'}</a></div>
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
  memberPageCount++;
});

// sitemap.xml — 루트 + 그룹별/멤버별 KO/EN 페이지 전부
const sitemapUrls = [{ loc: `${SITE}/`, priority: '1.0' }, ...pages.map(p => ({ loc: p.loc, priority: p.priority || '0.7' }))];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemapXml);

console.log(`완료: 그룹 ${groupKos.length}개 + 멤버 ${memberPageCount}명 × 2개 언어 = ${pages.length}개 정적 페이지 생성`);
console.log(`sitemap.xml 갱신 (총 ${sitemapUrls.length}개 URL)`);
