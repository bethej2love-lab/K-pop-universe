-- 되돌리기: sql/2026-11-12_codex_mistag_batch.sql (백업 표 _bak_codex_mistag_20261112)
update yt_channel_videos t set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups, cover_of_groups=b.cover_of_groups, content_flag=b.content_flag
  from _bak_codex_mistag_20261112 b where t.id=b.id;
select count(*) restored from _bak_codex_mistag_20261112;
