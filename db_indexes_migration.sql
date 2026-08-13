-- yt_channel_videos 쿼리 지연(500ms~8.5초) 실측 원인 대응 인덱스 (2026-08-13)
--
-- 헤드리스 브라우저로 실제 카드 로딩 중 Supabase REST 요청 타이밍을 측정한 결과, 연결(DNS/TCP/TLS)
-- 오버헤드는 무시할 수준(수십ms)이고 병목은 DB 쪽 쿼리 실행 시간 자체였음. 느렸던 쿼리들의 공통점:
--   1) members/with_groups/content_formats 같은 배열 컬럼을 .cs()(contains)/.ov()(overlaps)로 검색
--   2) group_ko 필터 없이(또는 여러 그룹을 in()으로 묶어) 넓은 범위를 훑음
--   3) group_ko + published_at(또는 view_count) 정렬 조합
-- 배열 컬럼엔 기본 btree 인덱스가 안 먹기 때문에(GIN이 필요) 지금은 매번 순차 스캔(seq scan)했을
-- 가능성이 높음 — 아래 인덱스들을 추가하면 같은 쿼리가 인덱스를 타게 되어 DB 실행시간이 줄어듦.
--
-- ⚠️ CONCURRENTLY(테이블 락 없이 생성)는 Supabase SQL 에디터가 전체를 트랜잭션 블록으로 감싸서
-- 실행하기 때문에 못 씀("cannot run inside a transaction block" 에러, 2026-08-13 실제로 확인됨).
-- 그래서 CONCURRENTLY 없이 감. 생성 중 짧게 쓰기 락이 걸리지만(읽기는 영향 없음), 이 테이블은
-- 실시간 쓰기가 많지 않아(주로 동기화 스크립트/관리자 태깅 때만 씀) 실사용에 문제 없을 것.

-- 1) 배열 컬럼 GIN 인덱스 — .contains()/.overlaps() 검색이 실제로 인덱스를 타게 함
CREATE INDEX IF NOT EXISTS idx_ytv_members_gin
  ON yt_channel_videos USING GIN (members);

CREATE INDEX IF NOT EXISTS idx_ytv_with_members_gin
  ON yt_channel_videos USING GIN (with_members);

CREATE INDEX IF NOT EXISTS idx_ytv_with_groups_gin
  ON yt_channel_videos USING GIN (with_groups);

CREATE INDEX IF NOT EXISTS idx_ytv_content_formats_gin
  ON yt_channel_videos USING GIN (content_formats);

-- 2) 그룹 카드에서 가장 흔한 패턴(group_ko로 좁히고 published_at 내림차순 정렬) — 복합 인덱스로
--    필터+정렬을 한 번에 커버
CREATE INDEX IF NOT EXISTS idx_ytv_group_published
  ON yt_channel_videos (group_ko, published_at DESC);

-- 3) 연도별/주간 TOP류(카테고리+기간+조회수 정렬) 쿼리용 — 실측된 6초짜리 쿼리가 이 형태였음
CREATE INDEX IF NOT EXISTS idx_ytv_category_published_viewcount
  ON yt_channel_videos (category, published_at, view_count DESC);

-- 4) group_ko 단독 필터(정렬 없이 카운트만 세는 쿼리 등)용 — 이미 위 2번 복합인덱스가 커버할 수도
--    있지만, group_ko만 쓰고 published_at 정렬이 없는 쿼리(예: 총 개수 카운트)에는 단독 인덱스가
--    더 가벼울 수 있어 추가
CREATE INDEX IF NOT EXISTS idx_ytv_group_ko
  ON yt_channel_videos (group_ko);

-- 인덱스 생성 후 플래너 통계를 갱신해야 새 인덱스를 실제로 고려함
ANALYZE yt_channel_videos;

