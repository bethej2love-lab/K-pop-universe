-- 2026-11-12 정적 페이지 방문 수에서 봇 빼기.
-- 11-11 14시(KST)부터 출처 없는 land가 시간당 ~60건씩 새벽에도 일정하게 들어옴(24시간 1,183기기 중 956) —
-- 전부 페이지 1장, 재생 1·앱 이동 1. 봇 표시 없는 UA로 JS를 돌리는 크롤러로 보임(seo_play.js 봇 정규식 통과).
-- 사람 판정 = 출처(referrer/utm)가 있거나, 같은 기기가 재생·클릭·스크롤 등 행동(eng/play/cta/to_app/yt)을 남김.
-- ⚠️ eng(첫 스크롤·터치·키 입력)는 11-12부터 기록 → 그 전 '출처 없이 재생 안 한 사람'은 빠진다(과소 집계 쪽).
alter table public.seo_events add column if not exists ua text;

drop function if exists public.log_seo_event(text,text,text,text,text);
create or replace function public.log_seo_event(p_ev text, p_type text, p_path text, p_src text, p_did text, p_ua text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_ev not in ('land','play','cta','to_app','yt','eng') then return; end if;
  insert into public.seo_events(ev,page_type,path,src,did,ua)
  values (p_ev, left(coalesce(p_type,''),20), left(coalesce(p_path,''),200), left(coalesce(p_src,''),80), left(coalesce(p_did,''),40), left(p_ua,160));
end $$;
revoke all on function public.log_seo_event(text,text,text,text,text,text) from public;
grant execute on function public.log_seo_event(text,text,text,text,text,text) to anon, authenticated;

create index if not exists idx_seo_events_did on public.seo_events(did);

create or replace function public.seo_human_land(t0 timestamptz, t1 timestamptz)
returns int language sql stable security definer set search_path=public as $$
  select count(distinct l.did)::int from seo_events l
  where l.ev='land' and l.created_at>=t0 and l.created_at<t1
    and (coalesce(l.src,'')<>'' or exists(select 1 from seo_events e where e.did=l.did and e.ev<>'land'
         and e.created_at>=t0 - interval '1 day' and e.created_at<t1 + interval '1 day'));
$$;
revoke all on function public.seo_human_land(timestamptz,timestamptz) from public, anon, authenticated;

-- 두 지표 함수의 seo_land를 사람 판정으로 바꿔 끼운다(현재 정의를 그대로 읽어 그 부분만 교체)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.get_app_metrics(integer)'::regprocedure);
  if position('seo_human_land' in d)=0 then
    d := replace(d, $q$(select count(distinct did) from seo_events where ev = 'land' and created_at >= now() - make_interval(days => p_days))$q$,
                    $q$seo_human_land(now() - make_interval(days => p_days), now())$q$);
    if position('seo_human_land' in d)=0 then raise exception 'get_app_metrics: 교체 대상 못 찾음'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('public.get_app_trend()'::regprocedure);
  if position('seo_human_land' in d)=0 then
    d := replace(d, $q$(select count(distinct did) from se where ev = 'land' and created_at >= b.t0 and created_at < b.t1)$q$,
                    $q$seo_human_land(b.t0, b.t1)$q$);
    if position('seo_human_land' in d)=0 then raise exception 'get_app_trend: 교체 대상 못 찾음'; end if;
    execute d;
  end if;
end $$;
select 'ok' as done;
