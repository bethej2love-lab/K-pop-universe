update yt_channel_videos v set group_ko=b.group_ko,members=b.members from _bak_audit27_20261030 b where v.id=b.id and coalesce(v.tags_manual,false)=false;
