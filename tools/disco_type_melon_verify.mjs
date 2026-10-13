#!/usr/bin/env node
// 스포티파이 수집분 앨범 타입을 멜론 표기로 재검증 (2026-10-13)
//
// 왜: 2026-10-09 전 parseTypeFromTitle은 album_type==='album'이면 트랙 수와 무관하게 '정규'를 줬다.
//     코드는 15a691516에서 고쳤지만, 같이 만든 tools/disco_type_fix.mjs가 **파생물(disco/)만** 고쳐서
//     다음 build_slim_data 때 원본(groups.json·artists.json) 값으로 도로 덮였다 — 오분류가 그대로 남음
//     (사용자 제보: 클로즈유어아이즈 `256th Note`가 '정규'인데 실제론 미니 4집).
//     사용자 원칙: "헷갈리면 스포티파이 말고 멜론이 정확하다". 트랙 수 추정 대신 멜론 표기로 판정한다.
//
// 판정: 멜론 아티스트 앨범 목록에서 발매일(±3일)+제목으로 같은 앨범을 찾아
//   [EP]→미니, [정규]→정규, [싱글]→싱글, [OST]→OST(isMain:false), [라이브]→라이브, [리믹스]→리믹스,
//   [옴니버스]/[베스트]→컴필레이션. 상세 페이지 소개글의 "Nth Mini Album"/"Nth Album"이 한 가지로만
//   나오면 집 번호까지 붙이고, 'Title' 배지 곡이 있으면 titleTrack이 비어 있을 때 채운다.
// ⚠️ 멜론 [정규]는 리패키지·스페셜·공연 실황에도 붙는다(project_kpop_melon_disco_audit) — 제목에 그런
//    낱말이 있으면 바꾸지 않고 "사람이 볼 것"으로만 출력한다.
// ⚠️ 멜론 차단 응답은 HTTP 200 + 짧은 정상 HTML이다 — 앨범 목록에 album11_li가 없으면 실패로 본다.
//
// 실행: NODE_TLS_REJECT_UNAUTHORIZED=0(회사망만) node tools/disco_type_melon_verify.mjs [--apply] [--types=정규]
//   기본은 dry-run. --types로 검사할 현재 타입 접두(쉼표 구분)를 고른다(기본 '정규').

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const TYPES = ((process.argv.find(a => a.startsWith('--types=')) || '--types=정규').slice(8)).split(',');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 원본 들여쓰기를 읽어 그대로 보존한다(feedback_json_indent_preserve).
const readJson = f => { const raw = fs.readFileSync(path.join(ROOT, f), 'utf8'); const m = /\n( +)\S/.exec(raw); /* 둘째 줄 = 한 단계(배열 파일은 첫 키가 두 단계 안쪽) */ return { data: JSON.parse(raw), indent: m ? m[1].length : 2 }; };
const G = readJson('groups.json'), A = readJson('artists.json');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'melon_artist_map.json'), 'utf8'));

const unesc = s => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const norm = s => String(s || '').toLowerCase().replace(/[^0-9a-z가-힣ぁ-んァ-ン一-龥]/g, '');
const dayNum = d => { const p = String(d || '').split('.').map(Number); return p.length === 3 ? Date.UTC(p[0], p[1] - 1, p[2]) / 864e5 : NaN; };

async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR' } });
      const t = await r.text();
      if (r.ok) return t;
    } catch (e) { /* 재시도 */ }
    await sleep(1500 * (i + 1));
  }
  return null;
}

const albumCache = new Map();
async function melonAlbums(aid, oldest) {
  if (albumCache.has(aid)) return albumCache.get(aid);
  const out = [];
  for (let start = 1; start < 1000; start += 50) {
    const html = await get(`https://www.melon.com/artist/albumPaging.htm?startIndex=${start}&pageSize=50&listType=0&orderBy=ISSUE_DATE&artistId=${aid}`);
    await sleep(400);
    if (!html || !html.includes('album11_li')) { if (start === 1) { albumCache.set(aid, null); return null; } break; }
    const items = html.split('class="album11_li"').slice(1);
    for (const it of items) {
      const id = (/goAlbumDetail\('(\d+)'\)/.exec(it) || [])[1];
      const type = (/class="vdo_name">\[([^\]]+)\]/.exec(it) || [])[1] || '';
      const title = (/class="ellipsis" title="([^"]*?) - 페이지 이동"/.exec(it) || [])[1] || '';
      const date = (/class="cnt_view">([\d.]+)/.exec(it) || [])[1] || '';
      const cnt = Number((/class="tot_song">(\d+)곡/.exec(it) || [])[1]) || 0;
      if (id) out.push({ id, type, title: unesc(title), date, cnt });
    }
    const last = out[out.length - 1];
    if (items.length < 50 || (last && dayNum(last.date) < oldest - 10)) break;
  }
  albumCache.set(aid, out);
  return out;
}

