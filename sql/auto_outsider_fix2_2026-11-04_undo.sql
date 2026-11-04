update public.yt_channel_videos t set tags_manual=false from public.bak_auto_outsider2_20261104 b where t.id=b.id;
update public.yt_channel_videos t set group_ko=b.group_ko, members=b.members, with_members=b.with_members from public.bak_auto_outsider2_20261104 b where t.id=b.id;
update public.yt_channel_videos t set tags_manual=b.tags_manual from public.bak_auto_outsider2_20261104 b where t.id=b.id;
