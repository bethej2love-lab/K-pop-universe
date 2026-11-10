-- 정적 페이지(검색·챗지피티 착지) → 앱 전환 측정(2026-11-10 사용자 "정적 페이지에서 앱으로 오는 비율 높이는 게 관건").
-- GA에만 있던 seo_land·seo_cta_click을 우리가 직접 집계하려고. 정적 페이지는 로그인 세션이 없어 app_events(본인 행만 쓰기)에 못 쓴다
-- → 잠긴 표 + 정해진 값만 받는 함수. 읽기는 서비스 키/SQL만. did=기기 무작위 ID(localStorage), 개인정보 없음.
create table if not exists public.seo_events(
  id bigserial primary key,
  ev text not null,          -- land | play | cta | to_app | yt
  page_type text,            -- member | group | explore | group_list | song | album | other
  path text,
  src text,                  -- 바깥 출처 호스트(chatgpt.com 등) 또는 utm_source
  did text,
  created_at timestamptz not null default now()
);
alter table public.seo_events enable row level security;
revoke all on public.seo_events from anon, authenticated;
create index if not exists idx_seo_events_created on public.seo_events(created_at);
create or replace function public.log_seo_event(p_ev text, p_type text, p_path text, p_src text, p_did text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_ev not in ('land','play','cta','to_app','yt') then return; end if;
  insert into public.seo_events(ev,page_type,path,src,did)
  values (p_ev, left(coalesce(p_type,''),20), left(coalesce(p_path,''),200), left(coalesce(p_src,''),80), left(coalesce(p_did,''),40));
end $$;
revoke all on function public.log_seo_event(text,text,text,text,text) from public;
grant execute on function public.log_seo_event(text,text,text,text,text) to anon, authenticated;
select 'ok' as done;
