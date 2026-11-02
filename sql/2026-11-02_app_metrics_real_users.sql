-- 사용자 지표에서 자동 테스트·로봇 빼기(2026-11-02, Claude Code가 Management API로 실행함)
-- 실측: 최근 30일 app_events 사용자 3,478명 중 3,410명이 헤드리스 브라우저(auth.sessions.user_agent에 HeadlessChrome) —
--   우리·Codex 브라우저 테스트가 실서비스에 붙을 때마다 익명 계정이 새로 생겨 "첫 방문자"로 찍혔다. 진짜 사람은 약 60명.
-- 앞으로는 앱이 자동 브라우저(navigator.webdriver·헤드리스 UA)에선 이벤트를 안 보낸다(app.js _kpuAutomated).
-- 이 함수는 지난 기록에서도 그런 계정을 빼고 센다(세션 user_agent 기준). + 30일 방문자·정착(30일 중 서로 다른 2주 이상 방문 = 북극성 지표).
create or replace function public.get_app_metrics(p_days int default 7)
returns json language plpgsql stable security definer set search_path = public as $$
declare r json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'bethej2love@gmail.com' then raise exception 'admin only'; end if;
  with bots as (
    select distinct user_id from auth.sessions
    where user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)'
  ),
  ae as materialized (
    select e.* from app_events e
    where e.created_at >= now() - make_interval(days => greatest(p_days + 7, 30))
      and not exists (select 1 from bots b where b.user_id = e.user_id)
  ),
  newbies as (
    select user_id, min(created_at) as t0 from ae
    where ev = 'visit' and k = 'new' and created_at >= now() - make_interval(days => p_days)
    group by user_id
  ),
  first_day as (
    select n.user_id,
      bool_or(e.ev in ('view_group','view_member','video_play','search','favorite_group','favorite_member','explore_open','shelf_click')) as acted,
      bool_or(e.ev in ('save_collection','save_scrap') or (e.ev in ('favorite_group','favorite_member') and e.k = 'add')) as saved,
      bool_or(e.ev in ('deeplink_open','story_to_app')) as via_link
    from newbies n join ae e on e.user_id = n.user_id and e.created_at < n.t0 + interval '1 day'
    group by n.user_id
  ),
  depth as (
    select user_id, date_trunc('day', created_at) d,
      count(*) filter (where ev in ('view_group','view_member','video_play')) c
    from ae where created_at >= now() - make_interval(days => p_days)
    group by 1, 2
  ),
  cohort as (
    select user_id, min(created_at) as t0 from ae
    where ev = 'visit' and k = 'new'
      and created_at >= now() - make_interval(days => p_days + 7) and created_at < now() - interval '7 days'
    group by user_id
  ),
  ret as (
    select c.user_id, exists(select 1 from ae e where e.user_id = c.user_id and e.ev = 'visit'
      and e.created_at >= c.t0 + interval '20 hours' and e.created_at < c.t0 + interval '8 days') as back
    from cohort c
  ),
  m30 as (
    select user_id, count(distinct date_trunc('week', created_at)) weeks, count(distinct created_at::date) days
    from ae where created_at >= now() - interval '30 days' group by user_id
  )
  select json_build_object(
    'days', p_days,
    'visitors', (select count(distinct user_id) from ae where created_at >= now() - make_interval(days => p_days)),
    'new_visitors', (select count(*) from newbies),
    'first_action_rate', (select round(100.0 * avg(acted::int), 1) from first_day),
    'save_rate', (select round(100.0 * avg(saved::int), 1) from first_day),
    'depth_median', (select percentile_cont(0.5) within group (order by c) from depth where c > 0),
    'retention7_cohort', (select count(*) from ret),
    'retention7_rate', (select round(100.0 * avg(back::int), 1) from ret),
    'shares', (select count(*) from ae where ev = 'share_card' and created_at >= now() - make_interval(days => p_days)),
    'link_new_visitors', (select count(*) from first_day where via_link),
    'mau30', (select count(*) from m30),
    'returned30', (select count(*) from m30 where days >= 2),
    'settled30', (select count(*) from m30 where weeks >= 2),
    'bots_excluded30', (select count(distinct e.user_id) from app_events e join bots b using (user_id) where e.created_at >= now() - interval '30 days')
  ) into r;
  return r;
end $$;
revoke all on function public.get_app_metrics(int) from public, anon;
grant execute on function public.get_app_metrics(int) to authenticated;
