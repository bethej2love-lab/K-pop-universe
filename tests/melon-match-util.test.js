// 멜론 곡 대조 공용 규칙 회귀 (2026-11-09, Codex 검수 191~193차)
// 실행: node tests/melon-match-util.test.js
(async () => {
  const { tnormU, assignSongIds, mergeRefillTracks } = await import('../tools/melon_match_util.mjs');
  let pass = true;
  const ck = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };
  const ids = ts => ts.map(t => t.songId || '-').join(',');

  // 193차 — 일본어·중국어 곡명은 빈 문자열이 되면 안 된다
  ck(tnormU('僕のせいだよ (Blind)') === '僕のせいだよ' && tnormU('太貪心 (Blind)') === '太貪心', '일본어·중국어 곡명이 비교 문자열로 남는다');
  { // SM THE BALLAD Breath — 일본어 Blind는 4450172, 중국어 Blind는 4450174
    const rows = [{ title: '僕のせいだよ (Blind)', songId: '4450172' }, { title: '呼吸 (Breath)', songId: '4450173' }, { title: '太貪心 (Blind)', songId: '4450174' }];
    const tr = [{ title: '僕のせいだよ (Blind)' }, { title: '太貪心 (Blind)' }];
    assignSongIds(tr, rows);
    ck(tr[0].songId === '4450172' && tr[1].songId === '4450174', '일본어 Blind ↔ 중국어 Blind 번호가 섞이지 않음');
  }
  { // 빈 이름끼리는 같은 곡 아님
    const tr = [{ title: '♡' }];
    assignSongIds(tr, [{ title: '★', songId: '1' }, { title: 'X', songId: '2' }]);
    ck(!tr[0].songId, '기호뿐인 제목끼리 같은 곡으로 안 붙임');
  }

  // 191차 — 라이즈 Fame: 기존 번호 예약 + 일부만 맞으면 순서 대조 금지
  { const rows = [{ title: "Something's in the Water", songId: '600552359' }, { title: 'Fame', songId: '600552360' }, { title: 'Sticky Like', songId: '600552361' }];
    const tr = [{ title: 'Fame', songId: '600552360' }, { title: 'Love Song' }, { title: 'Fame (Inst.)' }];
    const r = assignSongIds(tr, rows);
    ck(ids(tr) === '600552360,-,-', 'Fame: 기존 번호를 Love Song에 재사용하지 않고, Fame (Inst.)에 Sticky Like 번호를 순서로 붙이지 않음 → ' + ids(tr));
    ck(r.unmatched.length === 2, '못 맞춘 2곡은 보고 목록으로'); }
  { // 제목이 하나도 안 맞으면(표기 언어가 통째로 다름) 순서 대조는 그대로 한다
    const rows = [{ title: 'Love Dive', songId: '1' }, { title: 'Royal', songId: '2' }];
    const tr = [{ title: '러브 다이브' }, { title: '로얄' }];
    const r = assignSongIds(tr, rows);
    ck(ids(tr) === '1,2' && r.positional === 2, '한글 목록 ↔ 영어 목록은 순서로 번호');
  }

  // 192차 — RIIZING : Epilogue 같은 번호의 틀린 제목은 공식 제목으로, 번역 표기는 보존
  { const rows = [{ no: 6, title: 'Honestly', songId: '37956041' }, { no: 7, title: 'One Kiss', songId: '37956042' }];
    const cur = [{ no: 1, title: 'Breathe Easy', songId: '37956041', cr: { l: ['x'] } }, { no: 2, title: 'Run to You', songId: '37956042' }];
    const m = mergeRefillTracks(cur, rows);
    ck(m.tracks[0].title === 'Honestly' && m.tracks[1].title === 'One Kiss', '같은 번호의 틀린 제목 → 공식 제목');
    ck(m.tracks[0].cr && m.tracks[0].cr.l[0] === 'x' && m.retitled.length === 2, '크레딧은 보존, 정정 2건 보고'); }
  { const m = mergeRefillTracks([{ no: 1, title: 'ヘッドフォン', songId: '600151052' }], [{ no: 1, title: 'Headphones', songId: '600151052' }]);
    ck(m.tracks[0].title === 'ヘッドフォン' && !m.retitled.length, '언어가 다른 표기(ヘッドフォン↔Headphones)는 번역이라 그대로'); }
  { const m = mergeRefillTracks([{ no: 1, title: 'HONESTLY', songId: '1' }], [{ no: 1, title: 'Honestly', songId: '1' }]);
    ck(m.tracks[0].title === 'HONESTLY' && !m.retitled.length, '대소문자만 다른 현지 표기는 보존'); }

  console.log(pass ? '\n✅ 멜론 곡 대조 규칙 테스트 통과' : '\n❌ 실패 있음');
  process.exit(pass ? 0 : 1);
})();
