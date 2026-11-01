-- Restore only the exact still-unmodified correction; source metadata remains untouched.
WITH before(id,title,group_ko,members,tags_manual,content_flag,flag_source,flagged_at,needs_review) AS (VALUES
('19GQEWCCk3c','[MV] Juho(주호) _ 그 하루','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('1YX6jiKm8Ag','[MV] Juho(주호) _ LoveSketch(러브스케치)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('3yj713M60Fs','[MV] Juho(주호) _ 안녕을 말할 때 (Live Clip)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('erjI_frQwDk','[MV] Juho(주호) _ 잘가요','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('hDHrAlgxH7Y','[MV] Juho(주호) _ 술도 못하는데','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('Iqt2lXvg78o','[MV] Juho(주호) _ 애인 있어요 (Live Clip)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('j6zvwd1R_ac','[MV] Juho(주호) _ Looks like love(사랑 같아 보여도)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('KPpE8TqDAmE','[MV] Juho(주호) _ 가장 아름다운 시간이었다','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('NtTMK531U40','[MV] Juho(주호) _ Hello and Goodbye(우리의 안녕)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('vFVYIPb_Stk','[MV] Juho(주호) _ Rusted Heart(녹슨 가슴)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('vThZ4KFn0hc','[MV] Juho(주호) _ 비가 오면 (Live Clip)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('VuNNtZcYiBI','[MV] Juho(주호) _ 어떻게 내가 널 잊고 살아','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true),
('zSXdy98Dnf0','[MV] Juho(주호), Nilo(닐로) _ The Last Letter(이별 편지) (Live Clip)','에스에프나인',ARRAY['주호']::text[],false,NULL,NULL,NULL::timestamptz,true)
)
UPDATE public.yt_channel_videos t SET group_ko=b.group_ko,members=b.members,tags_manual=b.tags_manual,content_flag=b.content_flag,flag_source=b.flag_source,flagged_at=b.flagged_at,needs_review=b.needs_review FROM before b WHERE t.id=b.id AND t.title=b.title AND t.group_ko='1theK' AND t.tags_manual=true AND t.content_flag='무관' AND t.flag_source='manual'
RETURNING t.id;
