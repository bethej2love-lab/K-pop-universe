update yt_channel_videos v set category=b.category, tags_manual=b.tags_manual from _bak_fan_leftover_20261111 b where v.id=b.id;
