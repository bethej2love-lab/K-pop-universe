-- 되돌리기(잠금 3단계)
update public.yt_channel_videos t set tags_manual=false from public.bak_role_swap_20261104 b where t.id=b.id;
update public.yt_channel_videos t set members=b.members, with_members=b.with_members from public.bak_role_swap_20261104 b where t.id=b.id;
update public.yt_channel_videos t set tags_manual=true from public.bak_role_swap_20261104 b where t.id=b.id;
