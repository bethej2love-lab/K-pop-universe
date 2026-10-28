-- codex_audit18_fix_2026-10-28.sql 되돌리기 — 잠금 행은 false로 풀고 되돌린 뒤 원래 잠금 값으로
update yt_channel_videos y set tags_manual=false from ops_codex_audit18_bak_20261028 b where b.id=y.id;
update yt_channel_videos y set group_ko=b.group_ko,members=b.members,with_members=b.with_members,with_groups=b.with_groups,
  cover_of_members=b.cover_of_members,cover_of_song=b.cover_of_song,cover_manual=b.cover_manual,content_flag=b.content_flag
from ops_codex_audit18_bak_20261028 b where b.id=y.id;
update yt_channel_videos y set tags_manual=b.tags_manual from ops_codex_audit18_bak_20261028 b where b.id=y.id;
