-- 되돌리기: 백업 표 값으로 복원(그 뒤 수동 잠금된 행은 제외)
update public.yt_channel_videos t set members=b.members, with_members=b.with_members from public.bak_outsider_members_20261104 b where t.id=b.id and t.tags_manual=false;
