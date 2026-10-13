-- 사용자 지표(2026-10-13) — 진단 보고서 7번 지표를 실측값으로. GA는 우리가 못 읽어서 같은 이벤트를 여기에도 쌓는다.
-- 앱(index.html _gaEvent → _appEvent)이 익명 계정 포함 본인 행만 insert. 읽기는 어드민 RPC로만.
create table if not exists public.app_events(
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  ev text not null,
  k text,
  created_at timestamptz not null default now()
);
create index if not exists app_events_time on public.app_events(created_at);
create index if not exists app_events_user_time on public.app_events(user_id, created_at);
alter table public.app_events enable row level security;
drop policy if exists app_events_insert_own on public.app_events;
create policy app_events_insert_own on public.app_events for insert to anon, authenticated with check (user_id = auth.uid());
grant insert on public.app_events to anon, authenticated;
grant usage on sequence public.app_events_id_seq to anon, authenticated;

-- 관리자 홈 지표 카드용. p_days 기간 안의 "이 기기 첫 방문자(visit k='new')"를 기준으로 센다.
create or replace function public.get_app_metrics(p_days int default 7)
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'bethej2love@gmail.com' then raise exception 'admin only'; end if;
  with newbies as (
    select user_id, min(created_at) as t0 from app_events
    where ev = 'visit' and k = 'new' and created_at >= now() - make_interval(days => p_days)
    group by user_id
  ),
  first_day as (
    select n.user_id,
      bool_or(e.ev in ('view_group','view_member','video_play','search','favorite_group','favorite_member','explore_open','shelf_click')) as acted,
      bool_or(e.ev in ('save_collection','save_scrap') or (e.ev in ('favorite_group','favorite_member') and e.k = 'add')) as saved,
      bool_or(e.ev in ('deeplink_open','story_to_app')) as via_link
    from newbies n join app_events e on e.user_id = n.user_id and e.created_at < n.t0 + interval '1 day'
    group by n.user_id
  ),
  depth as (
    select user_id, date_trunc('day', created_at) d,
      count(*) filter (where ev in ('view_group','view_member','video_play')) c
    from app_events where created_at >= now() - make_interval(days => p_days)
    group by 1, 2
  ),
  cohort as (
    select user_id, min(created_at) as t0 from app_events
    where ev = 'visit' and k = 'new'
      and created_at >= now() - make_interval(days => p_days + 7) and created_at < now() - interval '7 days'
    group by user_id
  ),
  ret as (
    select c.user_id, exists(select 1 from app_events e where e.user_id = c.user_id and e.ev = 'visit'
      and e.created_at >= c.t0 + interval '20 hours' and e.created_at < c.t0 + interval '8 days') as back
    from cohort c
  )
  select json_build_object(
    'days', p_days,
    'visitors', (select count(distinct user_id) from app_events where ev = 'visit' and created_at >= now() - make_interval(days => p_days)),
    'new_visitors', (select count(*) from newbies),
    'first_action_rate', (select round(100.0 * avg(acted::int), 1) from first_day),
    'save_rate', (select round(100.0 * avg(saved::int), 1) from first_day),
    'depth_median', (select percentile_cont(0.5) within group (order by c) from depth where c > 0),
    'retention7_cohort', (select count(*) from ret),
    'retention7_rate', (select round(100.0 * avg(back::int), 1) from ret),
    'shares', (select count(*) from app_events where ev = 'share_card' and created_at >= now() - make_interval(days => p_days)),
    'link_new_visitors', (select count(*) from first_day where via_link)
  ) into r;
  return r;
end $$;
revoke all on function public.get_app_metrics(int) from public, anon;
grant execute on function public.get_app_metrics(int) to authenticated;
