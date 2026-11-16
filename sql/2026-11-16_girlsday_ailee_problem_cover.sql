-- 2026-11-16 Codex 11-16: 걸스데이×에일리 2014 MAMA 'Problem' 합동 커버(go1eimkJ15Y) — 원곡 표시가 "니콜(카라)"·곡 'MAMA'(제목의 MAMA를 곡으로 읽음)로 잘못 저장돼 있었다.
-- 원곡은 Ariana Grande feat. Iggy Azalea 'Problem'(미등록 아티스트라 원곡 그룹·멤버 없음). 걸스데이 주인 유지(에일리는 미등록이라 함께 출연 칸에 안 넣음).
-- 되돌리기: update yt_channel_videos set cover_of_members=array['니콜(카라)'], cover_of_song='MAMA', with_members='{}' where id='go1eimkJ15Y';
update yt_channel_videos set cover_of_members='{}', cover_of_groups='{}', cover_of_song='Problem'
where id='go1eimkJ15Y' and cover_manual is not true and tags_manual is not true and cover_of_members=array['니콜(카라)'];
select id, cover_of_members, cover_of_song, with_members from yt_channel_videos where id='go1eimkJ15Y';
