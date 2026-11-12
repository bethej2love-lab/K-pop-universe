-- 2026-11-12 정적 페이지 '이번 주 많이 본 직캠' 줄(seo_play.js) — 사용자 "정적 페이지 반응을 모아 보여주고 앱으로 이어지게"
-- ① 재생 기록에 영상 ID(vid) 남기기 시작 — 나중에 우리 사이트 재생 수를 섞는다(지금은 ID가 없어서 못 셈)
alter table public.seo_events add column if not exists vid text;
drop function if exists public.log_seo_event(text,text,text,text,text,text);
create or replace function public.log_seo_event(p_ev text, p_type text, p_path text, p_src text, p_did text, p_ua text default null, p_vid text default null)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_ev not in ('land','play','cta','to_app','yt','eng','fav') then return; end if;
  insert into public.seo_events(ev,page_type,path,src,did,ua,vid)
  values (p_ev, left(coalesce(p_type,''),20), left(coalesce(p_path,''),200), left(coalesce(p_src,''),80), left(coalesce(p_did,''),40), left(p_ua,160),
          case when p_vid ~ '^[A-Za-z0-9_-]{11}$' then p_vid end);
end $$;
revoke all on function public.log_seo_event(text,text,text,text,text,text,text) from public;
grant execute on function public.log_seo_event(text,text,text,text,text,text,text) to anon, authenticated;

-- ② 1시간 캐시 — 정적 페이지가 열릴 때마다 계산하지 않게(하루 수천 번). 오래됐으면 그때 한 번 다시 계산(0.6초, 게시 시각 인덱스).
create table if not exists public._hot_fancams_cache (k text primary key, at timestamptz not null, data jsonb not null);
alter table public._hot_fancams_cache enable row level security; -- 직접 읽기 막음, 아래 함수로만

-- 최근 7일 게시 가로 직캠, 유튜브 조회수 순, 한 그룹 최대 2개, 12개. 우리 사이트 재생(seo_events vid, 7일)이 있으면 앞으로(재생 1회 = 조회수 순위 몇 칸).
create or replace function public.get_hot_fancams()
returns jsonb language plpgsql security definer set search_path=public as $$
declare cr record; d jsonb;
begin
  select * into cr from public._hot_fancams_cache where k='week';
  if found and cr.at > now() - interval '1 hour' then return cr.data; end if;
  with cand as (
    select v.id, v.title, v.group_ko, v.members, v.view_count, v.published_ts, row_number() over (order by v.view_count desc nulls last) vr
      from public.yt_channel_videos v
     where v.published_ts >= now() - interval '7 days' and v.is_short = false and v.unavailable_at is null
       and v.title ~* '(직캠|fancam|facecam|페이스캠|focus)'
       and v.title !~* '(비하인드|behind|팬s*싸인|팬사인|출근|퇴근|공항|리액션|reaction)'
       and coalesce(v.content_flag,'') not in ('무관','보류','hidden','개별출연','기타')
       and coalesce(v.source_tier,'') <> 'fans'
     order by v.view_count desc nulls last limit 80
  ), ours as (
    select vid, count(distinct did) n from public.seo_events
     where ev = 'play' and vid is not null and created_at > now() - interval '7 days' group by vid
  ), ranked as (
    select cd.*, coalesce(o.n,0) plays,
           row_number() over (order by coalesce(o.n,0) * 3 + (80 - cd.vr) / 8.0 desc, cd.vr) r0
      from cand cd left join ours o on o.vid = cd.id
  ), div as (
    select *, row_number() over (partition by group_ko order by r0) g_rank from ranked
  )
  select jsonb_build_object('at', now(), 'items', coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 't', left(title,120), 'g', group_ko, 'm', members, 'vc', view_count, 'p', plays) order by r0), '[]'::jsonb))
    into d
    from (select * from div where g_rank <= 2 order by r0 limit 12) x;
  insert into public._hot_fancams_cache(k, at, data) values ('week', now(), d)
    on conflict (k) do update set at = excluded.at, data = excluded.data;
  return d;
end $$;
revoke all on function public.get_hot_fancams() from public;
grant execute on function public.get_hot_fancams() to anon, authenticated;

delete from public._hot_fancams_cache;
select jsonb_array_length(public.get_hot_fancams()->'items') n, jsonb_array_length(public.get_hot_fancams()->'items') n_cached;
