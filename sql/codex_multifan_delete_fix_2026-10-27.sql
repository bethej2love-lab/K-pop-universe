-- Confirmed multi-group fan channels only. Dedicated April Fools channels are retained.
-- Atomic backup + deletion; abort on any preflight drift. No temporary tables.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $cleanup$
DECLARE
 handles text[] := ARRAY['Day_DayCAM','LEAARONFIM','FancamLab','singing7532','MERCURY_VW'];
 n bigint;
 h text;
BEGIN
 LOCK TABLE public.ext_channels, public.yt_channel_videos, public.yt_view_milestones IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS (SELECT 1 FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027') THEN
  RAISE EXCEPTION 'Backup batch already exists; run verify instead of repeating deletion';
 END IF;
 SELECT count(*) INTO n FROM public.ext_channels WHERE handle=ANY(handles) AND tier='fans';
 IF n<>5 THEN RAISE EXCEPTION 'Channel preflight mismatch: %',n; END IF;
 SELECT count(*),md5(string_agg(id,',' ORDER BY id)) INTO n,h
 FROM public.yt_channel_videos WHERE lower(ltrim(source_handle,'@'))=ANY(ARRAY['day_daycam','leaaronfim','fancamlab','singing7532','mercury_vw']);
 IF n<>1908 OR h IS DISTINCT FROM 'accf1945ea5ac5639785e41380da1531' THEN RAISE EXCEPTION 'Video preflight drift: % %',n,h; END IF;
 SELECT count(*) INTO n FROM public.yt_view_milestones WHERE video_id IN
 (SELECT id FROM public.yt_channel_videos WHERE lower(ltrim(source_handle,'@'))=ANY(ARRAY['day_daycam','leaaronfim','fancamlab','singing7532','mercury_vw']));
 IF n<>159 THEN RAISE EXCEPTION 'Milestone preflight drift: %',n; END IF;
 INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
 SELECT 'codex-multifan-delete-20261027','multifan:channel',handle,to_jsonb(c)
 FROM public.ext_channels c WHERE handle=ANY(handles);
 INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
 SELECT 'codex-multifan-delete-20261027','multifan:video',id,to_jsonb(v)
 FROM public.yt_channel_videos v WHERE lower(ltrim(source_handle,'@'))=ANY(ARRAY['day_daycam','leaaronfim','fancamlab','singing7532','mercury_vw']);
 INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
 SELECT 'codex-multifan-delete-20261027','multifan:milestone',video_id||':'||tier,to_jsonb(m)
 FROM public.yt_view_milestones m WHERE video_id IN
 (SELECT row_id FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:video');
 SELECT count(*) INTO n FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027';
 IF n<>2072 THEN RAISE EXCEPTION 'Backup count mismatch: %',n; END IF;
 DELETE FROM public.yt_view_milestones WHERE video_id IN
 (SELECT row_id FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:video');
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>159 THEN RAISE EXCEPTION 'Milestone deletion mismatch: %',n; END IF;
 DELETE FROM public.yt_channel_videos WHERE id IN
 (SELECT row_id FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:video');
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1908 THEN RAISE EXCEPTION 'Video deletion mismatch: %',n; END IF;
 DELETE FROM public.ext_channels WHERE handle=ANY(handles);
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>5 THEN RAISE EXCEPTION 'Channel deletion mismatch: %',n; END IF;
END $cleanup$;
COMMIT;
