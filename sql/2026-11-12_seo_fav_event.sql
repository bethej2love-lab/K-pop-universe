-- 2026-11-12 정적 페이지 하트(seo_play.js) — 'fav' 이벤트 허용
create or replace function public.log_seo_event(p_ev text, p_type text, p_path text, p_src text, p_did text, p_ua text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_ev not in ('land','play','cta','to_app','yt','eng','fav') then return; end if;
  insert into public.seo_events(ev,page_type,path,src,did,ua)
  values (p_ev, left(coalesce(p_type,''),20), left(coalesce(p_path,''),200), left(coalesce(p_src,''),80), left(coalesce(p_did,''),40), left(p_ua,160));
end $$;
revoke all on function public.log_seo_event(text,text,text,text,text,text) from public;
grant execute on function public.log_seo_event(text,text,text,text,text,text) to anon, authenticated;
select 'ok';
