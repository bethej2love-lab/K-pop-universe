-- 2026-11-11 쇼케이팝(@showkpop.official) 추가 — 음방 회차 조회용 부분 인덱스(idx_ytv_music_show_ch, sql/music_show_episode_index_2026-11-03.sql)의
-- WHERE에 채널을 더한다. 인덱스 밖 채널을 source_handle로 조회하면 큰 표 전체를 훑어 시간 초과(57014)가 난다.
-- 서비스 중단 없이: 새 인덱스를 먼저 만들고 → 옛것을 지우고 → 이름을 원래대로.
-- ⚠️ concurrently는 트랜잭션 안에서 못 돈다 — 한 문장씩 따로 실행할 것(2026-11-11 실행 완료, 마지막 select로 확인).
create index concurrently if not exists idx_ytv_music_show_ch2 on yt_channel_videos (source_handle, published_ts)
where source_handle in ('KBSKpop','kbsworldtv','MnetM2','Mnet','MBCkpop','SBSKPOP','SBSKPOP_ZOOM','ALLTHEKPOP','thekpop','showkpop.official');
drop index concurrently if exists idx_ytv_music_show_ch;
alter index idx_ytv_music_show_ch2 rename to idx_ytv_music_show_ch;
select indexname, indexdef from pg_indexes where indexname like 'idx_ytv_music_show_ch%';
