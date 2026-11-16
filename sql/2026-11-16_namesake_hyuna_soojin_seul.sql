-- 2026-11-16 Codex 11-16 동명이인: 나인뮤지스 현아 카드의 포미닛·솔로 현아 영상 22(보류) / 위클리 이수진 카드의 바이올리니스트 한수진·작가 이수진(무관 5)·서수진 BADITUDE(보류 3) / 스텔라 이슬 카드의 곡명 "아침 이슬"·대학 동아리(무관 4)
-- 나인뮤지스 채널·9MUSES 표기 영상은 그대로. 되돌리기: update yt_channel_videos y set content_flag=b.content_flag, flag_source=b.flag_source from bak_20261116_namesake3 b where b.id=y.id;
create table if not exists bak_20261116_namesake3 as select id, group_ko, members, content_flag, flag_source, now() as backed_at from yt_channel_videos where id in (
 'BJekLupH-CY','SUQx64RkmU0','7CiG5mpOJKg','b2zqKlirC2s','CLCejC2POW4','hNVgnxQfA-s','GpY1QD1X7A4','n4EvweWHZi8','oTczf5CUcy0','Jns_XUXTR7Y','uJF90fdqkEE','xeuAHmaTf3E','YdGIpk85dMo','eja1Le_ZNE4','CoqFH4xyT20','R675ut4pL5o','d7AkDytbzP0','1GoHD1OvAjo','h-L_oXwNmVw','jphFVBnjvHs','59vpvLaGois','2xKUpLXP6w4',
 '2m1NPBl34Xw','UtPiNTd8lRA','hb7M_3EBKuw','9gZReqy2_hM','rU84kppW_ww','JwWlf5Rhg6U','E0Wh4loscFo','qdGv4fyE0Hw',
 'QJoJhIWt-as','iSf7wI-AjLs','VcLThVVbjl4','rZV-5NftFhE');
alter table bak_20261116_namesake3 enable row level security;
update yt_channel_videos set content_flag='보류', flag_source='manual' where content_flag is null and tags_manual is not true and id in (
 'BJekLupH-CY','SUQx64RkmU0','7CiG5mpOJKg','b2zqKlirC2s','CLCejC2POW4','hNVgnxQfA-s','GpY1QD1X7A4','n4EvweWHZi8','oTczf5CUcy0','Jns_XUXTR7Y','uJF90fdqkEE','xeuAHmaTf3E','YdGIpk85dMo','eja1Le_ZNE4','CoqFH4xyT20','R675ut4pL5o','d7AkDytbzP0','1GoHD1OvAjo','h-L_oXwNmVw','jphFVBnjvHs','59vpvLaGois','2xKUpLXP6w4','2m1NPBl34Xw','UtPiNTd8lRA','hb7M_3EBKuw');
update yt_channel_videos set content_flag='무관', flag_source='manual' where content_flag is null and tags_manual is not true and id in (
 '9gZReqy2_hM','rU84kppW_ww','JwWlf5Rhg6U','E0Wh4loscFo','qdGv4fyE0Hw','QJoJhIWt-as','iSf7wI-AjLs','VcLThVVbjl4','rZV-5NftFhE');
select coalesce(content_flag,'(null)')||'/'||coalesce(flag_source,'-') k, count(*) n from yt_channel_videos where id in (select id from bak_20261116_namesake3) group by 1;
