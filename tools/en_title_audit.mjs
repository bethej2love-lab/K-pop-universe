#!/usr/bin/env node
// 곡 en(영문 제목)·별칭 짝 오류 찾기(2026-11-12 Codex — 오마이걸 '여름이 들려'→Celebrate, '컬러링북'→Coloring Book (Japanese Version),
// 빅뱅 '눈물뿐인 바보'→This Love, 여자친구 '바람 바람 바람'→Summer Rain, 에이프릴 '인형'→Oh! My Mistake, iKON '왜 또'→HOLUP!).
// 원인: 트랙 번호로 짝을 지었는데 우리 저장 순서가 공식과 다르거나(앞 두 곡 역순), 다른 앨범 곡이 섞여 있었다.
// 판정(같은 주인 디스코 안에서):
//   ① en이 같은 주인의 다른 곡 제목(또는 그 곡의 en)과 같다 → 틀린 짝(남의 이름표)
//   ② en에 판본 표시(Japanese/Inst/Remix/Ver)가 있는데 원래 제목엔 없다 → 다른 판본 이름
// --apply: 곡 en 삭제 + shared.js _SONG_ALIASES에서 그 (주인, 제목)→en 별칭 삭제.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const APPLY = process.argv.includes('--apply');
const groups = JSON.parse(fs.readFileSync(P('groups.json'), 'utf8'));
const artists = JSON.parse(fs.readFileSync(P('artists.json'), 'utf8'));
const src = fs.readFileSync(P('shared.js'), 'utf8');
const a0 = src.indexOf('const _SONG_ALIASES={'), b0 = src.indexOf('\n};', a0);
const AL = Function('return ' + src.slice(a0 + 'const _SONG_ALIASES='.length, b0 + 2))();
const ctx = {}; vm.createContext(ctx); vm.runInContext(src + ';this.B=_songBase;', ctx);
const B = t => ctx.B(String(t || ''));
const VER = /(japanese|japan ver|inst\.?|instrumental|remix|\bver\.?\b|version|acoustic|live)/i;
// 판본 종류별로 — 영문에만 있고 원래 제목엔 없는 종류면 다른 판본(\b: "I'm Alive"의 live 오탐 방지)
const VERS = [[/japanese|japan ver/i, /japanese|일본|jap/i], [/chinese/i, /chinese|중국|chn/i], [/\binst(\.|rumental)?\b/i, /inst|lnst|\bmr\b|반주/i], [/remix/i, /remix|mix|리믹스/i], [/acoustic/i, /acoustic|어쿠스틱/i], [/[(\[-]\s*live\b|\blive\s*(ver|version)\b|\blive\)/i, /live|라이브/i]];
const verBad = (en, t) => VERS.some(([e, k]) => e.test(en) && !k.test(t));
// 제목 괄호 안 영어(공식 영문 표기)와 전혀 다른 en — '바람 바람 바람 (Windy Windy)'→Summer Rain, '여름이 들려 (Summer Comes)'→Celebrate
const parenEn = t => { const m = /^(.+?)\s*\(([^()]*[A-Za-z][^()]*)\)/.exec(String(t)); if (!m || /[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(m[2])) return []; const p = m[2].trim();
  return /^(feat|ft|prod|with|inst|english|japanese|chinese|korean|remix|live)\b/i.test(p) || /ver\b|ver\.|version|solo|mix|unit|team|remake|reverb|slowed|limited|edit|orchestra|piano|acoustic|\d{4}|&|,|\bmr\b|intro|outro|re-?master|duet|narr|\bwith\b|prod|\bx\b/i.test(p) || /\([^()]*\(/.test(String(t)) ? [] : [p]; };
const owners = [];
for (const [ko, g] of Object.entries(groups)) owners.push({ key: ko, albums: g.discography || [] });
for (const a of artists) if (a.name && (a.discography || []).length) owners.push({ key: a.name.ko, albums: a.discography });
const bad = [];
for (const o of owners) {
  const tracks = [];
  o.albums.forEach(al => (al.tracks || []).forEach(t => { if (t && typeof t === 'object' && t.title) tracks.push({ t, al }); }));
  // 같은 주인 안의 제목 기본형 → 곡 기본형 집합
  const titleOf = new Map();
  tracks.forEach(({ t }) => { const k = B(t.title); if (!titleOf.has(k)) titleOf.set(k, new Set()); titleOf.get(k).add(B(t.title)); });
  const enOfOther = new Map(); // en 기본형 → 원래 제목 기본형들
  tracks.forEach(({ t }) => { if (t.en) { const k = B(t.en); if (!enOfOther.has(k)) enOfOther.set(k, new Set()); enOfOther.get(k).add(B(t.title)); } });
  const check = (title, en, where) => {
    const tb = B(title), eb = B(en); if (!eb || eb === tb) return null;
    const otherTitle = titleOf.has(eb) && !titleOf.get(eb).has(tb);
    const otherEn = enOfOther.has(eb) && [...enOfOther.get(eb)].some(x => x !== tb);
    const ver = VER.test(en) && !VER.test(title);
    if (otherTitle) return '다른 곡 제목과 같음';
    if (otherEn) return '다른 곡의 영문 제목과 같음';
    if (ver) return '다른 판본 이름';
    return null;
  };
  const seen = new Set();
  // 같은 앨범 안에서만 본다(다른 앨범의 같은 곡 다른 판본 — 세븐틴 '칠리'↔'Chilli' — 은 정상)
  o.albums.forEach(al => {
    const ts = (al.tracks || []).filter(t => t && typeof t === 'object' && t.title);
    const tb = ts.map(t => B(t.title)), eb = ts.map(t => t.en ? B(t.en) : '');
    ts.forEach((t, i) => {
      if (!t.en) return; let why = null;
      if (eb[i] && eb[i] !== tb[i] && tb.some((x, j) => j !== i && x === eb[i] && tb[j] !== tb[i])) why = '같은 앨범 다른 곡 제목과 같음';
      else if (eb[i] && eb.some((x, j) => j !== i && x === eb[i] && tb[j] !== tb[i])) why = '같은 앨범 다른 곡과 영문 제목이 같음';
      else if (verBad(t.en, t.title)) why = '다른 판본 이름';
      else { const ps = parenEn(t.title), nz = x => String(x || '').toLowerCase().normalize('NFKC').replace(/[^0-9a-z]/g, ''); if (ps.length && !ps.some(p => { const pb = nz(p), en = nz(t.en); return pb && (en.includes(pb) || pb.includes(en)); })) why = '제목 괄호 영문과 다름'; }
      if (!why) return;
      const k = o.key + '|' + t.title + '|' + t.en; if (seen.has(k)) return; seen.add(k);
      bad.push({ owner: o.key, album: al.title, title: t.title, en: t.en, why, src: 'en' });
    });
  });
}
// 손으로 확인한 별칭 충돌(tools/en_title_manual_remove.json)
try {
  const man = JSON.parse(fs.readFileSync(P('tools/en_title_manual_remove.json'), 'utf8')).remove || [];
  for (const [owner, title, en] of man) if (!bad.some(b => b.owner === owner && b.title === title && b.en === en)) bad.push({ owner, title, en, why: '수동 확인', src: 'alias' });
} catch { }
bad.forEach(b => console.log(`${b.src === 'en' ? '곡' : '별칭'} | ${b.owner} | ${b.album || ''} | ${b.title} → ${b.en} | ${b.why}`));
console.log(`의심 ${bad.length}건 (곡 en ${bad.filter(b => b.src === 'en').length} · 별칭 ${bad.filter(b => b.src === 'alias').length})${APPLY ? ' · 지움' : ' · 읽기 전용'}`);
if (APPLY && bad.length) {
  const rm = new Set(bad.map(b => b.owner + '|' + b.title + '|' + b.en));
  const strip = (key, albums) => albums.forEach(al => (al.tracks || []).forEach(t => { if (t && t.en && rm.has(key + '|' + t.title + '|' + t.en)) delete t.en; }));
  for (const [ko, g] of Object.entries(groups)) strip(ko, g.discography || []);
  for (const a of artists) if (a.name) strip(a.name.ko, a.discography || []);
  for (const b of bad) { const m = AL[b.owner]; if (!m || !m[b.title]) continue; m[b.title] = m[b.title].filter(x => x !== b.en); if (!m[b.title].length) delete m[b.title]; if (!Object.keys(m).length) delete AL[b.owner]; }
  const keep = f => { const raw = fs.readFileSync(P(f), 'utf8'); return { ind: ((/^[[{]\r?\n([ \t]+)/.exec(raw) || [])[1] || '  ').length, crlf: /\r\n/.test(raw.slice(0, 200)) }; };
  for (const [f, obj] of [['groups.json', groups], ['artists.json', artists]]) { const k = keep(f); let s = JSON.stringify(obj, null, k.ind) + '\n'; if (k.crlf) s = s.replace(/\n/g, '\r\n'); fs.writeFileSync(P(f), s); }
  const nl = src.slice(a0, b0).includes('\r\n') ? '\r\n' : '\n';
  const body = Object.keys(AL).sort((x, y) => x.localeCompare(y, 'ko')).map(o => `  ${JSON.stringify(o)}:${JSON.stringify(AL[o])},`).join(nl);
  fs.writeFileSync(P('shared.js'), src.slice(0, a0) + 'const _SONG_ALIASES={' + nl + body + src.slice(b0));
}
