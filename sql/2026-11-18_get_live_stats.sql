-- 2026-11-18 정적 페이지 상태 줄용 — 카드와 같은 지표(좋아해요·이번 주 흔적·다녀간 사람)를 그룹·멤버 전부 한 번에 계산해 1시간 저장.
-- 카드용 RPC(get_group_fav_count 등)는 부를 때마다 user_data 전체를 훑어서, 방문이 많은 정적 페이지에서 페이지마다 부르면 DB 부담(11-13 522 사고 계열).
-- 반환: {at, fav:{그룹:n}, favm:{'그룹:멤버':n}, tr:{그룹:[사람수,흔적수]}, vw:{그룹:이번주}, vt:{그룹:누적}}. 정적 페이지는 이것 하나만 부른다.
create or replace function public.get_live_stats()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cr record; d jsonb; fav jsonb; favm jsonb; tr jsonb;
begin
  select * into cr from public._hot_fancams_cache where k='live_stats';
  if found and cr.at > now() - interval '1 hour' then return cr.data; end if;
  with real_users as (
    select ud.user_id, ud.fav_groups, ud.fav_members from public.user_data ud
     where not exists (select 1 from auth.sessions s where s.user_id = ud.user_id
                       and s.user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)')
  )
  select coalesce(jsonb_object_agg(g, n), '{}'::jsonb) into fav from (
    select g, count(*) n from real_users, jsonb_array_elements_text(case when jsonb_typeof(fav_groups)='array' then fav_groups else '[]'::jsonb end) g group by g) x;
  with real_users as (
    select ud.user_id, ud.fav_members from public.user_data ud
     where not exists (select 1 from auth.sessions s where s.user_id = ud.user_id
                       and s.user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)')
  )
  select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) into favm from (
    select k, count(*) n from real_users, jsonb_array_elements_text(case when jsonb_typeof(fav_members)='array' then fav_members else '[]'::jsonb end) k group by k) x;
  with t as (
    select v.group_ko g, s.user_id from public.video_scraps s join public.yt_channel_videos v on v.id = _yt_id_from_url(s.video_url)
     where s.created_at >= now() - interval '7 days'
    union all
    select v.group_ko g, r.user_id from public.video_reactions r join public.yt_channel_videos v on v.id = _yt_id_from_url(r.video_url)
     where r.created_at >= now() - interval '7 days'
  )
  select coalesce(jsonb_object_agg(g, jsonb_build_array(n, m)), '{}'::jsonb) into tr from (
    select g, count(distinct user_id) n, count(*) m from t where g is not null group by g) x;
  d := jsonb_build_object('at', now(), 'fav', fav, 'favm', favm, 'tr', tr,
       'vw', coalesce(public.get_week_viewers()->'g', '{}'::jsonb), 'vt', coalesce(public.get_total_viewers()->'g', '{}'::jsonb));
  insert into public._hot_fancams_cache(k, at, data) values ('live_stats', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;
grant execute on function public.get_live_stats() to anon, authenticated;
select (public.get_live_stats())->'fav'->'아이브' fav_ive, public.get_group_fav_count('아이브') card_fav_ive,
       (public.get_live_stats())->'tr'->'아이브' tr_ive, public.get_group_trace_week('아이브') card_tr_ive,
       (public.get_live_stats())->'favm'->'아이브:장원영' favm_wy, public.get_member_fav_count('아이브:장원영') card_favm_wy;
