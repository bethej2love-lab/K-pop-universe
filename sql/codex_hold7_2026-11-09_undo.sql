update public.yt_channel_videos set tags_manual=false where id in ('0aDg4Amd85I','1rQmfYgy0OE','46PrVlOgifk','8dpHl5Cs9Ew','alHqoj-LM4g','VnbPo4FDafY','ws4SG3uhGi0');
update public.yt_channel_videos v set group_ko=b.group_ko, members=b.members, content_flag=b.content_flag from public._bak_hold7_20261109 b where v.id=b.id;
update public.yt_channel_videos v set tags_manual=b.tags_manual from public._bak_hold7_20261109 b where v.id=b.id;
