-- 2026-11-18 팬채널 정리 — 기준(사용자): "아티스트 특히 멤버 중심 직캠 채널만, 공항 캠·여러 아티스트 업로드 채널은 반려, 기준 밖이면 전체 삭제".
-- 팬채널 458곳을 직캠 비율·공항 비율·주인 멤버 언급·타 그룹 비율로 거른 뒤 제목을 직접 읽고 판정한 기준 밖 7곳(영상 6,496, 수동 태그 0):
--   RukaKawaiFanpage 3,329(루카 관련 팬 반응·재업로드 모음) · Coating-ae 1,951(에스파 근황·감상 편집, 주인 멤버 없음)
--   Jeemin_Fanpage 542(방지민 편집·모음) · 엔믹스세계정복 342(감상·분석 편집) · maxaieni 201(엑소 편집 + FT아일랜드·소녀시대·블랙핑크)
--   fernhoon_12psh59 85(여러 아티스트 팬 에디트) · smallovelzia 46(플레이리스트·가사 해석)
-- 영상·채널 등록 모두 백업 후 삭제(백업 표는 RLS로 잠금). 채널 등록도 지워 다시 수집되지 않게 한다.
create table if not exists public.bak_20261118_fanch_videos as
  select * from yt_channel_videos where source_handle in ('RukaKawaiFanpage','Coating-ae','Jeemin_Fanpage','엔믹스세계정복','maxaieni','fernhoon_12psh59','smallovelzia');
alter table public.bak_20261118_fanch_videos enable row level security;
revoke all on public.bak_20261118_fanch_videos from anon, authenticated;
create table if not exists public.bak_20261118_fanch_channels as
  select * from ext_channels where handle in ('RukaKawaiFanpage','Coating-ae','Jeemin_Fanpage','엔믹스세계정복','maxaieni','fernhoon_12psh59','smallovelzia');
alter table public.bak_20261118_fanch_channels enable row level security;
revoke all on public.bak_20261118_fanch_channels from anon, authenticated;

delete from yt_view_milestones where video_id in (select id from public.bak_20261118_fanch_videos);
delete from yt_channel_videos where id in (select id from public.bak_20261118_fanch_videos) and coalesce(tags_manual,false)=false;
delete from ext_channels where handle in (select handle from public.bak_20261118_fanch_channels);

select (select count(*) from public.bak_20261118_fanch_videos) backed_up_videos,
       (select count(*) from yt_channel_videos where source_handle in ('RukaKawaiFanpage','Coating-ae','Jeemin_Fanpage','엔믹스세계정복','maxaieni','fernhoon_12psh59','smallovelzia')) remaining_videos,
       (select count(*) from public.bak_20261118_fanch_channels) backed_up_channels,
       (select count(*) from ext_channels where handle in ('RukaKawaiFanpage','Coating-ae','Jeemin_Fanpage','엔믹스세계정복','maxaieni','fernhoon_12psh59','smallovelzia')) remaining_channels;
-- 되돌리기: insert into ext_channels select * from public.bak_20261118_fanch_channels; insert into yt_channel_videos select * from public.bak_20261118_fanch_videos;
