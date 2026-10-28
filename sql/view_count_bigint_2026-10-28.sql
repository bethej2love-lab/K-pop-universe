-- view_count int4(최대 2,147,483,647) → bigint (Codex 감사16차, 2026-10-28)
-- 강남스타일·뚜두뚜두·Kill This Love·Dynamite·APT. 5개는 조회수가 int4 한도를 넘어 저장이 안 돼 NULL → 역대 MV 차트에서 통째로 빠졌다.
-- 이 칸을 쓰는 뷰·함수는 없음(10-28 확인), 인덱스 3개는 같이 다시 만들어진다. 1.2GB 표 재작성 — 도는 동안 영상 조회가 잠깐 막힌다.
-- 실패하면 자동 롤백. 실행 뒤 수집기(_ytViewCountCore)가 view_count_synced_at이 빈 5개를 다음 회차에 다시 채운다.
set lock_timeout='5s';
set statement_timeout='15min';
alter table yt_channel_videos alter column view_count type bigint;
select data_type from information_schema.columns where table_name='yt_channel_videos' and column_name='view_count';
