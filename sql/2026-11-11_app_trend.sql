-- 2026-11-11 관리자 Daily 팝업 추세(사용자 "어제·지난주·지난달 대비 몇 명·몇 % 늘었는지 — 추세가 제일 중요").
-- 기간 3개(24시간·7일·30일)마다 지금 구간과 바로 앞 같은 길이 구간을 같이 돌려준다.
-- 지표: 방문자·새 방문(계정 생성 시각 기준 — get_app_metrics와 같은 판정)·정적 페이지 방문(seo_events land 기기)·정적→앱(from_seo).
-- 제외: 자동 테스트(auth.sessions user_agent)·관리자 본인. ⚠️ seo_events는 2026-11-10부터라 그 전 구간은 0 → 화면에서 '—'.
create or replace function public.get_app_trend()
 returns json language plpgsql stable security definer set search_path to 'public'
as $function$
declare r json;
begin
  if coalesce(auth.jwt()->>'email','') <> 'bethej2love@gmail.com' then raise exception 'admin only'; end if;
  with bots as (
    select distinct user_id from auth.sessions
    where user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)'
    union select id from auth.users where email = 'bethej2love@gmail.com'
  ),
  ae as materialized (
    select e.user_id, e.ev, e.created_at from app_events e
    where e.created_at >= now() - interval '60 days'
      and not exists (select 1 from bots b where b.user_id = e.user_id)
  ),
  se as materialized (
    select did, ev, created_at from seo_events where created_at >= now() - interval '60 days'
  ),
  win(k, d, off) as (values ('d1',1,0),('d1p',1,1),('w',7,0),('wp',7,1),('m',30,0),('mp',30,1)),
  b as (select k, now() - make_interval(days => d * (off + 1)) t0, now() - make_interval(days => d * off) t1 from win)
  select json_object_agg(b.k, json_build_object(
    'visitors', (select count(distinct user_id) from ae where created_at >= b.t0 and created_at < b.t1),
    'new', (select count(distinct ae.user_id) from ae join auth.users au on au.id = ae.user_id
            where ae.created_at >= b.t0 and ae.created_at < b.t1 and au.created_at >= b.t0 and au.created_at < b.t1),
    'seo_land', (select count(distinct did) from se where ev = 'land' and created_at >= b.t0 and created_at < b.t1),
    'seo_to_app', (select count(distinct user_id) from ae where ev = 'from_seo' and created_at >= b.t0 and created_at < b.t1)
  )) into r from b;
  return r;
end $function$;
select position('get_app_trend' in pg_get_functiondef('public.get_app_trend()'::regprocedure))>0 ok;
