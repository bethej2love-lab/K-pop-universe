#!/usr/bin/env node
// 지정한 영상들의 곡 키(song_keys)를 지금 규칙으로 다시 계산해 저장(2026-11-12).
// 태그 정정으로 주인(group_ko)이 바뀐 영상은 관리자 루틴 증분(새 영상만)에 안 걸려 다음 전량까지 곡 연결이 틀린 채로 남는다 — 정정 직후 이걸로 바로 맞춘다.
// 규칙·곡 범위는 루틴 _ytSweepSongLinks와 같다(shared.js _songLinkBases, 그룹 = 그룹 앨범 + 멤버 솔로 + 유닛 앨범).
// 실행: node tools/song_keys_for_ids.mjs <id> [<id> …] | --sql "<where 절>"  [--apply]
//   예: node tools/song_keys_for_ids.mjs --sql "id in (select id from _bak_lightsum_nayoung_20261112)" --apply
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const APPLY = process.argv.includes('--apply');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'skid-'));
function sql(q) {
  const f = path.join(TMP, 'q.sql'), of = path.join(TMP, 'out.json'); fs.writeFileSync(f, q); try { fs.unlinkSync(of); } catch { }
  execFileSync('node', ['C:/Users/user/.kpu_sbq.cjs', f, of], { stdio: 'ignore' });
  const j = JSON.parse(fs.readFileSync(of, 'utf8').replace(/[\u0000-\u001f]/g, ' '));
  if (!Array.isArray(j)) throw new Error('SQL 오류: ' + JSON.stringify(j).slice(0, 300)); return j;
}
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(P('shared.js'), 'utf8') + ';this.N=_songNorm;this.L=_songListFromDisco;this.K=_songAddNicks;this.F=_songLinkBases;', ctx);
const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const persons = new Set(); artists.forEach(a => [a.name && a.name.ko, a.name && a.name.en].forEach(x => { const n = ctx.N(x); if (n.length >= 2) persons.add(n); }));
const cache = new Map();
function songsFor(g) {
  if (cache.has(g)) return cache.get(g);
  let albums = [], names = [g];
  if (groups[g]) {
    albums = [...(groups[g].discography || [])];
    artists.forEach(a => { if (a.group && a.group.ko === g) { albums.push(...(a.discography || [])); (a.unitDiscography || []).forEach(u => albums.push(...((u && u.albums) || []))); } });
    if (groups[g].en) names.push(groups[g].en);
  } else {
    const a = artists.find(x => x.name && x.name.ko === g && !groups[x.group && x.group.ko]) || artists.find(x => x.name && x.name.ko === g);
    if (a) { albums = a.discography || []; if (a.name.en) names.push(a.name.en); }
  }
  const v = { songs: ctx.K(ctx.L(albums, persons), g), names }; cache.set(g, v); return v;
}
const si = process.argv.indexOf('--sql');
const where = si >= 0 ? process.argv[si + 1] : `id in (${process.argv.slice(2).filter(x => !x.startsWith('--')).map(lit).join(',')})`;
const rows = sql(`select id,title,group_ko,song_keys from yt_channel_videos where ${where} limit 20000`);
const ups = [];
for (const v of rows) {
  if (!v.group_ko) continue;
  const { songs, names } = songsFor(v.group_ko);
  const keys = songs.length ? ctx.F(v.title || '', songs, names).map(b => v.group_ko + ':' + b) : [];
  const cur = Array.isArray(v.song_keys) ? v.song_keys : [];
  if (cur.join('|') !== keys.join('|')) ups.push({ id: v.id, keys, cur });
}
ups.slice(0, 8).forEach(u => console.log(`  ${u.id} ${JSON.stringify(u.cur)} → ${JSON.stringify(u.keys)}`));
console.log(`영상 ${rows.length} · 바뀜 ${ups.length}${APPLY ? ' · 저장' : ' · 읽기 전용'}`);
if (APPLY) for (let i = 0; i < ups.length; i += 500) {
  const ch = ups.slice(i, i + 500);
  sql(`update yt_channel_videos t set song_keys = v.k from (values ${ch.map(u => `(${lit(u.id)}, ${u.keys.length ? `array[${u.keys.map(lit).join(',')}]::text[]` : 'null::text[]'})`).join(',')}) v(id,k) where t.id = v.id; select 1 ok;`);
}
