update public.yt_channel_videos v set group_ko=b.group_ko, members=b.members, content_flag=b.content_flag, tags_manual=b.tags_manual from public._bak_audit195_205_20261109 b where v.id=b.id;