// ⚠️ 집 번호는 **바로 뒤 40자 안에 이 앨범 제목이 나올 때만** 인정한다(2026-10-13). 소개글은 이전 앨범도
//    언급한다 — 트와이스 스페셜 앨범 `TEN`의 소개글 속 "정규 4집 'THIS IS FOR'"를 TEN의 번호로 읽어 '정규 4집'을 붙였다.
//    또 소개글이 "스페셜 앨범"이라고 하면 번호를 붙이지 않는다.
async function melonDetail(id, albumTitle) {
  const html = await get(`https://www.melon.com/album/detail.htm?albumId=${id}`);
  await sleep(400);
  if (!html) return {};
  const flat = unesc(unesc(html.replace(/[\r\n\t]+/g, ' ')));
  const nt = norm(albumTitle);
  const near = idx => nt.length >= 2 && norm(flat.slice(idx, idx + 60)).includes(nt);
  const ords = {};
  if (!/스페셜 앨범|special album/i.test(flat.slice(0, 20000)) || !nt) {
    for (const m of flat.matchAll(/(\d+)(?:st|nd|rd|th) (Mini )?Album/gi)) { if (!near(m.index)) continue; const k = (m[2] ? '미니 ' : '정규 ') + Number(m[1]) + '집'; ords[k] = (ords[k] || 0) + 1; }
    for (const m of flat.matchAll(/(미니|정규) ?(\d+)집/g)) { if (!near(m.index)) continue; const k = `${m[1]} ${Number(m[2])}집`; ords[k] = (ords[k] || 0) + 1; }
  }
  const ordKeys = Object.keys(ords);
  const titleM = /bullet_icons title[^>]*>.*?<\/span>.*?<a[^>]*>([^<]+)<\/a>/.exec(flat);
  return { ordinals: ordKeys, titleTrack: titleM ? unesc(titleM[1].trim()) : null };
}

const MAPTYPE = { 'EP': '미니', '정규': '정규', '싱글': '싱글', 'OST': 'OST', '라이브': '라이브', '리믹스': '리믹스', '옴니버스': '컴필레이션', '베스트': '컴필레이션', '스페셜': '스페셜' };
// 멜론 [정규]인데 실제론 공연 실황인 것 → '라이브'. ⚠️ 단어 경계 필수 — 'STAY ALIVE'(스테이씨 정규)가 걸렸다.
const LIVE_RE = /\blive\b|\btour\b|\bconcert\b|실황/i;
// 멜론 [정규]인데 판정을 사람에게 넘길 것(리패키지·디럭스 등 — 원 정규와 번호를 공유하므로 자동으로 못 정한다)
const RISKY = /repackage|deluxe|expanded|special|edition|리패키지|스페셜|soundtrack|\bost\b|mixtape|replay/i;

// 대상: src==='spotify'이고 현재 타입이 TYPES 접두로 시작하는 항목
const targets = [];
for (const [ko, g] of Object.entries(G.data)) for (const d of g.discography || []) if (d.src === 'spotify' && TYPES.some(t => (d.type || '').startsWith(t))) targets.push({ who: ko, aidKey: ko, d, disco: g.discography });
for (const a of (Array.isArray(A.data) ? A.data : [])) for (const d of a.discography || []) if (d.src === 'spotify' && TYPES.some(t => (d.type || '').startsWith(t))) targets.push({ who: a.name.ko, aidKey: `a:${a.name.ko}|${a.group && a.group.ko}`, d, disco: a.discography });

