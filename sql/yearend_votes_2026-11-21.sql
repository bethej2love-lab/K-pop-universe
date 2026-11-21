-- 올해의 케이팝 (2026-11-21 준비 — **아직 실행 안 함**)
-- 부문 없이 형식을 가리지 않는 '항목'(영상·앨범·이후 곡 등)을 한 사람이 그해 10개까지 고른다. 장기적으로 '죽기 전에 봐야 할 케이팝 1001'도 같은 항목 모델.
-- ① yearend_picks: (연도, 기기 번호, 형식, 항목 키) 한 줄. **직접 읽기·쓰기 권한 없음** — 아래 함수로만 드나든다(누가 뭘 골랐는지 아무도 못 읽는다).
-- ② cast_yearend_pick: 고르기/빼기. 기기당 그해 10개까지. 기기 번호는 앱이 만든 무작위 값(로그인 불필요 — 정적 페이지 방문자도 참여 가능).
-- ③ get_yearend_tally: 항목별 고른 사람 수. 3명 미만은 숨긴다.
-- 앱은 함수가 없으면 조용히 건너뛰고 기기에만 저장한다(app.js _yeToggle). 실행 뒤 tests/rls.test.js 기대값에 yearend_picks(read locked / write locked) 추가.

create table if not exists public.yearend_picks (
  yr int not null,
  voter text not null check (char_length(voter) between 8 and 64),
  item_type text not null check (item_type in ('video','album','song','stage','person')),
  item_key text not null check (char_length(item_key) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (yr, voter, item_type, item_key)
);
create index if not exists yearend_picks_tally_idx on public.yearend_picks (yr, item_type, item_key);
alter table public.yearend_picks enable row level security;
revoke all on public.yearend_picks from anon, authenticated;

create or replace function public.cast_yearend_pick(p_yr int, p_voter text, p_type text, p_key text, p_on boolean)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_yr is null or p_yr <> extract(year from now() at time zone 'Asia/Seoul')::int
     and not (p_yr = extract(year from now() at time zone 'Asia/Seoul')::int - 1 and extract(month from now() at time zone 'Asia/Seoul') = 1) then
    return -1; -- 그해(와 이듬해 1월)만 받는다
  end if;
  if p_on then
    select count(*) into n from yearend_picks where yr = p_yr and voter = p_voter;
    if n >= 10 then return n; end if;
    insert into yearend_picks (yr, voter, item_type, item_key) values (p_yr, p_voter, p_type, p_key) on conflict do nothing;
  else
    delete from yearend_picks where yr = p_yr and voter = p_voter and item_type = p_type and item_key = p_key;
  end if;
  select count(*) into n from yearend_picks where yr = p_yr and voter = p_voter;
  return n;
end $$;
revoke all on function public.cast_yearend_pick(int, text, text, text, boolean) from public;
grant execute on function public.cast_yearend_pick(int, text, text, text, boolean) to anon, authenticated;

create or replace function public.get_yearend_tally(p_yr int, p_limit int default 50)
returns table(item_type text, item_key text, cnt int)
language sql stable security definer set search_path = public as $$
  select item_type, item_key, count(*)::int as cnt
  from yearend_picks
  where yr = p_yr
  group by item_type, item_key
  having count(*) >= 3
  order by cnt desc, item_key
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;
revoke all on function public.get_yearend_tally(int, int) from public;
grant execute on function public.get_yearend_tally(int, int) to anon, authenticated;

-- 되돌리기: drop function public.get_yearend_tally(int, int); drop function public.cast_yearend_pick(int, text, text, text, boolean); drop table public.yearend_picks;
