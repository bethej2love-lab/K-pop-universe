-- 2026-11-18 정적 페이지 맨 위 한 줄(사용자 "웹 기준 맨 윗줄에 한 줄 할애") — 사이트 전체 숫자 site{w:이번 주 다녀간 사람, t:지금까지, nv:이번 주 새로 모은 영상}.
-- 사람 수는 그룹·멤버와 같은 기준(_kpu_viewer_rows: 봇·자동 테스트·관리자 제외). 1시간 저장은 그대로.
create or replace function public.get_live_stats()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cr record; d jsonb; fav jsonb; favm jsonb; tr jsonb; vw jsonb; vt jsonb; sw int; st int; nv int;
begin
  select * into cr from public._hot_fancams_cache where k='live_stats';
  if found and cr.at > now() - interval '1 hour' then return cr.data; end if;
  with real_users as (
    select ud.user_id, ud.fav_groups, ud.fav_members from public.user_data ud
     where not exists (select 1 from auth.sessions s where s.user_id = ud.user_id
                       and s.user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)')
  )
  select coalesce((select jsonb_object_agg(g, n) from (select g, count(*) n from real_users, jsonb_array_elements_text(case when jsonb_typeof(fav_groups)='array' then fav_groups else '[]'::jsonb end) g group by g) x), '{}'::jsonb),
         coalesce((select jsonb_object_agg(k, n) from (select k, count(*) n from real_users, jsonb_array_elements_text(case when jsonb_typeof(fav_members)='array' then fav_members else '[]'::jsonb end) k group by k) y), '{}'::jsonb)
    into fav, favm;
  with t as (
    select v.group_ko g, s.user_id from public.video_scraps s join public.yt_channel_videos v on v.id = _yt_id_from_url(s.video_url)
     where s.created_at >= now() - interval '7 days'
    union all
    select v.group_ko g, r.user_id from public.video_reactions r join public.yt_channel_videos v on v.id = _yt_id_from_url(r.video_url)
     where r.created_at >= now() - interval '7 days'
  )
  select coalesce(jsonb_object_agg(g, jsonb_build_array(n, m)), '{}'::jsonb) into tr from (
    select g, count(distinct user_id) n, count(*) m from t where g is not null group by g) x;
  vw := public.get_week_viewers(); vt := public.get_total_viewers();
  select count(distinct did) into sw from public._kpu_viewer_rows(now() - interval '7 days');
  select count(distinct did) into st from public._kpu_viewer_rows('2000-01-01'::timestamptz);
  select count(*) into nv from public.yt_channel_videos where created_at >= now() - interval '7 days' and content_flag is null; -- 이번 주 새로 모은 영상(created_at 색인)
  d := jsonb_build_object('at', now(), 'fav', fav, 'favm', favm, 'tr', tr,
       'vw', coalesce(vw->'g', '{}'::jsonb), 'vt', coalesce(vt->'g', '{}'::jsonb),
       'mw', coalesce(vw->'m', '{}'::jsonb), 'mt', coalesce(vt->'m', '{}'::jsonb),
       'site', jsonb_build_object('w', sw, 't', st, 'nv', nv));
  insert into public._hot_fancams_cache(k, at, data) values ('live_stats', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;

delete from public._hot_fancams_cache where k='live_stats';
select (public.get_live_stats())->'site' site;
