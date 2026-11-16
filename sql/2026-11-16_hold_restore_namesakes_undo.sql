-- 되돌리기: 2026-11-16_hold_restore_namesakes.sql 실행 전 값으로(백업 표 bak_20261116_hold_restore). 그 뒤 바뀐 행도 덮으니 건수 먼저 확인.
select count(*) as will_restore from yt_channel_videos y join bak_20261116_hold_restore b using(id);
update yt_channel_videos y set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups,
  content_flag=b.content_flag, flag_source=b.flag_source, song_keys=b.song_keys
from bak_20261116_hold_restore b where b.id=y.id and y.tags_manual is not true;
