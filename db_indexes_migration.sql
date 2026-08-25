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


-- ── 2026-08-25 추가: 어드민 검수 도구 조회 인덱스(실측 후 반영) ──────────────────
-- ⚠️ 아래 세 개는 "부분 인덱스"다 — 조건에 맞는 소수 행만 담아서 크기가 작고(전체의 5~8%),
--    다른 쿼리 계획에 영향을 주지 않는다. 다만 플래너가 인덱스를 쓰려면 쿼리 조건이 인덱스
--    predicate와 **같은 형태**여야 하므로, 아래 정규식/비교식을 바꾸면 admin.js 쪽 조회도 같이 고칠 것.

-- 그룹배정 검수 큐(needs_review 탭). 전엔 매 페이지가 371,448행을 훑었음.
CREATE INDEX IF NOT EXISTS idx_ytv_needs_review
  ON yt_channel_videos (id) WHERE needs_review;

-- 검수 센터 "원곡 커버" 스캔 — 제목 후보. ILIKE '%원곡%'은 2글자라 pg_trgm도 못 타서
-- 정규식(~*) + 부분 인덱스로 해결. 실측 11.9초 → 1.5초.
CREATE INDEX IF NOT EXISTS idx_ytv_wonkok_title
  ON yt_channel_videos (id) WHERE title ~* '원곡|커버|cover|original';

-- 같은 스캔의 두 번째 축 — with 태그 보유 행("여러 그룹 커버 메들리" 구조 신호). 실측 25.2초 → 2.0초.
CREATE INDEX IF NOT EXISTS idx_ytv_has_with_tags
  ON yt_channel_videos (id) WHERE with_groups <> '{}' OR with_members <> '{}';
