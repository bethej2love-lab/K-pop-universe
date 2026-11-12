-- 되돌리기: sql/2026-11-12_lightsum_nayoung_fix.sql (백업 표 _bak_lightsum_nayoung_20261112에서 원래 값)
update yt_channel_videos t set tags_manual = false from _bak_lightsum_nayoung_20261112 b where t.id = b.id;
update yt_channel_videos t set group_ko = b.group_ko, members = b.members, with_members = b.with_members, song_keys = b.song_keys
  from _bak_lightsum_nayoung_20261112 b where t.id = b.id;
update yt_channel_videos t set tags_manual = b.tags_manual from _bak_lightsum_nayoung_20261112 b where t.id = b.id;
select count(*) restored from yt_channel_videos t join _bak_lightsum_nayoung_20261112 b using(id) where t.group_ko = b.group_ko;
