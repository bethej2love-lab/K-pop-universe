-- 2026-11-18 Claude 검수(tag_patrol A): 배진영(워너원 Jinyoung) 카드에 JYP 박진영 KBS The Seasons S9 EP.29 4건 → 무관(박진영 미등록)
create table if not exists public.bak_20261118_jinyoung_jyp as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id in ('4Rw-JUPv5Kw','3HbyM7axAdk','sfSuhAduF8A','nBXiJOlbgHs');
alter table public.bak_20261118_jinyoung_jyp enable row level security;
revoke all on public.bak_20261118_jinyoung_jyp from anon, authenticated;
update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now() where id in ('4Rw-JUPv5Kw','3HbyM7axAdk','sfSuhAduF8A','nBXiJOlbgHs') and group_ko='배진영' and content_flag is null and tags_manual=false;
select id, group_ko, members, content_flag from yt_channel_videos where id in ('4Rw-JUPv5Kw','3HbyM7axAdk','sfSuhAduF8A','nBXiJOlbgHs');
-- 되돌리기: update yt_channel_videos v set content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_jinyoung_jyp b where v.id=b.id;
