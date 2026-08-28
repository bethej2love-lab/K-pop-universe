/* KOPIS 공연 데이터 import — 관리자 브라우저 콘솔용 (2026-08-28)
 *
 * 쓰는 법
 *   1) kpop-universe.kr 에 관리자 계정으로 로그인된 상태로 접속
 *   2) F12 → Console
 *   3) 콘솔에  allow pasting  이라고 타이핑 후 Enter (크롬 self-XSS 방지)
 *   4) 이 파일 내용을 전부 복사해 붙여넣고 Enter
 *
 * 하는 일
 *   - 네 GitHub 레포의 events_import.json(공연 670건)을 받아온다
 *   - kpop_events 에서 기존 행을 조회해 (title, date_start, venue)로 중복을 제외한다
 *   - 남은 것만 100건씩 insert 한다. 에러가 나면 그 자리에서 멈추고 메시지를 찍는다
 *   - 읽고 쓰는 대상은 kpop_events 하나뿐. 외부로 아무것도 보내지 않는다
 *
 * 여러 번 실행해도 안전하다(이미 있는 건 건너뛴다).
 */
(async () => {
  var RAW = "https://raw.githubusercontent.com/bethej2love-lab/K-pop-universe/main/events_import.json";
  var res = await fetch(RAW + "?t=" + Date.now());
  if (!res.ok) { console.error("데이터 다운로드 실패:", res.status); return; }
  var rows = await res.json();

  var cur = await sb.from("kpop_events").select("title,date_start,venue");
  if (cur.error) { console.error("기존 행 조회 실패:", cur.error.message); return; }

  var key = function (x) { return x.title + "|" + x.date_start + "|" + x.venue; };
  var seen = new Set((cur.data || []).map(key));
  var todo = rows.filter(function (x) { return !seen.has(key(x)); });
  console.log("전체 " + rows.length + " · 이미 있음 " + (rows.length - todo.length) + " · 넣을 것 " + todo.length);
  if (!todo.length) { console.log("추가할 것이 없습니다."); return; }

  var done = 0;
  for (var i = 0; i < todo.length; i += 100) {
    var batch = todo.slice(i, i + 100);
    var r = await sb.from("kpop_events").insert(batch);
    if (r.error) {
      console.error("중단 (" + done + "건까지 완료) — " + r.error.message);
      console.error("실패한 배치의 첫 행:", batch[0]);
      return;
    }
    done += batch.length;
    console.log("  " + done + "/" + todo.length);
  }
  console.log("완료 ✅ " + done + "건 추가");
})();
