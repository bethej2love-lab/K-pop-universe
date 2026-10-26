// 멤버 누락 전수 점검 — 영어 위키백과 그룹 문서 정보상자(current_members / past_members)와
// artists.json 로스터를 대조해 ① 위키엔 있는데 우리에 없는 멤버 ② 현역/탈퇴 상태가 엇갈리는 멤버를 뽑는다.
// (2026-10-26 신설: 엔싸인 탈퇴 멤버 3명이 통째로 빠져 있던 일 계기)
//
// 실행: NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/wiki_member_audit.mjs [--group 엔싸인] [--json out.json]
// 결과는 사람이 검토한다 — 위키 표기(본명/활동명/로마자 차이)로 생기는 거짓 누락이 섞여 있음.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const UA = 'kpopuniverse-memberaudit/1.0 (fan site roster check; contact before0hwa@gmail.com)';
const API = 'https://en.wikipedia.org/w/api.php';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(params) {
  const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params });
  for (let t = 0; t < 5; t++) {
    await sleep(400);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      const j = await r.json();
      if (j.error && /maxlag|ratelimit/i.test(j.error.code || '')) { await sleep(5000); continue; }
      return j;
    } catch (e) { await sleep(3000); }
  }
  return null;
}

// 여러 문서 wikitext 한 번에 (최대 50) — 리다이렉트 따라감. 반환: 요청 제목 → {title, text}
async function fetchPages(titles) {
  const out = new Map();
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const j = await getJSON({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', redirects: '1', titles: chunk.join('|') });
    if (!j?.query) continue;
    const alias = new Map();
    for (const n of j.query.normalized || []) alias.set(n.from, n.to);
    for (const r of j.query.redirects || []) alias.set(r.from, r.to);
    const byTitle = new Map((j.query.pages || []).filter(p => !p.missing).map(p => [p.title, p.revisions?.[0]?.slots?.main?.content || '']));
    for (const t of chunk) {
      let k = t; for (let h = 0; h < 3 && alias.has(k); h++) k = alias.get(k);
      if (byTitle.has(k)) out.set(t, { title: k, text: byTitle.get(k) });
    }
  }
  return out;
}

// 정보상자 필드 값(중첩 {{ }} 고려) 추출
function infoboxField(text, field) {
  const re = new RegExp('\\|\\s*' + field + '\\s*=', 'i');
  const m = re.exec(text);
  if (!m) return '';
  let i = m.index + m[0].length, depth = 0, s = '';
  for (; i < text.length; i++) {
    const c2 = text.slice(i, i + 2);
    if (c2 === '{{' || c2 === '[[') { depth++; s += c2; i++; continue; }
    if (c2 === '}}' || c2 === ']]') { if (depth === 0) break; depth--; s += c2; i++; continue; }
    if (text[i] === '|' && depth === 0) break;
    s += text[i];
  }
  return s;
}

function splitNames(v) {
  let s = v.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/gi, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{\s*(?:efn|refn|sfn|cn|citation needed)[^{}]*\}\}/gi, '');
  // {{hlist|a|b}} {{flatlist|...}} {{plainlist|...}} {{ubl|a|b}} → 줄바꿈 구분
  s = s.replace(/\{\{\s*(?:hlist|ubl|unbulleted list|plainlist|flatlist|plain list|flat list)\s*\|?/gi, '\n').replace(/\}\}/g, '\n');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1'); // 링크 → 표시 텍스트
  s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
  return s.split(/[\n|•·,]|\*/).map(x => x.replace(/\(.*?\)/g, '').replace(/[{}'"]/g, '').trim())
    .filter(x => x && x.length < 40 && !/=|infobox|^(?:ist|list)$/i.test(x) &&!/^(?:class|style|item_style|list_style|title)\s*=/i.test(x) && !/^see\b|^list of|^members$/i.test(x));
}

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9가-힣]/g, '');
// 로마자 표기 흔들림(성윤 Sungyun/Seongyun, 지훈 Jihun/Jihoon, 경 Kyung/Gyeong) 흡수용 느슨한 키
const loose = s => norm(s).replace(/[가-힣]/g, '')
  .replace(/eo|ou|oo|eu/g, 'u').replace(/ee|ea/g, 'i').replace(/ae|ai/g, 'e').replace(/wo/g, 'o')
  .replace(/sh/g, 's').replace(/ch|tch|tz/g, 'j').replace(/[kgq]/g, 'g').replace(/[td]/g, 'd').replace(/[pb]/g, 'b').replace(/[rl]/g, 'l').replace(/y/g, '')
  .replace(/(.)\1+/g, '$1');
const KPOP_RE =/South Korea|Korean|K-pop|Seoul/i;

const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const AL = Array.isArray(artists) ? artists : Object.values(artists);
const only = arg('--group');
const gkeys = Object.keys(groups).filter(k => !only || k === only);

