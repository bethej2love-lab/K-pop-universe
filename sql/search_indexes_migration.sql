-- 검색 확장 4단계(2026-08-31) — 영상 제목 / 공연 제목 부분일치 검색용 인덱스
--
-- 배경: 인앱 검색이 그룹 268 + 아티스트 1,731 ≈ 2,000개만 커버하고 있었다. 실측하면 곡 26,506 ·
-- 앨범 6,415 · 영상 379,835 · 공연 741 ≈ 413,000개가 검색 밖이었다(= 전체의 0.5%만 검색 가능).
-- 곡은 groups.json/artists.json에 있어 클라이언트에서 처리했고, 영상·공연은 DB를 쳐야 한다.
--
-- ⚠️ 이 인덱스가 **없어도 검색은 동작한다** — 다만 `ilike '%키워드%'`가 379,835행 풀스캔이라
--    느리다(limit로 방어는 해뒀지만 근본 해결은 아님). 앞뒤 와일드카드(%...%)는 일반 B-tree
--    인덱스를 전혀 못 쓰므로, 부분일치 전용인 pg_trgm(trigram) GIN 인덱스가 필요하다.
--
-- Supabase SQL Editor에서 한 번 실행.
-- ⚠️ CONCURRENTLY는 SQL 에디터(트랜잭션 블록)에서 에러가 난다 — 그래서 안 붙였다(2026-08-13에
--    db_indexes_migration.sql에서 같은 걸로 막혔던 기록 참고). 생성 중 잠깐 쓰기가 막힐 수 있으니
--    동기화가 안 도는 시간에 실행할 것.

create extension if not exists pg_trgm;

-- 영상 제목 — 검색은 title_norm(정규화 제목)에 건다. 코드도 title_norm으로 조회한다.
create index if not exists idx_ytcv_title_norm_trgm
  on public.yt_channel_videos using gin (title_norm gin_trgm_ops);

-- 공연 제목 — 741행이라 없어도 빠르지만, 늘어날 걸 감안해 같이 만들어 둔다.
create index if not exists idx_kpop_events_title_trgm
  on public.kpop_events using gin (title gin_trgm_ops);

-- 확인용(선택): 인덱스를 타는지 보고 싶으면
--   explain analyze
--   select id,title from yt_channel_videos where title_norm ilike '%whiplash%' limit 6;
-- 결과에 Bitmap Index Scan on idx_ytcv_title_norm_trgm 이 보이면 정상.
