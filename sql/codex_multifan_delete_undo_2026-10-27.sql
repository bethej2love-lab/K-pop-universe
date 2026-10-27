-- Manual rollback only: restore all 2072 backed-up rows atomically; never overwrite existing rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $undo$
DECLARE n bigint;
BEGIN
 LOCK TABLE public.ext_channels, public.yt_channel_videos, public.yt_view_milestones IN SHARE ROW EXCLUSIVE MODE;
 IF (SELECT count(*) FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:channel')<>5
 OR (SELECT count(*) FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:video')<>1908
 OR (SELECT count(*) FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:milestone')<>159
 THEN RAISE EXCEPTION 'Backup incomplete'; END IF;
 INSERT INTO public.ext_channels SELECT (jsonb_populate_record(NULL::public.ext_channels,before_data)).*
 FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:channel';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>5 THEN RAISE EXCEPTION 'Channel restore mismatch'; END IF;
 INSERT INTO public.yt_channel_videos SELECT (jsonb_populate_record(NULL::public.yt_channel_videos,before_data)).*
 FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:video';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1908 THEN RAISE EXCEPTION 'Video restore mismatch'; END IF;
 INSERT INTO public.yt_view_milestones SELECT (jsonb_populate_record(NULL::public.yt_view_milestones,before_data)).*
 FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:milestone';
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>159 THEN RAISE EXCEPTION 'Milestone restore mismatch'; END IF;
END $undo$;
COMMIT;
-- After rollback rebuild album video assets in full.
