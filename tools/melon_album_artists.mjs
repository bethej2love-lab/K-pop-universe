// 공동 앨범(합작) 아티스트 표기 수집·반영 (2026-10-19)
//
// 왜: 온유·지코 'Tic Tac Toe'처럼 두 사람이 같은 비중으로 낸 앨범이 두 사람 디스코에 각자 복제돼 있을 뿐, "함께 낸 앨범"이라는
// 관계가 없어 각자 카드에선 본인 싱글처럼 보였다(사용자 지적). 피처링(feat — OST·참여작 숨김용 표시)과는 다른 개념이다.
// 멜론 앨범의 아티스트 표기(순서 포함)를 그대로 가져와 앨범에 `byline`으로 박는다. 화면은 '온유, 지코'처럼 쉼표로 잇는다
// (사용자: "x는 유닛에 많이 쓰니 단발성 공동 작업은 쉼표, 순서는 음원 사이트 표기대로").
//
// 1단계(수집, 기본): melon_artist_map.json의 아티스트 번호마다 멜론 앨범 목록(albumPaging)을 훑어 **아티스트가 2명 이상인 앨범**만
//   melon_album_artists.json { albumId: {t:제목, a:[[aid,멜론표기],…]} }에 모은다. 중간 저장·재개(_done 목록).
// 2단계(--apply): 우리 디스코(groups.json·artists.json)에서 melonAlbumId가 그 목록에 있는 앨범에 byline:[{n,en,aid,ako?,ag?,gko?}]를 박는다.
//   제외: 피처링·OST·옴니버스/컴필레이션·프로그램/경연 음원(여러 명이 참여한 모음이지 공동 앨범이 아님), 유닛 앨범(유닛명이 따로 있음).
//   원본 들여쓰기는 파일에서 읽어 보존한다([[JSON 저장 시 원본 들여쓰기 보존]]).
//
// ⚠️ 칸 이름이 artists가 아닌 이유: SM 프로젝트 앨범 등 7곳에 이미 `artists`(참여자 문자열 목록)가 있었다 — 처음에 그 이름으로 반영했다가
//    기존 값을 지웠다(2026-10-19, diff로 발견해 되돌림). 기존 칸과 겹치는 이름을 쓰지 말 것.
//
// 실행: node tools/melon_album_artists.mjs            (수집, 회사망 OK — curl -k)
//       node tools/melon_album_artists.mjs --apply    (반영 → 이후 build_slim_data.mjs가 disco/로 내보냄)
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'melon_album_artists.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dec = s => String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const indentOf = p => { const m = fs.readFileSync(p, 'utf8').match(/^[\[{]\r?\n([ \t]+)/); return m ? m[1] : 2; };

