-- 되돌리기: sql/2026-11-13_codex_ko1keyz_chem.sql
update yt_channel_videos v set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups, content_flag=b.content_flag
from public._bak_codex_ko1keyz_20261113 b where v.id=b.id;
