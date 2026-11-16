-- 되돌리기: 2026-11-16_hold_restore_round2.sql 실행 전 값으로(백업 표 bak_20261116_rest2)
select count(*) as will_restore from yt_channel_videos y join bak_20261116_rest2 b using(id);
update yt_channel_videos y set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups, content_flag=b.content_flag, flag_source=b.flag_source from bak_20261116_rest2 b where b.id=y.id and y.tags_manual is not true;
