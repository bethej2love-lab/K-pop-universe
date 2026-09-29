// "이 사람이 쓴 곡" 데이터 빌드 (2026-09-29, Surf 디깅 알고리즘 ①)
//
// 입력: artist_credits.json(멜론 작사·작곡 크레딧 — 아이돌 본인이 크레딧된 곡) + tracks_index.json(가수별 곡 목록)
// 출력: written_songs.json  { "이름\u0000그룹": [ {t:곡명, o:부른 쪽 키, s:1(본인/본인 그룹 곡)|0(남에게 써준 곡), l:작사, c:작곡} ] }
//
// ⚠️ 크레딧엔 "누가 불렀는지"가 없다 — 곡명으로 가수별 곡 목록에 잇는다. 그래서:
//  · 본인·본인 그룹(겸임 포함) 곡에 같은 제목이 있으면 본인 곡(s:1).
//  · 남의 곡은 **전체 곡 목록에서 그 제목을 가진 가수가 딱 한 명**이고 제목이 6자 이상일 때만(s:0) —
//    "Goodbye"·"Butterfly" 같은 흔한 제목은 엉뚱한 가수에 붙는다(첫 시도에서 실측).
//  · 버전 중복(Inst.·MR·Japanese/Chinese ver.·Remix)은 원곡 하나로 합친다.
//  · EXCLUDE: 검토에서 동명 다른 곡으로 확인된 것.
// 실행: node tools/build_written_songs.mjs [--review]
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..');
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const credits = rd('artist_credits.json'), TI = rd('tracks_index.json'), ARTISTS = rd('artists.json');

// 검토에서 뺀 것 — "작곡가 키|곡명(정규화)" (동명 다른 곡)
const EXCLUDE = new Set([
  '재현\u0000엔시티 127|dancingintherain',
]);
// 흔한 제목이라 "남에게 써준 곡"으로 확신할 수 없는 것(검토 2026-09-29 — 디에잇 "Friend"→원더걸스, 이기광 "History"→엑소,
// 동해 "Victory (Intro)"→빅뱅 등 같은 제목의 다른 곡일 가능성). 본인 곡 판정엔 영향 없음.
const GENERIC_OTHER = new Set(['friend', 'history', 'victory', 'letitsnow', 'santababy', 'simple', 'findyou', 'tension', 'restart', 'lovegradation']);
const VERSION_RE = /\b(inst\.?|instrumental|mr|remix|ver\.?|version|japanese|chinese|english|acoustic|sped up|slowed)\b|-\s*(japanese|chinese|english)\s*ver/i;
// 비교 키: 괄호·feat.·버전 표기(Inst.·Japanese ver. …)를 벗긴 제목 — 한 곡의 여러 버전을 하나로
const norm = s => String(s || '').toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, ' ')
  .replace(/-[^-]*ver\.?-?/g, ' ')
  .replace(/\bfeat\..*$/, ' ')
  .replace(/\b(inst\.?|instrumental|mr)\b.*$/, ' ')
  .replace(/\b(japanese|chinese|english)\s*ver.*$/, ' ')
  .replace(/[^a-z0-9가-힣]/g, '');

