create table if not exists public.bak_unhide_manual5_20261104 as select id,content_flag,flag_source,flagged_at,now() backed_at from public.yt_channel_videos where content_flag='hidden' and source_handle=group_ko and flag_source='manual';
alter table public.bak_unhide_manual5_20261104 enable row level security;
update public.yt_channel_videos t set content_flag=null, flag_source=null, flagged_at=null from public.bak_unhide_manual5_20261104 b where t.id=b.id and t.content_flag='hidden';
select t.id,t.group_ko,t.content_flag,left(t.title,60) t from public.yt_channel_videos t join public.bak_unhide_manual5_20261104 b using(id);
