// 앨범 카드 영상 패널용 "곡·앨범 → 영상" 목록 미리 만들기 → album_videos/{주인}.json + album_videos/_meta.json (2026-10-19)
//
// 왜: 앨범 패널이 열 때마다 DB를 제목 글자로 검색했다(앨범명 ilike + 수록곡 키). 그런데 앨범↔영상 연결은 거의 안 바뀌는
// 정보라 매번 새로 찾을 이유가 없다(사용자 지적, 2026-10-19). 주 1회(album-videos-weekly.yml) 여기서 전부 계산해 파일로 두고, 앱은 그 파일을 읽은 뒤
// **파일을 만든 뒤 들어온 신규 영상만** 작게 조회해 덧붙인다(index.html _loadAlbumVideos).
//
// 연결 기준 두 가지:
//   ① 곡 — DB song_keys(루틴 10단계 _ytSweepSongLinks가 shared.js _songLinkBases 규칙으로 박는다) 그대로
//   ② 앨범명 — 제목에 앨범명이 든 영상(하이라이트 메들리·트레일러·쇼케이스). 규칙은 shared.js _albumNormFor·_albumTitleHit
// 무관/보류/hidden 영상은 뺀다(그룹 카드 영상 그리드와 같은 노출 조건).
//
// 파일 모양(주인 = 영상 group_ko — 그룹이면 그룹 ko, 무소속 솔로면 본인 이름):
//   { v: [[id, 제목, 'YYYY-MM-DD', category, 쇼츠(1/0), 길이초|0, 썸네일(기본형이 아닐 때만)]],
//     s: { 곡기본형: [v 번호…] },  a: { 앨범명정규형: [v 번호…] } }
// ⚠️ 조회수는 넣지 않는다 — 매일 바뀌는 값이라 넣으면 파일 수백 개가 매일 통째로 바뀌어 커밋이 불어난다.
//    만든 시각도 각 파일이 아니라 _meta.json 하나에만(같은 이유).
//
// 실행: node tools/build_album_videos.mjs   (회사망: NODE_TLS_REJECT_UNAUTHORIZED=0)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'album_videos');
const SB_URL = 'https://dukgguehegnembimqvkm.supabase.co/rest/v1/yt_channel_videos';
const SB_KEY = 'sb_publishable_SjNC-N_9TUqaQcCxhVinGA_ULyX6tA0'; // 앱과 같은 공개 읽기 키(RLS 읽기 전용)

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8') +
  '\nthis.songBase=_songBase;this.albumNormFor=_albumNormFor;this.albumTitleHit=_albumTitleHit;', ctx);
const { songBase, albumNormFor, albumTitleHit } = ctx;

const fileKey = s => String(s).replace(/[\/\\]/g, '_').replace(/[.\s]+$/, ''); // index.html _discoFileKey와 동일
const readJson = p => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const groups = readJson(path.join(ROOT, 'groups.json')) || {};
const artistsRaw = readJson(path.join(ROOT, 'artists.json')) || [];
const artists = Array.isArray(artistsRaw) ? artistsRaw : Object.values(artistsRaw);

// 주인별 앨범 목록 — 루틴 10단계 songsFor와 같은 범위(그룹 앨범 + 멤버 솔로 + 유닛 앨범 / 솔로는 본인 디스코)
const owners = new Map(); // 주인 → {albums, names}
for (const [gko, g] of Object.entries(groups)) {
  const d = readJson(path.join(ROOT, 'disco/g', fileKey(gko) + '.json'));
  if (!d) continue;
  const albums = [...(d.g || [])];
  for (const m of Object.values(d.m || {})) { albums.push(...(m.d || [])); (m.u || []).forEach(u => albums.push(...((u && u.albums) || []))); }
  owners.set(gko, { albums, names: [gko, g.en].filter(Boolean) });
}
for (const a of artists) {
  if (!a || !a.name || !a.group || groups[a.group.ko]) continue;
  const base = fileKey(a.group.ko) + '__' + fileKey(a.name.ko);
  const d = readJson(path.join(ROOT, 'disco/a', base + '.json')) || (a.id && readJson(path.join(ROOT, 'disco/a', base + '__' + a.id + '.json')));
  if (!d || owners.has(a.name.ko)) continue;
  const albums = [...(d.d || [])]; (d.u || []).forEach(u => albums.push(...((u && u.albums) || [])));
  owners.set(a.name.ko, { albums, names: [a.name.ko, a.name.en].filter(Boolean) });
}
// 주인별 앨범명 판정 준비
for (const o of owners.values()) {
  const bases = new Set();
  o.albums.forEach(al => (al.tracks || []).forEach(t => { const b = t && t.title && songBase(t.title); if (b) bases.add(b); }));
  o.alb = [];
  const seen = new Set();
  for (const al of o.albums) {
    const n = al && al.title && albumNormFor(al.title, bases, o.names);
    if (n && !seen.has(n)) { seen.add(n); o.alb.push({ n, title: al.title }); }
  }
}

