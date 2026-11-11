-- 2026-11-11 get_app_metrics에 정적 페이지 방문(seo_land)·앱으로 넘어온 기기(seo_to_app) 추가 — 관리자 Daily 팝업용.
-- seo_events는 기기 무작위 ID(did) 기준이라 자동 테스트 제외가 안 된다(검색엔진 렌더러가 섞일 수 있음).
CREATE OR REPLACE FUNCTION public.get_app_metrics(p_days integer DEFAULT 7)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    'fav_users', (select count(distinct user_id) from ae where ev in ('favorite_group','favorite_member') and k = 'add' and created_at >= now() - make_interval(days => p_days)),
    'fav_adds', (select count(*) from ae where ev in ('favorite_group','favorite_member') and k = 'add' and created_at >= now() - make_interval(days => p_days)),
    'seo_land', (select count(distinct did) from seo_events where ev = 'land' and created_at >= now() - make_interval(days => p_days)),
    'seo_to_app', (select count(distinct did) from seo_events where ev = 'to_app' and created_at >= now() - make_interval(days => p_days)),
    'mau30', (select count(*) from m30),
    'returned30', (select count(*) from m30 where days >= 2),
    'settled30', (select count(*) from m30 where weeks >= 2),
    'bots_excluded30', (select count(distinct e.user_id) from app_events e join bots b using (user_id) where e.created_at >= now() - interval '30 days')
  ) into r;
  return r;
end $function$
;
