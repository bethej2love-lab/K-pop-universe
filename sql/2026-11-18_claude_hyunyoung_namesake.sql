-- 2026-11-18 Claude 검수: 조현영(레인보우) ← 2006년 방송인 현영의 데뷔 싱글 '누나의 꿈' MV(1theK) → 무관 (레인보우 데뷔 2009, 출처 maniadb/멜론)
create table if not exists public.bak_20261118_hyunyoung as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id='0P_ur4NLL4k';
alter table public.bak_20261118_hyunyoung enable row level security;
revoke all on public.bak_20261118_hyunyoung from anon, authenticated;
update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now() where id='0P_ur4NLL4k' and content_flag is null and tags_manual=false;
select id, group_ko, members, content_flag from yt_channel_videos where id='0P_ur4NLL4k';
-- 되돌리기: update yt_channel_videos v set content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_hyunyoung b where v.id=b.id;
