-- 2026 연말 투표 (2026-11-21 준비 — **아직 실행 안 함**, 사용자 확정 뒤 실행)
-- ① yearend_votes: 한 사람이 부문마다 한 표. 다시 누르면 고른 영상이 바뀐다(표가 늘지 않음). 본인 줄만 쓰고, **읽기 정책 없음**(누가 뭘 찍었는지 아무도 못 읽는다).
-- ② get_yearend_tally(연도, 부문): 영상별 득표수만 돌려준다. 3표 미만 영상은 숨긴다.
-- 앱은 표/함수가 없으면 투표 입구를 아예 안 보여준다.

create table if not exists public.yearend_votes (
  user_id uuid not null default auth.uid(),
  yr int not null,
  category text not null check (category in ('fancam','stage','mv')),
  video_id text not null check (char_length(video_id) between 5 and 20),
  created_at timestamptz not null default now(),
  primary key (user_id, yr, category)
);
create index if not exists yearend_votes_tally_idx on public.yearend_votes (yr, category, video_id);
alter table public.yearend_votes enable row level security;
drop policy if exists yearend_votes_insert_own on public.yearend_votes;
create policy yearend_votes_insert_own on public.yearend_votes for insert to anon, authenticated with check (user_id = auth.uid());
drop policy if exists yearend_votes_update_own on public.yearend_votes;
create policy yearend_votes_update_own on public.yearend_votes for update to anon, authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists yearend_votes_select_own on public.yearend_votes;
create policy yearend_votes_select_own on public.yearend_votes for select to anon, authenticated using (user_id = auth.uid());
revoke all on public.yearend_votes from anon, authenticated;
grant select, insert, update on public.yearend_votes to anon, authenticated;

create or replace function public.get_yearend_tally(p_yr int, p_category text)
returns table(video_id text, cnt int)
language sql stable security definer set search_path = public as $$
  select video_id, count(*)::int as cnt
  from yearend_votes
  where yr = p_yr and category = p_category
  group by video_id
  having count(*) >= 3
  order by cnt desc, video_id
  limit 50;
$$;
revoke all on function public.get_yearend_tally(int, text) from public;
grant execute on function public.get_yearend_tally(int, text) to anon, authenticated;

-- 되돌리기: drop function public.get_yearend_tally(int, text); drop table public.yearend_votes;
