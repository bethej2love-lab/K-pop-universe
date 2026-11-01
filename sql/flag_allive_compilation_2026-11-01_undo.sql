-- Before snapshot had null flag/source/time; guard the exact automatic correction.
UPDATE public.yt_channel_videos SET content_flag=NULL,flag_source=NULL,flagged_at=NULL
WHERE id='QDm_Mb7nPhs' AND title='[ALLIVE] 5세대 하이브 아이돌 총집합✨ 라이브 모음집 | #MBCRADIO #CORTIS #ILLIT #TUIDE #SANTOSBRAVOS | MBC 250909 방송 외' AND tags_manual=false AND content_flag='개별출연' AND flag_source='auto'
RETURNING id;
