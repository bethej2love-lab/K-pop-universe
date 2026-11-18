-- 2026-11-18 Claude 검수(정적 페이지 스캔 3 — 직캠 허브 card 형식 포함 15.7만 카드): 제목의 실제 주인으로 재배정 8건
-- 앤더블 장하오 ← 팬채널 STAYwithZHANGHAO 'April Fool's Day'의 태민 셜록 직캠(→샤이니 태민, 잘못된 with_members '태민(하이파이유니콘)' 제거) / GDA WATER 민규 직캠(→세븐틴 민규)
-- 르세라핌 김채원 ← 팬채널 Mellifluous_cw의 조유리 'TAXI' 직캠(→조유리 솔로 키, with_members 비움)
-- 위너 김진우 ← 틴틴 JINWOO 3건(→고스트나인 이진우), 1TEAM JINWOO 롤링롤링(→오메가엑스 XEN, 1TEAM 출신 진우)
create table if not exists public.bak_20261118_scan3 as
  select id, group_ko, members, with_members, with_groups, content_flag from yt_channel_videos where id in ('E2eYNFiQfZA','MT9bUVXwaNA','K8w0EO0WUXs','HvQ8NHg5Xzo','ibDc4-ZqXbE','Kqm3YXTgIkg','rSb-e9S8gk0');
alter table public.bak_20261118_scan3 enable row level security;
revoke all on public.bak_20261118_scan3 from anon, authenticated;
update yt_channel_videos set group_ko='샤이니', members=array['태민'], with_members='{}' where id='E2eYNFiQfZA' and group_ko='앤더블' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='세븐틴', members=array['민규'] where id='MT9bUVXwaNA' and group_ko='앤더블' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='조유리', members=array['조유리'], with_members='{}' where id='K8w0EO0WUXs' and group_ko='르세라핌' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='고스트나인', members=array['이진우'] where id in ('HvQ8NHg5Xzo','ibDc4-ZqXbE','Kqm3YXTgIkg') and group_ko='위너' and content_flag is null and tags_manual=false;
update yt_channel_videos set group_ko='오메가엑스', members=array['XEN'] where id='rSb-e9S8gk0' and group_ko='위너' and content_flag is null and tags_manual=false;
select id, group_ko, members, with_members, content_flag from yt_channel_videos where id in ('E2eYNFiQfZA','MT9bUVXwaNA','K8w0EO0WUXs','HvQ8NHg5Xzo','ibDc4-ZqXbE','Kqm3YXTgIkg','rSb-e9S8gk0');
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, with_members=b.with_members, with_groups=b.with_groups from public.bak_20261118_scan3 b where v.id=b.id;
