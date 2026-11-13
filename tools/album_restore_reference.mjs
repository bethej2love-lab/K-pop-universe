#!/usr/bin/env node
// 앨범 수록곡 복원 — 멜론 공식 수록 목록(곡 번호 포함)으로 통째 교체(2026-11-12 Codex 검수 '멜론 정본 42장').
// 왜: 음원 번호가 하나도 없는 앨범 일부에 같은 팀 다른 앨범 곡이 섞이거나(BTOB This Is Us에 MOVIE), 정본 타이틀이 빠져 있었다
//     (DAY6 Band Aid, CRAVITY SUN SEEKER 등). 한·영 앨범 페이지와 곡 페이지가 그대로 공개되고 있었다.
// 입력: Codex 산출 album-melon-audit-50.json(멜론 앨범 상세에서 읽은 reference: [{id,title,isTitle}]).
// 안전장치:
//   · 우리 앨범과 멜론 앨범 번호·발매일이 같을 때만(Codex가 앨범명·아티스트·날짜 대조 완료)
//   · 기존 곡 객체의 en·작사작곡(cr) 등은 곡 번호 또는 제목 기본형이 같으면 그대로 옮긴다
//   · 신화 Winter Story(토크 트랙 포함 14곡)는 토크/수록 분리 정책이 없어 건너뜀
//   · 이 앨범에서 빠지는 곡은 지우기만 — 원래 앨범 쪽 곡과 영상 연결·별칭은 건드리지 않는다
// 실행: node tools/album_restore_reference.mjs <json> [--apply]  → build_slim_data → 테스트
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const APPLY = process.argv.includes('--apply');
const SRC = process.argv.slice(2).find(a => !a.startsWith('--'));
const SKIP = new Set(['신화|Winter Story', ...((process.argv.find(a => a.startsWith('--skip=')) || '').slice(7).split(',').filter(Boolean))]); // --skip=주인|제목,… (번역 표기만 다른 앨범 등)
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(P('shared.js'), 'utf8') + ';this.B=_songBase;', ctx);
const B = t => ctx.B(String(t || ''));
const dec = s => String(s || '').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");
const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const list = JSON.parse(fs.readFileSync(SRC, 'utf8'));
let done = 0, skipped = 0;
for (const r of list) {
  const tag = `${r.owner} | ${r.title}`;
  if (SKIP.has(r.owner + '|' + r.title)) { console.log(`  건너뜀(정책) ${tag}`); skipped++; continue; }
  if (!Array.isArray(r.reference) || !r.reference.length || r.date !== r.releaseDate) { console.log(`  건너뜀(근거 부족) ${tag}`); skipped++; continue; }
  const disco = r.k === 'g' ? (groups[r.owner] || {}).discography : ((artists.find(a => a.name && a.name.ko === r.owner) || {}).discography);
  const al = (disco || []).find(a => a && a.title === r.title && (!a.melonAlbumId || String(a.melonAlbumId) === String(r.melonAlbumId)) && a.releaseDate === r.releaseDate); // 번호 없는 앨범은 커버 번호로 찾은 것(album_restore_fetch.mjs가 앨범명 대조)
  if (!al) { console.log(`  건너뜀(앨범 못 찾음) ${tag}`); skipped++; continue; }
  const old = (al.tracks || []).filter(t => t && typeof t === 'object');
  const byId = new Map(old.filter(t => t.songId).map(t => [String(t.songId), t]));
  const byB = new Map(old.map(t => [B(t.title), t]));
  // 같은 곡의 다른 표기(영문 ↔ 한글 정본 '열대야 (Fever)')도 같은 곡으로 — en·작사작곡을 이어받는다(2026-11-13)
  const paren = s => (String(s || '').match(/\(([^()]+)\)/) || [])[1] || '';
  const byAlt = new Map(); old.forEach(t => [t.en, paren(t.title)].map(B).filter(k => k && (k.length > 1 || /[가-힣]/.test(k))).forEach(k => { if (!byAlt.has(k)) byAlt.set(k, t); }));
  const used = new Set();
  const tracks = r.reference.map((x, i) => {
    const title = dec(x.title).trim();
    let prev = byId.get(String(x.id)) || byB.get(B(title)) || byAlt.get(B(title)) || (paren(title) && (byB.get(B(paren(title))) || byAlt.get(B(paren(title)))));
    if (prev && used.has(prev)) prev = null; if (prev) used.add(prev);
    const sameSong = prev && (B(prev.title) === B(title) || [prev.en, paren(prev.title), prev.title].map(B).some(k => k && (k === B(title) || k === B(paren(title)))));
    const t = { ...(prev || {}) };
    t.no = i + 1; t.title = title; t.songId = String(x.id); t.isTitle = !!x.isTitle;
    // 옛 곡의 영문 제목은 같은 곡일 때만(제목 기본형이 같아야) — 번호만 같은 남의 곡 en을 옮기지 않는다
    if (prev && !sameSong) { delete t.en; delete t.cr; }
    // 같은 곡인데 표기만 다르면('Fever' ↔ '열대야 (Fever)') 기존 제목을 그대로 둔다 — 곡 키·영상 연결·별칭이 기존 제목 기준이라 바꾸면 끊긴다
    if (prev && sameSong && B(prev.title) !== B(title)) { t.title = prev.title; t.melonTitle = title; }
    return t;
  });
  const before = old.map(t => t.title), after = tracks.map(t => t.title);
  console.log(`  ${tag} (${r.releaseDate}) ${before.length}→${after.length}곡\n     - ${before.filter(t => !after.some(a => B(a) === B(t))).join(' / ') || '없음'}\n     + ${after.filter(t => !before.some(b => B(b) === B(t))).join(' / ') || '없음'}`);
  if (APPLY) {
    al.tracks = tracks;
    const tt = tracks.filter(t => t.isTitle).map(t => t.title);
    if (tt.length) al.titleTrack = tt.join(' / ');
    if ('trackCount' in al) al.trackCount = tracks.length;
    al.tracksSource = 'melon-reference-2026-11-12';
    al.melonAlbumId = String(r.melonAlbumId);
    if (r.melonDate && /^\d{4}\.\d{2}\.\d{2}$/.test(r.melonDate) && r.melonDate !== al.releaseDate) { console.log(`     발매일 ${al.releaseDate} → ${r.melonDate}`); al.releaseDate = r.melonDate; }
  }
  done++;
}
console.log(`복원 ${done}장 · 건너뜀 ${skipped}장${APPLY ? ' · 저장' : ' · 읽기 전용'}`);
if (APPLY && done) {
  const keep = f => { const raw = fs.readFileSync(P(f), 'utf8'); return { ind: ((/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || '  ').length, crlf: /\r\n/.test(raw.slice(0, 200)) }; };
  for (const [f, obj] of [['groups.json', groups], ['artists.json', artists]]) { const k = keep(f); let s = JSON.stringify(obj, null, k.ind) + '\n'; if (k.crlf) s = s.replace(/\n/g, '\r\n'); fs.writeFileSync(P(f), s); }
}
