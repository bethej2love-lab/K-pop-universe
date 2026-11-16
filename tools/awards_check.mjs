// 시상식 수상 데이터(awards/*.json) 검증 + 그룹·멤버 연결 인덱스 생성 (2026-11-16)
//
// awards/{시상식}-{연도}.json 이 정본(사람이 출처를 보고 적는다 — 추측 금지, 출처 URL 필수).
// 수상자 {name, of?}:
//   · name = 기사 표기(한글). of = 동명이인 구분용 소속 그룹 키(예: {name:'민호', of:'샤이니'}).
//   · 이름 → groups.json(키·altNames·영문명) → artists.json(name.ko, of로 소속 확인) 순으로 연결한다.
// 실행: node tools/awards_check.mjs            → 연결 못 한 이름·모호한 이름 보고(종료코드 0)
//       node tools/awards_check.mjs --write    → awards/index.json(그룹·멤버별 수상 이력) 생성
//       node tools/awards_check.mjs --strict   → 연결 못 한 이름이 있으면 종료코드 1(테스트용 아님 — 등록 안 된 가수도 정상이라)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GROUPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const ARTISTS = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const norm = s => String(s || '').toLowerCase().replace(/[\s.\-_·'’"()]/g, '');
const gIdx = new Map();
for (const [ko, g] of Object.entries(GROUPS)) {
  for (const k of [ko, g.en, ...(g.altNames || []), ...(g.formerNames || [])]) { const n = norm(k); if (n && !gIdx.has(n)) gIdx.set(n, ko); }
}
const aByName = new Map();
for (const a of ARTISTS) { const n = norm(a.name && a.name.ko); if (!n) continue; (aByName.get(n) || aByName.set(n, []).get(n)).push(a); }
const groupsOf = a => (a.groups || [a.group]).filter(Boolean).map(g => g.ko);

export function resolveWinner(w) {
  if (w.ext) return { kind: 'external' }; // 우주 밖/미등록 수상자(트로트 가수·밴드·해외 아티스트 등) — 정상
  if (w.id) { const a = ARTISTS.find(x => x.id === w.id); return a ? { kind: 'member', gko: groupsOf(a).find(g => GROUPS[g]) || null, mko: a.name.ko, artistId: a.id } : { kind: 'unresolved', why: '없는 아티스트 id ' + w.id }; }
  if (w.gko) return GROUPS[w.gko] ? { kind: 'group', gko: w.gko } : { kind: 'unresolved', why: '없는 그룹 키 ' + w.gko };
  const n = norm(w.name);
  if (w.of) { // 소속이 적혀 있으면 그 그룹의 멤버를 먼저
    const c = (aByName.get(n) || []).filter(a => groupsOf(a).includes(w.of));
    if (c.length === 1) return { kind: 'member', gko: w.of, mko: c[0].name.ko, artistId: c[0].id };
    if (c.length > 1) return { kind: 'ambiguous', candidates: c.map(a => a.id) };
    return { kind: 'unresolved', why: '그 그룹에 그 이름의 멤버가 없음' };
  }
  if (gIdx.has(n)) return { kind: 'group', gko: gIdx.get(n) };
  const c = aByName.get(n) || [];
  if (c.length === 1) { const gs = groupsOf(c[0]); return { kind: 'member', gko: gs.find(g => GROUPS[g]) || null, mko: c[0].name.ko, artistId: c[0].id }; }
  if (c.length > 1) return { kind: 'ambiguous', candidates: c.map(a => a.id + ':' + groupsOf(a).join('/')) };
  return { kind: 'unresolved' };
}

export function loadAwards() {
  const dir = path.join(ROOT, 'awards');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /^[a-z0-9-]+-\d{4}(?:-[A-Za-z]+)?\.json$/.test(f)).sort().map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const awards = loadAwards();
  const unresolved = [], ambiguous = [], byGroup = {}, byMember = {};
  let total = 0, linked = 0;
  for (const a of awards) {
    for (const c of a.categories) for (const w of c.winners) {
      total++;
      const r = resolveWinner(w);
      if (r.kind === 'external') continue;
      if (r.kind === 'unresolved') { unresolved.push(`${a.file} · ${c.ko} · ${w.name}${r.why ? ' (' + r.why + ')' : ''}`); continue; }
      if (r.kind === 'ambiguous') { ambiguous.push(`${a.file} · ${c.ko} · ${w.name} → ${r.candidates.join(', ')}`); continue; }
      linked++;
      const rec = { id: a.id, edition: a.edition, award: a.name, category: c.ko, en: c.en, tier: c.tier, ...(c.work ? { work: c.work } : {}), ...(c.day ? { day: c.day } : {}) };
      if (r.gko) (byGroup[r.gko] || (byGroup[r.gko] = [])).push({ ...rec, ...(r.kind === 'member' ? { member: r.mko } : {}) });
      if (r.kind === 'member') (byMember[r.artistId] || (byMember[r.artistId] = [])).push(rec);
    }
  }
  console.log(`시상식 ${awards.length}개 · 수상자 ${total}명(팀) · 연결 ${linked} · 모호 ${ambiguous.length} · 못 찾음 ${unresolved.length}`);
  if (ambiguous.length) console.log('\n[모호 — 데이터에 of(소속 그룹)를 적을 것]\n' + ambiguous.join('\n'));
  if (unresolved.length) console.log('\n[못 찾음 — 등록 안 된 가수·그룹일 수 있음(정상), 표기가 다르면 name을 고칠 것]\n' + unresolved.join('\n'));
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, 'awards', 'index.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), awards: awards.map(a => ({ id: a.id, edition: a.edition, name: a.name, dates: a.dates })), byGroup, byMember }));
    console.log('awards/index.json 생성');
  }
  if (process.argv.includes('--strict') && (unresolved.length || ambiguous.length)) process.exit(1);
}
