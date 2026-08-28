/* 공연장 이름 표준화 (일회용)
 *
 * 쓰는 법
 *   1) kpop-universe.kr 에 관리자로 로그인
 *   2) F12 → Console
 *   3) 콘솔에  allow pasting  이라고 타이핑 후 Enter (크롬 self-XSS 방지)
 *   4) 이 파일 내용을 전부 복사해 붙여넣고 Enter
 *
 * 하는 일
 *   - events_venue_fix.json(564건)을 레포에서 받아온다
 *   - (title, date_start, 기존 venue)로 행을 찾아 venue만 표준 이름으로 바꾼다
 *   - 읽고 쓰는 대상은 kpop_events 하나뿐. 다른 컬럼은 안 건드린다
 *
 * 왜 필요한가
 *   KOPIS 목록 API는 공연장을 시설 단위로만 줘서 "올림픽공원" 하나에 153건이 뭉쳐 있었다.
 *   상세 API로 홀 이름을 되살려 체조경기장 / 올림픽홀 / 핸드볼경기장 으로 쪼갠다.
 *
 * 여러 번 실행해도 안전하다(이미 바뀐 행은 안 걸려서 건너뛴다).
 *
 * 주의: 코드부에 작은따옴표를 안 쓴다 — 마크다운에서 복사하면 스마트쿼트로 바뀌어 깨진다.
 */
(async () => {
  var RAW = "https://raw.githubusercontent.com/bethej2love-lab/K-pop-universe/main/events_venue_fix.json";
  var res = await fetch(RAW + "?t=" + Date.now());
  if (!res.ok) { console.error("데이터 다운로드 실패:", res.status); return; }
  var rows = await res.json();
  console.log("바꿀 공연 " + rows.length + "건");

  var okCount = 0, skipCount = 0, failCount = 0;
  var CONC = 5;
  for (var i = 0; i < rows.length; i += CONC) {
    var batch = rows.slice(i, i + CONC);
    await Promise.all(batch.map(async function (r) {
      var out = await sb.from("kpop_events")
        .update({ venue: r.venue })
        .eq("title", r.title).eq("date_start", r.date_start).eq("venue", r.from)
        .select("id");
      if (out.error) { failCount++; console.warn("실패:", r.title, out.error.message); }
      else if (!out.data || !out.data.length) skipCount++;
      else okCount += out.data.length;
    }));
    if ((i + CONC) % 100 < CONC) {
      console.log(Math.min(i + CONC, rows.length) + "/" + rows.length +
        " — 수정 " + okCount + " · 건너뜀 " + skipCount + " · 실패 " + failCount);
    }
  }
  console.log("완료 — 수정 " + okCount + " · 건너뜀(이미 바뀜/행없음) " + skipCount + " · 실패 " + failCount);
})();
