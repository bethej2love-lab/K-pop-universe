-- 2026-11-02 Disk IO 경고 대응 2차 — 발견 '오리지널 콘텐츠' 선반(_buildFeedJacon: source_tier=idol·is_short=false 최신순 200). 이미 실행함(Claude Code)
-- 실측 3.97초·8,881블록 → 0.033초·201블록
create index concurrently if not exists idx_ytv_idol_long_published on yt_channel_videos (published_at desc) where source_tier='idol' and is_short=false;
-- 되돌리기: drop index concurrently if exists idx_ytv_idol_long_published;
