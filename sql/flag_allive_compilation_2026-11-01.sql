-- User-supplied multi-group ALLIVE compilation: cards remain visible, collab edges excluded.
UPDATE public.yt_channel_videos SET content_flag='개별출연',flag_source='auto',flagged_at=now()
WHERE id='QDm_Mb7nPhs' AND title='[ALLIVE] 5세대 하이브 아이돌 총집합✨ 라이브 모음집 | #MBCRADIO #CORTIS #ILLIT #TUIDE #SANTOSBRAVOS | MBC 250909 방송 외' AND group_ko='코르티스' AND tags_manual=false AND content_flag IS NULL AND with_groups=ARRAY['아일릿','튜이드']::text[]
RETURNING id,content_flag,flag_source;
