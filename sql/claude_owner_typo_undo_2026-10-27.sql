UPDATE yt_channel_videos v SET group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups, cover_of_groups=b.cover_of_groups, cover_of_song=b.cover_of_song, tags_manual=b.tags_manual, cover_manual=b.cover_manual FROM ops_claude_owner_20261027 b WHERE v.id=b.id;
UPDATE ext_channels SET owner_gko='호연', owner_mko='호연' WHERE handle='Hyo_LevelUp';
