// 공연장 정보(venues_info.json) — kpop_events에 나온 모든 공연장의 좌석 수·주소·좌표(2026-10-21 사용자 요청).
//
// 국내: KOPIS 공연시설 API(공식 — 시설 검색 prfplc → 상세 prfplc/{id}의 홀별 seatscale·adres·la/lo).
//       공연 데이터의 공연장 이름은 "올림픽공원 체조경기장"·"KSPO Dome"·"Olympic Gymnastics Arena"처럼 제각각이라
//       시설을 이름 조각으로 찾고, 그 시설의 홀 중 이름이 가장 많이 겹치는 홀의 좌석 수를 쓴다.
// 해외: Wikidata(wbsearchentities → 공연장 성격 항목만) — 최대 수용 인원(P1083)·좌표(P625).
// 못 찾은 곳은 이름·도시·나라만 남긴다(추측해서 채우지 않는다). 결과는 캐시(tools/venues_cache.json)해 다음 실행은 새 공연장만.
//
// 실행: node tools/build_venues.mjs [--refresh]   (회사망: NODE_TLS_REJECT_UNAUTHORIZED=0) · KOPIS 키: .kopis_key 또는 KOPIS_KEY
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'venues_info.json');
const CACHE = path.join(ROOT, 'tools', 'venues_cache.json');
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/kpop_events';
const SBK = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const KEY = process.env.KOPIS_KEY || (fs.existsSync(path.join(ROOT, '.kopis_key')) ? fs.readFileSync(path.join(ROOT, '.kopis_key'), 'utf8').trim() : '');
const REFRESH = process.argv.includes('--refresh');
const UA = 'kpop-universe-venues/1.0 (https://kpop-universe.kr)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cache = !REFRESH && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};

// 같은 곳의 다른 이름 — 영문 표기는 KOPIS(한글)로 못 찾아서 사람이 묶는다
const ALIAS = {
  'KSPO Dome': '올림픽공원 체조경기장', 'KSPO DOME': '올림픽공원 체조경기장', 'Olympic Gymnastics Arena': '올림픽공원 체조경기장',
  'SK Olympic Handball Gymnasium': '올림픽공원 핸드볼경기장', 'Olympic Hall': '올림픽공원 올림픽홀',
  'Jamsil Indoor Stadium': '잠실종합운동장 실내체육관', 'Jamsil Arena': '잠실종합운동장 실내체육관',
  'Gocheok Sky Dome': '고척스카이돔', 'KBS Arena': 'KBS아레나', 'Jamsil Olympic Stadium': '잠실종합운동장 주경기장',
  'Seoul Olympic Hall': '올림픽공원 올림픽홀', 'Kyocera Osaka Dome': 'Kyocera Dome Osaka', 'Makuhari Event Hall': 'Makuhari Messe', 'The Star Theatre': 'The Star Performing Arts Centre',
  'Inspire Arena': '인스파이어 아레나', 'KBS Arena ': 'KBS스포츠월드 아레나', 'Yes24 Live Hall': '예스24 라이브홀', 'Yes24 Muv Hall': '예스24 무브홀', 'Blue Square iMarket Hall': '블루스퀘어', 'Hwajeong Gymnasium': '고려대학교 화정체육관', 'Shinsegae Mesa Hall': '신세계 메사홀', 'KINTEX': '킨텍스', 'Blue Square': '블루스퀘어', 'YES24 Live Hall': '예스24 라이브홀',
};
// 한글 공연장 이름 → KOPIS 시설 검색어(KOPIS 시설명이 다를 때). 홀은 원래 이름으로 고른다
const SEARCH = { '인스파이어 아레나': '인스파이어 엔터테인먼트 리조트', 'KBS스포츠월드 아레나': 'KBS', 'KBS아레나': 'KBS' };

const norm = s => String(s || '').toUpperCase().replace(/\(.*?\)/g, m => ' ' + m.slice(1, -1) + ' ').replace(/[^가-힣A-Z0-9]+/g, ' ').trim();
const toks = s => norm(s).split(' ').filter(t => t.length >= 2 && !['THE', 'OF', 'AND'].includes(t));
const num = s => { const n = parseInt(String(s || '').replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) && n > 0 ? n : null; };

