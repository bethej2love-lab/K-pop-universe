-- codex_audit12_17_fix_2026-10-28.sql 되돌리기 — 백업 표 값으로 복원(잠금 해제 → 복원 → 원래 잠금값)
update yt_channel_videos v set tags_manual=false, cover_manual=false from ops_codex_audit1217_bak_20261028 b where v.id=b.id;
update yt_channel_videos v set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups,
  cover_of_groups=b.cover_of_groups, cover_of_members=b.cover_of_members, cover_of_song=b.cover_of_song, content_flag=b.content_flag
  from ops_codex_audit1217_bak_20261028 b where v.id=b.id;
update yt_channel_videos v set tags_manual=b.tags_manual, cover_manual=b.cover_manual from ops_codex_audit1217_bak_20261028 b where v.id=b.id;
