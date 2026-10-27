-- Expected: 5/1908/159 snapshots; remaining channel/video/milestone counts all zero.
SELECT op_label,count(*) backed_up FROM public.admin_bulk_snapshots
WHERE batch_id='codex-multifan-delete-20261027' GROUP BY op_label ORDER BY op_label;
SELECT
 (SELECT count(*) FROM public.ext_channels WHERE lower(ltrim(handle,'@')) IN ('day_daycam','leaaronfim','fancamlab','singing7532','mercury_vw')) remaining_channels,
 (SELECT count(*) FROM public.yt_channel_videos WHERE lower(ltrim(source_handle,'@')) IN ('day_daycam','leaaronfim','fancamlab','singing7532','mercury_vw')) remaining_videos,
 (SELECT count(*) FROM public.yt_view_milestones WHERE video_id IN
  (SELECT row_id FROM public.admin_bulk_snapshots WHERE batch_id='codex-multifan-delete-20261027' AND op_label='multifan:video')) remaining_milestones;