let blocked = 0;
async function get(url) {
  for (let t = 0; t < 3; t++) {
    try {
      const b = execFileSync('curl', ['-sk', '-L', '-m', '45', '-A', UA, '-w', '\n@@HTTP:%{http_code}', url], { maxBuffer: 1 << 28, encoding: 'binary' });
      const s = Buffer.from(b, 'binary').toString('utf8');
      const i = s.lastIndexOf('\n@@HTTP:');
      const code = i === -1 ? 0 : Number(s.slice(i + 8).trim());
      const body = i === -1 ? s : s.slice(0, i);
      if (code === 200 && body.length > 300) { blocked = 0; return body; }
      if (code === 406 || code === 429) { if (++blocked >= 3) { console.error(`\n❌ 멜론 차단(${code}) — 나중에 다시 실행하면 이어서 한다`); process.exit(3); } await sleep(30000); }
    } catch (e) { }
    await sleep(1500);
  }
  return '';
}
// 앨범 목록 한 페이지 → [{id, t, a:[[aid,name]…]}]
function parseList(html) {
  const out = [], seen = new Set();
  for (const blk of html.split('<div class="atist_info">').slice(1)) {
    const id = (blk.match(/goAlbumDetail\('(\d+)'\)/) || [])[1];
    if (!id || seen.has(id)) continue; seen.add(id);
    const t = dec((blk.match(/class="ellipsis" title="(.+?) - 페이지 이동"/) || [])[1] || '');
    const dd = (blk.match(/<dd class="atistname">([\s\S]*?)(?:<span class="checkEllipsis"|<\/div>)/) || [])[1] || '';
    const a = []; for (const m of dd.matchAll(/goArtistDetail\('(\d+)'\);?" title="(.+?) - 페이지 이동"/g)) if (!a.some(x => x[0] === m[1])) a.push([m[1], dec(m[2])]);
    out.push({ id, t, a });
  }
  return out;
}

if (!process.argv.includes('--apply')) {
  const map = readJson(path.join(ROOT, 'melon_artist_map.json'));
  const aids = [...new Set(Object.values(map).map(v => v && v.aid).filter(Boolean))];
  const store = fs.existsSync(CACHE) ? readJson(CACHE) : {};
  const done = new Set(store._done || []);
  let n = 0, found = 0;
  const save = () => { store._done = [...done]; fs.writeFileSync(CACHE, JSON.stringify(store)); };
  for (const aid of aids) {
    if (done.has(aid)) continue;
    for (let idx = 1, g = 0; g < 20; g++, idx += 50) {
      const html = await get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${idx}&pageSize=50&listType=0&orderBy=ISSUE_DATE&artistId=${aid}`);
      if (!html) break;
      const rows = parseList(html);
      for (const r of rows) if (r.a.length >= 2 && !store[r.id]) { store[r.id] = { t: r.t, a: r.a }; found++; }
      if (rows.length < 50) break;
      await sleep(400);
    }
    done.add(aid);
    if (++n % 20 === 0) { save(); console.log(`진행 ${done.size}/${aids.length} · 다인 앨범 ${Object.keys(store).length - 1}개(이번 +${found})`); }
    await sleep(400);
  }
  save();
  console.log(`수집 완료 — 아티스트 ${done.size}/${aids.length} · 다인 앨범 ${Object.keys(store).length - 1}개`);
} else {
  // ── 반영 ──
  const store = readJson(CACHE);
  const gPath = path.join(ROOT, 'groups.json'), aPath = path.join(ROOT, 'artists.json');
  const groups = readJson(gPath), artistsRaw = readJson(aPath);
  const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);
  const map = readJson(path.join(ROOT, 'melon_artist_map.json'));
  // 멜론 번호 → 우리 쪽(그룹 키 / 멤버 이름·소속)
  const byAid = new Map();
  for (const [k, v] of Object.entries(map)) {
    if (!v || !v.aid || byAid.has(v.aid)) continue;
    if (k.startsWith('a:')) { const [ko, g] = k.slice(2).split('|'); const a = artists.find(x => x.name && x.name.ko === ko && (x.group?.ko === g || (x.groups || []).some(y => y && y.ko === g))); byAid.set(v.aid, a ? { ko: a.name.ko, en: a.name.en || '', ako: a.name.ko, ag: g } : null); }
    else if (groups[k]) byAid.set(v.aid, { ko: k, en: groups[k].en || '', gko: k });
  }
  // 멜론 표기 'ㅇㅇ (EN)' / 'EN (ㅇㅇ)' → 한/영
  const split = s => { const m = String(s).match(/^(.*?)\s*\((.+)\)\s*$/); if (!m) return { ko: s, en: '' }; const h = /[가-힣]/; return h.test(m[1]) || !h.test(m[2]) ? { ko: m[1], en: m[2] } : { ko: m[2], en: m[1] }; };
  const SKIP_TYPE = /OST|옴니버스|컴필레이션|compilation|various/i;
  // 제목으로 거르는 것(2026-10-19 표본 검수) — 멜론은 피처링 가수·리믹서·방송 출연자까지 앨범 아티스트로 올린다.
  //   피처링('3D (feat. Jack Harlow)')은 합작이 아니고(사용자: feat와 공동 앨범은 다르다), 리믹스는 리믹서가 붙은 것뿐이며,
  //   방송 음원(복면가왕·개가수·OST가 '싱글'로 들어온 것)은 출연 기록이지 공동 앨범이 아니다.
  const SKIP_TITLE = /feat\.?|\bft\.|remix|\bOST\b|O\.S\.T|복면가왕|불후의|가요제|경연|프로듀서 -|로드 투 킹덤|\d+회\b/i;
  let set = 0, cleared = 0;
  const visit = (al, unit) => {
    if (!al || !al.melonAlbumId) return;
    const hit = store[al.melonAlbumId];
    const ok = hit && !unit && !al.feat && !al.unit && !al.program && !al.contest && !SKIP_TYPE.test(al.type || '') && !SKIP_TITLE.test(al.title || '') && !SKIP_TITLE.test(hit.t || '') && hit.a.length >= 2 && hit.a.length <= 6;
    if (!ok) { if (al.byline) { delete al.byline; cleared++; } return; }
    al.byline = hit.a.map(([aid, name]) => {
      const our = byAid.get(aid); const sp = split(name);
      const o = { n: our ? our.ko : sp.ko, aid };
      const en = our ? our.en : sp.en; if (en) o.en = en;
      if (our && our.gko) o.gko = our.gko;
      if (our && our.ako) { o.ako = our.ako; o.ag = our.ag; }
      return o;
    });
    set++;
  };
  for (const g of Object.values(groups)) (g.discography || []).forEach(al => visit(al, false));
  for (const a of artists) {
    (a.discography || []).forEach(al => visit(al, false));
    (a.soloDiscography || []).forEach(al => visit(al, false));
    (a.unitDiscography || []).forEach(u => ((u && u.albums) || []).forEach(al => visit(al, true)));
  }
  fs.writeFileSync(gPath, JSON.stringify(groups, null, indentOf(gPath)) + '\n');
  fs.writeFileSync(aPath, JSON.stringify(artistsRaw, null, indentOf(aPath)) + '\n');
  console.log(`반영 — 공동 앨범 표기 ${set}곳 · 해제 ${cleared}곳`);
}
