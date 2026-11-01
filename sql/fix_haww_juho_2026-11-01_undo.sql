-- Before snapshot: only restore the still-identical correction, never overwrite later retagging.
UPDATE public.yt_channel_videos
SET group_ko='에스에프나인',members=ARRAY['주호']::text[],content_flag=NULL,tags_manual=false,flag_source=NULL,flagged_at=NULL,needs_review=true
WHERE id='njWMQI0v5qY' AND title='[플리캠 4K] HAWW JUHO ''How Are You'' (하우 주호 직캠) l Simply K-Pop CON-TOUR Ep.560' AND source_handle='arirangworld'
 AND group_ko='arirangworld' AND members=ARRAY[]::text[] AND tags_manual=true
 AND content_flag='무관' AND flag_source='manual' AND needs_review=false
 AND with_groups=ARRAY[]::text[] AND with_members=ARRAY[]::text[]
RETURNING id;
