-- 최근 본 영상(For You 맨 위 Recently Viewed)을 계정에 저장(2026-11-10 사용자 "서버에 저장할 수는 없나").
-- 기존 user_data 행·RLS(본인 행만) 그대로 쓴다. 값: [{id,t,u,thumb,pa,groupKo,memberKos,ts}] 최신순 최대 20개.
alter table public.user_data add column if not exists recent_views jsonb;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='user_data' and column_name='recent_views';