// 그룹별 로스터: 주 소속 + groups[] 겸임
const roster = new Map(gkeys.map(k => [k, []]));
for (const a of AL) {
  const gs = new Set([a.group?.ko, ...(a.groups || []).map(g => g.ko)].filter(Boolean));
  for (const g of gs) if (roster.has(g)) roster.get(g).push(a);
}
const keysOf = a => {
  const ks = new Set();
  const en = a.name?.en || '';
  for (const v of [en, a.name?.ko, a.displayName, a.subName, ...(a.matchAliases || [])].filter(x => typeof x === 'string')) ks.add(norm(v));
  // "Kim Jisoo" ↔ "Jisoo": 영문 이름의 마지막/첫 토큰도
  for (const t of en.split(/[\s-]+/)) if (t.length >= 2) ks.add(norm(t));
  for (const v of [...ks]) if (v && !/[가-힣]/.test(v)) ks.add('~' + loose(v));
  return ks;
};

// 후보 문서명
const cands = k => {
  const en = groups[k].en;
  const tc = en.toLowerCase().replace(/(^|[\s(])([a-z])/g, (m, p, c) => p + c.toUpperCase()); // KISS OF LIFE → Kiss Of Life
  const tc2 = tc.replace(/ (Of|The|And|X|A) /g, m => m.toLowerCase());
  return [...new Set([en, tc, tc2])].flatMap(e => [e, `${e} (group)`, `${e} (South Korean group)`, `${e} (band)`, `${e} (boy band)`, `${e} (girl group)`, `${e} (South Korean band)`]);
};
const allTitles = [...new Set(gkeys.flatMap(cands))];
console.error(`그룹 ${gkeys.length}개, 후보 문서 ${allTitles.length}개 조회…`);
const pages = await fetchPages(allTitles);

const report = [];
for (const k of gkeys) {
  let page = null;
  for (const t of cands(k)) {
    const p = pages.get(t);
    if (p && /infobox\s+musical artist/i.test(p.text) && KPOP_RE.test(p.text.slice(0, 6000))) { page = p; break; }
  }
  if (!page) { // 검색 폴백 — 문서명이 그룹명과 다른 경우(표기·특수문자)
    const j = await getJSON({ action: 'query',list: 'search', srsearch: `${groups[k].en} South Korean group`, srlimit: '3' });
    for (const h of j?.query?.search || []) {
      const p = (await fetchPages([h.title])).get(h.title);
      if (p && /infobox\s+musical artist/i.test(p.text) && KPOP_RE.test(p.text.slice(0, 6000)) && norm(p.title).startsWith(norm(groups[k].en).slice(0, 3))) { page = p; break; }
    }
  }
  if (!page) { report.push({ group: k, en: groups[k].en, noPage: true }); continue; }
  const cur = splitNames(infoboxField(page.text, 'current_members'));
  const past = splitNames(infoboxField(page.text, 'past_members'));
  const ours = roster.get(k);
  const ourKeys = ours.map(a => ({ a, ks: keysOf(a) }));
  const find = n => {
    const nn = norm(n), toks = n.split(/[\s-]+/).map(norm).filter(t => t.length >= 2);
    const ln = '~' + loose(n), ltoks = n.split(/[\s-]+/).map(t => '~' + loose(t)).filter(t => t.length >= 4);
    return ourKeys.find(o => o.ks.has(nn) || o.ks.has(ln) || ltoks.some(t => o.ks.has(t)) || toks.some(t => o.ks.has(t) && t.length >= 3) || (toks.length >= 2 && o.ks.has(toks.slice(1).join(''))));
  };
  const missing = [], statusMismatch = [];
  for (const [list, wantActive] of [[cur, true], [past, false]]) {
    for (const n of list) {
      const hit = find(n);
      if (!hit) { missing.push({ name: n, wiki: wantActive ? 'current' : 'past' }); continue; }
      // 해체 그룹은 위키가 전원 past로 두므로 상태 비교 생략
      if (!groups[k].disbanded && hit.a.group?.ko === k && hit.a.active !== wantActive && !(wantActive === false && hit.a.left)) {
        statusMismatch.push({ name: n, ours: hit.a.name.ko, ourActive: hit.a.active, wiki: wantActive ? 'current' : 'past' });
      }
    }
  }
  report.push({ group: k, en: groups[k].en, page: page.title, wikiCur: cur.length, wikiPast: past.length, ours: ours.length, missing, statusMismatch });
}

const out = arg('--json');
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
const noPage = report.filter(r => r.noPage);
const withMiss = report.filter(r => r.missing?.length);
const withStat = report.filter(r => r.statusMismatch?.length);
console.log(`문서 찾음 ${report.length - noPage.length} / 못 찾음 ${noPage.length} · 누락 의심 그룹 ${withMiss.length} · 상태 엇갈림 그룹 ${withStat.length}`);
for (const r of withMiss) console.log(`[누락] ${r.group} (${r.page}) — ` + r.missing.map(m => `${m.name}${m.wiki === 'past' ? '(전)' : ''}`).join(', '));
for (const r of withStat) console.log(`[상태] ${r.group} — ` + r.statusMismatch.map(m => `${m.ours}: 우리 ${m.ourActive ? '현역' : '탈퇴'} / 위키 ${m.wiki === 'current' ? '현역' : '탈퇴'}`).join(', '));
if (noPage.length) console.log('[문서 못 찾음] ' + noPage.map(r => `${r.group}(${r.en})`).join(', '));
