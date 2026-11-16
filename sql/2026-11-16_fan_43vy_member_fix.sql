-- 2026-11-16 코덱스 검수: 성화 팬채널(43_vy)의 다른 멤버 solo 직캠 2건 — 제목에 'YEOSANG 여상 solo fancam'·'WOOYOUNG 우영 solo'가 명시인데 성화로 저장
-- (여상 Legacy VY6B-XeXfW8가 성화 In Your Fantasy 직캠 모음에 섞여 있던 것). 채널 전체(43_vy)에서 '제목에 성화 없음 + members=성화' 조회 결과 이 2건뿐.
-- 되돌리기: update yt_channel_videos v set members=b.members from bak_20261116_43vy b where v.id=b.id;
create table if not exists bak_20261116_43vy as select id, group_ko, members, with_members, song_keys, tags_manual, now() as backed_at from yt_channel_videos where id in ('VY6B-XeXfW8','IQUBBojdcPs');
alter table bak_20261116_43vy enable row level security;
update yt_channel_videos set members = array['여상'] where id = 'VY6B-XeXfW8' and tags_manual is not true and members = array['성화'];
update yt_channel_videos set members = array['우영'] where id = 'IQUBBojdcPs' and tags_manual is not true and members = array['성화'];
select id, members from yt_channel_videos where id in ('VY6B-XeXfW8','IQUBBojdcPs') order by id;
