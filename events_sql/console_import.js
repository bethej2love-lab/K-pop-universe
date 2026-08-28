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
 *   - kpop_events 에서 기존 행을 조회해 (title, date_start)로 중복을 제외한다
 *     ⚠️ 예전엔 venue도 키에 넣었는데, 공연장 이름을 홀 단위로 표준화하면서(2026-08-28)
 *        DB의 '올림픽공원 체조경기장'과 KOPIS가 주는 '올림픽공원'이 안 맞아 같은 공연이
 *        새 행으로 다시 들어간다. 같은 팀이 같은 날 다른 공연장에 설 수는 없으므로 뺐다.
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

  var cur = await sb.from("kpop_events").select("title,date_start");
  if (cur.error) { console.error("기존 행 조회 실패:", cur.error.message); return; }

  var key = function (x) { return x.title + "|" + x.date_start; };
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
