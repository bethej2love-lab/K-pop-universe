-- group_mv_member_tags_2026-10-28.sql 되돌리기 — 백업 표 값으로 복원(tags_manual이 true인 행은 트리거가 태그 칸 변경을 막으므로 먼저 false로)
update yt_channel_videos v set tags_manual=false from ops_group_mv_tags_bak_20261028 b where v.id=b.id;
update yt_channel_videos v set members=b.members, with_members=b.with_members, with_groups=b.with_groups
  from ops_group_mv_tags_bak_20261028 b where v.id=b.id;
update yt_channel_videos v set tags_manual=b.tags_manual from ops_group_mv_tags_bak_20261028 b where v.id=b.id;
