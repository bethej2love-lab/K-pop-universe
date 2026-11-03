-- 음방 회차 페이지(2026-11-03)용 — 방송사 9개 채널 영상만 날짜순으로 빨리 찾는 작은 부분 인덱스.
-- source_handle·published_ts에 인덱스가 없어 KBSKpop 등 큰 채널 조회가 시간 초과(57014)였다. 되돌리기: drop index if exists idx_ytv_music_show_ch;
create index concurrently if not exists idx_ytv_music_show_ch on yt_channel_videos (source_handle, published_ts)
where source_handle in ('KBSKpop','kbsworldtv','MnetM2','Mnet','MBCkpop','SBSKPOP','SBSKPOP_ZOOM','ALLTHEKPOP','thekpop');
