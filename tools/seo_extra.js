// 정적 SEO 페이지 보강(2026-10-16, 사용자: "유입을 늘리려면 검색 노출 강화가 핵심") ───────────────────────────────
// 그룹·멤버 정적 페이지가 데뷔일·소속사·멤버·앨범 목록뿐이라 나무위키보다 나을 게 없었다(검색엔진이 보기엔 얇은 페이지).
// 우리만 가진 정보를 페이지에 싣는다 — 음악방송 1위 기록(곡별·첫 1위), 인기 무대·직캠 TOP(조회수), 투어 성적(관객·매출),
// 대상 수상, 밀리언셀러, 작사·작곡 곡 수. 실제 검색어("아이브 음방 1위", "장원영 직캠", "OO 투어 관객")에 맞는 문장과 숫자.
// build_group_pages.js가 부른다. DB(공개 anon 키, 읽기 전용) 조회가 실패해도 정적 파일 정보만으로 페이지는 만든다.
const fs = require('fs');
const path = require('path');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

function packCredits(list,base) {
  const by=new Map();
  for(const song of list||[]){const b=base(song.title||'');if(!b)continue;const current=by.get(b);const id=Math.max(+song.songId||0,current?current.id:0);const ids=new Set(current?current.ids:[]);if(song.songId)ids.add(String(song.songId));if(!current||String(song.title).length<String(current.title).length)by.set(b,{b,title:song.title,id,ids:[...ids]});else{current.id=id;current.ids=[...ids];}} // id=멜론 songId(최신일수록 큼) — 최근 곡부터 보여주려고
  return [...by.values()];
}
function loadStatic(ROOT) {
  const credits = {};
  const raw = readJson(path.join(ROOT, 'artist_credits.json')) || {};
  for (const k of Object.keys(raw)) { // 키 = '이름\0그룹'(널 문자 구분 — 메모리: artist_credits 키 포맷)
    const [nm, g] = k.split(String.fromCharCode(0));
    credits[nm + '|' + (g || '')] = { lyrics: packCredits(raw[k].lyrics,songLib(ROOT).B).length, compose: packCredits(raw[k].compose,songLib(ROOT).B).length };
  }
  return {
    awards: readJson(path.join(ROOT, 'group_awards.json')) || {},
    awardsIdx: readJson(path.join(ROOT, 'awards', 'index.json')) || {}, // 시상식 수집분(awards/*.json → 그룹별 이력, 한·영 부문명) — tools/awards_check.mjs --write
    certs: readJson(path.join(ROOT, 'group_certifications.json')) || {},
    tours: readJson(path.join(ROOT, 'tours_boxscore.json')) || {},
    credits,
  };
}

