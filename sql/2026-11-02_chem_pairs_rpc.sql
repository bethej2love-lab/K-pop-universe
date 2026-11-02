-- 조합(Chemistry) 정적 페이지용 — 같은 그룹 멤버 2명이 함께 나온 영상 쌍 집계 + 쌍마다 대표 영상 12개(2026-11-02, Claude Code가 실행함)
-- build_group_pages.js(주 1회 CI)가 한 번 부른다. 앱(app.js _openChem)과 같은 기준: 무관·보류·숨김·개별출연 제외(개별출연은 2026-11-03 추가 — 각자 따로 나온 편집물이 쌍으로 세어졌음).
-- 단체 영상(출연 태그 5명 이상)은 뺀다 — 그룹 전체 영상이 모든 멤버 쌍에 똑같이 붙어 "케미"가 흐려진다. 2~4명 영상만 센다.
-- 다른 그룹끼리(with_members)는 아직 안 낸다 — 검색엔진에 색인되는 페이지라 게스트 태그 오탐(예: 동명이인)이 정리된 뒤에(관계 페이지 원칙과 같음).
create or replace function public.get_chem_pairs(p_min int default 10)
returns json language sql stable security definer set search_path = public as $$
with v as (
  select id, title, thumb, category, is_short, view_count, published_at, group_ko, members,
         coalesce(array_length(members,1),0) + coalesce(array_length(with_members,1),0) as np
  from yt_channel_videos
  where (content_flag is null or content_flag not in ('무관','보류','hidden','기타','개별출연'))
    and group_ko is not null
    and coalesce(array_length(members,1),0) between 2 and 4
),
p as (
  select v.*, a.m as ma, b.m as mb
  from v, unnest(v.members) a(m), unnest(v.members) b(m)
  where a.m < b.m
),
r as (
  select p.*,
         count(*) over (partition by group_ko, ma, mb) as n,
         count(*) filter (where np = 2) over (partition by group_ko, ma, mb) as only2,
         row_number() over (partition by group_ko, ma, mb order by (np = 2) desc, view_count desc nulls last) as rn
  from p
)
select coalesce(json_agg(x), '[]'::json) from (
  select group_ko as g, ma as a, mb as b, max(n) as n, max(only2) as only2, min(published_at) as first_at,
         json_agg(json_build_object('id', id, 't', title, 's', is_short, 'c', category, 'vc', view_count, 'pa', left(published_at, 10), 'np', np) order by rn) as v
  from r where n >= p_min and rn <= 12
  group by group_ko, ma, mb
) x;
$$;
revoke all on function public.get_chem_pairs(int) from public;
grant execute on function public.get_chem_pairs(int) to anon, authenticated;
