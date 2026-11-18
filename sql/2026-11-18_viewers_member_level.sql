-- 2026-11-18 사용자 "멤버는 멤버 단위가 맞다, 30명 안 넘어도 보여주자" —
-- ① 기준 30→3명(그룹·멤버 공통. 1~2명은 보는 본인일 수 있어 어색해서 3부터)
-- ② 앱 view_member 키가 이제 '그룹:멤버'(app.js _gaEvent) → 그룹 집계는 ':' 앞만
-- ③ 멤버 단위 맵 추가(get_live_stats mw·mt): 정적 페이지는 주소 /g/그룹/멤버/…(영어 /en/g/slug/slug/…)를 'g/그룹/멤버' 키로,
--    앱은 'm:그룹:멤버' 키로. 페이지·카드가 자기 키(한·영 주소 + 앱 키)를 더해 쓴다. 봇·자동 테스트·관리자 제외는 그룹과 같은 기준.
create or replace function public._kpu_viewer_rows(p_since timestamptz)
returns table(grp text, mkey text, did text) language sql stable security definer set search_path to 'public' as $function$
  with act as (
    select distinct did from public.seo_events where created_at > p_since and ev in ('play','eng','cta','to_app','yt','fav')
  ), web as (
    select e.grp, e.did, regexp_replace(e.path, '^/en', '') p from public.seo_events e
     where e.created_at > p_since and e.grp is not null and e.did <> ''
       and coalesce(e.ua,'') !~* '(bot|spider|crawl|yeti|daumoa|slurp|bytespider|gpt|perplexity|claude|preview|inspection|mediapartners|headless)'
       and (coalesce(e.src,'') <> '' or e.did in (select did from act))
  ), appu as (
    select distinct split_part(k, ':', 1) as grp, case when ev = 'view_member' and position(':' in k) > 0 then 'm:' || k end as mkey, user_id
      from public.app_events
     where created_at > p_since and ev in ('view_group','view_member') and k is not null
  )
  select grp, case when split_part(p, '/', 2) = 'g' and split_part(p, '/', 4) not in ('', 's', 'a', 'credits')
                   then 'g/' || split_part(p, '/', 3) || '/' || split_part(p, '/', 4)
                   when split_part(p, '/', 2) = 'member' and split_part(p, '/', 3) <> ''
                   then 'member/' || split_part(p, '/', 3) end, did from web
  union all
  select grp, mkey, user_id::text from appu where public._kpu_real_user(user_id);
$function$;
revoke all on function public._kpu_viewer_rows(timestamptz) from anon, authenticated;

create or replace function public.get_week_viewers()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cr record; d jsonb;
begin
  select * into cr from public._hot_fancams_cache where k='viewers';
  if found and cr.at > now() - interval '1 hour' then return cr.data; end if;
  with r as (select * from public._kpu_viewer_rows(now() - interval '7 days'))
  select jsonb_build_object('at', now(),
     'g', coalesce((select jsonb_object_agg(grp, n) from (select grp, count(distinct did) n from r group by grp having count(distinct did) >= 3) x), '{}'::jsonb),
     'm', coalesce((select jsonb_object_agg(mkey, n) from (select mkey, count(distinct did) n from r where mkey is not null group by mkey having count(distinct did) >= 3) y), '{}'::jsonb)) into d;
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
  with r as (select * from public._kpu_viewer_rows('2000-01-01'::timestamptz))
  select jsonb_build_object('at', now(),
     'g', coalesce((select jsonb_object_agg(grp, n) from (select grp, count(distinct did) n from r group by grp having count(distinct did) >= 3) x), '{}'::jsonb),
     'm', coalesce((select jsonb_object_agg(mkey, n) from (select mkey, count(distinct did) n from r where mkey is not null group by mkey having count(distinct did) >= 3) y), '{}'::jsonb)) into d;
  insert into public._hot_fancams_cache(k, at, data) values ('viewers_total', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;

-- live_stats에 멤버 맵(mw·mt) 추가 — 나머지는 2026-11-18_get_live_stats.sql 그대로
create or replace function public.get_live_stats()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare cr record; d jsonb; fav jsonb; favm jsonb; tr jsonb; vw jsonb; vt jsonb;
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
  d := jsonb_build_object('at', now(), 'fav', fav, 'favm', favm, 'tr', tr,
       'vw', coalesce(vw->'g', '{}'::jsonb), 'vt', coalesce(vt->'g', '{}'::jsonb),
       'mw', coalesce(vw->'m', '{}'::jsonb), 'mt', coalesce(vt->'m', '{}'::jsonb));
  insert into public._hot_fancams_cache(k, at, data) values ('live_stats', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $function$;

delete from public._hot_fancams_cache where k in ('viewers','viewers_total','live_stats');
select (public.get_live_stats())->'vt'->'아이브' ive_total, (public.get_live_stats())->'mt'->'g/아이브/장원영' wy_web_total,
       (public.get_live_stats())->'mw'->'g/엔하이픈/성훈' sunghoon_week,
       jsonb_array_length(coalesce((select jsonb_agg(k) from jsonb_object_keys((public.get_live_stats())->'vt') k),'[]')) groups_shown,
       jsonb_array_length(coalesce((select jsonb_agg(k) from jsonb_object_keys((public.get_live_stats())->'mt') k),'[]')) member_keys_total;
