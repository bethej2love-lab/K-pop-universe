// 위험 이름별 "실제 DB 오염" 실측 (2026-08-25 신설, 읽기 전용 — 아무것도 안 고침)
//
// name_collision_audit.mjs가 "이론적 위험"을 보는 정적 스캐너라면, 이건 그 위험이 실제로 DB에
// 오염으로 나타났는지를 재는 도구다. 각 "이름(그룹)" 태그가 붙은 영상 수를 세고, 표본 제목에
// 그 태그를 정당화할 근거(그룹명/altNames/본인 다른 소속/해시태그된 본인 이름·영문명)가 있는지 본다.
// 근거 없는 비율이 높으면 = 이름만으로 역추론된 오태깅 의심.
//
// 실행: NODE_TLS_REJECT_UNAUTHORIZED=0 node tools/name_pollution_probe.mjs
//   ⚠️ 회사망처럼 TLS를 가로채는 환경에선 위 환경변수가 없으면 fetch가 self-signed 오류로 죽는다.
//   ⚠️ 한글 필터를 셸 인자로 넘기면 Git Bash가 인코딩을 깨뜨려 PostgREST가 500을 뱉는다 —
//      그래서 URL 조립을 전부 node 안에서 한다(curl로 재현하려다 한참 헤맨 함정).
//   ⚠️ 배열 컬럼(text[]) 필터 형식은 `cs.{"값"}` 이다. JSON 배열 `cs.["값"]`로 쓰면 조용히 0건.
//
// 판정은 표본(각 14건) 기반 힌트일 뿐 확정이 아니다 — 여기서 걸린 건 어드민의 "콜라보 재검증"·
// "자체 멤버 재검증"·"동명이인 그룹 오배정 전체 스캔" 버튼으로 실제 정정할 것. 이 스크립트는
// 절대 쓰기를 하지 않는다(DB 쓰기는 admin 세션 전용).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const U = 'https://dukgguehegnembimqvkm.supabase.co';
const K = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 공개 anon 키(index.html과 동일)
const H = { apikey: K, Authorization: `Bearer ${K}` };
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const gkos = a => (a.groups || [a.group]).map(x => x?.ko).filter(Boolean);

async function count(col, token) {
  const url = `${U}/rest/v1/yt_channel_videos?select=id&${col}=cs.${encodeURIComponent(`{"${token}"}`)}`;
  const r = await fetch(url, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  const cr = r.headers.get('content-range') || '*/0';
  return Number(cr.split('/')[1]) || 0;
}
async function sample(col, token, n = 14) {
  const url = `${U}/rest/v1/yt_channel_videos?select=id,title,group_ko,tags_manual&${col}=cs.${encodeURIComponent(`{"${token}"}`)}&limit=${n}`;
  const r = await fetch(url, { headers: H });
  return r.ok ? r.json() : [];
}
// 제목에 이 태그를 정당화할 근거가 있는가.
// ⚠️ 해시태그는 영문 표기(#JUNGWOO)로 붙는 경우가 압도적이라 name.en 도 반드시 같이 봐야 한다
// (처음엔 한글 이름으로만 비교해서 정상 태그를 대량 오탐했음).
const norm = s => (s || '').toUpperCase().replace(/[^A-Z0-9가-힣]/g, '');
function hasEvidence(title, person, gko) {
  const t = norm(title);
  const gtoks = [gko, G[gko]?.en, ...(G[gko]?.altNames || [])].filter(Boolean).map(norm).filter(x => x.length >= 2);
  if (gtoks.some(x => t.includes(x))) return 'group';
  // 본인이 속한 다른 그룹 이름이 제목에 있으면 그것도 근거(겸임·유닛 표기)
  const others = (person.groups || [person.group]).map(x => x?.ko).filter(Boolean)
    .flatMap(k => [k, G[k]?.en, ...(G[k]?.altNames || [])]).filter(Boolean).map(norm).filter(x => x.length >= 2);
  if (others.some(x => t.includes(x))) return 'group2';
  const names = [person.name?.ko, person.name?.en].filter(Boolean).map(norm).filter(x => x.length >= 2);
  const tags = (title || '').match(/#[^\s#]+/g) || [];
  if (tags.some(x => names.some(n => norm(x).includes(n)))) return 'hashtag';
  return null;
}

// ── 후보 선정 ────────────────────────────────────────────────
const byName = new Map();
for (const a of A) { if (!a?.name?.ko) continue; if (!byName.has(a.name.ko)) byName.set(a.name.ko, []); byName.get(a.name.ko).push(a); }
const KO_COMMON = ['가을', '노을', '소원', '하나', '루비', '미소', '여름', '하늘', '바다', '이유', '온', '별', '봄'];
const cands = [];
for (const [name, people] of byName) {
  const isDup = people.length >= 2;
  const isCommon = KO_COMMON.includes(name);
  const inGroupName = Object.keys(G).some(g => g !== name && g.includes(name) && [...name].length >= 2);
  if (!isDup && !isCommon && !inGroupName) continue;
  for (const p of people) for (const g of gkos(p)) cands.push({ name, person: p, gko: g, why: [isDup && '동명이인', isCommon && '흔한단어', inGroupName && '그룹명포함'].filter(Boolean).join('+') });
}
console.log('후보 태그 토큰:', cands.length, '개 (이름×소속 조합)');

const results = [];
let i = 0, cursor = 0;
async function worker() {
  while (cursor < cands.length) {
    const c = cands[cursor++];
    const token = `${c.name}(${c.gko})`;
    const [nWith, nMem] = await Promise.all([count('with_members', token), count('members', token)]);
    if (nWith + nMem > 0) results.push({ ...c, token, nWith, nMem });
    if (++i % 60 === 0) process.stderr.write(`  ...${i}/${cands.length}\n`);
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
results.sort((a, b) => (b.nWith + b.nMem) - (a.nWith + a.nMem));
console.log('\n태그가 실제로 붙어있는 토큰:', results.length, '개\n');

// 상위 항목은 표본 검사
const TOP = results.slice(0, 60);
const rows = [];
for (const r of TOP) {
  const col = r.nWith >= r.nMem ? 'with_members' : 'members';
  const rs = await sample(col, r.token);
  let noEv = 0, manual = 0; const ex = [];
  for (const v of rs) {
    if (v.tags_manual) { manual++; continue; }
    const e = hasEvidence(v.title, r.person, r.gko);
    if (!e) { noEv++; if (ex.length < 2) ex.push(`${v.id} · ${(v.title || '').slice(0, 62)}`); }
  }
  rows.push({ ...r, col, sampled: rs.length, manual, noEv, ex });
}
console.log('토큰'.padEnd(26), 'with/mem'.padEnd(11), '표본', '근거없음', '사유');
for (const r of rows) {
  const flag = r.sampled && r.noEv / r.sampled >= 0.5 ? '🔴' : r.noEv ? '🟡' : '✅';
  console.log(`${flag} ${r.token.padEnd(24)} ${String(r.nWith + '/' + r.nMem).padEnd(11)} ${String(r.sampled).padEnd(4)} ${String(r.noEv).padEnd(8)} ${r.why}`);
  r.ex.forEach(e => console.log('      ↳', e));
}
