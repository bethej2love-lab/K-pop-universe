-- 2026-11-16 관리자 Daily 핵심 지표 개편(Codex 제안 + 사용자 승인) — get_app_core()
-- 세 줄: ① 앱 방문자(신규 포함) ② 첫날 저장한 신규(분자/분모, 첫날 재생은 보조) ③ 신규의 7일 내 재방문(7일 관찰이 끝난 집단만).
-- 기준은 get_app_metrics·get_app_trend와 같다: 자동 테스트(auth.sessions UA)·관리자 본인 제외, 신규 = 계정 생성이 그 구간 안(그 구간에 방문 기록이 있는 사람).
--  · 저장 = save_collection · save_scrap · 즐겨찾기 추가(favorite_group/favorite_member, k='add'). 첫날 = 계정 생성 후 24시간 안.
--  · 첫날 재생 = 첫날 video_play 있음(app.js _gaEvent('video_play')가 실제 재생 시작 때 호출 — 보조 지표).
--  · 재방문 = 가입일 이후 **다른 날(KST)**에 이벤트가 있고 가입 7일 안. 관찰 기간이 부족한 최근 7일 가입자는 세지 않는다 → 집단 c1 = 7~14일 전 가입, c0 = 14~21일 전 가입.
--  · 30일 정착 = 가입 30일 이상 된 사람 중 최근 7일 방문자 수(주간 리뷰용).
--  · stale_h = 마지막 이벤트가 몇 시간 전인지(수집 중단 감지 — 화면은 일정 시간 넘으면 상태 한 줄).
create or replace function public.get_app_core()
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
    select e.user_id, e.ev, e.k, e.created_at from app_events e
    where e.created_at >= now() - interval '60 days'
      and not exists (select 1 from bots b where b.user_id = e.user_id)
  ),
  usr as materialized (select id, created_at from auth.users where created_at >= now() - interval '60 days'),
  win(k, t0, t1) as (values
    ('w',  now() - interval '7 days',  now()),
    ('wp', now() - interval '14 days', now() - interval '7 days')),
  vis as (
    select w.k,
      (select count(distinct user_id) from ae where created_at >= w.t0 and created_at < w.t1) as visitors,
      (select count(distinct ae.user_id) from ae join usr u on u.id = ae.user_id
         where ae.created_at >= w.t0 and ae.created_at < w.t1 and u.created_at >= w.t0 and u.created_at < w.t1) as new_n,
      (select count(distinct ae.user_id) from ae join usr u on u.id = ae.user_id
         where u.created_at >= w.t0 and u.created_at < w.t1
           and (ae.ev in ('save_collection','save_scrap') or (ae.ev in ('favorite_group','favorite_member') and ae.k = 'add'))
           and ae.created_at >= u.created_at and ae.created_at < u.created_at + interval '24 hours') as new_saved,
      (select count(distinct ae.user_id) from ae join usr u on u.id = ae.user_id
         where u.created_at >= w.t0 and u.created_at < w.t1 and ae.ev = 'video_play'
           and ae.created_at >= u.created_at and ae.created_at < u.created_at + interval '24 hours') as new_played
    from win w
  ),
  -- 신규 집단: 이 구간에 가입했고 가입 뒤 이벤트가 하나라도 있는 사람(가입만 하고 아무것도 안 한 계정은 분모에서 뺀다 — 방문자 기준과 맞춤)
  coh(k, t0, t1) as (values
    ('c1', now() - interval '14 days', now() - interval '7 days'),
    ('c0', now() - interval '21 days', now() - interval '14 days')),
  ret as (
    select c.k,
      (select count(distinct u.id) from usr u where u.created_at >= c.t0 and u.created_at < c.t1
         and exists (select 1 from ae where ae.user_id = u.id and ae.created_at >= u.created_at)) as cohort,
      (select count(distinct u.id) from usr u where u.created_at >= c.t0 and u.created_at < c.t1
         and exists (select 1 from ae where ae.user_id = u.id
           and (ae.created_at at time zone 'Asia/Seoul')::date > (u.created_at at time zone 'Asia/Seoul')::date
           and ae.created_at < u.created_at + interval '7 days')) as returned
    from coh c
  )
  select json_build_object(
    'v', (select json_object_agg(k, json_build_object('visitors', visitors, 'new', new_n, 'saved', new_saved, 'played', new_played)) from (select k, visitors, new_n, new_saved, new_played from vis) t),
    'ret', (select json_object_agg(k, json_build_object('cohort', cohort, 'returned', returned)) from ret),
    'settled30', (select count(distinct ae.user_id) from ae join auth.users au on au.id = ae.user_id
                   where au.created_at < now() - interval '30 days' and ae.created_at >= now() - interval '7 days'),
    'stale_h', (select round(extract(epoch from (now() - max(created_at))) / 3600.0, 1) from app_events)
  ) into r;
  return r;
end $function$;
select position('get_app_core' in pg_get_functiondef('public.get_app_core()'::regprocedure))>0 ok;
