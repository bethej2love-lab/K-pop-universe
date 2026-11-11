-- 2026-11-11 카드 "N명이 좋아해요"에서 자동 테스트 계정 제외.
-- 실측: 즐겨찾기가 있는 계정 543개 중 530개가 헤드리스 테스트 계정(auth.sessions user_agent에 headless 등) — 실제 사람은 13명.
-- 그룹 하트 수가 100 단위로 보이던 건 거의 테스트가 누른 것. get_app_metrics와 같은 판정(bots)을 쓴다.
CREATE OR REPLACE FUNCTION public.get_group_fav_count(p_group_ko text)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select count(*)::integer from public.user_data ud
  where ud.fav_groups ? p_group_ko
    and not exists (select 1 from auth.sessions s where s.user_id = ud.user_id
                    and s.user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)');
$function$;
CREATE OR REPLACE FUNCTION public.get_member_fav_count(p_member_key text)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select count(*)::integer from public.user_data ud
  where ud.fav_members ? p_member_key
    and not exists (select 1 from auth.sessions s where s.user_id = ud.user_id
                    and s.user_agent ~* '(headless|bot|crawl|spider|lighthouse|playwright|puppeteer)');
$function$;
select public.get_group_fav_count('코르티스') cortis, (select count(*) from user_data where fav_groups ? '코르티스') cortis_raw;
