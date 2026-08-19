#!/usr/bin/env node
// 그룹별 정적 SEO 페이지 생성 스크립트 (2026-08-19, 사용자 요청 — 해시 라우팅(#g=...)은 검색엔진이
// 아예 못 읽어서 그룹/멤버 249개+1600명 데이터가 있어도 검색엔진엔 "페이지 1개"로만 보이던 문제 해결).
// groups.json/artists.json을 읽어 그룹당 정적 HTML 2장(한국어 g/{ko}/index.html, 영어
// en/g/{slug}/index.html)을 만든다. index.html(진짜 앱)은 전혀 안 건드림 — 이 정적 페이지들은
// 검색엔진·SNS 미리보기 전용 "착지 페이지"이고, "우주에서 보기" 버튼으로만 실제 앱(해시 딥링크)에
// 연결된다(자동 리디렉트 없음 — 검색엔진이 "콘텐츠 없는 리디렉트 페이지"로 오판하는 것 방지).
//
// 실행: node build_group_pages.js  (배포 전 로컬에서 1회 실행 → g/, en/g/, sitemap.xml을 결과물과
// 함께 GitHub에 드래그 업로드. groups.json/artists.json이 바뀔 때마다 다시 돌려야 함.)

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
  const koPath = `g/${ko}/`;
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

  pages.push({ loc: koUrl }, { loc: enUrl });
});

// sitemap.xml — 루트 + 그룹별 KO/EN 페이지 전부
const sitemapUrls = [{ loc: `${SITE}/`, priority: '1.0' }, ...pages.map(p => ({ loc: p.loc, priority: '0.7' }))];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemapXml);

console.log(`완료: 그룹 ${groupKos.length}개 × 2개 언어 = ${pages.length}개 정적 페이지 생성`);
console.log(`sitemap.xml 갱신 (총 ${sitemapUrls.length}개 URL)`);
