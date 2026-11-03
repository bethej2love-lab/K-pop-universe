-- 2026-11-04 yt_channel_videos 중복 인덱스 6개 제거 (정의가 완전히 같은 쌍둥이 중 덜 쓰이는 쪽)
-- 이유: 조회수 갱신(하루 2만여 건)마다 모든 인덱스를 다시 써서 Disk IO가 이중으로 들었음. 쌍둥이가 남아 조회 계획은 그대로.
-- 되돌리기: drop_duplicate_indexes_2026-11-04_undo.sql
DROP INDEX IF EXISTS public.idx_yt_channel_videos_title_norm_trgm;   -- = idx_ytcv_title_norm_trgm (164MB, 67회)
DROP INDEX IF EXISTS public.idx_yt_ch_vids_group_date;               -- = idx_ytv_group_published (0회)
DROP INDEX IF EXISTS public.idx_ytv_members;                         -- = idx_ytv_members_gin
DROP INDEX IF EXISTS public.idx_ytv_content_formats;                 -- = idx_ytv_content_formats_gin (4회)
DROP INDEX IF EXISTS public.idx_yt_channel_videos_with_members_gin;  -- = idx_ytv_with_members_gin
DROP INDEX IF EXISTS public.idx_yt_channel_videos_with_groups_gin;   -- = idx_ytv_with_groups_gin (85회)
