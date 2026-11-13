-- 2026-11-13 인스타 영상 사이트 안 재생: 최신 수집이 받는 영상 파일 주소(media_url, 며칠 뒤 만료)
alter table public.ig_media add column if not exists v text;
select count(*) as cols from information_schema.columns where table_name='ig_media' and column_name='v';
