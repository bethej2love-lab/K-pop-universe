-- yt_view_milestones: RLS 정책 추가 (2026-09-23)
--
-- 배경: yt_view_milestones 테이블(view_milestones_migration.sql, 오늘 이미 실행됨)에 RLS 정책을
-- 하나도 안 걸어뒀다. Supabase는 새 테이블에 기본으로 RLS가 켜져 있고 정책이 없으면 "전체 차단"이라
-- (anon도 admin도 읽기·쓰기 전부 막힘), 지금 상태로는:
--   · 시딩 버튼(sp-vm-seed-btn)이 view_milestone_tier 컬럼은 채우는데(83,480건 실측 확인) — 이건
--     yt_channel_videos 테이블이라 RLS가 이미 정상이었음
--   · 같은 요청의 yt_view_milestones INSERT는 **조용히 42501로 실패** — 트로피 데이터가 하나도 안 쌓임
--   · 트로피 패널(index.html)이 일반 방문자에게 이 데이터를 보여주려 해도 anon SELECT가 0행이라 전부 빈 탭
--
-- 실측(2026-09-23, anon publishable 키로 직접 확인):
--   · SELECT: yt_view_milestones content-range */0 (RLS 차단, 행이 없는 게 아니라 정책이 없어서 안 보임)
--   · INSERT: 테스트 행 하나 넣어보니 42501 "new row violates row-level security policy" 즉시 확인
--
-- music_show_wins가 똑같은 모양(공개 읽기 + 관리자 전용 쓰기)이라 그 정책을 그대로 옮겨온다
-- (music_show_wins_rls_migration.sql 참고 — "정책을 새로 만들지 말 것"은 거기 얘기고, 여긴 애초에
-- 정책 자체가 없는 새 테이블이라 새로 만드는 게 맞다).

alter table public.yt_view_milestones enable row level security;

create policy "yt_view_milestones 전체 읽기 허용"
  on public.yt_view_milestones
  for select
  to public
  using (true);

create policy "yt_view_milestones 관리자만 쓰기"
  on public.yt_view_milestones
  for all
  to public
  using (
    current_setting('request.jwt.claims', true) is null
    or (auth.jwt() ->> 'email') = 'bethej2love@gmail.com'
  )
  with check (
    current_setting('request.jwt.claims', true) is null
    or (auth.jwt() ->> 'email') = 'bethej2love@gmail.com'
  );

-- ── 백필 — 이미 처리된 행의 로그를 SQL로 직접 채움 ─────────────────────────────────
-- 시딩 버튼(_ytSeedViewMilestones)은 view_milestone_tier가 이미 채워진 행을 대상에서 뺀다(중복 방지
-- 설계) — 그런데 위 RLS가 막혀있는 동안 이미 83,480+건이 "컬럼은 채워졌지만 로그 행은 없는" 상태로
-- 굳어버렸다. 이 행들은 앞으로 버튼을 다시 눌러도 대상에 안 걸리므로(설계상 정상 동작), 딱 이번만
-- SQL로 직접 채운다. SQL 에디터는 RLS를 안 타므로(서비스 롤) 위 정책 생성 직후 바로 실행해도 된다.
insert into public.yt_view_milestones (video_id, group_ko, tier, crossed_at, seeded)
select id, group_ko, view_milestone_tier, current_date, true
from public.yt_channel_videos
where view_milestone_tier is not null and group_ko is not null
on conflict (video_id, tier) do nothing;

-- ── 실행 뒤 확인 ─────────────────────────────────────────────────────────────
-- (1) 정책이 잘 걸렸는지:
--       select policyname, cmd, roles from pg_policies where tablename = 'yt_view_milestones';
--     → 위 두 정책 이름이 나오면 된 것.
-- (2) 백필이 됐는지:
--       select count(*) from yt_view_milestones;
--     → view_milestone_tier가 채워진 행 수와 비슷하게 나오면 된 것(실행 시점 기준 83,480+건).
-- (3) 관리자로 로그인한 브라우저에서 "🏆 조회수 마일스톤 시딩" 버튼을 다시 눌러도 안전합니다 —
--     이제부터는 view_milestone_tier가 없는(아직 100만 미만이거나 새로 들어온) 행만 마저 처리되고,
--     이번엔 로그 INSERT도 같이 성공합니다(RLS 정책이 생겼으므로).
-- (4) 앞으로 순환 갱신(cold·hot)이 새로 감지하는 크로싱도 이제부터 정상적으로 yt_view_milestones에
--     쌓입니다 — 지금까지는 이것도 RLS에 막혀 조용히 실패하고 있었습니다.
