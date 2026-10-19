// 이름 키(group_ko=사람 이름) 영상의 주인 정하기 (2026-10-19)
//
// 왜: 솔로 활동 영상은 group_ko가 본인 이름이다(_ytGroupKoFor). 그런데 이름이 같은 사람이 둘 이상이면(프리스틴·공원소녀 레나,
// 포미닛·나인뮤지스 현아, 방탄·AOA 지민 …) 멤버 카드가 group_ko=이름 영상을 **둘 다** 가져가서 남의 영상이 섞였다(사용자: "심각한 오류").
// 동명이인마다 그 이름 키 영상의 주인을 데이터로 정해 artists.json에 nameKeyOwner:true로 박는다. 앱은 이름이 유일하거나
// 주인일 때만 이름 키 영상을 쓴다(index.html _nameKeyOk). 주인을 못 정하면 아무도 안 쓴다(섞이는 것보다 빠지는 게 낫다).
//
// 판정: 이름 키 영상 제목(최대 300개, 조회수순)에 각 후보의 단서가 몇 번 나오는지 —
//   그룹 이름(ko·en, 이력 포함) · 영문 이름(3글자↑) · 솔로 디스코 곡명(4글자↑). 1등이 2등의 3배 이상 & 3건 이상일 때만 주인. 후보끼리 겹치는 단서(같은 영문 이름 등)는 안 센다.
// 실행: node tools/name_key_owner.mjs [--apply]   (회사망: NODE_TLS_REJECT_UNAUTHORIZED=0)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0';
const aPath = path.join(ROOT, 'artists.json');
const raw = fs.readFileSync(aPath, 'utf8');
const indent = (raw.match(/^[\[{]\r?\n([ \t]+)/) || [])[1] || 2;
const artists = JSON.parse(raw);
const groups = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const norm = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣]/g, '');
const byName = new Map();
for (const a of artists) if (a && a.name && a.name.ko) (byName.get(a.name.ko) || byName.set(a.name.ko, []).get(a.name.ko)).push(a);
const dups = [...byName].filter(([, v]) => v.length > 1);
// 솔로 디스코(멤버 disco 파일) — 곡명 단서
const discoTitles = a => {
  const out = new Set();
  const add = list => (list || []).forEach(al => (al.tracks || []).forEach(t => { const n = norm(String(t.title || '').split(/[(\[]/)[0]); if (n.length >= 4) out.add(n); }));
  if (groups[a.group.ko]) { try { const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'disco/g', a.group.ko.replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '') + '.json'), 'utf8')); add(((d.m || {})[a.name.ko] || {}).d); } catch { } }
  else { // 솔로 디스코는 정확한 파일명으로만(동명이인이면 __id) — 앞부분으로 찾으면 나인뮤지스 현아가 포미닛 현아 파일을 읽었다
    const fk = s => String(s).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, '');
    const base = fk(a.group.ko) + '__' + fk(a.name.ko);
    for (const f of [base + '__' + a.id + '.json', base + '.json']) { const p = path.join(ROOT, 'disco/a', f); if (fs.existsSync(p)) { try { add(JSON.parse(fs.readFileSync(p, 'utf8')).d); } catch { } break; } }
  }
  return out;
};
const clues = a => {
  const gs = new Set();
  for (const g of [a.group, ...(a.groups || [])]) { if (!g || !g.ko || g.ko === '솔로') continue; gs.add(norm(g.ko)); if (groups[g.ko] && groups[g.ko].en) gs.add(norm(groups[g.ko].en)); }
  const en = norm(a.name.en); return { gs: [...gs].filter(x => x.length >= 2), en: en.length >= 3 ? en : '', songs: discoTitles(a) };
};
const out = [];
for (const [name, cand] of dups) {
  const r = await fetch(`${SB}?select=title&group_ko=eq.${encodeURIComponent(name)}&order=view_count.desc.nullslast&limit=300`, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } });
  if (!r.ok) { console.error('조회 실패', name, r.status); continue; }
  const vids = await r.json();
  if (!vids.length) continue;
  const cs = cand.map(a => ({ a, c: clues(a), score: 0 }));
  // 후보끼리 겹치는 단서는 뺀다 — 영문 이름이 같으면(Taemin·HyunA) 둘 다 점수를 받아 비겼다. 그 사람에게만 있는 단서로만 센다
  // ⚠️ 원본 단서(orig)로 비교한다 — 걸러낸 결과로 다음 후보를 비교하면 뒤 후보가 공통 단서를 그대로 가져가 점수를 쓸어갔다(첫 구현 버그)
  const orig = cs.map(x => x.c);
  cs.forEach((x, i) => {
    const others = orig.filter((_, j) => j !== i);
    const inOther = s => others.some(c => c.gs.includes(s) || c.en === s || c.songs.has(s));
    x.c = { gs: orig[i].gs.filter(s => !inOther(s)), en: orig[i].en && !inOther(orig[i].en) ? orig[i].en : '', songs: new Set([...orig[i].songs].filter(s => !inOther(s))) };
  });
  for (const v of vids) {
    const t = norm(v.title);
    for (const x of cs) {
      const hit = x.c.gs.find(g => t.includes(g)) || (x.c.en && t.includes(x.c.en) ? x.c.en : '') || [...x.c.songs].find(s => t.includes(s));
      if (hit) { x.score++; (x.hits = x.hits || {})[hit] = (x.hits[hit] || 0) + 1; if (x.c.gs.includes(hit)) x.strong = (x.strong || 0) + 1; }
    }
  }
  cs.sort((p, q) => q.score - p.score);
  const [top, second] = cs;
  // 그룹 이름 단서(강함)는 3번 이상이면 충분. 영문 이름·곡명(약함)만이면 서로 다른 단서 2종↑ & 5번↑ —
  // 영문 이름 하나로는 우리 DB 밖 동명이인('BIBI' 솔로 가수 → 힛지스 비비)을 못 가른다(2026-10-19 표본)
  const distinct = Object.keys(top.hits || {}).length;
  const enough = (top.strong || 0) >= 3 || (top.score >= 5 && distinct >= 2);
  const owner = enough && top.score >= 3 * (second.score || 0.34) ? top.a : null;
  out.push({ name, n: vids.length, owner, scores: cs.map(x => `${x.a.name.ko}(${x.a.group.ko}/${(x.a.groups || []).map(g => g.ko).filter(k => k !== '솔로').join(',') || '-'}):${x.score}${x.hits ? '[' + Object.entries(x.hits).sort((p, q) => q[1] - p[1]).slice(0, 2).map(([k, v]) => k + '×' + v).join(',') + ']' : ''}`) });
}
for (const o of out) console.log(`${o.owner ? '✓' : '·'} ${o.name} 영상 ${o.n} → ${o.owner ? `${o.owner.name.ko}(${o.owner.group.ko}, ${o.owner.id})` : '주인 없음'}  | ${o.scores.join(' · ')}`);
console.log(`\n동명이인 이름 ${dups.length}개 중 이름 키 영상이 있는 ${out.length}개 · 주인 정함 ${out.filter(o => o.owner).length}`);
if (APPLY) {
  let n = 0;
  for (const a of artists) if (a && a.nameKeyOwner) { delete a.nameKeyOwner; }
  for (const o of out) if (o.owner) { o.owner.nameKeyOwner = true; n++; }
  fs.writeFileSync(aPath, JSON.stringify(artists, null, indent) + '\n');
  console.log(`반영 — nameKeyOwner ${n}명`);
}
