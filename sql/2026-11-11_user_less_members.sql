-- 2026-11-11 For You 덜 보기 멤버(app.js lessMembers) — 즐겨찾기처럼 계정에 저장해 기기 간 동기화. 값은 "그룹:이름" 배열.
alter table public.user_data add column if not exists less_members text[] not null default '{}';
select column_name, data_type from information_schema.columns where table_name='user_data' and column_name='less_members';
