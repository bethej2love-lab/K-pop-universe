-- 2026-11-02 Disk IO 예산 경고 대응 — 파도타기(_surfFetch) 그룹별 조회수순 쿼리용. 이미 실행함(Claude Code, Management API)
-- 실측: 4그룹 or 묶음 조회수순 60개 = 27,000행·15,525블록·4.2초 → 그룹 하나씩 이 인덱스로 63블록·0.002초
create index concurrently if not exists idx_ytv_group_viewcount on yt_channel_videos (group_ko, view_count desc nulls last);
-- 되돌리기: drop index concurrently if exists idx_ytv_group_viewcount;