// 전량 훑기 — id 커서로 1000개씩(정렬은 기본키라 안전)
const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
const COLS = 'id,title,group_ko,song_keys,category,is_short,published_at,duration_sec,thumb,content_flag';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(cursor) {
  const qs = `select=${COLS}&order=id.asc&limit=1000` + (cursor ? `&id=gt.${encodeURIComponent(cursor)}` : '');
  for (let i = 0; i < 5; i++) {
    try { const r = await fetch(SB_URL + '?' + qs, { headers: H }); if (r.ok) return await r.json(); console.error('HTTP', r.status, (await r.text()).slice(0, 200)); }
    catch (e) { console.error('fetch 실패', e.message); }
    await sleep(2000 * (i + 1));
  }
  throw new Error('조회 5회 실패 — 커서 ' + cursor);
}
const startedAt = new Date().toISOString();
const per = new Map(); // 주인 → {v:[], s:{}, a:{}}
const EXCL = new Set(['무관', '보류', 'hidden']);
let cursor = '', scanned = 0, kept = 0;
for (;;) {
  const rows = await page(cursor);
  if (!rows.length) break;
  for (const v of rows) {
    scanned++;
    if (!v.group_ko || EXCL.has(v.content_flag)) continue;
    const pre = v.group_ko + ':';
    const bases = (Array.isArray(v.song_keys) ? v.song_keys : []).filter(k => k.startsWith(pre)).map(k => k.slice(pre.length));
    const o = owners.get(v.group_ko);
    const albs = o ? o.alb.filter(al => albumTitleHit(v.title || '', al.title, al.n)).map(al => al.n) : [];
    if (!bases.length && !albs.length) continue;
    let p = per.get(v.group_ko); if (!p) per.set(v.group_ko, p = []);
    p.push({ v, bases, albs }); kept++;
  }
  cursor = rows[rows.length - 1].id;
  if (scanned % 50000 < 1000) console.log(`훑는 중 ${scanned.toLocaleString()}개 · 연결 ${kept.toLocaleString()}개`);
  if (rows.length < 1000) break;
}

fs.rmSync(OUT, { recursive: true, force: true }); // 이전 생성물 정리(사라진 주인 파일이 남지 않게)
fs.mkdirSync(OUT, { recursive: true });
let files = 0, bytes = 0;
for (const [owner, list] of per) {
  list.sort((x, y) => String(y.v.published_at || '').localeCompare(String(x.v.published_at || '')) || (x.v.id < y.v.id ? -1 : 1));
  const out = { v: [], s: {}, a: {} };
  list.forEach(({ v, bases, albs }, i) => {
    const row = [v.id, v.title || '', String(v.published_at || '').slice(0, 10), v.category || '', v.is_short ? 1 : 0, v.duration_sec || 0];
    if (v.thumb && v.thumb !== `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`) row.push(v.thumb);
    out.v.push(row);
    bases.forEach(b => (out.s[b] = out.s[b] || []).push(i));
    albs.forEach(n => (out.a[n] = out.a[n] || []).push(i));
  });
  const txt = JSON.stringify(out);
  fs.writeFileSync(path.join(OUT, fileKey(owner) + '.json'), txt);
  files++; bytes += Buffer.byteLength(txt);
}
fs.writeFileSync(path.join(OUT, '_meta.json'), JSON.stringify({ at: startedAt }) + '\n');
console.log(`완료 — 훑은 영상 ${scanned.toLocaleString()}개 · 연결 ${kept.toLocaleString()}개 · 파일 ${files}개 · ${(bytes / 1048576).toFixed(1)}MB`);
