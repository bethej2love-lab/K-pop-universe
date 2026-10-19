// 빈 인스타 계정 링크 정리 (2026-10-19)
//
// 왜: links.instagram이 있는데 막상 들어가면 게시물이 하나도 없는 계정이 있다 — 연습생 때 쓰던 계정 등. 사용자: "이런 건 그냥
// 인스타를 삭제하는 게 낫다". 이제 카드 프로필 사진·팔로워·게시물 미리보기가 인스타를 따라가므로 빈 계정이 남아 있으면 더 어색하다.
//
// 판정: DB ig_accounts(ig-stats.yml이 채움)에서 status=ok **그리고 게시물 0개**. 조회 불가(not_found — 개인 계정·연령 제한·없는 계정)는
//   비었는지 알 수 없으므로 건드리지 않는다(목록만 따로 출력).
// 기본은 목록만 보여준다. --apply면 artists.json·groups.json에서 그 링크를 지운다(원본 들여쓰기 보존 — 지운 뒤 git diff로 확인).
//
// 실행: node tools/ig_prune_empty.mjs [--apply]     (회사망: NODE_TLS_REJECT_UNAUTHORIZED=0)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');
const SB = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1';
const KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 공개 읽기 키(ig_accounts는 읽기 개방)
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const rows = [];
for (let from = 0; ; from += 1000) {
  const r = await fetch(`${SB}/ig_accounts?select=handle,status,media_count,followers,note&order=handle`, { headers: { ...H, Range: `${from}-${from + 999}` } });
  if (!r.ok) { console.error('조회 실패', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const d = await r.json(); rows.push(...d); if (d.length < 1000) break;
}
const empty = new Set(rows.filter(r => r.status === 'ok' && r.media_count === 0).map(r => r.handle));
const notFound = rows.filter(r => r.status === 'not_found');
const handleOf = u => { const m = String(u || '').match(/instagram\.com\/([A-Za-z0-9._]+)/i); return m ? m[1].toLowerCase() : null; };
const gPath = path.join(ROOT, 'groups.json'), aPath = path.join(ROOT, 'artists.json');
const indentOf = p => { const m = fs.readFileSync(p, 'utf8').match(/^[\[{]\r?\n([ \t]+)/); return m ? m[1] : 2; };
const groups = JSON.parse(fs.readFileSync(gPath, 'utf8')), artistsRaw = JSON.parse(fs.readFileSync(aPath, 'utf8'));
const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);
const hits = [];
for (const [k, g] of Object.entries(groups)) if (g.links && empty.has(handleOf(g.links.instagram))) { hits.push(`그룹 ${k} — ${g.links.instagram}`); if (APPLY) delete g.links.instagram; }
for (const a of artists) if (a.links && empty.has(handleOf(a.links.instagram))) { hits.push(`${a.name.ko}(${a.group && a.group.ko}) — ${a.links.instagram}`); if (APPLY) delete a.links.instagram; }
console.log(`수집된 계정 ${rows.length}개 · 게시물 0개(지울 대상) ${hits.length}곳 · 조회 불가(판단 보류) ${notFound.length}개`);
hits.forEach(h => console.log('  ✂ ' + h));
if (notFound.length) console.log('조회 불가(개인 계정·연령 제한·없는 계정 — 손으로 확인):\n' + notFound.slice(0, 60).map(r => '  ? ' + r.handle + (r.note ? ' — ' + r.note.slice(0, 60) : '')).join('\n'));
if (APPLY && hits.length) {
  fs.writeFileSync(gPath, JSON.stringify(groups, null, indentOf(gPath)) + '\n');
  fs.writeFileSync(aPath, JSON.stringify(artistsRaw, null, indentOf(aPath)) + '\n');
  console.log('반영함 — git diff로 확인 후 커밋');
} else if (!APPLY) console.log('(목록만 — 지우려면 --apply)');
