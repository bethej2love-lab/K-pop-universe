-- Surf v3 — 전체 유저 넘어간 기록 익명 집계 (2026-09-29)
-- ① surf_hops: Surf에서 영상 A → 영상 B로 넘어갈 때 한 줄. 본인 기록 쓰기만 가능, **읽기 정책 없음**(아무도 행을 못 읽는다).
--    같은 사람이 같은 A→B를 여러 번 눌러도 한 번만 센다(unique) — 한 명이 반복 클릭으로 순위를 만들지 못하게.
-- ② get_surf_next(영상): "이 영상에서 사람들이 다음에 간 영상" — **서로 다른 2명 이상**이 간 것만, 영상 id와 인원수만.
-- ③ get_surf_rel_weights(): 관계 행(함께한 멤버·쓴 곡·같은 곡 …)별 전체 유저 선호 합계(user_data.surf_prefs 합산, 3명↑ 기록된 행만).
--    개인 기록이 적은(5점 미만) 사람의 Surf 행 순서를 이 전역 가중치로 정한다.
-- 앱은 테이블/함수가 없으면 조용히 건너뛴다.

create table if not exists public.surf_hops (
  user_id uuid not null default auth.uid(),
  from_vid text not null,
  to_vid text not null,
  rel text,
  created_at timestamptz not null default now(),
  primary key (user_id, from_vid, to_vid)
);
create index if not exists surf_hops_from_idx on public.surf_hops (from_vid);
alter table public.surf_hops enable row level security;
drop policy if exists surf_hops_insert_own on public.surf_hops;
create policy surf_hops_insert_own on public.surf_hops for insert to anon, authenticated with check (user_id = auth.uid());
grant insert on public.surf_hops to anon, authenticated;

create or replace function public.get_surf_next(p_vid text, p_limit int default 8)
returns table(to_vid text, cnt int)
language sql stable security definer set search_path = public as $$
  select to_vid, count(distinct user_id)::int as cnt
  from surf_hops
  where from_vid = p_vid
  group by to_vid
  having count(distinct user_id) >= 2
  order by cnt desc, to_vid
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;
revoke all on function public.get_surf_next(text, int) from public;
grant execute on function public.get_surf_next(text, int) to anon, authenticated;

create or replace function public.get_surf_rel_weights()
returns table(rel text, total numeric, users int)
language sql stable security definer set search_path = public as $$
  select e.key as rel, sum((e.value)::numeric) as total, count(*)::int as users
  from user_data d, jsonb_each_text(coalesce(d.surf_prefs, '{}'::jsonb)) e
  where e.value ~ '^[0-9.]+$'
  group by e.key
  having count(*) >= 3;
$$;
revoke all on function public.get_surf_rel_weights() from public;
grant execute on function public.get_surf_rel_weights() to anon, authenticated;
