-- 2026-11-18 Claude 검수(정적 페이지 스캔: 제목에 본인·본인 그룹 이름 없고 다른 사람 이름만 있는 카드)
-- 튜넥스 제온 ← '전효성 직캠 My name Jeon Hyo Seong' ('Jeon' 토큰 오인) → 전효성 솔로 키
-- 워너원 박우진 ← KIM WOOJIN(김우진, 스트레이키즈 전 멤버) 'Ready Now' 2건 → 김우진
-- 워너원 박우진 ← 틴틴 '책임져요'(WOOJIN 이우진) → 고스트나인 이우진
create table if not exists public.bak_20261118_scan1 as
  select id, group_ko, members, content_flag, flag_source, flagged_at from yt_channel_videos where id in ('-Xm-oGxlRW0','tjRBlsptRe4','jiKHq135xjo','rgBo-F9CHmA');
alter table public.bak_20261118_scan1 enable row level security;
revoke all on public.bak_20261118_scan1 from anon, authenticated;
update yt_channel_videos set group_ko='전효성', members=array['전효성'] where id='-Xm-oGxlRW0' and group_ko='제온' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='스트레이키즈', members=array['김우진'] where id in ('tjRBlsptRe4','jiKHq135xjo') and group_ko='워너원' and members=array['박우진'] and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='고스트나인', members=array['이우진'] where id='rgBo-F9CHmA' and group_ko='워너원' and members=array['박우진'] and content_flag is null and tags_manual=false;
select id, group_ko, members, content_flag from yt_channel_videos where id in ('-Xm-oGxlRW0','tjRBlsptRe4','jiKHq135xjo','rgBo-F9CHmA');
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, content_flag=b.content_flag, flag_source=b.flag_source, flagged_at=b.flagged_at from public.bak_20261118_scan1 b where v.id=b.id;
