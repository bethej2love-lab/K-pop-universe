-- 되돌리기: 잠금 먼저 풀고 백업값 복원 후 잠금 원상태로
update yt_channel_videos v set tags_manual=false from _bak_audit26_20261030 b where v.id=b.id;
update yt_channel_videos v set group_ko=b.group_ko,members=b.members,with_members=b.with_members,with_groups=b.with_groups,cover_of_members=b.cover_of_members,cover_of_groups=b.cover_of_groups,cover_of_song=b.cover_of_song,content_flag=b.content_flag,flag_source=b.flag_source,flagged_at=b.flagged_at from _bak_audit26_20261030 b where v.id=b.id;
update yt_channel_videos v set tags_manual=b.tags_manual from _bak_audit26_20261030 b where v.id=b.id;
