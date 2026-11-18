-- 2026-11-18 사용자 "누적 추가" — 그룹별 지금까지 다녀간 사람 수(get_week_viewers와 같은 기준, 기간 제한만 없음).
-- 정적 페이지(seo_events, 2026-11-10~) + 앱 카드 열람(app_events view_group·view_member). 봇 UA 제외, 정적 방문은 유입 경로가 있거나 실제 행동(재생·하트 등)한 기기만.
-- 30명 이상 그룹만 돌려준다(작은 수는 안 보이게). 결과는 6시간 저장(_hot_fancams_cache k='viewers_total').
create or replace function public.get_total_viewers()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cr record; d jsonb;
begin
  select * into cr from public._hot_fancams_cache where k='viewers_total';
  if found and cr.at > now() - interval '6 hours' then return cr.data; end if;
  with act as (
    select distinct did from public.seo_events where ev in ('play','eng','cta','to_app','yt','fav')
  ), web as (
    select e.grp, e.did from public.seo_events e
     where e.grp is not null and e.did <> ''
       and coalesce(e.ua,'') !~* '(bot|spider|crawl|yeti|daumoa|slurp|bytespider|gpt|perplexity|claude|preview|inspection|mediapartners|headless)'
       and (coalesce(e.src,'') <> '' or e.did in (select did from act))
  ), app as (
    select k as grp, user_id::text as did from public.app_events
     where ev in ('view_group','view_member') and k is not null
  ), u as (select grp, did from web union select grp, did from app)
  select jsonb_build_object('at', now(), 'g', coalesce(jsonb_object_agg(grp, n), '{}'::jsonb)) into d
    from (select grp, count(distinct did) n from u group by grp having count(distinct did) >= 30) x;
  insert into public._hot_fancams_cache(k, at, data) values ('viewers_total', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;
grant execute on function public.get_total_viewers() to anon, authenticated;
select jsonb_object_keys((public.get_total_viewers())->'g') limit 0;
select (public.get_total_viewers())->'g'->'아이브' ive, (public.get_week_viewers())->'g'->'아이브' ive_week, jsonb_array_length(coalesce((select jsonb_agg(k) from jsonb_object_keys((public.get_total_viewers())->'g') k),'[]')) groups_shown;
