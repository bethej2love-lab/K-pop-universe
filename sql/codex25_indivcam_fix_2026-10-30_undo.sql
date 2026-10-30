-- 되돌리기(tags_manual 트리거 때문에 잠금 먼저 풀고 복원)
update yt_channel_videos v set tags_manual=false from _bak_codex25_indivcam_20261030 b where v.id=b.id;
update yt_channel_videos v set members=b.members,with_members=b.with_members,with_groups=b.with_groups,tags_manual=b.tags_manual from _bak_codex25_indivcam_20261030 b where v.id=b.id;
