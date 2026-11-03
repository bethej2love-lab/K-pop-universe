CREATE INDEX IF NOT EXISTS idx_yt_channel_videos_title_norm_trgm ON public.yt_channel_videos USING gin (title_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_yt_ch_vids_group_date ON public.yt_channel_videos USING btree (group_ko, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ytv_members ON public.yt_channel_videos USING gin (members);
CREATE INDEX IF NOT EXISTS idx_ytv_content_formats ON public.yt_channel_videos USING gin (content_formats);
CREATE INDEX IF NOT EXISTS idx_yt_channel_videos_with_members_gin ON public.yt_channel_videos USING gin (with_members);
CREATE INDEX IF NOT EXISTS idx_yt_channel_videos_with_groups_gin ON public.yt_channel_videos USING gin (with_groups);
