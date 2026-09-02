-- 검색 클릭 로그 (2026-09-02)
--
-- 왜: 지금 GA에는 검색어만 남고 **무엇을 클릭했는지는 어디에도 안 남는다**. "카"를 친 사람이
-- 카리나를 골랐는지 카이를 골랐는지 모르니, "실제 검색 데이터로 유명도를 반영"하려 해도 재료가 없다.
-- 태깅 쪽 tag_edit_log("사람의 정답 라벨을 버리지 말자")와 같은 구조 — 처음엔 쌓기만 하고,
-- 몇 주 뒤 충분히 모이면 그때 랭킹 타이브레이커에 반영한다.
--
-- ⚠️ 이 SQL은 **정책까지 한 번에 실행된다**. admin_bulk_snapshots는 정책 두 줄이 주석인 채로
--    배포돼서 되돌리기가 2026-08-22부터 2026-09-02까지 한 번도 작동하지 않았다(테이블은 있는데
--    RLS만 켜지고 정책이 0개라 모든 접근이 조용히 차단됐고, insert 실패가 안내 문구로만 스쳐
--    아무도 몰랐다). 같은 실수를 반복하지 않으려고 주석 처리된 줄을 두지 않는다.
--
-- 실행 후 확인: 앱에서 검색 → 결과 클릭 → `select * from search_click_log order by created_at desc limit 5;`
-- 행이 실제로 쌓이는 걸 눈으로 볼 것. 안 쌓이면 정책 문제다(코드는 실패해도 조용히 넘어간다).

create table if not exists search_click_log (
  id          bigint generated always as identity primary key,
  q           text        not null,           -- 검색어(사용자가 친 그대로, 앞뒤 공백만 정리)
  hit_type    text        not null,           -- 'group' | 'member' | 'song' | 'video' | 'event'
  hit_key     text        not null,           -- 클릭한 항목 식별자(그룹 ko / 멤버 "이름|그룹" / 곡 제목 등)
  hit_rank    int,                            -- 그 항목이 결과 목록에서 몇 번째였는지(0부터)
  hit_total   int,                            -- 그때 결과가 총 몇 개였는지(순위의 의미를 해석하려면 필요)
  session_id  text,                           -- 익명 세션(localStorage 랜덤 UUID, 로그인과 무관)
  created_at  timestamptz not null default now()
);

create index if not exists idx_scl_q       on search_click_log (q);
create index if not exists idx_scl_created on search_click_log (created_at desc);
create index if not exists idx_scl_hit     on search_click_log (hit_type, hit_key);

alter table search_click_log enable row level security;

-- 쓰기: 로그인하지 않은 방문자도 검색하므로 anon도 남길 수 있어야 한다. 읽기는 주지 않는다
-- (남이 무엇을 검색했는지 아무나 조회할 수 있으면 안 된다). insert 전용 정책.
drop policy if exists "anyone can log" on search_click_log;
create policy "anyone can log" on search_click_log
  for insert to anon, authenticated
  with check (
    length(q) between 1 and 100
    and hit_type in ('group','member','song','video','event')
    and length(hit_key) <= 200
    and (session_id is null or length(session_id) <= 64)
  );

-- 읽기·삭제: 관리자만(yt_channel_videos의 admin write 정책과 동일 조건).
drop policy if exists "admin read" on search_click_log;
create policy "admin read" on search_click_log
  for select to authenticated
  using ((auth.jwt() ->> 'email'::text) = 'bethej2love@gmail.com'::text);

drop policy if exists "admin delete" on search_click_log;
create policy "admin delete" on search_click_log
  for delete to authenticated
  using ((auth.jwt() ->> 'email'::text) = 'bethej2love@gmail.com'::text);

-- 확인용 — 아래가 정책 3개(anyone can log / admin read / admin delete)를 뱉으면 켜진 것.
select policyname, cmd, roles from pg_policies where tablename = 'search_click_log' order by policyname;
