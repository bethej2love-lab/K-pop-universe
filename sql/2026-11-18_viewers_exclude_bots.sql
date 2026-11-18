-- 2026-11-18 사용자 "누적 방문 계산에 봇은 뺀 거 맞나? 최대한 정확한 숫자로" — 앱 쪽(app_events view_group/view_member)이 봇을 안 거르고 있었다.
-- 실측: 아이브 카드를 연 앱 계정 446개 중 438개가 헤드리스(우리·Codex 자동 테스트가 실서비스에 붙어 만든 익명 계정). 정적 쪽은 UA·출처/행동 기준으로 이미 거른다.
-- 앱 쪽도 get_app_metrics·좋아해요 수와 같은 기준(auth.sessions UA에 headless/bot 등 + 관리자 본인 제외)으로 거른다. 이번 주·누적 둘 다.
create or replace function public._kpu_real_user(p_uid uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select not exists (select 1 from auth.sessions s where s.user_id = p_uid
                     and s.user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)')
     and not exists (select 1 from auth.users u where u.id = p_uid and u.email = 'bethej2love@gmail.com');
$function$;
revoke all on function public._kpu_real_user(uuid) from anon, authenticated;

create or replace function public.get_week_viewers()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cr record; d jsonb;
begin
  select * into cr from public._hot_fancams_cache where k='viewers';
  if found and cr.at > now() - interval '1 hour' then return cr.data; end if;
  with act as (
    select distinct did from public.seo_events where created_at > now() - interval '7 days' and ev in ('play','eng','cta','to_app','yt','fav')
  ), web as (
    select e.grp, e.did from public.seo_events e
     where e.created_at > now() - interval '7 days' and e.grp is not null and e.did <> ''
       and coalesce(e.ua,'') !~* '(bot|spider|crawl|yeti|daumoa|slurp|bytespider|gpt|perplexity|claude|preview|inspection|mediapartners|headless)'
       and (coalesce(e.src,'') <> '' or e.did in (select did from act))
  ), appu as (
    select distinct k as grp, user_id from public.app_events
     where created_at > now() - interval '7 days' and ev in ('view_group','view_member') and k is not null
  ), app as (select grp, user_id::text as did from appu where public._kpu_real_user(user_id)),
  u as (select grp, did from web union select grp, did from app)
  select jsonb_build_object('at', now(), 'g', coalesce(jsonb_object_agg(grp, n), '{}'::jsonb)) into d
    from (select grp, count(distinct did) n from u group by grp having count(distinct did) >= 30) x;
  insert into public._hot_fancams_cache(k, at, data) values ('viewers', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;

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
  ), appu as (
    select distinct k as grp, user_id from public.app_events
     where ev in ('view_group','view_member') and k is not null
  ), app as (select grp, user_id::text as did from appu where public._kpu_real_user(user_id)),
  u as (select grp, did from web union select grp, did from app)
  select jsonb_build_object('at', now(), 'g', coalesce(jsonb_object_agg(grp, n), '{}'::jsonb)) into d
    from (select grp, count(distinct did) n from u group by grp having count(distinct did) >= 30) x;
  insert into public._hot_fancams_cache(k, at, data) values ('viewers_total', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;

-- 저장해 둔 예전(봇 포함) 값 지우기
delete from public._hot_fancams_cache where k in ('viewers','viewers_total','live_stats');
select (public.get_total_viewers())->'g' total, (public.get_week_viewers())->'g' week;
