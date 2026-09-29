-- 함께 즐겨찾기(co-favorite) 집계 RPC (2026-09-29, Surf 디깅 알고리즘 ③)
-- "이 멤버(그룹)를 즐겨찾기한 사람들이 함께 즐겨찾기한 멤버(그룹)"를 **익명 숫자로만** 돌려준다.
--  · 개인 즐겨찾기는 RLS로 본인만 읽는다 — 이 함수는 security definer로 전체를 세되, 겹친 인원이 3명 미만인 쌍은
--    아예 안 돌려준다(한두 명의 즐겨찾기를 역추적하지 못하게). 순위·이름·user_id는 절대 안 나간다.
--  · 기존 get_member_fav_count / get_group_fav_count와 같은 방식(anon·authenticated 실행 가능).
--  · 컬럼 타입(jsonb/text[])에 상관없이 동작하도록 to_jsonb로 감싼다.
-- 키 형식: 멤버 = "그룹:이름"(index.html _mFavKey), 그룹 = 그룹 한글명.
-- 앱(Surf "함께 좋아하는" 행)은 이 함수가 없거나 결과가 비면 행을 안 띄운다 — 유저가 늘면 자동으로 켜진다.

create or replace function public.get_co_favorites(p_kind text, p_key text, p_limit int default 12)
returns table(fav_key text, cnt int)
language sql
stable
security definer
set search_path = public
as $$
  with fans as (
    select case when p_kind = 'group' then to_jsonb(fav_groups) else to_jsonb(fav_members) end as fm
    from user_data
    where case when p_kind = 'group' then coalesce(to_jsonb(fav_groups), '[]'::jsonb) ? p_key
               else coalesce(to_jsonb(fav_members), '[]'::jsonb) ? p_key end
  ), co as (
    select e as fav_key, count(*)::int as cnt
    from fans, jsonb_array_elements_text(coalesce(fm, '[]'::jsonb)) as e
    where e <> p_key
    group by e
  )
  select fav_key, cnt from co
  where cnt >= 3
  order by cnt desc, fav_key
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

revoke all on function public.get_co_favorites(text, text, int) from public;
grant execute on function public.get_co_favorites(text, text, int) to anon, authenticated;
