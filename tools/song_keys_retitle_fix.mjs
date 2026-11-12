#!/usr/bin/env node
// 곡 정본 제목이 바뀐 곡(melon_bilingual_titles: 영어 → 한글)의 영상 곡 키를 바로 맞춘다(2026-11-12).
// 왜: song_keys는 관리자 루틴이 50만 행을 며칠에 걸쳐 다시 계산한다. 그 사이 카드 '♪ 곡' 목록에 옛 키 글자('allmypoetry')가 보였다(사용자).
// ① 옛 영어 키(주인:_songBase(영어))가 붙은 영상 → 새 한글 키로 array_replace(GIN 인덱스).
// ② 주인 영상 중 제목에 한글 곡명이 있는데 새 키가 없는 영상 → shared.js _songLinkBases로 다시 계산(루틴과 같은 규칙·같은 곡 목록 범위).
// 입력: ~/Downloads/melon_disco_audit/bilingual_aliases.json(주인 → {한글 제목: [영어 제목]}). 실행: node tools/song_keys_retitle_fix.mjs [--apply]
// SQL 실행은 C:/Users/user/.kpu_sbq.cjs(관리 API) — 로컬 전용 도구.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const APPLY = process.argv.includes('--apply');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'skfix-'));
function sql(q) {
  const f = path.join(TMP, 'q.sql'); fs.writeFileSync(f, q);
  const of = path.join(TMP, 'out.json'); try { fs.unlinkSync(of); } catch { }
  execFileSync('node', ['C:/Users/user/.kpu_sbq.cjs', f, of], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'ignore', 'ignore'] }); // 화면 출력은 2만 자에서 잘린다 → 파일로
  const out = fs.readFileSync(of, 'utf8');
  const j = JSON.parse(out.replace(/[\u0000-\u001f]/g, ' ')); // 제목에 제어 문자가 있으면 응답 JSON이 깨진다
  if (!Array.isArray(j)) throw new Error('SQL 오류: ' + out.slice(0, 300)); return j;
}
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(P('shared.js'), 'utf8') + ';this.B=_songBase;this.N=_songNorm;this.L=_songListFromDisco;this.K=_songAddNicks;this.F=_songLinkBases;', ctx);
const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const persons = new Set(); artists.forEach(a => [a.name && a.name.ko, a.name && a.name.en].forEach(x => { const n = ctx.N(x); if (n.length >= 2) persons.add(n); }));
// 루틴 songsFor와 같은 범위: 그룹 = 그룹 앨범 + 멤버 솔로 + 유닛 앨범 / 솔로 키 = 그 사람 앨범
function songsFor(g) {
  let albums = [], names = [g];
  if (groups[g]) {
    albums = [...(groups[g].discography || [])];
    artists.forEach(a => { if (a.group && a.group.ko === g) { albums.push(...(a.discography || [])); (a.unitDiscography || []).forEach(u => albums.push(...((u && u.albums) || []))); } });
    if (groups[g].en) names.push(groups[g].en);
  } else {
    const a = artists.find(x => x.name && x.name.ko === g && !groups[x.group && x.group.ko]) || artists.find(x => x.name && x.name.ko === g);
    if (a) { albums = a.discography || []; if (a.name.en) names.push(a.name.en); }
  }
  return { songs: ctx.K(ctx.L(albums, persons), g), names };
}
const al = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'Downloads', 'melon_disco_audit', 'bilingual_aliases.json'), 'utf8'));
const pairs = [];
for (const [o, m] of Object.entries(al)) for (const [ko, ens] of Object.entries(m)) {
  const nb = ctx.B(ko); if (!nb) continue;
  for (const en of ens) { const ob = ctx.B(en); if (ob && ob !== nb) pairs.push({ o, ko, ob: o + ':' + ob, nb: o + ':' + nb }); }
}
// 같은 옛 키가 여러 새 키로 갈리면(판본만 다른 곡) 건너뛴다
const byOld = new Map(); pairs.forEach(p => { const s = byOld.get(p.ob) || new Set(); s.add(p.nb); byOld.set(p.ob, s); });
const rep = [...byOld].filter(([, s]) => s.size === 1).map(([ob, s]) => ({ ob, nb: [...s][0] }));
console.log(`제목 바뀐 곡 쌍 ${pairs.length} · 키 바꿀 것 ${rep.length}`);
// ① 옛 키 → 새 키
let cnt1 = 0;
for (let i = 0; i < rep.length; i += 60) {
  const ch = rep.slice(i, i + 60);
  const q = ch.map(p => `select ${lit(p.ob)} k, count(*)::int n from yt_channel_videos where song_keys @> array[${lit(p.ob)}]`).join(' union all ');
  const r = sql(q); const n = r.reduce((s, x) => s + x.n, 0); cnt1 += n;
  if (APPLY && n) sql(ch.map(p => `update yt_channel_videos set song_keys = array_remove(array_replace(song_keys, ${lit(p.ob)}, ${lit(p.nb)}), null) where song_keys @> array[${lit(p.ob)}] and not song_keys @> array[${lit(p.nb)}];
update yt_channel_videos set song_keys = array_remove(song_keys, ${lit(p.ob)}) where song_keys @> array[${lit(p.ob)}];`).join('\n') + '\nselect 1 ok;');
}
console.log(`① 옛 키가 붙은 영상 ${cnt1}${APPLY ? ' → 새 키로 바꿈' : ''}`);
// ② 한글 제목이 들어간 영상 다시 계산
const byOwner = new Map(); pairs.forEach(p => { const s = byOwner.get(p.o) || new Set(); s.add(p.ko); byOwner.set(p.o, s); });
let seen = 0, upd = 0; const ups = [];
for (const [o, kos] of byOwner) {
  const pats = [...kos].map(k => String(k).split(/\s*[\(\[]/)[0].trim()).filter(k => k.length >= 2);
  if (!pats.length) continue;
  const rows = sql(`select id,title,song_keys from yt_channel_videos where group_ko=${lit(o)} and (${pats.map(k => `title ilike ${lit('%' + k.replace(/[%_]/g, m => '\\' + m) + '%')}`).join(' or ')}) limit 5000`);
  if (!rows.length) continue;
  const { songs, names } = songsFor(o);
  for (const v of rows) {
    seen++;
    const keys = songs.length ? ctx.F(v.title || '', songs, names).map(b => o + ':' + b) : [];
    const cur = Array.isArray(v.song_keys) ? v.song_keys : [];
    if (keys.length && cur.join('|') !== keys.join('|')) { ups.push({ id: v.id, keys }); upd++; }
  }
}
console.log(`② 한글 제목 영상 ${seen} 중 곡 키 바뀜 ${upd}`);
if (APPLY) for (let i = 0; i < ups.length; i += 500) {
  const ch = ups.slice(i, i + 500);
  sql(`update yt_channel_videos t set song_keys = v.k from (values ${ch.map(u => `(${lit(u.id)}, array[${u.keys.map(lit).join(',')}]::text[])`).join(',')}) v(id,k) where t.id = v.id; select 1 ok;`);
}
const cye = sql(`select title, song_keys from yt_channel_videos where group_ko='클로즈유어아이즈' and title ilike '%내 안의 모든%' limit 3`);
console.log('표본:', JSON.stringify(cye).slice(0, 400));
