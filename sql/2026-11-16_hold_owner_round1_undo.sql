-- 되돌리기 (백업 표 bak_20261116_owner1)
update yt_channel_videos y set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups, content_flag=b.content_flag, flag_source=b.flag_source from bak_20261116_owner1 b where b.id=y.id and y.tags_manual is not true;
