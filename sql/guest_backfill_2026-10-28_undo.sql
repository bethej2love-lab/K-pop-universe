-- guest_backfill_2026-10-28.sql 되돌리기
update yt_channel_videos y set with_members=b.with_members from ops_guest_backfill_bak_20261028 b where b.id=y.id;
