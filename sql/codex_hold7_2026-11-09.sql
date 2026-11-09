-- Codex 11-06 보류 7건 결론(2026-11-09 Claude Code). 백업 _bak_hold7_20261109
create table if not exists public._bak_hold7_20261109 as select * from public.yt_channel_videos where id in ('0aDg4Amd85I','1rQmfYgy0OE','46PrVlOgifk','8dpHl5Cs9Ew','alHqoj-LM4g','VnbPo4FDafY','ws4SG3uhGi0');
alter table public._bak_hold7_20261109 enable row level security;
update public.yt_channel_videos set tags_manual=false where id in ('0aDg4Amd85I','1rQmfYgy0OE','46PrVlOgifk','8dpHl5Cs9Ew','alHqoj-LM4g','VnbPo4FDafY','ws4SG3uhGi0');
-- DAZED 2022-08 화보 'PARK JINYOUNG' = 갓세븐 진영(배우 박진영). 워너원 배진영 아님
update public.yt_channel_videos set group_ko='갓세븐', members=array['진영']::text[], content_flag=null where id='8dpHl5Cs9Ew' and group_ko='워너원';
-- 일반어 '여자친구'(아는형님 비비·크러쉬 / 오케이 마담 팀 / 최애의 사원), '시크릿커버'(익명 가수), JYP 박진영(Graduation 1998·싱크로유 박진영 특집) → 무관
update public.yt_channel_videos set content_flag='무관', members='{}'::text[] where id in ('0aDg4Amd85I','1rQmfYgy0OE','46PrVlOgifk','alHqoj-LM4g','VnbPo4FDafY','ws4SG3uhGi0') and content_flag='보류';
update public.yt_channel_videos set tags_manual=true where id in ('0aDg4Amd85I','1rQmfYgy0OE','46PrVlOgifk','8dpHl5Cs9Ew','alHqoj-LM4g','VnbPo4FDafY','ws4SG3uhGi0');
select id, group_ko, members, content_flag, tags_manual from public.yt_channel_videos where id in ('0aDg4Amd85I','1rQmfYgy0OE','46PrVlOgifk','8dpHl5Cs9Ew','alHqoj-LM4g','VnbPo4FDafY','ws4SG3uhGi0');
