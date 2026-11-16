-- 2026-11-16 코덱스 검수: 소디엑 리오 카드에 빅스 레오 영상 6건 — 소디엑 데뷔(2023.04.25) 이전(2021-11~2022-08) 업로드이고 제목이 '레오(LEO)'
-- (남아있어 Live = 빅스 레오 2021-11-02 첫 전역 후 싱글, Losing Game = 레오 솔로 Show!MusicCore/엠카운트다운 직캠, 1theK Preview·수트댄스 동시기). 소디엑 멤버의 영문 표기도 LEO라 이름이 겹쳐 잘못 붙었음.
-- 되돌리기: update yt_channel_videos v set group_ko=b.group_ko, members=b.members, with_members=b.with_members from bak_20261116_xodiac_leo b where v.id=b.id;
create table if not exists bak_20261116_xodiac_leo as select id, group_ko, members, with_members, with_groups, song_keys, tags_manual, content_flag, now() as backed_at from yt_channel_videos where id in ('h4Igck5aZg4','DSsFV98mGmI','xdCfKbxk_5M','UJrRYcbWPDs','yZpbxQKH4O4','u-6-FZOcQ-g');
alter table bak_20261116_xodiac_leo enable row level security;
update yt_channel_videos set group_ko='빅스', members=array['레오'] where id in ('h4Igck5aZg4','DSsFV98mGmI','xdCfKbxk_5M','UJrRYcbWPDs','yZpbxQKH4O4','u-6-FZOcQ-g') and group_ko='소디엑' and tags_manual is not true;
select id, group_ko, members from yt_channel_videos where id in (select id from bak_20261116_xodiac_leo) order by id;