const byTitle = new Map();
for (const kind of Object.keys(TI)) for (const [owner, tracks] of Object.entries(TI[kind] || {})) for (const x of tracks) {
  const k = norm(x[0]); if (k.length < 2) continue;
  if (!byTitle.has(k)) byTitle.set(k, new Map());
  // 대표 제목은 버전 표기 없는 가장 짧은 것("HOOK" > "HOOK Inst.")
  const m = byTitle.get(k), cur = m.get(owner);
  const better = !cur || (VERSION_RE.test(cur.t) && !VERSION_RE.test(x[0])) || (VERSION_RE.test(cur.t) === VERSION_RE.test(x[0]) && x[0].length < cur.t.length);
  if (better) m.set(owner, { t: x[0], title: !!x[1] || !!(cur && cur.title) }); else if (x[1]) cur.title = true;
}
// 같은 제목에 같은 그룹 작곡가가 2명 이상이면 그 그룹 자기 곡일 가능성이 크다(우리 곡 목록에 빠져 있어 동명의 남의 곡에
// 붙은 것 — 이민혁·프니엘 "Friend"→원더걸스, 송민호·강승윤 "TEASER"→2PM). 남에게 써준 곡으로는 안 쓴다.
const sameGroupWriters = new Map();
for (const [key, v] of Object.entries(credits)) {
  const g = key.split('\u0000')[1], seen = new Set();
  for (const s2 of [...(v.lyrics || []), ...(v.compose || [])]) { const k = norm(s2.title); if (seen.has(k)) continue; seen.add(k); sameGroupWriters.set(g + '|' + k, (sameGroupWriters.get(g + '|' + k) || 0) + 1); }
}
const artistByKey = new Map(ARTISTS.map(a => [a.name.ko + '\u0000' + a.group.ko, a]));
const out = {}; let nSelf = 0, nOther = 0;
const review = [];
for (const [key, v] of Object.entries(credits)) {
  const a = artistByKey.get(key); if (!a) continue;
  const ownGroups = new Set([a.group.ko, ...(a.groups || []).map(g => g.ko)]);
  const isOwn = owner => { const [p0, p1] = owner.split('\u0000'); return owner === key || ownGroups.has(p0) || (p1 !== undefined && p0 === a.name.ko && ownGroups.has(p1)); };
  const songs = new Map(); // norm → {title,l,c}
  for (const [role, list] of [['l', v.lyrics || []], ['c', v.compose || []]]) for (const s of list) {
    const k = norm(s.title); if (k.length < 2) continue;
    const e = songs.get(k) || { title: s.title, l: 0, c: 0, ver: VERSION_RE.test(s.title) };
    e[role] = 1; if (!VERSION_RE.test(s.title)) { e.title = s.title; e.ver = false; }
    songs.set(k, e);
  }
  const list = [];
  for (const [k, e] of songs) {
    if (EXCLUDE.has(key + '|' + k)) continue;
    const owners = byTitle.get(k); if (!owners) continue;
    const own = [...owners.keys()].filter(isOwn);
    if (own.length) { list.push({ t: owners.get(own[0]).t, o: own[0], s: 1, l: e.l, c: e.c, tt: owners.get(own[0]).title ? 1 : 0 }); nSelf++; continue; }
    if (owners.size !== 1 || k.length < 6) continue;
    if ((sameGroupWriters.get(a.group.ko + '|' + k) || 0) >= 2) continue;
    if (GENERIC_OTHER.has(k)) continue;
    const [o] = owners.keys();
    list.push({ t: owners.get(o).t, o, s: 0, l: e.l, c: e.c, tt: owners.get(o).title ? 1 : 0 }); nOther++;
    review.push(`${a.name.ko}(${a.group.ko}) → ${owners.get(o).t} @${o.replace('\u0000', '/')}`);
  }
  // Surf는 한 사람당 최대 20곡만 쓴다 — 남에게 써준 곡 전부 + 본인 곡 15곡(타이틀 우선)만 남겨 파일을 줄인다(모바일 첫 로드)
  if (list.length) { list.sort((x, y) => (x.s - y.s) || (y.tt - x.tt)); const others = list.filter(x => !x.s), own = list.filter(x => x.s).slice(0, 15); out[key] = [...others, ...own].map(({ l, c, ...r }) => r); }
}
fs.writeFileSync(path.join(ROOT, 'written_songs.json'), JSON.stringify(out));
console.log(`작곡가 ${Object.keys(out).length}명 · 본인 곡 ${nSelf} · 남에게 써준 곡 ${nOther} → written_songs.json`);
if (process.argv.includes('--review')) console.log(review.join('\n'));