async function sbGet(SB_URL, SB_KEY, q) {
  const res = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

// DB에서: 음방 1위 전체, 그룹별 인기 무대·MV(조회수 상위). 그룹당 1요청(동시 8개).
// 재생성이 도는 동안 앱 조회가 35~37초씩 걸렸다(2026-11-16 실측, smoke 실패 로그) — 쿼리 사이 짧은 쉼과
// 낮은 동시성으로 DB 피크를 눌러 앱이 숨 쉴 틈을 준다. 빌드는 1~2분 느려질 뿐이다(Disk IO 예산 메모리 참고).
const nap = ms => new Promise(r => setTimeout(r, ms));
async function prefetch({ SB_URL, SB_KEY, groupKos }) {
  const ex = { wins: {}, memberWins: {}, top: {}, allWins: [] }; // allWins: 솔로 포함 전체(연도별 음방 1위 페이지, 2026-10-30)
  try {
    let last = 0;
    for (let i = 0; i < 20; i++) {
      const rows = await sbGet(SB_URL, SB_KEY, `music_show_wins?select=id,show,win_date,song_title,group_ko,member_ko&order=id&limit=1000&offset=${last}`);
      if (!Array.isArray(rows) || !rows.length) break;
      rows.forEach(w => {
        ex.allWins.push(w);
        const key = w.group_ko === '솔로' || !w.group_ko ? null : w.group_ko;
        const bucket = key ? (ex.wins[key] = ex.wins[key] || []) : null;
        if (bucket) bucket.push(w);
        if (w.member_ko) (ex.memberWins[w.member_ko] = ex.memberWins[w.member_ko] || []).push(w);
      });
      last += rows.length;
      if (rows.length < 1000) break;
    }
  } catch (e) { console.warn('⚠️ 음방 1위 조회 실패 — 이 섹션만 빠짐:', e.message); }
  const queue = groupKos.slice();
  const worker = async () => {
    while (queue.length) {
      const g = queue.shift();
      try {
        const rows = await sbGet(SB_URL, SB_KEY, `yt_channel_videos?select=id,title,view_count,members,category,published_at&group_ko=eq.${encodeURIComponent(g)}&content_flag=is.null&is_short=eq.false&category=in.(live,mv)&order=view_count.desc.nullslast&limit=60`);
        if (Array.isArray(rows)) ex.top[g] = rows.filter(r => r.view_count);
      } catch (e) { /* 이 그룹만 빠짐 */ }
      await nap(100); // 그룹별 조회수 정렬은 비싼 축 — 몰아치지 않는다
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  return ex;
}

// ── 숫자 표기 ──
// 조회수 축약(2026-11-15 사용자 "웹앱 카드처럼 nK·nM·nB로, 한·영 동일") — 앱 _fmtFollowers와 같은 규칙: 전부 내림(반올림 금지, 2026-10-20 "9,960이 1만으로 커 보인다")
const _floorDigit = x => { const v = Math.floor(x * 10 + 1e-9) / 10; return v % 1 === 0 ? String(v) : v.toFixed(1); };
const fmtViews = (n) => {
  n = +n || 0;
  if (!n) return '';
  if (n >= 1e9) return (n >= 1e10 ? String(Math.floor(n / 1e9)) : _floorDigit(n / 1e9)) + 'B';
  if (n >= 1e6) return (n >= 1e7 ? String(Math.floor(n / 1e6)) : _floorDigit(n / 1e6)) + 'M';
  if (n >= 1e3) return Math.floor(n / 1e3) + 'K';
  return String(n);
};
// 영상 조회수 표기 = 앱 _fmtVC와 같게(2026-11-17 통일): 1M+ · 34K+ · 800+ · <100. 0/없음은 빈 문자열(칸 자체를 안 그림).
const fmtVC = (n) => {
  n = +n || 0;
  if (!n) return '';
  if (n >= 1e6) return Math.floor(n / 1e6) + 'M+';
  if (n >= 1e3) return Math.floor(n / 1e3) + 'K+';
  if (n >= 100) return Math.floor(n / 100) * 100 + '+';
  return '<100';
};
const fmtPeople = (n, en) => !n ? '' : en ? (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'K') : (n >= 1e4 ? (n >= 1e5 ? Math.round(n / 1e4) : (n / 1e4).toFixed(1).replace(/\.0$/, '')) + '만 명' : n.toLocaleString() + '명');
const fmtUsd = n => !n ? '' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M' : '$' + Math.round(n / 1e3) + 'K';
const ytUrl = id => `https://www.youtube.com/watch?v=${id}`;
const showEn = { '쇼챔피언': 'Show Champion', '엠카운트다운': 'M Countdown', '뮤직뱅크': 'Music Bank', '인기가요': 'Inkigayo', '쇼음악중심': 'Show! Music Core', '더쇼': 'The Show', '쇼케이팝': 'SHOW K-POP' };

// 1위 기록 요약 — 곡별 횟수(내림차순)·첫 1위·총합
function winSummary(list) {
  if (!list || !list.length) return null;
  const by = {};
  list.forEach(w => { const s = w.song_title || '?'; by[s] = (by[s] || 0) + 1; });
  const songs = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const sorted = list.slice().sort((a, b) => String(a.win_date).localeCompare(String(b.win_date)));
  return { total: list.length, songs, first: sorted[0], last: sorted[sorted.length - 1] };
}

// ── 그룹 페이지 보강 ──
function groupExtra(ko, lang, EX, ST, opts) {
  const en = lang === 'en';
  const out = { html: '', facts: [], titleBits: [] };
  const ws = winSummary(EX.wins[ko]);
  if (ws) {
    out.facts.push(en ? `${ws.total} music show wins` : `음악방송 1위 ${ws.total}회`);
    out.titleBits.push(en ? 'Music Show Wins' : '음방 1위');
    const f = ws.first;
    out.html += `
    <h2>${en ? 'Music show wins' : '음악방송 1위 기록'}</h2>
    <p class="intro">${en
      ? `${ws.total} wins in total. First win: '${esc(f.song_title)}' on ${esc(showEn[f.show] || f.show)} (${esc(f.win_date)}).`
      : `총 ${ws.total}회. 첫 1위는 ${esc(f.win_date)} ${esc(f.show)} '${esc(f.song_title)}'.`}</p>
    <ul class="discog-list">
      ${ws.songs.slice(0, 10).map(([s, n]) => `<li>${esc(s)} <span class="yr">${en ? `${n} win${n > 1 ? 's' : ''}` : `${n}회`}</span></li>`).join('\n      ')}
    </ul>`;
  }
  const top = (EX.top[ko] || []).slice(0, 10);
  if (top.length) {
    out.titleBits.push(en ? 'Fancams' : '직캠');
    // 위에 직캠·무대 썸네일 그리드가 이미 있으면(같은 영상들) 생략, 없으면 썸네일 카드로
    if (!(opts && opts.hideTop)) out.html += `
    <h2>${en ? 'Most viewed stages & fancams' : '인기 무대·직캠 TOP 10'}</h2>
    <div class="mf-grid">${vidCards(top, en)}</div>`;
  }
  const tours = (ST.tours[ko] || []).filter(t => t.attendance || t.gross_usd || t.shows).sort((a, b) => String(b.start || '').localeCompare(String(a.start || '')));
  if (tours.length) {
    const best = tours.filter(t => t.attendance).sort((a, b) => b.attendance - a.attendance)[0];
    if (best) out.facts.push(en ? `largest tour ${best.tour} (${fmtPeople(best.attendance, true)} attendees)` : `최대 투어 ${best.tour}(관객 ${fmtPeople(best.attendance)})`);
    out.titleBits.push(en ? 'Tours' : '투어');
    out.html += `
    <h2>${en ? 'Concert tours' : '콘서트 투어'}</h2>
    <ul class="discog-list">
      ${tours.slice(0, 12).map(t => `<li>${esc(t.tour)} <span class="yr">${esc(String(t.start || '').slice(0, 4))}${t.shows ? (en ? ` · ${t.shows} shows` : ` · ${t.shows}회`) : ''}${t.attendance ? ' · ' + (en ? fmtPeople(t.attendance, true) + ' attendees' : '관객 ' + fmtPeople(t.attendance)) : ''}${t.gross_usd ? ' · ' + fmtUsd(t.gross_usd) : ''}</span></li>`).join('\n      ')}
    </ul>
    <p class="note">${en ? 'Source: Wikipedia tour articles (reported figures such as Billboard Boxscore).' : '출처: 위키백과 투어 문서(빌보드 Boxscore 등 보고된 수치).'}</p>`;
  }
  // 수상 이력(2026-11-16 사용자 "한글·영어 수집해서 언어에 맞게 노출") — awards/index.json이 있으면 그걸로(대상 전부 + 그 밖의 수상 개수), 없으면 아래 옛 group_awards.json
  const aRecs = ((ST.awardsIdx && ST.awardsIdx.byGroup) || {})[ko] || [];
  const aDae = aRecs.filter(x => x.tier === '대상' && x.edition);
  if (aDae.length) {
    const seen = new Set();
    const dae = aDae.filter(x => { const k = [x.id, x.edition, x.en, x.member || ''].join('|'); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => String(b.edition).localeCompare(String(a.edition)) || String(a.id).localeCompare(String(b.id)));
    const rest = aRecs.length - aDae.length;
    out.facts.push(en ? `${dae.length} grand prizes (daesang)` : `대상 ${dae.length}개`);
    out.html += `
    <h2>${en ? 'Grand prizes (Daesang)' : '대상 수상'}</h2>
    <ul class="discog-list">
      ${dae.map(x => `<li>${esc(x.edition)} ${esc(en ? (x.awardEn || x.award) : x.award)} <span class="tag">${esc(en ? x.en : x.category)}</span>${x.work ? ` <span class="yr">${esc(x.work)}</span>` : ''}${x.member && !en ? ` <span class="yr">${esc(x.member)}</span>` : ''}</li>`).join('\n      ')}
    </ul>${rest > 0 ? `
    <p class="note">${en ? `Plus ${rest} other awards (main, rookie, popularity and special categories) at Melon, MAMA, Golden Disc, Seoul Music, AAA and more.` : `그 밖에 본상·신인상·인기상·특별상 등 ${rest}개(멜론·MAMA·골든디스크·서울가요대상·AAA 등).`}</p>` : ''}`;
  }
  const aw = aDae.length ? null : ST.awards[ko];
  if (aw && aw.total) {
    out.facts.push(en ? `${aw.total} grand prizes (daesang)` : `대상 ${aw.total}개`);
    out.html += `
    <h2>${en ? 'Grand prizes (Daesang)' : '대상 수상'}</h2>
    <ul class="discog-list">
      ${(aw.list || []).slice().sort((a, b) => String(b.year).localeCompare(String(a.year))).map(x => `<li>${esc(x.year)} ${esc(x.ceremony)} <span class="tag">${esc(x.category)}</span></li>`).join('\n      ')}
    </ul>`;
  }
  const ce = ST.certs[ko];
  if (ce && ce.million && ce.million.length) {
    out.facts.push(en ? `${ce.million.length} million-selling albums` : `밀리언셀러 앨범 ${ce.million.length}장`);
    out.html += `
    <h2>${en ? 'Million-selling albums' : '밀리언셀러 앨범'}</h2>
    <ul class="discog-list">
      ${ce.million.map(m => `<li>${esc(m.title)} <span class="yr">(${esc(m.year)})</span></li>`).join('\n      ')}
    </ul>`;
  }
  return out;
}

// 영상 썸네일 카드(멤버·그룹 페이지 공용, 스타일 EXTRA_CSS .mf-*). 정적 페이지의 영상 목록은 제목만 두지 말고 이걸로
// (2026-11-10 사용자 — "영상 정보엔 썸네일이 웬만해서 항상 있어야", 대표 영상·인기 TOP이 제목 줄만이었다).
// v: {id,title,published_at?,view_count?,sub?} — sub가 있으면 날짜·조회수 대신 그 줄(예: feat.)
function vidCards(list, en) {
  return list.filter(v => v && v.id).map(v => {
    const y = v.sub != null && v.sub !== '' ? v.sub : [v.published_at ? String(v.published_at).slice(0, 10).replace(/-/g, '.') : '', v.view_count ? fmtVC(v.view_count) : ''].filter(Boolean).join(' · ');
    return `<a class="mf-card" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener"><span class="mf-th"><img src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="" loading="lazy"></span><span class="mf-t">${esc(v.title)}</span>${y ? `<span class="mf-y">${esc(y)}</span>` : ''}</a>`;
  }).join('');
}

// ── 멤버 페이지 보강 ──
function memberExtra(a, primaryGko, lang, EX, ST, catalog, opts) {
  const en = lang === 'en';
  const out = { html: '', facts: [], titleBits: [] };
  const nm = a.name.ko;
  // opts.extraTop(2026-11-15) — 솔로 키(group_ko=이름) 영상·전 그룹 개인 영상까지 합쳐 앱 멤버 카드와 같은 범위로
  const _seenTop = new Set();
  const top = [...(EX.top[primaryGko] || []).filter(v => Array.isArray(v.members) && v.members.includes(nm)), ...((opts && opts.extraTop) || [])]
    .filter(v => v && !_seenTop.has(v.id) && _seenTop.add(v.id))
    .sort((x, y) => (y.view_count || 0) - (x.view_count || 0)).slice(0, 5);
  if (top.length) {
    out.titleBits.push(en ? 'Fancams' : '직캠');
    if (!(opts && opts.hideTop)) out.html += `
    <h2>${en ? 'Most viewed fancams & stages' : '인기 직캠·무대 TOP 5'}</h2>
    <div class="mf-grid">${vidCards(top, en)}</div>`;
  }
  const cr = catalog ? {lyrics:catalog.ly.length,compose:catalog.co.length} : ST.credits[nm + '|' + (primaryGko || '')] || ST.credits[nm + '|'];
  if (cr && (cr.lyrics || cr.compose)) {
    // 0인 쪽은 말하지 않는다('작곡 0곡 참여'는 정보가 아니라 어색함)
    const partsKo = [cr.lyrics ? `작사 ${cr.lyrics}곡` : '', cr.compose ? `작곡 ${cr.compose}곡` : ''].filter(Boolean);
    const partsEn = [cr.lyrics ? `${cr.lyrics} as lyricist` : '', cr.compose ? `${cr.compose} as composer` : ''].filter(Boolean);
    out.facts.push(en ? `songwriting credits: ${partsEn.join(', ')}` : `${partsKo.join('·')} 참여`);
    // 2026-11-10 사용자 — "'이름을 올렸다' 개구려, 작사 n 작곡 n으로 간단히 + 어떤 노래인지 몇 개라도". 곡이 아주 많은 사람도 있어
    // 최근 곡부터 CREDIT_SHOW개만 칩으로 두고, 나머지는 작사·작곡 전체 페이지(opts.creditHref)로 보낸다.
    const CREDIT_SHOW = 12;
    const roles = new Map();
    if (catalog) {
      for (const s of catalog.ly) roles.set(s.b, { title: s.title, id: s.id || 0, ly: true, co: false });
      for (const s of catalog.co) { const r = roles.get(s.b); if (r) { r.co = true; r.id = Math.max(r.id, s.id || 0); } else roles.set(s.b, { title: s.title, id: s.id || 0, ly: false, co: true }); }
    }
    const songs = [...roles.values()].sort((p, q) => q.id - p.id);
    const roleLbl = r => r.ly && r.co ? (en ? 'Lyrics·Music' : '작사·작곡') : r.ly ? (en ? 'Lyrics' : '작사') : (en ? 'Music' : '작곡');
    const statKo = [cr.lyrics ? `작사 ${cr.lyrics}` : '', cr.compose ? `작곡 ${cr.compose}` : ''].filter(Boolean).join(' · ');
    const statEn = [cr.lyrics ? `Lyrics ${cr.lyrics}` : '', cr.compose ? `Music ${cr.compose}` : ''].filter(Boolean).join(' · ');
    const more = opts && opts.creditHref ? `
    <p class="note"><a href="${opts.creditHref}">${songs.length > CREDIT_SHOW ? (en ? `All ${songs.length} songs →` : `전체 ${songs.length}곡 보기 →`) : (en ? 'Credits page →' : '작사·작곡 자세히 →')}</a></p>` : '';
    out.hasCredits = true; // 섹션 안에 전체 보기 링크가 있으니 빌더의 단독 링크(creditLinkHtml)는 생략
    out.html += `
    <h2>${en ? 'Songwriting credits' : '작사·작곡'}</h2>
    <p class="intro">${en ? statEn : statKo}</p>${songs.length ? `
    <ul class="member-list">
      ${songs.slice(0, CREDIT_SHOW).map(r => `<li>${esc(r.title)} <span class="tag">${roleLbl(r)}</span></li>`).join('\n      ')}
    </ul>` : ''}${more}`;
  }
  const ws = winSummary(EX.memberWins[nm]);
  if (ws) {
    out.facts.push(en ? `${ws.total} solo music show wins` : `솔로 음방 1위 ${ws.total}회`);
    out.html += `
    <h2>${en ? 'Solo music show wins' : '솔로 음악방송 1위'}</h2>
    <ul class="discog-list">
      ${ws.songs.slice(0, 8).map(([s, n]) => `<li>${esc(s)} <span class="yr">${en ? `${n} win${n > 1 ? 's' : ''}` : `${n}회`}</span></li>`).join('\n      ')}
    </ul>`;
  }
  return out;
}

// 데뷔 나이·현재 나이. 데뷔는 소속했던 그룹들 중 **가장 이른 데뷔일** — 주 소속 기준이면 장원영이 아이브(17세)로 나오지만
// 실제 첫 데뷔는 아이즈원(14세)이다(2026-10-16 표본). groupInfos: 그 사람이 속했던 그룹 정보 배열.
function ages(a, groupInfos) {
  const m = String(a.bday || '').match(/(\d{4})\D?(\d{1,2})?\D?(\d{1,2})?/);
  if (!m) return {};
  const b = Date.UTC(+m[1], (+m[2] || 7) - 1, +m[3] || 1);
  const age = Math.floor((Date.now() - b) / (365.2425 * 864e5));
  let debutDate = null;
  const ds = [...(groupInfos || []).filter(Boolean).map(g => songLib(path.join(__dirname,'..')).D(g.joined,g.debut)), a.debut].filter(Boolean).map(date => String(date).match(/(\d{4})\D?(\d{1,2})?\D?(\d{1,2})?/)).filter(Boolean)
    .map(d => Date.UTC(+d[1], (+d[2] || 7) - 1, +d[3] || 1));
  if (ds.length) {
    const minTs = Math.min(...ds);
    const d = new Date(minTs);
    debutDate = `${d.getUTCFullYear()}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  return { age: age > 8 && age < 90 ? age : null, debutDate };
}

// ── 곡 페이지 데이터(2026-10-16, 검색 노출 2단계) ─────────────────────────────────────────────
// "LOVE DIVE 직캠", "Supernova 무대" 같은 곡 단위 검색을 노린다. 영상↔곡 연결은 앱·루틴과 **같은 규칙**(shared.js _songLinkBases)을
// 여기서 직접 돌린다 — DB의 song_keys(루틴 10단계)가 아직 비어 있어도, 루틴이 실패해도 페이지는 만들어진다.
const vm = require('vm');
let _SL = null;
function songLib(ROOT) {
  if (_SL) return _SL;
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + ';this.f=_songLinkBases;this.L=_songListFromDisco;this.B=_songBase;this.N=_songNorm;this.D=_groupJoinOrDebut;this.A=_songAliasesFor;this.K=_songAddNicks;this.T=_songTitleFor;', ctx);
  return (_SL = ctx);
}
// 그룹별 영상 전부(가로 영상, 노출 가능한 것만) — id 순 페이지 넘김(정렬 없는 페이지 나눔은 중복·누락 — 메모리)
async function prefetchGroupVideos({ SB_URL, SB_KEY, groupKos }) {
  const out = {};
  const queue = groupKos.slice();
  const worker = async () => {
    while (queue.length) {
      const g = queue.shift(); const rows = []; let last = '';
      try {
        for (let i = 0; i < 40; i++) {
          const page = await sbGet(SB_URL, SB_KEY, `yt_channel_videos?select=id,title,view_count,members,category,published_at,content_formats&group_ko=eq.${encodeURIComponent(g)}&content_flag=is.null&is_short=eq.false&unavailable_at=is.null&order=id&limit=1000${last ? `&id=gt.${encodeURIComponent(last)}` : ''}`);
          if (!Array.isArray(page) || !page.length) break;
          rows.push(...page); last = page[page.length - 1].id;
          if (page.length < 1000) break;
          await nap(100);
        }
      } catch (e) { console.warn(`[prefetchGroupVideos] ${g}: ${e.message}`); }
      out[g] = rows;
    }
  };
  await Promise.all(Array.from({ length: 2 }, worker));
  return out;
}
// 곡 목록 + 영상 묶기. 반환: { [gko]: [{b, title, album, date, isTitle, cr, vids:[…], wins}] } — 영상 minVids개 이상인 곡만
function bilingualSongTitle(raw, fallback) {
  const value=String(raw||'').trim(),m=/^([^()[\]]+?)\s*\(([^()]+)\)$/.exec(value);
  if(!m||/\b(?:feat|ft|inst|instrumental|ver|version|remix|live|edit|CD Only)\b/i.test(m[2]))return fallback;
  const ko=s=>/[가-힣]/.test(s),en=s=>/[a-z]/i.test(s);
  return (ko(m[1])&&!en(m[1])&&en(m[2])&&!ko(m[2]))||(en(m[1])&&!ko(m[1])&&ko(m[2])&&!en(m[2])) ? value : fallback;
}
// 투어·콘서트·팬미팅 이름(따옴표·괄호 안) — 곡 연결에서 그 이름 속 곡을 빼는 데만 쓴다
const TOUR_NAME_RE = /(tour|투어|concert|콘서트|fan\s*-?\s*meeting|팬미팅|fan-?con|팬콘)\s*[\[<'"‘“《〈「(]\s*([^\]>'"’”》〉」)]{2,60})/ig;
// 앨범의 구조 트랙(곡이 아닌 인트로·아웃트로·간주·스킷·프롤로그·에필로그) 기본형 — 곡 페이지 대상에서 뺀다. 'Opening'·'Ending'처럼 실제 곡명인 경우가 있는 건 넣지 않는다.
const STRUCTURAL_TRACKS = new Set(['intro', 'outro', 'interlude', 'skit', 'prologue', 'epilogue', '인트로', '아웃트로', '인터루드', '스킷', '프롤로그', '에필로그']);
// 곡명은 보통 따옴표 안에, 행사·투어·프로그램 이름은 따옴표 밖(@…, | …, '… TOUR')에 있다(2026-11-16 Codex 곡 오분류 66+21개 —
// NCT WISH 'Sticky'가 "INTO THE WISH" 콘서트명 때문에 곡 'WISH'로, NEXZ 'Simmer'가 "COMEBACKSHOW O-RLY?"로, 'Legacy'가 "HELLMATE TOUR"로 잡힘).
// f(text) = 그 글에서 곡 기본형 배열을 돌려주는 매처(S.f를 감싼 것). 순수 함수라 따로 테스트한다.
// 따옴표 안 곡명 — 글자·숫자 바로 옆의 작은따옴표는 따옴표가 아니라 어포스트로피다(2026-11-17: God's·Don't의 '가 따옴표로 읽혀 '神메뉴' (… 'God's Menu')가 쪼개졌다).
const QUOTED_RE = /(?<![A-Za-z0-9])[“‘'"]([^“”‘’'"]{2,60})[”’'"](?![A-Za-z0-9])/g;
const TOUR_SUFFIX_RE = /([A-Za-z][A-Za-z0-9 '’:!?.&\-]{2,40}?)\s+(?:world\s+)?(?:tour|concert|encore|fan\s*-?\s*meeting)\b/ig;
// 곡 페이지 '직캠·무대'에 안 맞는 영상(2026-11-17, Codex 팬 관점 검수 — 스트레이키즈 This & That 곡 페이지 상위에 앨범 트레일러·메이킹·다른 수록곡 UNVEIL).
// 앨범 이름과 같은 곡이면 앨범 홍보 영상 제목에 곡명이 그대로 들어 있어 곡 영상으로 잡힌다. 분류가 live·mv인 영상(음방·직캠·안무·MV)은 항상 둔다 — 실제 무대가
// other로 분류된 경우(SBS 인기가요·가요대전)가 있어 other를 통째로 빼지 않고, **other 중 제목·형식이 비공연인 것만** 뺀다.
const NON_PERF_RE = /\b(trailer|teaser|reaction|mashup|guide video|lyrics? (video|visualizer)|visualizer|making( film)?|behind|unveil|spoiler|preview|highlight medley|track ?list|jacket|interview|unboxing|album (film|talk)|compilations?|intro)\b|트레일러|티저|리액션|메이킹|비하인드|가이드 영상|가사 영상|스포일러|프리뷰|하이라이트 메들리|인터뷰|언박싱|모아보기/i;
function songStrongCategory(v) { return !!v && (v.category === 'live' || v.category === 'mv' || (v.content_formats || []).some(f => /^EV:/.test(f))); }
function isNonPerformance(v) {
  if (!v) return false;
  if (v.category === 'live' || v.category === 'mv') return false;
  if ((v.content_formats || []).some(f => /^EV:/.test(f))) return false; // 시상식·연말 무대는 그대로
  if ((v.content_formats || []).some(f => /비하인드|variety|예능/.test(f))) return true;
  return NON_PERF_RE.test(String(v.title || ''));
}
// 지명 곡(2026-11-18 사용자 "정국 seoul 직캠 페이지 뭐임 — seoul은 노래가 아니잖아"): 방탄 디스코의 RM 'seoul' 때문에 'Live in Seoul'·'Proof in Seoul'·
// 'One Bus Ride from Seoul' 영상이 곡 'seoul'로 묶여 그룹·멤버 곡 페이지가 생겼다. 지명은 영상 제목에 장소로 훨씬 자주 나온다 —
// 앞에 in·from·at·@ 등이 붙거나 뒤에 Music Awards·Festival·Concert 등이 붙으면 장소로 보고 곡에서 뺀다(따옴표 안 'Seoul'·"서울"은 곡).
const PLACE_SONG_RE = { seoul: 'seoul|서울', '서울': 'seoul|서울', tokyo: 'tokyo|도쿄|東京', '도쿄': 'tokyo|도쿄|東京', paris: 'paris|파리', '파리': 'paris|파리',
  london: 'london|런던', '런던': 'london|런던', busan: 'busan|부산', '부산': 'busan|부산', newyork: 'new\\s*york|뉴욕', '뉴욕': 'new\\s*york|뉴욕',
  hongkong: 'hong\\s*kong|홍콩', jeju: 'jeju|제주', '제주': 'jeju|제주', bangkok: 'bangkok|방콕', berlin: 'berlin|베를린', miami: 'miami|마이애미',
  lasvegas: 'las\\s*vegas|라스베가스', seoulcity: 'seoul\\s*city', osaka: 'osaka|오사카', manila: 'manila|마닐라', jakarta: 'jakarta|자카르타' };
const PLACE_PRE = '(?:\\b(?:in|from|at|to|of|across|around|near|live|encore|tour|day|night)\\s+|@\\s*|에서\\s*|in\\s+the\\s+)';
const PLACE_POST = '(?:\\s+(?:music\\s+awards?|awards?|festival|fest|fashion|concert|tour|forest|jazz|world|olympic|station|global|international|k-?pop|countdown|tower|land|trip|vlog|edition|stage|dome|arena|stadium|공연|콘서트|투어|가요|여행|브이로그))';
function placeSongIsPlace(t, b) {
  const nm = PLACE_SONG_RE[b]; if (!nm) return false;
  const bare = t.replace(QUOTED_RE, m => new RegExp('^.(?:' + nm + ').$', 'i').test(m) ? ' ' : m); // 따옴표로 감싼 지명 하나는 곡 표기 — 빼고 본다
  if (bare !== t && !new RegExp(nm, 'i').test(bare)) return false; // 지명이 따옴표 안에만 있으면 곡
  return new RegExp(PLACE_PRE + '(?:' + nm + ')', 'i').test(bare) || new RegExp('(?:' + nm + ')' + PLACE_POST, 'i').test(bare);
}
function refineSongsByTitle(title, bs, f) {
  if (!bs || !bs.length) return bs;
  const t = String(title || '');
  bs = bs.filter(x => !placeSongIsPlace(t, x));
  if (!bs.length) return bs;
  const quoted = [...t.matchAll(QUOTED_RE)].map(m => m[1]);
  if (!quoted.length) return bs; // 따옴표 없는 제목은 근거가 약해 그대로
  // 따옴표 안 글자만 떼어 다시 곡을 찾을 땐 **따옴표를 다시 씌운다** — 따옴표 없는 글에선 4글자 미만 곡명(神메뉴·락·특)을 믿지 않는 규칙 때문에 qbs가 비어,
  // '神메뉴'처럼 따옴표로 감싼 직캠·무대 영상이 전부 곡에서 떨어졌다(2026-11-17 Codex 검수 — 스트레이키즈 현진 神메뉴 9개 중 1개만 연결, 멤버 페이지 0개).
  const qbs = f(quoted.map(q => '"' + q + '"').join(' | ')) || [];
  if (bs.length > 1) { const keep = bs.filter(x => qbs.includes(x)); return keep.length ? keep : bs; } // ① 여러 곡이 잡히면 따옴표 안에서 잡힌 곡만
  if (qbs.includes(bs[0])) return bs;
  // ② 한 곡만 잡혔는데 따옴표 밖에서만 잡힘: '@'·'|' 뒤(행사·프로그램 꼬리)나 '○○ TOUR' 이름 속이면 곡이 아니다
  const head = t.split(/[@|｜]/)[0], hbs = f(head.replace(QUOTED_RE, ' ')) || [];
  const noTour = f(t.replace(QUOTED_RE, ' ').replace(TOUR_SUFFIX_RE, ' ')) || [];
  return hbs.includes(bs[0]) && noTour.includes(bs[0]) ? bs : [];
}
function buildSongs({ ROOT, groups, artists, EX, vids, minVids = 4 }) {
  const S = songLib(ROOT);
  const persons = new Set();
  artists.forEach(a => [a.name && a.name.ko, a.name && a.name.en].forEach(x => { const n = S.N(x); if (n.length >= 2) persons.add(n); }));
  const fileKey = s => String(s).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');
  const out = {};
  for (const g of Object.keys(groups)) {
    const d = readJson(path.join(ROOT, 'disco/g', fileKey(g) + '.json'));
    if (!d || !vids[g] || !vids[g].length) continue;
    const albums = [...Object.values(d.g || {}), ...Object.values(d.m || {}).flatMap(x => [...(x.d || []), ...(x.u || []).flatMap(u => (u && u.albums) || [])])];
    // 별칭(한글 소리 표기·공식 영문 제목)까지 — 앱 루틴(admin.js)과 같은 곡 목록(2026-11-11)
    // 곡이 아닌 구조 트랙(Intro·Outro 등)은 곡 페이지·멤버×곡 페이지를 만들지 않는다(2026-11-16 사용자 "intro는 노래 제목이 아닌데" —
    // 에이티즈 성화 /s/intro/ 등 6그룹 12주소×한·영). 앨범 수록 목록(디스코)에는 그대로 있고, 곡 페이지·영상 곡 연결 후보에서만 뺀다.
    const songs = S.K(S.L(albums, persons), g).filter(s => !STRUCTURAL_TRACKS.has(s.b));
    if (!songs.length) continue;
    const fanName = S.B(((groups[g] || {}).fandom || {}).ko || '') || null;
    const songMaxLen = new Map(songs.map(x => [x.b, Math.max(S.N(x.title || '').length, x.b.length, ...((x.alias || []).map(a => (a && a.n || '').length)))]));
    // 곡 → 처음 실린 앨범(가장 이른 발매)·타이틀곡 여부·크레딧
    const meta = {};
    // 첫 수록 앨범은 본판 우선(2026-11-13 Codex — B1A4 '이게 무슨 일이야'가 앞 앨범의 반주 트랙 때문에 'In the Wind'로, 일본반·라이브·베스트가
    // 원곡 앨범보다 먼저 잡히던 것). 같은 등급 안에선 발매일 순. 반주(Inst.) 트랙은 첫 수록 판정에 안 쓴다(본곡이 어디에도 없을 때만).
    const alRank = al => (al.region === 'jp' || /라이브|컴필레이션|리믹스|베스트/.test(al.type || '') || /\b(live|concert|remix(es)?|best|tour)\b|라이브|콘서트/i.test(al.title || '')) ? 1 : 0;
    const isInst = t => /\((inst\.?|instrumental|mr)\)\s*$/i.test(String(t || ''));
    const ordered = albums.slice().sort((x, y) => alRank(x) - alRank(y) || String(x.releaseDate || '').localeCompare(String(y.releaseDate || '')));
    const hasMain = new Set(); ordered.forEach(al => (al.tracks || []).forEach(tr => { if (tr && tr.title && !isInst(tr.title)) hasMain.add(S.B(tr.title)); }));
    ordered.forEach(al => (al.tracks || []).forEach(tr => {
      if (!tr || !tr.title) return;
      if (isInst(tr.title) && hasMain.has(S.B(tr.title))) return;
      const b = S.B(tr.title); if (!b) return;
      // 표시 이름은 가장 먼저 나온 원곡 제목(띄어 쓴 첫 괄호 앞 — 붙은 괄호는 이름의 일부: FRI(END)S) — 곡 목록 순서대로 쓰면 'LOVE DIVE -Japanese version-'이 이름이 됐다
      const m = meta[b] || (meta[b] = { name: String(tr.title).replace(/\s*-[^-]*\bver(?:sion)?\b\.?[^-]*-\s*$/i, '').split(/\s+[\(\[]/)[0].trim(), album: al.title, date: al.releaseDate || '', isTitle: false, cr: null, melonId: null, cover: al.cover || null });
      if(!m.bilingualTitle)m.bilingualTitle=bilingualSongTitle(tr.title,null);
      // 공식 영문 제목이 따로 있는 곡은 '한글 제목 English Title'(괄호 없이 — 원래 제목에 괄호 영문이 붙은 곡과 구분, docs/NAMING.md)
      if(!m.bilingualTitle){const al=S.A&&(S.A(g,tr.title)||S.A(g,m.name));if(al&&al[0])m.bilingualTitle=m.name+' '+al[0];}
      // 영어 화면 표기(2026-11-12 사용자 — 영어권엔 영문 제목만, 한글 없는 제목은 그대로): shared.js _songTitleFor
      if(!m.enTitle&&S.T){const e=S.T(g,String(tr.title).replace(/\s*[\(\[](feat|ft)\.?\s[^\)\]]*[\)\]]/gi,'').trim(),'en',tr.en);if(e&&!/[가-힣]/.test(e))m.enTitle=e;}
      if (tr.isTitle) m.isTitle = true;
      if (!m.cr && tr.cr) m.cr = tr.cr;
      if (!m.melonId && tr.songId) m.melonId = tr.songId;
      if (!m.cover && al.cover) m.cover = al.cover; // 곡 타일 이미지(2026-10-30)
    }));
    // 멤버 솔로 앨범에만 있는 곡은 그 멤버가 태그된 영상만(2026-11-13 Codex — 백현 솔로 'Diamond'에 EXO 단체 무대, 예성 '우리의 시간'·규현 '투게더'에
    // 다른 OST, 니엘 '전화해'에 틴탑 'Call Me' 무대). 그룹 앨범에도 있는 곡은 그대로.
    const groupB = new Set(Object.values(d.g || {}).flatMap(al => (al.tracks || []).map(tr => S.B(tr && tr.title || ''))));
    const soloOnly = new Map();
    Object.entries(d.m || {}).forEach(([nm, x]) => [...(x.d || []), ...(x.u || []).flatMap(u => (u && u.albums) || [])].forEach(al => (al.tracks || []).forEach(tr => { const b = S.B(tr && tr.title || ''); if (!b || groupB.has(b)) return; (soloOnly.get(b) || soloOnly.set(b, new Set()).get(b)).add(nm); })));
    const bucket = new Map(songs.map(s => [s.b, { b: s.b, title: s.title.replace(/\s*[\(\[].*$/, '') || s.title, vids: [] }]));
    const names = [g, groups[g].en || ''];
    for (const v of vids[g]) {
      let bs = S.f(v.title || '', songs, names);
      // 행사·투어 이름이 곡으로 잡히는 것(2026-11-13 Codex): ① 시상식 행사 표시(content_formats 'EV:mama')와 같은 이름의 곡('MAMA')은 빼고
      // ② 다른 곡도 잡힌 영상이면 투어·콘서트 이름 안의 곡('2ND WORLD TOUR [ BORN TO BE ]', 콘서트 'You are My Day')은 뺀다
      const ev = new Set((v.content_formats || []).filter(x => /^EV:[^:]+$/.test(x)).map(x => x.slice(3)));
      if (ev.size) bs = bs.filter(x => !ev.has(x));
      if (bs.length > 1) { const tn = [...String(v.title || '').matchAll(TOUR_NAME_RE)].map(m => S.N(m[2])).filter(Boolean);
        if (tn.length) { const keep = bs.filter(x => !tn.some(n => n.includes(x))); if (keep.length) bs = keep; } }
      bs = refineSongsByTitle(v.title || '', bs, txt => S.f(txt, songs, names)); // 따옴표 안 곡 우선·따옴표 밖 행사명 제외(2026-11-16)
      // 근거 강한 영상 = 무대(live·mv)·시상식이거나 곡명이 따옴표 안(2026-11-18). 곡명이 제목 어딘가에 들어 있기만 한 공항·브이로그·예능은 약한 근거.
      // 따옴표 근거는 따옴표 안이 거의 곡명 그대로일 때만(괄호 부제 떼고 곡명·별칭 중 가장 긴 것 ×1.3+1자 이내) — '골차의 휴일 시즌3' 안의 '골차'는 곡 Gol-Cha!가 아니다.
      // 회차물(Ep.3·EPISODE·#5·브이로그)은 따옴표 안이 곡명이어도 채널·코너 이름이다(골든차일드 “CH.GOL-CHA!” Ep.14). 팬덤 이름과 같은 곡(르세라핌 '피어나')은 무대 영상도 따옴표가 있어야.
      const epi = /\b(ep|episode)\.?\s*\d|#\d+\b|vlog|브이로그|\d+화\b/i.test(String(v.title || ''));
      const strongCat = songStrongCategory(v);
      const qb = (epi ? [] : [...String(v.title || '').matchAll(QUOTED_RE)]).flatMap(m => { const core = m[1].split(/\s*[([]/)[0]; return (S.f('"' + core + '"', songs, names) || []).filter(x => S.N(core).length <= (songMaxLen.get(x) || 0) * 1.3 + 1); });
      for (const b of bs) { const s = bucket.get(b); if (!s) continue; const own = soloOnly.get(b); if (own && !(v.members || []).some(m => own.has(m))) continue; s.vids.push(v); if ((strongCat && !(fanName && b === fanName)) || qb.includes(b)) (s.strong || (s.strong = new Set())).add(v); }
    }
    // 1위 기록은 곡 제목이 영어로 저장된 경우가 있다('HEYA'·'God of Music') — 별칭으로도 기본형을 찾는다
    const toBase = new Map(); songs.forEach(s => { toBase.set(s.b, s.b); (s.alias || []).forEach(al => { if (!toBase.has(al.n)) toBase.set(al.n, s.b); }); });
    const winBy = {};
    (EX.wins[g] || []).forEach(w => { const b = toBase.get(S.B(w.song_title || '')) || toBase.get(S.N(w.song_title || '')); if (b) winBy[b] = (winBy[b] || 0) + 1; });
    // 곡 페이지는 근거 강한 영상이 4개 이상, 또는 2~3개이면서 묶인 영상의 절반 이상일 때만(2026-11-18 사용자 '정국 seoul 직캠 페이지 뭐임 — seoul은 노래가 아니잖아').
    // 곡명이 제목 어딘가에 있기만 해도 묶여 골든차일드 'Gol-Cha!'←예능 '골차의 휴일', 세븐틴 'HEALING'←공항 기사, 아이브 'Fashion'←공항패션, 갓세븐 'PAGE'←GOT7_PAGE_01,
    // 트와이스 'Talk'←토크쇼, 르세라핌 '피어나'←팬덤 이름 같은 페이지가 생겼다(정적 곡 페이지 중 무대 영상 비율 50% 미만 481개).
    // 화면엔 근거 강한 영상만(그중 비공연 제목은 다시 뺌). 빠진 페이지는 retireStaleDirs가 부모 페이지로 넘긴다.
    bucket.forEach(s => { s.vidsAll = s.vids.length; const st = s.vids.filter(v => s.strong && s.strong.has(v)); s.nStrong = st.length; const perf = st.filter(v => !isNonPerformance(v)); s.vids = perf.length ? perf : st; });
    const list = [...bucket.values()].filter(s => s.vidsAll >= minVids && s.nStrong >= 2 && (s.nStrong >= 4 || s.nStrong * 2 >= s.vidsAll)).map(s => { const m = meta[s.b] || {}; return Object.assign(s, m, { title: m.name || s.title, wins: winBy[s.b] || 0 }); });
    list.forEach(s => s.vids.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)));
    if (list.length) {
      out[g] = list.sort((a, b) => b.vids.length - a.vids.length);
      // 별칭 → 곡 기본형(판본 곡 합치기로 빠진 'plottwist' → '첫만남은계획대로되지않아' 등). 배열의 속성이라 JSON·반복엔 안 나온다
      Object.defineProperty(out[g], 'aliasTo', { value: new Map([...toBase].filter(([n, b]) => n !== b)), enumerable: false });
    }
  }
  return out;
}
// 조회수는 두 자리 유효숫자로 — 페이지가 매번 바뀌면 재생성마다 수천 파일이 커밋돼 저장소가 불어난다(2026-10-16)
const roundViews = n => { if (!n) return 0; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / p) * p; };

const EXTRA_CSS =`.vid-list{padding-left:20px;margin:0;}.vid-list li{font-size:13.5px;margin-bottom:7px;}.vid-list a{color:rgba(210,225,255,0.95);text-decoration:none;}.note{font-size:11px;color:rgba(150,170,210,0.55);margin:14px 0 0;}.note a{color:rgba(150,175,255,0.65);text-decoration:none;}.rel a{color:rgba(210,225,255,0.95);text-decoration:none;}.sp-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 10px;}@media(min-width:620px){.sp-tiles{grid-template-columns:repeat(5,minmax(0,1fr));}}.sp-tile{display:block;text-decoration:none;min-width:0;}.sp-tile img,.sp-tile-ph{display:block;width:100%;aspect-ratio:1;border-radius:10px;object-fit:cover;background:#1e1e21;}.sp-tile-t{display:block;font-size:12.5px;margin-top:6px;color:rgba(228,236,255,0.92);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.sp-tile-n{display:block;font-size:11px;color:rgba(160,180,230,0.6);}.mf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 10px;margin-bottom:6px;}@media(min-width:620px){.mf-grid{grid-template-columns:repeat(3,minmax(0,1fr));}}.mf-card{display:block;min-width:0;text-decoration:none;}.mf-th{display:block;position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#17171a;}.mf-th img{width:100%;height:100%;object-fit:cover;display:block;}.mf-t{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:13px;line-height:1.38;margin-top:7px;color:rgba(228,236,255,0.94);}.mf-y{display:block;font-size:11.5px;color:rgba(160,180,230,0.6);margin-top:2px;}
/* 넓은 화면(PC) 2단 — 그룹·멤버 페이지가 폰 화면을 늘린 640px 기둥이던 것(2026-11-18 사용자 "웹인데 모바일 화면 보는 것 같다").
   곡·앨범 페이지(song-page.css)와 같은 1120px·왼쪽 큰 이미지 + 오른쪽 정보·영상 4열. 폰(1000px 미만)은 그대로.
   .top2 안의 h1·'이번 주 팬 N명'(seo_play.js가 h1 뒤에 끼움)·메타는 전부 오른쪽 칸 아래쪽 정렬. */
@media(min-width:1000px){
  .wrap{max-width:1120px;padding:22px 32px 40px;}
  .top2{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);grid-template-rows:1fr;grid-auto-rows:min-content;column-gap:32px;margin:14px 0 8px;}
  .top2::before{content:'';grid-column:2;grid-row:1;}
  .top2 .cover{grid-column:1;grid-row:1 / span 30;width:100%;max-width:none;aspect-ratio:16/9;object-fit:cover;margin:0;}
  .top2>*:not(.cover){grid-column:2;min-width:0;}
  .top2 h1{font-size:34px;line-height:1.15;margin:0 0 6px;word-break:keep-all;}
  .top2 .meta{font-size:14.5px;margin-bottom:0;}
  .mf-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:20px 14px;}
  h2{font-size:20px;margin:36px 0 14px;}
  /* 프로필 사진(원형)일 때: 왼쪽은 원 하나 크기만, 이름·정보는 그 옆 가운데 높이 */
  .top2:has(.avatar){grid-template-columns:auto minmax(0,1fr);column-gap:36px;} /* 이름·정보는 곡 페이지처럼 사진 아래쪽에 맞춤 */
  .top2 .cover.avatar{grid-row:1 / span 30;width:240px;height:240px;aspect-ratio:1;margin:0;}
}
/* 프로필 사진 원형(폰 포함) — 앱 카드의 원 사진과 같은 모양 */
.cover.avatar{width:132px;height:132px;max-width:none;aspect-ratio:1;border-radius:50%;object-fit:cover;object-position:center 30%;margin:6px 0 18px;box-shadow:0 0 0 1px rgba(150,175,255,0.18);}`;

module.exports = { placeSongIsPlace, STRUCTURAL_TRACKS, isNonPerformance, refineSongsByTitle, vidCards, loadStatic, packCredits, bilingualSongTitle, prefetch, groupExtra, memberExtra, ages, EXTRA_CSS, fmtViews, fmtVC, prefetchGroupVideos, buildSongs, roundViews, esc };
