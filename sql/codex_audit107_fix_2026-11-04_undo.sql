-- 되돌리기(잠금 해제 → 복원 → 원래 잠금 상태)
update public.yt_channel_videos t set tags_manual=false from public.bak_codex_audit107_20261104 b where t.id=b.id;
update public.yt_channel_videos t set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups,
  cover_of_members=b.cover_of_members, cover_of_groups=b.cover_of_groups, cover_of_song=b.cover_of_song, content_flag=b.content_flag, flag_source=b.flag_source, cover_manual=b.cover_manual
from public.bak_codex_audit107_20261104 b where t.id=b.id;
update public.yt_channel_videos t set tags_manual=b.tags_manual from public.bak_codex_audit107_20261104 b where t.id=b.id;