console.log(`대상 ${targets.length}장 (현재 타입: ${TYPES.join(',')}) ${APPLY ? '— 적용' : '— dry-run'}`);
const changed = [], review = [], miss = [];
let blocked = 0;
for (const t of targets) {
  const m = MAP[t.aidKey];
  if (!m || !m.aid || m.blocked) { miss.push(`${t.who} | ${t.d.title} — 멜론 매핑 없음`); continue; }
  const day = dayNum(t.d.releaseDate);
  const list = await melonAlbums(m.aid, day);
  if (!list) { blocked++; miss.push(`${t.who} | ${t.d.title} — 멜론 목록 실패(차단?)`); if (blocked >= 5) { console.log('⚠️ 연속 실패 — 중단'); break; } continue; }
  blocked = 0;
  const nt = norm(t.d.title);
  const cands = list.filter(x => Math.abs(dayNum(x.date) - day) <= 3).map(x => {
    const nx = norm(x.title);
    const sc = nx === nt ? 3 : (nx && nt && (nx.includes(nt) || nt.includes(nx))) ? 2 : 0;
    // 제목이 언어별로 다른 경우(TXT '별의 장' ↔ 'The Star Chapter') — 같은 날 + 같은 곡 수면 같은 앨범으로 본다
    const cntHit = x.date === t.d.releaseDate && x.cnt && x.cnt === t.d.trackCount ? 2 : 0;
    return { ...x, sc: Math.max(sc, cntHit) + (x.date === t.d.releaseDate ? 0.5 : 0) };
  }).sort((a, b) => b.sc - a.sc);
  const best = cands[0];
  const ok = best && (best.sc >= 2 || (cands.length === 1 && best.date === t.d.releaseDate));
  if (!ok) { miss.push(`${t.who} | ${t.d.title} (${t.d.releaseDate}) — 멜론에서 못 찾음${cands.length ? ' 후보: ' + cands.map(c => `[${c.type}]${c.title}`).join(' / ') : ''}`); continue; }
  const base = MAPTYPE[best.type];
  if (!base) { review.push(`${t.who} | ${t.d.title} — 멜론 [${best.type}] 미지원 표기`); continue; }
  if (base === '정규' && LIVE_RE.test(t.d.title + ' ' + best.title)) {
    changed.push(`${t.who} | ${t.d.title} : '${t.d.type}' → '라이브' (멜론 [정규]지만 공연 실황)`);
    if (APPLY) { t.d.type = '라이브'; if (!t.d.melonAlbumId) t.d.melonAlbumId = best.id; }
    continue;
  }
  if (base === '정규' && RISKY.test(t.d.title + ' ' + best.title)) { review.push(`${t.who} | ${t.d.title} — 멜론 [정규]지만 제목이 리패키지/실황류 → 현재 '${t.d.type}' 유지`); continue; }
  let next = base;
  let tt = null;
  if (base === '미니' || base === '정규') {
    const det = await melonDetail(best.id, best.title);
    const fam = det.ordinals ? det.ordinals.filter(k => k.startsWith(base)) : [];
    if (fam.length === 1) next = fam[0];
    // 이미 같은 계열 번호가 붙어 있으면(슈퍼주니어 '정규 12집') 근거 부족으로 번호를 깎지 않는다
    if (next === base && new RegExp(`^${base} \\d+집$`).test(t.d.type || '')) next = t.d.type;
    // 같은 아티스트에 이미 그 번호가 있으면 자동으로 붙이지 않는다(번호 충돌은 사람이 판정)
    const clash = next !== base && next !== t.d.type ? t.disco.find(o => o !== t.d && o.type === next && !o.variant) : null;
    // 번호가 겹치는 항목이 **같은 날 발매**면 같은 앨범의 한/영 제목 중복이다(이펙스 `소화 3장 : 낭만 청춘` ↔
    // `Youth Chapter 3 : ROMANTIC YOUTH` — 트랙도 한/영이라 disco_spotify_legacy_dedupe가 못 잡는다). 스포티파이 쪽을 지운다.
    if (clash && Math.abs(dayNum(clash.releaseDate) - day) <= 1) {
      changed.push(`${t.who} | ${t.d.title} : 삭제 — '${clash.title}'(${clash.type})와 같은 발매(멜론 [${best.type}] ${best.title})`);
      if (APPLY) { if (!clash.spotifyId && t.d.spotifyId) clash.spotifyId = t.d.spotifyId; t.disco.splice(t.disco.indexOf(t.d), 1); }
      continue;
    }
    if (clash) {
      review.push(`${t.who} | ${t.d.title} — 멜론은 '${next}'인데 이미 같은 번호 앨범이 있음 → '${base}'로만`);
      next = base;
    }
    if (!t.d.titleTrack && det.titleTrack && (t.d.tracks || []).some(x => norm(x.title) === norm(det.titleTrack))) tt = det.titleTrack;
  }
  const typeChanged = next !== t.d.type;
  if (!typeChanged && !tt) continue;
  changed.push(`${t.who} | ${t.d.title} : '${t.d.type}' → '${next}' (멜론 [${best.type}] ${best.title})${tt ? ` · 타이틀곡 ${tt}` : ''}`);
  if (APPLY) {
    t.d.type = next;
    if (base === 'OST') t.d.isMain = false;
    if (!t.d.melonAlbumId) t.d.melonAlbumId = best.id;
    if (tt) { t.d.titleTrack = tt; for (const x of t.d.tracks || []) x.isTitle = norm(x.title) === norm(tt); }
  }
}
console.log(`\n■ 변경 ${changed.length}\n` + changed.join('\n'));
console.log(`\n■ 사람이 볼 것 ${review.length}\n` + review.join('\n'));
console.log(`\n■ 판정 못 함 ${miss.length}\n` + miss.join('\n'));
if (APPLY && changed.length) {
  fs.writeFileSync(path.join(ROOT, 'groups.json'), JSON.stringify(G.data, null, G.indent) + '\n');
  fs.writeFileSync(path.join(ROOT, 'artists.json'), JSON.stringify(A.data, null, A.indent) + '\n');
  console.log('\n저장 완료 — build_slim_data.mjs로 파생물 재생성할 것');
}
