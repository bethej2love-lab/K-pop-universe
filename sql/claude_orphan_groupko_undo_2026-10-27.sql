UPDATE yt_channel_videos v SET group_ko=b.group_ko, members=b.members FROM ops_claude_orphan_20261027 b WHERE v.id=b.id;
UPDATE ext_channels SET owner_gko='송형준', owner_mko='송형준' WHERE handle='donggeul_shj';
