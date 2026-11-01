-- User-confirmed JUHO/Nilo is not SF9 ZUHO. Preserve source rows to prevent re-import.
-- Run only after inspecting these exact 13 automatic singleton tags; no video/user record deletion.
UPDATE public.yt_channel_videos SET group_ko=source_handle,members=ARRAY[]::text[],content_flag='무관',tags_manual=true,flag_source='manual',flagged_at=now(),needs_review=false
WHERE id IN ('19GQEWCCk3c','1YX6jiKm8Ag','3yj713M60Fs','erjI_frQwDk','hDHrAlgxH7Y','Iqt2lXvg78o','j6zvwd1R_ac','KPpE8TqDAmE','NtTMK531U40','vFVYIPb_Stk','vThZ4KFn0hc','VuNNtZcYiBI','zSXdy98Dnf0') AND source_handle='1theK' AND group_ko='에스에프나인' AND members=ARRAY['주호']::text[] AND coalesce(tags_manual,false)=false AND content_flag IS NULL AND coalesce(cardinality(with_groups),0)=0 AND coalesce(cardinality(with_members),0)=0
RETURNING id;
