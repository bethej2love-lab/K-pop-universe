-- 2026-11-12 관리자: 즐겨찾기 요약 — 즐겨찾기한 사람 수, 즐겨찾기된 그룹·멤버 수와 목록(많은 순, 0은 없음).
-- 사용자 "그 그룹/멤버 위주로 태깅이든 신경 쓰면 좋을 테니". 자동 테스트·관리자 본인은 get_app_metrics와 같은 판정으로 뺀다.
-- fav_groups = ["에스파", …], fav_members = ["에스파:카리나", …] (jsonb 배열)
create or replace function public.get_fav_summary()
returns json language plpgsql stable security definer set search_path to 'public' as $$
declare r json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'bethej2love@gmail.com' then raise exception 'admin only'; end if;
  with bots as (
    select distinct user_id from auth.sessions where user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)'
    union select id from auth.users where email = 'bethej2love@gmail.com'
  ),
  ud as (
    select u.user_id,
      case when jsonb_typeof(u.fav_groups)='array' then u.fav_groups else '[]'::jsonb end g,
      case when jsonb_typeof(u.fav_members)='array' then u.fav_members else '[]'::jsonb end m
    from user_data u where not exists (select 1 from bots b where b.user_id = u.user_id)
  ),
  gs as (select x k, count(distinct user_id)::int n from ud, jsonb_array_elements_text(g) x group by 1),
  ms as (select x k, count(distinct user_id)::int n from ud, jsonb_array_elements_text(m) x group by 1)
  select json_build_object(
    'users', (select count(*) from ud where jsonb_array_length(g) > 0 or jsonb_array_length(m) > 0),
    'groups', coalesce((select json_agg(json_build_object('k', k, 'n', n) order by n desc, k) from gs), '[]'::json),
    'members', coalesce((select json_agg(json_build_object('k', k, 'n', n) order by n desc, k) from ms), '[]'::json)
  ) into r;
  return r;
end $$;
revoke all on function public.get_fav_summary() from public, anon;
grant execute on function public.get_fav_summary() to authenticated;
select 'ok' done;
