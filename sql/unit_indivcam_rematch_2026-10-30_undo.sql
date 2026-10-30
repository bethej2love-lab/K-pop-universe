update yt_channel_videos v set members=b.members from _bak_unit_rematch_20261030 b where v.id=b.id and coalesce(v.tags_manual,false)=false;
