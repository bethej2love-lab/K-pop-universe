-- music_show_wins: 중복 방지 + 관리자 쓰기 정책 (2026-09-11)
--
-- 배경: 음악방송 1위를 매일 루틴에서 자동 수집하게 되면서(admin.js `_ytSweepMusicShowWins`)
-- 이 테이블이 **처음으로 앱에서 INSERT 대상**이 됐다. 그전까지는 SQL 에디터 전용이었다.
--
-- 실측(2026-09-11, anon publishable 키):
--   · 읽기: music_show_wins 2,626행 / melon_yearly_top100 799행 / spotify_streaming_milestones 455행 — 정상 공개
--   · 익명 쓰기: 세 테이블 모두 빈 INSERT가 42501(RLS 차단) — **이미 잠겨 있다**
-- 즉 보안 쪽은 손댈 게 없다. 문제는 반대쪽이다: 익명이 막힌 건 확인했지만 **관리자(authenticated +
-- admin 이메일)가 INSERT할 수 있는 정책이 있는지는 확인되지 않았다**. select 정책만 있고 insert
-- 정책이 없으면 수집 버튼이 0건 저장으로 조용히 끝난다(admin_bulk_snapshots 전례, 2026-08-22).
--
-- ⚠️ 그래서 이 파일은 **두 부분**이다. 1번은 무조건 실행해도 안전하고, 2번은 아래 진단 결과를 보고
--    "admin insert 정책이 없을 때만" 실행한다. 이미 있는데 또 만들면 이름만 다른 중복 정책이 쌓인다.

-- ── 0) 진단 — 먼저 이것만 실행해서 결과를 확인할 것 ─────────────────────────────
select policyname, cmd, roles, qual, with_check
from pg_policies
where tablename = 'music_show_wins'
order by cmd, policyname;
-- cmd에 INSERT(또는 ALL)가 있고 with_check가 관리자 이메일을 보는 정책이 있으면 → 2번은 건너뛴다.
-- SELECT 정책만 보이면 → 2번을 실행한다.


-- ── 1) 중복 방지 — 이건 그냥 실행해도 된다 ──────────────────────────────────────
-- 같은 (방송·날짜·그룹·멤버)는 한 번의 수상이다. 지금까지 유니크 제약이 **PK(id)뿐**이라
-- tools/wiki_music_wins.mjs의 `ON CONFLICT DO NOTHING`은 걸릴 제약이 없어 사실상 no-op였다.
-- (실측: 지금 중복 0건 — 스크립트가 코드에서 dedup해온 덕분이지 DB가 막아준 게 아니다. 그래서
--  중복 0건인 지금이 인덱스를 걸 수 있는 시점이다. 중복이 있으면 이 문장이 에러로 알려준다.)
-- member_ko가 NULL이면 유니크 비교에서 빠지므로 coalesce로 빈 문자열을 씌운다.
create unique index if not exists music_show_wins_uniq
  on public.music_show_wins (show, win_date, group_ko, (coalesce(member_ko, '')));


-- ── 2) 관리자 쓰기 정책 — 위 진단에 INSERT 정책이 없을 때만 ──────────────────────
-- 조건식은 yt_channel_videos·search_click_log의 admin write와 같은 것을 쓴다.
-- (읽기 정책은 건드리지 않는다 — 이미 공개로 잘 돌고 있고, 잘못 손대면 로그아웃 방문자에게
--  그룹 카드 트로피가 통째로 사라진다.)
--
-- create policy "admin insert" on public.music_show_wins
--   for insert to authenticated
--   with check ((auth.jwt() ->> 'email'::text) = 'bethej2love@gmail.com'::text);
--
-- -- 수집 결과를 되돌리는 버튼("↩︎ 방금 넣은 1위 되돌리기")이 delete를 쓴다.
-- create policy "admin delete" on public.music_show_wins
--   for delete to authenticated
--   using ((auth.jwt() ->> 'email'::text) = 'bethej2love@gmail.com'::text);


-- ── 3) 실행 뒤 확인 ─────────────────────────────────────────────────────────────
-- (1) 정책 목록 다시 조회 — INSERT/DELETE가 관리자 조건으로 보이면 된 것.
-- (2) 관리자로 로그인한 브라우저에서 "🏆 음악방송 1위 수집" 버튼을 누르고, 진행 문구가
--     "N건 추가"로 끝나는지 확인. "0건 저장됨 — 쓰기 권한(RLS) 확인 필요"가 뜨면 2번이 안 걸린 것.
-- (3) 로그아웃 상태에서 아무 그룹 카드나 열어 트로피(🏆)가 그대로 보이는지 확인(읽기 회귀 없음).
