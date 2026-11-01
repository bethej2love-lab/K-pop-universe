-- Confirmed by official YouTube oEmbed: ARIRANG K-POP/@arirangworld, HAWW JUHO.
-- Preserve the source video; remove only this wrong SF9 association and prevent automatic re-import.
UPDATE public.yt_channel_videos
SET group_ko=source_handle,members=ARRAY[]::text[],content_flag='무관',tags_manual=true,flag_source='manual',flagged_at=now(),needs_review=false
WHERE id='njWMQI0v5qY' AND title='[플리캠 4K] HAWW JUHO ''How Are You'' (하우 주호 직캠) l Simply K-Pop CON-TOUR Ep.560' AND source_handle='arirangworld'
 AND group_ko='에스에프나인' AND members=ARRAY['주호']::text[] AND tags_manual=false
 AND content_flag IS NULL AND flag_source IS NULL AND flagged_at IS NULL AND needs_review=true
 AND with_groups=ARRAY[]::text[] AND with_members=ARRAY[]::text[]
RETURNING id;
