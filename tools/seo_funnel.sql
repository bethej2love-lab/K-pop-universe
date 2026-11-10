-- 정적 페이지 → 앱 전환 깔때기(2026-11-10~). 실행: node C:/Users/user/.kpu_sbq.cjs tools/seo_funnel.sql
-- seo_events(정적 페이지, 기기 did 기준)와 app_events from_seo(앱 도착, 계정 기준)는 서로 잇지 않는다 — 비율로만 본다.
with d as (select generate_series((now() at time zone 'Asia/Seoul')::date - 13, (now() at time zone 'Asia/Seoul')::date, '1 day')::date as day),
s as (select (created_at at time zone 'Asia/Seoul')::date as dday, ev, did, src from seo_events),
a as (select (created_at at time zone 'Asia/Seoul')::date as dday, user_id from app_events where ev='from_seo')
select d.day,
  (select count(distinct did) from s where s.dday=d.day and ev='land') land_devices,
  (select count(distinct did) from s where s.dday=d.day and ev='play') played_on_page,
  (select count(distinct did) from s where s.dday=d.day and ev in ('cta','to_app')) clicked_to_app,
  (select count(distinct user_id) from a where a.dday=d.day) arrived_in_app,
  (select count(distinct did) from s where s.dday=d.day and ev='land' and src='chatgpt.com') land_from_chatgpt
from d order by d.day desc;
