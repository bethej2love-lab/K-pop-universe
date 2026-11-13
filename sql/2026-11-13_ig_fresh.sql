-- 2026-11-13 지난 인스타 글 '열 때 새 주소 받기'(supabase/functions/ig-fresh)
-- ① 서버 함수만 읽는 잠긴 칸 — 인스타 키(META_IG_TOKEN)를 수집 워크플로가 넣는다. anon·로그인 사용자는 못 읽음(정책 없음 + 권한 회수).
create table if not exists public.app_secrets (k text primary key, v text not null, updated_at timestamptz not null default now());
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
-- ② 글이 있던 목록 쪽 위치('커서|한 쪽 개수') — 그 쪽만 다시 물어 모든 장 새 주소를 받는다
alter table public.ig_media add column if not exists pc text;
select (select count(*) from information_schema.tables where table_name='app_secrets') as t, (select count(*) from information_schema.columns where table_name='ig_media' and column_name='pc') as c;
