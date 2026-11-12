-- 되돌리기: sql/2026-11-12_hero_cover_misattrib.sql
update yt_channel_videos set group_ko='온앤오프', cover_of_groups='{}' where id='3v028rIpFyQ';
update yt_channel_videos set with_members=array['김수민(트리플에스)'], cover_of_groups='{}' where id='6itY9tdrrMI';
update yt_channel_videos set members='{}' where id='lTGaCt415CI';
select id,group_ko,members,with_members,cover_of_groups from yt_channel_videos where id in ('3v028rIpFyQ','6itY9tdrrMI','lTGaCt415CI');
