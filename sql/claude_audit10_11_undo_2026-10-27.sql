-- claude_audit10_11_fix_2026-10-27.sql 되돌리기 — 백업 표의 원래 태그·플래그로 복원
UPDATE yt_channel_videos v SET
  group_ko = b.group_ko, members = b.members, with_members = b.with_members, with_groups = b.with_groups,
  cover_of_groups = b.cover_of_groups, cover_of_members = b.cover_of_members, cover_of_song = b.cover_of_song,
  content_flag = b.content_flag, flag_source = b.flag_source, flagged_at = b.flagged_at,
  needs_review = b.needs_review, tags_manual = b.tags_manual, cover_manual = b.cover_manual
FROM ops_claude_fix_20261027 b WHERE v.id = b.id;
