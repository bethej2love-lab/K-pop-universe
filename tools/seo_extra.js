// 정적 SEO 페이지 보강(2026-10-16, 사용자: "유입을 늘리려면 검색 노출 강화가 핵심") ───────────────────────────────
// 그룹·멤버 정적 페이지가 데뷔일·소속사·멤버·앨범 목록뿐이라 나무위키보다 나을 게 없었다(검색엔진이 보기엔 얇은 페이지).
// 우리만 가진 정보를 페이지에 싣는다 — 음악방송 1위 기록(곡별·첫 1위), 인기 무대·직캠 TOP(조회수), 투어 성적(관객·매출),
// 대상 수상, 밀리언셀러, 작사·작곡 곡 수. 실제 검색어("아이브 음방 1위", "장원영 직캠", "OO 투어 관객")에 맞는 문장과 숫자.
// build_group_pages.js가 부른다. DB(공개 anon 키, 읽기 전용) 조회가 실패해도 정적 파일 정보만으로 페이지는 만든다.
const fs = require('fs');
const path = require('path');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } };

function loadStatic(ROOT) {
  const credits = {};
  const raw = readJson(path.join(ROOT, 'artist_credits.json')) || {};
  for (const k of Object.keys(raw)) { // 키 = '이름\0그룹'(널 문자 구분 — 메모리: artist_credits 키 포맷)
    const [nm, g] = k.split(String.fromCharCode(0));
    credits[nm + '|' + (g || '')] = { lyrics: (raw[k].lyrics || []).length, compose: (raw[k].compose || []).length };
  }
  return {
    awards: readJson(path.join(ROOT, 'group_awards.json')) || {},
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
async function prefetch({ SB_URL, SB_KEY, groupKos }) {
  const ex = { wins: {}, memberWins: {}, top: {} };
  try {
    let last = 0;
    for (let i = 0; i < 20; i++) {
      const rows = await sbGet(SB_URL, SB_KEY, `music_show_wins?select=id,show,win_date,song_title,group_ko,member_ko&order=id&limit=1000&offset=${last}`);
      if (!Array.isArray(rows) || !rows.length) break;
      rows.forEach(w => {
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
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return ex;
}

// ── 숫자 표기 ──
const fmtViews = (n, en) => {
  if (!n) return '';
  n = roundViews(n);
  if (en) return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
  return n >= 1e8 ? (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억회' : n >= 1e4 ? Math.round(n / 1e4).toLocaleString() + '만회' : n.toLocaleString() + '회';
};
const fmtPeople = (n, en) => !n ? '' : en ? (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1e3) + 'K') : (n >= 1e4 ? (n >= 1e5 ? Math.round(n / 1e4) : (n / 1e4).toFixed(1).replace(/\.0$/, '')) + '만 명' : n.toLocaleString() + '명');
const fmtUsd = n => !n ? '' : n >= 1e9 ? '$' + (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(n >= 1e8 ? 0 : 1) + 'M' : '$' + Math.round(n / 1e3) + 'K';
const ytUrl = id => `https://www.youtube.com/watch?v=${id}`;
const showEn = { '쇼챔피언': 'Show Champion', '엠카운트다운': 'M Countdown', '뮤직뱅크': 'Music Bank', '인기가요': 'Inkigayo', '쇼음악중심': 'Show! Music Core', '더쇼': 'The Show' };

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
function groupExtra(ko, lang, EX, ST) {
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
    out.html += `
    <h2>${en ? 'Most viewed stages & fancams' : '인기 무대·직캠 TOP 10'}</h2>
    <ol class="vid-list">
      ${top.map(v => `<li><a href="${ytUrl(v.id)}" target="_blank" rel="noopener">${esc(v.title)}</a> <span class="yr">${fmtViews(v.view_count, en)}${v.published_at ? ' · ' + esc(String(v.published_at).slice(0, 4)) : ''}</span></li>`).join('\n      ')}
    </ol>`;
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
  const aw = ST.awards[ko];
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

// ── 멤버 페이지 보강 ──
function memberExtra(a, primaryGko, lang, EX, ST) {
  const en = lang === 'en';
  const out = { html: '', facts: [], titleBits: [] };
  const nm = a.name.ko;
  const top = (EX.top[primaryGko] || []).filter(v => Array.isArray(v.members) && v.members.includes(nm)).slice(0, 5);
  if (top.length) {
    out.titleBits.push(en ? 'Fancams' : '직캠');
    out.html += `
    <h2>${en ? 'Most viewed fancams & stages' : '인기 직캠·무대 TOP 5'}</h2>
    <ol class="vid-list">
      ${top.map(v => `<li><a href="${ytUrl(v.id)}" target="_blank" rel="noopener">${esc(v.title)}</a> <span class="yr">${fmtViews(v.view_count, en)}</span></li>`).join('\n      ')}
    </ol>`;
  }
  const cr = ST.credits[nm + '|' + (primaryGko || '')] || ST.credits[nm + '|'];
  if (cr && (cr.lyrics || cr.compose)) {
    // 0인 쪽은 말하지 않는다('작곡 0곡 참여'는 정보가 아니라 어색함)
    const partsKo = [cr.lyrics ? `작사 ${cr.lyrics}곡` : '', cr.compose ? `작곡 ${cr.compose}곡` : ''].filter(Boolean);
    const partsEn = [cr.lyrics ? `${cr.lyrics} as lyricist` : '', cr.compose ? `${cr.compose} as composer` : ''].filter(Boolean);
    out.facts.push(en ? `songwriting credits: ${partsEn.join(', ')}` : `${partsKo.join('·')} 참여`);
    out.html += `
    <h2>${en ? 'Songwriting credits' : '작사·작곡'}</h2>
    <p class="intro">${en ? `Credited on songs ${partsEn.join(' and ')} (Melon credits).` : `${partsKo.join(', ')}에 이름을 올렸다(멜론 크레딧 기준).`}</p>`;
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
  let debutAge = null;
  const ds = (groupInfos || []).filter(Boolean).map(g => String(g.debut || '').match(/(\d{4})\D?(\d{1,2})?\D?(\d{1,2})?/)).filter(Boolean)
    .map(d => Date.UTC(+d[1], (+d[2] || 7) - 1, +d[3] || 1));
  if (ds.length) { const v = (Math.min(...ds) - b) / (365.2425 * 864e5); if (v > 10 && v < 40) debutAge = Math.floor(v); }
  return { age: age > 8 && age < 90 ? age : null, debutAge };
}

// ── 곡 페이지 데이터(2026-10-16, 검색 노출 2단계) ─────────────────────────────────────────────
// "LOVE DIVE 직캠", "Supernova 무대" 같은 곡 단위 검색을 노린다. 영상↔곡 연결은 앱·루틴과 **같은 규칙**(shared.js _songLinkBases)을
// 여기서 직접 돌린다 — DB의 song_keys(루틴 10단계)가 아직 비어 있어도, 루틴이 실패해도 페이지는 만들어진다.
const vm = require('vm');
let _SL = null;
function songLib(ROOT) {
  if (_SL) return _SL;
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') + ';this.f=_songLinkBases;this.L=_songListFromDisco;this.B=_songBase;this.N=_songNorm;', ctx);
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
          const page = await sbGet(SB_URL, SB_KEY, `yt_channel_videos?select=id,title,view_count,members,category,published_at&group_ko=eq.${encodeURIComponent(g)}&content_flag=is.null&is_short=eq.false&order=id&limit=1000${last ? `&id=gt.${encodeURIComponent(last)}` : ''}`);
          if (!Array.isArray(page) || !page.length) break;
          rows.push(...page); last = page[page.length - 1].id;
          if (page.length < 1000) break;
        }
      } catch (e) { /* 이 그룹만 빠짐 */ }
      out[g] = rows;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return out;
}
// 곡 목록 + 영상 묶기. 반환: { [gko]: [{b, title, album, date, isTitle, cr, vids:[…], wins}] } — 영상 minVids개 이상인 곡만
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
    const songs = S.L(albums, persons);
    if (!songs.length) continue;
    // 곡 → 처음 실린 앨범(가장 이른 발매)·타이틀곡 여부·크레딧
    const meta = {};
    albums.slice().sort((x, y) => String(x.releaseDate || '').localeCompare(String(y.releaseDate || ''))).forEach(al => (al.tracks || []).forEach(tr => {
      if (!tr || !tr.title) return;
      const b = S.B(tr.title); if (!b) return;
      // 표시 이름은 가장 먼저 나온 원곡 제목(띄어 쓴 첫 괄호 앞 — 붙은 괄호는 이름의 일부: FRI(END)S) — 곡 목록 순서대로 쓰면 'LOVE DIVE -Japanese version-'이 이름이 됐다
      const m = meta[b] || (meta[b] = { name: String(tr.title).replace(/\s*-[^-]*\bver(?:sion)?\b\.?[^-]*-\s*$/i, '').split(/\s+[\(\[]/)[0].trim(), album: al.title, date: al.releaseDate || '', isTitle: false, cr: null, melonId: null });
      if (tr.isTitle) m.isTitle = true;
      if (!m.cr && tr.cr) m.cr = tr.cr;
      if (!m.melonId && tr.songId) m.melonId = tr.songId;
    }));
    const bucket = new Map(songs.map(s => [s.b, { b: s.b, title: s.title.replace(/\s*[\(\[].*$/, '') || s.title, vids: [] }]));
    const names = [g, groups[g].en || ''];
    for (const v of vids[g]) for (const b of S.f(v.title || '', songs, names)) { const s = bucket.get(b); if (s) s.vids.push(v); }
    // 1위 기록은 곡 제목이 영어로 저장된 경우가 있다('HEYA'·'God of Music') — 별칭으로도 기본형을 찾는다
    const toBase = new Map(); songs.forEach(s => { toBase.set(s.b, s.b); (s.alias || []).forEach(al => { if (!toBase.has(al.n)) toBase.set(al.n, s.b); }); });
    const winBy = {};
    (EX.wins[g] || []).forEach(w => { const b = toBase.get(S.B(w.song_title || '')) || toBase.get(S.N(w.song_title || '')); if (b) winBy[b] = (winBy[b] || 0) + 1; });
    const list = [...bucket.values()].filter(s => s.vids.length >= minVids).map(s => { const m = meta[s.b] || {}; return Object.assign(s, m, { title: m.name || s.title, wins: winBy[s.b] || 0 }); });
    list.forEach(s => s.vids.sort((a, b) => (b.view_count || 0) - (a.view_count || 0)));
    if (list.length) out[g] = list.sort((a, b) => b.vids.length - a.vids.length);
  }
  return out;
}
// 조회수는 두 자리 유효숫자로 — 페이지가 매번 바뀌면 재생성마다 수천 파일이 커밋돼 저장소가 불어난다(2026-10-16)
const roundViews = n => { if (!n) return 0; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(n)) - 1)); return Math.round(n / p) * p; };

const EXTRA_CSS =`.vid-list{padding-left:20px;margin:0;}.vid-list li{font-size:13.5px;margin-bottom:7px;}.vid-list a{color:rgba(210,225,255,0.95);text-decoration:none;}.note{font-size:11px;color:rgba(150,170,210,0.55);margin:6px 0 0;}.rel a{color:rgba(210,225,255,0.95);text-decoration:none;}`;

module.exports = { loadStatic, prefetch, groupExtra, memberExtra, ages, EXTRA_CSS, fmtViews, prefetchGroupVideos, buildSongs, roundViews, esc };
