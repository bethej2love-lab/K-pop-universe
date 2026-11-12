-- 되돌리기: sql/2026-11-12_embed_blocked_and_hero_tags.sql
update yt_channel_videos t set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups, song_keys=b.song_keys
  from _bak_hero_solo_20261112 b where t.id=b.id;
update yt_channel_videos set embed_blocked_at=null where id in ('a3ZwmFvB_9U','x-j_4z1uGtw','nGLGeuNi_aE');
-- 표식 열·함수까지 없애려면: drop function report_embed_blocked(text,int); alter table yt_channel_videos drop column embed_blocked_at;
