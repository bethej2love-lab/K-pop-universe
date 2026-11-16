-- 되돌리기: 2026-11-16_codex_firstgen_mistag_fix.sql 실행 전 값으로 복원(백업 표 bak_20261116_codex_firstgen 기준)
-- 그 뒤에 값이 또 바뀐 행은 덮어쓰게 되니, 실행 전 아래 조회로 건수를 먼저 확인할 것.
select count(*) as will_restore from yt_channel_videos y join bak_20261116_codex_firstgen b on b.id=y.id;

update yt_channel_videos y
set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups,
    cover_of_groups=b.cover_of_groups, cover_of_members=b.cover_of_members, cover_of_song=b.cover_of_song,
    content_flag=b.content_flag, flag_source=b.flag_source
from bak_20261116_codex_firstgen b
where b.id=y.id and y.tags_manual is not true;
