// 공연장 이름 표준화 (일회용) — kpop-universe.kr 에 admin으로 로그인한 상태에서 F12 콘솔에 붙여넣기.
//
// KOPIS 목록 API는 공연장을 시설 단위로만 줘서 '올림픽공원' 153건이 한 덩어리였다.
// 상세 API로 홀 이름을 복구해 '올림픽공원 체조경기장 / 올림픽홀 / 핸드볼경기장' 으로 쪼갠다.
// (title, date_start) 로 행을 찾는다. 이미 표준 이름이면 건너뛴다.
(async () => {
  const URL = 'https://raw.githubusercontent.com/bethej2love-lab/K-pop-universe/main/events_venue_fix.json?t=' + Date.now();
  const rows = await (await fetch(URL)).json();
  console.log('바꿀 공연', rows.length, '건');

  const sb = window.sb;
  if (!sb) { console.error('sb 없음 — 로그인 상태로 kpop-universe.kr 에서 실행해라'); return; }

  let ok = 0, skip = 0, fail = 0;
  const CONC = 5;
  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC);
    await Promise.all(batch.map(async r => {
      const { data, error } = await sb.from('kpop_events')
        .update({ venue: r.venue })
        .eq('title', r.title).eq('date_start', r.date_start).eq('venue', r.from)
        .select('id');
      if (error) { fail++; console.warn('실패', r.title, error.message); }
      else if (!data || !data.length) skip++;
      else ok += data.length;
    }));
    if ((i + CONC) % 100 < CONC) console.log(`${Math.min(i + CONC, rows.length)}/${rows.length} — 수정 ${ok} 건너뜀 ${skip} 실패 ${fail}`);
  }
  console.log(`완료 — 수정 ${ok} · 건너뜀(이미 바뀜/행없음) ${skip} · 실패 ${fail}`);
})();
