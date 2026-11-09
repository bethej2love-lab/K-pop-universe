// 멜론 곡 대조 공용 규칙 (2026-11-09, Codex 검수 191~193차 후속)
//
// 왜: 수록곡·곡 번호를 채우는 도구들이 각자 같은 판정을 들고 있다가 같은 사고를 냈다.
//  ① 191차 — 곡 번호 채우기(melon_link_backfill)가 이미 번호가 있는 곡을 "사용 중"으로 안 넣고, 제목이 안 맞으면 곡 수가 같다는
//     이유만으로 **순서대로** 번호를 붙였다. 라이즈 Fame: Love Song에 Fame 번호, Fame (Inst.)에 Sticky Like 번호.
//  ② 193차 — 비교 문자열이 영문·숫자·한글만 남겨서 일본어·중국어 곡명은 **빈 문자열**이 되고, 빈 것끼리 같은 곡으로 쳤다
//     (SM THE BALLAD 일본어 Blind에 중국어판 번호, 트리플에스 ヘッドフォン에 다른 판 번호).
//  ③ 192차 — 수록곡 보충(melon_track_refill)이 같은 곡 번호면 **기존 제목을 우선**해 틀린 제목이 계속 남았다
//     (RIIZING : Epilogue의 Breathe Easy = 공식 Honestly).
// 원칙: 빈 이름끼리는 같은 곡이 아니다. 순서 대조는 제목이 **하나도** 안 맞을 때만(한국어 목록 ↔ 영어 목록처럼 표기 언어가 통째로 다를 때).
//       같은 문자 체계인데 제목이 다르면 멜론 공식 제목, 언어가 다른 표기(ヘッドフォン ↔ Headphones)는 번역이라 그대로 둔다.

// 괄호 부제를 떼고 글자·숫자만(모든 언어) — 일본어·중국어도 비교된다
export const tnormU = s => String(s || '').toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
// 표기 언어(문자 체계) — 한글/일본어·한자/라틴
export const scriptOf = s => /[가-힣]/.test(s || '') ? 'ko' : /[ぁ-んァ-ヶ一-龯]/.test(s || '') ? 'cjk' : 'latin';

// 우리 수록곡(tracks)에 멜론 곡 줄(rows: [{title, songId}], 곡 순서 그대로)의 곡 번호를 단다. tracks를 직접 고친다.
// 돌려주는 것: {filled, positional, unmatched: [제목]}
export function assignSongIds(tracks, rows, norm = tnormU) {
  const res = { filled: 0, positional: 0, unmatched: [] };
  if (!Array.isArray(tracks) || !Array.isArray(rows) || !rows.length) return res;
  const used = new Set(tracks.map(t => t && t.songId).filter(Boolean)); // 이미 붙은 번호는 예약
  const hadIds = used.size > 0;
  let titleHits = 0;
  tracks.forEach(t => {
    if (!t || t.songId) return;
    const tn = norm(t.title);
    if (!tn) return; // 빈 이름끼리는 같은 곡이 아니다
    const r = rows.find(x => !used.has(x.songId) && norm(x.title) === tn);
    if (r) { t.songId = r.songId; used.add(r.songId); res.filled++; titleHits++; }
  });
  // 순서 대조 — 제목이 하나도 안 맞았고(표기 언어가 통째로 다름), 곡 수가 같고, 원래 번호가 하나도 없을 때만
  if (!titleHits && !hadIds && rows.length === tracks.length) {
    tracks.forEach((t, i) => { if (t && !t.songId && rows[i] && !used.has(rows[i].songId)) { t.songId = rows[i].songId; used.add(rows[i].songId); res.filled++; res.positional++; } });
  }
  tracks.forEach(t => { if (t && !t.songId) res.unmatched.push(t.title); });
  return res;
}

// 수록곡 보충 — 멜론 공식 목록(rows: [{no,title,songId,isTitle}]) 순서로 다시 짜되 기존 곡의 songId·크레딧(cr)·현지 표기는 살린다.
// 돌려주는 것: {tracks, retitled: [{from,to,songId}]}
export function mergeRefillTracks(cur, rows, norm = tnormU) {
  const used = new Set(), retitled = [];
  const tracks = rows.map(p => {
    const k = cur.findIndex((o, i) => !used.has(i) && ((o.songId && o.songId === p.songId) || (norm(o.title) && norm(o.title) === norm(p.title))));
    const o = k >= 0 ? (used.add(k), cur[k]) : {};
    let title = o.title || p.title;
    // 같은 곡 번호인데 같은 문자 체계로 다른 제목이면 기존 제목이 틀린 것 — 공식 제목으로(언어가 다르면 번역 표기라 그대로)
    if (o.title && o.songId && o.songId === p.songId) {
      const a = norm(o.title), b = norm(p.title);
      if (a && b && a !== b && !a.includes(b) && !b.includes(a) && scriptOf(o.title) === scriptOf(p.title)) { title = p.title; retitled.push({ from: o.title, to: p.title, songId: p.songId }); }
    }
    return { ...p, ...o, title, no: p.no, isTitle: !!(p.isTitle || o.isTitle), ...(p.songId || o.songId ? { songId: o.songId || p.songId } : {}) };
  });
  return { tracks, retitled };
}
