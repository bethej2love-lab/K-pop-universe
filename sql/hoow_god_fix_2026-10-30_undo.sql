-- 되돌리기: 잠금 먼저 풀고 백업값 복원
update yt_channel_videos v set tags_manual=false from _bak_hoow_god_20261030 b where v.id=b.id;
update yt_channel_videos v set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups,
  content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at, tags_manual=b.tags_manual
  from _bak_hoow_god_20261030 b where v.id=b.id;
