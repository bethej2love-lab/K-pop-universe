update public.yt_channel_videos t set tags_manual=false from public.bak_codex_audit116_20261104 b where t.id=b.id;
update public.yt_channel_videos t set with_members=b.with_members, content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at, needs_review=b.needs_review
from public.bak_codex_audit116_20261104 b where t.id=b.id;
update public.yt_channel_videos t set tags_manual=b.tags_manual from public.bak_codex_audit116_20261104 b where t.id=b.id;
