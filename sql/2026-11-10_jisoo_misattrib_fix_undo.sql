update public.yt_channel_videos v set group_ko=b.group_ko,members=b.members,with_members=b.with_members,with_groups=b.with_groups,tags_manual=b.tags_manual,content_flag=b.content_flag
from public._bak_jisoo_fix_20261110 b where v.id=b.id;
