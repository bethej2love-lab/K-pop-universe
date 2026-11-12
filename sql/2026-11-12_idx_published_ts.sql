-- 2026-11-12 '이번 주 많이 본 직캠'(최근 7일 게시) 조회가 전체 훑기 6초 — 게시 시각 인덱스(다른 최신순 조회도 혜택)
create index concurrently if not exists idx_ytcv_published_ts on public.yt_channel_videos (published_ts);
