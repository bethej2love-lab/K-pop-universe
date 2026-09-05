// 콜라보/피처링 네트워크 수집(collect-only) — 트랙 제목의 "(feat. X)"/"(with X)"를 파싱해
// 유니버스 내부 아티스트 간 콜라보 엣지를 만든다. 새 스크래이핑 없이 기존 데이터만 사용 (2026-09-05).
// 결과: collab_network.json {edges:[{song, a, b, type}], externalFeats:[…]}
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = JSON.parse(fs.readFileSync(ROOT + '/groups.json', 'utf8'));
const A = JSON.parse(fs.readFileSync(ROOT + '/artists.json', 'utf8'));
const ARR = Array.isArray(A) ? A : Object.values(A);

// 유니버스 이름 인덱스: 표기(정규화) → 표준이름(ko)
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
const nameIdx = {};
const addName = (raw, canon) => { const n = norm(raw); if (n && n.length >= 2) nameIdx[n] = canon; };
for (const k of Object.keys(G)) { addName(k, k); if (G[k].en) addName(G[k].en, k); }
for (const a of ARR) { const ko = a.name?.ko; if (!ko) continue; addName(ko, ko); if (a.name?.en) addName(a.name.en, ko); }

// feat/with 파싱 — "(feat. X, Y)" "(with X)" "feat. X"
function parseFeat(title) {
  const out = [];
  const m = title.match(/\((?:feat\.?|featuring|with)\s+([^)]+)\)/i) || title.match(/(?:feat\.?|featuring)\s+([^([]+)$/i);
  if (!m) return out;
  for (const part of m[1].split(/,|&|;| and | x |／|\//i)) { const p = part.trim(); if (p) out.push(p); }
  return out;
}

// 멤버→소속그룹(ko) 집합 — 같은 그룹 내부 피처링(멤버↔자기그룹, 유닛곡) 노이즈 제거용
const memberGroups = {};
for (const a of ARR) { const ko = a.name?.ko; if (!ko) continue; const gs = new Set(); if (a.group?.ko) gs.add(a.group.ko); (a.groups || []).forEach(g => g.ko && gs.add(g.ko)); memberGroups[ko] = gs; }
const sameEntity = (x, y) => (memberGroups[x]?.has(y)) || (memberGroups[y]?.has(x)) || [...(memberGroups[x] || [])].some(g => memberGroups[y]?.has(g));

const edges = [], external = {};
const seen = new Set();
function scan(hostCanon, tracks) {
  for (const t of tracks || []) {
    const title = t.title || ''; if (!/feat|featuring|with /i.test(title)) continue;
    for (const feat of parseFeat(title)) {
      const canon = nameIdx[norm(feat)];
      if (canon && canon !== hostCanon && !sameEntity(hostCanon, canon)) {
        const key = [hostCanon, canon].sort().join('||') + '|' + norm(title);
        if (!seen.has(key)) { seen.add(key); edges.push({ song: title.replace(/\s*\((?:feat|featuring|with)[^)]*\)/i, '').trim(), a: hostCanon, b: canon }); }
      } else if (!canon) { external[feat] = (external[feat] || 0) + 1; }
    }
  }
}
for (const k of Object.keys(G)) for (const d of (G[k].discography || [])) scan(k, d.tracks);
for (const a of ARR) { const ko = a.name?.ko; if (!ko) continue; for (const d of (a.unitDiscography || [])) scan(ko, d.tracks); if (Array.isArray(a.songs)) scan(ko, a.songs.map(s => typeof s === 'string' ? { title: s } : s)); }

fs.writeFileSync(ROOT + '/collab_network.json', JSON.stringify({ edges, generated: 'from track titles' }, null, 1));
console.log('유니버스 내부 콜라보 엣지:', edges.length);
edges.slice(0, 25).forEach(e => console.log(`  ${e.a} ↔ ${e.b} — ${e.song.slice(0, 40)}`));
const ext = Object.entries(external).sort((a, b) => b[1] - a[1]);
console.log('\n외부 피처링(유니버스 밖) 상위:', ext.slice(0, 12).map(x => x[0] + '(' + x[1] + ')').join(' '));
console.log('→ collab_network.json');