async function getText(url, opt = {}) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA, ...(opt.headers || {}) } }); if (r.ok) return await r.text(); if (r.status === 429) await sleep(3000 * (i + 1)); }
    catch (e) { await sleep(1000 * (i + 1)); }
  }
  return null;
}
const xmlAll = (x, tag) => [...String(x || '').matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map(m => m[1]);
const xml1 = (x, tag) => xmlAll(x, tag)[0] || '';

// ── 국내: KOPIS ──────────────────────────────────────────────────────────────
const facDetail = {};
async function kopisFacility(id) {
  if (facDetail[id]) return facDetail[id];
  const x = await getText(`http://www.kopis.or.kr/openApi/restful/prfplc/${id}?service=${KEY}`);
  if (!x) return null;
  const halls = xmlAll(x, 'mt13').map(h => ({ name: xml1(h, 'prfplcnm'), seats: num(xml1(h, 'seatscale')) }));
  return facDetail[id] = { id, name: xml1(x, 'fcltynm'), seats: num(xml1(x, 'seatscale')), addr: xml1(x, 'adres'), lat: +xml1(x, 'la') || null, lng: +xml1(x, 'lo') || null, url: xml1(x, 'relateurl') || null, halls };
}
// KOPIS는 몰리면 오류 대신 빈 결과를 200으로 준다 — 빈 결과면 쉬었다가 한 번 더(첫 실행에서 고척스카이돔이 한글로만 빠졌다)
async function kopisSearch(q) {
  for (let i = 0; i < 2; i++) {
    const x = await getText(`http://www.kopis.or.kr/openApi/restful/prfplc?service=${KEY}&cpage=1&rows=8&shprfnmfct=${encodeURIComponent(q)}`);
    const r = xmlAll(x, 'db').map(d => ({ id: xml1(d, 'mt10id'), name: xml1(d, 'fcltynm') })).filter(d => d.id);
    if (r.length) return r;
    await sleep(900);
  }
  return [];
}
// venue = 시설 찾을 이름(별칭), scoreName = 홀 고를 때 대조할 원래 이름 — 별칭으로 홀까지 고르면
// "인스파이어 아레나"가 같은 시설 "인스파이어 볼룸"(3,000석)으로 잡혔다(10-21)
async function findKorean(venue, scoreName) {
  const vt = [...new Set([...toks(scoreName || venue), ...(scoreName ? toks(venue) : [])])]; if (!vt.length) return null;
  const words = norm(venue).split(' ').filter(Boolean);
  const queries = [...new Set([venue.replace(/\(.*?\)/g, '').trim(), words.slice(0, 2).join(' '), words[0], words.join('')])].filter(q => q && q.length >= 2);
  const cands = new Map();
  for (const q of queries) { for (const c of await kopisSearch(q)) cands.set(c.id, c); if (cands.size >= 8) break; await sleep(120); }
  let best = null;
  for (const c of [...cands.values()].slice(0, 8)) {
    const f = await kopisFacility(c.id); if (!f) continue;
    const ft = toks(f.name);
    const facHit = ft.filter(t => vt.includes(t) || vt.some(v => v.includes(t) || t.includes(v))).length;
    if (!facHit) continue;
    const options = f.halls.length ? f.halls : [{ name: f.name, seats: f.seats }];
    for (const h of options) {
      const ht = toks(h.name);
      const both = new Set([...ft, ...ht]);
      const hit = vt.filter(t => [...both].some(b => b === t || b.includes(t) || t.includes(b))).length;
      const score = hit / vt.length + (ht.some(t => vt.includes(t)) ? 0.3 : 0);
      if (!best || score > best.score) best = { score, f, h };
    }
  }
  if (!best || best.score < 0.6) return null;
  const { f, h } = best;
  return { src: 'kopis', kopis_id: f.id, facility: f.name, hall: h.name !== f.name ? h.name : null, seats: h.seats || f.seats || null, addr: f.addr || null, lat: f.lat, lng: f.lng, url: f.url };
}

// ── 해외: Wikidata ───────────────────────────────────────────────────────────
const VENUE_RE = /arena|stadium|dome|hall|venue|theat|amphithe|concert|auditorium|coliseum|colosseum|gymnasium|centre|center|pavilion|forum|club|messe|exhibition|convention|park/i;
async function findWikidata(venue, country) {
  const q = venue.replace(/\(.*?\)/g, '').trim();
  const s = await getText(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&type=item&limit=5&format=json`);
  if (!s) return null;
  const hits = (JSON.parse(s).search || []).filter(h => VENUE_RE.test(h.description || '') || VENUE_RE.test(h.label || ''));
  if (!hits.length) return null;
  const e = await getText(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hits.map(h => h.id).join('|')}&props=claims|labels|descriptions&languages=en|ko&format=json`);
  if (!e) return null;
  const ents = JSON.parse(e).entities || {};
  for (const h of hits) {
    const en = ents[h.id]; if (!en) continue;
    const cl = en.claims || {};
    const cap = cl.P1083 && cl.P1083[0]?.mainsnak?.datavalue?.value?.amount;
    const co = cl.P625 && cl.P625[0]?.mainsnak?.datavalue?.value;
    if (!cap && !co) continue; // 공연장이면 보통 둘 중 하나는 있다 — 둘 다 없으면 다른 뜻의 항목일 확률이 크다
    // 너무 일반적인 항목 — "Zepp DiverCity"가 공연장 체인 전체 "Zepp"으로 잡혔다(10-21). 한 단어 이름이 더 긴 이름의 일부면 버린다
    { const lt = toks(en.labels?.en?.value || h.label), qt = toks(q); if (lt.length === 1 && qt.length >= 2) continue; }
    return { src: 'wikidata', wikidata: h.id, label: en.labels?.en?.value || h.label, ko: en.labels?.ko?.value || null, desc: en.descriptions?.en?.value || null,
      seats: cap ? Math.round(Math.abs(+cap)) : null, lat: co ? co.latitude : null, lng: co ? co.longitude : null };
  }
  return null;
}

// ── 공연장 목록 ──────────────────────────────────────────────────────────────
const rows = [];
for (let p = 0; p < 20; p++) {
  const r = await fetch(`${SB}?select=venue,city,country&order=id&offset=${p * 1000}&limit=1000`, { headers: { apikey: SBK } });
  const j = await r.json(); rows.push(...j); if (j.length < 1000) break;
}
const venues = new Map();
for (const e of rows) {
  const v = String(e.venue || '').trim(); if (!v || /온라인|ONLINE|VOD|미정|TBA/i.test(v)) continue;
  const o = venues.get(v) || { n: 0, city: e.city || null, country: e.country || null }; o.n++; venues.set(v, o);
}
console.log(`[venues] 공연 ${rows.length}건 · 공연장 이름 ${venues.size}개`);

const out = {};
let done = 0, kr = 0, ww = 0, miss = 0;
const list = [...venues.entries()];
// 이름 하나를 풀어 정보로 — 별칭(영문 → 같은 곳 한글 이름)이면 그 이름의 결과를 쓴다. 못 찾음은 캐시하지 않는다
// (KOPIS가 몰린 요청에 빈 응답을 준 순간이 "없음"으로 굳었다 — 첫 실행)
async function resolve(v, o) {
  if (cache[v]) return cache[v];
  let info = null;
  if (ALIAS[v]) info = await resolve(ALIAS[v], o);
  else {
    const isKr = !o.country || o.country === '대한민국' || /[가-힣]/.test(v);
    info = (isKr && KEY ? await findKorean(SEARCH[v] || v, SEARCH[v] ? v : null) : null) || (!/[가-힣]/.test(v) ? await findWikidata(v, o.country) : null);
  }
  info = info || { src: null };
  if (info.src) cache[v] = info;
  return info;
}
async function worker() {
  while (list.length) {
    const [v, o] = list.shift();
    const info = await resolve(v, o);
    out[v] = { ...info, alias_of: ALIAS[v] || null, city: o.city, country: o.country, events: o.n };
    if (info.src === 'kopis') kr++; else if (info.src === 'wikidata') ww++; else miss++;
    if (++done % 50 === 0) { console.log(`  … ${done}/${venues.size}`); fs.writeFileSync(CACHE, JSON.stringify(cache)); }
  }
}
await Promise.all(Array.from({ length: 2 }, worker));
fs.writeFileSync(CACHE, JSON.stringify(cache));
fs.writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), source: 'KOPIS 공연시설 · Wikidata', venues: out }) + '\n');
console.log(`[venues] KOPIS ${kr} · Wikidata ${ww} · 못 찾음 ${miss} → venues_info.json`);
