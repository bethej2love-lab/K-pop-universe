-- 2026-11-18 Claude 검수(Codex 메모 이어받음): 에이핑크 윤보미 모음에 박초롱 직캠 9건 + 슈가 박수진 동명이인 '빈자리'
-- 셀빠 직캠 제목이 전부 '에이핑크 박초롱'인데 members=[윤보미] → 박초롱으로(Hush는 박초롱+손나은)
-- 슈가 박수진 eDvdRGVAL-4 'Daydreamin','빈자리' = Brave 소속 가수 박수진(2014 싱글 '빈자리(Fallin)') → 무관
create table if not exists public.bak_20261118_apink_bomi as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id in ('mGZkHrlMD6g','g2WimcVJUp8','Ysg3lSBhq0k','9gA4HgogRUE','QwYRo_Jb2Bg','-BJeEJ9p1ZE','TaIRjbmFdv0','OGbjcv5B6GQ','u4ov9FTcHpw','eDvdRGVAL-4');
alter table public.bak_20261118_apink_bomi enable row level security;
revoke all on public.bak_20261118_apink_bomi from anon, authenticated;
update yt_channel_videos set members=array['박초롱'] where id in ('mGZkHrlMD6g','g2WimcVJUp8','Ysg3lSBhq0k','9gA4HgogRUE','QwYRo_Jb2Bg','-BJeEJ9p1ZE','OGbjcv5B6GQ','u4ov9FTcHpw') and group_ko='에이핑크' and members=array['윤보미'] and content_flag is null and tags_manual=false;
update yt_channel_videos set members=array['박초롱','손나은'] where id='TaIRjbmFdv0' and group_ko='에이핑크' and members=array['윤보미'] and content_flag is null and tags_manual=false;
update yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now() where id='eDvdRGVAL-4' and content_flag is null and tags_manual=false;
select id, group_ko, members, content_flag from yt_channel_videos where id in ('mGZkHrlMD6g','g2WimcVJUp8','Ysg3lSBhq0k','9gA4HgogRUE','QwYRo_Jb2Bg','-BJeEJ9p1ZE','TaIRjbmFdv0','OGbjcv5B6GQ','u4ov9FTcHpw','eDvdRGVAL-4');
-- 되돌리기: update yt_channel_videos v set members=b.members, content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_apink_bomi b where v.id=b.id;
